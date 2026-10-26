import test from "node:test";
import assert from "node:assert/strict";
import { TaskRouter } from "../modules/ai/gateway/taskRouter.js";
import { ModelRegistry } from "../modules/ai/gateway/modelRegistry.js";
import type { AiGatewayRequest } from "../modules/ai/gateway/aiGateway.types.js";

const baseRequest: AiGatewayRequest = {
  task: "coding",
  messages: [{ role: "user", content: "Explain the bug" }],
  provider: "anthropic",
  model: "claude-3-5-sonnet-20241022",
};

test("keeps the selected model for the original provider", () => {
  const router = new TaskRouter();
  assert.equal(router.resolveModelForProvider(baseRequest, "anthropic"), baseRequest.model);
});

test("uses each fallback provider's own compatible model", () => {
  const router = new TaskRouter();
  for (const provider of ["openai", "gemini"] as const) {
    const modelId = router.resolveModelForProvider(baseRequest, provider);
    assert.equal(ModelRegistry.getModel(modelId)?.provider, provider);
    assert.notEqual(modelId, baseRequest.model);
  }
});

test("resolves model when no explicit model is supplied", () => {
  const router = new TaskRouter();
  const request = { ...baseRequest, model: undefined };
  assert.equal(ModelRegistry.getModel(router.resolveModelForProvider(request, "anthropic"))?.provider, "anthropic");
});
