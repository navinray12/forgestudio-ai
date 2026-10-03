import { AppError } from "../utils/app-error.js";
// The previous user-ID-only OTP functions are retired. They could authenticate
// without the password/browser proof. Use LocalAuthentication's bound challenge.
export async function generateAndSendOtp(_input: unknown): Promise<never> {
  throw new AppError("A browser-bound authentication challenge is required.", 410, "LEGACY_OTP_RETIRED");
}
export async function verifyOtp(_input: unknown): Promise<never> {
  throw new AppError("A browser-bound authentication challenge is required.", 410, "LEGACY_OTP_RETIRED");
}
export async function sendOtpWhatsApp(_input: unknown): Promise<never> {
  throw new AppError("Phone verification is not configured.", 503, "CHANNEL_UNAVAILABLE");
}
