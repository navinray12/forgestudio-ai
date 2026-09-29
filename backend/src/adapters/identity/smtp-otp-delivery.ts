import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport/index.js";
import net from "node:net";
import tls from "node:tls";
import type { IdentityDeliveryPort } from "../../platform/ports/identity-delivery.port.js";
import { AppError } from "../../utils/app-error.js";

export class SmtpOtpDelivery implements IdentityDeliveryPort {
  async sendCode({ email, code, purpose }: { email: string; code: string; purpose: "LOGIN" | "SIGNUP" }) {
    const { SMTP_HOST: host, SMTP_USER: user, SMTP_PASSWORD: pass, SMTP_FROM: from } = process.env;
    const port = Number(process.env.SMTP_PORT ?? "587");
    if (!host || !user || !pass || !from || ![465, 587, 2525].includes(port)) {
      throw new AppError("Security email is not configured.", 503, "IDENTITY_DELIVERY_UNAVAILABLE");
    }
    let socket: net.Socket | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const options: SMTPTransport.Options & { getSocket: (options: unknown,
      callback: (error: Error | null, result?: { connection: net.Socket; secured: boolean }) => void) => void } = {
      host, port, secure: port === 465, requireTLS: true, auth: { user, pass },
      connectionTimeout: 3000, greetingTimeout: 3000, socketTimeout: 5000, dnsTimeout: 2000,
      logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true,
      tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" },
      getSocket(_options, callback) {
        // Own the underlying connection so an absolute deadline can destroy it;
        // SMTPTransport.close alone does not cancel a direct SMTP send.
        socket = port === 465 ? tls.connect({ host, port, servername: host, rejectUnauthorized: true, minVersion: "TLSv1.2" }) :
          net.connect({ host, port });
        let handedOff = false;
        socket.once("error", () => {
          if (!handedOff) { handedOff = true; callback(new Error("SMTP_CONNECTION_FAILED"), undefined); }
        });
        socket.once(port === 465 ? "secureConnect" : "connect", () => {
          if (!handedOff) { handedOff = true; callback(null, { connection: socket!, secured: port === 465 }); }
        });
      },
    };
    const transporter = nodemailer.createTransport(options);
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => { socket?.destroy(new Error("SMTP_DEADLINE")); reject(new Error("SMTP_DEADLINE")); }, 8000);
    });
    try {
      const result = await Promise.race([transporter.sendMail({ from, to: email, subject: "Forge sign-in verification",
        text: `Your Forge ${purpose === "LOGIN" ? "sign-in" : "registration"} code is ${code}. It expires in 10 minutes. Do not share it.` }), deadline]);
      if (!result.accepted?.some((recipient: unknown) => typeof recipient === "string" && recipient.toLowerCase() === email.toLowerCase())) {
        throw new Error("SMTP_RECIPIENT_REJECTED");
      }
    } catch {
      // Provider errors may contain credentials or SMTP conversation; never expose/log them.
      throw new AppError("Security email delivery failed.", 503, "IDENTITY_DELIVERY_UNAVAILABLE");
    } finally { clearTimeout(timer); socket?.destroy(); transporter.close(); }
  }
}
