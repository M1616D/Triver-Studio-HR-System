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

## 1b. The sign-in page (first thing you see)

Every new device lands on the **sign-in page** written for the studio: the brand
and the studio's own social links on the left, one panel on the right.

- **Continue with Google Drive** — signs in with the Google account that owns the
  client ID, then pulls the workspace back out of the studio's `Triverse OS`
  folder. On a new computer this is the whole setup: one press and every client,
  website, file and invoice is there.
- **Continue on this device** — opens the copy kept in this browser.
- **Open a backup file** — restores from an exported JSON backup instead.

If you protected the workspace with a passphrase, the passphrase screen is the
sign-in page for this device, and it comes straight after (or instead).

The choice lasts 14 days on that browser. **Settings → This device** shows how
the session opened, where the data is kept, and has **Show the sign-in page** and
**Sign out of this device**. Signing out deletes nothing.

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

### The design library (how a website gets built)

**The app ships no designs at all.** The library is exactly what you upload, so
a layout you made can never be quietly rewritten. A business is matched to one
of your uploaded designs for its category, and **only the information changes**
— name, phone, address, map, socials, hours, prices, photos, reviews. The
layout, spacing, colours, animations and wording style stay untouched.

*Sidebar → Samples* opens the library.

**To upload a design:**

1. Press **Choose a folder** (best) or **Choose one file**. You can also drag a
   folder from your desktop straight onto the drop zone.
2. A folder is read as it is: the page, its CSS, its JavaScript and its own
   pictures are folded into one working design, and every other page in the
   folder is kept alongside. Nothing is redrawn.
3. The **scanner report** appears immediately — what it found in the design:
   text blocks, photos, phone, email, map, address, social links, page blocks,
   live fields and the colours and fonts it uses, with a confidence score.
4. Name it, pick its category, save. From then on every business of that
   category is built from that exact design.

Each card has **Preview** (the design with an example business poured in),
**copy** (fork it as a starting point), the scanner report, **rename** and
**remove**. **Which design for which type** prints the full business-type →
design table.

If the library is empty, the website builder simply uses its own generated
template instead — nothing breaks, and it tells you a design is missing.

### The assistant (Gemini) — permissions first
Settings → AI holds the key; **Detect models** reads the live model list from
your own key, so a retired model name can never break the AI again — if a name
dies mid-task the app switches and retries by itself.

*Sidebar → Assistant* is the page where you hand the AI its work: type the job,
press **Give it the job**, and it plans first, shows every step as it runs and
writes the whole run to the history. The same panel opens from the *Assistant*
button in the header. Permissions work without a key, so you can set them up now:

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

## 10. Uploading your designs

There is no design library inside the app any more — no design is shipped, and
none can be modified behind your back. You upload each design once from the
**Samples** page, either as one `.html` file or as a whole folder, and from then
on it is cloned for every matching client with **only the information changed**.

Where a design lives:

- your uploaded designs are stored in the workspace (`samples.items`), which
  means they travel with the app backup and to the **Google Drive** copy, so
  signing in on another computer brings them along;
- `sample.html` in the project root is your original reference design;
- `.sample-preview/` is the raw uploaded library on your disk. It is **not**
  part of the repository — that is what keeps the repo small enough to push.

Useful commands while developing:

```bash
npm test                   # 44 checks incl. cloning a design for every category
npm run build               # repack triverse-os.html (single offline file)
npm run css                 # rebuild the compiled Tailwind utilities
npm start                   # serve on http://localhost:8099
```
