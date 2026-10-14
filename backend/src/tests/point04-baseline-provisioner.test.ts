/**
 * ForgeStudio Execution Blueprint v2.1 — Point 04: What Every Generated Website Must Contain
 * Test Suite 2: Normal-Site Baseline Provisioner & Unused Collection Omission
 */

import assert from "node:assert/strict";
import test from "node:test";
import { provisionNormalSiteBaseline } from "../services/websites/baselineProvisioner.js";
import { validateDocumentTree } from "../services/websites/document-policy.js";
import { validateWebsiteOperatingContract } from "../services/websites/websiteContract.js";

test("Point 04 — Normal-Site Baseline Provisioner Suite", async (t) => {
  await t.test("1. Baseline Provisioning: Generates core pages from brief without fake filler", () => {
    const baseline = provisionNormalSiteBaseline({
      websiteId: "site-baseline-1",
      websiteName: "Apex Strategic Advisory",
      ownerId: "owner-user-1",
      industryOrType: "Management Consulting",
      briefSummary: "Bespoke executive advisory for technology firms.",
      requireBlog: false, // Unused collection!
      contactEmail: "inquiries@apexadvisory.com",
      verifiedOrganizationFacts: {
        legalName: "Apex Strategic Advisory LLC",
        operatingYears: 7,
        headquarters: "London, UK",
        verifiedTeamMembers: [
          { name: "Eleanor Vance", role: "Managing Director" },
          { name: "Marcus Thorne", role: "Principal Consultant" },
        ],
      },
    });

    const pages = baseline.editorData.pages as any[];
    assert.ok(pages.length >= 5, "Must generate at least Home, Offering, About, Contact, 404, Privacy, Terms");

    const routes = pages.map((p) => p.slug);
    assert.ok(routes.includes("/"), "Must have Home page ('/')");
    assert.ok(routes.includes("/offerings"), "Must have Offerings page ('/offerings')");
    assert.ok(routes.includes("/about"), "Must have About page ('/about')");
    assert.ok(routes.includes("/contact"), "Must have Contact page ('/contact')");
    assert.ok(routes.includes("/404"), "Must have Utility 404 page ('/404')");
    assert.ok(routes.includes("/privacy"), "Must have Privacy page ('/privacy')");
    assert.ok(routes.includes("/terms"), "Must have Terms page ('/terms')");

    // Verify Blog collection is strictly omitted
    assert.equal(routes.includes("/blog"), false, "Blog collection must be completely omitted when not required");

    // Verify Document Tree validity
    const docTreeValidation = validateDocumentTree(baseline.editorData);
    assert.equal(docTreeValidation.valid, true, "Generated baseline editorData must pass validateDocumentTree");

    // Verify Operating Contract validity
    const contractValidation = validateWebsiteOperatingContract(baseline.contract);
    assert.equal(contractValidation.valid, true, "Generated contract must pass validateWebsiteOperatingContract with 0 errors");
    assert.equal(contractValidation.errors.length, 0);
  });

  await t.test("2. Unused Collection Omission: Blog routes, nav items, and templates omitted when requireBlog: false", () => {
    const noBlogBaseline = provisionNormalSiteBaseline({
      websiteId: "site-no-blog",
      websiteName: "Solo Practice",
      ownerId: "owner-1",
      requireBlog: false,
    });

    const nav = noBlogBaseline.editorData.navigation as any[];
    const navHrefs = nav.map((n) => n.href);
    assert.ok(!navHrefs.includes("/blog"), "Navigation must not contain dead /blog link");

    const blogPage = (noBlogBaseline.editorData.pages as any[]).find((p) => p.slug === "/blog");
    assert.equal(blogPage, undefined, "No /blog page should be created");
  });

  await t.test("3. Conditional Activation: Blog is cleanly provisioned when requireBlog: true", () => {
    const blogBaseline = provisionNormalSiteBaseline({
      websiteId: "site-with-blog",
      websiteName: "Insight Publications",
      ownerId: "owner-2",
      requireBlog: true,
    });

    const pages = blogBaseline.editorData.pages as any[];
    const routes = pages.map((p) => p.slug);
    assert.ok(routes.includes("/blog"), "Must provision /blog index when requireBlog is true");
    assert.ok(routes.includes("/blog/getting-started"), "Must provision sample resource article");

    const nav = blogBaseline.editorData.navigation as any[];
    assert.ok(nav.some((n) => n.href === "/blog"), "Navigation must include /blog when activated");
  });

  await t.test("4. Truthful Content Invariant: No fabricated testimonials or bogus metrics", () => {
    const baseline = provisionNormalSiteBaseline({
      websiteId: "site-truthful",
      websiteName: "Truthful Accounting",
      ownerId: "owner-3",
      requireBlog: false,
    });

    // Inspect all text in pages for fake testimonials and metrics
    const serialized = JSON.stringify(baseline.editorData);
    assert.ok(!serialized.includes("10,000+ satisfied clients"), "Must not invent 10,000+ customer counts");
    assert.ok(!serialized.includes("Voted #1 Best in Class"), "Must not invent bogus awards");
    assert.ok(!serialized.includes("5 stars from 2,000 reviews"), "Must not invent fake star ratings");

    // All claims in contract must be APPROVED_FACT or EVIDENCE_ATTACHED
    for (const page of baseline.contract.pages) {
      for (const claim of page.claims) {
        assert.ok(
          claim.status === "APPROVED_FACT" || claim.status === "EVIDENCE_ATTACHED",
          `Generated claim '${claim.statement}' must be approved or backed by evidence; got ${claim.status}`
        );
      }
    }
  });

  await t.test("5. Working Action Guarantee: Zero dead links or inert buttons in generated site", () => {
    const baseline = provisionNormalSiteBaseline({
      websiteId: "site-actions",
      websiteName: "Action Verification Ltd",
      ownerId: "owner-4",
    });

    assert.equal(
      baseline.contract.workingActionAudit.deadOrBrokenActionsCount,
      0,
      "Generated baseline website must have exactly 0 dead or broken actions"
    );
    assert.ok(
      baseline.contract.workingActionAudit.workingRoutesCount > 0,
      "Generated baseline website must have working route actions"
    );
  });
});
