import test from "node:test";
import assert from "node:assert/strict";
import { detectIntent } from "../modules/ai/assistant/assistant-orchestrator.service.js";

test("explicit copywriting is not interpreted as section insertion", () => {
  const prompts = [
    "Write a hero headline for our CRM",
    "Draft copy for the pricing section",
    "Generate text for our features section",
    "Please suggest a footer tagline",
    "Write a headline for the testimonials section",
  ];
  for (const prompt of prompts) {
    assert.equal(detectIntent(prompt), "GENERATE_TEXT", prompt);
  }
});

test("existing structural and website commands keep their original routes", () => {
  assert.equal(detectIntent("Create a hero section"), "GENERATE_SECTION");
  assert.equal(detectIntent("Add a pricing section"), "GENERATE_SECTION");
  assert.equal(detectIntent("Create website for a bakery"), "GENERATE_WEBSITE");
  assert.equal(detectIntent("Make a grid layout"), "GENERATE_CONTAINER");
  assert.equal(detectIntent("Rewrite our hero headline", { selectedContent: "Old headline" }), "REFINE_CONTENT");
  assert.equal(detectIntent("Generate SEO meta description"), "GENERATE_SEO");
});
