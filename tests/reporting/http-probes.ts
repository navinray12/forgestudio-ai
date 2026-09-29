export interface Probe {
  testName: string; url: string; method?: string; body?: string;
  headers?: Record<string,string>; status: number[];
  verify?: (body: string) => boolean;
}
export async function runHttpProbes(probes: Probe[]) {
  const results: Array<{testName:string; passed:boolean; status:number; durationMs:number; details:string}>=[];
  for (const probe of probes) {
    const started=performance.now();
    try {
      const response=await fetch(probe.url, {method:probe.method ?? "GET", body:probe.body,
        headers:{"Content-Type":"application/json",...probe.headers}, redirect:"manual", signal:AbortSignal.timeout(5000)});
      // Small fixture responses only; never allow a receiver to grow test memory indefinitely.
      const reader=response.body?.getReader(); let size=0; const chunks:Uint8Array[]=[];
      if (reader) for (;;) {
        const {done,value}=await reader.read(); if(done)break;
        size+=value.byteLength; if(size>262144) {await reader.cancel();throw new Error("Probe response too large");}
        chunks.push(value);
      }
      const body=Buffer.concat(chunks).toString("utf8");
      const passed=probe.status.includes(response.status) && (!probe.verify || probe.verify(body));
      results.push({testName:probe.testName,passed,status:response.status,durationMs:performance.now()-started,
        details:passed ? "Expected response verified" : "Unexpected status or payload"});
    } catch (error) {
      results.push({testName:probe.testName,passed:false,status:0,durationMs:performance.now()-started,
        details:error instanceof Error?error.message:"Probe failed"});
    }
  }
  const passed=results.filter(result=>result.passed).length;
  console.log(JSON.stringify(results,null,2));
  return {results,passed,failed:results.length-passed};
}
