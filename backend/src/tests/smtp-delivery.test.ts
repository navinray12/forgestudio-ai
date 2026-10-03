import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type Socket } from "node:net";
import { TLSSocket, createSecureContext } from "node:tls";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { SmtpOtpDelivery } from "../adapters/identity/smtp-otp-delivery.js";
const execute = promisify(execFile);

test("SMTP adapter verifies TLS, accepts only confirmed delivery and bounds connections", { timeout: 40000 }, async t => {
  const folder = await mkdtemp(path.join(tmpdir(), "forge-smtp-fixture-"));
  const keyPath = path.join(folder, "key.pem"); const certPath = path.join(folder, "cert.pem");
  await execute("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
    "-keyout", keyPath, "-out", certPath, "-subj", "/CN=localhost",
    "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1"]);
  const secureContext = createSecureContext({ key: await readFile(keyPath), cert: await readFile(certPath), minVersion: "TLSv1.2" });
  let mode: "good" | "no-starttls" | "slow" = "good";
  let authCount = 0; let messages: string[] = []; const sockets = new Set<Socket>();
  const server = createServer(raw => {
    sockets.add(raw); raw.once("close", () => sockets.delete(raw)); raw.on("error", () => undefined);
    let current: Socket = raw; let encrypted = false; let dataMode = false; let data = ""; let buffer = "";
    let heartbeat: NodeJS.Timeout | undefined;
    raw.once("close", () => clearInterval(heartbeat));
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      if (buffer.length > 32_768) return current.destroy();
      while (buffer.includes("\r\n")) {
        const end = buffer.indexOf("\r\n"); const line = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        if (dataMode) {
          if (line === ".") { messages.push(data); dataMode = false; current.write("250 2.0.0 accepted\r\n"); }
          else data += line + "\n";
        } else if (/^EHLO/i.test(line)) {
          if (mode === "slow") {
            current.write("250-fixture\r\n");
            heartbeat = setInterval(() => current.write("250-waiting\r\n"), 1000);
          } else current.write(`250-fixture\r\n${encrypted || mode === "no-starttls" ? "" : "250-STARTTLS\r\n"}250 AUTH PLAIN\r\n`);
        } else if (/^STARTTLS/i.test(line)) {
          if (mode === "no-starttls") { current.write("502 TLS unavailable\r\n"); continue; }
          raw.removeListener("data", onData); raw.write("220 Begin TLS\r\n");
          const secured = new TLSSocket(raw, { isServer: true, secureContext });
          current = secured; encrypted = true;
          secured.on("error", () => raw.destroy());
          secured.on("data", onData);
          return;
        } else if (/^AUTH PLAIN/i.test(line)) {
          if (!encrypted) return current.destroy();
          authCount++; current.write("235 2.7.0 authenticated\r\n");
        } else if (/^(MAIL FROM|RCPT TO)/i.test(line)) {
          current.write(encrypted ? "250 2.0.0 ok\r\n" : "530 TLS required\r\n");
        } else if (line === "DATA") { dataMode = true; data = ""; current.write("354 End with dot\r\n"); }
        else if (line === "QUIT") current.end("221 Goodbye\r\n");
        else current.write("500 Unknown command\r\n");
      }
    };
    raw.on("data", onData); raw.write("220 fixture SMTP\r\n");
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(2525, resolve); });
  t.after(async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await rm(folder, { recursive: true, force: true });
  });
  const client = async (trust: boolean) => {
    const environment: NodeJS.ProcessEnv = { ...process.env, SMTP_HOST: "localhost", SMTP_PORT: "2525",
      SMTP_USER: "fixture-only", SMTP_PASSWORD: "not-a-production-credential", SMTP_FROM: "no-reply@example.test" };
    if (trust) environment.NODE_EXTRA_CA_CERTS = certPath;
    else delete environment.NODE_EXTRA_CA_CERTS;
    return execute(process.execPath, ["--input-type=module", "-e", `
      import { SmtpOtpDelivery } from "./dist/adapters/identity/smtp-otp-delivery.js";
      try {
        await new SmtpOtpDelivery().sendCode({email:"recipient@example.test",code:"783291",purpose:"LOGIN"});
        console.log("DELIVERY_ACCEPTED");
      } catch(error) {
        console.log(JSON.stringify({code:error.code,status:error.statusCode,message:error.message}));
      }
    `], { env: environment, timeout: 12000 });
  };
  await t.test("missing configuration fails without simulated delivery", async () => {
    const original = process.env.SMTP_HOST; delete process.env.SMTP_HOST;
    try { await assert.rejects(new SmtpOtpDelivery().sendCode({ email: "recipient@example.test", code: "783291", purpose: "LOGIN" }),
      (error: unknown) => (error as { statusCode: number }).statusCode === 503); }
    finally { if (original !== undefined) process.env.SMTP_HOST = original; }
  });
  await t.test("real STARTTLS and SMTP acceptance reach a local test receiver", async () => {
    const { stdout } = await client(true);
    assert.match(stdout, /DELIVERY_ACCEPTED/); assert.equal(authCount, 1); assert.equal(messages.length, 1);
    assert.match(messages[0]!, /783291/);
  });
  await t.test("untrusted server certificate rejects before password authentication", async () => {
    const before = authCount; const { stdout } = await client(false);
    assert.match(stdout, /IDENTITY_DELIVERY_UNAVAILABLE/); assert.equal(authCount, before);
    assert.doesNotMatch(stdout, /not-a-production|fixture-only|783291/);
  });
  await t.test("server without STARTTLS cannot obtain credentials or produce success", async () => {
    mode = "no-starttls"; const before = authCount; const { stdout } = await client(true);
    assert.match(stdout, /IDENTITY_DELIVERY_UNAVAILABLE/); assert.equal(authCount, before);
  });
  await t.test("slow protocol chatter cannot extend the absolute connection deadline", async () => {
    mode = "slow"; const start = performance.now();
    const { stdout } = await client(true);
    assert.match(stdout, /IDENTITY_DELIVERY_UNAVAILABLE/);
    assert.ok(performance.now() - start < 10_500, "Absolute deadline exceeded");
    await new Promise(resolve => setTimeout(resolve, 200));
    assert.equal(sockets.size, 0, "Timed-out SMTP socket was not released");
  });
});
