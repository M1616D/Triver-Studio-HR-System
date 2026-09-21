/* =============================================================================
   Triverse OS — the way in
   A real sign-in page: sign in with Google to keep the whole workspace in the
   studio's own Drive folder and pick it up on any device, or open this device's
   copy. Nothing renders until this resolves.
   ========================================================================== */
(function (global) {
  'use strict';

  const App = global.App;
  const U = App.util;

  const SESSION_KEY = 'triverse.os.session';
  const SESSION_DAYS = 14;

  let overlay = null;
  let onDone = null;

  function readSession() {
    try {
      const raw = global.localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      return s && s.at ? s : null;
    } catch (e) { return null; }
  }

  function writeSession(info) {
    try { global.localStorage.setItem(SESSION_KEY, JSON.stringify(info || {})); } catch (e) {}
  }

  function company() { return App.store.get('settings.company', {}) || {}; }

  function mark() {
    const logo = App.brand && App.brand.logo ? App.brand.logo() : '';
    if (logo) return '<img src="' + U.attr(logo) + '" alt="" />';
    return '<span>' + U.esc(App.brand && App.brand.initials ? App.brand.initials() : 'TS') + '</span>';
  }

  function socials() {
    const co = company();
    const list = (App.dict && App.dict.socials) || [];
    const soc = co.socials || {};
    const links = list.map(s => {
      const raw = s.key === 'website' ? co.website : s.key === 'portfolio' ? co.portfolio : soc[s.key];
      const href = s.url(raw || '');
      if (!href) return '';
      return '<a href="' + U.esc(href) + '" target="_blank" rel="noopener" title="' + U.esc(s.label) + '" class="signin__social">' +
        '<i class="fa-' + (s.brand ? 'brands' : 'solid') + ' ' + s.icon + '"></i></a>';
    }).filter(Boolean);
    if (!links.length) return '';
    return '<div class="signin__socials">' + links.join('') + '</div>';
  }

  function mount(html) {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'signin-screen';
      overlay.className = 'signin';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = html;
    overlay.querySelectorAll('[data-signin]').forEach(el => {
      el.addEventListener('click', () => handle(el.getAttribute('data-signin')));
    });
    return overlay;
  }

  function note(message, tone) {
    const box = overlay && overlay.querySelector('.signin__message');
    if (!box) return;
    box.className = 'signin__message' + (tone ? ' is-' + tone : '');
    box.textContent = message || '';
    box.style.display = message ? '' : 'none';
  }

  function busy(button, label) {
    const btn = overlay && overlay.querySelector('[data-signin="' + button + '"]');
    if (btn) { btn.disabled = true; btn.classList.add('is-busy'); }
    overlay.querySelectorAll('.signin__actions button').forEach(b => { if (b !== btn) b.disabled = true; });
    if (label) note(label, 'busy');
  }

  function release() {
    if (!overlay) return;
    overlay.querySelectorAll('.signin__actions button').forEach(b => { b.disabled = false; b.classList.remove('is-busy'); });
  }

  function finish(info, payload) {
    writeSession(Object.assign({ at: Date.now(), device: deviceLabel() }, info || {}));
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
    const next = onDone;
    onDone = null;
    if (next) next(payload);
  }

  function deviceLabel() {
    return location.host || (location.protocol === 'file:' ? 'this computer' : location.hostname);
  }

  function show() {
    const co = company();
    const wired = App.cloud && App.cloud.hasClientId();
    mount(
      '<div class="signin__glow" aria-hidden="true"></div>' +
      '<div class="signin__shell">' +

      '<section class="signin__aside">' +
        '<div class="signin__brand">' +
          '<span class="signin__mark">' + mark() + '</span>' +
          '<span><b>' + U.esc(co.name || 'Triverse Studio') + '</b>' +
          '<i>' + U.esc(co.tagline || 'Software solution & digital studio') + '</i></span>' +
        '</div>' +
        '<h1 class="signin__headline">Every client, website,<br />invoice and file —<br /><em>in one place.</em></h1>' +
        '<ul class="signin__points">' +
          '<li>' + App.ui.icon('fa-cloud-arrow-up', 'text-accentMint') + ' The whole workspace lives in your Google Drive folder.</li>' +
          '<li>' + App.ui.icon('fa-mobile-screen', 'text-accentMint') + ' Sign in on any device and everything is already there.</li>' +
          '<li>' + App.ui.icon('fa-lock', 'text-accentMint') + ' AES-256 encryption when you protect the workspace with a passphrase.</li>' +
          '<li>' + App.ui.icon('fa-map-location-dot', 'text-accentMint') + ' Find businesses, build their site, message them, get paid.</li>' +
        '</ul>' +
        socials() +
        '<p class="signin__foot">' + U.esc(deviceLabel()) + '</p>' +
      '</section>' +

      '<section class="signin__panel">' +
        '<div class="signin__card">' +
          '<p class="signin__eyebrow">Welcome</p>' +
          '<h2 class="signin__title">Sign in</h2>' +
          '<p class="signin__sub">Choose how this device loads the studio workspace.</p>' +

          '<div class="signin__message" style="display:none"></div>' +

          '<div class="signin__actions">' +
            '<button type="button" class="signin__btn signin__btn--google" data-signin="google"' + (wired ? '' : ' disabled') + '>' +
              '<i class="fa-brands fa-google"></i><span>Continue with Google Drive</span>' +
            '</button>' +
            (wired ? '' :
              '<p class="signin__hint">Google sign-in is off until the OAuth client ID is saved in Settings → Cloud.</p>') +
            '<div class="signin__or"><span>or</span></div>' +
            '<button type="button" class="signin__btn" data-signin="device">' +
              '<i class="fa-solid fa-laptop"></i><span>Continue on this device</span>' +
            '</button>' +
            (App.vault.has()
              ? '<p class="signin__hint">This device\u2019s copy is passphrase-protected — you will be asked for it after you choose.</p>'
              : '') +
            '<button type="button" class="signin__btn signin__btn--quiet" data-signin="file">' +
              '<i class="fa-solid fa-file-import"></i><span>Open a backup file</span></button>' +
          '</div>' +

          '<p class="signin__legal">Your data stays yours. Nothing is uploaded anywhere unless you press the Google button above.</p>' +
        '</div>' +
      '</section>' +
      '</div>'
    );
  }

  async function handle(action) {
    if (action === 'device') {
      if (App.vault.has()) {
        note('This device\u2019s copy is protected. Enter the passphrase to open it.', 'busy');
        App.vault.screen({
          mode: 'unlock',
          onCancel: show,
          onSubmit: state => finish({ mode: 'passphrase' }, state)
        });
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        overlay = null;
        return;
      }
      finish({ mode: 'device' });
      return;
    }

    if (action === 'google') {
      busy('google', 'Opening Google sign-in…');
      try {
        await App.cloud.connect(true);
        note('Reading the studio folder in Drive…', 'busy');
        const info = await App.cloud.restoreLatest();
        App.store.load();
        App.store.set('settings.cloud.connected', true, { silent: true });
        App.store.set('settings.cloud.account', App.store.get('settings.cloud.account', ''), { silent: true });
        App.store.save();
        finish({ mode: 'google', account: App.store.get('settings.cloud.account', ''), restored: info && info.name });
      } catch (e) {
        release();
        note(String((e && e.message) || e).split('\n').slice(0, 2).join(' '), 'error');
      }
      return;
    }

    if (action === 'file') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = () => {
        const file = input.files && input.files[0];
        if (!file) return;
        busy('file', 'Reading the backup…');
        const fr = new FileReader();
        fr.onload = () => {
          let data = null;
          try { data = JSON.parse(String(fr.result)); } catch (e) { data = null; }
          if (!data || !data.state) { release(); note('That file is not a Triverse Studio backup.', 'error'); return; }
          App.store.importJSON(String(fr.result));
          App.store.load();
          finish({ mode: 'file' });
        };
        fr.onerror = () => { release(); note('That file could not be read.', 'error'); };
        fr.readAsText(file);
      };
      input.click();
    }
  }

  const auth = App.auth = {
    KEY: SESSION_KEY,

    signedIn() {
      const s = readSession();
      return Boolean(s && s.at && (Date.now() - s.at) < SESSION_DAYS * 24 * 60 * 60 * 1000);
    },
    account() { const s = readSession(); return (s && s.account) || ''; },
    mode() { const s = readSession(); return (s && s.mode) || ''; },
    signedInAt() { const s = readSession(); return (s && s.at) || 0; },

    mark(info) { writeSession(Object.assign({ at: Date.now() }, info || {})); },

    signOut() {
      try { global.localStorage.removeItem(SESSION_KEY); } catch (e) {}
      if (App.cloud) { try { App.cloud.disconnect(); } catch (e) {} }
      location.reload();
    },

    /**
     * The door. This page appears unless the device is already signed in; a
     * passphrase-protected workspace asks for its passphrase only after a
     * choice is made, so the page is never a form to fill in.
     */
    begin(next) {
      onDone = next;
      if (auth.signedIn()) { onDone = null; next(); return; }
      show();
    },

    /** re-open the page on purpose (Settings → sign out / switch account) */
    open(next) {
      onDone = next || function () {};
      show();
    }
  };
})(window);
