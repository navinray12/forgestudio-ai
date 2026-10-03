export type IdentityAssurance = "none" | "mfa" | "phishing-resistant";
export interface VerifiedProviderIdentity {
  issuer: string; subject: string; email: string; emailVerified: true;
  name: string | null; authenticatedAt: Date; assurance: IdentityAssurance;
}
export interface AuthorizationProof {
  state: string; nonce: string; verifier: string;
}
export interface IdentityProviderPort {
  readonly key: string;
  readonly callbackUrl: string;
  authorizationUrl(proof: AuthorizationProof): Promise<string>;
  exchange(callback: URL, proof: AuthorizationProof): Promise<VerifiedProviderIdentity>;
}
