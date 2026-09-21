/* =============================================================================
   Triverse OS — file vault
   Every file the studio owns: websites, source code, designs, contracts,
   invoices and backups. The *description* of each file lives in the workspace
   (so it travels in backups and cloud sync); the bytes live beside it in
   IndexedDB where the browser can hold hundreds of megabytes, with a
   localStorage fallback for browsers that block IndexedDB on file://.

   Nothing is uploaded anywhere by this layer. Google Drive backup is a separate,
   explicitly-started step (see cloud.js).
   ========================================================================== */
(function (global) {
  'use strict';

  const App = global.App;
  const U = App.util;

  const DB_NAME = 'triverse-os';
  const DB_VERSION = 1;
  const STORE = 'files';
  const LS_PREFIX = 'triverse.os.file.';
  const LS_LIMIT = 3 * 1024 * 1024;        /* per file, on the fallback path */
  const LS_TOTAL_LIMIT = 6 * 1024 * 1024;

  let dbPromise = null;
  let idbBlocked = false;

  function openDB() {
    if (idbBlocked) return Promise.reject(new Error('no-indexeddb'));
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      let req;
      try { req = global.indexedDB.open(DB_NAME, DB_VERSION); }
      catch (e) { idbBlocked = true; return reject(new Error('no-indexeddb')); }
      if (!req) { idbBlocked = true; return reject(new Error('no-indexeddb')); }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { idbBlocked = true; reject(new Error('no-indexeddb')); };
      req.onblocked = () => reject(new Error('indexeddb-blocked'));
    });
    return dbPromise;
  }

  function tx(mode, fn) {
    return openDB().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const store = t.objectStore(STORE);
      let out;
      try { out = fn(store); } catch (e) { reject(e); return; }
      t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
      t.onerror = () => reject(t.error || new Error('IndexedDB transaction failed'));
      t.onabort = () => reject(t.error || new Error('IndexedDB transaction aborted'));
    }));
  }

  /* ------------------------------ base64 bridge ----------------------------- */
  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error('Could not read the file.'));
      fr.readAsDataURL(blob);
    });
  }

  function dataURLToBlob(url) {
    const parts = String(url).split(',');
    const head = parts[0] || '';
    const body = parts.slice(1).join(',');
    const mime = (head.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
    if (/;base64/.test(head)) {
      const bin = global.atob(body);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: mime });
    }
    return new Blob([decodeURIComponent(body)], { type: mime });
  }

  function lsKeys() {
    const out = [];
    try {
      for (let i = 0; i < global.localStorage.length; i++) {
        const k = global.localStorage.key(i);
        if (k && k.indexOf(LS_PREFIX) === 0) out.push(k);
      }
    } catch (e) {}
    return out;
  }

  function lsUsage() {
    let bytes = 0;
    lsKeys().forEach(k => { bytes += (global.localStorage.getItem(k) || '').length; });
    return Math.round(bytes * 0.75);
  }

  /* --------------------------------- the layer ------------------------------ */
  const files = App.files = {
    STORE: STORE,

    /** IndexedDB is not available on every file:// origin — fall back quietly */
    backend() { return idbBlocked ? 'localStorage' : 'indexedDB'; },

    async probe() {
      try { await openDB(); idbBlocked = false; return 'indexedDB'; }
      catch (e) { idbBlocked = true; return 'localStorage'; }
    },

    /* -------------------------------------------------------------- bytes */
    async put(id, blob) {
      const record = { id: id, size: blob.size, type: blob.type || '', at: U.now(), blob: blob };
      try {
        await tx('readwrite', s => s.put(record));
        return { backend: 'indexedDB', bytes: blob.size };
      } catch (e) {
        if (blob.size > LS_LIMIT) throw new Error('This browser cannot store files larger than ' + U.bytes(LS_LIMIT) + ' here. Open the app over http://localhost (npm start) for full-size storage, or keep this file on Google Drive.');
        if (lsUsage() + blob.size * 1.34 > LS_TOTAL_LIMIT) throw new Error('Local file storage is full. Delete files you no longer need, or connect Google Drive in Settings.');
        const url = await blobToDataURL(blob);
        try { global.localStorage.setItem(LS_PREFIX + id, url); }
        catch (err) { throw new Error('Local file storage is full (' + err.message + '). Connect Google Drive to keep files off this device.'); }
        return { backend: 'localStorage', bytes: blob.size };
      }
    },

    async get(id) {
      try {
        const rec = await tx('readonly', s => s.get(id));
        if (rec && rec.blob) return rec.blob;
      } catch (e) { /* fall through to localStorage */ }
      try {
        const url = global.localStorage.getItem(LS_PREFIX + id);
        if (url) return dataURLToBlob(url);
      } catch (e) {}
      return null;
    },

    async has(id) {
      try {
        const rec = await tx('readonly', s => s.get(id));
        if (rec) return true;
      } catch (e) {}
      try { return Boolean(global.localStorage.getItem(LS_PREFIX + id)); } catch (e) { return false; }
    },

    async remove(id) {
      try { await tx('readwrite', s => s.delete(id)); } catch (e) {}
      try { global.localStorage.removeItem(LS_PREFIX + id); } catch (e) {}
      return true;
    },

    async list() {
      let rows = [];
      try { rows = (await tx('readonly', s => s.getAll())) || []; } catch (e) { rows = []; }
      const seen = {};
      rows.forEach(r => { if (r && r.id) seen[r.id] = r.size; });
      lsKeys().forEach(k => {
        const id = k.slice(LS_PREFIX.length);
        const raw = global.localStorage.getItem(k) || '';
        if (!seen[id]) seen[id] = Math.round(raw.length * 0.75);
      });
      return Object.keys(seen).map(id => ({ id: id, size: seen[id] }));
    },

    async usage() {
      const rows = await files.list();
      return { count: rows.length, bytes: rows.reduce((a, b) => a + (b.size || 0), 0), backend: files.backend() };
    },

    async clear() {
      try { await tx('readwrite', s => s.clear()); } catch (e) {}
      lsKeys().forEach(k => { try { global.localStorage.removeItem(k); } catch (e) {} });
      return true;
    },

    /* --------------------------------------------------------- fingerprints */
    /** SHA-256 of the bytes — proves a downloaded copy is the file we stored */
    async checksum(blob) {
      try {
        const buf = await blob.arrayBuffer();
        const digest = await global.crypto.subtle.digest('SHA-256', buf);
        return Array.prototype.map.call(new Uint8Array(digest), b => ('00' + b.toString(16)).slice(-2)).join('');
      } catch (e) { return ''; }
    },

    /* -------------------------------------------------------------- adding */
    /**
     * Store a file and return its record. The metadata goes into the workspace,
     * the bytes go into the device's file store.
     */
    async add(file, meta) {
      meta = meta || {};
      if (!file) throw new Error('No file selected.');
      const id = meta.id || U.uid('doc');
      const name = file.name || meta.name || ('file-' + Date.now());
      const stored = await files.put(id, file);
      const checksum = meta.checksum === false ? '' : await files.checksum(file);
      let text = '';
      /* keep a readable copy of small text files so it can be searched */
      if (file.size <= 256 * 1024 && /^(text\/|application\/(json|javascript|xml|x-yaml))/.test(file.type || '') ) {
        try { text = await file.text(); } catch (e) { text = ''; }
      } else if (file.size <= 256 * 1024 && /\.(html?|css|js|mjs|json|txt|md|csv|sql|php|py|ts|tsx|jsx|yml|yaml|svg)$/i.test(name)) {
        try { text = await file.text(); } catch (e) { text = ''; }
      }
      const doc = Object.assign({
        id: id,
        name: name,
        ext: (name.split('.').pop() || '').toLowerCase(),
        mime: file.type || '',
        size: file.size,
        kind: U.fileKind(name, file.type),
        checksum: checksum,
        backend: stored.backend,
        source: 'upload',
        version: '1.0',
        author: App.store.get('settings.company.senderName', '') || 'Triverse Studio',
        uploadedAt: U.now(),
        updatedAt: U.now(),
        downloads: 0,
        opened: 0,
        category: meta.category || 'other',
        projectId: meta.projectId || '',
        projectName: meta.projectName || '',
        clientId: meta.clientId || '',
        description: meta.description || '',
        language: meta.language || '',
        folder: String(meta.folder || ''),      /* the path inside an uploaded folder */
        tags: meta.tags || [],
        notes: meta.notes || '',
        cloud: { driveId: '', syncedAt: '' },
        preview: text.slice(0, 8000),
        previewable: /^(text\/|image\/|application\/(json|javascript|xml|x-yaml|pdf))/.test(file.type || '') ||
          /\.(html?|css|js|mjs|json|txt|md|csv|sql|php|py|ts|tsx|jsx|yml|yaml|svg|png|jpe?g|gif|webp|ico|pdf)$/i.test(name)
      }, meta.overrides || {});
      /* a folder dropped from the desktop carries its own path on the File
         object — it wins over metadata, so the vault mirrors what was uploaded */
      if (file.folder && !doc.folder) doc.folder = String(file.folder);
      /* when the file itself is a website, remember it as a website record too */
      if (meta.linkSiteId) doc.projectId = meta.linkSiteId;
      App.store.add('documents', doc);
      App.log('file', 'Added “' + name + '” (' + U.bytes(file.size) + ') to the file vault', doc.id);
      return doc;
    },

    /* ------------------------------ folders ------------------------------- */
    /** every folder path: files carry paths, and empty folders are remembered so
        structure can exist before the files do ("website/v2" style) */
    folders() {
      const set = {};
      (App.store.get('folders.items', []) || []).forEach(f => { const k = String(f || '').trim(); if (k) set[k] = set[k] || 0; });
      files.all().forEach(d => { const f = String(d.folder || '').trim(); if (f) set[f] = (set[f] || 0) + 1; });
      return Object.keys(set).sort().map(k => ({ path: k, count: set[k] }));
    },

    /** the children of one folder path: sub-folders and the files inside it */
    browse(path) {
      const p = String(path || '').replace(/\/+$/, '');
      const all = files.all().concat(
        (App.store.get('folders.items', []) || []).map(f => ({ folder: f, empty: true })));
      const rows = all.filter(d => !d.empty && String(d.folder || '') === p);
      const subs = {};
      all.forEach(d => {
        const f = String(d.folder || '');
        if (!f || f === p || (p && f.indexOf(p + '/') !== 0)) return;
        const rest = p ? f.slice(p.length + 1) : f;
        const first = rest.split('/')[0];
        if (first) subs[(p ? p + '/' : '') + first] = (subs[(p ? p + '/' : '') + first] || 0) + 1;
      });
      return { path: p, folders: Object.keys(subs).sort().map(k => ({ path: k, count: subs[k] })), files: rows };
    },

    /** create an empty folder so structure can exist before files do */
    createFolder(path) {
      const p = String(path || '').trim().replace(/^\/+|\/+$/g, '');
      if (!p) return { error: 'Give the folder a name.' };
      const list = (App.store.get('folders.items', []) || []).slice();
      if (list.indexOf(p) === -1) { list.push(p); App.store.set('folders.items', list); App.store.save(); }
      return { path: p };
    },

    /** rename a folder: every file inside follows to the new path */
    renameFolder(oldPath, newPath) {
      const from = String(oldPath || '').replace(/\/+$/, '');
      const to = String(newPath || '').trim().replace(/^\/+|\/+$/g, '');
      if (!to) return { error: 'Give the folder a name.' };
      let n = 0;
      files.all().forEach(d => {
        const f = String(d.folder || '');
        if (f === from || f.indexOf(from + '/') === 0) {
          const next = to + f.slice(from.length);
          App.store.patch('documents', d.id, { folder: next, updatedAt: U.now() });
          n++;
        }
      });
      const empties = (App.store.get('folders.items', []) || []).slice();
      const kept = [];
      empties.forEach(f => {
        if (f === from || f.indexOf(from + '/') === 0) kept.push(to + f.slice(from.length));
        else kept.push(f);
      });
      App.store.set('folders.items', kept);
      App.store.save();
      return { moved: n, path: to };
    },

    /** delete a folder and everything inside it */
    async deleteFolder(path) {
      const p = String(path || '').replace(/\/+$/, '');
      const doomed = files.all().filter(d => {
        const f = String(d.folder || '');
        return f === p || f.indexOf(p + '/') === 0;
      });
      for (let i = 0; i < doomed.length; i++) {
        await files.remove(doomed[i].id);
        App.store.remove('documents', doomed[i].id);
      }
      App.store.set('folders.items', (App.store.get('folders.items', []) || []).filter(f => f !== p && f.indexOf(p + '/') !== 0));
      App.store.save();
      return { removed: doomed.length };
    },

    /** add several files at once, skipping anything that fails */
    async addMany(fileList, meta) {
      const out = { added: [], failed: [] };
      const list = Array.prototype.slice.call(fileList || []);
      for (let i = 0; i < list.length; i++) {
        try { out.added.push(await files.add(list[i], Object.assign({}, meta, { overrides: { partOf: meta && meta.batchName || '' } }))); }
        catch (e) { out.failed.push({ name: list[i].name, error: e.message }); }
      }
      return out;
    },

    /* --------------------------------------------------------------- using */
    async download(docOrId) {
      const doc = typeof docOrId === 'string' ? App.store.find('documents', docOrId) : docOrId;
      if (!doc) { App.ui.toast('That file record no longer exists', 'amber'); return false; }
      const blob = await files.get(doc.id);
      if (!blob) {
        App.ui.toast('The stored copy of “' + doc.name + '” is missing from this device — restore a backup or re-upload it.', 'red');
        return false;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = doc.name;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1200);
      App.store.patch('documents', doc.id, { downloads: (Number(doc.downloads) || 0) + 1, lastDownloadedAt: U.now() });
      return true;
    },

    async open(docOrId) {
      const doc = typeof docOrId === 'string' ? App.store.find('documents', docOrId) : docOrId;
      if (!doc) return false;
      const blob = await files.get(doc.id);
      if (!blob) { App.ui.toast('The stored copy is missing from this device', 'red'); return false; }
      const url = URL.createObjectURL(blob);
      const w = global.open(url, '_blank');
      if (!w) App.ui.toast('Pop-up blocked — allow pop-ups to open the file', 'amber');
      setTimeout(() => URL.revokeObjectURL(url), 120000);
      App.store.patch('documents', doc.id, { opened: (Number(doc.opened) || 0) + 1, lastOpenedAt: U.now() });
      return true;
    },

    async blobUrl(docOrId) {
      const doc = typeof docOrId === 'string' ? App.store.find('documents', docOrId) : docOrId;
      if (!doc) return '';
      const blob = await files.get(doc.id);
      return blob ? URL.createObjectURL(blob) : '';
    },

    /** replace the bytes of an existing record with a newer version */
    async replace(docId, file) {
      const doc = App.store.find('documents', docId);
      if (!doc) throw new Error('That file record no longer exists.');
      const stored = await files.put(docId, file);
      await files.remove(docId === doc.id ? docId : docId); /* keeps the same key */
      await files.put(docId, file);
      const checksum = await files.checksum(file);
      const patch = {
        size: file.size, mime: file.type || doc.mime, ext: (file.name.split('.').pop() || '').toLowerCase(),
        kind: U.fileKind(file.name, file.type), checksum: checksum, backend: stored.backend,
        updatedAt: U.now(), lastVersionAt: U.now(),
        history: (doc.history || []).concat([{ at: U.now(), size: doc.size, version: doc.version, checksum: doc.checksum }]).slice(-20)
      };
      App.store.patch('documents', docId, patch);
      App.log('file', 'New version of “' + doc.name + '” uploaded', docId);
      return true;
    },

    /* ------------------------------------------------- search + statistics */
    all() { return App.store.get('documents', []) || []; },

    search(term, opts) {
      opts = opts || {};
      const t = String(term || '').trim().toLowerCase();
      let rows = files.all();
      if (opts.folder !== undefined) {
        const p = String(opts.folder || '');
        rows = rows.filter(d => String(d.folder || '') === p);
      }
      if (opts.category && opts.category !== 'all') rows = rows.filter(d => d.category === opts.category);
      if (opts.projectId) rows = rows.filter(d => d.projectId === opts.projectId || d.clientId === opts.projectId);
      if (opts.missing) rows = rows.filter(d => d.missing);
      if (t) {
        rows = rows.filter(d =>
          U.hit(d.name, t) || U.hit(d.description, t) || U.hit(d.kind, t) || U.hit(d.language, t) ||
          U.hit(d.projectName, t) || U.hit(d.notes, t) || U.hit(d.checksum, t) ||
          (d.tags || []).some(x => U.hit(x, t)) || U.hit(d.preview, t));
      }
      return rows;
    },

    stats() {
      const rows = files.all();
      const byCat = {};
      rows.forEach(d => { byCat[d.category || 'other'] = (byCat[d.category || 'other'] || 0) + 1; });
      return {
        count: rows.length,
        bytes: U.sum(rows, d => Number(d.size) || 0),
        byCategory: byCat,
        newest: U.sortBy(rows, d => d.uploadedAt || '', 'desc')[0] || null,
        links: rows.filter(d => d.projectId).length
      };
    },

    categories() {
      return [
        ['website', 'Website build', 'fa-globe'],
        ['source', 'Source code', 'fa-code'],
        ['design', 'Design & graphics', 'fa-palette'],
        ['document', 'Document', 'fa-file-lines'],
        ['contract', 'Contract / agreement', 'fa-file-signature'],
        ['invoice', 'Invoice / receipt', 'fa-file-invoice-dollar'],
        ['brand', 'Brand assets', 'fa-swatchbook'],
        ['media', 'Photo / video', 'fa-photo-film'],
        ['backup', 'Backup / archive', 'fa-box-archive'],
        ['other', 'Other', 'fa-paperclip']
      ];
    },
    categoryLabel(key) {
      const c = files.categories().filter(x => x[0] === key)[0];
      return c ? c[1] : 'Other';
    },
    categoryIcon(key) {
      const c = files.categories().filter(x => x[0] === key)[0];
      return c ? c[2] : 'fa-paperclip';
    },

    /** flag records whose bytes are no longer on this device */
    async audit() {
      const rows = files.all();
      let missing = 0;
      for (let i = 0; i < rows.length; i++) {
        const ok = await files.has(rows[i].id);
        if (!ok && !(rows[i].cloud && rows[i].cloud.driveId)) {
          missing++;
          if (!rows[i].missing) App.store.patch('documents', rows[i].id, { missing: true });
        } else if (ok && rows[i].missing) {
          App.store.patch('documents', rows[i].id, { missing: false });
        }
      }
      App.store.save();
      return { total: rows.length, missing: missing };
    }
  };
})(window);
