# Forms dashboard

Dashboard > Forms uses the shared dashboard navbar and the supplied screenshot's two-column notification settings and recent-forms table. Select a site and save changes. Owners/admins can manage settings and inspect that site's submissions.

The authenticated dashboard response merges discovered form widgets with real submission totals and latest timestamps. Forms with no submissions remain visible. Recent forms shows five rows; View all forms shows the complete result. The submissions dialog pages through 25 entries at a time and renders field values as text.

Settings are stored privately as editorData.formNotifications. Generic document saves preserve them, updates advance documentVersion, and publishing retains them without putting recipients into public release data. Settings apply to new submissions; already queued jobs retain the snapshot captured when the submission was accepted.

Enabled delivery creates separate FORM_NOTIFICATION_EMAIL jobs for configured recipients and, optionally, a valid submitter email. Recipient addresses are deduplicated. Saved settings take precedence over client-supplied email actions, so disabled delivery cannot be bypassed through the legacy submit action. Sender name/email and reply-to are passed to the existing site mailer. Supported subject variables are {{siteName}} and {{formName}}. Email HTML escapes submitted values.

Timing choices mean immediate queue eligibility, one-hour delay, or 24-hour delay per submission; they are not batched digest emails. Jobs commit atomically with the form submission/lead and use the existing durable worker/retry flow. Run the application worker to process delivery. Configure the site's existing SMTP settings or backend SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD/SMTP_PASS, SMTP_FROM, and SMTP_SECURE as appropriate. The sender address must be accepted by your SMTP provider.

Managed form email jobs fail/retry when SMTP is absent rather than reporting simulated delivery as successful. The table's Active badge means notifications are enabled and SMTP is configured; it is not proof that a recipient inbox received an email. The page displays missing SMTP explicitly while submissions remain durable.

Endpoints: GET /api/forms/:websiteId/dashboard, PUT /api/forms/:websiteId/notifications (X-Forge-Intent: form-notifications), GET /api/forms/:websiteId/forms/:formId/submissions?page=1. They use the application's authenticated session cookie. No migration is needed.

Validation covers schema, ownership, HTML/header safety, recipients, timing, mail transport arguments/failure, previous feature regressions, desktop/mobile browser interactions with test responses, and real-database save/reload/submission/job/access checks with temporary fixtures. All external mail transports were mocked or left queued for a future time and removed; live inbox delivery was not tested.
