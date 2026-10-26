# Dashboard integrations

Design: https://www.figma.com/design/O63KoRmbazwDyXhNtPnyDa/Elementor?node-id=12-23925

Choose Dashboard > Integrations, select a site, edit settings, and save. Site owners/admins can manage settings. Generic editor saves preserve integrations; integration updates advance documentVersion to reject stale editor writes. Republish to include tracking and form widgets in internal published React sites.

Provider setup:
- Google tags support G-, GT-, AW-, GTM-. Restrict the public Maps browser key to the published domains.
- Meta Pixel optionally waits for the application's cookie-consent acceptance.
- Cloudflare requires backend TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY. Both bot/spam switches enforce Turnstile verification; they do not classify submission content separately.
- reCAPTCHA v2 requires the site's public key in the page and backend RECAPTCHA_SECRET_KEY. Register provider keys for the published domains. Secret values never reach the browser.
- Get the App links open external provider setup/help pages; they do not claim OAuth connection.

API tokens use the existing developer API and account-scoped websites:read permissions. Tokens are shown once and can be revoked.

Webhooks support form.submitted over HTTPS. Submissions and delivery jobs commit together in the existing background_jobs transaction; run the existing application worker for delivery/retries. Each destination has a distinct job key. Delivery blocks private destinations and redirects and bounds time/response size. Removing a webhook stops new jobs; existing queued jobs retain their destinations.

The new tracking/widget runtime covers internal published React sites. Standalone exports and WordPress deployments require separate integration injection before provider execution on those destinations can be claimed.

Verification includes frontend/backend builds, focused integration and document-policy tests, desktop/mobile browser checks with test API responses, and real database save/reload/access-denial checks with temporary fixtures. Live analytics, provider challenges, and external webhook receipt require configured accounts and were not verified.
