import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { AiProvider, AiGenerationRequest, AiGenerationResult } from "../modules/ai/ai-provider.js";
import { generateValidatedSiteBlueprint } from "../modules/ai/generate-site-blueprint.js";
import { AppError } from "../utils/app-error.js";

const valid = JSON.stringify({ pages: [{ name: "Home", slug: "/", sections: [
  { heading: "A thoughtful introduction", body: "Useful and credible copy", ctaLabel: "", ctaHref: "" },
] }] });

function provider(generate: (request: AiGenerationRequest) => Promise<AiGenerationResult>): AiProvider {
  return { name: "test", model: "test-model", generate };
}

test("invalid first output gets one bounded repair with no provider text in the prompt", async () => {
  const requests: AiGenerationRequest[] = [];
  const fake = provider(async request => {
    requests.push(request);
    return { text: requests.length === 1 ? "SECRET_INVALID_PROVIDER_BODY" : valid,
      model: "test-model", provider: "test" };
  });
  const result = await generateValidatedSiteBlueprint(fake, "Build a useful training website", "Training Centre");
  assert.equal(result.draft.pageNames.length, 1);
  assert.equal(requests.length, 2);
  assert.equal(requests[1]?.prompt.includes("FORMAT REPAIR"), true);
  assert.equal(requests[1]?.prompt.includes("SECRET_INVALID_PROVIDER_BODY"), false);
});

test("persistent invalid output stops after two attempts", async () => {
  let calls = 0;
  await assert.rejects(generateValidatedSiteBlueprint(provider(async () => {
    calls++;
    return { text: "not-json", model: "test-model", provider: "test" };
  }), "Build a useful training website", "Training Centre"), error => {
    assert.equal((error as AppError).code, "AI_INVALID_OUTPUT");
    return true;
  });
  assert.equal(calls, 2);
});

test("provider outage is not retried or recast as invalid output", async () => {
  let calls = 0;
  await assert.rejects(generateValidatedSiteBlueprint(provider(async () => {
    calls++;
    throw new AppError("AI provider is unavailable", 503, "AI_PROVIDER_UNAVAILABLE");
  }), "Build a useful training website", "Training Centre"), error => {
    assert.equal((error as AppError).code, "AI_PROVIDER_UNAVAILABLE");
    return true;
  });
  assert.equal(calls, 1);
});
