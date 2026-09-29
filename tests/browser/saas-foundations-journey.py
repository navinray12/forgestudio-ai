"""Real Chromium smoke/accessibility journey for SaaS foundations.

Uses only disposable localhost services and database-created sessions. External
network requests from the browser are blocked.
"""
import json, os, pathlib, shutil
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

base=os.environ.get("FORGE_BROWSER_URL","http://localhost:5173")
api=os.environ.get("FORGE_API_URL","http://localhost:5000")
if urlparse(base).hostname not in ("localhost","127.0.0.1"): raise RuntimeError("local browser only")
fixture=json.loads(pathlib.Path(os.environ["FORGE_SAAS_BROWSER_FIXTURE"]).read_text())
report=pathlib.Path(os.environ.get("FORGE_SAAS_BROWSER_REPORT","tests/reports/saas-browser"))
report.mkdir(parents=True,exist_ok=True)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get("FORGE_CHROME_PATH") or shutil.which("google-chrome") or shutil.which("chromium"),headless=True)
    try:
        def context(cookie_name,token):
            ctx=browser.new_context(viewport={"width":1440,"height":1000})
            ctx.add_cookies([{"name":cookie_name,"value":token,"domain":urlparse(base).hostname,"path":"/","httpOnly":True,"secure":False,"sameSite":"Lax"}])
            ctx.route("**/*",lambda route: route.continue_() if urlparse(route.request.url).hostname in ("localhost","127.0.0.1") else route.abort())
            page=ctx.new_page();page.set_default_timeout(15000);return ctx,page

        platform_ctx,platform=context("forge_platform_session",fixture["owner"]["platformToken"])
        platform.goto(base+"/platform-control",wait_until="domcontentloaded")
        expect(platform.get_by_role("heading",name="Forge Platform Control Center",exact=True)).to_be_visible()
        expect(platform.get_by_text("authentication",exact=True)).to_be_visible()
        expect(platform.get_by_text("Locked",exact=True).first).to_be_visible()
        # Keyboard focus must reach the change-reason field and available action controls.
        platform.get_by_label("Change reason",exact=True).focus()
        if platform.evaluate("document.activeElement?.getAttribute('aria-label') || document.activeElement?.getAttribute('name') || document.activeElement?.tagName") not in ("INPUT","Change reason"):
            raise AssertionError("Control center reason input was not keyboard focusable")
        platform.screenshot(path=str(report/"platform-control.png"),full_page=True)

        tenant_ctx,tenant=context("forge_session",fixture["owner"]["tenantToken"])
        tenant.goto(base+"/dashboard",wait_until="domcontentloaded")
        tenant.get_by_role("button",name=fixture["workspace"]["name"],exact=True).click()
        panel=tenant.get_by_label("Selected workspace",exact=True)
        expect(panel.get_by_role("heading",name=fixture["workspace"]["name"],exact=True)).to_be_visible()
        expect(panel.get_by_role("heading",name="Organization billing & entitlements",exact=True)).to_be_visible()
        expect(panel.get_by_text(fixture["plan"]["name"],exact=True)).to_be_visible()
        # Confirm visible form controls expose accessible names.
        unnamed=panel.locator("button:not([aria-label])").evaluate_all("(els)=>els.filter(e=>!(e.textContent||'').trim()).length")
        if unnamed:
            raise AssertionError(f"{unnamed} empty-name buttons found in workspace/billing panel")
        tenant.screenshot(path=str(report/"workspace-billing.png"),full_page=True)
        platform_ctx.close();tenant_ctx.close()
    finally:
        browser.close()

(report/"result.json").write_text(json.dumps({"passed":True,"checks":["platform-control-authenticated","platform-control-keyboard-focus","organization-billing-visible","workspace-button-accessible-names"]},indent=2))
