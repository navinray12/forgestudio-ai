import { createRequire } from "module";
import fs from "fs";
import path from "path";

// The forgestudio-connector plugin ZIP (archiver, loaded at module load as before).
// Moved verbatim from connector.service.ts (now a compatibility entry point that re-exports the public API).

export const require = createRequire(import.meta.url);

export const archiver = require("archiver");

export function getArchiverInstance(options: any = { zlib: { level: 9 } }) {
  if (typeof archiver === "function") {
    return archiver("zip", options);
  }
  if (archiver?.ZipArchive) {
    return new archiver.ZipArchive(options);
  }
  if (archiver?.default && typeof archiver.default === "function") {
    return archiver.default("zip", options);
  }
  if (archiver?.create) {
    return archiver.create("zip", options);
  }
  throw new Error("Unable to instantiate archiver");
}

/**
 * Pack the forgestudio-connector WordPress plugin into a downloadable ZIP buffer
 */
export async function generateWordPressPluginZip(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = getArchiverInstance({ zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", (err: any) => reject(err));

    // Support both root-relative and backend-relative paths
    let pluginDir = path.resolve(process.cwd(), "..", "wordpress-plugin");
    if (!fs.existsSync(pluginDir)) {
      pluginDir = path.resolve(process.cwd(), "wordpress-plugin");
    }

    const mainPhpPath = path.join(pluginDir, "forgestudio-connector.php");
    const readmePath = path.join(pluginDir, "readme.txt");

    if (fs.existsSync(mainPhpPath)) {
      archive.file(mainPhpPath, { name: "forgestudio-connector/forgestudio-connector.php" });
    }
    if (fs.existsSync(readmePath)) {
      archive.file(readmePath, { name: "forgestudio-connector/readme.txt" });
    }

    archive.finalize();
  });
}
