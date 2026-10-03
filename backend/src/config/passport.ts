// Compatibility export only. Legacy unbound OAuth callbacks are not registered.
// The managed identity adapter validates PKCE, state, nonce, issuer and audience.
import passport from "passport";
export default passport;
