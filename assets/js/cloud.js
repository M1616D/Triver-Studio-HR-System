/* =============================================================================
   Triverse OS — Google Drive
   Two jobs, both opt-in:

     1. Keep the workspace itself in the studio's own Drive. Open the system on
        any other computer, sign in with the same Google account, and the whole
        operation — clients, invoices, projects, file index — is there.
     2. Keep the actual file vault in Drive too, so a build folder or a design
        source is not trapped on one laptop.

   It talks to the Google Identity Services token client and the Drive REST API
   directly; there is no server in the middle and nothing is sent anywhere else.
   The app asks only for the drive.file scope, which means it can see the files
   it created and nothing else in the account.
   ========================================================================== */
(function (global) {
  'use strict';

  const App = global.App;
  const U = App.util;

  const SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const GIS_SRC = 'https://accounts.google.com/gsi/client';
  const FOLDER_NAME = 'Triverse OS';
  const BACKUP_NAME = 'triverse-workspace.json';
  const DRIVE = 'https://www.googleapis.com/drive/v3';
  const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

  let tokenClient = null;
  let gisLoading = null;
  let token = null;              /* { value, expiresAt } */
  let folderId = '';             /* remembered for the session */

  function clientId() { return String(App.store.get('settings.cloud.clientId', '') || '').trim(); }
  function connectedFlag() { return Boolean(App.store.get('settings.cloud.connected', false)); }

  function httpOrigin() {
    return location.protocol === 'http:' || location.protocol === 'https:';
  }

  function authHeader() {
    if (!token || Date.now() > token.expiresAt) throw new Error('Your Google session has expired. Press Connect again.');
    return { Authorization: 'Bearer ' + token.value };
  }

  function loadGis() {
    if (global.google && global.google.accounts && global.google.accounts.oauth2) return Promise.resolve();
    if (gisLoading) return gisLoading;
    gisLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = GIS_SRC;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Could not reach Google sign-in. Check the internet connection and try again.'));
      document.head.appendChild(s);
    });
    return gisLoading;
  }

  async function json(res) {
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
    if (!res.ok) {
      const msg = (data && data.error && (data.error.message || data.error)) || ('Drive returned HTTP ' + res.status);
      const err = new Error(String(msg));
      err.status = res.status;
      if (res.status === 401 || res.status === 403) err.auth = true;
      throw err;
    }
    return data;
  }

  function explain(err) {
    const raw = String((err && err.message) || err || '');
    if (/has not been used in project|is disabled/i.test(raw)) {
      return 'Google Drive API is not enabled for the project that owns your OAuth client.\n' +
        'Open console.cloud.google.com → APIs & Services → Library → “Google Drive API” → Enable, then press Connect again.\n\n' + raw;
    }
    if (/redirect_uri_mismatch|origin_mismatch|origin/i.test(raw)) {
      return 'This address is not authorised in your OAuth client.\n' +
        'In Google Cloud → Credentials → your OAuth client → Authorised JavaScript origins, add:\n' + location.origin + '\n\n' + raw;
    }
    if (/idpiframe|third-party cookies|storage/i.test(raw)) {
      return 'The browser blocked Google sign-in storage. Allow third-party cookies for accounts.google.com, or open the app in a normal window (not private mode).\n\n' + raw;
    }
    return raw;
  }

  const cloud = App.cloud = {
    SCOPE: SCOPE,
    FOLDER_NAME: FOLDER_NAME,
    BACKUP_NAME: BACKUP_NAME,

    hasClientId() { return clientId().length > 20; },
    isConnected() { return Boolean(token && Date.now() < token.expiresAt); },
    configured() { return connectedFlag() || cloud.isConnected(); },

    status() {
      return {
        origin: location.origin,
        http: httpOrigin(),
        clientId: clientId(),
        hasClientId: cloud.hasClientId(),
        authorized: cloud.isConnected(),
        connected: connectedFlag(),
        account: App.store.get('settings.cloud.account', ''),
        lastSync: App.store.get('settings.cloud.lastSync', ''),
        lastPull: App.store.get('settings.cloud.lastPull', ''),
        auto: Boolean(App.store.get('settings.cloud.auto', false)),
        backupId: App.store.get('settings.cloud.backupId', '')
      };
    },

    /* ------------------------------------------------------------ sign in */
    async connect(interactive) {
      if (!httpOrigin()) {
        throw new Error('Google sign-in only works from a web address, never from a file opened straight off the disk.\n\n' +
          'Run “npm start” in this folder, then open http://localhost:8099 in the browser. Your workspace and files are the same either way.');
      }
      if (!cloud.hasClientId()) {
        throw new Error('Add your Google OAuth Client ID in Settings → Cloud first. The next card explains exactly where to get it.');
      }
      await loadGis();
      return new Promise((resolve, reject) => {
        try {
          tokenClient = global.google.accounts.oauth2.initTokenClient({
            client_id: clientId(),
            scope: SCOPE,
            prompt: interactive === false ? '' : 'consent',
            callback: resp => {
              if (resp && resp.access_token) {
                token = { value: resp.access_token, expiresAt: Date.now() + (Number(resp.expires_in || 3600) - 60) * 1000 };
                App.store.set('settings.cloud.connected', true, { silent: true });
                App.store.save();
                Promise.resolve()
                  .then(() => cloud.account())
                  .then(acct => { if (acct) App.store.set('settings.cloud.account', acct, { silent: true }); App.store.save(); })
                  .then(() => resolve(true))
                  .catch(() => resolve(true));
              } else {
                reject(new Error('Google sign-in was closed before it finished. Nothing was changed.'));
              }
            },
            error_callback: e => reject(new Error(explain({ message: (e && (e.message || e.type)) || 'Google sign-in failed.' })))
          });
          tokenClient.requestAccessToken();
        } catch (e) { reject(new Error(explain(e))); }
      });
    },

    disconnect() {
      try { if (token && global.google && global.google.accounts) global.google.accounts.oauth2.revoke(token.value); } catch (e) {}
      token = null; folderId = '';
      App.store.set('settings.cloud.connected', false, { silent: true });
      App.store.set('settings.cloud.lastSync', '', { silent: true });
      App.store.save();
    },

    async ensureToken() {
      if (cloud.isConnected()) return true;
      return cloud.connect(connectedFlag() ? false : true);
    },

    async account() {
      try {
        const r = await fetch(DRIVE + '/about?fields=user(emailAddress,displayName)', { headers: authHeader() });
        const d = await json(r);
        return (d && d.user && (d.user.emailAddress || d.user.displayName)) || '';
      } catch (e) { return ''; }
    },

    /* ---------------------------------------------------------- folder */
    async folder() {
      if (folderId) return folderId;
      await cloud.ensureToken();
      const q = "name='" + FOLDER_NAME + "' and mimeType='application/vnd.google-apps.folder' and trashed=false";
      const r = await fetch(DRIVE + '/files?q=' + encodeURIComponent(q) + '&fields=files(id,name)&spaces=drive', { headers: authHeader() });
      const d = await json(r);
      if (d.files && d.files.length) { folderId = d.files[0].id; return folderId; }
      const create = await fetch(DRIVE + '/files?fields=id', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, authHeader()),
        body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' })
      });
      const made = await json(create);
      folderId = made.id;
      return folderId;
    },

    /* ------------------------------------------------------------ backup */
    /** push the whole workspace up as one JSON file, replacing the previous copy */
    async backupNow(reason) {
      try {
        await cloud.ensureToken();
        const folder = await cloud.folder();
        const payload = App.store.export();
        const blob = new Blob([payload], { type: 'application/json' });
        const existing = App.store.get('settings.cloud.backupId', '');

        const meta = { name: BACKUP_NAME, parents: [folder], mimeType: 'application/json' };
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
        form.append('file', blob);

        let r;
        if (existing) {
          r = await fetch(UPLOAD + '/files/' + encodeURIComponent(existing) + '?uploadType=multipart&fields=id,modifiedTime', {
            method: 'PATCH', headers: authHeader(), body: form
          });
          if (r.status === 404) {
            App.store.set('settings.cloud.backupId', '', { silent: true });
            r = await fetch(UPLOAD + '/files?uploadType=multipart&fields=id,modifiedTime', { method: 'POST', headers: authHeader(), body: form });
          }
        } else {
          r = await fetch(UPLOAD + '/files?uploadType=multipart&fields=id,modifiedTime', { method: 'POST', headers: authHeader(), body: form });
        }
        const d = await json(r);
        App.store.set('settings.cloud.backupId', d.id, { silent: true });
        App.store.set('settings.cloud.lastSync', U.now(), { silent: true });
        App.store.set('settings.cloud.lastSyncReason', reason || 'manual', { silent: true });
        App.store.save();
        App.log('cloud', 'Workspace backed up to Google Drive (' + U.bytes(payload.length) + ')', '');
        return { id: d.id, bytes: payload.length };
      } catch (e) {
        throw new Error(explain(e));
      }
    },

    /** the newest backup file in the Drive folder */
    async listBackups() {
      try {
        await cloud.ensureToken();
        const folder = await cloud.folder();
        const q = "'" + folder + "' in parents and trashed=false";
        const r = await fetch(DRIVE + '/files?q=' + encodeURIComponent(q) +
          '&fields=files(id,name,mimeType,size,modifiedTime,webViewLink)&orderBy=modifiedTime%20desc&pageSize=100',
          { headers: authHeader() });
        const d = await json(r);
        return (d.files || []);
      } catch (e) { throw new Error(explain(e)); }
    },

    /** pull the workspace back — the answer to “open it on another device” */
    async restoreLatest() {
      const rows = await cloud.listBackups();
      const file = rows.filter(f => f.name === BACKUP_NAME)[0] || rows.filter(f => /\.json$/.test(f.name))[0];
      if (!file) throw new Error('No workspace backup found in the “' + FOLDER_NAME + '” folder of that Google account yet.');
      const r = await fetch(DRIVE + '/files/' + encodeURIComponent(file.id) + '?alt=media', { headers: authHeader() });
      if (!r.ok) throw new Error(explain(new Error('Drive returned HTTP ' + r.status)));
      const text = await r.text();
      App.store.importJSON(text);
      App.store.set('settings.cloud.lastPull', U.now(), { silent: true });
      App.store.save();
      App.log('cloud', 'Workspace restored from Google Drive (' + file.name + ')', '');
      return { name: file.name, modifiedTime: file.modifiedTime };
    },

    /* -------------------------------------------------------- vault files */
    /** put one vault file into Drive, so it survives losing the laptop */
    async uploadFile(doc) {
      const record = typeof doc === 'string' ? App.store.find('documents', doc) : doc;
      if (!record) throw new Error('That file record no longer exists.');
      const blob = await App.files.get(record.id);
      if (!blob) throw new Error('The stored bytes for “' + record.name + '” are missing from this device.');
      try {
        await cloud.ensureToken();
        const folder = await cloud.folder();
        const existing = (record.cloud || {}).driveId;
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify({ name: record.name, parents: existing ? undefined : [folder] })], { type: 'application/json' }));
        form.append('file', blob);
        let r;
        if (existing) {
          r = await fetch(UPLOAD + '/files/' + encodeURIComponent(existing) + '?uploadType=multipart&fields=id,modifiedTime,webViewLink', {
            method: 'PATCH', headers: authHeader(), body: form
          });
          if (r.status === 404) {
            const form2 = new FormData();
            form2.append('metadata', new Blob([JSON.stringify({ name: record.name, parents: [folder] })], { type: 'application/json' }));
            form2.append('file', blob);
            r = await fetch(UPLOAD + '/files?uploadType=multipart&fields=id,modifiedTime,webViewLink', { method: 'POST', headers: authHeader(), body: form2 });
          }
        } else {
          r = await fetch(UPLOAD + '/files?uploadType=multipart&fields=id,modifiedTime,webViewLink', { method: 'POST', headers: authHeader(), body: form });
        }
        const d = await json(r);
        App.store.patch('documents', record.id, {
          cloud: { driveId: d.id, syncedAt: U.now(), link: d.webViewLink || '', bytes: record.size }
        });
        App.store.set('settings.cloud.lastSync', U.now(), { silent: true });
        App.store.save();
        return d;
      } catch (e) { throw new Error(explain(e)); }
    },

    /** everything that has bytes on this device but no copy in Drive yet */
    unsynced() {
      return App.files.all().filter(d => !(d.cloud && d.cloud.driveId));
    },

    /** push every unsynced vault file, one at a time, reporting progress */
    async syncAllFiles(onProgress) {
      const rows = cloud.unsynced();
      let done = 0;
      const failed = [];
      for (let i = 0; i < rows.length; i++) {
        try { await cloud.uploadFile(rows[i]); }
        catch (e) { failed.push({ name: rows[i].name, error: e.message }); }
        done++;
        if (onProgress) onProgress(done, rows.length);
      }
      App.store.set('settings.cloud.lastSync', U.now(), { silent: true });
      App.store.save();
      return { total: rows.length, done: done, failed: failed };
    },

    /** pull a file back down from Drive using the record's Drive id */
    async fetchFile(doc) {
      const record = typeof doc === 'string' ? App.store.find('documents', doc) : doc;
      if (!record || !(record.cloud || {}).driveId) throw new Error('This file has no copy in Drive.');
      await cloud.ensureToken();
      const r = await fetch(DRIVE + '/files/' + encodeURIComponent(record.cloud.driveId) + '?alt=media', { headers: authHeader() });
      if (!r.ok) throw new Error(explain(new Error('Drive returned HTTP ' + r.status)));
      const blob = await r.blob();
      await App.files.put(record.id, blob);
      App.store.patch('documents', record.id, { missing: false, backend: 'drive+local' });
      App.store.save(true);
      return blob;
    },

    /** the studio's own Drive folder, opened in a new tab */
    async openFolder() {
      const id = await cloud.folder();
      U.openUrl('https://drive.google.com/drive/folders/' + id);
    }
  };

  /* one quiet automatic backup after real changes, at most every few minutes */
  let autoTimer = null;
  App.on('state:changed', () => {
    if (!App.store.get('settings.cloud.auto', false)) return;
    if (!cloud.configured()) return;
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => {
      cloud.backupNow('auto').catch(e => {
        App.store.set('settings.cloud.lastError', String(e.message).split('\n')[0], { silent: true });
        App.store.save();
      });
    }, 4 * 60 * 1000);
  });
})(window);
