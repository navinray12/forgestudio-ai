import {runHttpProbes} from "../reporting/http-probes.js";
export function runSecurityTestSuite() {
  return runHttpProbes([
    {testName:"Unauthenticated connection denied",url:"http://localhost:5000/api/websites/4711f70c-fa14-43d8-aa84-3435adc6ce72/wordpress/connect",method:"POST",body:JSON.stringify({siteUrl:"http://localhost:8000"}),status:[401]},
    {testName:"Invalid WordPress nonce denied",url:"http://localhost:8000/wp-json/wp/v2/plugins",headers:{"X-WP-Nonce":"invalid_nonce_fixture"},status:[401,403]},
    // Authentication rejection is not evidence of browser sanitization or XSS resistance.
    {testName:"Unauthenticated adversarial payload denied",url:"http://localhost:5000/api/websites/4711f70c-fa14-43d8-aa84-3435adc6ce72/wordpress/connect",method:"POST",body:JSON.stringify({name:"<script>alert(1)</script>",content:"<img src=x onerror=alert(1)>"}),status:[401,400,422]},
  ]);
}
