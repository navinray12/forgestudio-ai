import net from "net";
import { AppError } from "../../utils/app-error.js";

export async function scanWithClamAv(buffer:Buffer):Promise<{clean:boolean;detail:string}> {
  const host=process.env.CLAMAV_HOST;
  const port=Number(process.env.CLAMAV_PORT || 3310);
  if(!host || !Number.isInteger(port) || port<=0 || port>65535) {
    throw new AppError("Malware scanner is unavailable",503,"MALWARE_SCANNER_UNAVAILABLE");
  }
  const max=Number(process.env.FILE_SCAN_MAX_BYTES || 25*1024*1024);
  if(buffer.length>max) throw new AppError("File exceeds scanner limit",413,"FILE_TOO_LARGE");
  return await new Promise((resolve,reject)=>{
    const socket=net.createConnection({host,port});
    const timer=setTimeout(()=>{socket.destroy();reject(new AppError("Malware scan timed out",503,"MALWARE_SCANNER_TIMEOUT"));},10000);
    const chunks:Buffer[]=[];
    socket.on("connect",()=>{
      socket.write(Buffer.from("zINSTREAM\0"));
      for(let offset=0;offset<buffer.length;offset+=64*1024){
        const piece=buffer.subarray(offset,Math.min(buffer.length,offset+64*1024));
        const len=Buffer.alloc(4);len.writeUInt32BE(piece.length,0);socket.write(len);socket.write(piece);
      }
      socket.write(Buffer.alloc(4));
    });
    socket.on("data",(data)=>chunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data)));
    socket.on("error",(error)=>{clearTimeout(timer);reject(new AppError("Malware scanner connection failed",503,"MALWARE_SCANNER_UNAVAILABLE"));});
    socket.on("end",()=>{
      clearTimeout(timer);
      const detail=Buffer.concat(chunks).toString("utf8").replace(/\0/g,"").trim();
      if(/FOUND$/i.test(detail)) return resolve({clean:false,detail});
      if(/OK$/i.test(detail)) return resolve({clean:true,detail});
      reject(new AppError("Malware scanner returned an unknown verdict",503,"MALWARE_SCANNER_INVALID_RESPONSE"));
    });
  });
}
