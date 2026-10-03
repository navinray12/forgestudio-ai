import assert from "node:assert/strict";
import test from "node:test";
import { tenantIsolationPreflight } from "../operations/tenant-isolation-preflight.js";

test("tenant isolation preflight reports forced RLS evidence and unsafe superuser fixture role",async()=>{
  const result=await tenantIsolationPreflight();
  assert.equal(result.missingForcedRls.length,0);
  assert.equal(result.runtimeRole.superuser,true);
  assert.equal(result.runtimeRole.safeForProductionRls,false);
  assert.equal(result.readyForLegacyRlsCutover,false);
  assert.ok(result.forcedRlsTables.some(r=>r.table_name==="file_objects"&&r.enabled&&r.forced));
});
