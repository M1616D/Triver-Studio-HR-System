/* =============================================================================
   Triverse OS — Settings
   Company profile, discovery/API, outreach rules, the cold-message library,
   sending integrations, backup/restore and the operating manual.
   ========================================================================== */
(function (global) {
  'use strict';

  const App = global.App;
  const U = App.util;
  const ui = App.ui;

  const VARIABLES = ['business', 'category', 'city', 'rating', 'reviews', 'website', 'phone', 'whatsapp', 'sender', 'sender_role', 'company', 'portfolio', 'hook', 'offer', 'price', 'delivery', 'invoice', 'due', 'signature'];

  function tplState() {
    App.router.q.tplEdit = App.router.q.tplEdit || { id: (App.msg.templates()[0] || {}).id || '' };
    return App.router.q.tplEdit;
  }

  /** the template preview uses one of your own discovered businesses — never a fake one */
  function sampleLead() {
    return App.store.get('leads', [])[0] || {
      id: '', name: 'Business name', businessType: 'general', category: 'Local business', city: App.store.get('settings.google.city', 'Addis Ababa'),
      address: 'Addis Ababa, Ethiopia', phone: '', intlPhone: '', whatsapp: false,
      telegram: '', email: '', rating: 0, reviews: 0, hours: '', outreach: []
    };
  }

  function tabState() {
    App.router.q.settings = App.router.q.settings || { tab: 'company' };
    return App.router.q.settings;
  }

  function companyCard() {
    const co = App.store.get('settings.company', {});
    return ui.card(
      ui.head('Company profile',
        '<button class="btn btn-lime btn-sm" data-action="settings.save"><i class="fa-solid fa-floppy-disk"></i> Save</button>',
        'Used in messages, invoices, proposals and generated websites') +
      '<div class="grid grid-cols-1 md:grid-cols-3 gap-3">' +
      ui.field({ label: 'Company name', model: 'settings.company.name', value: co.name }) +
      ui.field({ label: 'Short name', model: 'settings.company.shortName', value: co.shortName }) +
      ui.field({ label: 'Tagline', model: 'settings.company.tagline', value: co.tagline }) +
      ui.field({ label: 'Your name (sender)', model: 'settings.company.senderName', value: co.senderName }) +
      ui.field({ label: 'Your role', model: 'settings.company.senderRole', value: co.senderRole }) +
      ui.field({ label: 'Phone', model: 'settings.company.phone', value: co.phone }) +
      ui.field({ label: 'WhatsApp number', model: 'settings.company.whatsapp', value: co.whatsapp, hint: 'Include the country code — used for links and signatures' }) +
      ui.field({ label: 'Telegram', model: 'settings.company.telegram', value: co.telegram }) +
      ui.field({ label: 'Email', model: 'settings.company.email', value: co.email }) +
      ui.field({ label: 'Website', model: 'settings.company.website', value: co.website }) +
      ui.field({ label: 'Portfolio / samples link', model: 'settings.company.portfolio', value: co.portfolio, hint: 'Sent in every cold message' }) +
      ui.field({ label: 'Address', model: 'settings.company.address', value: co.address }) +
      ui.field({ label: 'Working hours', model: 'settings.company.workingHours', value: co.workingHours }) +
      ui.field({ label: 'Currency', model: 'settings.company.currency', value: co.currency, options: App.dict.currencies.map(c => [c[0], c[0] + ' (' + c[1] + ')']) }) +
      ui.field({ label: 'Default country code', model: 'settings.company.defaultCountryCode', value: co.defaultCountryCode, hint: 'Added to local numbers such as 01711… when building WhatsApp links' }) +
      '</div>', 'mb-4');
  }

  /* Every profile the studio owns in one place. Fill a box and the link goes
     live across the app; leave it blank and it stays hidden. */
  function socialsCard() {
    const co = App.store.get('settings.company', {});
    const soc = co.socials || {};
    const rows = App.dict.socials.map(s => {
      const raw = s.key === 'website' ? co.website : s.key === 'portfolio' ? co.portfolio : soc[s.key];
      const href = s.url(raw || '');
      const dot = href
        ? '<a href="' + U.esc(href) + '" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" title="Open ' + s.label + '"><i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i></a>'
        : '<span class="text-[10px] text-textMuted px-2">not set</span>';
      const model = s.key === 'website' ? 'settings.company.website'
        : s.key === 'portfolio' ? 'settings.company.portfolio'
        : 'settings.company.socials.' + s.key;
      return ui.field({
        label: s.label, model: model, value: raw || '',
        hint: href ? href : 'Paste a full link, or just the handle',
        action: dot
      });
    }).join('');
    return ui.card(
      ui.head('Social & business profiles',
        '<button class="btn btn-lime btn-sm" data-action="settings.save"><i class="fa-solid fa-floppy-disk"></i> Save</button>',
        'Your public presence — shown on the company card and offered to clients') +
      '<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">' + rows + '</div>', 'mb-4');
  }

  function discoveryCard() {
    const g = App.store.get('settings.google', {});
    const keySet = !!g.apiKey;
    return ui.card(
      ui.head('Google Maps & discovery',
        '<div class="btn-row">' +
        '<button class="btn btn-lime btn-sm" data-action="settings.checkSources"><i class="fa-solid fa-plug-circle-check"></i> Check connections</button>' +
        '</div>',
        'Every business, review, phone number and photo in this system comes from the Google Maps record itself.') +
      '<div id="source-check" class="mb-3">' +
      '<div class="glass-soft p-3 text-[11px] text-textMuted flex items-center gap-2 flex-wrap">' +
      ui.icon('fa-circle-info', 'text-accentMint') +      '<span class="flex-1 min-w-[240px]">API key ' + (keySet ? 'saved' : '<b>not</b> saved') +
        '. <b>Check connections</b> tests the search, the full record, the pin map and the reviews.</span>' +
      '<span class="w-full">' + U.esc(googleUsageLine()) + '</span></div></div>' +
      '<div class="grid grid-cols-1 md:grid-cols-3 gap-3">' +
      ui.field({ label: 'Google Places API key', model: 'settings.google.apiKey', value: g.apiKey, type: 'password', hint: 'Google Cloud → APIs & Services → Library → enable “Places API (New)” → Credentials → copy the key' }) +
      ui.field({ label: 'Default city / area', model: 'settings.google.city', value: g.city, hint: 'Addis Ababa today — change it and the area picker follows' }) +
      ui.field({ label: 'Region code', model: 'settings.google.region', value: g.region, hint: 'Two letters only — et, ke, ae, us … A country name is refused by Google' }) +
      ui.field({ label: 'Search radius (km)', model: 'settings.google.radiusKm', value: g.radiusKm, type: 'number' }) +
      ui.field({ label: 'Results per search', model: 'settings.google.pageSize', value: g.pageSize, type: 'number', hint: 'Max 20 per request (Google limit) — “Load 20 more” fetches the next page' }) +
      ui.field({ label: 'Language of Google results', model: 'settings.google.language', value: g.language || 'en', options: [['en', 'English'], ['am', 'Amharic']] }) +
      ui.field({ label: 'Centre latitude', model: 'settings.google.centerLat', value: g.centerLat }) +
      ui.field({ label: 'Centre longitude', model: 'settings.google.centerLng', value: g.centerLng }) +
      '</div>' +
      '<div class="glass-soft p-3 mt-3 text-[10px] text-textMuted space-y-1">' +
      '<p><b class="text-gray-300">“API not enabled”?</b> Press the Enable link in the check result — that is the only reason a working key returns nothing.</p>' +
      '<p><b class="text-gray-300">No Google access?</b> Discover → <b>Import CSV / JSON</b> takes an export from any scraper. Everything downstream works the same.</p>' +
      '<p><b class="text-gray-300">Areas:</b> ' + U.esc(App.dict.areas.map(a => a[1]).join(' · ')) + '</p>' +
      '</div>', 'mb-4');
  }

  function aiCard() {
    const a = App.store.get('settings.ai', {});
    const list = Array.isArray(a.modelList) ? a.modelList : [];
    const cur = String(a.model || 'gemini-3.6-flash');
    const opts = (list.length ? list : [cur]).map(n => [n, n + (n === cur ? ' — in use' : '')]);
    return ui.card(
      ui.head('AI (Gemini)',
        '<div class="btn-row">' +
        '<button class="btn btn-ghost btn-sm" data-action="settings.aiModels"><i class="fa-solid fa-list"></i> Detect models</button>' +
        '<button class="btn btn-lime btn-sm" data-action="settings.aiTest"><i class="fa-solid fa-plug-circle-check"></i> Test AI</button>' +
        '<button class="btn btn-ghost btn-sm" data-action="ai.openAssistant"><i class="fa-solid fa-wand-magic-sparkles"></i> Assistant</button>' +
        '</div>',
        'Reads each business\u2019s own Google record and writes the brief, the first message and the website copy.') +
      '<div id="ai-check" class="mb-3">' +
      (a.geminiKey
        ? '<div class="glass-soft p-3 text-[11px] text-textMuted">Key saved' +
          (a.lastCheck ? ' · last test ' + U.esc(U.relTime(a.lastCheck)) + ' · ' + U.esc(a.lastCheckText || (a.lastCheckState === 'ok' ? 'working' : 'failed')) : '') +
          '. Model: <b class="text-gray-300">' + U.esc(cur) + '</b>. Press <b>Test AI</b> to confirm.</div>'
        : '<div class="glass-soft p-3 text-[11px] text-textMuted">No key yet — get one free at <a class="link" target="_blank" rel="noopener" href="https://aistudio.google.com/apikey">aistudio.google.com/apikey</a>, paste it below and press <b>Test AI</b>.</div>') +
      '</div>' +
      '<div class="grid grid-cols-1 md:grid-cols-3 gap-3">' +
      ui.field({ label: 'Gemini API key', model: 'settings.ai.geminiKey', value: a.geminiKey, type: 'password', hint: 'Kept in this browser only' }) +
      ui.field({ label: 'Model', model: 'settings.ai.model', value: cur, options: opts, hint: list.length ? 'List read live from your key' : 'Press Detect models to read the live list' }) +
      ui.field({ label: 'Use AI for', model: 'settings.ai.useForSites', value: a.useForSites, type: 'checkbox', checkLabel: 'Website copy' }) +
      '</div>' +
      '<p class="text-[10px] text-textMuted mt-3">The live model list is read from your key; if a name dies mid-task the app switches and retries on its own.</p>',
      'mb-4');
  }

  function outreachCard() {
    const o = App.store.get('settings.outreach', {});
    return ui.card(
      ui.head('Outreach rules', ui.badge('automation', 'lime'), 'How the system behaves between messages') +
      '<div class="grid grid-cols-1 md:grid-cols-3 gap-3">' +
      ui.field({ label: 'Follow-up after no reply (days)', model: 'settings.outreach.followUpDays', value: o.followUpDays, type: 'number' }) +
      ui.field({ label: 'Second follow-up (days)', model: 'settings.outreach.secondFollowUpDays', value: o.secondFollowUpDays, type: 'number' }) +
      ui.field({ label: 'Daily send limit', model: 'settings.outreach.dailySendLimit', value: o.dailySendLimit, type: 'number', hint: 'WhatsApp blocks numbers that blast hundreds of messages' }) +
      ui.field({ label: 'Auto-read replies', model: 'settings.outreach.autoClassify', value: o.autoClassify, type: 'checkbox', checkLabel: 'Detect positive / negative replies automatically' }) +
      ui.field({ label: 'Auto-skip negatives', model: 'settings.outreach.autoAdvanceOnNegative', value: o.autoAdvanceOnNegative, type: 'checkbox', checkLabel: 'Jump to the next business after a negative answer' }) +
      '</div>' +
      ui.field({ label: 'Signature appended to messages', model: 'settings.outreach.signature', value: o.signature, rows: 3, hint: 'Variables allowed: {{sender}}, {{company}}, {{phone}}, {{portfolio}}', wrapCls: 'mt-3' }),
      'mb-4');
  }

  function messagesCard() {
    const st = tplState();
    const templates = App.store.get('messages.templates', []);
    const tpl = App.store.find('messages.templates', st.id) || templates[0] || {};
    const preview = tpl && tpl.body ? App.msg.render(tpl, sampleLead()) : { body: '', subject: '' };
    const lead = sampleLead();

    const chips = templates.map(x =>
      '<button class="chip ' + (x.id === tpl.id ? 'is-on' : '') + '" data-action="tplmsg.select" data-arg="' + x.id + '">' +
      App.dict.chanIcon(x.channel, 'text-[9px]') + ' ' + U.esc(x.name) + (x.active === false ? ' (off)' : '') + '</button>').join('');

    const editor = '<div>' +
      '<div class="grid grid-cols-1 md:grid-cols-2 gap-3">' +
      ui.field({ label: 'Name', model: 'ui.msg.name', value: tpl.name }) +
      ui.field({ label: 'Channel', model: 'ui.msg.channel', value: tpl.channel, options: App.dict.channels.map(c => [c[0], c[1]]) }) +
      ui.field({ label: 'Stage', model: 'ui.msg.stage', value: tpl.stage, options: [['first', 'First touch'], ['followup', 'Follow-up'], ['proposal', 'Proposal / price'], ['won', 'Welcome / onboarding'], ['payment', 'Payment reminder']] }) +
      ui.field({ label: 'Active', model: 'ui.msg.active', value: tpl.active !== false, type: 'checkbox', checkLabel: 'Available in the composer' }) +
      '</div>' +
      (tpl.channel === 'email' ? ui.field({ label: 'Subject', model: 'ui.msg.subject', value: tpl.subject || '', wrapCls: 'mt-2' }) : '') +
      ui.field({ label: 'Message body', model: 'ui.msg.body', value: tpl.body, rows: 12, wrapCls: 'mt-2' }) +
      '<p class="lbl mt-2">Insert a variable</p>' +
      '<div class="flex flex-wrap gap-1">' + VARIABLES.map(v =>
        '<button class="chip" data-action="tplmsg.insert" data-arg="' + v + '">{{' + v + '}}</button>').join('') + '</div>' +
      '<div class="btn-row mt-3">' +
      '<button class="btn btn-lime btn-sm" data-action="tplmsg.save" data-arg="' + tpl.id + '"><i class="fa-solid fa-floppy-disk"></i> Save message</button>' +
      '<button class="btn btn-ghost btn-sm" data-action="tplmsg.duplicate" data-arg="' + tpl.id + '"><i class="fa-solid fa-copy"></i> Duplicate</button>' +
      '<button class="btn btn-danger btn-sm" data-action="tplmsg.delete" data-arg="' + tpl.id + '">Delete</button>' +
      '</div></div>';

    const previewBox = ui.card(
      ui.head('Preview', ui.badge(tpl.channel || '', 'lime'), 'Filled with a real business from your list') +
      (preview.subject ? '<p class="text-[11px] font-semibold mb-1">Subject: ' + U.esc(preview.subject) + '</p>' : '') +
      '<p class="text-[10px] text-gray-300 whitespace-pre-line bg-field border border-line rounded-lg p-2.5">' + U.esc(preview.body) + '</p>' +
      '<p class="text-[9px] text-textMuted mt-2">Sent to: ' + U.esc(lead.name) + ' · ' + U.esc(lead.phone || '') + '</p>');

    return ui.card(
      ui.head('Cold-message library',
        '<button class="btn btn-ghost btn-sm" data-action="tplmsg.new"><i class="fa-solid fa-plus"></i> New message</button>',
        'These are the messages the system personalises with each business\'s Google data') +
      '<div class="flex flex-wrap gap-1.5 mb-3">' + chips + '</div>' +
      '<div class="two-col">' + editor + previewBox + '</div>', 'mb-4');
  }

  function integrationCard() {
    const integ = App.store.get('settings.integration', {});
    return ui.card(
      ui.head('Sending integration (optional)',
        '<button class="btn btn-ghost btn-sm" data-action="settings.testSender"><i class="fa-solid fa-satellite-dish"></i> Test sender</button>',
        'Without this, sending opens WhatsApp / Telegram with the message ready. With it, messages are posted automatically and replies can arrive through your webhook.') +
      '<div class="grid grid-cols-1 md:grid-cols-2 gap-3">' +
      ui.field({ label: 'Auto-send through API', model: 'settings.integration.autoSendEnabled', value: integ.autoSendEnabled, type: 'checkbox', checkLabel: 'Post messages automatically instead of opening the chat' }) +
      ui.field({ label: 'Sender webhook URL', model: 'settings.integration.webhookUrl', value: integ.webhookUrl, placeholder: 'https://your-server/send', hint: 'Receives {channel, to, message, leadId} as JSON' }) +
      ui.field({ label: 'Webhook token', model: 'settings.integration.webhookToken', value: integ.webhookToken, type: 'password' }) +
      ui.field({ label: 'WhatsApp Cloud API token', model: 'settings.integration.whatsappCloudToken', value: integ.whatsappCloudToken, type: 'password' }) +
      ui.field({ label: 'WhatsApp phone number ID', model: 'settings.integration.whatsappPhoneId', value: integ.whatsappPhoneId }) +
      '</div>' +
      '<div class="glass-soft rounded-xl p-3 mt-3 text-[10px] text-textMuted">' +
      'Meta\'s WhatsApp Cloud API needs a server so your token never sits in a browser. Point the webhook above at that small server, tick auto-send, and the rest of this system behaves exactly the same.' +
      '</div>', 'mb-4');
  }

  function dataCard() {
    const size = App.store.sizeKB();
    const meta = App.store.get('meta', {});
    return ui.card(
      ui.head('Data, backup & privacy',
        '<div class="btn-row">' +
        '<button class="btn btn-ghost btn-sm" data-action="data.export"><i class="fa-solid fa-download"></i> Export workspace</button>' +
        '<button class="btn btn-lime btn-sm" data-action="data.exportFull"><i class="fa-solid fa-box-archive"></i> Export everything (with files)</button>' +
        '<button class="btn btn-danger btn-sm" data-action="settings.reset"><i class="fa-solid fa-trash"></i> Reset system</button>' +
        '</div>',
        'The workspace file holds every record; the “everything” file also carries the bytes of every file in the vault, so one download is a complete, restorable copy.') +
      '<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">' +
      ui.kv('Workspace size', size + ' KB' + (App.store.protectedByVault() ? ' (stored encrypted)' : '')) +
      ui.kv('Records', App.store.get('leads', []).length + ' businesses · ' + App.store.get('clients', []).length + ' clients · ' + App.store.get('sites', []).length + ' projects · ' + App.store.get('documents', []).length + ' files · ' + App.store.get('payments', []).length + ' invoices') +
      ui.kv('Last backup', meta.lastBackup ? U.relTime(meta.lastBackup) : 'never — do it now') +
      ui.kv('Saved Google searches', App.providers.cacheCount() + ' in your own copy') +
      ui.kv('File storage', App.files.backend() === 'indexedDB' ? 'browser database (no practical limit)' : 'device storage, limited — connect Drive') +
      ui.kv('Off-device copy', App.cloud.status().lastSync ? 'Drive, ' + U.relTime(App.cloud.status().lastSync) : 'none yet') +
      '</div>' +
      (App.providers.cacheCount()
        ? '<div class="btn-row mb-3"><button class="btn btn-ghost btn-sm" data-action="google.clearCache"><i class="fa-solid fa-eraser"></i> Forget the ' + App.providers.cacheCount() + ' saved searches</button></div>'
        : '') +
      '<div class="flex flex-wrap items-end gap-2">' +
      '<div class="flex-1 min-w-[240px]"><label class="lbl">Restore from a backup file</label><input type="file" id="backup-file" accept=".json" class="inp" /></div>' +
      '<button class="btn btn-ghost" data-action="data.importFile"><i class="fa-solid fa-upload"></i> Restore</button>' +
      '<button class="btn btn-ghost" data-action="pay.export"><i class="fa-solid fa-file-csv"></i> Export invoices (CSV)</button>' +
      '</div>', 'mb-4');
  }

  /* ------------------------------ branding --------------------------------- */
  function brandingCard() {
    const co = App.store.get('settings.company', {});
    const logo = App.brand.logo();
    return ui.card(
      ui.head('Studio identity',
        '<div class="btn-row">' +
        (logo ? '<button class="btn btn-ghost btn-sm" data-action="brand.remove"><i class="fa-solid fa-trash"></i> Remove logo</button>' : '') +
        '<button class="btn btn-lime btn-sm" data-action="brand.pickLogo"><i class="fa-solid fa-image"></i> ' + (logo ? 'Replace logo' : 'Upload logo') + '</button>' +
        '</div>',
        'The mark is cropped to a circle and used across the whole system, including the sign-in screen') +
      '<div class="flex items-center gap-4 mb-4">' +
      '<span class="brand-circle brand-circle--sm" style="width:64px;height:64px">' +
      (logo ? '<img class="brand-circle__img" src="' + U.attr(logo) + '" alt="Studio logo" />' : U.esc(App.brand.initials())) + '</span>' +
      '<div class="text-[10px] text-textMuted leading-relaxed">' +
      'PNG, JPG, SVG or WebP · up to 8 MB · kept square and trimmed automatically.<br>' +
      'A square image with a transparent background looks best inside the circle.</div>' +
      '</div>' +
      '<input type="file" id="logo-file" accept="image/*" class="hidden" />' +
      '<div class="grid grid-cols-1 md:grid-cols-2 gap-3">' +
      ui.field({ label: 'Legal / full name', model: 'settings.company.name', value: co.name }) +
      ui.field({ label: 'Short name (shown in the sidebar)', model: 'settings.company.shortName', value: co.shortName }) +
      ui.field({ label: 'Tagline', model: 'settings.company.tagline', value: co.tagline }) +
      ui.field({ label: 'Registration number', model: 'settings.company.registrationNo', value: co.registrationNo }) +
      ui.field({ label: 'TIN', model: 'settings.company.tin', value: co.tin }) +
      ui.field({ label: 'Founded', model: 'settings.company.foundedYear', value: co.foundedYear, placeholder: '2019' }) +
      ui.field({ label: 'Bank', model: 'settings.company.bankName', value: co.bankName }) +
      ui.field({ label: 'Account number', model: 'settings.company.bankAccount', value: co.bankAccount }) +
      ui.field({ label: 'Telebirr / mobile money number', model: 'settings.company.telebirrNo', value: co.telebirrNo }) +
      ui.field({ label: 'Invoice prefix', model: 'settings.company.invoicePrefix', value: co.invoicePrefix }) +
      '</div>', 'mb-4');
  }

  /* ------------------------------ security --------------------------------- */
  function securityCard() {
    const s = App.vault.summary();
    const sec = App.store.get('settings.security', {});
    const tone = s.protected ? (s.unlocked ? 'lime' : 'amber') : 'red';
    const label = s.protected ? (s.unlocked ? 'Encrypted and unlocked' : 'Encrypted and locked') : 'Not protected';
    return ui.card(
      ui.head('Security',
        '<span class="tone tone-' + tone + ' text-[10px] px-2.5 py-1 rounded-full border">' + U.esc(label) + '</span>',
        'The workspace is encrypted on this device with AES-256-GCM, keyed from your passphrase') +
      '<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">' +
      ui.kv('Protection', s.protected ? 'AES-256-GCM, PBKDF2-SHA256 · 310,000 rounds' : 'none — the workspace is readable in this browser') +
      ui.kv('Key held', s.unlocked ? 'in memory for this session only' : 'nowhere — the vault is locked') +
      ui.kv('Auto-lock', s.autoLockMinutes ? 'after ' + s.autoLockMinutes + ' minutes idle' : 'off') +
      ui.kv('Encrypted file', s.lastSaved ? 'saved ' + U.relTime(s.lastSaved) + ' · ' + U.bytes(s.bytes) : '—') +
      ui.kv('Created', s.createdAt ? U.fmtDate(s.createdAt) : '—') +
      ui.kv('Hint on screen', s.hint || '—') +
      '</div>' +
      '<div class="flex flex-wrap items-end gap-2 mb-3">' +
      '<div class="w-[190px]"><label class="lbl">Lock after idle</label>' +
      '<select class="inp" data-model="settings.security.autoLockMinutes" data-change-action="vault.setAutoLock">' +
      [0, 5, 15, 30, 60, 120].map(m => '<option value="' + m + '"' + (Number(sec.autoLockMinutes) === m ? ' selected' : '') + '>' + (m ? m + ' minutes' : 'Never (not recommended)') + '</option>').join('') +
      '</select></div>' +
      '<div class="btn-row">' +
      (s.protected
        ? '<button class="btn btn-ghost" data-action="vault.lock"><i class="fa-solid fa-lock"></i> Lock now</button>' +
          '<button class="btn btn-ghost" data-action="vault.changePass"><i class="fa-solid fa-key"></i> Change passphrase</button>' +
          '<button class="btn btn-ghost" data-action="vault.newRecovery"><i class="fa-solid fa-rotate"></i> New recovery code</button>' +
          '<button class="btn btn-danger" data-action="vault.removeLock"><i class="fa-solid fa-lock-open"></i> Remove protection</button>'
        : '<button class="btn btn-lime" data-action="vault.setup"><i class="fa-solid fa-shield-halved"></i> Protect this workspace</button>') +
      '</div></div>' +
      '<div class="glass-soft rounded-xl p-3 text-[10px] text-textMuted leading-relaxed">' +
      (availableText() ||
        'Your records are sealed with a key derived from your passphrase, so the browser stores ciphertext, not client and invoice data. ' +
        'The key lives in memory for the session only. There is no reset link: the recovery code shown once is the only way back in.') +
      '</div>', 'mb-4');
  }

  /* ------------------------------- the session ------------------------------ */
  function accountCard() {
    const signedIn = App.auth && App.auth.signedIn();
    const mode = (App.auth && App.auth.mode()) || '';
    const account = (App.auth && App.auth.account()) || '';
    const where = mode === 'google' ? 'Signed in with Google' + (account ? ' · ' + account : '')
      : mode === 'passphrase' ? 'Unlocked with the workspace passphrase'
        : 'Opened on this device';
    return ui.card(
      ui.head('This device',
        '<span class="tone tone-' + (signedIn ? 'lime' : 'amber') + ' text-[10px] px-2.5 py-1 rounded-full border">' +
        (signedIn ? 'signed in' : 'sign-in page') + '</span>',
        'One workspace, many devices — signing out never deletes anything') +
      '<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">' +
      ui.kv('How this session opened', U.esc(where)) +
      ui.kv('Signed in since', App.auth && App.auth.signedInAt() ? U.relTime(App.auth.signedInAt()) : '—') +
      ui.kv('Where your data lives', App.cloud.configured() ? 'this device and your Google Drive' : 'this device only — connect Drive above') +
      '</div>' +
      '<div class="btn-row">' +
      '<button class="btn btn-ghost" data-action="auth.signIn"><i class="fa-solid fa-arrow-right-to-bracket"></i> Show the sign-in page</button>' +
      '<button class="btn btn-ghost" data-action="auth.signOut"><i class="fa-solid fa-arrow-right-from-bracket"></i> Sign out of this device</button>' +
      '</div>' +
      '<p class="text-[10px] text-textMuted mt-3 leading-relaxed">Signing out stops this browser from opening the workspace on its own. ' +
      'Your records stay exactly where they are, and the passphrase or the Google sign-in brings it all back.</p>', 'mb-4');
  }

  function availableText() {
    if (App.vault.available()) return '';
    return 'This browser is blocking the encryption tools (Web Crypto). Open the app over http://localhost — run “npm start” in the project folder — and protection will work normally.';
  }

  /* -------------------------------- cloud ---------------------------------- */
  function cloudCard() {
    const st = App.cloud.status();
    const unsynced = App.cloud.unsynced ? App.cloud.unsynced().length : 0;
    const vaultFiles = App.files.all().length;
    const tone = st.authorized ? 'lime' : (st.hasClientId ? 'amber' : 'muted');
    const label = st.authorized ? 'Connected' + (st.account ? ' · ' + st.account : '') : (st.hasClientId ? 'Client ID saved, not signed in' : 'Not set up');
    return ui.card(
      ui.head('Cloud — Google Drive',
        '<span class="tone tone-' + tone + ' text-[10px] px-2.5 py-1 rounded-full border">' + U.esc(label) + '</span>',
        'Your own Google account is the off-device store: open the system anywhere and pull everything back') +
      (st.http ? '' : '<div class="glass-soft rounded-xl p-3 mb-3 text-[11px] flex items-start gap-2.5 tone tone-amber border">' +
        ui.icon('fa-triangle-exclamation', 'mt-0.5') +
        '<div><p class="font-semibold">Google sign-in needs a web address</p>' +
        '<p class="text-textMuted">This page was opened from the file system (' + U.esc(st.origin) + '), and Google refuses to sign in to such a page. ' +
        'Run <b class="text-ink">npm start</b> in the project folder and open <b class="text-ink">http://localhost:8099</b> — same data, same files, and the connection works.</p></div></div>') +
      '<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">' +
      ui.kv('Signed in', st.authorized ? (st.account || 'yes') : 'no') +
      ui.kv('Last backup', st.lastSync ? U.relTime(st.lastSync) : 'never') +
      ui.kv('Last restore', st.lastPull ? U.relTime(st.lastPull) : 'never') +
      ui.kv('Vault files', vaultFiles ? vaultFiles + ' stored · ' + unsynced + ' not in Drive yet' : 'none yet') +
      ui.kv('Automatic backup', st.auto ? 'on — after changes, at most every few minutes' : 'off') +
      ui.kv('Folder', '“' + App.cloud.FOLDER_NAME + '” in your Drive') +
      '</div>' +
      (st.lastError ? '<p class="text-[10px] text-red-300 mb-2">' + U.esc(st.lastError) + '</p>' : '') +
      '<div class="flex flex-wrap items-end gap-2 mb-3">' +
      '<div class="flex-1 min-w-[260px]"><label class="lbl">Google OAuth Client ID</label>' +
      '<input class="inp" data-model="settings.cloud.clientId" value="' + U.attr(st.clientId) + '" placeholder="1234567890-abcdef.apps.googleusercontent.com" /></div>' +
      '<div class="btn-row">' +
      (st.authorized
        ? '<button class="btn btn-lime" data-action="cloud.backup"><i class="fa-solid fa-cloud-arrow-up"></i> Back up now</button>' +
          '<button class="btn btn-ghost" data-action="cloud.restore"><i class="fa-solid fa-cloud-arrow-down"></i> Pull the newest copy</button>' +
          '<button class="btn btn-ghost" data-action="cloud.syncFiles"><i class="fa-solid fa-box-archive"></i> Copy ' + (unsynced || 'all') + ' file' + (unsynced === 1 ? '' : 's') + ' to Drive</button>' +
          '<button class="btn btn-ghost" data-action="cloud.openFolder"><i class="fa-solid fa-folder-open"></i> Open the folder</button>' +
          '<button class="btn btn-danger" data-action="cloud.disconnect"><i class="fa-solid fa-link-slash"></i> Sign out</button>'
        : '<button class="btn btn-lime" data-action="cloud.connect"><i class="fa-brands fa-google-drive"></i> Connect Google Drive</button>') +
      '</div></div>' +
      '<label class="flex items-center gap-2 text-[11px] text-gray-300 cursor-pointer mb-3">' +
      '<input type="checkbox" data-model="settings.cloud.auto" data-change-action="cloud.toggleAuto"' + (st.auto ? ' checked' : '') + ' class="w-3.5 h-3.5" />' +
      'Back the workspace up automatically after changes</label>' +
      cloudHelp() , 'mb-4');
  }

  function cloudHelp() {
    return '<details class="glass-soft rounded-xl p-3 text-[10px] text-textMuted leading-relaxed">' +
      '<summary class="cursor-pointer text-[11px] text-ink font-semibold">How to create the Client ID (one time, 4 minutes)</summary>' +
      '<ol class="mt-2 space-y-1.5 list-decimal pl-4">' +
      '<li>Open <b class="text-ink">console.cloud.google.com</b> and pick (or create) a project.</li>' +
      '<li><b class="text-ink">APIs &amp; Services → Library</b> → enable <b class="text-ink">Google Drive API</b>.</li>' +
      '<li><b class="text-ink">APIs &amp; Services → OAuth consent screen</b> → External → add your own Gmail as a test user.</li>' +
      '<li><b class="text-ink">Credentials → Create credentials → OAuth client ID → Web application</b>.</li>' +
      '<li>Under <b class="text-ink">Authorised JavaScript origins</b> add the address you open this system on — for example <b class="text-ink">' + U.esc(location.origin) + '</b>.</li>' +
      '<li>Copy the Client ID (it ends in <span class="mono">.apps.googleusercontent.com</span>) into the field above and press Connect.</li>' +
      '</ol>' +
      '<p class="mt-2">The app asks only for the <span class="mono">drive.file</span> permission, which means it can see and manage the files it created — nothing else in your Drive. ' +
      'Nothing is sent anywhere except your own account, and there is no server of ours in the middle.</p>' +
      '</details>';
  }

  function helpCard() {
    const steps = [
      ['1. Discover', 'Type a business type, pick an Addis Ababa area, press Enter. Filter by “no website” first — those are your best prospects.'],
      ['2. Deep info', 'Tap a business for everything the map knows — phone, WhatsApp, Telegram, area, hours, coordinates — plus the offer we recommend and its price.'],
      ['3. Try this', 'Generate their website right away. A live-looking demo converts far better than a price list.'],
      ['4. Send', 'The message uses their real name, rating and review count. One tap opens WhatsApp with the text ready.'],
      ['5. Triage replies', 'Positive → hot list and a proposal. Negative → rejected list, and the next business loads automatically.'],
      ['6. Close & deliver', 'Convert to a client, raise the invoice, register the website and set the renewal date.'],
      ['7. Repeat daily', 'The dashboard shows follow-ups due, replies to triage, money to collect and renewals.']
    ];
    return ui.card(
      ui.head('How this system works', ui.badge('manual', 'muted'), 'The daily loop that keeps the pipeline full') +
      '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' +
      '<div class="space-y-2 text-[11px] text-gray-300">' +
      steps.map(s => '<div><b class="text-white">' + s[0] + '</b><br>' + U.esc(s[1]) + '</div>').join('') +
      '</div>' +
      '<div class="space-y-1 text-[11px] text-gray-300">' +
      '<div class="pb-1"><b class="text-white">Keyboard</b></div>' +
      ui.kv('/ or Ctrl+K', 'Focus the global search') +
      ui.kv('Alt + 1…9', 'Jump between screens') +
      ui.kv('Alt + S', 'Settings') +
      ui.kv('Alt + D', 'Dark / light mode') +
      ui.kv('F1', 'Open the full guide') +
      ui.kv('Enter', 'Run the search box you are in (↑ ↓ picks a suggestion)') +
      ui.kv('Esc', 'Close any panel or drawer') +
      '<div class="pt-3 pb-1"><b class="text-white">Running it for years</b></div>' +
      '<ul class="space-y-1">' +
      '<li>Export a backup (shield icon in the header) every week and keep it in cloud storage.</li>' +
      '<li>No build tools, no server and no database to maintain — the whole app is static files you can host anywhere or run from a folder.</li>' +
      '<li>Keep the daily send under the limit in Outreach rules — that protects your WhatsApp number.</li>' +
      '<li>Renewal dates on websites and retainers feed the renewal reminders on the dashboard.</li>' +
      '</ul>' +
      '<p class="text-[10px] text-textMuted pt-2">Version ' + App.version + ' · schema ' + App.SCHEMA + ' · built for Triverse Studio Software Solution</p>' +
      '</div></div>');
  }

  App.views = App.views || {};
  App.views.settings = {
    title: 'Settings',
    sub: 'Company identity, security, cloud, discovery, outreach and backup',
    icon: 'fa-gear',
    render(el) {
      const co = App.store.get('settings.company', {});
      const tab = tabState().tab;

      /* one strip that says what is and is not wired up, then the sections */
      const hero = ui.hero([
        { label: 'Studio', valueHtml: U.esc(co.shortName || co.name || 'Not named yet'),
          sub: co.tagline || 'add a name and tagline in Company' },
        { label: 'Google Maps', value: App.store.get('settings.google.apiKey') ? 'Connected' : 'Not set',
          tone: App.store.get('settings.google.apiKey') ? 'blue' : 'amber',
          sub: App.store.get('settings.google.apiKey')
            ? 'searching ' + (App.store.get('settings.google.city', 'Addis Ababa') || 'Addis Ababa')
            : 'paste the key to search real listings',
          cta: 'Maps settings', icon: 'fa-map-location-dot', action: 'settings.tab', arg: 'google' },
        { label: 'Drive', value: App.cloud && App.cloud.isConnected() ? 'Connected' : 'Off',
          tone: App.cloud && App.cloud.isConnected() ? 'lime' : 'amber',
          sub: App.cloud && App.cloud.isConnected() ? (App.store.get('settings.cloud.account', '') || 'workspace in your Drive') : 'sign in to sync every device',
          cta: 'Cloud settings', icon: 'fa-cloud', action: 'settings.tab', arg: 'cloud' },
        { label: 'AI', value: App.ai && App.ai.ready() ? 'Ready' : 'No key',
          tone: App.ai && App.ai.ready() ? 'violet' : 'amber',
          sub: App.ai && App.ai.ready() ? (App.ai.model() || 'picking a live model') : 'add the Gemini key to draft sites and replies',
          cta: 'AI settings', icon: 'fa-wand-magic-sparkles', action: 'settings.tab', arg: 'ai' }
      ]);

      const GROUPS = [
        ['company', 'Company', 'fa-building'], ['identity', 'Identity', 'fa-palette'],
        ['security', 'Security', 'fa-shield-halved'], ['cloud', 'Cloud & backup', 'fa-cloud'],
        ['google', 'Google Maps', 'fa-map-location-dot'], ['ai', 'AI', 'fa-wand-magic-sparkles'],
        ['outreach', 'Outreach', 'fa-paper-plane'], ['integrations', 'Integrations', 'fa-plug'],
        ['guide', 'Guide', 'fa-book']
      ];
      const rail = '<nav class="set-rail">' + GROUPS.map(g =>
        '<button class="set-rail__item' + (tab === g[0] ? ' is-on' : '') + '" data-action="settings.tab" data-arg="' + g[0] + '">' +
        ui.icon(g[2]) + '<span>' + U.esc(g[1]) + '</span></button>').join('') + '</nav>';

      const BODY = {
        company: companyCard() + socialsCard(),
        identity: brandingCard(),
        security: securityCard() + accountCard(),
        cloud: cloudCard() + dataCard(),
        google: discoveryCard(),
        ai: aiCard(),
        outreach: outreachCard() + messagesCard(),
        integrations: integrationCard(),
        guide: helpCard()
      };

      el.innerHTML =
        hero +
        '<div class="set-shell mt-4">' + rail + '<div class="set-pane">' + (BODY[tab] || BODY.company) + '</div></div>';
    }
  };

  /* ------------------------------ message actions --------------------------- */
  App.action('tplmsg.select', el => { tplState().id = el.getAttribute('data-arg'); App.emit('state:changed', { path: 'tplmsg' }); });
  App.action('tplmsg.insert', el => {
    const box = document.querySelector('[data-model="ui.msg.body"]');
    if (!box) return;
    const token = '{{' + el.getAttribute('data-arg') + '}}';
    const start = box.selectionStart || box.value.length;
    box.value = box.value.slice(0, start) + token + box.value.slice(box.selectionEnd || start);
    box.focus();
    box.selectionStart = box.selectionEnd = start + token.length;
    App.store.set('ui.msg.body', box.value, { silent: true });
  });
  App.action('tplmsg.save', el => {
    const id = el.getAttribute('data-arg');
    const data = {
      name: App.store.get('ui.msg.name', ''), channel: App.store.get('ui.msg.channel', 'whatsapp'),
      stage: App.store.get('ui.msg.stage', 'first'), subject: App.store.get('ui.msg.subject', ''),
      body: App.store.get('ui.msg.body', ''), active: Boolean(App.store.get('ui.msg.active', true))
    };
    if (!data.body) { ui.toast('The message body is empty', 'amber'); return; }
    if (id) App.store.patch('messages.templates', id, data);
    else { const rec = App.store.add('messages.templates', data); tplState().id = rec.id; }
    ui.toast('Message saved', 'lime');
    App.emit('state:changed', { path: 'tplmsg' });
  });
  App.action('tplmsg.new', () => {
    const rec = App.store.add('messages.templates', {
      name: 'New message', channel: 'whatsapp', stage: 'first', subject: '', active: true,
      body: 'Selam {{business}},\n\nI am {{sender}} from {{company}}. We build {{hook}} for {{category}} businesses in {{city}}.\n\n\n\n{{signature}}'
    });
    tplState().id = rec.id;
    ui.toast('New message created — edit and save', 'lime');
    App.emit('state:changed', { path: 'tplmsg' });
  });
  App.action('tplmsg.duplicate', el => {
    const t = App.store.find('messages.templates', el.getAttribute('data-arg'));
    const copy = App.store.add('messages.templates', {
      name: t.name + ' (copy)', channel: t.channel, stage: t.stage, subject: t.subject || '',
      body: t.body, active: true, designedFor: (t.designedFor || []).slice()
    });
    tplState().id = copy.id;
    ui.toast('Duplicated', 'lime');
    App.emit('state:changed', { path: 'tplmsg' });
  });
  App.action('tplmsg.delete', el => {
    const id = el.getAttribute('data-arg');
    if (App.store.get('messages.templates', []).length <= 1) { ui.toast('Keep at least one message', 'amber'); return; }
    ui.confirm({
      title: 'Delete this message?', tone: 'danger', confirmLabel: 'Delete',
      message: 'Messages already sent to businesses stay in their history.',
      onConfirm() {
        App.store.remove('messages.templates', id);
        tplState().id = (App.msg.templates()[0] || {}).id || '';
        App.emit('state:changed', { path: 'tplmsg' });
      }
    });
  });

  /** how much of Google’s daily allowance this project has already used today */
  function googleUsageLine() {
    const u = App.store.get('google.usage', null);
    const today = u && u.day === U.todayISO() ? u : null;
    const wall = App.providers.quotaBlocked && App.providers.quotaBlocked();
    if (wall) return App.providers.quotaNote();
    if (!today) return 'Google searches used today: none yet.';
    return 'Google searches used today: ' + (today.searches || 0) + ' search' + ((today.searches || 0) === 1 ? '' : 'es') +
      ' and ' + (today.records || 0) + ' full business record' + ((today.records || 0) === 1 ? '' : 's') + ' read.';
  }

  /* ------------------------- connection diagnostics ------------------------- */
  App.action('settings.checkSources', () => {
    const box = document.getElementById('source-check');
    if (!box) return;
    const key = App.store.get('settings.google.apiKey', '');
    const rows = [];
    /* keep the machine-readable part of a Google error but make its links clickable */
    const linkify = (text) => U.esc(text).replace(/(https?:\/\/[^\s<)]+)/g,
      '<a class="link" href="$1" target="_blank" rel="noopener">$1</a>');
    const paint = () => {
      box.innerHTML = rows.map(r =>
        '<div class="glass-soft p-3 mb-2 flex items-start gap-3">' +
        '<span class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 ' +
        (r.state === 'ok' ? 'bg-accentMint text-bgMain' : r.state === 'bad' ? 'tone tone-red' : r.state === 'warn' ? 'tone tone-amber' : 'tone tone-muted') + '">' +
        '<i class="fa-solid ' + (r.state === 'ok' ? 'fa-check' : r.state === 'bad' ? 'fa-triangle-exclamation' : r.state === 'warn' ? 'fa-circle-info' : r.state === 'run' ? 'fa-spinner fa-spin' : 'fa-hourglass-half') + '"></i></span>' +
        '<div class="min-w-0"><p class="text-[12px] font-semibold text-white">' + U.esc(r.name) + '</p>' +
        '<p class="text-[11px] text-textMuted whitespace-pre-line">' + linkify(r.text) + '</p></div></div>').join('');
    };
    const withTimeout = (p, ms, label) => Promise.race([
      p, new Promise((_, rej) => setTimeout(() => rej(new Error(label + ' did not answer within ' + Math.round(ms / 1000) + ' seconds.')), ms))
    ]);

    const searchRow = { name: '1 · Places API — business search', state: 'run', text: 'Asking Google for cafés in Addis Ababa…' };
    const detailRow = { name: '2 · Places API — the full business record', state: 'idle', text: 'Starts when the search returns a business: this is the call that brings opening hours, phone, website and the business\u2019s own details.' };
    const atmoRow = { name: '4 · Reviews & photos (Enterprise “Atmosphere” data)', state: 'idle', text: 'Starts after the record is read.' };
    const mapRow = { name: '3 · Maps JavaScript API — the interactive pin map', state: 'run', text: 'Loading the map library…' };
    rows.push(searchRow, detailRow, mapRow, atmoRow);
    paint();

    if (!key) {
      searchRow.state = 'bad';
      searchRow.text = 'No Places API key is saved. Paste your key above and press Check connections again.';
      detailRow.text = 'Skipped — there is no key to test with.';
      mapRow.state = 'bad';
      mapRow.text = 'Skipped — there is no key to test with.';
      atmoRow.text = 'Skipped — there is no key to test with.';
      paint();
      return;
    }

    withTimeout(App.providers.google({ typeKey: 'cafe', city: 'Addis Ababa', pageSize: 3 }), 20000, 'Google')
      .then(r => {
        searchRow.state = r.leads.length ? 'ok' : 'bad';
        searchRow.text = r.leads.length
          ? 'Working — ' + r.leads.length + ' real businesses came back with name, rating, review count, phone and website.'
          : 'Google answered, but no business matched that search in this area.';
        paint();
        const withId = r.leads.filter(l => l.placeId)[0];
        if (!withId) { detailRow.state = 'bad'; detailRow.text = 'No place ID came back, so the deep record cannot be read.'; paint(); return; }
        detailRow.state = 'run';
        detailRow.text = 'Reading the full record of “' + withId.name + '”…';
        paint();
        return withTimeout(App.providers.details(withId.placeId, { apply: false }), 20000, 'Place Details').then(d => {
          detailRow.state = 'ok';
          detailRow.text = 'Working — ' + (d.hoursWeek.length ? d.hoursWeek.length + ' days of opening hours' : 'no hours listed') +
            ', phone ' + (d.nationalPhone || 'none') + ', website ' + (d.website ? 'yes' : 'none') +
            ', category ' + (d.categoryLabel || '—') +
            '. This is exactly what the deep-info panel shows when you tap a business.';
          /* Google can serve the record yet withhold its Atmosphere data — say so
             in plain words instead of leaving the reviews section empty forever */
          if (d.atmosphere) {
            atmoRow.state = 'ok';
            atmoRow.text = 'Working — ' + d.reviewsList.length + ' real reviews and ' + d.photos.length + ' photos came back for “' + withId.name + '”.';
          } else if (d.atmosphereBlocked) {
            atmoRow.state = 'warn';
            atmoRow.text = App.providers.atmosphereHelp(withId) +
              '\n\nhttps://console.cloud.google.com/billing/linkedaccount';
          } else {
            atmoRow.state = 'warn';
            atmoRow.text = 'Google returned no reviews and no photos for “' + withId.name + '”. It may genuinely have none yet — tap another business to be sure.';
          }
          paint();
        });
      })
      .catch(e => {
        searchRow.state = 'bad';
        searchRow.text = e.message;
        detailRow.state = 'idle';
        detailRow.text = 'Could not run — the search has to succeed first.';
        atmoRow.text = 'Could not run — the search has to succeed first.';
        paint();
      });

    loadMapsJs(key).then(() => {
      mapRow.state = 'ok';
      mapRow.text = 'Working — the pin map inside Discover uses this library.';
      paint();
    }).catch(e => {
      mapRow.state = 'bad';
      mapRow.text = e.message + '\nThe app keeps the Google embed map on screen meanwhile — to get clickable pins, enable “Maps JavaScript API” in the same project.';
      paint();
    });
  });

  /** does the Maps JavaScript API answer for this key? */
  function loadMapsJs(key) {
    if (window.google && window.google.maps) return Promise.resolve(true);
    return new Promise((resolve, reject) => {
      let done = false;
      const cb = '__triSettingsMaps';
      window[cb] = () => { done = true; resolve(true); };
      const s = document.createElement('script');
      s.async = true;
      s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(key) + '&loading=async&callback=' + cb;
      s.onerror = () => { if (!done) reject(new Error('The map script could not be loaded — the key may block this referrer.')); };
      setTimeout(() => { if (!done) reject(new Error('The map library did not answer within 12 seconds.')); }, 12000);
      document.head.appendChild(s);
    });
  }

  /* ==========================================================================
     Studio identity — the logo
     ========================================================================== */
  App.action('brand.pickLogo', () => {
    let input = document.getElementById('logo-file');
    if (!input) {
      input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*'; input.id = 'logo-file';
      input.className = 'hidden';
      document.body.appendChild(input);
    }
    input.onchange = async () => {
      if (!input.files || !input.files[0]) return;
      try {
        const dataUrl = await App.brand.fromFile(input.files[0], 512);
        App.store.set('settings.company.logo', dataUrl, { silent: true });
        App.store.save(true);
        App.log('brand', 'Studio logo updated', '');
        ui.toast('Logo updated — it is now the round mark everywhere in the system', 'lime');
        App.refresh();
      } catch (e) { ui.toast(e.message, 'red'); }
      input.value = '';
    };
    input.click();
  });

  App.action('brand.remove', () => {
    ui.confirm({
      title: 'Remove the logo?', tone: 'danger', confirmLabel: 'Remove it',
      message: 'The round mark goes back to the studio initials. Nothing else changes.',
      onConfirm() {
        App.store.set('settings.company.logo', '', { silent: true });
        App.store.save(true);
        ui.closeModal();
        ui.toast('Logo removed', 'amber');
        App.refresh();
      }
    });
  });

  /* ==========================================================================
     Security
     ========================================================================== */
  App.action('vault.setAutoLock', el => {
    const minutes = Number(el.value) || 0;
    App.store.set('settings.security.autoLockMinutes', minutes, { silent: true });
    App.store.save();
    if (App.vault.has()) App.vault.setAutoLock(minutes);
    ui.toast(minutes ? 'The workspace will lock after ' + minutes + ' minutes idle' : 'Automatic lock is off — the workspace stays open until you close the tab', minutes ? 'lime' : 'amber');
  });

  App.action('vault.changePass', () => {
    ui.modal({
      title: 'Change the passphrase',
      sub: 'The recovery code stays valid',
      size: 'sm',
      body: ui.field({ label: 'Current passphrase', model: 'ui.vault.old', value: '', type: 'password' }) +
        ui.field({ label: 'New passphrase (10 characters or more)', model: 'ui.vault.new', value: '', type: 'password', wrapCls: 'mt-3' }) +
        ui.field({ label: 'Repeat the new passphrase', model: 'ui.vault.new2', value: '', type: 'password', wrapCls: 'mt-3' }),
      footer: '<button class="btn btn-ghost" data-action="close-modal">Cancel</button>' +
        '<button class="btn btn-lime" data-action="vault.savePass">Change it</button>'
    });
  });

  App.action('vault.savePass', async () => {
    const g = k => App.store.get('ui.vault.' + k, '');
    if (g('new').length < 10) { ui.toast('The new passphrase needs at least 10 characters', 'amber'); return; }
    if (g('new') !== g('new2')) { ui.toast('The two new passphrases do not match', 'amber'); return; }
    try {
      await App.vault.changePass(g('old'), g('new'));
      App.store.set('ui.vault.old', '', { silent: true });
      App.store.set('ui.vault.new', '', { silent: true });
      App.store.set('ui.vault.new2', '', { silent: true });
      ui.closeModal();
      ui.toast('Passphrase changed — use the new one next time', 'lime');
      App.log('security', 'Workspace passphrase changed', '');
      App.refresh();
    } catch (e) { ui.toast(e.message, 'red'); }
  });

  App.action('vault.newRecovery', () => {
    ui.modal({
      title: 'Issue a new recovery code',
      sub: 'The previous code stops working immediately',
      size: 'sm',
      body: ui.field({ label: 'Confirm with your passphrase', model: 'ui.vault.confirm', value: '', type: 'password' }) +
        '<p class="text-[10px] text-textMuted mt-2">A new 24-character code will be shown once. Write it down before you close the window.</p>',
      footer: '<button class="btn btn-ghost" data-action="close-modal">Cancel</button>' +
        '<button class="btn btn-lime" data-action="vault.makeRecovery">Issue a new code</button>'
    });
  });

  App.action('vault.makeRecovery', async () => {
    try {
      const code = await App.vault.rotateRecovery(App.store.get('ui.vault.confirm', ''));
      ui.closeModal();
      App.vault.screen({ mode: 'code', code: code, onSubmit: () => { App.refresh(); } });
      App.log('security', 'New recovery code issued', '');
    } catch (e) { ui.toast(e.message, 'red'); }
  });

  App.action('vault.removeLock', () => {
    ui.modal({
      title: 'Remove encryption?',
      sub: 'This is a real downgrade — read this before continuing',
      size: 'sm',
      body: '<p class="text-[11px] text-gray-300 leading-relaxed">The workspace will be written back to this browser as ordinary, unreadable-to-nobody-but-visible-to-anyone-here JSON. ' +
        'Anyone who uses this computer profile will be able to read your clients, invoices and notes.</p>' +
        ui.field({ label: 'Confirm with your passphrase', model: 'ui.vault.confirm', value: '', type: 'password', wrapCls: 'mt-3' }),
      footer: '<button class="btn btn-ghost" data-action="close-modal">Keep it protected</button>' +
        '<button class="btn btn-danger" data-action="vault.doRemove">Remove protection</button>'
    });
  });

  App.action('vault.doRemove', async () => {
    try {
      await App.vault.remove(App.store.get('ui.vault.confirm', ''));
      App.store.set('ui.vault.confirm', '', { silent: true });
      App.store.set('settings.security.requireLogin', false, { silent: true });
      App.store.save(true);
      ui.closeModal();
      ui.toast('Protection removed — the workspace is stored as plain text on this device again', 'amber');
      App.log('security', 'Workspace encryption removed', '');
      App.refresh();
    } catch (e) { ui.toast(e.message, 'red'); }
  });

  /* ==========================================================================
     Cloud — Google Drive
     ========================================================================== */
  App.action('cloud.connect', async () => {
    ui.toast('Opening Google sign-in…', 'blue');
    try {
      await App.cloud.connect();
      ui.toast('Google Drive connected', 'lime');
      App.refresh();
    } catch (e) { ui.toast(String(e.message).split('\n')[0], 'red'); }
  });

  App.action('cloud.disconnect', () => {
    App.cloud.disconnect();
    ui.toast('Signed out of Google Drive', 'amber');
    App.refresh();
  });

  App.action('cloud.backup', async () => {
    ui.toast('Uploading the workspace…', 'blue');
    try {
      const out = await App.cloud.backupNow('manual');
      ui.toast('Backed up — ' + U.bytes(out.bytes) + ' in your Drive', 'lime');
      App.refresh();
    } catch (e) { ui.toast(String(e.message).split('\n')[0], 'red'); }
  });

  App.action('cloud.syncNow', async () => {
    if (!App.cloud.configured()) {
      ui.toast('Connect Google Drive in Settings → Cloud first', 'amber');
      App.router.go('settings');
      return;
    }
    try {
      const out = await App.cloud.backupNow('manual');
      ui.toast('Workspace backed up (' + U.bytes(out.bytes) + ')', 'lime');
      App.refresh();
    } catch (e) { ui.toast(String(e.message).split('\n')[0], 'red'); }
  });

  App.action('cloud.restore', () => {
    ui.confirm({
      title: 'Pull the newest copy from Drive?',
      tone: 'danger',
      confirmLabel: 'Pull it down',
      message: 'Whatever is in Drive replaces what is on this device. Export a backup of this device first if you are not sure which copy is newer.',
      onConfirm: async () => {
        ui.closeModal();
        ui.toast('Downloading from Drive…', 'blue');
        try {
          const out = await App.cloud.restoreLatest();
          ui.toast('Restored the copy saved ' + U.fmtDateTime(out.modifiedTime) + ' — reloading', 'lime');
          setTimeout(() => App.softReload(), 500);
        } catch (e) { ui.toast(String(e.message).split('\n')[0], 'red'); }
      }
    });
  });

  App.action('cloud.syncFiles', async () => {
    const rows = App.cloud.unsynced();
    if (!rows.length) { ui.toast('Every vault file already has a copy in Drive', 'muted'); return; }
    ui.toast('Copying ' + rows.length + ' file' + (rows.length === 1 ? '' : 's') + ' to Drive…', 'blue');
    try {
      const out = await App.cloud.syncAllFiles((done, total) => {
        if (done % 5 === 0 || done === total) ui.toast('Copied ' + done + ' of ' + total + ' files', 'blue');
      });
      ui.toast(out.done + ' file' + (out.done === 1 ? '' : 's') + ' copied' + (out.failed.length ? ' · ' + out.failed.length + ' failed' : ''), out.failed.length ? 'amber' : 'lime');
      App.refresh();
    } catch (e) { ui.toast(String(e.message).split('\n')[0], 'red'); }
  });

  App.action('cloud.openFolder', async () => {
    try { await App.cloud.openFolder(); }
    catch (e) { ui.toast(String(e.message).split('\n')[0], 'red'); }
  });

  App.action('cloud.toggleAuto', el => {
    App.store.set('settings.cloud.auto', Boolean(el.checked), { silent: true });
    App.store.save();
    ui.toast(el.checked ? 'Automatic backup is on' : 'Automatic backup is off', el.checked ? 'lime' : 'muted');
  });

  /* -------------------- saved Google searches (allowance saver) -------------- */
  App.action('google.clearCache', () => {
    const n = App.providers.cacheCount();
    ui.confirm({
      title: 'Forget saved searches?', tone: 'danger', confirmLabel: 'Clear ' + n + ' saved searches',
      message: 'Those searches would then have to be fetched from Google again, using the daily allowance. The businesses already in your list are not touched.',
      onConfirm() {
        App.providers.cacheClear();
        ui.closeModal();
        ui.toast('Saved searches cleared', 'amber');
        App.refresh();
      }
    });
  });

  /* moving between settings sections is page state, never a change to the URL */
  App.action('settings.tab', el => {
    tabState().tab = el.getAttribute('data-arg') || 'company';
    const s = document.getElementById('scroll-area');
    if (s) s.scrollTo({ top: 0, behavior: 'smooth' });
    App.emit('state:changed', { path: 'settings' });
  });
})(window);
