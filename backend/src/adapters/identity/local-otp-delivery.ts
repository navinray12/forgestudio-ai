import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, resolve } from "node:path";
import type { IdentityDeliveryPort } from "../../platform/ports/identity-delivery.port.js";

/** Explicit local-only delivery for disposable development stacks. The code is
 * never returned to a browser or written to application logs. */
export class LocalOtpDelivery implements IdentityDeliveryPort {
  constructor(private readonly file: string) {
    const tempParent = resolve(tmpdir());
    const fileParent = resolve(dirname(file));
    if (process.env.NODE_ENV === "production" || process.env.FORGE_AUTH_MODE !== "local" || !isAbsolute(file) ||
        (process.platform === "win32" ? fileParent.toLowerCase() !== tempParent.toLowerCase() : fileParent !== tempParent) ||
        !/^forge-[a-z0-9-]+\.json$/i.test(basename(file))) {
      throw new Error("LOCAL_OTP_DELIVERY_FORBIDDEN");
    }
  }

  async sendCode({ email, code, purpose }: { email: string; code: string; purpose: "LOGIN" | "SIGNUP" }) {
    await writeFile(this.file, JSON.stringify({ email, code, purpose, createdAt: new Date().toISOString() }), { mode: 0o600 });
  }
}
