import test from "node:test";
import assert from "node:assert/strict";
import { PrivateStitchClient } from "../modules/ai/design/stitch-client.js";
import { StitchDesignProvider } from "../modules/ai/design/stitch-provider.js";
import { ClaudeDesignPlanner } from "../modules/ai/design/claude-planner.js";
import { AppError } from "../utils/app-error.js";

test("Phase 0 Stability: Error Classification & Provider Boundaries", async (t) => {
  await t.test("1. Stitch connection failure maps to AI_PROVIDER_UNAVAILABLE (not AI_EXTERNAL_OUTCOME_UNKNOWN)", async () => {
    const fetcher: typeof fetch = async () => {
      const err = new TypeError("fetch failed");
      Object.assign(err, { code: "ECONNREFUSED" });
      throw err;
    };
    const client = new PrivateStitchClient("test-key", fetcher);
    await assert.rejects(
      client.connect(),
      (err: any) => err instanceof AppError && err.code === "AI_PROVIDER_UNAVAILABLE"
    );
    await client.close();
  });

  await t.test("2. Stitch DNS/network failure maps to AI_PROVIDER_UNAVAILABLE", async () => {
    const fetcher: typeof fetch = async () => {
      const err = new TypeError("fetch failed");
      Object.assign(err, { code: "ENOTFOUND" });
      throw err;
    };
    const client = new PrivateStitchClient("test-key", fetcher);
    await assert.rejects(
      client.callTool("create_project", { title: "Test" }),
      (err: any) => err instanceof AppError && err.code === "AI_PROVIDER_UNAVAILABLE"
    );
    await client.close();
  });

  await t.test("3. Stitch authentication failure (HTTP 401/403) maps to AI_AUTH_ERROR", async () => {
    const fetcher: typeof fetch = async () => {
      return new Response(JSON.stringify({ error: "Invalid API key" }), { status: 401 });
    };
    const client = new PrivateStitchClient("bad-key", fetcher);
    await assert.rejects(
      client.connect(),
      (err: any) => err instanceof AppError && err.code === "AI_AUTH_ERROR"
    );
    await client.close();
  });

  await t.test("4. Stitch HTTP 429 maps to AI_RATE_LIMIT", async () => {
    const fetcher: typeof fetch = async () => {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429 });
    };
    const client = new PrivateStitchClient("test-key", fetcher);
    await assert.rejects(
      client.connect(),
      (err: any) => err instanceof AppError && err.code === "AI_RATE_LIMIT"
    );
    await client.close();
  });

  await t.test("5. Stitch HTTP 500/503 maps to AI_PROVIDER_UNAVAILABLE", async () => {
    const fetcher: typeof fetch = async () => {
      return new Response("Internal Server Error", { status: 503 });
    };
    const client = new PrivateStitchClient("test-key", fetcher);
    await assert.rejects(
      client.connect(),
      (err: any) => err instanceof AppError && err.code === "AI_PROVIDER_UNAVAILABLE"
    );
    await client.close();
  });

  await t.test("6. Stitch request timeout on connect maps to AI_PROVIDER_UNAVAILABLE", async () => {
    const fetcher: typeof fetch = async () => {
      const err = new DOMException("The operation was aborted due to timeout", "TimeoutError");
      throw err;
    };
    const client = new PrivateStitchClient("test-key", fetcher);
    await assert.rejects(
      client.connect(),
      (err: any) => err instanceof AppError && err.code === "AI_PROVIDER_UNAVAILABLE"
    );
    await client.close();
  });

  await t.test("7. StitchDesignProvider preserves classified AppErrors instead of masking them", async () => {
    const originalKey = process.env.STITCH_API_KEY;
    process.env.STITCH_API_KEY = "test-api-key";
    t.after(() => {
      if (originalKey === undefined) delete process.env.STITCH_API_KEY;
      else process.env.STITCH_API_KEY = originalKey;
    });

    const provider = new StitchDesignProvider("GEMINI_3_PRO");
    // Mock private client to throw AI_PROVIDER_UNAVAILABLE
    (provider as any).client = {
      connect: async () => {},
      callTool: async () => {
        throw new AppError("Stitch connection could not complete", 503, "AI_PROVIDER_UNAVAILABLE");
      },
      close: async () => {},
    };
    (provider as any).sdk = {
      createProject: async () => {
        return (provider as any).client.callTool("create_project", {});
      },
      project: () => ({
        generate: async () => {
          return (provider as any).client.callTool("generate", {});
        },
      }),
    };

    // createProject must NOT swallow AI_PROVIDER_UNAVAILABLE into AI_EXTERNAL_OUTCOME_UNKNOWN
    await assert.rejects(
      provider.createProject("My Project"),
      (err: any) => err instanceof AppError && err.code === "AI_PROVIDER_UNAVAILABLE"
    );

    // generate must NOT swallow AI_PROVIDER_UNAVAILABLE into AI_EXTERNAL_OUTCOME_UNKNOWN
    await assert.rejects(
      provider.generate("proj-1", "generate page"),
      (err: any) => err instanceof AppError && err.code === "AI_PROVIDER_UNAVAILABLE"
    );

    await provider.close();
  });

  await t.test("8. Claude planner classifies 429 as AI_RATE_LIMIT and respects cancellation", async () => {
    const original = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    t.after(() => {
      if (original === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = original;
    });

    // 429 Rate Limit
    const rateLimitFetcher: typeof fetch = async () => new Response("Rate limited", { status: 429 });
    const planner = new ClaudeDesignPlanner("claude-test", rateLimitFetcher);
    await assert.rejects(
      planner.plan("A detailed test brief"),
      (err: any) => err instanceof AppError && err.code === "AI_RATE_LIMIT"
    );

    // Cancellation
    const abortController = new AbortController();
    abortController.abort();
    const abortFetcher: typeof fetch = async () => {
      throw new DOMException("Aborted", "AbortError");
    };
    const abortPlanner = new ClaudeDesignPlanner("claude-test", abortFetcher);
    await assert.rejects(
      abortPlanner.plan("A detailed test brief", abortController.signal),
      (err: any) => err instanceof AppError && err.code === "AI_CANCELLED"
    );
  });
});
