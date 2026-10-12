import { AppError } from "../../utils/app-error.js";

export interface MeasurementEventContract {
  eventName: string;
  version: string;
  purpose: string;
  routeId: string;
  sectionId?: string;
  properties: Record<string, any>;
  timestamp: string;
}

const PROHIBITED_KEYS_PATTERN = new RegExp(
  "email|phone|password|secret|token|apiKey|ssn|card|credit|rawQuery|chatTranscript|formContent|latitude|longitude|coords",
  "i"
);

const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const PHONE_PATTERN = /\+?[0-9]{7,15}/;

/**
 * Validates and sanitizes measurement event payloads.
 * Strips PII, contact info, form contents, and raw secrets.
 */
export function validateMeasurementEventPayload(event: MeasurementEventContract): {
  isValid: boolean;
  sanitizedProperties: Record<string, any>;
  violations: string[];
} {
  const violations: string[] = [];
  const sanitized: Record<string, any> = {};

  if (!event.eventName || !event.version || !event.routeId) {
    violations.push("Missing required event metadata (eventName, version, or routeId)");
    return { isValid: false, sanitizedProperties: {}, violations };
  }

  function inspectAndScrub(obj: any, path = ""): any {
    if (!obj || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map((item, idx) => inspectAndScrub(item, `${path}[${idx}]`));

    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const fullPath = path ? `${path}.${key}` : key;

      // 1. Check prohibited key names
      if (PROHIBITED_KEYS_PATTERN.test(key)) {
        violations.push(`Prohibited key detected and scrubbed: ${fullPath}`);
        continue;
      }

      // 2. Check value contents for email or phone patterns
      if (typeof value === "string") {
        if (EMAIL_PATTERN.test(value)) {
          violations.push(`Email address pattern detected in analytics property '${fullPath}'`);
          continue;
        }
        if (PHONE_PATTERN.test(value) && value.replace(/[^0-9]/g, "").length >= 10) {
          violations.push(`Phone number pattern detected in analytics property '${fullPath}'`);
          continue;
        }
        result[key] = value.trim();
      } else if (typeof value === "object" && value !== null) {
        result[key] = inspectAndScrub(value, fullPath);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  const cleaned = inspectAndScrub(event.properties || {});
  return {
    isValid: violations.length === 0,
    sanitizedProperties: cleaned,
    violations,
  };
}

/**
 * Network payload inspector: verifies that outgoing HTTP payloads sent to analytics
 * endpoints do not contain forbidden SDK automatic context enrichment.
 */
export function inspectSerializedNetworkPayload(serializedJson: string): { safe: boolean; detectedLeakedPatterns: string[] } {
  const detectedLeakedPatterns: string[] = [];

  if (EMAIL_PATTERN.test(serializedJson)) {
    detectedLeakedPatterns.push("LEAKED_EMAIL_PATTERN");
  }
  if (/password|secret|bearer\s+[a-zA-Z0-9._-]+/i.test(serializedJson)) {
    detectedLeakedPatterns.push("LEAKED_CREDENTIAL_PATTERN");
  }

  return {
    safe: detectedLeakedPatterns.length === 0,
    detectedLeakedPatterns,
  };
}
