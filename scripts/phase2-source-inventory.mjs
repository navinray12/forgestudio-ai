import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

// WP-00 reproducible, immutable-by-commit inventory. This records actual source
// file presence and checksums, not invented "feature complete" statuses.
const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "buffer" })
  .toString("utf8").split("\0").filter(Boolean).sort();
const groups = {
  backendRoutes: /^backend\/src\/.*\/(routes|.*\.routes)\/?.*\.(ts|tsx)$/,
  backendControllers: /^backend\/src\/controllers\/.*\.ts$/,
  backendServices: /^backend\/src\/(services|modules)\/.*\.(ts|tsx)$/,
  frontendEditor: /^frontend\/src\/pages\/editor\/.*\.(ts|tsx)$/,
  frontendCMS: /^frontend\/src\/.*(cms|content|template|form|media).*\.(ts|tsx)$/i,
  prismaMigrations: /^backend\/prisma\/migrations\/.*\/migration\.sql$/,
  backendTests: /^backend\/src\/tests\/.*\.(test|spec)\.(ts|tsx)$/,
  frontendTests: /^frontend\/tests\/.*\.(test|spec)\.(ts|tsx)$/,
  workflows: /^\.github\/workflows\/.*\.yml$/,
};
const report = {
  kind: "forgestudio-wp00-source-inventory",
  commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  counts: {},
  files: {},
};
for (const [name, pattern] of Object.entries(groups)) {
  const found = tracked.filter((p) => pattern.test(p)).map((path) => {
    const sha256 = createHash("sha256").update(readFileSync(path)).digest("hex");
    return { path, sha256 };
  });
  report.files[name] = found;
  report.counts[name] = found.length;
}
// Hard assertions: missing primary roots invalidate the claimed audit.
for (const group of ["backendRoutes", "backendControllers", "frontendEditor", "prismaMigrations", "backendTests", "frontendTests"]) {
  if (report.counts[group] === 0) throw new Error("Missing baseline source group: " + group);
}
const output = process.argv[2] || "phase2-audit-inventory.json";
writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
process.stdout.write(JSON.stringify({ commit: report.commit, counts: report.counts, output }, null, 2) + "\n");
