import { strict as assert } from "node:assert";
import { test } from "node:test";
import { MAX_SITE_BRIEF_LENGTH, validateSiteBrief } from "../modules/ai/site-brief.js";

test("AI website brief accepts a detailed bounded request", () => {
  assert.doesNotThrow(() => validateSiteBrief("Create a website " + "x".repeat(29_906 - 17)));
  assert.doesNotThrow(() => validateSiteBrief("Create a website " + "x".repeat(MAX_SITE_BRIEF_LENGTH - 17)));
});

test("AI website brief rejects short and oversized requests before provider use", () => {
  for (const prompt of ["too short", "x".repeat(MAX_SITE_BRIEF_LENGTH + 1), null]) {
    assert.throws(() => validateSiteBrief(prompt), error => {
      assert.equal((error as { code: string }).code, "AI_PROMPT_INVALID");
      return true;
    });
  }
});
