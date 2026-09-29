import crypto from "node:crypto";
import { AppError } from "../../utils/app-error.js";

type Credentials={accessKeyId:string;secretAccessKey:string;sessionToken?:string};

function hmac(key:Buffer|string,data:string){return crypto.createHmac("sha256",key).update(data).digest();}
function hash(data:string|Buffer){return crypto.createHash("sha256").update(data).digest("hex");}
function dateParts(now:Date){const iso=now.toISOString().replace(/[:-]|\.\d{3}/g,"");return{amzDate:iso,date:iso.slice(0,8)};}
function signingKey(secret:string,date:string,region:string,service:string){
  const kd=hmac(`AWS4${secret}`,date),kr=hmac(kd,region),ks=hmac(kr,service);return hmac(ks,"aws4_request");
}
async function awsCredentials():Promise<Credentials>{
  if(process.env.AWS_ACCESS_KEY_ID&&process.env.AWS_SECRET_ACCESS_KEY){
    return{accessKeyId:process.env.AWS_ACCESS_KEY_ID,secretAccessKey:process.env.AWS_SECRET_ACCESS_KEY,sessionToken:process.env.AWS_SESSION_TOKEN};
  }
  const relative=process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI;
  if(!relative||!relative.startsWith("/")) throw new AppError("AWS workload credentials are unavailable",503,"SECRET_PROVIDER_UNAVAILABLE");
  const response=await fetch(`http://169.254.170.2${relative}`,{
    headers:process.env.AWS_CONTAINER_AUTHORIZATION_TOKEN?{Authorization:process.env.AWS_CONTAINER_AUTHORIZATION_TOKEN}:{},
    signal:AbortSignal.timeout(1500),
  });
  if(!response.ok) throw new AppError("AWS workload credentials are unavailable",503,"SECRET_PROVIDER_UNAVAILABLE");
  const data=await response.json() as Record<string,any>;
  if(!data.AccessKeyId||!data.SecretAccessKey) throw new AppError("AWS workload credentials are invalid",503,"SECRET_PROVIDER_UNAVAILABLE");
  return{accessKeyId:String(data.AccessKeyId),secretAccessKey:String(data.SecretAccessKey),sessionToken:data.Token?String(data.Token):undefined};
}
async function secretsManagerRequest(target:string,body:Record<string,unknown>){
  const region=process.env.AWS_REGION||process.env.AWS_DEFAULT_REGION;
  if(!region) throw new AppError("AWS region is not configured",503,"SECRET_PROVIDER_UNAVAILABLE");
  const credentials=await awsCredentials(),service="secretsmanager",host=`secretsmanager.${region}.amazonaws.com`,path="/";
  const payload=JSON.stringify(body),now=new Date(),{amzDate,date}=dateParts(now),scope=`${date}/${region}/${service}/aws4_request`;
  const headers:Record<string,string>={
    "content-type":"application/x-amz-json-1.1","host":host,"x-amz-date":amzDate,"x-amz-target":`secretsmanager.${target}`,
  };
  if(credentials.sessionToken)headers["x-amz-security-token"]=credentials.sessionToken;
  const signedNames=Object.keys(headers).sort();
  const canonicalHeaders=signedNames.map(k=>`${k}:${headers[k].trim()}\n`).join("");
  const canonical=`POST\n${path}\n\n${canonicalHeaders}\n${signedNames.join(";")}\n${hash(payload)}`;
  const toSign=`AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${hash(canonical)}`;
  const signature=crypto.createHmac("sha256",signingKey(credentials.secretAccessKey,date,region,service)).update(toSign).digest("hex");
  const authorization=`AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${signedNames.join(";")}, Signature=${signature}`;
  const response=await fetch(`https://${host}/`,{
    method:"POST",headers:{...headers,authorization},body:payload,redirect:"error",signal:AbortSignal.timeout(5000),
  });
  const text=await response.text();
  if(!response.ok) throw new AppError(`Secret provider rejected the request (HTTP ${response.status})`,502,"SECRET_PROVIDER_FAILED");
  try{return JSON.parse(text) as Record<string,any>;}catch{throw new AppError("Secret provider returned invalid JSON",502,"SECRET_PROVIDER_FAILED");}
}

export async function resolveSecretReference(reference:string):Promise<string>{
  const ref=String(reference||"").trim();
  if(ref.startsWith("env:")){
    if(process.env.NODE_ENV==="production") throw new AppError("Environment secret references are disabled in production",503,"SECRET_REFERENCE_NOT_ALLOWED");
    const name=ref.slice(4);
    if(!/^[A-Z][A-Z0-9_]{1,100}$/.test(name)||!process.env[name]) throw new AppError("Development secret reference is unavailable",503,"SECRET_PROVIDER_UNAVAILABLE");
    return process.env[name]!;
  }
  if(!ref.startsWith("secretsmanager:")) throw new AppError("Unsupported secret reference",503,"SECRET_REFERENCE_NOT_ALLOWED");
  const spec=ref.slice("secretsmanager:".length);
  const hashIndex=spec.lastIndexOf("#");
  const secretId=(hashIndex>=0?spec.slice(0,hashIndex):spec).trim();
  const field=hashIndex>=0?spec.slice(hashIndex+1).trim():"";
  if(!secretId||secretId.length>500||/\s/.test(secretId)) throw new AppError("Secret reference is invalid",503,"SECRET_REFERENCE_NOT_ALLOWED");
  const data=await secretsManagerRequest("GetSecretValue",{SecretId:secretId});
  let value:string;
  if(typeof data.SecretString==="string") value=data.SecretString;
  else if(typeof data.SecretBinary==="string") value=Buffer.from(data.SecretBinary,"base64").toString("utf8");
  else throw new AppError("Secret has no readable value",502,"SECRET_PROVIDER_FAILED");
  if(field){
    let parsed:Record<string,unknown>;try{parsed=JSON.parse(value);}catch{throw new AppError("Referenced secret is not JSON",502,"SECRET_PROVIDER_FAILED");}
    const selected=parsed[field];if(typeof selected!=="string") throw new AppError("Referenced secret field is unavailable",502,"SECRET_PROVIDER_FAILED");
    return selected;
  }
  return value;
}

export async function parseSecretJson(reference:string):Promise<Record<string,string>>{
  const raw=await resolveSecretReference(reference);
  let parsed:unknown;try{parsed=JSON.parse(raw);}catch{throw new AppError("Connector secret must be a JSON object",502,"SECRET_PROVIDER_FAILED");}
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed)) throw new AppError("Connector secret must be a JSON object",502,"SECRET_PROVIDER_FAILED");
  const result:Record<string,string>={};
  for(const [key,value] of Object.entries(parsed as Record<string,unknown>)) if(typeof value==="string") result[key]=value;
  return result;
}
