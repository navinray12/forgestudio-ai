/**
 * ForgeStudio Execution Blueprint v2.1 — Point 18: Security, Privacy, Audit and Abuse Resistance
 * Section 4.6: Data-Purpose, Retention and Shared Redaction Policy
 *
 * Rules:
 * 1. Authoritative data policy metadata: category, lawful basis, retention class, deletion behavior.
 * 2. Retention classes: OPERATIONAL_30D, LEAD_90D, STATUTORY_7Y, PERMANENT.
 * 3. Shared redaction policy applied across application logs, exceptions, exports, model context, telemetry.
 * 4. PII, passwords, credit cards, auth tokens, and private API keys redacted uniformly.
 */

export type RetentionClass = "OPERATIONAL_30D" | "LEAD_90D" | "STATUTORY_7Y" | "PERMANENT";

export interface DataFieldPolicy {
  fieldName: string;
  category: "IDENTIFIER" | "FINANCIAL" | "CREDENTIAL" | "COMMUNICATION" | "SYSTEM_AUDIT";
  lawfulBasis: "CONSENT" | "CONTRACTUAL_NECESSITY" | "LEGITIMATE_INTEREST" | "LEGAL_OBLIGATION";
  retentionClass: RetentionClass;
  redactInLogs: boolean;
}

export class DataPolicyRetentionRedactionService {
  private static readonly REDACTION_PATTERNS: Array<{ regex: RegExp; replacement: string }> = [
    { regex: /("password"\s*:\s*)"[^"]+"/gi, replacement: '$1"[REDACTED_PASSWORD]"' },
    { regex: /("token"\s*:\s*)"[^"]+"/gi, replacement: '$1"[REDACTED_TOKEN]"' },
    { regex: /("secret"\s*:\s*)"[^"]+"/gi, replacement: '$1"[REDACTED_SECRET]"' },
    { regex: /("apiKey"\s*:\s*)"[^"]+"/gi, replacement: '$1"[REDACTED_API_KEY]"' },
    { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g, replacement: "[REDACTED_EMAIL]" },
    { regex: /\b\+?[1-9]\d{1,14}\b/g, replacement: "[REDACTED_PHONE]" },
    { regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/g, replacement: "[REDACTED_CREDIT_CARD]" },
  ];

  /**
   * Applies universal redaction rules to serialized text/logs before persistence or transmission.
   */
  public static redactSensitiveText(input: string): string {
    if (!input || typeof input !== "string") return input;
    let sanitized = input;
    for (const pattern of this.REDACTION_PATTERNS) {
      sanitized = sanitized.replace(pattern.regex, pattern.replacement);
    }
    return sanitized;
  }

  /**
   * Redacts objects deeply for error logs, traces, and model prompts.
   */
  public static redactObjectDeep<T>(obj: T): T {
    try {
      const json = JSON.stringify(obj);
      const redacted = this.redactSensitiveText(json);
      return JSON.parse(redacted);
    } catch {
      return obj;
    }
  }

  /**
   * Evaluates if a record has exceeded its compliance retention period.
   */
  public static isRecordEligibleForPurge(retentionClass: RetentionClass, createdAt: string): boolean {
    const createdTime = new Date(createdAt).getTime();
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    switch (retentionClass) {
      case "OPERATIONAL_30D":
        return now - createdTime > 30 * dayMs;
      case "LEAD_90D":
        return now - createdTime > 90 * dayMs;
      case "STATUTORY_7Y":
        return now - createdTime > 7 * 365 * dayMs;
      case "PERMANENT":
        return false;
      default:
        return false;
    }
  }
}
