import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { AppError } from "../../utils/app-error.js";

const DEFAULT_MAX=2*1024*1024;
const DEFAULT_TIMEOUT=10000;

function isBlockedAddress(address:string){
  const version=net.isIP(address);
  if(version===4){
    const [a,b]=address.split(".").map(Number);
    return a===0||a===10||a===127||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||a>=224;
  }
  if(version===6){
    const v=address.toLowerCase();
    return v==="::"||v==="::1"||v.startsWith("fc")||v.startsWith("fd")||/^fe[89ab]/.test(v)||v.startsWith("ff")||
      v.startsWith("::ffff:127.")||v.startsWith("::ffff:10.")||v.startsWith("::ffff:192.168.");
  }
  return true;
}

export async function resolveSafeDestination(raw:string, options:{allowHttp?:boolean;allowedPorts?:number[]}={}){
  let url:URL;
  try{url=new URL(raw);}catch{throw new AppError("External URL is invalid",400,"EGRESS_URL_INVALID");}
  const allowHttp=options.allowHttp===true&&process.env.NODE_ENV!=="production";
  if(url.protocol!=="https:"&&!(allowHttp&&url.protocol==="http:")) throw new AppError("External destinations must use HTTPS",400,"EGRESS_SCHEME_BLOCKED");
  if(url.username||url.password) throw new AppError("Embedded URL credentials are not allowed",400,"EGRESS_URL_INVALID");
  const host=url.hostname.toLowerCase().replace(/\.$/,"");
  if(host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local")||host.endsWith(".internal")||host.endsWith(".lan")) throw new AppError("Private destinations are not allowed",400,"EGRESS_DESTINATION_BLOCKED");
  const port=Number(url.port|| (url.protocol==="https:"?443:80));
  const ports=options.allowedPorts||[443];
  if(!ports.includes(port)) throw new AppError("External destination port is not allowed",400,"EGRESS_PORT_BLOCKED");
  if(net.isIP(host)&&isBlockedAddress(host)) throw new AppError("Private destinations are not allowed",400,"EGRESS_DESTINATION_BLOCKED");
  const answers=net.isIP(host)?[{address:host,family:net.isIP(host)}]:await dns.lookup(host,{all:true,verbatim:true});
  if(!answers.length||answers.some(a=>isBlockedAddress(a.address))) throw new AppError("External destination resolved to a prohibited address",400,"EGRESS_DESTINATION_BLOCKED");
  return {url,address:answers[0].address,family:answers[0].family};
}

export async function safeEgressRequest(input:{
  url:string;method?:"GET"|"POST"|"PUT"|"PATCH"|"DELETE";
  headers?:Record<string,string>;body?:Buffer|string;timeoutMs?:number;maxResponseBytes?:number;
  allowedPorts?:number[];allowHttp?:boolean;
}):Promise<{status:number;headers:http.IncomingHttpHeaders;body:Buffer}>{
  const destination=await resolveSafeDestination(input.url,{allowHttp:input.allowHttp,allowedPorts:input.allowedPorts});
  const url=destination.url;
  const transport=url.protocol==="https:"?https:http;
  const timeout=Math.max(250,Math.min(30000,input.timeoutMs||DEFAULT_TIMEOUT));
  const max=Math.max(1024,Math.min(20*1024*1024,input.maxResponseBytes||DEFAULT_MAX));
  return new Promise((resolve,reject)=>{
    const req=transport.request({
      protocol:url.protocol,hostname:url.hostname,port:url.port||undefined,path:`${url.pathname}${url.search}`,
      method:input.method||"GET",headers:{...input.headers,Host:url.host},
      servername:url.hostname,
      lookup:(_hostname,_options,callback)=>callback(null,destination.address,destination.family as 4|6),
      timeout,
    },res=>{
      if((res.statusCode||0)>=300&&(res.statusCode||0)<400){res.resume();reject(new AppError("External redirects are not allowed",502,"EGRESS_REDIRECT_BLOCKED"));return;}
      const chunks:Buffer[]=[];let bytes=0;
      res.on("data",(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>max){req.destroy(new AppError("External response is too large",502,"EGRESS_RESPONSE_TOO_LARGE"));return;}chunks.push(Buffer.from(chunk));});
      res.on("end",()=>resolve({status:res.statusCode||0,headers:res.headers,body:Buffer.concat(chunks)}));
    });
    req.on("timeout",()=>req.destroy(new AppError("External request timed out",504,"EGRESS_TIMEOUT")));
    req.on("error",reject);
    if(input.body!==undefined) req.write(input.body);
    req.end();
  });
}

export function parseJsonEgress<T=any>(response:{status:number;body:Buffer}):T{
  if(response.status<200||response.status>=300) throw new AppError(`External service returned HTTP ${response.status}`,502,"EGRESS_UPSTREAM_ERROR");
  try{return JSON.parse(response.body.toString("utf8")) as T;}catch{throw new AppError("External service returned invalid JSON",502,"EGRESS_INVALID_RESPONSE");}
}
