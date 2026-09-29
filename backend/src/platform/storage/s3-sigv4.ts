import crypto from "node:crypto";
import { AppError } from "../../utils/app-error.js";

type AwsCredentials = { accessKeyId: string; secretAccessKey: string; sessionToken?: string };

function encode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}
function hmac(key: Buffer | string, data: string) { return crypto.createHmac("sha256", key).update(data).digest(); }
function hash(data: string) { return crypto.createHash("sha256").update(data).digest("hex"); }
function dateParts(now: Date) {
  const iso=now.toISOString().replace(/[:-]|\.\d{3}/g,"");
  return { amzDate: iso, date: iso.slice(0,8) };
}
function signingKey(secret: string, date: string, region: string) {
  const kDate=hmac(`AWS4${secret}`,date);
  const kRegion=hmac(kDate,region);
  const kService=hmac(kRegion,"s3");
  return hmac(kService,"aws4_request");
}

async function credentials(): Promise<AwsCredentials> {
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    return { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY, sessionToken: process.env.AWS_SESSION_TOKEN };
  }
  const relative=process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI;
  if (!relative || !relative.startsWith("/")) throw new AppError("AWS task credentials are unavailable",503,"STORAGE_CREDENTIALS_UNAVAILABLE");
  const response=await fetch(`http://169.254.170.2${relative}`,{
    headers: process.env.AWS_CONTAINER_AUTHORIZATION_TOKEN ? { Authorization: process.env.AWS_CONTAINER_AUTHORIZATION_TOKEN } : {},
    signal: AbortSignal.timeout(1500),
  });
  if (!response.ok) throw new AppError("AWS task credentials are unavailable",503,"STORAGE_CREDENTIALS_UNAVAILABLE");
  const data=await response.json() as Record<string,any>;
  if (!data.AccessKeyId || !data.SecretAccessKey) throw new AppError("AWS task credentials are invalid",503,"STORAGE_CREDENTIALS_UNAVAILABLE");
  return { accessKeyId:String(data.AccessKeyId), secretAccessKey:String(data.SecretAccessKey), sessionToken:data.Token?String(data.Token):undefined };
}

export async function presignS3(input:{
  method:"GET"|"PUT"|"DELETE"|"HEAD";
  bucket:string;
  key:string;
  expiresSeconds?:number;
  now?:Date;
}) {
  const region=process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
  if (!region) throw new AppError("AWS region is not configured",503,"STORAGE_NOT_CONFIGURED");
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(input.bucket) || input.bucket.includes("..")) {
    throw new AppError("S3 bucket configuration is invalid",503,"STORAGE_NOT_CONFIGURED");
  }
  if (!input.key || input.key.startsWith("/") || input.key.includes("..")) throw new AppError("Object key is invalid",400,"INVALID_OBJECT_KEY");
  const creds=await credentials();
  const now=input.now || new Date();
  const {amzDate,date}=dateParts(now);
  const expires=Math.max(60,Math.min(900,input.expiresSeconds || 300));
  const host=`${input.bucket}.s3.${region}.amazonaws.com`;
  const canonicalUri="/"+input.key.split("/").map(encode).join("/");
  const scope=`${date}/${region}/s3/aws4_request`;
  const query:Record<string,string>={
    "X-Amz-Algorithm":"AWS4-HMAC-SHA256",
    "X-Amz-Credential":`${creds.accessKeyId}/${scope}`,
    "X-Amz-Date":amzDate,
    "X-Amz-Expires":String(expires),
    "X-Amz-SignedHeaders":"host",
  };
  if (creds.sessionToken) query["X-Amz-Security-Token"]=creds.sessionToken;
  const canonicalQuery=Object.entries(query).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${encode(k)}=${encode(v)}`).join("&");
  const canonicalRequest=`${input.method}\n${canonicalUri}\n${canonicalQuery}\nhost:${host}\n\nhost\nUNSIGNED-PAYLOAD`;
  const stringToSign=`AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${hash(canonicalRequest)}`;
  const signature=crypto.createHmac("sha256",signingKey(creds.secretAccessKey,date,region)).update(stringToSign).digest("hex");
  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

export async function getS3Object(bucket:string,key:string,maxBytes:number):Promise<Buffer> {
  const url=await presignS3({method:"GET",bucket,key,expiresSeconds:120});
  const response=await fetch(url,{redirect:"error",signal:AbortSignal.timeout(30000)});
  if (!response.ok) throw new AppError("Object storage read failed",502,"STORAGE_READ_FAILED");
  const length=Number(response.headers.get("content-length")||0);
  if (length>maxBytes) throw new AppError("Stored object exceeds the allowed size",413,"FILE_TOO_LARGE");
  const body=Buffer.from(await response.arrayBuffer());
  if (body.length>maxBytes) throw new AppError("Stored object exceeds the allowed size",413,"FILE_TOO_LARGE");
  return body;
}

export async function putS3Object(bucket:string,key:string,body:Buffer,contentType:string) {
  const url=await presignS3({method:"PUT",bucket,key,expiresSeconds:120});
  const response=await fetch(url,{method:"PUT",headers:{"Content-Type":contentType,"Content-Length":String(body.length)},body:new Uint8Array(body),redirect:"error",signal:AbortSignal.timeout(30000)});
  if (!response.ok) throw new AppError("Object storage write failed",502,"STORAGE_WRITE_FAILED");
}

export async function deleteS3Object(bucket:string,key:string) {
  const url=await presignS3({method:"DELETE",bucket,key,expiresSeconds:120});
  const response=await fetch(url,{method:"DELETE",redirect:"error",signal:AbortSignal.timeout(15000)});
  if (!response.ok && response.status!==404) throw new AppError("Object storage cleanup failed",502,"STORAGE_DELETE_FAILED");
}
