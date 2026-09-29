import { useEffect, useRef, useState, type FormEvent } from "react";
import { identityRequest, startManagedLogin, type IdentityCapabilities } from "./identity-api";

export function AuthenticationPage({ mode }: { mode: "login" | "signup" }) {
  const [capabilities, setCapabilities] = useState<IdentityCapabilities | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState<{ userId: string; email: string } | null>(null);
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const mounted = useRef(true);
  const request = useRef<AbortController | null>(null);
  const submitLock = useRef(false);
  useEffect(() => {
    mounted.current = true; const abort = new AbortController();
    identityRequest<{ data: IdentityCapabilities }>("/capabilities", undefined, abort.signal)
      .then(result => setCapabilities(result.data)).catch(err => { if (!abort.signal.aborted) setError(err.message); });
    return () => { mounted.current = false; abort.abort(); request.current?.abort(); };
  }, []);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(v => Math.max(0, v - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function perform(work: (signal: AbortSignal) => Promise<void>) {
    if (submitLock.current) return;
    submitLock.current = true; setBusy(true); setError("");
    const abort = new AbortController(); request.current = abort;
    try { await work(abort.signal); }
    catch (err) { if (mounted.current) setError(err instanceof Error ? err.message : "Sign-in failed."); }
    finally { submitLock.current = false; if (mounted.current) setBusy(false); }
  }
  function credentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    void perform(async signal => {
      const password = String(form.get("password") ?? "");
      if (mode === "signup" && password !== form.get("confirm")) throw new Error("The passwords do not match.");
      const body = { identifier: String(form.get("email") ?? ""), password,
        ...(mode === "signup" ? { fullName: String(form.get("name") ?? "") } : {}) };
      const result = await identityRequest<{ data: { userId: string; email: string } }>(`/${mode}`, body, signal);
      if (mode === "login") await identityRequest("/login/send-otp", { userId: result.data.userId, channel: "EMAIL" }, signal);
      if (!mounted.current) return;
      setChallenge(result.data); setCooldown(60);
    });
  }
  function verify(event: FormEvent) {
    event.preventDefault();
    if (!challenge) return;
    void perform(async signal => {
      await identityRequest(`/${mode}/verify-otp`, { userId: challenge.userId, otp: code, channel: "EMAIL" }, signal);
      window.location.assign("/dashboard");
    });
  }
  const title = mode === "signup" ? "Create your account" : "Sign in to Forge";
  return <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
    <section className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-xl" aria-labelledby="identity-title">
      <p className="text-sm uppercase tracking-widest text-blue-300">Forge Studio</p>
      <h1 id="identity-title" className="mt-2 text-3xl font-semibold">{challenge ? "Check your email" : title}</h1>
      <p className="mt-3 text-sm text-slate-300">{challenge ? "Enter the single-use code in this same browser. Do not share it." :
        "Your organization and workspace permissions are checked after sign-in."}</p>
      {error && <div role="alert" className="my-4 rounded border border-red-400 p-3">{error}</div>}
      {!capabilities && !error && <p role="status" className="my-6">Loading sign-in options…</p>}
      {!challenge && capabilities?.managed && <button className="mt-6 w-full rounded bg-blue-600 p-3 font-medium disabled:opacity-50"
        disabled={busy} onClick={() => void perform(() => startManagedLogin())}>Continue with identity provider</button>}
      {!challenge && capabilities?.local && <form onSubmit={credentials} className="mt-6 space-y-4">
        <p className="text-xs text-amber-200">Local development sign-in. Production uses the configured identity provider.</p>
        {mode === "signup" && <label className="block">Full name<input required name="name" autoComplete="name" minLength={2} maxLength={120}
          className="mt-1 block w-full rounded bg-slate-800 p-3" /></label>}
        <label className="block">Email address<input required name="email" type="email" autoComplete="username" maxLength={254}
          className="mt-1 block w-full rounded bg-slate-800 p-3" /></label>
        <label className="block">Password<input required name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"}
          minLength={mode === "signup" ? 12 : 1} maxLength={1024} className="mt-1 block w-full rounded bg-slate-800 p-3" /></label>
        {mode === "signup" && <label className="block">Confirm password<input required name="confirm" type="password" autoComplete="new-password"
          minLength={12} maxLength={1024} className="mt-1 block w-full rounded bg-slate-800 p-3" /></label>}
        <button disabled={busy} className="w-full rounded bg-blue-600 p-3 disabled:opacity-50">{busy ? "Please wait…" : title}</button>
      </form>}
      {challenge && <form onSubmit={verify} className="mt-6 space-y-4">
        <label className="block">Verification code<input autoFocus required inputMode="numeric" autoComplete="one-time-code"
          pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
          className="mt-1 block w-full rounded bg-slate-800 p-3 tracking-widest" /></label>
        <button disabled={busy} className="w-full rounded bg-blue-600 p-3 disabled:opacity-50">Verify and sign in</button>
        <button type="button" disabled={busy || cooldown > 0} className="w-full rounded border border-slate-500 p-3 disabled:opacity-50"
          onClick={() => void perform(async signal => {
            await identityRequest(`/${mode}/resend-otp`, { userId: challenge.userId, channel: "EMAIL" }, signal);
            if (mounted.current) setCooldown(60);
          })}>{cooldown ? `Resend in ${cooldown} seconds` : "Resend code"}</button>
        <button type="button" disabled={busy} onClick={() => { setChallenge(null); setCode(""); setError(""); }} className="underline">Start again</button>
      </form>}
      {capabilities && !capabilities.local && !capabilities.managed && <p role="alert" className="mt-6">Sign-in is not configured. Contact the platform operator.</p>}
      {!challenge && capabilities?.local && <p className="mt-6 text-sm"><a className="underline" href={mode === "login" ? "/signup" : "/login"}>
        {mode === "login" ? "Create an account" : "Already have an account? Sign in"}</a></p>}
      <p className="mt-6 text-xs text-slate-400">Account recovery and multi-factor enrollment are managed by your identity provider.</p>
    </section>
  </main>;
}
