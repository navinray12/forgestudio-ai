import { Worker } from "node:worker_threads";
import type { DesignConverter } from "./contracts.js";
import type { JsonObject } from "../../../services/websites/document-policy.js";
import { ConversionError, HtmlDesignConverter } from "./converter.js";

export class IsolatedDesignConverter implements DesignConverter {
  async convert(html: string, namespace: string): Promise<JsonObject[]> {
    try {
      return await new Promise<JsonObject[]>((resolve, reject) => {
        const worker = new Worker(new URL("./converter-worker.js", import.meta.url), {
          workerData: { html, namespace },
          resourceLimits: { maxOldGenerationSizeMb: 256, stackSizeMb: 8 },
        });
        const timer = setTimeout(() => {
          void worker.terminate();
          reject(new ConversionError(["CONVERSION_TIMEOUT"]));
        }, 25_000);

        worker.once("message", (message: { elements?: JsonObject[]; issues?: string[] }) => {
          clearTimeout(timer);
          void worker.terminate();
          if (message.elements) resolve(message.elements);
          else reject(new ConversionError(message.issues || ["CONVERSION_FAILED"]));
        });

        worker.once("error", (err) => {
          console.error("[IsolatedDesignConverter] worker error:", err);
          clearTimeout(timer);
          reject(err);
        });

        worker.once("exit", (code) => {
          clearTimeout(timer);
          if (code !== 0) {
            console.error(`[IsolatedDesignConverter] worker exited with code ${code}`);
            reject(new Error(`Worker exited with code ${code}`));
          }
        });
      });
    } catch (err) {
      if (err instanceof ConversionError) {
        throw err;
      }
      console.warn("[IsolatedDesignConverter] Worker execution failed, falling back to direct conversion:", err);
      return new HtmlDesignConverter().convert(html, namespace);
    }
  }
}
