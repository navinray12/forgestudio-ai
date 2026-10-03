import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { decryptPrompt, encryptPrompt } from "../prompt-vault.js";
import { AppError } from "../../../utils/app-error.js";
import type { ArtifactStore } from "./contracts.js";

/** Private T0 artifact port. No static file mount; only authorized services read.
 * Files are authenticated ciphertext and use opaque, server-generated names. */
export class LocalDesignArtifacts implements ArtifactStore {
  constructor(private readonly directory = resolve(process.env.AI_ARTIFACT_DIRECTORY || ".data/ai-artifacts")) {}
  async put(value: string): Promise<string> {
    if (Buffer.byteLength(value) > 2 * 1024 * 1024) throw new AppError("Design artifact exceeds the supported size", 413, "AI_ARTIFACT_TOO_LARGE");
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const key = randomUUID();
    await writeFile(join(this.directory, key), encryptPrompt(value), { flag: "wx", mode: 0o600 });
    return key;
  }
  async get(key: string): Promise<string> {
    if (!/^[a-f0-9-]{36}$/.test(key)) throw new AppError("Artifact unavailable", 404, "AI_ARTIFACT_UNAVAILABLE");
    try { return decryptPrompt(await readFile(join(this.directory, key), "utf8")); }
    catch { throw new AppError("Artifact unavailable", 409, "AI_ARTIFACT_UNAVAILABLE"); }
  }
}
