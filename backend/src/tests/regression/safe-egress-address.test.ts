/**
 * Regression guard: address validation in platform/integrations/safe-egress.ts.
 *
 * Covers destinations that embed a blocked IPv4 address inside IPv6 (IPv4-mapped ::ffff:0:0/96 in
 * dotted and hex form, NAT64 64:ff9b::/96) and the 198.18.0.0/15 benchmarking range, plus controls
 * showing that public IPv4/IPv6 destinations and the existing blocks are unchanged.
 *
 * Offline: node:dns/promises is mocked, so no resolver or network call is made. Only
 * resolveSafeDestination and resolveSafeHost are exercised; nothing opens a connection.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolveSafeDestination, resolveSafeHost } from "../../platform/integrations/safe-egress.js";

const h = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("node:dns/promises", () => ({ default: { lookup: h.lookup }, lookup: h.lookup }));

const HELPER_FILE = fileURLToPath(new URL("../../platform/integrations/safe-egress.ts", import.meta.url));

/** Embedded-IPv4 destinations that must be blocked. */
const EMBEDDED_BLOCKED = [
  ["IPv4-mapped metadata, dotted", "::ffff:169.254.169.254"],
  ["IPv4-mapped metadata, hex", "::ffff:a9fe:a9fe"],
  ["IPv4-mapped 172.16/12, dotted", "::ffff:172.16.0.1"],
  ["IPv4-mapped 172.16/12, hex", "::ffff:ac10:1"],
  ["IPv4-mapped 100.64/10 (CGNAT), hex", "::ffff:6440:1"],
  ["IPv4-mapped 0.0.0.0, hex", "::ffff:0:0"],
  ["IPv4-mapped loopback, hex", "::ffff:7f00:1"],
  ["IPv4-mapped 10/8, hex", "::ffff:a00:1"],
  ["IPv4-mapped 192.168/16, hex", "::ffff:c0a8:101"],
  ["IPv4-mapped, fully expanded", "0:0:0:0:0:ffff:a9fe:a9fe"],
  ["IPv4-mapped, uppercase hex", "::FFFF:A9FE:A9FE"],
  ["NAT64 metadata, hex", "64:ff9b::a9fe:a9fe"],
  ["NAT64 metadata, dotted", "64:ff9b::169.254.169.254"],
  ["NAT64 loopback", "64:ff9b::7f00:1"],
  ["NAT64 10/8", "64:ff9b::a00:1"],
] as const;

const BENCHMARK_BLOCKED = ["198.18.0.0", "198.18.0.1", "198.18.255.255", "198.19.0.1", "198.19.255.255"];

/** Existing blocks that must stay blocked. */
const EXISTING_BLOCKED = ["127.0.0.1", "10.0.0.1", "169.254.169.254", "172.16.0.1", "192.168.1.1", "100.64.0.1",
  "0.0.0.0", "224.0.0.1", "::1", "::", "fc00::1", "fd12::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1",
  "::ffff:192.168.0.1"];

/** Public destinations that must stay allowed. */
const PUBLIC_ALLOWED = ["8.8.8.8", "1.1.1.1", "198.17.255.255", "198.20.0.0", "2606:4700:4700::1111", "2001:4860:4860::8888",
  "::ffff:8.8.8.8", "::ffff:808:808", "64:ff9b::808:808"];

const family = (ip: string) => (ip.includes(":") ? 6 : 4);

beforeEach(() => {
  h.lookup.mockReset();
  h.lookup.mockRejectedValue(new Error("unexpected DNS lookup in test"));
});

/** A hostname that the mocked resolver answers with the given addresses. */
function resolvesTo(...addresses: string[]) {
  h.lookup.mockResolvedValue(addresses.map((address) => ({ address, family: family(address) })));
}

const BLOCKED = { code: "EGRESS_DESTINATION_BLOCKED" };

describe("safe-egress isolation", () => {
  it("the helper imports only node built-ins and app-error", () => {
    const imports = [...readFileSync(HELPER_FILE, "utf8").matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
    expect(imports.filter((s) => !s.startsWith("node:") && s !== "../../utils/app-error.js")).toEqual([]);
  });
});

describe("embedded IPv4 inside IPv6 is checked against the IPv4 rules", () => {
  it.each(EMBEDDED_BLOCKED)("resolveSafeHost blocks %s (%s)", async (_label, ip) => {
    await expect(resolveSafeHost(ip, 443)).rejects.toMatchObject(BLOCKED);
  });

  it.each(EMBEDDED_BLOCKED)("resolveSafeDestination blocks a hostname resolving to %s (%s)", async (_label, ip) => {
    resolvesTo(ip);
    await expect(resolveSafeDestination("https://mcp.example.com/rpc")).rejects.toMatchObject(BLOCKED);
  });

  it.each(EMBEDDED_BLOCKED)("resolveSafeDestination blocks a URL literal of %s (%s)", async (_label, ip) => {
    // A bracketed URL host is passed to the resolver; the mock returns the address as getaddrinfo would.
    resolvesTo(ip);
    await expect(resolveSafeDestination(`https://[${ip}]/`)).rejects.toMatchObject(BLOCKED);
  });

  it("blocks when any one of several DNS answers is an embedded private address", async () => {
    resolvesTo("93.184.216.34", "::ffff:169.254.169.254");
    await expect(resolveSafeDestination("https://mcp.example.com/rpc")).rejects.toMatchObject(BLOCKED);
  });
});

describe("198.18.0.0/15 (benchmarking) is blocked", () => {
  it.each(BENCHMARK_BLOCKED)("resolveSafeHost blocks %s", async (ip) => {
    await expect(resolveSafeHost(ip, 443)).rejects.toMatchObject(BLOCKED);
  });

  it.each(BENCHMARK_BLOCKED)("resolveSafeDestination blocks a URL literal %s", async (ip) => {
    await expect(resolveSafeDestination(`https://${ip}/`)).rejects.toMatchObject(BLOCKED);
  });

  it.each(BENCHMARK_BLOCKED)("resolveSafeDestination blocks a hostname resolving to %s", async (ip) => {
    resolvesTo(ip);
    await expect(resolveSafeDestination("https://mcp.example.com/rpc")).rejects.toMatchObject(BLOCKED);
  });
});

describe("behaviour that must not change", () => {
  it.each(EXISTING_BLOCKED)("still blocks %s", async (ip) => {
    await expect(resolveSafeHost(ip, 443)).rejects.toMatchObject(BLOCKED);
    resolvesTo(ip);
    await expect(resolveSafeDestination("https://mcp.example.com/rpc")).rejects.toMatchObject(BLOCKED);
  });

  it.each(PUBLIC_ALLOWED)("still allows public %s and pins the checked address", async (ip) => {
    await expect(resolveSafeHost(ip, 443)).resolves.toMatchObject({ address: ip });
    resolvesTo(ip);
    await expect(resolveSafeDestination("https://mcp.example.com/rpc")).resolves.toMatchObject({ address: ip });
  });

  it("public IPv4 URL literal is allowed without a DNS lookup", async () => {
    await expect(resolveSafeDestination("https://8.8.8.8/")).resolves.toMatchObject({ address: "8.8.8.8", family: 4 });
    expect(h.lookup).not.toHaveBeenCalled();
  });

  it("existing scheme, port, credential and hostname rules are unchanged", async () => {
    await expect(resolveSafeDestination("http://mcp.example.com/")).rejects.toMatchObject({ code: "EGRESS_SCHEME_BLOCKED" });
    await expect(resolveSafeDestination("https://mcp.example.com:8443/")).rejects.toMatchObject({ code: "EGRESS_PORT_BLOCKED" });
    await expect(resolveSafeDestination("https://u:p@mcp.example.com/")).rejects.toMatchObject({ code: "EGRESS_URL_INVALID" });
    await expect(resolveSafeDestination("https://localhost/")).rejects.toMatchObject(BLOCKED);
    await expect(resolveSafeDestination("https://metadata.internal/")).rejects.toMatchObject(BLOCKED);
    expect(h.lookup).not.toHaveBeenCalled();
  });
});
