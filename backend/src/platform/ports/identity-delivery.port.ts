export interface IdentityDeliveryPort {
  /** Resolves only after the configured provider accepted the security message.
   * It does not mean the recipient has read it. Never log a code or destination.
   */
  sendCode(input: { email: string; code: string; purpose: "LOGIN" | "SIGNUP" }): Promise<void>;
}
export interface PasswordPort {
  hash(password: string): Promise<string>;
  verify(password: string, digest: string): Promise<boolean>;
}
