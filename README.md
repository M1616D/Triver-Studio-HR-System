# Triverse Studio — Business System

The studio's own operations system: find businesses on the map, build them a website
from one of our designs, message them, track the reply, and keep every client, invoice,
project and file in one place.

Built for **Triverse Studio Software Solution** — Addis Ababa, Ethiopia. Everything is
counted in **ETB**.

## Run it

```bash
npm start          # serves the app on http://localhost:8123
```

Open `http://localhost:8123`. Do not open `index.html` from the file system — the browser
treats `file://` as a unique origin, which blocks cloud sync and storage.

`triverse-os.html` is the same app packed into a single file for handing to someone else.
It still needs to sit next to the `samples/` folder so the sample designs keep their photos.

## What is in here

| Area | What it does |
|---|---|
| Discover | Search a business type and area, filter to the ones with no website, open the full Google record |
| Outreach | Per-business message in Amharic or English, WhatsApp / Telegram send, reply triage |
| Clients | Prospects, active, paused, past and rejected companies with their full history |
| Projects | Live sites, coming soon, in progress and finished work |
| File vault | Upload and download any file, with a detailed record for each one |
| Money | Quotes, invoices and payments in ETB, with the studio's own price list |
| Catalogue | The product list: websites, QR menus, HR systems, design work |
| Settings | Company profile, social profiles, Google, AI, cloud, security |

## The sample designs

`assets/js/samples.real.js` is **generated** — do not hand-edit it.

```bash
npm run measure-samples    # what each uploaded design needs from disk
npm run import-samples     # rebuild samples.real.js from .sample-preview/
npm run check-samples      # clone one design per category and verify the result
```

Each uploaded design is used **exactly as it was written**. The importer does not redesign
or restyle anything. It copies the design's own pictures and fonts into
`samples/assets/<id>/`, compiles the Tailwind Play CDN into inline CSS (that one script had
to go — it is not for production and needs the network), and drops analytics scripts.
Every tag, class, colour, image and animation stays as uploaded. When a client comes, the
generator changes only the **information** inside the design — name, phone, address, map,
socials, opening hours, copy.

`.sample-preview/` is the uploaded reference library. It is large and **not committed**.

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
