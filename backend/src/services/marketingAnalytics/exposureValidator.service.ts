export interface BrowserExposureContext {
  route: string;
  visibilityState: "visible" | "hidden" | "prerender";
  isBfcacheRestored?: boolean;
  isSpeculativeFetch?: boolean;
  userAgent: string;
  continuousVisibleDurationMs: number;
}

const BOT_PATTERNS = new RegExp(
  "bot|crawler|spider|preview|slackbot|facebookexternalhit|whatsapp|twitterbot|linkedinbot|discordbot",
  "i"
);

/**
 * Validates whether an incoming pageview or element impression constitutes a verified human exposure.
 */
export function validateExposure(context: BrowserExposureContext): {
  isVerifiedExposure: boolean;
  rejectionReason?: string;
} {
  // 1. Bot & Link Scanner check
  if (BOT_PATTERNS.test(context.userAgent)) {
    return { isVerifiedExposure: false, rejectionReason: "Automated crawler / preview bot detected" };
  }

  // 2. Speculative prefetch check
  if (context.isSpeculativeFetch) {
    return { isVerifiedExposure: false, rejectionReason: "Speculative prefetch is not a human exposure" };
  }

  // 3. Tab visibility check
  if (context.visibilityState === "hidden" || context.visibilityState === "prerender") {
    return {
      isVerifiedExposure: false,
      rejectionReason: `Page rendered in '${context.visibilityState}' context without user engagement`,
    };
  }

  // 4. Minimum continuous visible exposure duration check (e.g. 1000ms minimum)
  if (context.continuousVisibleDurationMs < 1000) {
    return {
      isVerifiedExposure: false,
      rejectionReason: "Exposure duration below 1000ms threshold for verified impression",
    };
  }

  return { isVerifiedExposure: true };
}
