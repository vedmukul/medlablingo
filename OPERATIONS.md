# MedLabLingo — operations & compliance notes

This document is for teams running MedLabLingo in environments where health information may be processed. It is not legal advice.

## Data flow (high level)

- Users upload documents in the browser. Text is extracted server-side for analysis.
- Analysis calls third-party AI providers when API keys are configured; otherwise mock mode is used.
- Feedback (`POST /api/feedback`) stores **no free-text comments on disk by default**; entries are logged server-side. Optional `FEEDBACK_WEBHOOK_URL` forwards a JSON payload to your own endpoint for ticketing or analytics.

## Business Associate Agreements (BAA)

- Whether a BAA is required depends on your deployment, who operates the app, and which vendors process PHI.
- If you use cloud AI APIs with real patient documents, obtain and retain appropriate BAAs or equivalent agreements from **your hosting provider** and **each AI vendor** you enable, or route traffic through an architecture your compliance team approves.

## Feedback and PHI

- Instruct users **not** to put names, MRNs, phone numbers, or other identifiers in optional feedback comments.
- Treat webhook payloads as potentially sensitive; use HTTPS and restrict access to the receiving system.

## Environment variables

| Variable | Purpose |
| -------- | ------- |
| `FEEDBACK_WEBHOOK_URL` | Optional. HTTPS URL to receive JSON feedback events from `/api/feedback`. |

See `.env.example` for provider keys and notes.

## Incident response (suggested)

- Document who can rotate API keys and revoke webhook endpoints.
- If a key is exposed, rotate it in the vendor console and redeploy.

## Versioning

- Analysis output is tagged with `meta.schemaVersion` in the stored payload. When upgrading prompts or schema, plan for mixed versions in user history.
