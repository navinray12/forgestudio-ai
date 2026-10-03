import { SmtpOtpDelivery } from "../adapters/identity/smtp-otp-delivery.js";
export async function sendOtpEmail(email: string, code: string, purpose: "SIGNUP" | "LOGIN"): Promise<void> {
  await new SmtpOtpDelivery().sendCode({ email, code, purpose });
}
