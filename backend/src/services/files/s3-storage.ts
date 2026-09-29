import { createHmac, createHash } from "crypto";
import { AppError } from "../../utils/app-error.js";

type Method = "PUT" | "GET" | "HEAD";
type Credentials = { accessKeyId:string; secretAccessKey:string; sessionToken?:string };

function credentials(): Credentials {
  const accessKeyId=process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey=process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY;
  const sessionToken=process.env.AWS_SESSION_TOKEN || process.env.S3_SESSION_TOKEN;
  if(!accessKeyId || !secretAccessKey) throw new AppError("S3 credentials are unavailable",503,"OBJECT_STORAGE_UNAVAILABLE");
  return {accessKeyId,secretAccessKey,sessionToken};
}
function bucket(): string {
  const value=process.env.S3_BUCKET;
  if(!value || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(value)) throw new AppError("S3 bucket is not configured",503,"OBJECT_STORAGE_UNAVAILABLE");
  return value;
}
function region(): string {
  const value=process.env.AWS_REGION || process.env.S3_REGION;
  if(!value || !/^[a-z0-9-]{3,32}$/.test(value)) throw new AppError("S3 region is not configured",503,"OBJECT_STORAGE_UNAVAILABLE");
  return value;
}
function encodeKey(key:string):string {
  return "/" + key.split("/").map(part=>encodeURIComponent(part).replace(/%2F/gi,"/")).join("/");
}
function hmac(key:Buffer|string,value:string):Buffer { return createHmac("sha256",key).update(value).digest(); }
function sha(value:string):string { return createHash("sha256").update(value).digest("hex"); }
function signingKey(secret:string,date:string,regionName:string):Buffer {
  const dateKey=hmac("AWS4"+secret,date);
  const regionKey=hmac(dateKey,regionName);
  const serviceKey=hmac(regionKey,"s3");
  return hmac(serviceKey,"aws4_request");
}

export function presignS3(input:{
  method:Method; key:string; expiresSeconds?:number; signedHeaders?:Record<string,string>;
}):{url:string;headers:Record<string,string>} {
  if(!input.key || input.key.length>900 || input.key.includes("..")) throw new AppError("Invalid object key",400,"INVALID_OBJECT_KEY");
  const creds=credentials(); const regionName=region(); const bucketName=bucket();
  const host=process.env.S3_ENDPOINT_HOST || (bucketName+".s3."+regionName+".amazonaws.com");
  if(!/^[a-zA-Z0-9.-]+$/.test(host)) throw new AppError("Invalid S3 endpoint",503,"OBJECT_STORAGE_UNAVAILABLE");
  const now=new Date();
  const amzDate=now.toISOString().replace(/[:-]|\.\d{3}/g,"");
  const date=amzDate.slice(0,8);
  const scope=date+"/"+regionName+"/s3/aws4_request";
  const headers:Record<string,string>={host,...(input.signedHeaders??{})};
  const headerNames=Object.keys(headers).map(v=>v.toLowerCase()).sort();
  const canonicalHeaders=headerNames.map(name=>{
    const original=Object.keys(headers).find(k=>k.toLowerCase()===name)!;
    return name+":"+String(headers[original]).trim()+"\n";
  }).join("");
  const signedHeaders=headerNames.join(";");
  const params=new URLSearchParams();
  params.set("X-Amz-Algorithm","AWS4-HMAC-SHA256");
  params.set("X-Amz-Credential",creds.accessKeyId+"/"+scope);
  params.set("X-Amz-Date",amzDate);
  params.set("X-Amz-Expires",String(Math.max(30,Math.min(900,input.expiresSeconds??300))));
  params.set("X-Amz-SignedHeaders",signedHeaders);
  if(creds.sessionToken) params.set("X-Amz-Security-Token",creds.sessionToken);
  const query=[...params.entries()].sort(([a],[b])=>a.localeCompare(b))
    .map(([k,v])=>encodeURIComponent(k)+"="+encodeURIComponent(v)).join("&");
  const canonicalRequest=[input.method,encodeKey(input.key),query,canonicalHeaders,signedHeaders,"UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign=["AWS4-HMAC-SHA256",amzDate,scope,sha(canonicalRequest)].join("\n");
  const signature=createHmac("sha256",signingKey(creds.secretAccessKey,date,regionName)).update(stringToSign).digest("hex");
  return {
    url:"https://"+host+encodeKey(input.key)+"?"+query+"&X-Amz-Signature="+signature,
    headers:Object.fromEntries(Object.entries(input.signedHeaders??{})),
  };
}

export function objectStorageConfigured():boolean {
  return Boolean((process.env.AWS_ACCESS_KEY_ID||process.env.S3_ACCESS_KEY_ID) &&
    (process.env.AWS_SECRET_ACCESS_KEY||process.env.S3_SECRET_ACCESS_KEY) &&
    process.env.S3_BUCKET && (process.env.AWS_REGION||process.env.S3_REGION));
}
