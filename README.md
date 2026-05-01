# 🔖 DocRefGen

**Document Reference Number Generator for Google Docs**

DocRefGen is a Chrome extension that auto-generates unique reference numbers for your HR and Legal documents — and keeps a searchable audit log of every document created. Built for small teams that need traceable, auditable records without the overhead of a full DMS.

> Built by [@abhikuchbhi](https://x.com/abhikuchbhi)

---

## What it does

- Place `{{DOC-REF-NO}}` anywhere in your Google Doc — body, header, or footer
- Open the doc, click **Generate Ref & Insert** in the popup
- Reference number gets inserted instantly: `AMZ-EMP-2026-847293`
- Optionally log every generated ref to a Google Sheet audit trail

**Generated format:**
```
[COMPANY]-[DOCTYPE]-[YEAR]-[6-DIGIT-TIMESTAMP]

Examples:
AMZ-2026-847293        ← company + year + timestamp
AMZ-EMP-2026-847293   ← with document type prefix
```

---

## Features

| Feature | Details |
|---|---|
| Header & Footer support | Detects `{{DOC-REF-NO}}` anywhere in the doc — body, header, footer |
| Copy detection | If you open a "Copy of..." doc, it offers to generate a fresh ref |
| On-demand generation | Click Generate anytime — full user control, no auto-trigger |
| Audit trail | Optional Google Sheet log — ref number, doc title, link, date, type |
| Per-team setup | Each team sets their own prefix and sheet. HR, Legal, Finance stay separate |
| No backend | Zero servers, zero hosting. All logic runs in the browser |

---

## Setup

### 1. Google Cloud — One-time

You need a Google OAuth Client ID to let the extension talk to the Docs and Sheets APIs.

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (e.g. "DocRefGen")
3. **APIs & Services → Library** → enable:
   - Google Docs API
   - Google Sheets API
4. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Chrome Extension**
   - Paste your Extension ID (from `chrome://extensions` after loading unpacked)
5. Copy the generated Client ID

### 2. Add Client ID to manifest.json

```json
"oauth2": {
  "client_id": "YOUR_CLIENT_ID_HERE.apps.googleusercontent.com",
  ...
}
```

### 3. Add yourself as a test user (during development)

**APIs & Services → OAuth consent screen → Test users → Add Users**

Add your Gmail. Required until you complete Google's OAuth verification.

### 4. Load the extension

1. Go to `chrome://extensions`
2. Enable **Developer Mode** (top right)
3. Click **Load Unpacked** → select the `docref-extension` folder
4. Extension appears in your toolbar

### 5. Configure

Click the extension icon → **Settings ⚙**

- Set your **Company Prefix** (e.g. `AMZ`)
- Set optional **Document Type Prefix** (e.g. `EMP`, `ESOP`, `AGR`)
- Optionally enable **Audit Trail** and paste your Google Sheet ID

---

## Usage

**In your Google Doc template:**
```
Place {{DOC-REF-NO}} wherever the reference number should appear.
Works in the document body, header, and footer.
```

**Generating a ref number:**
1. Open the doc (a copy of your template)
2. Click the DocRefGen icon in Chrome toolbar
3. Click **Generate Ref & Insert into Doc**
4. The placeholder is replaced with e.g. `AMZ-EMP-2026-847293`
5. Optionally click **Log to Audit Sheet**

**Audit Sheet columns (auto-created):**

| Ref Number | Doc Title | Doc Link | Doc Type | Created By | Date & Time |
|---|---|---|---|---|---|

---

## File Structure

```
docref-extension/
├── manifest.json      ← Extension config, permissions, OAuth client ID
├── background.js      ← OAuth token management, Sheets API logging
├── content.js         ← Runs inside Google Docs, reads & writes via Docs API
├── popup.html/js      ← Toolbar popup UI — generate, copy, log
├── options.html/js    ← Settings page — prefix, audit sheet config
└── icons/             ← Extension icons (16, 48, 128px)
```

---

## Publishing to Chrome Web Store

1. Zip the `docref-extension/` folder (not the parent)
2. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Pay one-time **$5** developer registration fee
4. Upload the zip
5. Fill in store listing (name, description, screenshots)
6. Set visibility: **Public / Unlisted / Private (Workspace domain)**
7. Submit for review — typically **1–3 business days**

> For internal/team use: set visibility to **Unlisted** and share the direct link. No public listing needed.

---

## OAuth Verification (for public release)

While in "Testing" mode, only approved test users can use the extension.

To go public:
- **APIs & Services → OAuth consent screen → Publish App**
- Fill in privacy policy URL (required)
- Submit for Google review — typically 1–4 weeks
- Once verified, anyone can install and authenticate

> This is free. Google is just checking your app isn't malicious.

---

## Cost

| Item | Cost |
|---|---|
| Google Docs API | Free |
| Google Sheets API | Free |
| Chrome Web Store registration | One-time $5 |
| Hosting / backend | $0 — no server needed |
| Ongoing | $0 |

---

## Tech notes

- **Why Docs API instead of DOM?** Google Docs renders in a canvas-based UI. `document.body.innerText` doesn't return actual doc content. The Docs REST API is the only reliable way to read and write document text.
- **Why timestamp-based ref numbers?** No counter to maintain, no shared state, guaranteed unique, encodes creation time inherently.
- **replaceAllText** covers the entire document including headers and footers in a single API call.

---

## License

Privacy Policy - [Privacy Policy Link](https://abhi-geek.github.io/docrefgen/PRIVACY_POLICY) 

MIT — do what you want with it.
