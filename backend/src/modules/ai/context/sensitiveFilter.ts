/**
 * ForgeStudio Module 37: Sensitive Data Filtering
 * Detects and redacts credentials, secrets, private keys, and tokens from AI context.
 */

export interface RedactionResult {
  text: string;
  redactedCount: number;
  patternsDetected: string[];
}

const SENSITIVE_PATTERNS: Array<{ name: string; regex: RegExp; replacement: string }> = [
  {
    name: "OpenAI API Key",
    regex: /sk-[A-Za-z0-9-_]{20,}/g,
    replacement: "[REDACTED_OPENAI_KEY]",
  },
  {
    name: "Anthropic API Key",
    regex: /sk-ant-[A-Za-z0-9-_]{20,}/g,
    replacement: "[REDACTED_ANTHROPIC_KEY]",
  },
  {
    name: "GitHub Token",
    regex: /(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}/g,
    replacement: "[REDACTED_GITHUB_TOKEN]",
  },
  {
    name: "AWS Access Key",
    regex: /AKIA[0-9A-Z]{16}/g,
    replacement: "[REDACTED_AWS_KEY]",
  },
  {
    name: "Google API Key",
    regex: /AIza[0-9A-Za-z-_]{35}/g,
    replacement: "[REDACTED_GOOGLE_KEY]",
  },
  {
    name: "JWT Token",
    regex: /eyJ[A-Za-z0-9-_]{15,}\.eyJ[A-Za-z0-9-_]{15,}\.[A-Za-z0-9-_]+/g,
    replacement: "[REDACTED_JWT_TOKEN]",
  },
  {
    name: "Private Key Header",
    regex: /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----[\s\S]*?-----END (RSA |EC |OPENSSH |)PRIVATE KEY-----/g,
    replacement: "[REDACTED_PRIVATE_KEY_BLOCK]",
  },
  {
    name: "Database Connection String",
    regex: /(postgres|postgresql|mysql|mongodb|redis):\/\/[A-Za-z0-9_]+:[^@\s]+@[^\s"']+/g,
    replacement: "$1://[REDACTED_USER]:[REDACTED_PWD]@[REDACTED_HOST]",
  },
  {
    name: "Generic Secret Assignment",
    regex: /(api[_-]?key|secret|password|access[_-]?token|private[_-]?key|db[_-]?pass)\s*[:=]\s*["']?([A-Za-z0-9!@#$%^&*()_+~`|}{[\]:;?><,.-]{8,})["']?/gi,
    replacement: "$1 = \"[REDACTED_SECRET]\"",
  },
];

export function sanitizeSensitiveText(input: string): RedactionResult {
  if (!input) return { text: "", redactedCount: 0, patternsDetected: [] };

  let current = input;
  let count = 0;
  const detected = new Set<string>();

  for (const pattern of SENSITIVE_PATTERNS) {
    const matches = current.match(pattern.regex);
    if (matches && matches.length > 0) {
      count += matches.length;
      detected.add(pattern.name);
      current = current.replace(pattern.regex, pattern.replacement);
    }
  }

  return {
    text: current,
    redactedCount: count,
    patternsDetected: Array.from(detected),
  };
}
