import { parentPort, workerData } from "node:worker_threads";
import { ConversionError, HtmlDesignConverter } from "./converter.js";
try { parentPort?.postMessage({ elements: await new HtmlDesignConverter().convert(workerData.html, workerData.namespace) }); }
catch (error) { parentPort?.postMessage({ issues: error instanceof ConversionError ? error.issues : ["CONVERSION_FAILED"] }); }
