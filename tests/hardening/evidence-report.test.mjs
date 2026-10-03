import test from "node:test";
import assert from "node:assert/strict";
import {featureEvidence,summarizeSuites} from "../reporting/evidence.mjs";
test("EVIDENCE-001: test tags never manufacture feature passes",()=>{
 const [result]=featureEvidence([{id:"x",testLevel:["UI","API"]}]);assert.equal(result.result,"NOT_VERIFIED");assert.deepEqual(result.evidence,[]);
});
test("EVIDENCE-002: complete explicit commit-bound evidence is required",()=>{
 const registry=[{id:"x",requiredTests:["a","b"]}];
 assert.equal(featureEvidence(registry,[{featureId:"x",testId:"a",passed:true,commit:"sha"}])[0].result,"NOT_VERIFIED");
 assert.equal(featureEvidence(registry,[{featureId:"x",testId:"a",passed:true,commit:"sha"},{featureId:"x",testId:"b",passed:true,commit:"sha"}])[0].result,"PASS");
});
test("EVIDENCE-003: any failed explicit check defeats success",()=>{
 assert.equal(featureEvidence([{id:"x",requiredTests:["a"]}],[{featureId:"x",testId:"a",passed:false,commit:"sha"}])[0].result,"FAIL");
});
test("EVIDENCE-004: empty suites are not passing evidence",()=>{
 assert.equal(summarizeSuites({empty:{passed:0,failed:0,results:[]}})[0].status,"FAIL");
});
