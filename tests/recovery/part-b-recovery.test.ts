import {runHttpProbes} from "../reporting/http-probes.js";
export function runRecoveryTestSuite() {
  // These are invalid-request recovery probes, not an authenticated partner-outage exercise.
  return runHttpProbes([
    {testName:"Unauthenticated offline destination does not execute",url:"http://localhost:5000/api/websites/4711f70c-fa14-43d8-aa84-3435adc6ce72/wordpress/connect",method:"POST",body:JSON.stringify({siteUrl:"http://127.0.0.1:9999",apiKey:"invalid_fixture"}),status:[401]},
    {testName:"Malformed JSON rejected",url:"http://localhost:5000/api/websites/4711f70c-fa14-43d8-aa84-3435adc6ce72/wordpress/connect",method:"POST",body:"invalid_json_{{",status:[400]},
    {testName:"Process continues after invalid requests",url:"http://localhost:5000/api/v1/health",status:[200]},
  ]);
}
