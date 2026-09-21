/* =============================================================================
   Triverse OS — application shell
   Hash router, sidebar navigation, delegated events, global search,
   quick-add, autosave and first-run onboarding.
   ========================================================================== */
(function (global) {
  'use strict';

  const App = global.App;
  const U = App.util;
  const ui = App.ui;

  const NAV = [
    { route: 'dashboard', icon: 'fa-table-cells-large', label: 'Dashboard', title: 'Today at a glance' },
    { route: 'assistant', icon: 'fa-wand-magic-sparkles', label: 'Assistant', title: 'Hand work to the AI' },
    { route: 'discover', icon: 'fa-map-location-dot', label: 'Discover', title: 'Find businesses on the map' },
    { route: 'outreach', icon: 'fa-comment-dots', label: 'Outreach', title: 'Cold messages and replies' },
    { route: 'pipeline', icon: 'fa-filter', label: 'Pipeline', title: 'Deals moving forward' },
    { route: 'clients', icon: 'fa-user-tie', label: 'Clients', title: 'Clients, companies and history' },
    { route: 'projects', icon: 'fa-diagram-project', label: 'Projects', title: 'Live sites, new builds and current work' },
    { route: 'files', icon: 'fa-box-archive', label: 'File vault', title: 'Every file we own, with its full record' },
    { route: 'payments', icon: 'fa-wallet', label: 'Money', title: 'Invoices, payments and reminders' },
    { route: 'sites', icon: 'fa-swatchbook', label: 'Samples', title: 'Sample pages and design templates', hash: 'sites/library' },
    { route: 'catalog', icon: 'fa-award', label: 'Catalogue', title: 'What we sell and the price' }
  ];

  /* the one primary button that belongs on each screen, shown in the page header */
  const PAGE_ACTIONS = {
    dashboard: { label: 'Find businesses', icon: 'fa-map-location-dot', action: 'focus.discover' },
    assistant: { label: 'Give it a job', icon: 'fa-wand-magic-sparkles', action: 'assistant.focus' },
    discover: { label: 'Import a list', icon: 'fa-file-import', action: 'discover.import' },
    outreach: { label: 'Batch send', icon: 'fa-paper-plane', action: 'outreach.batch' },
    pipeline: { label: 'Log a reply', icon: 'fa-reply', action: 'focus.outreach' },
    clients: { label: 'New client', icon: 'fa-user-plus', action: 'client.new' },
    projects: { label: 'New project', icon: 'fa-plus', action: 'projects.new' },
    files: { label: 'Add files', icon: 'fa-arrow-up-from-bracket', action: 'files.upload' },
    payments: { label: 'New invoice', icon: 'fa-file-invoice-dollar', action: 'pay.new' },
    sites: { label: 'New website', icon: 'fa-globe', action: 'sites.new' },
    catalog: { label: 'New service', icon: 'fa-plus', action: 'cat.new' },
    settings: { label: 'Export backup', icon: 'fa-download', action: 'data.export' }
  };

  /* ------------------------------- rendering -------------------------------- */
  let renderTimer = null;
  let renderBurst = 0, renderWindow = 0;

  function renderNav() {
    const cur = App.router.current().route;
    const leads = App.store.get('leads', []);
    const counts = {
      assistant: (App.agent ? App.agent.history().filter(t => t.status === 'blocked').length : 0),
      discover: leads.length,
      outreach: leads.filter(l => l.status === 'replied' || l.status === 'interested').length,
      pipeline: leads.filter(l => ['new', 'qualified', 'contacted', 'replied', 'interested', 'proposal'].indexOf(l.status) !== -1).length,
      clients: App.store.get('clients', []).filter(c => c.stage === 'active').length,
      projects: App.store.get('sites', []).filter(s => ['live', 'development', 'active', 'maintenance'].indexOf(s.phase || (s.status === 'live' ? 'live' : 'development')) !== -1).length,
      files: App.store.get('documents', []).length,
      payments: App.store.get('payments', []).filter(p => ['pending', 'partial', 'overdue'].indexOf(p.status) !== -1 || (p.status !== 'paid' && p.status !== 'cancelled' && p.dueDate && p.dueDate < U.todayISO())).length,
      sites: App.store.get('sites', []).filter(s => s.kind === 'sample' || s.kind === 'template').length,
      catalog: App.store.get('catalog', []).length
    };
    const link = n => {
      const on = cur === n.route;
      const c = counts[n.route];
      return '<a href="#/' + (n.hash || n.route) + '" data-nav-link="' + n.route + '" title="' + U.esc(n.title) + '" class="side-link' + (on ? ' is-active' : '') + '">' +
        '<i class="fa-solid ' + n.icon + '"></i><span>' + U.esc(n.label) + '</span>' +
        (c ? '<span class="side-link__n num">' + c + '</span>' : '') + '</a>';
    };
    const settings = { route: 'settings', icon: 'fa-gear', label: 'Settings', title: 'Integrations, branding and backup' };
    const nav = document.getElementById('nav-main');
    if (nav) nav.innerHTML = NAV.map(link).join('') + link(settings);
    renderFoot();
  }

  /* the studio's public profiles, one small round link each. Blank ones vanish,
     so the strip fills itself in as accounts are added in Settings. */
  function socialLinks() {
    const co = App.store.get('settings.company', {});
    const soc = co.socials || {};
    return App.dict.socials.map(s => {
      const raw = s.key === 'website' ? co.website : s.key === 'portfolio' ? co.portfolio : soc[s.key];
      const href = s.url(raw || '');
      if (!href) return '';
      return '<a href="' + U.esc(href) + '" target="_blank" rel="noopener" title="' + U.esc(s.label) + '"' +
        ' class="social-chip">' +
        '<i class="fa-' + (s.brand ? 'brands' : 'solid') + ' ' + s.icon + '"></i></a>';
    }).filter(Boolean).join('');
  }

  /* one calm strip along the bottom of the workspace, instead of a cluttered
     block inside the sidebar */
  function renderStudioBar() {
    const bar = document.getElementById('studio-bar');
    if (!bar) return;
    const links = socialLinks();
    const account = (App.auth && App.auth.account()) || '';
    const cloud = App.cloud.status();
    const bits = [];
    if (cloud.lastSync) bits.push('Drive ' + U.relTime(cloud.lastSync));
    else if (cloud.connected) bits.push('Drive connected');
    else bits.push('Drive not connected');
    if (account) bits.push(account);
    bar.innerHTML =
      (links ? '<span class="studio-bar__label">Find us</span>' + links + '<span class="w-px h-4 bg-borderMain mx-2 hidden sm:block"></span>' : '') +
      '<span class="text-[10px] text-textMuted">' + U.esc(bits.join(' · ')) + '</span>';
  }

  function renderFoot() {
    const foot = document.getElementById('nav-foot');
    if (!foot) return;
    const protectedNow = App.vault && App.vault.has();
    const cloud = App.cloud.status();
    foot.innerHTML =
      '<div class="nav-foot__box">' +
      '<button class="nav-foot__cta" data-action="focus.discover">' +
      '<i class="fa-solid fa-magnifying-glass-location"></i> Find businesses</button>' +
      '<div class="nav-foot__meta">' +
      '<span><span class="dot-live"></span>' + (protectedNow ? 'encrypted' : 'this device') + '</span>' +
      '<span>' + (cloud.lastSync ? 'Drive ' + U.relTime(cloud.lastSync) : 'no Drive backup') + '</span>' +
      '</div>' +
      '<button class="nav-foot__link' + (protectedNow ? '' : ' is-warn') + '" data-action="' + (protectedNow ? 'vault.lock' : 'vault.setup') + '">' +
      '<i class="fa-solid ' + (protectedNow ? 'fa-lock' : 'fa-shield-halved') + '"></i> ' +
      (protectedNow ? 'Lock now' : 'Protect this workspace') + '</button>' +
      '</div>';
    renderStudioBar();
  }

  function renderHeader() {
    const co = App.store.get('settings.company', {});
    const leads = App.store.get('leads', []);
    const st = App.msg.stats(leads);
    const name = co.senderName || co.owner || 'Studio Owner';
    document.getElementById('user-name').textContent = name;
    document.getElementById('user-sub').textContent = st.sent + ' contacted · ' + st.interested + ' interested';
    document.getElementById('owner-name').textContent = co.shortName || co.name || 'Triverse Studio';
    document.getElementById('owner-role').textContent = leads.length + ' businesses · ' + App.store.get('clients', []).length + ' clients · ' + App.store.get('documents', []).length + ' files';
    const mark = App.brand.mark('brand-mark');
    const small = document.getElementById('brand-mark-sm');
    const avatar = document.getElementById('user-avatar');
    const avatarLg = document.getElementById('user-avatar-lg');
    if (small) small.innerHTML = App.brand.logo() ? '<img class="brand-circle__img" src="' + U.attr(App.brand.logo()) + '" alt="" />' : U.esc(App.brand.initials());
    if (avatar) avatar.innerHTML = App.brand.logo() ? '<img class="brand-circle__img" src="' + U.attr(App.brand.logo()) + '" alt="" />' : U.esc(App.brand.initials());
    if (avatarLg) avatarLg.innerHTML = App.brand.logo() ? '<img class="brand-circle__img" src="' + U.attr(App.brand.logo()) + '" alt="" />' : U.esc(App.brand.initials());
    document.getElementById('brand-name-sm').textContent = co.shortName || co.name || 'Triverse Studio';
    document.getElementById('brand-tag-sm').textContent = co.city ? co.city + ', ' + (co.country || '') : 'Business system';
    const lockBtn = document.getElementById('lock-btn');
    if (lockBtn) lockBtn.classList.toggle('hidden', !App.store.protectedByVault());
    void mark;
  }

  function renderPageActions(cur) {
    const box = document.getElementById('page-actions');
    if (!box) return;
    const a = PAGE_ACTIONS[cur.route];
    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    box.innerHTML =
      '<div class="hidden md:flex items-center gap-3 bg-bgPanel border border-borderMain px-3.5 py-2 rounded-lg hover:border-accentMint/40 transition-colors">' +
      '<span class="w-8 h-8 rounded bg-bgPanelLighter flex items-center justify-center"><i class="fa-solid fa-calendar-day text-accentMint text-sm"></i></span>' +
      '<span class="text-left"><span class="block text-[10px] text-textMuted uppercase font-medium">Today</span>' +
      '<span class="block text-xs font-medium text-white">' + today + '</span></span></div>' +
      '<button class="btn btn-ghost" data-action="ai.openAssistant" title="Give the assistant a job"><i class="fa-solid fa-wand-magic-sparkles"></i> Assistant</button>' +
      '<button class="btn btn-ghost" data-action="help.open"><i class="fa-solid fa-circle-question"></i> How to use</button>' +
      (a ? '<button class="btn btn-lime" data-action="' + a.action + '"><i class="fa-solid ' + a.icon + '"></i> ' + U.esc(a.label) + '</button>' : '');
  }

  function render(force) {
    const cur = App.router.current();
    const view = App.views[cur.route] || App.views.dashboard;
    const mount = document.getElementById('view');
    const scroller = document.getElementById('scroll-area');
    const keepScroll = (!force && scroller) ? scroller.scrollTop : 0;
    const box = document.getElementById('global-search');
    if (box) {
      const n = App.store.get('leads', []).length + App.store.get('sites', []).length + App.store.get('documents', []).length;
      box.placeholder = n ? 'Search ' + n + ' businesses, projects, files…' : 'Search businesses, projects, files…';
    }
    document.getElementById('page-title').textContent = view.title;
    document.getElementById('page-sub').innerHTML = view.sub || '';
    document.title = view.title + ' · Triverse OS';
    mount.innerHTML = '';
    try {
      view.render(mount, cur.param);
    } catch (e) {
      console.error('[triverse] view error', e);
      mount.innerHTML = ui.card(ui.head('This screen hit an error') +
        '<p class="text-[11px] text-red-300">' + U.esc(e.message) + '</p>' +
        '<div class="btn-row mt-3"><button class="btn btn-ghost btn-sm" data-action="data.export">Export a backup</button>' +
        '<button class="btn btn-lime btn-sm" data-nav="dashboard">Back to dashboard</button></div>');
    }
    renderNav();
    renderHeader();
    renderPageActions(cur);
    storageStrip();
    if (scroller) scroller.scrollTop = keepScroll;
    document.body.classList.remove('sidebar-open');
  }
  App.refresh = () => { clearTimeout(renderTimer); renderTimer = setTimeout(() => render(true), 30); };

  /*
   * Reloading the document is the one thing a file:// page cannot do quietly:
   * the browser logs an "Unsafe attempt to load file: URL" warning and the whole
   * shell flashes white. Re-reading the workspace and re-rendering gives the
   * same result without either.
   */
  App.softReload = () => {
    clearTimeout(renderTimer);
    try { if (App.store && App.store.load) App.store.load(); } catch (e) { /* keep the state we have */ }
    App.refresh();
  };

  /*
   * "Tracking Prevention blocked access to storage" is the browser refusing a
   * file:// page its own localStorage. Nothing can be saved when that happens,
   * so the app says so out loud instead of quietly losing the day's work.
   */
  App.storageBlocked = () => {
    try {
      const k = '__tri_probe';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return false;
    } catch (e) { return true; }
  };

  function storageStrip() {
    const box = document.getElementById('storage-warning');
    if (!box) return;
    if (!App.storageBlocked()) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    box.classList.remove('hidden');
    box.innerHTML = '<div class="storage-warning">' + ui.icon('fa-shield-halved', 'text-[11px]') +
      '<span><b>This browser is blocking storage for a local file.</b> Anything you add now stays only until you close the tab.' +
      ' Open the system through <b>npm start</b> (http://localhost:8123) or allow storage for this file, and your work will be saved and backed up.</span>' +
      '<button class="btn btn-ghost btn-sm" data-action="storage.retry"><i class="fa-solid fa-rotate"></i> Check again</button></div>';
  }
  App.action('storage.retry', () => {
    if (App.storageBlocked()) ui.toast('Still blocked — the browser is stopping this page from saving', 'amber');
    else { ui.toast('Storage is working now — saving is on', 'lime'); storageStrip(); App.softReload(); }
  });

  /* ---------------------------- delegated events ---------------------------- */
  function bindEvents() {
    /* clicks: navigation + actions */
    document.addEventListener('click', ev => {
      const nav = ev.target.closest('[data-nav]');
      if (nav) { ev.preventDefault(); App.router.go(nav.getAttribute('data-nav')); return; }

      const backdrop = ev.target.closest('[data-action="backdrop"]');
      if (backdrop && ev.target === backdrop) { ui.closeModal(); ui.closeDrawer(); return; }

      const el = ev.target.closest('[data-action]');
      if (!el) return;
      const name = el.getAttribute('data-action');
      if (name === 'backdrop') return;
      if (el.tagName === 'A' && name !== 'close-modal') ev.preventDefault();
      const fn = App.actions[name];
      if (!fn) { console.warn('[triverse] no action:', name); return; }
      try { fn(el, ev); } catch (e) { console.error('[triverse] action ' + name, e); ui.toast('Something went wrong: ' + e.message, 'red'); }
    });

    /* live binding of inputs to state */
    const applyModel = (el, ev, emit) => {
      const path = el.getAttribute('data-model');
      if (!path) return;
      let value;
      if (el.type === 'checkbox') value = el.checked;
      else if (el.type === 'number') value = el.value === '' ? '' : Number(el.value);
      else value = el.value;
      App.store.set(path, value, { silent: true });
      if (emit) {
        App.emit('field:changed', { path: path, value: value, el: el });
        const changeAction = el.getAttribute('data-change-action');
        if (changeAction && App.actions[changeAction] && ev.type === 'change') App.actions[changeAction](el, ev);
      }
    };
    document.addEventListener('input', ev => { if (ev.target.matches('[data-model]')) applyModel(ev.target, ev, false); });
    document.addEventListener('change', ev => { if (ev.target.matches('[data-model]')) applyModel(ev.target, ev, true); });

    /* enter to search, escape to close, shortcuts */
    document.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' && ev.target.getAttribute && ev.target.getAttribute('data-enter')) {
        ev.preventDefault();
        const actionName = ev.target.getAttribute('data-enter');
        if (actionName && actionName !== '1' && App.actions[actionName]) App.actions[actionName](ev.target, ev);
        else ev.target.click();
        return;
      }
      if (ev.key === 'Enter' && ev.target.matches('[data-enter]')) { ev.preventDefault(); ev.target.click(); return; }
      if (ev.key === 'Escape') { ui.closeModal(); ui.closeDrawer(); hideSearch(); return; }
      if (ev.key === 'F1' || (ev.key === '?' && ['INPUT', 'TEXTAREA'].indexOf(document.activeElement.tagName) === -1)) {
        ev.preventDefault(); App.actions['help.open'](); return;
      }
      if (ev.key.toLowerCase() === 'd' && ev.altKey) { ev.preventDefault(); App.actions['ui.theme'](); return; }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); document.getElementById('global-search').focus(); return; }
      if (ev.key === '/' && ['INPUT', 'TEXTAREA', 'SELECT'].indexOf(document.activeElement.tagName) === -1) {
        ev.preventDefault(); document.getElementById('global-search').focus(); return;
      }
      if (ev.altKey && /^[1-9]$/.test(ev.key)) {
        const item = NAV[Number(ev.key) - 1];
        if (item) { ev.preventDefault(); App.router.go(item.route); }
        return;
      }
      if (ev.altKey && (ev.key === '0' || ev.key.toLowerCase() === 's')) { ev.preventDefault(); App.router.go('settings'); return; }
    });

    window.addEventListener('hashchange', () => { ui.closeDrawer(); render(true); });

    /* any state mutation redraws the current screen, coalesced and loop-proof */
    App.on('state:changed', () => {
      const now = Date.now();
      if (now - renderWindow > 1000) { renderWindow = now; renderBurst = 0; }
      renderBurst++;
      if (renderBurst > 30) {
        if (renderBurst === 31) console.warn('[triverse] render loop detected — pausing redraws');
        return;
      }
      clearTimeout(renderTimer);
      renderTimer = setTimeout(() => render(false), 30);
    });

    window.addEventListener('online', () => updateNet());
    window.addEventListener('offline', () => updateNet());

    /* click outside closes the search results */
    document.addEventListener('click', ev => {
      const panel = document.getElementById('search-panel');
      const box = document.getElementById('global-search');
      if (panel && !panel.contains(ev.target) && ev.target !== box) panel.classList.add('hidden');
    });
  }

  /* ------------------------------ global search ----------------------------- */
  function initSearch() {
    const input = document.getElementById('global-search');
    const panel = document.createElement('div');
    panel.id = 'search-panel';
    panel.className = 'hidden absolute top-[42px] right-0 w-[380px] glass-card rounded-2xl p-2 z-[80] max-h-[440px] overflow-y-auto';
    input.parentElement.appendChild(panel);
    input.addEventListener('input', U.debounce(() => runSearch(input.value), 160));
    input.addEventListener('focus', () => runSearch(input.value));
    input.addEventListener('keydown', ev => { if (ev.key === 'Escape') { hideSearch(); input.blur(); } });
  }
  function hideSearch() { const p = document.getElementById('search-panel'); if (p) p.classList.add('hidden'); }

  function runSearch(term) {
    const panel = document.getElementById('search-panel');
    if (!panel) return;
    const t = String(term || '').trim();
    if (!t) { panel.classList.add('hidden'); return; }
    const leads = App.store.get('leads', []).filter(l => U.hit(l.name, t) || U.hit(l.category, t) || U.hit(l.phone, t) || U.hit(l.address, t) || U.hit(l.email, t)).slice(0, 4);
    const clients = App.store.get('clients', []).filter(c => U.hit(c.name, t) || U.hit(c.contactName, t) || U.hit(c.phone, t) || U.hit(c.email, t)).slice(0, 3);
    const projects = App.store.get('sites', []).filter(s => U.hit(s.name, t) || U.hit(s.clientName, t) || U.hit(s.url, t) || U.hit(s.techStack, t)).slice(0, 4);
    const docs = App.files.all().filter(d => U.hit(d.name, t) || U.hit(d.description, t) || U.hit(d.kind, t) || (d.tags || []).some(x => U.hit(x, t))).slice(0, 4);
    const payments = App.store.get('payments', []).filter(p => U.hit(p.invoiceNo, t) || U.hit(p.projectTitle, t)).slice(0, 3);
    const sites = App.store.get('sites', []).filter(s => (s.kind === 'sample' || s.kind === 'template') && (U.hit(s.name, t) || U.hit(s.url, t))).slice(0, 3);
    const group = (title, rows) => rows.length
      ? '<p class="text-[9px] uppercase tracking-wider text-textMuted px-2 pt-2 pb-1">' + title + '</p>' + rows.join('')
      : '';
    const row = (label, sub, action, arg, icon) =>
      '<button class="w-full text-left rounded-xl px-2 py-2 hover:bg-hover flex items-center gap-2" data-action="search.open" data-arg="' + action + '|' + arg + '">' +
      '<span class="w-6 h-6 rounded-lg bg-track text-limeAccent flex items-center justify-center shrink-0"><i class="fa-solid ' + icon + ' text-[9px]"></i></span>' +
      '<span class="min-w-0"><span class="block text-[11px] text-white truncate">' + U.esc(label) + '</span>' +
      '<span class="block text-[9px] text-textMuted truncate">' + U.esc(sub) + '</span></span></button>';

    const html =
      group('Projects', projects.map(s => row(s.name, U.title(s.phase || s.status || '') + ' · ' + (s.clientName || 'own project'), 'projects', s.id, 'fa-diagram-project'))) +
      group('Files', docs.map(d => row(d.name, d.kind + ' · ' + U.bytes(d.size) + (d.projectName ? ' · ' + d.projectName : ''), 'files', d.id, 'fa-box-archive'))) +
      group('Businesses', leads.map(l => row(l.name, (l.category || '') + ' · ' + (l.phone || 'no phone') + ' · ' + U.title(l.status), 'discover', l.id, 'fa-map-location-dot'))) +
      group('Clients', clients.map(c => row(c.name, U.title(c.stage) + ' · ' + (c.phone || ''), 'clients', c.id, 'fa-user-tie'))) +
      group('Invoices', payments.map(p => row(p.invoiceNo, p.projectTitle + ' · ' + U.money(p.amount), 'payments', p.id, 'fa-file-invoice-dollar'))) +
      group('Samples', sites.map(s => row(s.name, (s.kind || '') + ' · ' + U.title(s.status), 'sites', s.id, 'fa-swatchbook'))) ||
      '<p class="text-[10px] text-textMuted p-3 text-center">No match for “' + U.esc(t) + '”</p>';
    panel.innerHTML = html || '<p class="text-[10px] text-textMuted p-3 text-center">No match for “' + U.esc(t) + '”</p>';
    panel.classList.remove('hidden');
  }

  App.action('search.open', el => {
    const parts = String(el.getAttribute('data-arg')).split('|');
    hideSearch();
    const box = document.getElementById('global-search');
    if (box) box.value = '';
    App.router.go(parts[0], parts[1]);
  });

  /* -------------------------------- quick add ------------------------------- */
  App.action('quick-add', () => {
    ui.modal({
      title: 'Quick add',
      size: 'sm',
      body: '<div class="space-y-1.5">' +
        [['Add a project (website, app, software)', 'projects.new', 'fa-diagram-project'],
        ['Add files to the vault', 'files.upload', 'fa-arrow-up-from-bracket'],
        ['Add a client / company', 'client.new', 'fa-user-plus'],
        ['Create an invoice', 'pay.new', 'fa-file-invoice-dollar'],
        ['Add a service to the catalogue', 'cat.new', 'fa-award'],
        ['Register a sample page', 'sites.new', 'fa-swatchbook'],
        ['Add a business manually', 'lead.new', 'fa-map-location-dot'],
        ['Import a CSV / JSON list', 'discover.import', 'fa-file-import']]
          .map(o => '<button class="w-full text-left btn btn-ghost" data-action="quick.' + o[1] + '"><i class="fa-solid ' + o[2] + '"></i> ' + o[0] + '</button>').join('') +
        '</div>',
      footer: '<button class="btn btn-ghost" data-action="close-modal">Close</button>'
    });
  });
  ['client.new', 'pay.new', 'cat.new', 'sites.new', 'lead.new', 'discover.import', 'projects.new', 'files.upload'].forEach(name => {
    App.action('quick.' + name, () => { ui.closeModal(); App.actions[name](null); });
  });

  App.action('nav', el => App.router.go(el.getAttribute('data-arg')));
  /* ------- theme (dark = studio signature, light = daylight mode) ------- */
  App.action('ui.theme', () => {
    const mode = App.theme.toggle();
    App.store.set('settings.ui.theme', mode, { silent: true });
    App.store.save();
    ui.toast(mode === 'light' ? 'Light mode — easier in a bright office' : 'Dark mode — the studio look', 'muted');
  });

  /* the sidebar slides in on small screens */
  App.action('nav.sidebar', () => document.body.classList.toggle('sidebar-open'));
  App.action('nav.toggleRail', () => document.body.classList.toggle('sidebar-open'));

  /* jump straight to the discovery screen with the search box focused */
  App.action('focus.discover', () => {
    App.router.go('discover');
    setTimeout(() => {
      const box = document.getElementById('discover-type');
      if (box) { box.focus(); box.select(); }
    }, 140);
  });
  App.action('focus.outreach', () => App.router.go('outreach'));

  /* ------------------------------ the guide ------------------------------ */
  function guideModal() {
    const co = App.store.get('settings.company', {});
    const steps = [
      ['fa-magnifying-glass-location', 'Discover', 'Type a business type, pick an area, press Enter. Tap a listing for its full Google record, then <b>Try this</b> to build its website.'],
      ['fa-database', 'Projects', 'Every piece of real work — live sites, new builds, retainers, past deliveries — registered once, with its files and invoices attached.'],
      ['fa-box-archive', 'Files', 'Upload any file. It keeps category, project, client, version, language, size, checksum and description. Download it anywhere.'],
      ['fa-coins', 'Clients and money', 'A lead becomes a client; raise the invoice in Birr, record part-payments, set renewal dates. Money chases what is owed.'],
      ['fa-cloud-arrow-up', 'Cloud backup', 'Connect Google in <b>Settings → Cloud</b> and the workspace plus every file is copied to your own Drive.'],
      ['fa-lock', 'Security', 'A passphrase in <b>Settings → Security</b> encrypts the workspace on this device. Keep the recovery code off the computer.'],
      ['fa-gauge-high', 'Google allowance', 'A search you have already run is saved and free to reopen. Only a new search spends the daily Google allowance.'],
      ['fa-wand-magic-sparkles', 'Assistant', 'Grant it permissions in <b>Settings → Assistant</b>, then it can run approved tasks itself. Nothing runs ungranted.']
    ];
    ui.modal({
      title: 'How to use this system',
      sub: 'Eight lines — one per screen',
      size: 'lg',
      body:
        '<div class="grid grid-cols-1 md:grid-cols-2 gap-2">' + steps.map(s =>
          '<div class="glass-soft rounded-xl p-3 hover-lift flex gap-3">' +
          '<i class="fa-solid ' + s[0] + ' text-accentMint text-[13px] mt-0.5"></i>' +
          '<div><p class="text-[11px] font-bold text-ink">' + s[1] + '</p>' +
          '<p class="text-[10px] text-textMuted leading-snug mt-0.5">' + s[2] + '</p></div></div>').join('') + '</div>' +
        '<div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">' +
        '<div class="glass-soft rounded-xl p-3">' +
        '<p class="text-[11px] font-bold text-ink mb-2">Keyboard</p>' +
        ui.kv('/ or Ctrl+K', 'Global search') +
        ui.kv('Alt + 1…9', 'Jump between screens') +
        ui.kv('Alt + S', 'Settings') +
        ui.kv('Alt + D', 'Dark / light') +
        ui.kv('F1', 'This guide') +
        ui.kv('Esc', 'Close a panel') +
        '</div>' +
        '<div class="glass-soft rounded-xl p-3">' +
        '<p class="text-[11px] font-bold text-ink mb-2">Where the data lives</p>' +
        ui.kv('This device', 'In this browser, encrypted when a passphrase is set') +
        ui.kv('Google Drive', 'One copy of the workspace plus every file') +
        ui.kv('Backup file', 'The shield icon in the header exports all of it') +
        ui.kv('Nowhere else', 'No server of ours. Sending uses your own apps') +
        '</div></div>' +
        '<p class="text-[10px] text-textMuted mt-3">Money in ' + U.esc(co.currency || 'ETB') +
        ' · paid by ' + U.esc((App.dict.paymentMethods || []).slice(1, 4).join(' / ')) + ' or bank transfer.</p>',
      footer: '<button class="btn btn-ghost" data-action="nav" data-arg="settings"><i class="fa-solid fa-sliders"></i> Open settings</button>' +
        '<button class="btn btn-lime" data-action="close-modal">Got it — start working</button>'
    });
  }
  App.action('help.open', guideModal);
  App.action('close-modal', () => ui.closeModal());
  App.action('close-drawer', () => ui.closeDrawer());
  App.action('confirm-yes', () => { const cb = ui._confirmCb; ui._confirmCb = null; ui.closeModal(); if (cb) cb(); });
  App.action('prompt-ok', () => { const cb = ui._promptCb; ui._promptCb = null; if (cb) cb(); });
  App.action('modal-close', () => ui.closeModal());

  /* manual lead entry (used by quick add) */
  App.action('lead.new', () => {
    ui.modal({
      title: 'Add a business by hand',
      sub: 'For referrals, walk-ins or businesses you found offline',
      body: '<div class="grid grid-cols-1 md:grid-cols-2 gap-3">' +
        ui.field({ label: 'Business name', model: 'ui.newLead.name', value: '' }) +
        ui.field({ label: 'Business type', model: 'ui.newLead.businessType', value: 'general', options: App.dict.businessTypes.map(t => [t[0], t[1]]).concat([['general', 'Other']]) }) +
        ui.field({ label: 'Phone', model: 'ui.newLead.phone', value: '' }) +
        ui.field({ label: 'Website', model: 'ui.newLead.website', value: '' }) +
        ui.field({ label: 'Email', model: 'ui.newLead.email', value: '' }) +
        ui.field({ label: 'Address', model: 'ui.newLead.address', value: '' }) +
        ui.field({ label: 'Estimated value', model: 'ui.newLead.value', value: 20000, type: 'number' }) +
        ui.field({ label: 'Source', model: 'ui.newLead.source', value: 'referral', options: [['referral', 'Referral'], ['walk-in', 'Walk-in'], ['facebook', 'Facebook / Instagram'], ['offline', 'Offline / other']] }) +
        '</div>',
      footer: '<button class="btn btn-ghost" data-action="close-modal">Cancel</button>' +
        '<button class="btn btn-lime" data-action="lead.saveNew"><i class="fa-solid fa-plus"></i> Add business</button>'
    });
  });
  App.action('lead.saveNew', () => {
    const g = k => App.store.get('ui.newLead.' + k, '');
    if (!g('name')) { ui.toast('Name is required', 'amber'); return; }
    const t = App.dict.typeOf(g('businessType'));
    const lead = App.store.add('leads', {
      source: g('source') || 'manual', placeId: '', name: g('name'), businessType: g('businessType'), category: App.dict.typeLabel(g('businessType')),
      types: [], address: g('address'), city: App.store.get('settings.google.city', ''), phone: g('phone'), intlPhone: g('phone'),
      whatsapp: Boolean(g('phone')), telegram: '', email: g('email'), website: g('website'), socials: {}, rating: 0, reviews: 0,
      priceLevel: '', hours: '', mapsUrl: '', claimed: false, status: 'new', value: Number(g('value')) || t.avgValue,
      tags: g('website') ? [] : ['no-website'], notes: [], outreach: [], reply: null, clientId: '', nextFollowUp: '', dist: 0
    });
    ui.closeModal();
    ui.toast('Business added', 'lime');
    App.router.go('discover', lead.id);
  });

  /* ---------------------------- data / backup ------------------------------- */
  App.action('data.export', () => {
    U.download('triverse-backup-' + U.todayISO() + '.json', App.store.export(), 'application/json');
    App.store.set('meta.lastBackup', U.now(), { silent: true });
    ui.toast('Backup downloaded — keep it somewhere other than this computer', 'lime');
  });

  /* the same backup, but with the bytes of every file in the vault inside it */
  App.action('data.exportFull', () => {
    const count = App.store.get('documents', []).length;
    if (!count) { App.actions['data.export'](); return; }
    ui.toast('Packing ' + count + ' file' + (count === 1 ? '' : 's') + ' into the backup…', 'blue');
    App.store.exportFull((done, total) => {
      if (done % 10 === 0 || done === total) ui.toast('Packing ' + done + ' of ' + total, 'blue');
    }).then(payload => {
      U.download('triverse-complete-' + U.todayISO() + '.json', JSON.stringify(payload), 'application/json');
      App.store.set('meta.lastBackup', U.now(), { silent: true });
      App.store.save();
      ui.toast('Complete backup written — ' + payload.fileCount + ' files inside', 'lime');
    }).catch(e => ui.toast('Backup failed: ' + e.message, 'red'));
  });
  App.action('data.quickBackup', () => App.actions['data.export']());
  App.action('data.importFile', () => {
    const f = document.getElementById('backup-file');
    if (!f || !f.files || !f.files[0]) { ui.toast('Pick the backup .json file first', 'amber'); return; }
    const r = new FileReader();
    r.onload = () => {
      const text = String(r.result);
      const hasFiles = (function () { try { return Boolean(JSON.parse(text).files); } catch (e) { return false; } })();
      const restore = hasFiles
        ? App.store.importFull(text, (done, total) => { if (done % 10 === 0 || done === total) ui.toast('Restoring file ' + done + ' of ' + total, 'blue'); })
        : Promise.resolve().then(() => { App.store.importJSON(text); return { files: 0 }; });
      restore.then(out => {
        ui.toast('Backup restored' + (out.files ? ' with ' + out.files + ' files' : ''), 'lime');
        setTimeout(() => App.softReload(), 500);
      }).catch(e => ui.toast('Restore failed: ' + e.message, 'red'));
    };
    r.readAsText(f.files[0]);
  });
  /* the legacy archive is written on the first open after the upgrade — let the
     owner know their old (invented) records were set aside, not silently kept */
  App.action('data.forgetLegacy', () => {
    try { localStorage.removeItem(App.ARCHIVE_KEY); } catch (e) {}
    ui.closeModal();
    ui.toast('Old records deleted — the dashboard is a clean slate', 'lime');
    App.refresh();
  });

  /** one-time message when an older install's invented records were set aside */
  function legacyNotice() {
    const meta = App.store.get('meta', {});
    if (!meta.legacyPurged || meta.legacyNoticeShown) return;
    App.store.set('meta.legacyNoticeShown', true, { silent: true });
    App.store.save(true);
    const c = meta.legacyCounts || {};
    ui.modal({
      title: 'Old sample records removed',
      sub: 'This install is clean now — nothing invented is left in it',
      size: 'sm',
      body: '<p class="text-[11px] text-gray-300 leading-relaxed">An earlier version of this system shipped with made-up businesses, clients and invoices ' +
        '(' + (c.leads || 0) + ' businesses, ' + (c.clients || 0) + ' clients, ' + (c.payments || 0) + ' invoices, ' + (c.sites || 0) + ' websites). ' +
        'They have been removed, so every figure on the dashboard is real and starts at zero. Your company profile, price catalogue, templates and message library are untouched.</p>' +
        '<p class="text-[10px] text-textMuted mt-2">The old data was archived in this browser in case you want to look at it. Everything in the system now comes from Google Maps searches you run yourself.</p>',
      footer: '<button class="btn btn-ghost" data-action="data.forgetLegacy">Delete the archive too</button>' +
        '<button class="btn btn-lime" data-action="close-modal">Start clean</button>'
    });
  }

  /* ------------------------------ settings glue ----------------------------- */
  App.action('settings.save', () => {
    App.store.save(true);
    ui.toast('Settings saved', 'lime');
    renderHeader();
  });
  App.action('settings.testGoogle', () => {
    const key = App.store.get('settings.google.apiKey', '');
    if (!key) { ui.toast('Paste your API key first', 'amber'); return; }
    ui.toast('Testing the Places API…', 'blue');
    App.providers.google({ typeKey: 'cafe', city: App.store.get('settings.google.city', ''), pageSize: 3 })
      .then(r => ui.toast('Working — ' + r.leads.length + ' live results for a test search', 'lime'))
      .catch(e => ui.toast(e.message, 'red'));
  });
  /** proves the deep record works: search once, then read that business in full */
  App.action('settings.testRecord', () => {
    ui.toast('Reading one full Google Maps record…', 'blue');
    App.providers.google({ typeKey: 'cafe', city: App.store.get('settings.google.city', 'Addis Ababa'), pageSize: 1 })
      .then(r => {
        const first = r.leads[0];
        if (!first) throw new Error('Google returned no business for the test search.');
        return App.providers.details(first.placeId, { apply: false }).then(d =>
          ui.toast(first.name + ': ' + d.reviewsList.length + ' reviews, ' + d.photos.length + ' photos, phone ' + (d.nationalPhone || 'none'), 'lime'));
      })
      .catch(e => ui.toast(String(e.message).split('\n')[0], 'red'));
  });
  App.action('settings.testSender', () => {
    const url = App.store.get('settings.integration.webhookUrl', '');
    if (!url) { ui.toast('Add your sender webhook URL first', 'amber'); return; }
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Triverse-Token': App.store.get('settings.integration.webhookToken', '') },
      body: JSON.stringify({ test: true, message: 'Test message from Triverse OS', sentBy: App.store.get('settings.company.senderName', '') })
    }).then(r => ui.toast(r.ok ? 'Sender API responded OK ✓' : 'Sender API responded HTTP ' + r.status, r.ok ? 'lime' : 'red'))
      .catch(e => ui.toast('Could not reach the sender: ' + e.message, 'red'));
  });
  App.action('settings.reset', () => {
    ui.confirm({
      title: 'Reset everything?', tone: 'danger', confirmLabel: 'Reset the system',
      message: 'Every business, client, invoice, website and message is erased and the system returns to a clean slate. Export a backup first!',
      onConfirm() { App.store.reset(false); ui.toast('System reset', 'amber'); setTimeout(() => App.softReload(), 300); }
    });
  });

  /* -------------------------------- onboarding ------------------------------ */
  function firstRun() {
    const meta = App.store.get('meta', {});
    if (meta.onboarded) return;
    App.store.set('meta.onboarded', true, { silent: true });
    App.store.save(true);
    const tiles = [
      ['fa-magnifying-glass-location', 'Discover', 'Real Maps listings, area by area'],
      ['fa-paper-plane', 'Outreach', 'Messages written, replies scored'],
      ['fa-handshake', 'Clients', 'Companies, history, contacts'],
      ['fa-diagram-project', 'Projects', 'Live sites, new builds, retainers'],
      ['fa-box-archive', 'Files', 'Upload anything, keep the record'],
      ['fa-coins', 'Money', 'Invoices in Birr, payments'],
      ['fa-cloud-arrow-up', 'Cloud', 'Your own Google Drive'],
      ['fa-lock', 'Security', 'Passphrase, encrypted workspace']
    ];
    ui.modal({
      title: 'Welcome',
      sub: 'Eight screens, in the order you use them',
      size: 'lg',
      body:
        '<div class="grid grid-cols-2 md:grid-cols-4 gap-2">' + tiles.map(t =>
          '<div class="glass-soft rounded-xl p-3 hover-lift">' +
          '<i class="fa-solid ' + t[0] + ' text-accentMint text-[13px]"></i>' +
          '<p class="text-[11px] font-bold text-ink mt-2">' + t[1] + '</p>' +
          '<p class="text-[10px] text-textMuted leading-snug mt-0.5">' + t[2] + '</p></div>').join('') + '</div>' +
        '<p class="text-[10px] text-textMuted mt-3">Starts empty on purpose. <b>F1</b> guide · <b>Alt+D</b> light mode.</p>',
      footer: '<button class="btn btn-ghost" data-action="settings.help">Read the full guide</button>' +
        '<button class="btn btn-ghost" data-action="vault.setup"><i class="fa-solid fa-shield-halved"></i> Protect this workspace</button>' +
        '<button class="btn btn-lime" data-action="close-modal">Start working</button>'
    });
  }
  App.action('settings.help', () => { ui.closeModal(); guideModal(); });

  function updateNet() {
    const b = document.getElementById('net-banner');
    if (!b) return;
    if (navigator.onLine) { b.classList.add('hidden'); }
    else {
      b.textContent = 'Offline — the system keeps working; Maps search and sending need internet.';
      b.classList.remove('hidden');
    }
  }

  /* ------------------------------ lock and boot ----------------------------- */
  function shellVisible(on) {
    const s = document.getElementById('sidebar');
    const w = document.getElementById('workspace');
    if (s) s.style.display = on ? '' : 'none';
    if (w) w.style.display = on ? '' : 'none';
    document.body.classList.toggle('is-locked', !on);
  }

  let bound = false;

  /** runs once the workspace is decrypted (or immediately, when there is no vault) */
  function openWorkspace(state, alreadyAdopted) {
    if (!alreadyAdopted) App.store.adopt(state);
    shellVisible(true);
    App.vault.scheduleIdle();
    App.vault.onLock = () => {
      shellVisible(false);
      App.vault.screen({ mode: 'unlock', onSubmit: s => openWorkspace(s) });
    };
    App.store.set('settings.ui.theme', App.theme.current(), { silent: true });
    App.router.ensure();
    App.router.q = App.router.q || {};
    if (!bound) { bindEvents(); initSearch(); bound = true; }
    render(true);
    updateNet();
    firstRun();
    legacyNotice();
    App.files.probe().then(backend => {
      if (backend === 'localStorage' && App.files.all().length === 0) {
        /* nothing to say until files actually exist */
      }
      renderFoot();
    });
  }

  /** runs once the visitor is through the sign-in door */
  function afterSignIn(state) {
    if (state) { openWorkspace(state); return; }
    if (App.locked) {
      shellVisible(false);
      App.vault.screen({
        mode: 'unlock',
        onSubmit: s => { App.auth.mark({ mode: 'passphrase' }); openWorkspace(s); }
      });
      return;
    }
    openWorkspace(App.store.state, true);
  }

  function boot() {
    /* theme: whatever the visitor last picked, else the system preference */
    let theme = '';
    try { theme = localStorage.getItem(App.THEME_KEY) || ''; } catch (e) {}
    App.theme.apply(theme || App.theme.current(), false);

    App.store.load();

    if (App.auth && App.auth.begin) { shellVisible(false); App.auth.begin(afterSignIn); return; }
    afterSignIn(null);
  }

  App.action('auth.signOut', () => {
    ui.confirm({
      title: 'Sign out of this device?',
      sub: 'Nothing is deleted. The workspace stays on this device and in your Drive folder; you will just see the sign-in page again.',
      tone: 'amber',
      confirmLabel: 'Sign out',
      onConfirm: () => {
        Promise.resolve()
          .then(() => (App.vault.active() ? App.vault.flush(App.store.state) : null))
          .catch(() => {})
          .then(() => App.auth.signOut());
      }
    });
  });

  App.action('auth.signIn', () => {
    App.auth.open(() => location.reload());
  });

  App.action('vault.lock', () => {
    if (!App.vault.active()) { ui.toast('This workspace is not protected yet', 'amber'); return; }
    App.vault.flush(App.store.state).catch(() => {}).then(() => App.vault.lock('manual'));
  });

  App.action('vault.setup', () => {
    if (App.vault.has()) { ui.toast('This workspace is already protected', 'muted'); return; }
    App.vault.screen({
      mode: 'setup',
      state: App.store.state,
      autoLockMinutes: Number(App.store.get('settings.security.autoLockMinutes', 30)) || 30,
      onSubmit: () => {
        App.store.set('settings.security.requireLogin', true, { silent: true });
        App.store.set('settings.security.autoLockMinutes', App.vault.summary().autoLockMinutes, { silent: true });
        App.store.set('settings.security.lastUnlock', U.now(), { silent: true });
        App.store.save(true);
        shellVisible(true);
        render(true);
        ui.toast('Workspace encrypted — keep the recovery code somewhere safe', 'lime');
      }
    });
  });

  /** re-open the lock screen from Settings (change passphrase, recovery code) */
  App.action('vault.manage', () => {
    if (!App.vault.has()) { App.actions['vault.setup'](); return; }
    if (!App.vault.active()) {
      App.vault.screen({ mode: 'unlock', onSubmit: s => openWorkspace(s) });
      return;
    }
    ui.toast('Manage the vault from Settings → Security', 'muted');
    App.router.go('settings');
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
