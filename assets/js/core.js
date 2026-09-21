/* =============================================================================
   Triverse OS — core runtime
   Storage, state, events, UI partials, modals/drawers, router, utilities.
   Plain browser script: no build step, works from file:// or any static host.
   ========================================================================== */
(function (global) {
  'use strict';

  const App = global.App = global.App || {};
  App.version = '2.0.0';
  App.STORE_KEY = 'triverse.os.state.v1';
  App.HTML_KEY = 'triverse.os.html.';
  App.ARCHIVE_KEY = 'triverse.os.archive.v1';
  /* schema 2 = Google Maps only, no bundled sample businesses. An older install is
     archived and cleared on first open so no invented business can ever show up. */
  App.SCHEMA = 2;
  /* bump this whenever the published price list changes: it is what lets the
     new figures reach a workspace that already saved a catalogue */
  App.PRICING_VERSION = 3;

  /** true when a string carries a pictograph that should not be in business copy */
  const PICTO_TEST = v => {
    const txt = String(v == null ? '' : v);
    for (let i = 0; i < txt.length; i++) if (txt.charCodeAt(i) >= 0x2700) return true;
    return false;
  };

  /* ------------------------------- utilities ------------------------------ */
  const U = App.util = {
    uid(prefix) { return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); },
    esc(v) {
      return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    /** escape a value for use inside an HTML attribute */
    attr(v) {
      return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); },
    now() { return new Date().toISOString(); },
    todayISO() { return new Date().toISOString().slice(0, 10); },
    addDays(iso, n) { const d = iso ? new Date(iso) : new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); },
    digits(v) { return String(v == null ? '' : v).replace(/[^\d]/g, ''); },
    slug(v) { return String(v == null ? '' : v).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); },
    title(v) { return String(v == null ? '' : v).replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); },
    hit(hay, needle) {
      const h = String(hay == null ? '' : hay).toLowerCase(), n = String(needle || '').toLowerCase().trim();
      return !n || h.indexOf(n) !== -1;
    },
    num(n) { return (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 }); },
    /** 1.4 MB — never “1441792 bytes” */
    bytes(n) {
      const v = Number(n) || 0;
      if (v < 1024) return v + ' B';
      if (v < 1048576) return (v / 1024).toFixed(v < 10240 ? 1 : 0) + ' KB';
      if (v < 1073741824) return (v / 1048576).toFixed(1) + ' MB';
      return (v / 1073741824).toFixed(2) + ' GB';
    },
    fileKind(name, mime) {
      const ext = String(name || '').split('.').pop().toLowerCase();
      const map = {
        html: 'Markup', htm: 'Markup', css: 'Stylesheet', scss: 'Stylesheet', less: 'Stylesheet',
        js: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript', jsx: 'React', ts: 'TypeScript', tsx: 'TypeScript',
        json: 'JSON', php: 'PHP', py: 'Python', rb: 'Ruby', java: 'Java', kt: 'Kotlin', cs: 'C#',
        go: 'Go', rs: 'Rust', c: 'C', h: 'C header', cpp: 'C++', swift: 'Swift', sql: 'SQL', sh: 'Shell',
        md: 'Markdown', txt: 'Text', csv: 'CSV', xlsx: 'Spreadsheet', xls: 'Spreadsheet', doc: 'Document', docx: 'Document',
        pdf: 'PDF', zip: 'Archive', rar: 'Archive', '7z': 'Archive', tar: 'Archive', gz: 'Archive',
        png: 'Image', jpg: 'Image', jpeg: 'Image', gif: 'Image', webp: 'Image', svg: 'Vector', ico: 'Icon',
        mp4: 'Video', mov: 'Video', webm: 'Video', mp3: 'Audio', wav: 'Audio',
        ttf: 'Font', otf: 'Font', woff: 'Font', woff2: 'Font',
        psd: 'Photoshop', ai: 'Illustrator', xd: 'XD', fig: 'Figma', env: 'Config', yml: 'Config', yaml: 'Config', toml: 'Config', ini: 'Config'
      };
      return map[ext] || (String(mime || '').split('/')[0] === 'image' ? 'Image' : (ext ? ext.toUpperCase() + ' file' : 'File'));
    },
    money(n, cur) {
      const c = cur || (App.store.state && App.store.state.settings.company.currency) || 'USD';
      const v = Number(n) || 0;
      const sym = (App.dict.currencies.find(x => x[0] === c) || [])[1] || '';
      return sym ? sym + ' ' + v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : c + ' ' + v.toLocaleString(undefined, { maximumFractionDigits: 2 });
    },
    pct(part, total) { return total ? Math.round((part / total) * 100) : 0; },
    sum(arr, fn) { return (arr || []).reduce((a, b) => a + (Number(fn ? fn(b) : b) || 0), 0); },
    avg(arr, fn) { return arr && arr.length ? U.sum(arr, fn) / arr.length : 0; },
    uniq(arr) { return Array.from(new Set(arr || [])); },
    clamp(n, min, max) { return Math.max(min, Math.min(max, n)); },
    groupBy(arr, fn) { const out = {}; (arr || []).forEach(x => { const k = fn(x); (out[k] = out[k] || []).push(x); }); return out; },
    sortBy(arr, fn, dir) { const d = dir === 'desc' ? -1 : 1; return (arr || []).slice().sort((a, b) => { const x = fn(a), y = fn(b); return x > y ? d : x < y ? -d : 0; }); },
    fmtDate(iso) {
      if (!iso) return '—';
      const d = new Date(iso); if (isNaN(d)) return String(iso);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    },
    fmtDateTime(iso) {
      if (!iso) return '—';
      const d = new Date(iso); if (isNaN(d)) return String(iso);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' · ' +
        d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    },
    monthKey(iso) { return String(iso || '').slice(0, 7); },
    monthLabel(key) {
      const [y, m] = String(key).split('-');
      const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return (names[Number(m) - 1] || '?') + ' ' + String(y).slice(2);
    },
    daysUntil(iso) { if (!iso) return null; return Math.round((new Date(iso) - new Date(U.todayISO())) / 864e5); },
    relTime(iso) {
      if (!iso) return '—';
      const s = (Date.now() - new Date(iso).getTime()) / 1000;
      if (isNaN(s)) return '—';
      if (s < 60) return 'just now';
      if (s < 3600) return Math.floor(s / 60) + 'm ago';
      if (s < 86400) return Math.floor(s / 3600) + 'h ago';
      if (s < 2592000) return Math.floor(s / 86400) + 'd ago';
      return U.fmtDate(iso);
    },
    csv(text) {
      const rows = [];
      let row = [], cell = '', q = false;
      const s = String(text || '').replace(/\r\n?/g, '\n');
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (q) {
          if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
          else cell += c;
        } else if (c === '"') q = true;
        else if (c === ',' ) { row.push(cell); cell = ''; }
        else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
        else cell += c;
      }
      if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
      if (!rows.length) return [];
      const head = rows.shift().map(h => String(h).trim());
      return rows.filter(r => r.some(v => String(v).trim() !== '')).map(r => {
        const o = {}; head.forEach((h, i) => { o[h] = (r[i] == null ? '' : String(r[i]).trim()); }); return o;
      });
    },
    toCSV(rows, cols) {
      const heads = cols || (rows[0] ? Object.keys(rows[0]) : []);
      const line = a => a.map(v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',');
      return [line(heads)].concat(rows.map(r => line(heads.map(h => r[h])))).join('\n');
    },
    download(name, text, mime) {
      try {
        const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = name;
        document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
        return true;
      } catch (e) { App.ui.toast('Download failed: ' + e.message, 'red'); return false; }
    },
    openHTML(html, name) {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const w = global.open(url, '_blank');
      if (!w) App.ui.toast('Pop-up blocked — allow pop-ups to open the preview', 'amber');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return name;
    },
    copy(text) {
      const t = String(text == null ? '' : text);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(t).then(() => true).catch(() => U._copyFallback(t));
      }
      return Promise.resolve(U._copyFallback(t));
    },
    _copyFallback(t) {
      try {
        const ta = document.createElement('textarea');
        ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
        return true;
      } catch (e) { return false; }
    },
    debounce(fn, ms) { let t = null; return function () { const a = arguments, c = this; clearTimeout(t); t = setTimeout(() => fn.apply(c, a), ms || 200); }; },
    openUrl(url) { const w = global.open(url, '_blank'); if (!w) App.ui.toast('Pop-up blocked by the browser', 'amber'); },

    /** any phone format → digits only, ready for tel: / wa.me links */
    telDigits(v, country) {
      let d = String(v == null ? '' : v).replace(/[^\d+]/g, '');
      const plus = d.charAt(0) === '+';
      d = d.replace(/\D/g, '');
      if (!d) return '';
      if (!plus) {
        if (d.charAt(0) !== '0') d = (country || '251') + d;
        else d = (country || '251') + d.slice(1);
      }
      return d;
    },
    /** a lead's phone as a click-to-call link (empty when there is no number) */
    telHref(lead) {
      const d = U.telDigits((lead && (lead.intlPhone || lead.phone)) || '', (App.store.get('settings.company.defaultCountryCode', '+251') || '+251').replace(/\D/g, ''));
      return d ? 'tel:+' + d : '';
    }
  };

  /* -------------------------------- store --------------------------------- */
  const store = App.store = {
    state: null,
    _t: null,

    load() {
      const defaults = App.seed();
      /* An encrypted workspace cannot be read before the passphrase is entered,
         so boot stops at the lock screen instead of showing an empty system. */
      if (App.vault && App.vault.has()) {
        this.state = null;
        App.locked = true;
        return null;
      }
      let saved = null;
      try { const raw = localStorage.getItem(App.STORE_KEY); if (raw) saved = JSON.parse(raw); } catch (e) { saved = null; }
      if (this.isLegacy(saved)) saved = this.upgradeLegacy(saved);
      this.state = saved && typeof saved === 'object' ? this.migrate(defaults, saved) : defaults;
      this.state.schema = App.SCHEMA;
      this.state.meta = this.state.meta || {};
      this.state.meta.lastOpen = U.now();
      this.purgeLegacyRows();
      this.stripMessageEmoji();
      this.save(true);
      return this.state;
    },

    /**
     * Earlier versions of the message library used casual pictographs. Business
     * correspondence should read plainly, so they are removed once from whatever
     * is already stored — the owner's own wording is otherwise untouched.
     */
    stripMessageEmoji() {
      const s = this.state;
      if (!s || !s.messages || !s.meta || s.meta.emojiCleaned) return;
      /* the pictograph set, built from code points so the file itself stays ASCII */
      const picto = new RegExp(
        '[' + String.fromCharCode(0x2700, 0x2D, 0x27BF) + String.fromCharCode(0x2B00, 0x2D, 0x2BFF) + String.fromCharCode(0xFE0F) + ']' +
        '|' + String.fromCharCode(0xD83C, 0xDF00, 0x2D, 0xD83E, 0xDDFF) +
        '|' + String.fromCharCode(0xD83D, 0xDC00, 0x2D, 0xD83D, 0xDEFF), 'g');
      const clean = v => {
        const txt = String(v == null ? '' : v).split(picto).join('');
        return txt.split('\n').map(function (line) {
          let out = '';
          let prevSpace = false;
          for (let i = 0; i < line.length; i++) {
            const c = line.charAt(i);
            if (c === ' ') { if (prevSpace) continue; prevSpace = true; } else prevSpace = false;
            out += c;
          }
          while (out.charAt(out.length - 1) === ' ') out = out.slice(0, -1);
          return out;
        }).join('\n');
      };
      const list = s.messages.templates || [];
      list.forEach(function (t) {
        if (t && typeof t.body === 'string' && PICTO_TEST(t.body)) {
          t.body = clean(t.body);
          t.subject = clean(t.subject || '');
          t.editedForPlainText = true;
        }
      });
      s.meta.emojiCleaned = true;
    },

    /** take over a workspace that was just decrypted from the vault */
    adopt(saved) {
      const defaults = App.seed();
      this.state = this.migrate(defaults, saved && typeof saved === 'object' ? saved : {});
      this.state.schema = App.SCHEMA;
      this.state.meta = this.state.meta || {};
      this.state.meta.lastOpen = U.now();
      this.purgeLegacyRows();
      this.stripMessageEmoji();
      App.locked = false;
      this.save(true);
      return this.state;
    },

    /** true while the workspace is stored encrypted instead of as plain text */
    protectedByVault() { return Boolean(App.vault && App.vault.active()); },

    /** an install from before schema 2 carries businesses that were never real */
    isLegacy(saved) {
      if (!saved || typeof saved !== 'object') return false;
      if (Number(saved.schema || 1) < App.SCHEMA) return true;
      return false;
    },

    /**
     * Archive the old state, then forget every record that a previous version
     * seeded (businesses, clients, invoices, websites, activity log). Settings,
     * the price catalogue, templates and the message library are kept.
     */
    upgradeLegacy(saved) {
      try { localStorage.setItem(App.ARCHIVE_KEY, JSON.stringify({ savedAt: U.now(), state: saved })); } catch (e) {}
      const kept = U.clone(saved);
      const counts = {
        leads: (kept.leads || []).length, clients: (kept.clients || []).length,
        payments: (kept.payments || []).length, sites: (kept.sites || []).length
      };
      kept.leads = []; kept.clients = []; kept.payments = []; kept.sites = []; kept.activities = [];
      kept.counters = { invoice: 0 };
      kept.schema = App.SCHEMA;
      kept.meta = Object.assign({}, kept.meta || {}, {
        demoData: false, legacyPurged: true, legacyPurgedAt: U.now(), legacyCounts: counts
      });
      const total = counts.leads + counts.clients + counts.payments + counts.sites;
      App._legacyNotice = total;
      return kept;
    },

    /** belt and braces: never let a non-Google, non-imported row reach a screen */
    purgeLegacyRows() {
      const s = this.state;
      if (!s) return;
      const legacyPhone = v => /\+?880/.test(String(v || ''));
      const legacyText = v => /(dhaka|uttara|mirpur|dhanmondi|gulshan|banani|mohammadpur|bashundhara|tejgaon|motijheel|shyamoli|moghbazar|nilkhet|panthapath|bangladesh|bKash|Nagad)/i.test(String(v || ''));
      const bad = l => l && (l.source === 'demo' || legacyPhone(l.phone) || legacyPhone(l.intlPhone) || legacyText(l.address) || String(l.country || '') === 'Bangladesh');
      const leads = (s.leads || []).filter(l => !bad(l));
      if (leads.length !== (s.leads || []).length) s.leads = leads;
      const keepIds = {};
      leads.forEach(l => { keepIds[l.clientId] = 1; });
      const clients = (s.clients || []).filter(c => !bad({ phone: c.phone, address: c.address }) && !legacyText(c.name));
      if (clients.length !== (s.clients || []).length) {
        s.clients = clients;
        const ok = {}; clients.forEach(c => { ok[c.id] = 1; });
        s.payments = (s.payments || []).filter(p => ok[p.clientId] && String(p.currency || 'ETB') !== 'BDT');
        s.sites = (s.sites || []).filter(site => !site.clientId || ok[site.clientId]);
      }
    },

    /** defaults provide any missing keys; saved data always wins */
    migrate(defaults, saved) {
      const out = U.clone(defaults);
      const deep = (tgt, src) => {
        Object.keys(src || {}).forEach(k => {
          const sv = src[k];
          if (sv === undefined) return;
          if (Array.isArray(sv)) { tgt[k] = sv; return; }
          if (sv && typeof sv === 'object') {
            if (!tgt[k] || typeof tgt[k] !== 'object' || Array.isArray(tgt[k])) tgt[k] = {};
            deep(tgt[k], sv); return;
          }
          tgt[k] = sv;
        });
      };
      deep(out, saved);
      /* reply-sentiment vocabulary grows with app updates: union defaults with the
         saved list so existing installs keep learning new words without losing any */
      const dk = (defaults.messages || {}).keywords;
      const sk = (saved.messages || {}).keywords;
      if (out.messages && dk && sk) {
        const merged = {};
        Object.keys(dk).forEach(k => { merged[k] = U.uniq((dk[k] || []).concat(sk[k] || [])); });
        Object.keys(sk).forEach(k => { if (!merged[k]) merged[k] = U.uniq(sk[k] || []); });
        out.messages.keywords = merged;
      }

      /*
       * Catalogue refresh, in two parts.
       *
       * 1. Services the studio added by hand (ids that are not ours) are always
       *    kept exactly as they are.
       * 2. Our own published list is taken from the app when the price list
       *    version changes — that is how the 15,000 Birr website and the two QR
       *    menu tiers reach an install that already saved a catalogue. Between
       *    versions, the owner's own price edits are left alone.
       */
      const dcat = defaults.catalog || [];
      const scat = out.catalog;
      if (Array.isArray(scat) && dcat.length) {
        const byId = {};
        scat.forEach(s => { byId[s.id] = s; });
        const known = {};
        dcat.forEach(s => { known[s.id] = true; });
        /* read the version from what was SAVED, not from the merged copy — the
           merged copy already carries the new default and always looks current */
        const savedMeta = (saved && saved.meta) || {};
        const repriced = Number(savedMeta.pricingVersion || 0) !== Number(App.PRICING_VERSION || 1);
        out.catalog = dcat.map(s => (repriced ? s : Object.assign({}, s, byId[s.id] || {})))
          .concat(scat.filter(s => !known[s.id]));
        out.meta = out.meta || {};
        if (repriced) out.meta.pricingVersion = App.PRICING_VERSION;
      }

      /*
       * Blank-but-known settings are filled in. Only when they are empty, so a
       * value the owner typed is never replaced by a default.
       */
      const fill = (path, value) => {
        if (!value) return;
        const cur = path.split('.').reduce((a, k) => (a == null ? a : a[k]), out);
        if (cur === '' || cur === null || cur === undefined) {
          const parts = path.split('.');
          let node = out;
          for (let i = 0; i < parts.length - 1; i++) { if (!node[parts[i]]) node[parts[i]] = {}; node = node[parts[i]]; }
          node[parts[parts.length - 1]] = value;
        }
      };
      fill('settings.cloud.clientId', '440939143986-nefs0f1260tv58v1d8p6vtigphtpaoil.apps.googleusercontent.com');
      fill('settings.cloud.account', 'bereket1515mamuye@gmail.com');
      fill('settings.company.phone', '+251902468625');
      fill('settings.company.whatsapp', '+251902468625');
      fill('settings.company.email', 'bereket1515mamuye@gmail.com');
      fill('settings.company.website', 'https://m1616d.github.io/Triverse-Studio/');
      fill('settings.company.portfolio', 'https://m1616d.github.io/Triverse-Studio/');
      fill('settings.google.apiKey', 'AIzaSyD3es3VxVtt9ryJFWOENWpAkeWu61vxOXY');

      /* any payment still sitting in a currency we do not invoice in is gone */
      if (out.settings && out.settings.company) out.settings.company.currency = 'ETB';

      return out;
    },

    save(immediate) {
      const write = () => {
        /* with the vault on, nothing readable is ever written to disk: the state
           is sealed with the owner's key instead of sitting there as JSON */
        if (this.protectedByVault()) { App.vault.persist(this.state); return; }
        try {
          localStorage.setItem(App.STORE_KEY, JSON.stringify(this.state));
        } catch (e) {
          if (App.ui) App.ui.toast('Storage is full — export a backup and prune old records', 'red');
        }
      };
      if (immediate) {
        clearTimeout(this._t);
        write();
        if (this.protectedByVault()) App.vault.flush(this.state).catch(() => {});
        return;
      }
      clearTimeout(this._t); this._t = setTimeout(write, 250);
    },

    /* dotted-path helpers -------------------------------------------------- */
    get(path, fallback) {
      if (!this.state) return fallback;
      if (!path) return this.state;
      const parts = String(path).split('.');
      let cur = this.state;
      for (let i = 0; i < parts.length; i++) {
        if (cur == null) return fallback;
        cur = cur[parts[i]];
      }
      return cur === undefined ? fallback : cur;
    },
    set(path, value, opts) {
      const parts = String(path).split('.');
      let cur = this.state;
      for (let i = 0; i < parts.length - 1; i++) {
        if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = value;
      this.save();
      if (!opts || !opts.silent) App.emit('state:changed', { path: path });
      return value;
    },
    push(path, item) {
      const arr = this.get(path, []);
      arr.unshift(item);
      this.set(path, arr, { silent: true });
      App.emit('state:changed', { path: path });
      return item;
    },
    find(coll, id) { return (this.get(coll, []) || []).filter(x => x.id === id)[0] || null; },
    findBy(coll, pred) { return (this.get(coll, []) || []).filter(pred)[0] || null; },
    patch(coll, id, changes) {
      const arr = this.get(coll, []) || [];
      const i = arr.map(x => x.id).indexOf(id);
      if (i === -1) return null;
      arr[i] = Object.assign({}, arr[i], changes, { updatedAt: U.now() });
      this.set(coll, arr, { silent: true });
      App.emit('state:changed', { path: coll });
      return arr[i];
    },
    remove(coll, id) {
      const arr = (this.get(coll, []) || []).filter(x => x.id !== id);
      this.set(coll, arr, { silent: true });
      App.emit('state:changed', { path: coll });
    },
    add(coll, obj) {
      const item = Object.assign({ id: U.uid(coll.slice(0, 4)), createdAt: U.now(), updatedAt: U.now() }, obj);
      this.push(coll, item);
      return item;
    },

    /* generated site HTML lives outside the main blob (keeps state small) --- */
    html(id) { try { return localStorage.getItem(App.HTML_KEY + id) || ''; } catch (e) { return ''; } },
    setHTML(id, htmlBody) {
      try { localStorage.setItem(App.HTML_KEY + id, htmlBody); return true; }
      catch (e) { App.ui.toast('Site HTML too large for local storage — export it instead', 'amber'); return false; }
    },
    dropHTML(id) { try { localStorage.removeItem(App.HTML_KEY + id); } catch (e) {} },

    /* backup / restore ------------------------------------------------------ */
    export() {
      const payload = {
        app: 'triverse-os', version: App.version, schema: App.SCHEMA,
        exportedAt: U.now(), state: this.state, sites: {}
      };
      (this.state.sites || []).forEach(s => {
        const html = this.html(s.id);
        if (html) payload.sites[s.id] = html;
      });
      return JSON.stringify(payload, null, 2);
    },
    importJSON(text) {
      const data = JSON.parse(text);
      if (!data || !data.state) throw new Error('Not a Triverse OS backup file');
      this.state = this.migrate(App.seed(), data.state);
      this.save(true);
      Object.keys(data.sites || {}).forEach(id => this.setHTML(id, data.sites[id]));
      return true;
    },

    /* --------------------- full backup, file bytes included ---------------- */
    /**
     * Everything, including the actual bytes of every file in the vault, as one
     * portable JSON document. Downloads can be re-imported on any computer, so a
     * build folder is never trapped on one machine.
     */
    exportFull(onProgress) {
      const payload = JSON.parse(this.export());
      payload.withFiles = true;
      payload.files = {};
      const rows = U.clone(this.state.documents || []);
      let done = 0;
      const next = i => {
        if (i >= rows.length) {
          payload.fileCount = Object.keys(payload.files).length;
          payload.fileBytes = U.sum(Object.keys(payload.files), k => ((payload.files[k].data || '').length * 0.75));
          return Promise.resolve(payload);
        }
        const doc = rows[i];
        return App.files.get(doc.id).then(blob => {
          if (!blob) return null;
          return new Promise(resolve => {
            const fr = new FileReader();
            fr.onload = () => {
              payload.files[doc.id] = { name: doc.name, type: doc.mime || '', data: String(fr.result).split(',')[1] || '' };
              resolve(null);
            };
            fr.onerror = () => resolve(null);
            fr.readAsDataURL(blob);
          });
        }).catch(() => null).then(() => {
          done++;
          if (onProgress) onProgress(done, rows.length);
          return next(i + 1);
        });
      };
      return next(0);
    },

    /** restore a full backup: the workspace, the generated pages and every file */
    importFull(text, onProgress) {
      const data = JSON.parse(text);
      if (!data || !data.state) throw new Error('Not a Triverse OS backup file');
      this.state = this.migrate(App.seed(), data.state);
      this.save(true);
      Object.keys(data.sites || {}).forEach(id => this.setHTML(id, data.sites[id]));
      const ids = Object.keys(data.files || {});
      let done = 0;
      const next = i => {
        if (i >= ids.length) {
          this.state.meta = this.state.meta || {};
          this.state.meta.lastRestore = U.now();
          this.save(true);
          return Promise.resolve({ files: done });
        }
        const id = ids[i];
        const rec = data.files[id];
        return this.restoreOne(id, rec).then(() => { done++; if (onProgress) onProgress(done, ids.length); })
          .catch(() => {}).then(() => next(i + 1));
      };
      return next(0);
    },

    /** one file's bytes, from the base64 kept in a full backup */
    restoreOne(id, rec) {
      return new Promise((resolve, reject) => {
        try {
          const bin = atob(String(rec.data || ''));
          const arr = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          const blob = new Blob([arr], { type: rec.type || 'application/octet-stream' });
          App.files.put(id, blob).then(() => resolve(true)).catch(reject);
        } catch (e) { reject(e); }
      });
    },
    reset(keepSettings) {
      const settings = keepSettings ? U.clone(this.state.settings) : null;
      const sites = this.state.sites || [];
      sites.forEach(s => this.dropHTML(s.id));
      this.state = App.seed();
      if (settings) this.state.settings = settings;
      this.save(true);
    },
    sizeKB() {
      let bytes = 0;
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.indexOf('triverse.os.') === 0) bytes += (localStorage.getItem(k) || '').length * 2;
        }
      } catch (e) {}
      return Math.round(bytes / 1024);
    }
  };

  /* ------------------------------ event bus ------------------------------- */
  const listeners = {};
  App.on = (evt, fn) => { (listeners[evt] = listeners[evt] || []).push(fn); return fn; };
  App.off = (evt, fn) => { listeners[evt] = (listeners[evt] || []).filter(f => f !== fn); };
  App.emit = (evt, data) => { (listeners[evt] || []).forEach(fn => { try { fn(data); } catch (e) { console.error('[triverse]', evt, e); } }); };
  App.refresh = () => {};
  App.actions = {};

  /* --------------------------------- theme --------------------------------- */
  /* dark is the studio signature; light is daylight mode for offices and print */
  App.THEME_KEY = 'triverse.os.theme';
  App.theme = {
    current() { return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; },
    apply(mode, persist) {
      const m = mode === 'light' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', m);
      document.documentElement.classList.toggle('dark', m !== 'light');
      const icon = document.getElementById('theme-icon');
      if (icon) icon.className = 'fa-solid ' + (m === 'light' ? 'fa-sun' : 'fa-moon') + ' text-sm';
      const btn = document.getElementById('theme-toggle');
      if (btn) btn.setAttribute('title', m === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
      if (persist !== false) { try { localStorage.setItem(App.THEME_KEY, m); } catch (e) {} }
      return m;
    },
    toggle() { return App.theme.apply(App.theme.current() === 'dark' ? 'light' : 'dark'); }
  };
  App.action = (name, fn) => { App.actions[name] = fn; };

  /* -------------------------------- branding ------------------------------ */
  /* The studio logo lives in the workspace itself (settings.company.logo) so it
     travels with a backup and with cloud sync. It is always shown in a circle. */
  App.brand = {
    logo() { return String(App.store.get('settings.company.logo', '') || ''); },
    initials() {
      const co = App.store.get('settings.company', {}) || {};
      return String(co.shortName || co.name || 'Triverse Studio').split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toUpperCase();
    },
    /** the round mark: the uploaded logo, or the studio initials */
    mark(cls) {
      const logo = App.brand.logo();
      if (logo) return '<img class="' + (cls || 'brand-mark') + '" src="' + U.attr(logo) + '" alt="' + U.attr(App.store.get('settings.company.name', 'Logo')) + '" />';
      return '<span class="' + (cls || 'brand-mark') + ' brand-mark--text">' + U.esc(App.brand.initials()) + '</span>';
    },
    /**
     * Read an image file, trim it to a square and shrink it so a logo costs a few
     * kilobytes instead of megabytes. Transparency is preserved (PNG/WebP).
     */
    fromFile(file, size) {
      return new Promise((resolve, reject) => {
        if (!file) return reject(new Error('No file chosen.'));
        if (!/^image\//.test(file.type)) return reject(new Error('Choose an image file (PNG, JPG, SVG or WebP).'));
        if (file.size > 8 * 1024 * 1024) return reject(new Error('That image is larger than 8 MB.'));
        if (/svg/.test(file.type)) {
          const fr = new FileReader();
          fr.onload = () => resolve(String(fr.result));
          fr.onerror = () => reject(new Error('Could not read that file.'));
          fr.readAsDataURL(file);
          return;
        }
        const fr = new FileReader();
        fr.onload = () => {
          const img = new Image();
          img.onload = () => {
            const max = size || 512;
            const side = Math.min(img.width, img.height);
            const canvas = document.createElement('canvas');
            canvas.width = max; canvas.height = max;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.clearRect(0, 0, max, max);
            ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, max, max);
            const hasAlpha = /\.png$/i.test(file.name) || /png|webp|svg/.test(file.type);
            resolve(canvas.toDataURL(hasAlpha ? 'image/png' : 'image/jpeg', 0.92));
          };
          img.onerror = () => reject(new Error('That image could not be opened.'));
          img.src = String(fr.result);
        };
        fr.onerror = () => reject(new Error('Could not read that file.'));
        fr.readAsDataURL(file);
      });
    }
  };

  /** append to the activity log (kept to the latest 600 entries) */
  App.log = function (kind, text, ref) {
    const arr = App.store.get('activities', []);
    arr.unshift({ id: U.uid('act'), kind: kind || 'note', text: text || '', ref: ref || '', at: U.now() });
    App.store.set('activities', arr.slice(0, 600), { silent: true });
  };

  /* ------------------------------ UI partials ----------------------------- */
  const ui = App.ui = {
    TONES: {
      lime: 'tone tone-lime',
      muted: 'tone tone-muted',
      red: 'tone tone-red',
      amber: 'tone tone-amber',
      blue: 'tone tone-blue',
      violet: 'tone tone-violet'
    },

    icon(name, cls) { return '<i class="fa-solid ' + name + ' ' + (cls || '') + '"></i>'; },
    /** the 1-2-3-4-5 progress strip every workflow screen starts with */
    steps(items, active) {
      return '<div class="steps">' + items.map((s, i) => {
        const cls = i === active ? 'is-active' : (i < active ? 'is-done' : '');
        return '<span class="step ' + cls + '"><span class="n">' + (i < active ? '<i class="fa-solid fa-check"></i>' : (i + 1)) + '</span>' + U.esc(s) + '</span>';
      }).join('<span class="step-sep"></span>') + '</div>';
    },
    badge(text, tone) { return '<span class="text-[9px] font-semibold px-2 py-0.5 rounded-full border ' + (this.TONES[tone] || this.TONES.muted) + '">' + U.esc(text) + '</span>'; },
    card(inner, cls) { return '<div class="glass-card rounded-2xl p-4 ' + (cls || '') + '">' + inner + '</div>'; },
    head(title, right, sub) {
      return '<div class="flex items-center justify-between gap-3 mb-4"><div class="min-w-0"><h3 class="section-title">' +
        U.esc(title) + '</h3>' + (sub ? '<p class="section-sub">' + U.esc(sub) + '</p>' : '') + '</div>' + (right || '') + '</div>';
    },
    chip(label, on, action, data, iconName) {
      return '<button class="chip ' + (on ? 'is-on' : '') + '" data-action="' + action + '"' + (data ? ' data-arg="' + U.attr(data) + '"' : '') + '>' +
        (iconName ? this.icon(iconName, 'text-[9px]') : '') + U.esc(label) + '</button>';
    },
    kv(k, v, tone) {
      return '<div class="kv"><span class="k">' + U.esc(k) + '</span><span class="v" ' + (tone ? 'style="color:' + tone + '"' : '') + '>' + (v == null || v === '' ? '—' : v) + '</span></div>';
    },
    stars(rating, count) {
      const r = Number(rating) || 0;
      return '<span class="text-[10px] text-textMuted"><span class="text-limeAccent font-semibold">★ ' + r.toFixed(1) + '</span>' +
        (count ? ' (' + U.num(count) + ')' : '') + '</span>';
    },
    avatar(name, cls) {
      const initials = String(name || '?').split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
      return '<span class="' + (cls || 'w-8 h-8 text-[11px]') + ' rounded-full bg-accentMint text-bgMain font-bold flex items-center justify-center shrink-0">' + U.esc(initials) + '</span>';
    },
    progress(pct, cls) {
      return '<div class="w-full h-1.5 bg-track rounded-full overflow-hidden ' + (cls || '') + '">' +
        '<div class="h-full bg-limeAccent rounded-full bar-anim" style="width:' + U.clamp(pct, 0, 100) + '%"></div></div>';
    },
    sparkline(values, cls) {
      const v = (values && values.length ? values : [1, 1]).map(n => Number(n) || 0);
      const max = Math.max.apply(null, v) || 1, min = Math.min.apply(null, v);
      const span = (max - min) || 1;
      const pts = v.map((n, i) => [(i / (v.length - 1 || 1)) * 60, 20 - ((n - min) / span) * 16]);
      const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
      return '<svg class="spark ' + (cls || 'w-16 h-6') + ' text-limeAccent stroke-current fill-none" viewBox="0 0 60 20"><path d="' + d + '" stroke-width="2.2" stroke-linecap="round"/></svg>';
    },
    area(values, cls) {
      const v = (values && values.length ? values : [0, 0]).map(n => Number(n) || 0);
      const max = Math.max.apply(null, v) || 1;
      const pts = v.map((n, i) => [(i / (v.length - 1 || 1)) * 200, 56 - (n / max) * 48]);
      const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
      const id = U.uid('g');
      return '<svg class="' + (cls || 'w-full h-16') + '" viewBox="0 0 200 60" preserveAspectRatio="none">' +
        '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="rgb(var(--accent))" stop-opacity="0.40"/><stop offset="100%" stop-color="rgb(var(--accent))" stop-opacity="0"/></linearGradient></defs>' +
        '<path d="' + line + ' L200 60 L0 60 Z" fill="url(#' + id + ')"/>' +
        '<path d="' + line + '" fill="none" stroke="rgb(var(--accent))" stroke-width="2"/></svg>';
    },
    bars(items, opts) {
      opts = opts || {};
      const max = Math.max.apply(null, items.map(i => i.value).concat([1]));
      return '<div class="flex items-end justify-between h-28 pt-3 gap-2">' + items.map(it => {
        const h = Math.max(6, Math.round((it.value / max) * 72));
        const on = it.key === opts.highlight;
        return '<div class="flex flex-col items-center gap-2 flex-1 min-w-0" title="' + U.attr(U.money(it.value)) + '">' +
          (it.tip ? '<span class="text-[9px] ' + (on ? 'text-accentMint font-semibold' : 'text-textMuted') + '">' + U.esc(it.tip) + '</span>' : '') +
          '<div class="w-full max-w-[26px] rounded-t-md rounded-b-sm ' + (on ? 'bg-accentMint' : 'bg-track') + ' hover:opacity-90 transition-all" style="height:' + h + 'px"></div>' +
          '<span class="text-[10px] ' + (on ? 'text-accentMint font-semibold' : 'text-textMuted') + '">' + U.esc(it.label) + '</span></div>';
      }).join('') + '</div>';
    },
    /** the reference dashboard's circular progress ring */
    donut(pct, center, label, tone) {
      const p = U.clamp(Math.round(Number(pct) || 0), 0, 100);
      const C = 251.2;
      const offset = (C * (100 - p) / 100).toFixed(2);
      const color = tone || 'rgb(var(--accent))';
      return '<div class="flex flex-col items-center gap-2.5">' +
        '<div class="ring-chart w-24 h-24">' +
        '<svg viewBox="0 0 100 100">' +
        '<circle stroke="rgb(var(--line))" stroke-width="11" cx="50" cy="50" r="40" fill="transparent"/>' +
        '<circle class="ring-chart__circle" stroke="' + color + '" stroke-width="11" stroke-linecap="round" cx="50" cy="50" r="40" fill="transparent" stroke-dasharray="' + C + '" stroke-dashoffset="' + offset + '"/>' +
        '</svg><span class="ring-chart__val">' + U.esc(center) + '</span></div>' +
        (label ? '<span class="text-[11px] text-textMuted font-medium text-center">' + U.esc(label) + '</span>' : '') + '</div>';
    },
    /** a horizontal ring row used in side panels */
    meter(pct, label, tone) {
      const p = U.clamp(Math.round(Number(pct) || 0), 0, 100);
      return '<div class="flex items-center gap-3">' +
        '<span class="text-[11px] text-textMuted flex-1 min-w-0 truncate">' + U.esc(label) + '</span>' +
        '<div class="w-24 h-1.5 rounded-full overflow-hidden" style="background:rgb(var(--track))">' +
        '<div class="h-full rounded-full bar-anim" style="width:' + p + '%;background:' + (tone || 'rgb(var(--accent))') + '"></div></div>' +
        '<span class="text-[11px] font-semibold text-ink w-9 text-right num">' + p + '%</span></div>';
    },
    /** pick a sensible circular badge icon from the card's own wording */
    statIcon(o) {
      const hay = String((o.label || '') + ' ' + (o.tag || '') + ' ' + (o.sub || '')).toLowerCase();
      const map = [
        [/(overdue|late|chase|rejected|risk)/, 'fa-triangle-exclamation'],
        [/(drive|google drive|off-device|cloud copy|copied)/, 'fa-cloud-arrow-up'],
        [/(file|vault|document|archive|upload)/, 'fa-box-archive'],
        [/(linked|attached to|project)/, 'fa-link'],
        [/(most recent|latest|newest)/, 'fa-clock-rotate-left'],
        [/(renewal|retainer|recurring|pipeline|deal value)/, 'fa-rotate'],
        [/(outstanding|receivable|due)/, 'fa-hourglass-half'],
        [/(collected|cash|revenue|collections|paid|contracted|money|value)/, 'fa-wallet'],
        [/(reply|replies|conversation|triage)/, 'fa-comment-dots'],
        [/(sent|message|outreach|volume)/, 'fa-paper-plane'],
        [/(client|customer)/, 'fa-user-tie'],
        [/(website|site|hosted|online|domain)/, 'fa-globe'],
        [/(sample|template|library|draft)/, 'fa-swatchbook'],
        [/(business|found|lead|discover)/, 'fa-map-location-dot'],
        [/(invoice|quote|proposal)/, 'fa-file-invoice-dollar']
      ];
      for (let i = 0; i < map.length; i++) if (map[i][0].test(hay)) return map[i][1];
      return 'fa-chart-line';
    },

    /** KPI card with the reference dashboard's circular icon badge */
    /*
     * The metric tile, rebuilt: the number is the page's biggest type, the icon
     * is quiet chrome in the corner, and the accent edge gives each card a
     * single hue without a rainbow of badges. Reads as a dashboard, not a form.
     */
    /**
     * The strip a page opens with: two to four numbers, each with one quiet
     * line under it. Replaces the old wall of stat cards, so a screen starts
     * with what the number is, not with four paragraphs of explanation.
     */
    hero(cells) {
      const list = cells || [];
      return '<div class="dash-hero dash-hero--' + list.length + '">' + list.map(c =>
        '<div class="dash-hero__cell">' +
        '<p class="dash-hero__label">' + U.esc(c.label) + '</p>' +
        '<p class="dash-hero__value' + (c.tone ? ' dash-hero__value--' + c.tone : '') + '">' +
        (c.valueHtml || U.esc(c.value == null ? '0' : c.value)) + '</p>' +
        (c.sub ? '<p class="dash-hero__sub">' + U.esc(c.sub) + '</p>' : '') +
        (c.cta ? '<button class="btn btn-ghost btn-sm mt-3"' +
          (c.nav ? ' data-nav="' + U.attr(c.nav) + '"' : ' data-action="' + U.attr(c.action) + '" data-arg="' + U.attr(c.arg || '') + '"') + '>' +
          (c.icon ? this.icon(c.icon) + ' ' : '') + U.esc(c.cta) + '</button>' : '') +
        '</div>').join('') + '</div>';
    },
    stat(o) {
      o.icon = o.icon || this.statIcon(o);
      const edge = o.tone === 'red' ? 'stat--red' :
        o.tone === 'amber' ? 'stat--amber' :
        o.tone === 'blue' ? 'stat--blue' :
        o.tone === 'violet' ? 'stat--violet' : 'stat--lime';
      const arrow = o.tone === 'red' ? 'fa-arrow-trend-down' : 'fa-arrow-trend-up';
      return '<div class="stat ' + edge + '">' +
        '<span class="stat__ico"><i class="fa-solid ' + o.icon + '"></i></span>' +
        '<p class="stat__label">' + U.esc(o.label) + '</p>' +
        '<p class="stat__value num"><span class="count-pop">' +
        (o.valueHtml || U.esc(o.value == null ? '0' : o.value)) + '</span>' +
        (o.badge ? '<span class="stat__badge">' +
          (o.trend ? '<i class="fa-solid ' + arrow + ' text-[8px]"></i>' : '') + U.esc(o.badge) + '</span>' : '') +
        '</p>' +
        (o.sub ? '<p class="stat__sub">' + (o.subHtml || U.esc(o.sub)) + '</p>' : '') +
        (o.spark ? this.sparkline(o.spark, 'stat__spark') : '') +
        '</div>';
    },
    field(o) {
      const id = 'f_' + String(o.model || U.uid('x')).replace(/[^a-zA-Z0-9]+/g, '_');
      const ph = o.placeholder ? ' placeholder="' + U.attr(o.placeholder) + '"' : '';
      const dm = ' data-model="' + U.attr(o.model || '') + '"';
      const en = o.enter ? ' data-enter="' + U.attr(o.enter) + '"' : '';
      const ch = o.change ? ' data-change-action="' + U.attr(o.change) + '"' : '';
      let control;
      if (o.type === 'checkbox') {
        control = '<label class="flex items-center gap-2 text-[11px] text-gray-300 cursor-pointer"><input type="checkbox"' + dm + (o.value ? ' checked' : '') + ' class="w-3.5 h-3.5 accent-limeAccent" />' + U.esc(o.checkLabel || o.label || '') + '</label>';
        return '<div class="' + (o.wrapCls || '') + '">' + control + '</div>';
      }
      if (o.options) {
        control = '<select id="' + id + '"' + dm + ch + ' class="inp ' + (o.cls || '') + '">' + o.options.map(op => {
          const v = Array.isArray(op) ? op[0] : op.value;
          const l = Array.isArray(op) ? op[1] : op.label;
          return '<option value="' + U.attr(v) + '"' + (String(v) === String(o.value) ? ' selected' : '') + '>' + U.esc(l) + '</option>';
        }).join('') + '</select>';
      } else if (o.rows) {
        control = '<textarea id="' + id + '" rows="' + o.rows + '"' + ph + dm + en + ch + ' class="inp ' + (o.cls || '') + '">' + U.esc(o.value) + '</textarea>';
      } else {
        control = '<input id="' + id + '" type="' + (o.type || 'text') + '" value="' + U.attr(o.value) + '"' + ph + dm + en + ch + ' class="inp ' + (o.cls || '') + '" />';
      }
      /* an optional inline control beside the label — used for the "open link"
         buttons on the social profile fields */
      const label = o.action
        ? '<div class="flex items-center justify-between gap-2"><label class="lbl mb-0" for="' + id + '">' + U.esc(o.label || '') + '</label>' + o.action + '</div>'
        : '<label class="lbl" for="' + id + '">' + U.esc(o.label || '') + '</label>';
      return '<div class="' + (o.wrapCls || '') + '">' + label + control +
        (o.hint ? '<p class="text-[9px] text-textMuted mt-1 truncate" title="' + U.attr(o.hint) + '">' + U.esc(o.hint) + '</p>' : '') + '</div>';
    },
    table(headers, rows, opts) {
      opts = opts || {};
      const align = opts.align || [];
      const cells = r => (r.cells || r).map((c, i) => '<td class="' + (align[i] === 'right' ? 'text-right' : '') + '">' + c + '</td>').join('');
      if (!rows.length) return this.empty(opts.empty || 'Nothing here yet', opts.emptySub || '', opts.emptyIcon || 'fa-inbox');
      return '<div class="overflow-x-auto"><table class="tbl"><thead><tr>' +
        headers.map((h, i) => '<th class="' + (align[i] === 'right' ? 'text-right' : '') + '">' + U.esc(h) + '</th>').join('') +
        '</tr></thead><tbody>' + rows.map(r => '<tr' + (r.attrs || '') + '>' + cells(r) + '</tr>').join('') + '</tbody></table></div>';
    },
    empty(text, sub, iconName, btn) {
      return '<div class="glass-soft rounded-2xl p-6 text-center bounce-none"><i class="fa-solid ' + (iconName || 'fa-inbox') + ' text-lg text-textMuted"></i>' +
        '<p class="text-[11px] text-gray-300 mt-2 font-semibold">' + U.esc(text) + '</p>' +
        (sub ? '<p class="text-[10px] text-textMuted mt-1">' + sub + '</p>' : '') +
        (btn ? '<div class="mt-3 flex justify-center">' + btn + '</div>' : '') + '</div>';
    },
    previewFrame(html, height) {
      /* A blob URL instead of srcdoc: a srcdoc frame inherits the app's own base URL,
         so a relative asset inside the generated page makes the browser log an
         "unsafe attempt to load file://" warning. A blob document has no file base. */
      const url = ui.blobUrl(String(html || ''), 'text/html;charset=utf-8');
      /* generated pages ship a small script (burger menu, booking → WhatsApp), so the
         preview frame allows scripts/forms — but never same-origin, which keeps the
         sandboxed page away from this app's document and storage */
      return '<iframe class="w-full rounded-xl border border-white/10 bg-white/95" style="height:' + (height || 420) + 'px" sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox" src="' + U.attr(url) + '"></iframe>';
    },
    /**
     * Blob URLs for previews. Several frames can be on screen at once, so the newest
     * 12 are kept alive and anything older is released — no leak, no broken frames.
     */
    _blobUrls: [],
    blobUrl(text, mime) {
      try {
        const url = URL.createObjectURL(new Blob([text], { type: mime || 'text/plain;charset=utf-8' }));
        ui._blobUrls.push(url);
        while (ui._blobUrls.length > 12) {
          const old = ui._blobUrls.shift();
          try { URL.revokeObjectURL(old); } catch (e) {}
        }
        return url;
      } catch (e) { return 'about:blank'; }
    },
    link(url, label, cls) {
      if (!url) return '—';
      const href = /^(https?:|mailto:|tel:|#)/.test(url) ? url : 'https://' + url;
      return '<a class="' + (cls || 'link') + '" href="' + U.attr(href) + '" target="_blank" rel="noopener">' + U.esc(label || url) + '</a>';
    },

    /* overlays ------------------------------------------------------------- */
    modal(o) {
      const root = document.getElementById('modal-root');
      const size = o.size === 'xl' ? 'max-w-[1100px]' : o.size === 'lg' ? 'max-w-[780px]' : o.size === 'sm' ? 'max-w-[400px]' : 'max-w-[560px]';
      root.innerHTML = '<div class="overlay flex items-center justify-center p-3" data-action="backdrop">' +
        '<div class="modal-panel glass-card rounded-2xl w-full ' + size + ' max-h-[88vh] flex flex-col overflow-hidden">' +
        '<div class="flex items-start justify-between gap-3 p-4 border-b border-white/5">' +
        '<div class="min-w-0"><h3 class="text-sm font-bold text-white">' + U.esc(o.title || '') + '</h3>' +
        (o.sub ? '<p class="text-[10px] text-textMuted mt-0.5">' + o.sub + '</p>' : '') + '</div>' +
        '<button data-action="close-modal" class="w-7 h-7 rounded-lg text-textMuted hover:text-white hover:bg-hover flex items-center justify-center shrink-0"><i class="fa-solid fa-xmark text-xs"></i></button>' +
        '</div><div class="p-4 overflow-y-auto flex-1">' + (o.body || '') + '</div>' +
        (o.footer ? '<div class="p-4 border-t border-white/5 flex items-center justify-end gap-2 flex-wrap">' + o.footer + '</div>' : '') +
        '</div></div>';
      if (o.onMount) o.onMount(root);
      return root;
    },
    closeModal() { const r = document.getElementById('modal-root'); if (r) r.innerHTML = ''; },
    /**
     * Detail view. This used to slide in from the right, which reads as a
     * side-panel and hides half the record on a laptop. Every detail view now
     * opens as a centred panel: wide, scrollable, with the title pinned.
     */
    drawer(o) {
      const root = document.getElementById('drawer-root');
      const size = o.size === 'lg' ? 'max-w-[1080px]' : o.size === 'sm' ? 'max-w-[520px]' : 'max-w-[880px]';
      root.innerHTML = '<div class="overlay flex items-center justify-center p-3" data-action="backdrop">' +
        '<div class="detail-panel glass-card w-full ' + size + ' max-h-[90vh] flex flex-col overflow-hidden">' +
        '<div class="detail-head flex items-start justify-between gap-3 px-5 py-4 border-b border-line">' +
        '<div class="min-w-0"><h3 class="text-sm font-bold">' + U.esc(o.title || '') + '</h3>' +
        (o.sub ? '<p class="text-[10px] text-textMuted mt-0.5">' + o.sub + '</p>' : '') + '</div>' +
        '<button data-action="close-drawer" class="w-8 h-8 rounded-xl text-textMuted hover:text-white hover:bg-hover flex items-center justify-center shrink-0 transition" aria-label="Close"><i class="fa-solid fa-xmark text-xs"></i></button>' +
        '</div><div class="px-5 py-4 overflow-y-auto flex-1">' + (o.body || '') + '</div>' +
        (o.footer ? '<div class="px-5 py-3.5 border-t border-line flex items-center justify-end gap-2 flex-wrap">' + o.footer + '</div>' : '') +
        '</div></div>';
      if (o.onMount) o.onMount(root);
      return root;
    },
    closeDrawer() { const r = document.getElementById('drawer-root'); if (r) r.innerHTML = ''; },
    /* toasts never stack up: the same message reuses its card, and only the last
       five are ever on screen (a busy search can otherwise bury the whole app) */
    _toasts: [],
    toast(msg, tone) {
      const map = { lime: 'tone-lime', red: 'tone-red', amber: 'tone-amber', blue: 'tone-blue', muted: 'tone-muted' };
      const root = document.getElementById('toast-root');
      if (!root) return;
      const text = String(msg == null ? '' : msg);
      const again = ui._toasts.filter(t => t.text === text && t.tone === tone)[0];
      if (again) {
        clearTimeout(again.timer);
        clearTimeout(again.fade);
        again.el.style.opacity = '1';
        again.el.style.transform = 'none';
        again.timer = setTimeout(() => again.el.remove(), 2600);
        return;
      }
      const el = document.createElement('div');
      el.className = 'toast glass-card rounded-xl px-3 py-2 text-[11px] border ' + (map[tone] || map.lime);
      el.style.maxWidth = '360px';
      el.innerHTML = '<i class="fa-solid ' + (tone === 'red' ? 'fa-circle-exclamation' : tone === 'amber' ? 'fa-triangle-exclamation' : 'fa-circle-check') + ' mr-1.5"></i>' + U.esc(text);
      root.appendChild(el);
      const rec = { el: el, text: text, tone: tone, fade: null, timer: null };
      ui._toasts.push(rec);
      while (ui._toasts.length > 5) { const old = ui._toasts.shift(); if (old.el.parentNode) old.el.remove(); }
      rec.fade = setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(6px)'; el.style.transition = 'all .25s ease'; }, 3200);
      rec.timer = setTimeout(() => {
        el.remove();
        ui._toasts = ui._toasts.filter(t => t !== rec);
      }, 3600);
    },
    confirm(o) {
      ui._confirmCb = o.onConfirm;
      ui.modal({
        title: o.title || 'Please confirm',
        sub: o.sub,
        size: 'sm',
        body: '<p class="text-[11px] text-gray-300 leading-relaxed">' + U.esc(o.message || '') + '</p>',
        footer: '<button class="btn btn-ghost" data-action="close-modal">Cancel</button>' +
          '<button class="btn ' + (o.tone === 'danger' ? 'btn-danger' : 'btn-lime') + '" data-action="confirm-yes">' + U.esc(o.confirmLabel || 'Confirm') + '</button>'
      });
    },
    prompt(o) {
      ui.modal({
        title: o.title || 'Input',
        size: 'sm',
        body: '<label class="lbl">' + U.esc(o.label || '') + '</label><input id="prompt-input" class="inp" value="' + U.attr(o.value || '') + '" placeholder="' + U.attr(o.placeholder || '') + '" />' +
          (o.hint ? '<p class="text-[9px] text-textMuted mt-1">' + U.esc(o.hint) + '</p>' : ''),
        footer: '<button class="btn btn-ghost" data-action="close-modal">Cancel</button><button class="btn btn-lime" data-action="prompt-ok">' + U.esc(o.okLabel || 'Save') + '</button>',
        onMount(root) {
          const inp = root.querySelector('#prompt-input');
          inp.focus(); inp.select();
          inp.addEventListener('keydown', e => {
            if (e.key === 'Enter') { const v = inp.value; ui.closeModal(); o.onSubmit(v); }
          });
          ui._promptCb = () => { const v = inp.value; ui.closeModal(); o.onSubmit(v); };
        }
      });
    },
    _confirmCb: null,
    _promptCb: null
  };

  /* -------------------------------- router -------------------------------- */
  App.router = {
    go(route, param) {
      const next = '#/' + route + (param ? '/' + encodeURIComponent(param) : '');
      if (location.hash === next) App.refresh(); else location.hash = next;
    },
    current() {
      const raw = String(location.hash || '').replace(/^#\/?/, '');
      const parts = raw.split('/');
      return { route: parts[0] || 'dashboard', param: parts[1] ? decodeURIComponent(parts[1]) : '' };
    },
    /** active filter/query state per view (not persisted) */
    q: {}
  };

  /** always keep the hash valid so reloads land somewhere sensible */
  App.router.ensure = function () {
    if (!location.hash) location.hash = '#/dashboard';
  };
})(window);
