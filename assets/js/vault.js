/* =============================================================================
   Triverse OS — workspace vault and sign-in
   The whole workspace (businesses, clients, invoices, websites, files metadata)
   is encrypted at rest with AES-GCM 256. The key is derived from the owner's
   passphrase with PBKDF2-SHA256 and is only ever held in memory, so closing the
   tab — or leaving the screen idle — puts the workspace back behind the lock.

   Nothing here is theatre: without the passphrase (or the recovery code) the
   stored bytes cannot be read, because the passphrase is what decrypts the key.
   ========================================================================== */
(function (global) {
  'use strict';

  const App = global.App;
  const U = App.util;

  const META_KEY = 'triverse.os.vault';
  const BLOB_KEY = 'triverse.os.state.enc';
  const ATTEMPT_KEY = 'triverse.os.vault.attempts';
  const PLAIN_KEY = 'triverse.os.state.v1';

  const ITERATIONS = 310000;      /* PBKDF2-SHA256 rounds */
  const VERIFY_TEXT = 'triverse-os/vault-verify/v1';

  /* ------------------------------ byte helpers ----------------------------- */
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  function rand(n) {
    const b = new Uint8Array(n);
    (global.crypto || {}).getRandomValues ? global.crypto.getRandomValues(b) : b.forEach((_, i) => { b[i] = Math.floor(Math.random() * 256); });
    return b;
  }

  function b64(bytes) {
    let s = '';
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return global.btoa(s);
  }

  function unb64(text) {
    const raw = global.atob(String(text || ''));
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function hexFromBytes(bytes) {
    return Array.prototype.map.call(bytes, b => ('00' + b.toString(16)).slice(-2)).join('');
  }

  /* ------------------------------ crypto core ------------------------------ */
  const subtle = () => (global.crypto && global.crypto.subtle) || null;
  const available = () => Boolean(subtle());

  async function deriveRaw(pass, saltB64, iterations) {
    const s = subtle();
    const base = await s.importKey('raw', enc.encode(String(pass)), 'PBKDF2', false, ['deriveBits']);
    const bits = await s.deriveBits(
      { name: 'PBKDF2', salt: unb64(saltB64), iterations: iterations || ITERATIONS, hash: 'SHA-256' },
      base, 256
    );
    return new Uint8Array(bits);
  }

  async function keyFromRaw(raw) {
    return subtle().importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }

  async function seal(key, plainBytes) {
    const iv = rand(12);
    const ct = await subtle().encrypt({ name: 'AES-GCM', iv: iv }, key, plainBytes);
    return { iv: b64(iv), ct: b64(new Uint8Array(ct)) };
  }

  async function open(key, rec) {
    const iv = unb64(rec.iv);
    const ct = unb64(rec.ct);
    const buf = await subtle().decrypt({ name: 'AES-GCM', iv: iv }, key, ct);
    return new Uint8Array(buf);
  }

  /* ---------------------------- recovery code ------------------------------ */
  const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  function makeRecoveryCode() {
    const bytes = rand(24);
    let out = '';
    for (let i = 0; i < 24; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    return out.match(/.{1,4}/g).join('-');
  }

  const normaliseCode = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  /* -------------------------------- storage -------------------------------- */
  function readJSON(key) {
    try { const raw = global.localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function writeJSON(key, obj) {
    try { global.localStorage.setItem(key, JSON.stringify(obj)); return true; } catch (e) { return false; }
  }

  /* ------------------------------ the vault -------------------------------- */
  const vault = App.vault = {
    meta: readJSON(META_KEY),
    masterKey: null,          /* CryptoKey — memory only, never persisted */
    masterRaw: null,          /* the random 32 bytes the data key is built from */
    statePayload: null,       /* the decrypted workspace object while unlocked */
    lastActivity: Date.now(),
    idleTimer: null,
    saveTimer: null,
    onLock: null,
    onChange: null,

    available: available,
    has() { return Boolean(vault.meta && vault.meta.wrappedPass); },
    active() { return Boolean(vault.masterKey); },
    locked() { return vault.has() && !vault.active(); },

    /* ------------------------------------------------------------ creation */
    /**
     * Turn an unprotected workspace into an encrypted one.
     * @param pass     the owner's passphrase
     * @param stateObj the workspace to protect
     */
    async create(pass, stateObj, opts) {
      opts = opts || {};
      if (!available()) throw new Error('This browser cannot encrypt the workspace. Open the app over http://localhost (npm start) instead of from the file system.');
      const salt = b64(rand(16));
      const recSalt = b64(rand(16));
      const recoveryCode = makeRecoveryCode();

      const rawPass = await deriveRaw(pass, salt);
      const rawRec = await deriveRaw(normaliseCode(recoveryCode), recSalt);

      const masterRaw = rand(32);
      const masterKey = await keyFromRaw(masterRaw);

      vault.meta = {
        v: 1,
        createdAt: U.now(),
        iterations: ITERATIONS,
        salt: salt,
        recSalt: recSalt,
        wrappedPass: await seal(await keyFromRaw(rawPass), masterRaw),
        wrappedRec: await seal(await keyFromRaw(rawRec), masterRaw),
        hint: String(opts.hint || '').slice(0, 80),
        autoLockMinutes: Number(opts.autoLockMinutes || 30),
        lastSaved: U.now()
      };
      writeJSON(META_KEY, vault.meta);
      vault.masterRaw = masterRaw;
      vault.masterKey = masterKey;
      vault.statePayload = stateObj;
      await vault.write(stateObj);
      vault.clearPlaintext();
      vault.touch();
      return { recoveryCode: recoveryCode };
    },

    /* ------------------------------------------------------------- unlock */
    async unlock(pass) {
      if (!vault.has()) throw new Error('No protected workspace on this device yet.');
      const raw = await deriveRaw(pass, vault.meta.salt, vault.meta.iterations);
      let masterRaw;
      try {
        masterRaw = await open(await keyFromRaw(raw), vault.meta.wrappedPass);
      } catch (e) {
        throw new Error('That passphrase does not open this workspace.');
      }
      vault.masterRaw = new Uint8Array(masterRaw);
      vault.masterKey = await keyFromRaw(vault.masterRaw);
      const state = await vault.read();
      vault.lastActivity = Date.now();
      vault.touch();
      return state;
    },

    /** use the recovery code instead of the passphrase */
    async unlockWithRecovery(code, newPass) {
      if (!vault.has()) throw new Error('No protected workspace on this device yet.');
      const rawRec = await deriveRaw(normaliseCode(code), vault.meta.recSalt, vault.meta.iterations);
      let masterRaw;
      try {
        masterRaw = await open(await keyFromRaw(rawRec), vault.meta.wrappedRec);
      } catch (e) {
        throw new Error('That recovery code does not match this workspace.');
      }
      vault.masterRaw = new Uint8Array(masterRaw);
      vault.masterKey = await keyFromRaw(vault.masterRaw);
      const next = makeRecoveryCode();
      vault.meta.salt = b64(rand(16));
      vault.meta.recSalt = b64(rand(16));
      vault.meta.wrappedPass = await seal(await keyFromRaw(await deriveRaw(newPass, vault.meta.salt)), vault.masterRaw);
      vault.meta.wrappedRec = await seal(await keyFromRaw(await deriveRaw(normaliseCode(next), vault.meta.recSalt)), vault.masterRaw);
      writeJSON(META_KEY, vault.meta);
      const state = await vault.read();
      vault.touch();
      return { state: state, recoveryCode: next };
    },

    /* ------------------------------------------------------- read / write */
    async read() {
      const rec = readJSON(BLOB_KEY);
      if (!rec) throw new Error('The encrypted workspace file is missing from this browser.');
      const bytes = await open(vault.masterKey, rec);
      vault.statePayload = JSON.parse(dec.decode(bytes));
      return vault.statePayload;
    },

    async write(stateObj) {
      if (!vault.active()) return false;
      const bytes = enc.encode(JSON.stringify(stateObj));
      const rec = await seal(vault.masterKey, bytes);
      rec.savedAt = U.now();
      rec.bytes = bytes.length;
      const ok = writeJSON(BLOB_KEY, rec);
      if (ok) {
        vault.meta.lastSaved = U.now();
        vault.meta.lastBytes = bytes.length;
        writeJSON(META_KEY, vault.meta);
      }
      if (vault.onChange) vault.onChange();
      return ok;
    },

    /** debounced save — every screen mutates state constantly, encryption is not free */
    persist(stateObj) {
      if (!vault.active()) return;
      clearTimeout(vault.saveTimer);
      vault.saveTimer = setTimeout(() => { vault.write(stateObj).catch(() => {}); }, 450);
    },

    flush(stateObj) {
      clearTimeout(vault.saveTimer);
      return vault.active() ? vault.write(stateObj) : Promise.resolve(false);
    },

    /* --------------------------------------------------------- lock / idle */
    lock(reason) {
      if (!vault.has()) return;
      clearTimeout(vault.saveTimer);
      if (vault.masterKey && App.store.state) vault.write(App.store.state).catch(() => {});
      vault.masterKey = null;
      vault.masterRaw = null;
      vault.statePayload = null;
      vault.clearPlaintext();
      if (vault.onLock) vault.onLock(reason || 'locked');
    },

    touch() {
      vault.lastActivity = Date.now();
      if (vault.meta && vault.meta.autoLockMinutes) vault.scheduleIdle();
    },

    scheduleIdle() {
      clearInterval(vault.idleTimer);
      const mins = Number((vault.meta || {}).autoLockMinutes || 0);
      if (!mins || mins < 0) return;
      vault.idleTimer = setInterval(() => {
        if (!vault.active()) return;
        if (Date.now() - vault.lastActivity > mins * 60000) vault.lock('idle');
      }, 20000);
    },

    setAutoLock(minutes) {
      const m = Math.max(0, Number(minutes) || 0);
      vault.meta.autoLockMinutes = m;
      writeJSON(META_KEY, vault.meta);
      vault.scheduleIdle();
    },

    /* ------------------------------------------------------- passphrase ---- */
    async check(pass) {
      if (!vault.has()) return false;
      try {
        await open(await keyFromRaw(await deriveRaw(pass, vault.meta.salt, vault.meta.iterations)), vault.meta.wrappedPass);
        return true;
      } catch (e) { return false; }
    },

    async changePass(pass, next) {
      if (!(await vault.check(pass))) throw new Error('The current passphrase is not correct.');
      vault.meta.salt = b64(rand(16));
      vault.meta.wrappedPass = await seal(await keyFromRaw(await deriveRaw(next, vault.meta.salt)), vault.masterRaw);
      writeJSON(META_KEY, vault.meta);
      return true;
    },

    async setHint(pass, hint) {
      if (!(await vault.check(pass))) throw new Error('The current passphrase is not correct.');
      vault.meta.hint = String(hint || '').slice(0, 80);
      writeJSON(META_KEY, vault.meta);
      return true;
    },

    async rotateRecovery(pass) {
      if (!(await vault.check(pass))) throw new Error('The current passphrase is not correct.');
      const code = makeRecoveryCode();
      vault.meta.recSalt = b64(rand(16));
      vault.meta.wrappedRec = await seal(await keyFromRaw(await deriveRaw(normaliseCode(code), vault.meta.recSalt)), vault.masterRaw);
      writeJSON(META_KEY, vault.meta);
      return code;
    },

    /** remove the lock and go back to an unencrypted local workspace */
    async remove(pass) {
      if (!(await vault.check(pass))) throw new Error('That passphrase does not open this workspace.');
      const state = await vault.read();
      clearInterval(vault.idleTimer);
      try {
        global.localStorage.setItem(PLAIN_KEY, JSON.stringify(state));
        global.localStorage.removeItem(META_KEY);
        global.localStorage.removeItem(BLOB_KEY);
      } catch (e) { throw new Error('Could not write the unprotected copy: ' + e.message); }
      vault.meta = null; vault.masterKey = null; vault.masterRaw = null; vault.statePayload = null;
      return state;
    },

    clearPlaintext() {
      try { global.localStorage.removeItem(PLAIN_KEY); } catch (e) {}
    },

    /* ------------------------------------------------------------- summary */
    summary() {
      const m = vault.meta || {};
      return {
        protected: vault.has(),
        unlocked: vault.active(),
        createdAt: m.createdAt || '',
        lastSaved: m.lastSaved || '',
        autoLockMinutes: Number(m.autoLockMinutes || 0),
        hint: m.hint || '',
        bytes: Number(m.lastBytes || 0)
      };
    }
  };

  /* --------------------------------- attempts -------------------------------- */
  const attempts = App.vaultAttempts = {
    read() { return readJSON(ATTEMPT_KEY) || { fails: 0, until: 0 }; },
    /** exponential back-off after repeated wrong passphrases */
    penalty() {
      const a = attempts.read();
      return a.until && Date.now() < a.until ? Math.ceil((a.until - Date.now()) / 1000) : 0;
    },
    fail() {
      const a = attempts.read();
      a.fails = (a.fails || 0) + 1;
      if (a.fails >= 4) a.until = Date.now() + Math.min(300, Math.pow(2, a.fails - 4) * 15) * 1000;
      writeJSON(ATTEMPT_KEY, a);
      return a.fails;
    },
    reset() { writeJSON(ATTEMPT_KEY, { fails: 0, until: 0 }); }
  };

  /* ------------------------------- the lock screen --------------------------- */
  let overlay = null;
  let onSubmit = null;

  function brand() {
    const co = App.store.get('settings.company', {}) || {};
    const logo = (App.brand && App.brand.logo()) || '';
    const initials = String(co.shortName || co.name || 'TS').split(' ').map(w => w[0] || '').slice(0, 2).join('').toUpperCase();
    return {
      name: co.name || 'Triverse Studio',
      tagline: co.tagline || '',
      mark: logo
        ? '<img src="' + U.attr(logo) + '" alt="" class="lock-logo__img" />'
        : '<span class="lock-logo__letters">' + U.esc(initials) + '</span>'
    };
  }

  function shell(inner) {
    const b = brand();
    return '<div class="lock-backdrop"><div class="lock-glow"></div>' +
      '<div class="lock-card glass-card">' +
      '<div class="lock-brand">' +
      '<div class="lock-logo">' + b.mark + '</div>' +
      '<div class="min-w-0">' +
      '<p class="lock-brand__name">' + U.esc(b.name) + '</p>' +
      '<p class="lock-brand__sub">' + U.esc(b.tagline || 'Business development system') + '</p>' +
      '</div></div>' + inner +
      '<p class="lock-foot">' + U.esc(locationLabel()) + ' · encrypted with AES-256-GCM</p>' +
      '</div></div>';
  }

  function locationLabel() {
    return location.protocol === 'file:' ? 'this computer' : location.host;
  }

  function mount(html) {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'lock-screen';
      overlay.className = 'lock-screen';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = html;
    return overlay;
  }

  function showSignIn(message) {
    const m = vault.meta || {};
    mount(shell(
      '<div class="lock-body">' +
      '<p class="lock-title">Unlock your workspace</p>' +
      '<p class="lock-note">Every business, client, invoice and website file on this device is encrypted. Your passphrase is the only key.</p>' +
      (message ? '<p class="lock-error">' + U.esc(message) + '</p>' : '') +
      (m.hint ? '<p class="lock-hint">Hint: ' + U.esc(m.hint) + '</p>' : '') +
      '<label class="lock-label" for="lock-pass">Passphrase</label>' +
      '<div class="lock-field">' +
      '<input id="lock-pass" class="lock-input" type="password" autocomplete="current-password" spellcheck="false" placeholder="Enter your passphrase" />' +
      '<button type="button" class="lock-reveal" data-lock="reveal" title="Show or hide"><i class="fa-solid fa-eye"></i></button>' +
      '</div>' +
      '<button class="lock-submit" data-lock="go">Unlock</button>' +
      '<div class="lock-links">' +
      '<button type="button" class="lock-link" data-lock="recovery">Use the recovery code</button>' +
      '<button type="button" class="lock-link" data-lock="restore">Restore a backup file</button>' +
      '</div>' +
      '</div>'
    ));
    wire();
    const pass = document.getElementById('lock-pass');
    if (pass) pass.focus();
  }

  function showRecovery(message) {
    mount(shell(
      '<div class="lock-body">' +
      '<p class="lock-title">Use your recovery code</p>' +
      '<p class="lock-note">The 24-character code you saved when the workspace was protected. You will choose a new passphrase straight after.</p>' +
      (message ? '<p class="lock-error">' + U.esc(message) + '</p>' : '') +
      '<label class="lock-label" for="rec-code">Recovery code</label>' +
      '<input id="rec-code" class="lock-input" type="text" spellcheck="false" autocomplete="off" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" />' +
      '<label class="lock-label" for="rec-new">New passphrase</label>' +
      '<input id="rec-new" class="lock-input" type="password" autocomplete="new-password" placeholder="At least 10 characters" />' +
      '<label class="lock-label" for="rec-new2">Repeat the new passphrase</label>' +
      '<input id="rec-new2" class="lock-input" type="password" autocomplete="new-password" />' +
      '<button class="lock-submit" data-lock="recover">Recover the workspace</button>' +
      '<div class="lock-links"><button type="button" class="lock-link" data-lock="back">Back to sign in</button></div>' +
      '</div>'
    ));
    wire();
    const code = document.getElementById('rec-code');
    if (code) code.focus();
  }

  function showSetup(opts) {
    opts = opts || {};
    mount(shell(
      '<div class="lock-body">' +
      '<p class="lock-title">' + (opts.title || 'Choose a passphrase') + '</p>' +
      '<p class="lock-note">' + (opts.note || 'From now on the workspace on this device is encrypted. There is no server and no reset link — your passphrase and the recovery code are the only way in.') + '</p>' +
      '<p id="setup-error" class="lock-error" style="display:none"></p>' +
      '<label class="lock-label" for="new-pass">Passphrase (10 characters or more)</label>' +
      '<input id="new-pass" class="lock-input" type="password" autocomplete="new-password" placeholder="A phrase you will remember" />' +
      '<label class="lock-label" for="new-pass2">Repeat it</label>' +
      '<input id="new-pass2" class="lock-input" type="password" autocomplete="new-password" />' +
      '<label class="lock-label" for="new-hint">Hint shown on this screen (optional)</label>' +
      '<input id="new-hint" class="lock-input" type="text" maxlength="80" placeholder="Something only you would understand" />' +
      '<button class="lock-submit" data-lock="create">Protect the workspace</button>' +
      (opts.cancel ? '<div class="lock-links"><button type="button" class="lock-link" data-lock="cancel">Not now</button></div>' : '') +
      '</div>'
    ));
    wire();
    const pass = document.getElementById('new-pass');
    if (pass) pass.focus();
  }

  function showRecoveryCode(code) {
    mount(shell(
      '<div class="lock-body">' +
      '<p class="lock-title">Save your recovery code</p>' +
      '<p class="lock-note">This is the only way back in if the passphrase is forgotten. Write it down and keep it somewhere safe — it is shown once.</p>' +
      '<div class="lock-code" id="rec-output">' + U.esc(code) + '</div>' +
      '<div class="lock-links lock-links--row">' +
      '<button type="button" class="lock-link" data-lock="copycode">Copy</button>' +
      '<button type="button" class="lock-link" data-lock="downloadcode">Download as a file</button>' +
      '</div>' +
      '<label class="lock-agree"><input type="checkbox" id="rec-agree" /> I have written the code down and stored it safely.</label>' +
      '<button class="lock-submit" data-lock="finish" disabled id="rec-finish">Continue to the workspace</button>' +
      '</div>'
    ));
    wire();
    const agree = document.getElementById('rec-agree');
    const btn = document.getElementById('rec-finish');
    if (agree && btn) agree.addEventListener('change', () => { btn.disabled = !agree.checked; });
  }

  /* ---------------------------------- wiring -------------------------------- */
  function wire() {
    if (!overlay) return;
    overlay.querySelectorAll('[data-lock]').forEach(el => {
      el.addEventListener('click', () => handle(el.getAttribute('data-lock')));
    });
    ['new-pass', 'new-pass2', 'rec-new', 'rec-new2', 'lock-pass', 'rec-code'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('keydown', ev => {
        if (ev.key === 'Enter') {
          const map = { 'new-pass': 'create', 'new-pass2': 'create', 'lock-pass': 'go', 'rec-new': 'recover', 'rec-new2': 'recover', 'rec-code': 'recover' };
          handle(map[id]);
        }
      });
    });
  }

  function fail(message, target) {
    if (overlay && overlay.querySelector('.lock-error')) {
      const box = overlay.querySelector('.lock-error');
      box.textContent = message;
      box.style.display = '';
    }
    const btn = overlay && overlay.querySelector('.lock-submit');
    if (btn) { btn.disabled = false; btn.classList.remove('is-busy'); }
    if (target && typeof target === 'function') target();
  }

  function busy(label) {
    const btn = overlay && overlay.querySelector('.lock-submit');
    if (btn) { btn.disabled = true; btn.classList.add('is-busy'); btn.textContent = label || 'Working…'; }
  }

  async function handle(action) {
    const val = id => { const el = document.getElementById(id); return el ? el.value : ''; };
    if (action === 'reveal') {
      const el = document.getElementById('lock-pass');
      if (el) el.type = el.type === 'password' ? 'text' : 'password';
      return;
    }
    if (action === 'back') return showSignIn();

    if (action === 'go') {
      const wait = App.vaultAttempts.penalty();
      if (wait) return fail('Too many attempts. Try again in ' + wait + ' seconds.');
      const pass = val('lock-pass');
      if (!pass) return fail('Enter your passphrase.');
      busy('Unlocking…');
      try {
        const state = await vault.unlock(pass);
        App.vaultAttempts.reset();
        hide();
        if (onSubmit) onSubmit(state);
      } catch (e) {
        App.vaultAttempts.fail();
        showSignIn(e.message);
        const el = document.getElementById('lock-pass');
        if (el) { el.value = ''; el.focus(); }
      }
      return;
    }

    if (action === 'recover') {
      const code = val('rec-code'), a = val('rec-new'), b = val('rec-new2');
      if (normaliseCode(code).length < 24) return fail('Enter the full recovery code.');
      if (a.length < 10) return fail('The new passphrase needs at least 10 characters.');
      if (a !== b) return fail('The two passphrases do not match.');
      busy('Recovering…');
      try {
        const out = await vault.unlockWithRecovery(code, a);
        App.vaultAttempts.reset();
        showRecoveryCode(out.recoveryCode);
        onSubmit = onSubmit || null;
        vault._pendingState = out.state;
        const finish = document.getElementById('rec-finish');
        if (finish) finish.setAttribute('data-lock', 'finishrecovered');
        const agree = document.getElementById('rec-agree');
        if (agree) agree.checked = false;
        if (finish) finish.disabled = true;
      } catch (e) { fail(e.message); }
      return;
    }

    if (action === 'restore') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const fr = new FileReader();
        fr.onload = () => {
          let data = null;
          try { data = JSON.parse(String(fr.result)); } catch (e) { data = null; }
          if (!data || !data.state) return fail('That file is not a Triverse OS backup.');
          vault._setupState = data.state;
          vault._restoredSites = data.sites || {};
          showSetup({
            title: 'Protect the restored workspace',
            note: 'The backup was read successfully. Choose a passphrase and it replaces what is on this device, encrypted with that passphrase from now on.',
            cancel: true
          });
        };
        fr.onerror = () => fail('That file could not be read.');
        fr.readAsText(file);
      };
      input.click();
      return;
    }

    if (action === 'create') {
      const a = val('new-pass'), b = val('new-pass2');
      if (a.length < 10) return fail('Choose a passphrase of at least 10 characters.');
      if (a !== b) return fail('The two passphrases do not match.');
      busy('Encrypting…');
      try {
        const hint = val('new-hint');
        const out = await vault.create(a, vault._setupState, { hint: hint });
        vault.setAutoLock(Number(vault._setupAutoLock || 30));
        vault._setupState = null;
        showRecoveryCode(out.recoveryCode);
      } catch (e) { fail(e.message, null); }
      return;
    }

    if (action === 'copycode') {
      U.copy(String(document.getElementById('rec-output').textContent || '').trim());
      return;
    }
    if (action === 'downloadcode') {
      const code = String(document.getElementById('rec-output').textContent || '').trim();
      const co = App.store.get('settings.company', {}) || {};
      U.download('triverse-recovery-code.txt',
        'Triverse OS recovery code\n' +
        '=========================\n\n' +
        'Workspace: ' + (co.name || 'Triverse Studio') + '\n' +
        'Issued: ' + U.fmtDateTime(U.now()) + '\n\n' +
        'Recovery code:\n' + code + '\n\n' +
        'Keep this somewhere safe and off this computer. It is the only way back into the\n' +
        'workspace if the passphrase is forgotten. Entering it lets you set a new passphrase.\n',
        'text/plain');
      return;
    }
    if (action === 'finish' || action === 'finishrecovered') {
      /* a restored backup also carries the stored HTML of every generated site */
      if (vault._restoredSites) {
        Object.keys(vault._restoredSites).forEach(id => { try { App.store.setHTML(id, vault._restoredSites[id]); } catch (e) {} });
        vault._restoredSites = null;
      }
      hide();
      if (action === 'finishrecovered') { const st = vault._pendingState; vault._pendingState = null; if (onSubmit) onSubmit(st); }
      else if (onSubmit) onSubmit(vault.statePayload);
      return;
    }
    if (action === 'cancel') {
      hide();
      if (vault._onCancel) vault._onCancel();
      return;
    }
  }

  function hide() {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
  }

  /* ---------------------------------- API ---------------------------------- */
  /**
   * Show the lock screen.
   * @param opts.mode 'unlock' | 'setup' | 'recover' | 'code'
   * @param opts.onSubmit called with the decrypted state once the door opens
   */
  vault.screen = function (opts) {
    opts = opts || {};
    onSubmit = opts.onSubmit || onSubmit;
    vault._onCancel = opts.onCancel || null;
    vault._setupState = opts.state || null;
    vault._setupAutoLock = opts.autoLockMinutes || 30;
    if (opts.mode === 'setup') showSetup(opts);
    else if (opts.mode === 'recover') showRecovery();
    else if (opts.mode === 'code') showRecoveryCode(opts.code || '');
    else showSignIn(opts.message);
    return true;
  };
  vault.hide = hide;
  vault.showSignIn = showSignIn;
  vault.showSetup = showSetup;
  vault.showRecoveryCode = showRecoveryCode;

  /* idle detection: any real interaction keeps the workspace open */
  ['mousedown', 'keydown', 'touchstart', 'wheel'].forEach(evt => {
    global.addEventListener(evt, () => { if (vault.active()) vault.touch(); }, { passive: true });
  });

  /* saving the tab away should not leave an open workspace in memory — but the
     encrypted file is already on disk, so this is only about the live session */
  global.addEventListener('visibilitychange', () => {
    if (!document.hidden || !vault.active()) return;
    if (Number((vault.meta || {}).autoLockMinutes || 0) > 0 && Number((vault.meta || {}).autoLockMinutes) <= 5) vault.lock('hidden');
  });
})(window);
