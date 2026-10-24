import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import hostedRoutes from "../routes/hosted.routes.js";

describe("legacy hosted artifact access", () => {
  let server: Server;
  let origin: string;

  beforeAll(async () => {
    const app = express();
    app.use("/api/hosted", hostedRoutes);
    server = createServer(app);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected local TCP test listener");
    }
    origin = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (server?.listening) {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it.each([
    "/api/hosted/project-a/deployment-a",
    "/api/hosted/project-a/deployment-a/index.html",
    "/api/hosted/project-a/deployment-a/assets/app.js",
    "/api/hosted/project-b/deployment-a/index.html",
  ])("does not expose an unverified deployment: %s", async (path) => {
    const response = await fetch(origin + path);
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).not.toContain("HEALTHY");
  });

  it("does not expose artifacts over POST requests", async () => {
    const response = await fetch(origin + "/api/hosted/project-a/deployment-a", {
      method: "POST",
    });
    expect(response.status).toBe(404);
  });
});
