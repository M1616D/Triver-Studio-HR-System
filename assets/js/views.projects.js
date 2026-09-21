/* =============================================================================
   Triverse OS — Projects
   The studio's whole working history in one screen:
     · websites we host and keep online,
     · the new builds and apps coming next,
     · the clients we are working with right now,
     · the ongoing care and retainer clients,
     · everything already delivered to past clients.
   Each project keeps its own record: who it is for, what it costs, what has been
   paid, where it is deployed, every file we hold for it and the next action.
   ========================================================================== */
(function (global) {
  'use strict';

  const App = global.App;
  const U = App.util;
  const ui = App.ui;

  /* --------------------------------- phases -------------------------------- */
  const PHASES = [
    ['live', 'Hosted & live', 'fa-tower-broadcast', 'lime', 'Online now and being hosted for the client'],
    ['development', 'In development', 'fa-code-branch', 'blue', 'New websites and apps being built'],
    ['active', 'Working on now', 'fa-hammer', 'violet', 'Client work in progress this period'],
    ['maintenance', 'Ongoing & retainers', 'fa-rotate', 'amber', 'Continue-working clients on a care plan'],
    ['delivered', 'Completed / past', 'fa-circle-check', 'muted', 'Delivered and handed over'],
    ['paused', 'Paused / on hold', 'fa-circle-pause', 'muted', 'Waiting on the client or on budget'],
    ['cancelled', 'Cancelled', 'fa-ban', 'red', 'Did not go ahead']
  ];

  const KINDS = [['website', 'Website'], ['app', 'Mobile app'], ['software', 'Software / system'], ['qr', 'QR menu'], ['branding', 'Branding & design'], ['service', 'Service / retainer'], ['other', 'Other']];

  function phaseMeta(key) {
    return PHASES.filter(p => p[0] === key)[0] || PHASES[1];
  }
  function kindLabel(key) {
    const k = KINDS.filter(x => x[0] === key)[0];
    return k ? k[1] : U.title(key || 'other');
  }

  /** every project, with a phase worked out even for records made before phases existed */
  function projects() {
    return (App.store.get('sites', []) || []).map(s => {
      let phase = s.phase;
      if (!phase) {
        if (s.status === 'live') phase = 'live';
        else if (s.status === 'archived') phase = 'delivered';
        else if (s.status === 'offline') phase = 'paused';
        else if (s.kind === 'draft') phase = 'development';
        else phase = 'development';
      }
      if (s.maintenancePlan && (phase === 'live' || phase === 'delivered')) phase = 'maintenance';
      return Object.assign({}, s, { phase: phase });
    });
  }

  function filesFor(project) {
    return App.files.all().filter(d => d.projectId === project.id);
  }
  function paymentsFor(project) {
    return App.store.get('payments', []).filter(p => p.projectId === project.id || (project.clientId && p.clientId === project.clientId && U.hit(p.projectTitle, project.name)));
  }
  function paidFor(project) {
    return U.sum(paymentsFor(project).filter(p => p.status === 'paid' || p.status === 'partial'), p => Number(p.paidAmount || (p.status === 'paid' ? p.amount : 0)) || 0);
  }
  function dueFor(project) {
    return paymentsFor(project).filter(p => ['pending', 'overdue', 'partial'].indexOf(p.status) !== -1);
  }

  function q() {
    App.router.q.projects = App.router.q.projects || { tab: 'live', search: '', client: '' };
    return App.router.q.projects;
  }

  function filtered() {
    const s = q();
    let rows = projects();
    if (s.client) rows = rows.filter(p => p.clientId === s.client);
    if (s.search) rows = rows.filter(p => U.hit(p.name, s.search) || U.hit(p.clientName, s.search) || U.hit(p.url, s.search) || U.hit(p.notes, s.search) || U.hit(p.techStack, s.search));
    if (s.tab === 'all') return rows;
    return rows.filter(p => p.phase === s.tab);
  }

  /* --------------------------------- card ---------------------------------- */
  function projectCard(p) {
    const meta = phaseMeta(p.phase);
    const client = p.clientId ? App.store.find('clients', p.clientId) : null;
    const files = filesFor(p);
    const paid = paidFor(p);
    const price = Number(p.price) || 0;
    const outstanding = Math.max(0, price - paid);
    const progress = U.clamp(Number(p.progressPct != null ? p.progressPct : (p.phase === 'live' || p.phase === 'delivered' ? 100 : 55)), 0, 100);
    return '<div class="glass-card rounded-2xl p-4 hover-lift flex flex-col" data-action="projects.open" data-arg="' + p.id + '">' +
      '<div class="flex items-start justify-between gap-2 mb-2">' +
      '<div class="min-w-0 flex-1">' +
      '<p class="text-[12px] font-bold truncate">' + U.esc(p.name) + '</p>' +
      '<p class="text-[9px] text-textMuted truncate">' + U.esc(client ? client.name : (p.clientName || 'Triverse Studio')) + ' · ' + U.esc(kindLabel(p.kind)) + '</p>' +
      '</div>' +
      '<span class="tone tone-' + meta[3] + ' text-[9px] px-2 py-0.5 rounded-full border shrink-0">' + U.esc(meta[1]) + '</span>' +
      '</div>' +

      (p.url
        ? '<p class="text-[10px] mb-2 truncate">' + ui.link(p.url, String(p.url).replace(/^https?:\/\//, '')) + '</p>'
        : '<p class="text-[10px] text-textMuted mb-2">' + (p.phase === 'development' ? 'not launched yet' : 'no address recorded') + '</p>') +

      '<div class="mb-3"><div class="flex justify-between text-[9px] text-textMuted mb-1"><span>Progress</span><span class="num">' + progress + '%</span></div>' + ui.progress(progress) + '</div>' +

      '<div class="flex flex-wrap gap-1 mb-3">' +
      (p.techStack ? '<span class="tag">' + U.esc(p.techStack) + '</span>' : '') +
      (price ? '<span class="tag" style="color:rgb(var(--accent))">' + U.money(price) + '</span>' : '') +
      (outstanding ? '<span class="tag" style="color:#fbbf24">' + U.money(outstanding) + ' due</span>' : '') +
      (files.length ? '<span class="tag">' + files.length + ' file' + (files.length === 1 ? '' : 's') + '</span>' : '') +
      (p.maintenanceFee ? '<span class="tag">' + U.money(p.maintenanceFee) + '/mo</span>' : '') +
      '</div>' +

      '<div class="text-[9px] text-textMuted mt-auto flex items-center justify-between gap-2">' +
      '<span>' + (p.dueDate ? 'target ' + U.fmtDate(p.dueDate) : (p.deliveredAt ? 'delivered ' + U.fmtDate(p.deliveredAt) : 'no date set')) + '</span>' +
      '<span>' + (p.updatedAt ? U.relTime(p.updatedAt) : '') + '</span>' +
      '</div></div>';
  }

  /* -------------------------------- detail --------------------------------- */
  function openProject(id) {
    const p = projects().filter(x => x.id === id)[0];
    if (!p) return;
    const meta = phaseMeta(p.phase);
    const client = p.clientId ? App.store.find('clients', p.clientId) : null;
    const files = filesFor(p);
    const invoices = paymentsFor(p);
    const paid = paidFor(p);
    const due = dueFor(p);
    const html = App.store.html(p.id);

    ui.drawer({
      title: p.name,
      sub: (client ? client.name : (p.clientName || 'Triverse Studio')) + ' · ' + kindLabel(p.kind) + ' · ' + meta[1],
      body:
        '<div class="flex flex-wrap gap-2 mb-3">' +
        (p.url ? '<a class="btn btn-lime btn-sm" href="' + U.attr(p.url) + '" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> Open the live site</a>' : '') +
        (html ? '<button class="btn btn-ghost btn-sm" data-action="sites.open" data-arg="' + p.id + '"><i class="fa-solid fa-eye"></i> Preview stored copy</button>' : '') +
        '<button class="btn btn-ghost btn-sm" data-action="projects.edit" data-arg="' + p.id + '"><i class="fa-solid fa-pen"></i> Edit</button>' +
        '<button class="btn btn-ghost btn-sm" data-action="projects.uploadFile" data-arg="' + p.id + '"><i class="fa-solid fa-arrow-up-from-bracket"></i> Add a file</button>' +
        (client ? '<button class="btn btn-ghost btn-sm" data-action="client.open" data-arg="' + client.id + '"><i class="fa-solid fa-user-tie"></i> Client record</button>' : '') +
        '</div>' +

        ui.card(ui.head('Progress', '<span class="tone tone-' + meta[3] + ' text-[9px] px-2 py-0.5 rounded-full border">' + U.esc(meta[1]) + '</span>') +
          ui.meter(Number(p.progressPct != null ? p.progressPct : ((p.phase === 'live' || p.phase === 'delivered') ? 100 : 55)), 'Overall completion') +
          '<p class="text-[10px] text-textMuted mt-2">' + U.esc(meta[4]) + '</p>', 'mb-3') +

        ui.card(ui.head('Commercials') +
          ui.kv('Project value', U.money(p.price)) +
          ui.kv('Received', '<span class="text-limeAccent">' + U.money(paid) + '</span>') +
          ui.kv('Outstanding', due.length ? '<span class="text-amber-300">' + U.money(U.sum(due, x => Number(x.amount) - Number(x.paidAmount || 0))) + '</span>' : U.money(Math.max(0, Number(p.price || 0) - paid))) +
          ui.kv('Care plan', p.maintenancePlan ? U.esc(p.maintenancePlan) + (p.maintenanceFee ? ' · ' + U.money(p.maintenanceFee) + '/month' : '') : '—') +
          ui.kv('Invoices', invoices.length ? invoices.map(i => '<span class="tag">' + U.esc(i.invoiceNo || '') + '</span>').join(' ') : '—'), 'mb-3') +

        ui.card(ui.head('Timeline') +
          ui.kv('Started', p.startedAt ? U.fmtDate(p.startedAt) : U.fmtDate(p.createdAt)) +
          ui.kv('Target', p.dueDate ? U.fmtDate(p.dueDate) : '—') +
          ui.kv('Delivered', p.deliveredAt ? U.fmtDate(p.deliveredAt) : '—') +
          ui.kv('Hosting renewal', p.hostRenewDate ? U.fmtDate(p.hostRenewDate) + ' (' + U.daysUntil(p.hostRenewDate) + 'd)' : '—') +
          ui.kv('Domain renewal', p.domainRenewDate ? U.fmtDate(p.domainRenewDate) + ' (' + U.daysUntil(p.domainRenewDate) + 'd)' : '—'), 'mb-3') +

        ui.card(ui.head('Build & hosting') +
          ui.kv('Kind', U.esc(kindLabel(p.kind))) +
          ui.kv('Stack', U.esc(p.techStack || p.stack || '—')) +
          ui.kv('Hosting', U.esc(p.hostingProvider || '—')) +
          ui.kv('Repository', p.repoUrl ? ui.link(p.repoUrl, 'open', 'link') : '—') +
          ui.kv('Live address', p.url ? ui.link(p.url, 'open', 'link') : '—') +
          ui.kv('Stored copy', html ? U.bytes(html.length) + ' of HTML saved locally' : '—'), 'mb-3') +

        ui.card(ui.head('Files in the vault', files.length ? '<button class="btn btn-ghost btn-sm" data-action="projects.files" data-arg="' + p.id + '">Open all</button>' : '') +
          (files.length
            ? '<div class="space-y-1.5">' + files.slice(0, 6).map(d =>
              '<div class="row-card p-2 flex items-center gap-2" data-action="files.detail" data-arg="' + d.id + '">' +
              ui.icon(App.files.categoryIcon(d.category), 'text-textMuted text-[10px]') +
              '<div class="min-w-0 flex-1"><p class="text-[11px] truncate">' + U.esc(d.name) + '</p>' +
              '<p class="text-[9px] text-textMuted">' + U.esc(d.kind) + ' · ' + U.bytes(d.size) + ' · v' + U.esc(d.version || '1.0') + '</p></div>' +
              '<button class="btn btn-ghost btn-sm" data-action="files.download" data-arg="' + d.id + '"><i class="fa-solid fa-download"></i></button></div>').join('') + '</div>'
            : '<p class="text-[10px] text-textMuted">No files attached yet. Add the build folder, the design source, the contract — anything that belongs to this project.</p>'), 'mb-3') +

        (p.notes ? ui.card(ui.head('Notes') + '<p class="text-[10px] text-gray-300 whitespace-pre-line">' + U.esc(p.notes) + '</p>') : '')
    });
  }

  /* --------------------------------- form ---------------------------------- */
  function projectForm(id) {
    const p = id ? (projects().filter(x => x.id === id)[0] || {}) : {};
    ui.closeDrawer();
    ui.modal({
      title: id ? 'Edit ' + p.name : 'New project',
      sub: 'A website, an app, a software build or a service retainer — one record for each',
      size: 'lg',
      body:
        '<div class="grid grid-cols-1 md:grid-cols-2 gap-3">' +
        ui.field({ label: 'Project name', model: 'ui.proj.name', value: p.name || '' }) +
        ui.field({ label: 'Phase', model: 'ui.proj.phase', value: p.phase || 'development', options: PHASES.map(x => [x[0], x[1]]) }) +
        ui.field({ label: 'Kind', model: 'ui.proj.kind', value: p.kind || 'website', options: KINDS }) +
        ui.field({ label: 'Client', model: 'ui.proj.clientId', value: p.clientId || '', options: [['', '— our own project —']].concat(App.store.get('clients', []).map(c => [c.id, c.name])) }) +
        ui.field({ label: 'Live address', model: 'ui.proj.url', value: p.url || '', placeholder: 'https://…' }) +
        ui.field({ label: 'Tech stack', model: 'ui.proj.techStack', value: p.techStack || p.stack || '', placeholder: 'HTML/CSS/JS, PHP, React…' }) +
        ui.field({ label: 'Hosting provider', model: 'ui.proj.hostingProvider', value: p.hostingProvider || '' }) +
        ui.field({ label: 'Repository', model: 'ui.proj.repoUrl', value: p.repoUrl || '' }) +
        ui.field({ label: 'Project value (ETB)', model: 'ui.proj.price', value: p.price || 0, type: 'number' }) +
        ui.field({ label: 'Progress %', model: 'ui.proj.progressPct', value: p.progressPct != null ? p.progressPct : 50, type: 'number' }) +
        ui.field({ label: 'Started', model: 'ui.proj.startedAt', value: p.startedAt || U.todayISO(), type: 'date' }) +
        ui.field({ label: 'Target date', model: 'ui.proj.dueDate', value: p.dueDate || '', type: 'date' }) +
        ui.field({ label: 'Delivered on', model: 'ui.proj.deliveredAt', value: p.deliveredAt || '', type: 'date' }) +
        ui.field({ label: 'Hosting renewal', model: 'ui.proj.hostRenewDate', value: p.hostRenewDate || '', type: 'date' }) +
        ui.field({ label: 'Domain renewal', model: 'ui.proj.domainRenewDate', value: p.domainRenewDate || '', type: 'date' }) +
        ui.field({ label: 'Care plan', model: 'ui.proj.maintenancePlan', value: p.maintenancePlan || '', placeholder: 'e.g. Maintenance retainer' }) +
        ui.field({ label: 'Care fee per month (ETB)', model: 'ui.proj.maintenanceFee', value: p.maintenanceFee || 0, type: 'number' }) +
        '</div>' +
        ui.field({ label: 'Notes', model: 'ui.proj.notes', value: p.notes || '', rows: 3, wrapCls: 'mt-3', placeholder: 'Scope, what changed, what the client asked for next.' }),
      footer: '<button class="btn btn-ghost" data-action="close-modal">Cancel</button>' +
        (id ? '<button class="btn btn-danger" data-action="projects.delete" data-arg="' + id + '">Delete</button>' : '') +
        '<button class="btn btn-lime" data-action="projects.save" data-arg="' + (id || '') + '"><i class="fa-solid fa-floppy-disk"></i> Save project</button>'
    });
  }

  /* --------------------------------- screen -------------------------------- */
  App.views = App.views || {};
  App.views.projects = {
    title: 'Projects',
    sub: 'Live sites, new builds, current clients, ongoing care and past work',
    icon: 'fa-diagram-project',
    render(el, params) {
      const s = q();
      const all = projects();
      const rows = U.sortBy(filtered(), x => x.updatedAt || x.createdAt || '', 'desc');
      const clients = App.store.get('clients', []);
      const live = all.filter(p => p.phase === 'live').length;
      const building = all.filter(p => p.phase === 'development' || p.phase === 'active').length;
      const care = all.filter(p => p.phase === 'maintenance').length;
      const value = U.sum(all.filter(p => p.phase !== 'cancelled'), p => Number(p.price) || 0);
      const dueCount = all.reduce((a, p) => a + dueFor(p).length, 0);

      el.innerHTML =
        ui.hero([
          { label: 'Hosted & online', value: String(live), tone: 'lime', sub: 'Live sites we maintain' },
          { label: 'In development', value: String(building), tone: 'blue', sub: 'New sites, apps and systems' },
          { label: 'Ongoing care', value: String(care), tone: 'amber', sub: 'Retainers that pay monthly' },
          { label: 'Portfolio value', value: U.money(value), tone: 'violet',
            sub: dueCount ? dueCount + ' payment' + (dueCount === 1 ? '' : 's') + ' still open' : 'every payment settled' }
        ]) +

        '<div class="page-bar">' +
        '<div class="page-bar__filters">' +
        ui.chip('Everything (' + all.length + ')', s.tab === 'all', 'projects.tab', 'all', 'fa-layer-group') +
        PHASES.map(p => ui.chip(p[1] + ' (' + all.filter(x => x.phase === p[0]).length + ')', s.tab === p[0], 'projects.tab', p[0], p[2])).join('') +
        '</div>' +
        '<div class="page-bar__tools">' +
        '<select class="inp" data-model="ui.projClientFilter" data-change-action="projects.filterClient">' +
        '<option value="">All clients</option>' +
        clients.map(c => '<option value="' + U.attr(c.id) + '"' + (s.client === c.id ? ' selected' : '') + '>' + U.esc(c.name) + '</option>').join('') +
        '</select>' +
        '<input class="inp w-[170px]" data-model="ui.projSearch" data-change-action="projects.applyFilters" data-enter="projects.applyFilters" value="' + U.attr(s.search) + '" placeholder="Search projects…" />' +
        '<button class="btn btn-lime btn-sm" data-action="projects.new"><i class="fa-solid fa-plus"></i> New project</button>' +
        '</div></div>' +

        (dueCount
          ? '<div class="glass-soft rounded-xl p-3 mb-4 text-[11px] flex items-center gap-2.5 tone tone-amber border">' +
            ui.icon('fa-hourglass-half', '') +
            '<span>' + dueCount + ' project payment' + (dueCount === 1 ? ' is' : 's are') + ' still open.</span>' +
            '<button class="btn btn-ghost btn-sm ml-auto" data-nav="payments">Open Money</button></div>'
          : '') +

        (rows.length
          ? '<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger">' + rows.map(projectCard).join('') + '</div>'
          : ui.empty(all.length ? 'Nothing in this phase' : 'No projects yet',
            all.length ? 'Pick another phase above, or clear the filters.' : 'Register the websites you host, the builds in progress and the clients you work with. Files, payments and renewals all attach to a project.',
            'fa-diagram-project',
            '<button class="btn btn-lime btn-sm" data-action="projects.new"><i class="fa-solid fa-plus"></i> Create the first project</button>'));

      if (params) openProject(params);
    }
  };

  /* --------------------------------- actions ------------------------------- */
  App.action('projects.tab', el => { q().tab = el.getAttribute('data-arg'); App.emit('state:changed', { path: 'projects' }); });
  App.action('projects.applyFilters', () => { q().search = App.store.get('ui.projSearch', ''); App.emit('state:changed', { path: 'projects' }); });
  App.action('projects.filterClient', el => { q().client = el.value || ''; App.emit('state:changed', { path: 'projects' }); });
  App.action('projects.open', el => { const id = el.getAttribute('data-arg'); if (id) openProject(id); });
  App.action('projects.new', () => projectForm(''));
  App.action('projects.edit', el => projectForm(el.getAttribute('data-arg')));
  App.action('projects.files', el => { const id = el.getAttribute('data-arg'); ui.closeDrawer(); App.router.go('files', id); });
  App.action('projects.uploadFile', el => {
    const id = el.getAttribute('data-arg');
    const p = App.store.find('sites', id);
    App.store.set('ui.upload.category', 'website', { silent: true });
    App.store.set('ui.upload.projectId', id, { silent: true });
    App.store.set('ui.upload.clientId', (p && p.clientId) || '', { silent: true });
    ui.closeDrawer();
    App.actions['files.upload']();
  });
  App.action('projects.save', el => {
    const id = el.getAttribute('data-arg');
    const g = k => App.store.get('ui.proj.' + k, '');
    const client = App.store.find('clients', g('clientId'));
    const data = {
      name: g('name'),
      phase: g('phase'),
      kind: g('kind'),
      clientId: g('clientId'),
      clientName: client ? client.name : 'Triverse Studio',
      url: g('url'),
      techStack: g('techStack'),
      hostingProvider: g('hostingProvider'),
      repoUrl: g('repoUrl'),
      price: Number(g('price')) || 0,
      progressPct: U.clamp(Number(g('progressPct')) || 0, 0, 100),
      startedAt: g('startedAt'),
      dueDate: g('dueDate'),
      deliveredAt: g('deliveredAt'),
      hostRenewDate: g('hostRenewDate'),
      domainRenewDate: g('domainRenewDate'),
      maintenancePlan: g('maintenancePlan'),
      maintenanceFee: Number(g('maintenanceFee')) || 0,
      notes: g('notes')
    };
    if (!data.name) { ui.toast('Give the project a name', 'amber'); return; }
    data.status = data.phase === 'live' ? 'live' : (data.phase === 'delivered' ? 'archived' : (data.phase === 'paused' ? 'offline' : 'draft'));
    if (id) {
      App.store.patch('sites', id, data);
      App.log('project', 'Project “' + data.name + '” updated', id);
    } else {
      const made = App.store.add('sites', Object.assign({ generatedFrom: null, kind: data.kind }, data));
      App.log('project', 'Project “' + data.name + '” created', made.id);
    }
    ui.closeModal();
    ui.toast(id ? 'Project updated' : 'Project created', 'lime');
    App.refresh();
  });
  App.action('projects.delete', el => {
    const id = el.getAttribute('data-arg');
    const p = App.store.find('sites', id);
    const files = filesFor(p || {});
    ui.confirm({
      title: 'Delete this project?', tone: 'danger', confirmLabel: 'Delete the project',
      message: '“' + (p ? p.name : '') + '” will be removed. ' + (files.length ? files.length + ' attached file record(s) stay in the File vault (unlink them there if you want them gone). ' : '') + 'Invoices are untouched.',
      onConfirm() {
        App.store.dropHTML(id);
        App.store.remove('sites', id);
        ui.closeModal(); ui.closeDrawer();
        ui.toast('Project deleted', 'amber');
        App.refresh();
      }
    });
  });
})(window);
