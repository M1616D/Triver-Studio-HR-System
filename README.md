# Triverse Studio — Business System

The studio's own operations system: find businesses on the map, build them a website
from one of our designs, message them, track the reply, and keep every client, invoice,
project and file in one place.

Built for **Triverse Studio Software Solution** — Addis Ababa, Ethiopia. Everything is
counted in **ETB**.

## Run it

```bash
npm start          # serves the app on http://localhost:8099
```

Open `http://localhost:8099`. Do not open `index.html` from the file system — the browser
treats `file://` as a unique origin, which blocks cloud sync and storage.

`triverse-os.html` is the same app packed into a single file for handing to someone else.

Every new device lands on the **sign-in page** first: sign in with Google to pull the
workspace out of the studio's Drive folder, open this device's copy, or restore a backup
file. Signed-in state lasts 14 days per browser and is shown in Settings → This device.

## What is in here

| Area | What it does |
|---|---|
| Assistant | Hand the AI a job in plain language — it plans, you approve permissions, it runs and logs every step |
| Discover | Search a business type and area, filter to the ones with no website, open the full Google record |
| Outreach | Per-business message in Amharic or English, WhatsApp / Telegram send, reply triage |
| Clients | Prospects, active, paused, past and rejected companies with their full history |
| Projects | Live sites, coming soon, in progress and finished work |
| File vault | Upload and download any file, with a detailed record for each one |
| Money | Quotes, invoices and payments in ETB, with the studio's own price list |
| Catalogue | The product list: websites, QR menus, HR systems, design work |
| Settings | Company profile, social profiles, Google, AI, cloud, security |

## The design library

**No design is shipped with the app.** The library is exactly what the studio uploads
from the Samples page, so a layout can never be silently rewritten by an import step.

Uploading accepts a whole **folder** or a single **`.html` file**, by picking or by
dragging it onto the drop zone. A folder is read as it is: the page, its CSS, its
JavaScript and its own pictures are folded into one self-contained design, and every other
page in the folder is kept alongside it. The scanner then reports what the design gives us
to fill — text blocks, photos, phone, email, map, address, social links, page blocks,
live fields, colours and fonts — with a confidence score. When a client comes, only the
**information** inside the design changes: name, phone, address, map, socials, opening
hours, copy. Layout, spacing, colours and animation stay as uploaded.

`.sample-preview/` is the raw uploaded reference library on disk. It is large and **not
committed**; the designs that matter live in the workspace (and therefore in the Drive
backup), so another computer gets them by signing in.

## Checks

```bash
npm test      # smoke tests — storage, providers, vault, AI, assistant permissions
npm run css   # rebuild Tailwind utilities after editing classes
npm run build # repack triverse-os.html
```

## Security

The workspace can be encrypted at rest behind a passphrase (PBKDF2 + AES-GCM). Google
Drive backup is optional and uses OAuth against the studio's own Google account. No API
key or passphrase is ever written into this repository.
