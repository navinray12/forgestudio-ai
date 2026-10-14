/**
 * ForgeStudio Execution Blueprint v2.1 — Point 08: Component Contracts, Design Fidelity and Source Ownership
 * Test Suite 4: Custom Source Import Security & Isolation Boundaries
 */

import assert from "node:assert/strict";
import test from "node:test";
import { customSourceImportService } from "../services/components/customSourceImport.service.js";
import { previewSecurityService } from "../services/components/previewSecurity.service.js";

test("Point 08 — Source Import Security & Isolation Suite", async (t) => {
  t.beforeEach(() => {
    customSourceImportService.reset();
  });

  await t.test("1. Rejects path traversal and forbidden executable extensions in uploaded files", () => {
    // Path traversal in filename
    const traversalRes = customSourceImportService.inspectUploadedSource({
      importId: "imp-trav-01",
      tenantId: "tenant-acme",
      projectId: "proj-01",
      uploaderId: "user-alice",
      fileName: "../../../etc/passwd.tsx",
      sourceContent: "export const Component = () => null;"
    });

    assert.equal(traversalRes.isApproved, false);
    assert.equal(traversalRes.status, "BLOCKED_SECURITY_RISK");
    assert.ok(traversalRes.findings.some(f => f.code === "PATH_TRAVERSAL_DETECTED"));

    // Forbidden executable extension (.sh)
    const shellRes = customSourceImportService.inspectUploadedSource({
      importId: "imp-sh-01",
      tenantId: "tenant-acme",
      projectId: "proj-01",
      uploaderId: "user-alice",
      fileName: "install.sh",
      sourceContent: "echo 'malicious script'"
    });

    assert.equal(shellRes.isApproved, false);
    assert.ok(shellRes.findings.some(f => f.code === "FORBIDDEN_FILE_EXTENSION"));
  });

  await t.test("2. Detects dangerous capabilities (child_process, eval, process.env) in source code", () => {
    const dangerousSource = `
      import React from "react";
      import { exec } from "child_process";

      export const MaliciousComponent = () => {
        eval("console.log(process.env.SECRET_TOKEN)");
        return <div>Exploit</div>;
      };
    `;

    const res = customSourceImportService.inspectUploadedSource({
      importId: "imp-dang-01",
      tenantId: "tenant-acme",
      projectId: "proj-01",
      uploaderId: "user-attacker",
      fileName: "Exploit.tsx",
      sourceContent: dangerousSource
    });

    assert.equal(res.isApproved, false);
    assert.equal(res.status, "BLOCKED_SECURITY_RISK");
    assert.ok(res.findings.some(f => f.code === "EXEC_PROCESS_ATTEMPT"));
    assert.ok(res.findings.some(f => f.code === "DYNAMIC_EVAL_ATTEMPT"));
    assert.ok(res.findings.some(f => f.code === "ENV_ACCESS_ATTEMPT"));
    assert.ok(res.findings.some(f => f.code === "DANGEROUS_PACKAGE_IMPORT"));
  });

  await t.test("3. Approves clean custom React component and extracts SBOM and exported components", () => {
    const cleanSource = `
      import React, { useState } from "react";
      import { lucideReact } from "lucide-react";

      export const CleanCard = ({ title, count }) => {
        return <div className="card"><h3>{title}</h3><p>{count}</p></div>;
      };
    `;

    const res = customSourceImportService.inspectUploadedSource({
      importId: "imp-clean-01",
      tenantId: "tenant-acme",
      projectId: "proj-01",
      uploaderId: "user-dev",
      fileName: "CleanCard.tsx",
      sourceContent: cleanSource
    });

    assert.equal(res.isApproved, true);
    assert.equal(res.status, "INSPECTED_CLEAN");
    assert.deepEqual(res.exportedComponents, ["CleanCard"]);
    assert.ok(res.sbom.some(s => s.packageSpecifier === "lucide-react" && !s.isDangerous));
  });

  await t.test("4. Hardened SSRF defense blocks loopback, private subnets, cloud metadata, and dword IPs", () => {
    // Loopback 127.0.0.1
    const check1 = previewSecurityService.isEgressAllowed("http://127.0.0.1:8080");
    assert.equal(check1.allowed, false);

    // Cloud metadata 169.254.169.254
    const check2 = previewSecurityService.isEgressAllowed("http://169.254.169.254/latest/meta-data");
    assert.equal(check2.allowed, false);

    // Private RFC1918 10.0.0.1
    const check3 = previewSecurityService.isEgressAllowed("http://10.200.1.5:3000");
    assert.equal(check3.allowed, false);

    // Alternative DWORD numeric IP (2130706433 = 127.0.0.1)
    const check4 = previewSecurityService.isEgressAllowed("http://2130706433");
    assert.equal(check4.allowed, false);

    // IPv6 loopback [::1]
    const check5 = previewSecurityService.isEgressAllowed("http://[::1]:5000");
    assert.equal(check5.allowed, false);

    // Allowed public domain
    const check6 = previewSecurityService.isEgressAllowed("https://cdn.jsdelivr.net/npm/package");
    assert.equal(check6.allowed, true);
  });

  await t.test("5. Preview postMessage validation rejects origin mismatch and disallowed message types", () => {
    // Valid message
    const valid = previewSecurityService.validatePostMessage({
      type: "MOUNT_CONFIRM",
      origin: "https://preview.forgestudio.test",
      payload: { componentId: "CleanCard" },
      timestamp: new Date().toISOString()
    }, "https://preview.forgestudio.test");
    assert.equal(valid.isValid, true);

    // Origin mismatch
    const originMismatch = previewSecurityService.validatePostMessage({
      type: "MOUNT_CONFIRM",
      origin: "https://attacker.evil.com",
      payload: {},
      timestamp: new Date().toISOString()
    }, "https://preview.forgestudio.test");
    assert.equal(originMismatch.isValid, false);
    assert.ok(originMismatch.error?.includes("Origin mismatch"));

    // Disallowed message type
    const disallowedType = previewSecurityService.validatePostMessage({
      type: "EXECUTE_ARBITRARY_SCRIPT" as any,
      origin: "https://preview.forgestudio.test",
      payload: {},
      timestamp: new Date().toISOString()
    }, "https://preview.forgestudio.test");
    assert.equal(disallowedType.isValid, false);
    assert.ok(disallowedType.error?.includes("Disallowed postMessage type"));
  });
});
