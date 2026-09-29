import {runHttpProbes} from "../reporting/http-probes.js";
export function runApiTestSuite() {
  return runHttpProbes([
    {testName:"Backend health",url:"http://localhost:5000/api/v1/health",status:[200]},
    {testName:"WordPress REST root",url:"http://localhost:8000/wp-json/",status:[200]},
    {testName:"WordPress posts",url:"http://localhost:8000/wp-json/wp/v2/posts",status:[200]},
    {testName:"WordPress categories",url:"http://localhost:8000/wp-json/wp/v2/categories",status:[200]},
    {testName:"Unauthenticated connection denied",url:"http://localhost:5000/api/websites/4711f70c-fa14-43d8-aa84-3435adc6ce72/wordpress/connect",method:"POST",body:JSON.stringify({siteUrl:"http://localhost:8000"}),status:[401]},
    {testName:"WordPress plugin administration denied",url:"http://localhost:8000/wp-json/wp/v2/plugins",status:[401]},
    {testName:"WordPress theme administration denied",url:"http://localhost:8000/wp-json/wp/v2/themes",status:[401]},
  ]);
}
