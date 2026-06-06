# 🔖 DocRefGen

**Document Reference Number Generator for Google Docs**

DocRefGen is a Chrome extension that auto-generates unique reference numbers for your HR and Legal documents — and keeps a searchable audit log of every document created. Built for small teams that need traceable, auditable records without the overhead of a full DMS.

> Built by [@abhikuchbhi](https://x.com/abhikuchbhi)

---

## What it does

- Place `{{DOC-REF-NO}}` anywhere in your Google Doc — body, header, or footer
- DOC-REF-NO in {{}} is the placeholder
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
## Story behind the Tool 

While running a company I realised, I am generating so many documents across Finance, Legal, HR, Business etc, and many of the times I need to reference a document in email or conversation or in legal letters as a version or sometime i need to see which document i had sent out. I looked for tools but most of the document management tools are suites and expensive. I tried building google scripts and sheets but that approach was not scalable. Thus, I build a chrome extension, now my entire team uses this, we have a common audit log sheet to audit and all the documents have uniformity, without spending a penny. 
Hope this helps you and your team too. 
If it does, dont forget to give a shoutout to me on Twitter :P 
abhikuchbhi.in
---

## License

Privacy Policy - [Privacy Policy Link](https://docrefgen.abhikuchbhi.in/PRIVACY_POLICY) 

MIT — do what you want with it.
