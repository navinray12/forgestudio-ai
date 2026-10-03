"""Compiled browser/API journey with real database and test-only private mail sink.

There are no mocked browser requests or fixed verification-code bypasses. The
server fixture injects delivery through a port; live SMTP/OIDC vendors are not
represented by this test. Reports never contain the generated codes or cookies.
"""
import json
import os
import pathlib
import secrets
import shutil
import time
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

base = os.environ.get("FORGE_BROWSER_URL", "http://localhost:5173")
api = os.environ.get("FORGE_BROWSER_API", "http://localhost:5000") + "/api/v1/auth"
sink = pathlib.Path(os.environ["FORGE_IDENTITY_MAIL_SINK"])
out = pathlib.Path(os.environ.get("FORGE_IDENTITY_BROWSER_REPORT", "/tmp/identity-browser-report"))
if any(urlparse(url).hostname not in ("localhost", "127.0.0.1") for url in (base, api)):
    raise RuntimeError("Identity journey only runs against local disposable servers")
out.mkdir(parents=True, exist_ok=True)
email = f"browser-{secrets.token_hex(8)}@example.test"
password = "Disposable password " + secrets.token_hex(12)
checks = []
def record(name):
    checks.append({"testId": name, "passed": True})
def delivered_code():
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        if sink.exists():
            message = json.loads(sink.read_text())
            if message["email"] == email:
                return message["code"]
        time.sleep(0.05)
    raise RuntimeError("Test delivery sink did not receive the generated code")

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("FORGE_CHROME_PATH") or shutil.which("google-chrome") or shutil.which("chromium"), headless=True)
    page = None
    try:
        context = browser.new_context(viewport={"width": 1365, "height": 900})
        context.route("**/*", lambda route: route.continue_() if urlparse(route.request.url).hostname in ("localhost", "127.0.0.1") else route.abort())
        page = context.new_page()
        page.set_default_timeout(15000)
        page.goto(base + "/signup", wait_until="domcontentloaded")
        expect(page.get_by_role("heading", name="Create your account", exact=True)).to_be_visible()
        page.get_by_label("Full name", exact=True).fill("Browser identity fixture")
        page.get_by_label("Email address", exact=True).fill(email)
        page.get_by_label("Password", exact=True).fill(password)
        page.get_by_label("Confirm password", exact=True).fill(password)
        with page.expect_response(lambda response: response.url.endswith("/auth/signup") and response.request.method == "POST") as response:
            page.get_by_role("button", name="Create your account", exact=True).click()
        assert response.value.status == 201, "Signup was not durably accepted"
        user_id = response.value.json()["data"]["userId"]
        expect(page.get_by_role("heading", name="Check your email", exact=True)).to_be_visible()
        assert context.request.get(api + "/me").status == 401, "Unverified signup created a session"
        record("identity.browser.signup-awaits-verification")
        code = delivered_code()
        attacker = browser.new_context()
        response = attacker.request.post(api + "/signup/verify-otp", data={"userId": user_id, "channel": "EMAIL", "otp": code}, headers={"Origin": base})
        assert response.status == 401, "Another browser consumed the challenge"
        attacker.close()
        record("identity.browser.cookie-bound-challenge")
        page.get_by_label("Verification code", exact=True).fill("000000")
        page.get_by_role("button", name="Verify and sign in", exact=True).click()
        expect(page.get_by_role("alert")).to_be_visible()
        assert context.request.get(api + "/me").status == 401
        record("identity.browser.invalid-code-rejected")
        page.get_by_label("Verification code", exact=True).fill(code)
        page.get_by_role("button", name="Verify and sign in", exact=True).click()
        page.wait_for_url("**/dashboard")
        me = context.request.get(api + "/me")
        assert me.status == 200 and me.json()["data"]["user"]["id"] == user_id
        cookies = context.cookies()
        assert any(c["name"] == "forge_session" and c["httpOnly"] and c["sameSite"] == "Lax" for c in cookies)
        assert not any(c["name"] == "forge_challenge" for c in cookies)
        storage = page.evaluate("Object.keys(localStorage).filter(k => /token|session|password/i.test(k))")
        assert storage == [], "Credentials were stored in local storage"
        record("identity.browser.verified-session-without-browser-token-storage")
        # UI session management is reused by account access. The server command
        # is also tested here with a real browser-origin request, not a fake token.
        sessions = context.request.get(api + "/sessions")
        assert sessions.status == 200 and len(sessions.json()["data"]) == 1
        serialized = sessions.text()
        assert "tokenHash" not in serialized and "passwordHash" not in serialized
        current = sessions.json()["data"][0]["id"]
        blocked = context.request.post(api + "/sessions/" + current + "/revoke", data={}, headers={"Origin": "https://attacker.example"})
        assert blocked.status == 403 and context.request.get(api + "/me").status == 200
        record("identity.browser.session-management-is-scoped-and-csrf-protected")
        # Successful password proof is tested separately from signup. Remove the
        # sink so only a fresh generated delivery can satisfy the next challenge.
        assert context.request.post(api + "/logout", data={}, headers={"Origin": base}).status == 200
        sink.unlink(missing_ok=True)
        page.goto(base + "/login")
        page.get_by_label("Email address", exact=True).fill(email)
        page.get_by_label("Password", exact=True).fill(password)
        with page.expect_response(lambda r: r.url.endswith("/login/send-otp")) as first_delivery:
            page.get_by_role("button", name="Sign in to Forge", exact=True).click()
        # First code delivery has a per-account cooldown by design. The test does
        # not bypass it: wait and use a new password proof after the cooldown.
        if first_delivery.value.status == 429:
            time.sleep(61)
            page.get_by_role("button", name="Sign in to Forge", exact=True).click()
        expect(page.get_by_role("heading", name="Check your email", exact=True)).to_be_visible(timeout=15000)
        page.get_by_label("Verification code", exact=True).fill(delivered_code())
        page.get_by_role("button", name="Verify and sign in", exact=True).click()
        page.wait_for_url("**/dashboard")
        assert context.request.get(api + "/me").status == 200
        record("identity.browser.password-and-new-code-sign-in")
        assert context.request.post(api + "/sessions/revoke-all", data={}, headers={"Origin": base}).status == 200
        assert context.request.get(api + "/me").status == 401
        page.goto(base + "/dashboard")
        page.wait_for_url("**/login")
        record("identity.browser.revoke-all-invalidates-browser")
        page.screenshot(path=str(out / "signed-out.png"), full_page=True)
    except Exception:
        checks.append({"testId": "identity.browser.incomplete-journey", "passed": False})
        # Never screenshot a form populated with credentials or an OTP.
        raise
    finally:
        (out / "identity-results.json").write_text(json.dumps({"scope": "compiled-local-fixture", "checks": checks}, indent=2))
        print(json.dumps({"passed": sum(c["passed"] for c in checks), "failed": sum(not c["passed"] for c in checks)}))
        browser.close()
