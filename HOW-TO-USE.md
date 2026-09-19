# Triverse OS — how to use it

The studio's own system: find businesses on Google Maps, pitch them, run the
projects, keep every file, take the money, and keep the whole thing backed up in
your own Google Drive and locked behind your own passphrase.

---

## 1. Open it

**Recommended — on a web address.** In the project folder run:

```bash
npm start
```

then open **http://localhost:8099**. Everything works here, including the sign-in
lock, the file vault and Google Drive.

**Also fine — straight from the folder.** Double-click `triverse-os.html` (the
single portable file) or `index.html`. Everything works except Google Drive
sign-in, which Google refuses to do for a page opened off the disk.

There is nothing to install and no server of ours to pay for. The whole system is
static files.

---

## 2. Set your lock before you put anything real in it

**Settings → Security → Protect this workspace.**

- Choose a passphrase of at least 10 characters. The workspace is then encrypted
  on the device with **AES-256-GCM**, keyed from that passphrase through
  **PBKDF2-SHA256, 310,000 rounds**. What sits in the browser afterwards is
  ciphertext, not your client list.
- **The recovery code is shown once.** Write it down and keep it off this
  computer — in a safe, on paper in the office, or in your Google Drive. It is the
  only way back in if the passphrase is forgotten. There is no reset link.
- The key is held in memory for the session only. Closing the tab, or leaving the
  screen idle for the auto-lock time (30 minutes by default), locks it again.
- Change the passphrase, issue a new recovery code, or remove protection at any
  time from the same card.

Five wrong passphrases in a row start a waiting period that grows each time.

---

## 3. Connect your Google Drive (the off-device copy)

**Settings → Cloud → Google OAuth Client ID → Connect Google Drive.**

One-time setup, about four minutes (the card in the app has the click-by-click):

1. console.cloud.google.com → pick or create a project.
2. APIs & Services → Library → enable **Google Drive API**.
3. OAuth consent screen → External → add your own Gmail as a test user.
4. Credentials → Create credentials → OAuth client ID → **Web application**.
5. Authorised JavaScript origins → add the address you open the system on
   (for example `http://localhost:8099`).
6. Paste the Client ID (ends in `.apps.googleusercontent.com`) and press Connect.

What it gives you:

| Button | What it does |
|---|---|
| **Back up now** | Puts one JSON copy of the whole workspace into a `Triverse OS` folder in *your* Drive. |
| **Pull the newest copy** | The answer to “open it on another laptop”: sign in there and pull everything back. |
| **Copy N files to Drive** | Uploads every vault file that has no Drive copy yet. |
| **Open the folder** | Opens that folder in Drive. |
| **Automatic backup** | After changes, at most every few minutes. |

The app asks only for the `drive.file` permission, which lets it see and manage
the files it created — nothing else in the account. There is no server of ours in
the middle.

---

## 4. The daily loop

### Discover
Type a business type, pick an area of Addis Ababa, press Enter. You get the real
Google Maps listings with rating, phone, website and a pin on the map. Filter
with **No website** (best prospects), WhatsApp, 4.5 stars and up.

Tap any business: its full record — photos, phone (tap to call), WhatsApp, the
website link (or the amber *“No website — your opening”* chip), directions,
opening hours for all seven days, review text, price level, place ID.

**About the Google allowance.** Every search you run is saved. Running the same
search again — today, next week, with the internet off — is instant and costs
nothing. Only a genuinely new search uses the daily Google allowance, and when it
is spent the app says so once and you keep working from your own lists. You can
clear the saved searches from **Settings → Backup** if you ever want to.

### Outreach
Press **Try this** to build a website from the business's own Maps record. Then
send the message: WhatsApp, Telegram, email or a call script, with their name,
category, rating and review count already in the text.

Paste their reply into **Log reply** and it is scored for you — positive goes to
the interested list with a proposal, negative is closed and the next business
opens.

### Clients
The companies you work with, their contacts, history, stage and everything
attached to them.

### Projects
Every piece of real work, in one screen with these phases:

- **Hosted & live** — sites you host and keep online
- **In development** — the new websites and apps coming next
- **Working on now** — client work in this period
- **Ongoing & retainers** — the care plans that pay every month
- **Completed / past** — delivered and handed over
- **Paused / on hold**, **Cancelled**

Each project keeps its client, value, what has been paid, what is outstanding,
start and target dates, delivery date, hosting and domain renewals, tech stack,
repository, live address and its own notes. Attach files to it and they appear on
the project as well as in the vault.

### File vault
**Add files** (or drop them on the box) and upload anything: a whole HTML/CSS/JS
build, PHP, Python, logos, contracts, invoices, invoices PDF, archives, fonts.

Every file keeps a full record — name, type, extension, size in bytes, version,
language/stack, **SHA-256 checksum**, category, the project and client it belongs
to, author, tags, description and internal notes — plus its own history of when it
was added, opened and downloaded, and whether a copy exists in Drive.

From the detail view you can open it, download it, upload a new version, copy it
to Drive, pull it back from Drive, edit the record or delete it. The search box
looks inside the file contents too, so “Triverse” finds the file that contains it.

### Money
Invoices in Birr, part-payments, overdue reminders, printable documents and CSV
export.

### Catalogue and Samples
What you sell with Ethiopian prices, and your sample pages and design templates.

### The sample library (how a website gets built)
The generator never invents a design. Each business is matched to a finished
sample for its category and **only the information changes** — name, phone,
address, map, socials, hours, prices, photos, reviews:

| Sample | Used for |
|---|---|
| Software / product page | SaaS, software, HR systems, apps, agencies |
| Restaurant / cafe / QR menu | restaurants, cafés, roasteries, bakeries, fast food |
| Shop / salon / gym / clinic | shops, boutiques, cosmetics, salons, spas, gyms, clinics, pharmacies, hotels, gyms, real estate, travel, print, repair, construction |

*Sidebar → Samples* opens the library. **Preview** shows the design as it ships.
**Which sample for which type** prints the full business-type → sample table.

**Uploading a new sample:** *Upload a sample* → choose any `.html` file (its own
CSS/JS included) → **Analyse first** reads the file and reports what it found
(headings, photos, phone, address, socials, colours, fonts, repeatable blocks,
how many `{{placeholders}}`) → **Read & save as a sample** adds it to the
library. From then on any business of that category is built from it, and the
system swaps the old business's details for the new one's.

### The assistant (Gemini) — permissions first
Settings → AI holds the key; **Detect models** reads the live model list from
your own key, so a retired model name can never break the AI again — if a name
dies mid-task the app switches and retries by itself.

The *Assistant* button opens the planner with the permission panel. Permissions
work without a key, so you can set them up now:

| Permission | What it allows |
|---|---|
| Read | see businesses, clients, projects, files, money |
| Draft | write messages, build website drafts |
| Records | create clients, projects, invoices, change statuses |
| Files | store and tag files in the vault |
| **Send** | actually send a message — **off until you turn it on** |
| **Delete** | remove records permanently — **off until you turn it on** |

Nothing runs without its permission, every step is shown before it runs, and
everything it does is written to the assistant history.

---

## 5. Backups — three layers

1. **Google Drive** (Settings → Cloud): the automatic one. Do this first.
2. **Export everything (with files)** (Settings → Backup): one JSON file that
   holds the whole workspace *and the bytes of every file in the vault*. Import it
   on any computer with **Restore** and you are exactly where you left off.
3. **Export workspace**: the same without file bytes — small and quick to email
   to yourself.

Do one of them every week. The shield icon in the header is the quick export.

---

## 6. Keyboard

| Key | Action |
|---|---|
| `/` or `Ctrl+K` | Focus the global search (businesses, projects, files, clients, invoices) |
| `Alt + 1…9` | Jump between screens |
| `Alt + S` | Settings |
| `Alt + D` | Dark / light mode |
| `F1` | The in-app guide |
| `Esc` | Close any panel or drawer |

---

## 7. Working on the code

```bash
npm start        # serve the folder on http://localhost:8099
npm test         # the full smoke suite (50+ checks, no browser needed)
npm run css      # rebuild Tailwind after adding new utility classes
npm run build    # repack triverse-os.html (the single portable file)
npm run diagnose # ask the live Google API what it will and will not return
```

Structure: `assets/js/core.js` is the runtime (storage, UI partials, router),
`vault.js` is the encryption and sign-in, `files.js` the file store,
`cloud.js` Google Drive, `samples.js` the sample library and its analyser,
`sitegen.js` the generator that clones a sample, `ai.js` Gemini,
`agent.js` the permissioned assistant, `data.js` every dictionary and the
first-run content, `providers.js` all Google Maps access, and `views.*.js` one
file per screen. `sample.html` is the original design reference.

```bash
npm run check-samples   # clone every sample for a business of its category
```

---

## 8. Keeping it healthy for years

- Keep the Google Cloud project's billing linked; that is what unlocks review
  text and photos from the Places API.
- Keep the daily Google searches inside the allowance by re-using saved searches
  — they are free.
- Keep the passphrase somewhere you will still have it in two years, and the
  recovery code somewhere else.
- Nothing here expires, needs a subscription, or depends on a server of ours.

---

## 9. Your social profiles

Settings → **Social & business profiles** holds every place the studio can be found —
website, portfolio, Telegram channel and group, WhatsApp, Instagram, Facebook, TikTok,
LinkedIn, Upwork, Fiverr, Afriwork and GitHub. Type a full link or just the handle. The
small round links appear at the bottom of the sidebar as soon as a field has a value, and a
blank field stays hidden — nothing needs switching on.

---

## 10. The sample designs

The nine designs in `assets/js/samples.real.js` are your own uploads, **used exactly as you
wrote them**. When a client comes, the generator changes only the information inside a
design — the name, phone, address, map, socials, opening hours and copy. It never redraws,
restyles or re-creates a layout.

```bash
npm run measure-samples    # what each uploaded design needs from disk
npm run import-samples     # rebuild the designs from .sample-preview/
npm run optimize-samples   # shrink the carried photos to web size
npm run check-samples      # clone one design per category and verify it
```

`samples/assets/<id>/` holds each design's own pictures and fonts, copied out so the clones
keep their real images. `.sample-preview/` — the uploaded library — stays out of the
repository, which is why the repo is small enough to push.
