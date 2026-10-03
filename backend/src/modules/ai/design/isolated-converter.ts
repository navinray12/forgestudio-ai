import { Worker } from "node:worker_threads";
import type { DesignConverter } from "./contracts.js";
import type { JsonObject } from "../../../services/websites/document-policy.js";
import { ConversionError } from "./converter.js";

export class IsolatedDesignConverter implements DesignConverter {
  convert(html: string, namespace: string): Promise<JsonObject[]> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL("./converter-worker.js", import.meta.url), { workerData: { html, namespace }, resourceLimits: { maxOldGenerationSizeMb: 128, stackSizeMb: 4 } });
      const timer = setTimeout(() => { void worker.terminate(); reject(new ConversionError(["CONVERSION_TIMEOUT"])); }, 20_000);
      worker.once("message", (message: { elements?: JsonObject[]; issues?: string[] }) => {
        clearTimeout(timer); void worker.terminate();
        if (message.elements) resolve(message.elements); else reject(new ConversionError(message.issues || ["CONVERSION_FAILED"]));
      });
      worker.once("error", () => { clearTimeout(timer); reject(new ConversionError(["CONVERSION_FAILED"])); });
      worker.once("exit", code => { clearTimeout(timer); if (code !== 0) reject(new ConversionError(["CONVERSION_FAILED"])); });
    });
  }
}
