import dns from "dns";
import http from "http";
import https from "https";
import net from "net";
import { AppError } from "../utils/app-error.js";

function blockedV4(address:string):boolean {
  const p=address.split(".").map(Number); if(p.length!==4||p.some(n=>!Number.isInteger(n)||n<0||n>255)) return true;
  const [a,b]=p;
  return a===0 || a===10 || a===127 || a>=224 || a===169&&b===254 ||
    a===172&&b>=16&&b<=31 || a===192&&b===168 || a===100&&b>=64&&b<=127 ||
    a===198&&(b===18||b===19);
}
function blockedIp(address:string):boolean {
  const type=net.isIP(address); if(type===4) return blockedV4(address);
  if(type!==6) return true;
  const v=address.toLowerCase();
  if(v==="::"||v==="::1"||v.startsWith("fc")||v.startsWith("fd")||/^fe[89ab]/.test(v)||v.startsWith("ff")) return true;
  if(v.startsWith("::ffff:")) return blockedV4(v.slice(7));
  return false;
}

export async function validateEgressUrl(raw:string):Promise<{url:URL;address:string;family:4|6}> {
  let url:URL; try{url=new URL(raw);}catch{throw new AppError("Invalid outbound URL",400,"EGRESS_URL_INVALID");}
  const dev=process.env.NODE_ENV!=="production";
  if(url.username||url.password) throw new AppError("Embedded URL credentials are not allowed",400,"EGRESS_URL_INVALID");
  if(url.protocol!=="https:" && !(dev&&url.protocol==="http:")) throw new AppError("Outbound URL must use HTTPS",400,"EGRESS_URL_INVALID");
  const port=Number(url.port || (url.protocol==="https:"?443:80));
  if((!dev&&port!==443)||port<1||port>65535) throw new AppError("Outbound port is not allowed",400,"EGRESS_URL_INVALID");
  const host=url.hostname.toLowerCase();
  if(["localhost","metadata.google.internal"].includes(host)||host.endsWith(".local")||host.endsWith(".internal")||host.endsWith(".lan")) {
    throw new AppError("Outbound destination is restricted",400,"EGRESS_DESTINATION_BLOCKED");
  }
  const resolved=net.isIP(host)?[{address:host,family:net.isIP(host) as 4|6}]:await dns.promises.lookup(host,{all:true,verbatim:true});
  const allowed=resolved.find(item=>!blockedIp(item.address));
  if(!allowed || resolved.some(item=>blockedIp(item.address))) {
    throw new AppError("Outbound destination resolves to a restricted network",400,"EGRESS_DESTINATION_BLOCKED");
  }
  return {url,address:allowed.address,family:allowed.family as 4|6};
}

export async function safeEgressJson(input:{
  url:string;method?:"GET"|"POST"|"PUT"|"PATCH"|"DELETE";headers?:Record<string,string>;body?:string;
  timeoutMs?:number;maxBytes?:number;
}):Promise<{status:number;ok:boolean;json:any;headers:http.IncomingHttpHeaders}> {
  const target=await validateEgressUrl(input.url);
  const client=target.url.protocol==="https:"?https:http;
  const timeout=Math.max(250,Math.min(10000,input.timeoutMs??5000));
  const maxBytes=Math.max(1024,Math.min(5*1024*1024,input.maxBytes??1024*1024));
  return await new Promise((resolve,reject)=>{
    const req=client.request({
      protocol:target.url.protocol,hostname:target.url.hostname,port:target.url.port||undefined,
      method:input.method??"GET",path:target.url.pathname+target.url.search,headers:input.headers,
      servername:target.url.hostname,
      lookup:(_hostname,_options,callback)=>callback(null,target.address,target.family),
    },res=>{
      const chunks:Buffer[]=[];let total=0;
      res.on("data",(chunk:Buffer)=>{total+=chunk.length;if(total>maxBytes){req.destroy(new Error("response too large"));return;}chunks.push(chunk);});
      res.on("end",()=>{
        const text=Buffer.concat(chunks).toString("utf8");
        let json:any=null; try{json=text?JSON.parse(text):{};}catch{json={message:"Invalid JSON response"};}
        resolve({status:res.statusCode??502,ok:(res.statusCode??500)>=200&&(res.statusCode??500)<300,json,headers:res.headers});
      });
    });
    req.setTimeout(timeout,()=>req.destroy(new Error("outbound request timed out")));
    req.on("error",()=>reject(new AppError("Outbound destination is unavailable",502,"EGRESS_UNAVAILABLE")));
    if(input.body) req.write(input.body); req.end();
  });
}
