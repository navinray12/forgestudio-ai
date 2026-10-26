import type { IdentityDeliveryPort } from "../../platform/ports/identity-delivery.port.js";
import { sendSmtpMessage } from "./smtp-delivery.js";

export class SmtpOtpDelivery implements IdentityDeliveryPort {
  async sendCode({ email, code, purpose }: { email: string; code: string; purpose: "LOGIN" | "SIGNUP" }) {
    await sendSmtpMessage({ email, subject: "Forge sign-in verification",
      text: `Your Forge ${purpose === "LOGIN" ? "sign-in" : "registration"} code is ${code}. It expires in 10 minutes. Do not share it.` });
  }
}
