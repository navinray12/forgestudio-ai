import { AppError } from "../utils/app-error.js";
interface CreateSessionInput { userId: string; tokenHash: string; expiresAt: Date }
/** Compatibility symbol only: a user identifier is not an authentication proof.
 * New sessions are written by the identity repository inside a verified use case. */
export async function createSession(_input: CreateSessionInput): Promise<never> {
  throw new AppError("Session creation requires a verified identity flow.", 410, "UNBOUND_SESSION_RETIRED");
}
