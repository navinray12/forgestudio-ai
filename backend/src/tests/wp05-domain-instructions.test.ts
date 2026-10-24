import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createDomainRecord, getDnsInstructions } from "../services/domains/customDomain.service.js";

/**
 * WP05: The domain setup instructions and DNS verification must name the
 * same challenge record. Previously API instructions used "_forgestudio-verify"
 * while verifier queried "_forgestudio-challenge", blocking real onboarding.
 */
describe("WP05 domain ownership instruction contract", () => {
  it("keeps the API TXT instructions aligned with the actual DNS resolver", () => {
    const domain = createDomainRecord("customer.org", "site-id", "TXT");
    const record = getDnsInstructions(domain.domain, domain.verificationToken)
      .find((item) => item.type === "TXT");
    expect(record).toMatchObject({
      name: "_forgestudio-challenge",
      value: domain.verificationToken,
    });

    const controller = readFileSync(
      resolve(process.cwd(), "src/controllers/customDomain.controller.ts"), "utf8"
    );
    const verifier = readFileSync(
      resolve(process.cwd(), "src/services/domains/customDomain.service.ts"), "utf8"
    );

    expect(controller).toContain('host: `_forgestudio-challenge.${record.domain}`');
    expect(controller).not.toContain('host: `_forgestudio-verify.${record.domain}`');
    expect(verifier).toContain('const challengeHost = `_forgestudio-challenge.${record.domain}`');
    expect(verifier).toContain('dns.resolveTxt(`_forgestudio-challenge.${domain}`)');
  });
});
