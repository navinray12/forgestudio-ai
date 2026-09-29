import {runHttpProbes} from "../reporting/http-probes.js";
export function runWordPressE2ESuite() {
  return runHttpProbes([
    {testName:"WordPress runtime reachable",url:"http://localhost:8000/wp-json/",status:[200]},
    {testName:"Core REST namespace",url:"http://localhost:8000/wp-json/",status:[200],verify:body=>JSON.parse(body).namespaces?.includes("wp/v2")===true},
    {testName:"Actual Forge connector namespace",url:"http://localhost:8000/wp-json/",status:[200],verify:body=>JSON.parse(body).namespaces?.includes("forgestudio/v1")===true},
    {testName:"Postname permalink with a real post",url:"http://localhost:8000/wp-json/wp/v2/posts",status:[200],verify:body=>{
      const posts=JSON.parse(body);const link=posts[0]?.link;
      return Array.isArray(posts)&&posts.length>0&&typeof link==="string"&&link.startsWith("http")&&!link.includes("?p=");
    }},
  ]);
}
