/** A bounded partial-repair check, NOT a replacement for the red full-build gate. */
const fs=require('node:fs');
function diagnostics(file){
 return fs.readFileSync(file,'utf8').split(/\r?\n/).filter(x=>/error TS\d+:/.test(x))
  .map(x=>x.replace(/\(\d+,\d+\)/,'').trim()).sort();
}
const [beforeFile,afterFile]=process.argv.slice(2);
if(!beforeFile||!afterFile)throw Error('Expected baseline and candidate diagnostics');
const before=diagnostics(beforeFile),after=diagnostics(afterFile);
const counts=new Map();for(const d of before)counts.set(d,(counts.get(d)||0)+1);
for(const d of after){const n=counts.get(d)||0;if(n===0)throw Error(`New backend diagnostic: ${d}`);counts.set(d,n-1);}
if(before.length===0||after.length>=before.length)throw Error('This repair must demonstrate fewer backend diagnostics');
console.log(JSON.stringify({baselineErrors:before.length,candidateErrors:after.length,resolvedErrors:before.length-after.length,fullBackendBuildPassed:after.length===0,remaining:after},null,2));
