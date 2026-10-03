import { performance } from "node:perf_hooks";

/** Real bounded HTTP smoke measurements, deliberately not an editor benchmark. */
export async function runPerformanceTestSuite() {
  const measurements: number[] = [];
  let failed = 0;
  for (let index=0;index<10;index++) {
    const started=performance.now();
    try {
      const response=await fetch("http://127.0.0.1:5000/api/v1/health", {signal:AbortSignal.timeout(5000)});
      await response.arrayBuffer();
      if (!response.ok) failed++;
      measurements.push(performance.now()-started);
    } catch {failed++;}
  }
  const sorted=[...measurements].sort((a,b)=>a-b);
  return {scope:"health-http-smoke-only", benchmarks:[], measurementsMs:measurements,
    p95Ms: sorted.length ? sorted[Math.ceil(sorted.length*0.95)-1] : null,
    passed:failed===0 && measurements.length===10, failed,
    editorQualification:"NOT_VERIFIED", referenceLoadQualification:"NOT_VERIFIED"};
}
