/* =============================================================================
   Triverse OS — Clients (CRM) + Service catalogue
   Worked / current / paused / past / rejected companies, their contacts,
   projects, service history, money and linked websites.
   ========================================================================== */
(function (global) {
  'use strict';

  const App = global.App;
  const U = App.util;
  const ui = App.ui;

  function q() {
    App.router.q.clients = App.router.q.clients || { stage: 'all', search: '', industry: 'all', sort: 'value' };
    return App.router.q.clients;
  }

  function servicesOf(client) {
    const catalog = App.store.get('catalog', []);
    return (client.services || []).map(id => catalog.filter(s => s.id === id)[0]).filter(Boolean);
  }

  App.clientMoney = function (clientId) {
    const rows = App.store.get('payments', []).filter(p => p.clientId === clientId);
    const paid = U.sum(rows.filter(p => ['paid', 'partial'].indexOf(p.status) !== -1), p => Number(p.amountPaid) || (p.status === 'paid' ? Number(p.amount) : 0));
    const due = U.sum(rows.filter(p => ['pending', 'partial', 'overdue'].indexOf(p.status) !== -1), p => (Number(p.amount) || 0) - (Number(p.amountPaid) || 0));
    const overdue = U.sum(rows.filter(p => p.status === 'overdue'), p => (Number(p.amount) || 0) - (Number(p.amountPaid) || 0));
    const retainer = U.sum(rows.filter(p => p.recurring === 'monthly' && p.status === 'paid'), p => Number(p.amount) || 0);
    return { rows: rows, paid: paid, due: due, overdue: overdue, retainer: retainer, contracts: U.sum(rows, p => Number(p.amount) || 0) };
  };

  function filtered() {
    const s = q();
    let list = App.store.get('clients', []).slice();
    if (s.stage !== 'all') list = list.filter(c => c.stage === s.stage);
    if (s.industry !== 'all') list = list.filter(c => c.industry === s.industry);
    if (s.search) list = list.filter(c => U.hit(c.name, s.search) || U.hit(c.contactName, s.search) || U.hit(c.phone, s.search) || U.hit(c.email, s.search) || U.hit(c.industry, s.search));
    const key = {
      value: c => App.clientMoney(c.id).contracts,
      name: c => String(c.name).toLowerCase(),
      recent: c => c.updatedAt || '',
      stage: c => App.dict.clientStages.indexOf(c.stage)
    }[s.sort] || (c => 0);
    return U.sortBy(list, key, s.sort === 'name' || s.sort === 'stage' ? 'asc' : 'desc');
  }

  function clientRow(c) {
    const money = App.clientMoney(c.id);
    const sites = App.store.get('sites', []).filter(s => s.clientId === c.id);
    return '<div class="row-card p-3 grid grid-cols-1 md:grid-cols-[2fr_1.4fr_1fr_auto] gap-3 items-center" data-action="client.open" data-arg="' + c.id + '">' +
      '<div class="flex items-center gap-3 min-w-0">' + ui.avatar(c.name, 'w-9 h-9 text-[11px]') +
      '<div class="min-w-0"><p class="text-[12px] font-bold text-white truncate">' + U.esc(c.name) + '</p>' +
      '<p class="text-[9px] text-textMuted truncate">' + U.esc(c.contactName || '—') + (c.designation ? ' · ' + U.esc(c.designation) : '') + ' · ' + U.esc(App.dict.typeLabel(c.industry)) + '</p></div></div>' +
      '<div class="min-w-0"><p class="text-[10px] text-gray-300 truncate">' + U.esc(c.phone || 'no phone') + '</p>' +
      '<p class="text-[9px] text-textMuted truncate">' + U.esc(c.email || (c.whatsapp ? 'WhatsApp ' + c.whatsapp : 'no email')) + '</p></div>' +
      '<div><div class="flex items-center gap-1.5 flex-wrap">' + ui.badge(c.stage, App.dict.clientTones[c.stage]) +
      (c.health ? '<span class="tag">' + U.esc(c.health) + '</span>' : '') +
      (sites.length ? '<span class="tag">' + sites.length + ' site' + (sites.length > 1 ? 's' : '') + '</span>' : '') +
      (money.overdue ? ui.badge(U.money(money.overdue) + ' overdue', 'red') : '') + '</div>' +
      '<p class="text-[9px] text-textMuted mt-1">Paid ' + U.money(money.paid) + ' · due ' + U.money(money.due) + ' · ' + (c.services || []).length + ' services</p></div>' +
      '<div class="flex items-center gap-1 justify-end">' +
      '<button class="btn btn-ghost btn-sm" data-action="client.compose" data-arg="' + c.id + '" title="WhatsApp"><i class="fa-brands fa-whatsapp"></i></button>' +
      '<button class="btn btn-ghost btn-sm" data-action="pay.new" data-arg="' + c.id + '" title="Invoice"><i class="fa-solid fa-file-invoice-dollar"></i></button>' +
      '<i class="fa-solid fa-chevron-right text-[10px] text-textMuted"></i></div></div>';
  }

  App.views = App.views || {};
  App.views.clients = {
    title: 'Clients & companies',
    sub: 'Current, past and rejected companies with full history',
    icon: 'fa-border-all',
    render(el, params) {
      const m = App.metrics();
      const list = filtered();
      const s = q();
      const industries = U.uniq(App.store.get('clients', []).map(c => c.industry).filter(Boolean));
      const mrr = U.sum(m.clients.filter(c => c.stage === 'active'), c => App.clientMoney(c.id).retainer);

      el.innerHTML =
        ui.hero([
          { label: 'Working clients', value: String(m.activeClients), tone: 'lime',
            sub: U.money(mrr) + ' recurring each month' },
          { label: 'Prospects', value: String(m.prospectClients), tone: 'blue',
            sub: 'Won leads waiting to become clients' },
          { label: 'Past clients', value: String(m.pastClients), tone: 'violet',
            sub: 'References and repeat work' },
          { label: 'Contracted value', value: U.money(U.sum(m.clients, c => App.clientMoney(c.id).contracts)),
            sub: U.money(m.collected) + ' collected · ' + U.money(m.outstanding) + ' open' }
        ]) +

        '<div class="page-bar">' +
        '<div class="page-bar__filters">' +
        ui.chip('All (' + m.clients.length + ')', s.stage === 'all', 'client.filter', 'all') +
        App.dict.clientStages.map(st => ui.chip(U.title(st) + ' (' + m.clients.filter(c => c.stage === st).length + ')', s.stage === st, 'client.filter', st)).join('') +
        '</div>' +
        '<div class="page-bar__tools">' +
        '<input class="inp w-[170px]" data-model="ui.clientSearch" data-change-action="client.applyFilters" data-enter="client.applyFilters" value="' + U.attr(s.search) + '" placeholder="Search clients…" />' +
        '<select class="inp w-[160px]" data-model="ui.clientIndustry" data-change-action="client.applyFilters">' + ['all'].concat(industries).map(i =>
          '<option value="' + U.attr(i) + '"' + (s.industry === i ? ' selected' : '') + '>' + (i === 'all' ? 'All industries' : U.esc(App.dict.typeLabel(i))) + '</option>').join('') + '</select>' +
        '<select class="inp w-[150px]" data-model="ui.clientSort" data-change-action="client.applyFilters">' + [['value', 'Biggest first'], ['recent', 'Recently updated'], ['name', 'A → Z'], ['stage', 'By stage']].map(o =>
          '<option value="' + o[0] + '"' + (s.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>' +
        '<button class="btn btn-lime btn-sm" data-action="client.new"><i class="fa-solid fa-user-plus"></i> Add client</button>' +
        '<button class="btn btn-ghost btn-sm" data-action="client.export"><i class="fa-solid fa-file-csv"></i> Export</button>' +
        '</div></div>' +

        '<div class="space-y-2 stagger">' + (list.length ? list.map(clientRow).join('') : ui.empty('No clients match this filter', 'Add a client manually, or convert a lead from Discover with one tap.', 'fa-users')) + '</div>';

      if (params) openClient(params);
    }
  };

  /* -------------------------------- drawer --------------------------------- */
  function openClient(id) {
    const c = App.store.find('clients', id);
    if (!c) return;
    App.router.q.openClient = id;
    const money = App.clientMoney(id);
    const svc = servicesOf(c);
    const sites = App.store.get('sites', []).filter(s => s.clientId === id);
    const payments = money.rows;
    const lead = c.sourceLeadId ? App.store.find('leads', c.sourceLeadId) : null;

    ui.drawer({
      title: c.name,
      sub: App.dict.typeLabel(c.industry) + ' · ' + U.title(c.stage) + (c.startedAt ? ' since ' + U.fmtDate(c.startedAt) : ''),
      body:
        '<div class="flex items-center gap-2 flex-wrap mb-3">' + ui.badge(c.stage, App.dict.clientTones[c.stage]) +
        (c.health ? '<span class="tag">health: ' + U.esc(c.health) + '</span>' : '') +
        (c.tags || []).map(t => '<span class="tag">' + U.esc(t) + '</span>').join('') +
        (c.website ? ui.link(c.website, 'website', 'link text-[10px]') : ui.badge('no website', 'amber')) + '</div>' +

        '<div class="btn-row mb-4">' +
        (c.whatsapp || c.phone ? '<button class="btn btn-lime btn-sm" data-action="client.compose" data-arg="' + c.id + '"><i class="fa-brands fa-whatsapp"></i> Message</button>' : '') +
        (c.phone ? '<a class="btn btn-ghost btn-sm" href="tel:' + U.attr(c.phone) + '"><i class="fa-solid fa-phone"></i> Call</a>' : '') +
        (c.email ? '<a class="btn btn-ghost btn-sm" href="mailto:' + U.attr(c.email) + '"><i class="fa-solid fa-envelope"></i> Email</a>' : '') +
        '<button class="btn btn-ghost btn-sm" data-action="pay.new" data-arg="' + c.id + '"><i class="fa-solid fa-file-invoice-dollar"></i> New invoice</button>' +
        '<button class="btn btn-ghost btn-sm" data-action="client.generate" data-arg="' + c.id + '"><i class="fa-solid fa-wand-magic-sparkles"></i> Build / rebuild website</button>' +
        '<button class="btn btn-ghost btn-sm" data-action="client.edit" data-arg="' + c.id + '"><i class="fa-solid fa-pen"></i> Edit</button>' +
        '</div>' +

        ui.card(ui.head('Company & contact') +
          ui.kv('Contact person', U.esc(c.contactName || '—')) +
          ui.kv('Designation', U.esc(c.designation || '—')) +
          ui.kv('Phone', c.phone ? '<a class="link" href="tel:' + U.attr(c.phone) + '">' + U.esc(c.phone) + '</a>' : '—') +
          ui.kv('WhatsApp', U.esc(c.whatsapp || '—')) +
          ui.kv('Telegram', U.esc(c.telegram || '—')) +
          ui.kv('Email', c.email ? '<a class="link" href="mailto:' + U.attr(c.email) + '">' + U.esc(c.email) + '</a>' : '—') +
          ui.kv('Address', U.esc(c.address || '—')) +
          ui.kv('Account manager', U.esc(c.accountManager || '—')) +
          ui.kv('Source', U.esc(c.source || '—') + (lead ? ' · ' + ui.link('#/discover/' + lead.id, 'view original lead', 'link') : '')) +
          ui.kv('Timeline', (c.startedAt ? 'started ' + U.fmtDate(c.startedAt) : 'not started') + (c.endedAt ? ' · ended ' + U.fmtDate(c.endedAt) : '')), 'mb-4') +

        ui.card(ui.head('Money', ui.badge(U.money(money.paid) + ' received', 'lime')) +
          ui.kv('Contracted', U.money(money.contracts)) +
          ui.kv('Received', U.money(money.paid)) +
          ui.kv('Outstanding', '<span style="color:' + (money.due ? '#fcd34d' : '#e5e7eb') + '">' + U.money(money.due) + '</span>') +
          ui.kv('Overdue', '<span style="color:' + (money.overdue ? '#fca5a5' : '#e5e7eb') + '">' + U.money(money.overdue) + '</span>') +
          ui.kv('Monthly retainer', U.money(money.retainer)) +
          ui.table(['Invoice', 'Project', 'Amount', 'Status'], payments.slice(0, 6).map(p => ({
            cells: ['<span class="mono text-[10px]">' + U.esc(p.invoiceNo) + '</span>', U.esc(p.projectTitle), U.money(p.amount),
              ui.badge(p.status, App.dict.paymentTones[p.status])]
          })), { empty: 'No invoices yet' }), 'mb-4') +

        ui.card(ui.head('Services & projects', ui.badge(svc.length + '', 'muted')) +
          (svc.length ? '<div class="space-y-1.5">' + svc.map(x =>
            '<div class="flex items-center justify-between bg-field border border-line rounded-lg px-2.5 py-2">' +
            '<div><p class="text-[11px] text-gray-200">' + U.esc(x.name) + '</p>' +
            '<p class="text-[9px] text-textMuted">' + U.esc(x.category) + ' · ' + U.esc(x.unit || '') + '</p></div>' +
            '<span class="text-[10px] text-limeAccent font-semibold">' + U.money(x.price) + '</span></div>').join('') + '</div>'
            : '<p class="text-[10px] text-textMuted">No services attached yet — edit the client to pick from the catalogue.</p>'), 'mb-4') +

        ui.card(ui.head('Websites', ui.badge(sites.length + '', sites.length ? 'lime' : 'muted')) +
          (sites.length ? '<div class="space-y-1.5">' + sites.map(x =>
            '<div class="flex items-center gap-2 bg-field border border-line rounded-lg px-2.5 py-2">' +
            ui.badge(x.status, App.dict.siteTones[x.status] || 'muted') +
            '<div class="min-w-0 flex-1"><p class="text-[11px] truncate">' + U.esc(x.name) + '</p>' +
            '<p class="text-[9px] text-textMuted truncate">' + U.esc(x.templateId || '') + ' · ' + U.esc(x.hostingProvider || 'no host') + '</p></div>' +
            (x.url ? ui.link(x.url, 'open', 'link text-[10px]') : '<button class="btn btn-ghost btn-sm" data-action="sites.open" data-arg="' + x.id + '">Preview</button>') +
            '</div>').join('') + '</div>' : '<p class="text-[10px] text-textMuted">No website linked yet.</p>'), 'mb-4') +

        ui.card(ui.head('Notes & history') +
          '<div class="flex gap-2 mb-2"><input class="inp" id="client-note" placeholder="Call summary, next step, decision maker…" />' +
          '<button class="btn btn-lime btn-sm" data-action="client.addNote" data-arg="' + c.id + '">Add</button></div>' +
          '<p class="text-[11px] text-gray-300 whitespace-pre-line mb-2">' + U.esc(c.notes || 'No notes yet.') + '</p>' +
          ui.kv('Created', U.fmtDate(c.createdAt)) + ui.kv('Last updated', U.relTime(c.updatedAt))),
      footer: '<button class="btn btn-ghost btn-sm" data-action="client.stage" data-arg="' + c.id + '">Change stage</button>' +
        '<button class="btn btn-danger btn-sm" data-action="client.delete" data-arg="' + c.id + '">Delete</button>'
    });
  }
  App.openClient = openClient;

  /* --------------------------------- actions -------------------------------- */
  App.action('client.filter', el => { q().stage = el.getAttribute('data-arg'); App.emit('state:changed', { path: 'cfilter' }); });
  App.action('client.applyFilters', () => {
    const s = q();
    s.search = App.store.get('ui.clientSearch', '');
    s.industry = App.store.get('ui.clientIndustry', s.industry);
    s.sort = App.store.get('ui.clientSort', s.sort);
    App.emit('state:changed', { path: 'cfilter' });
  });
  App.action('client.open', el => App.router.go('clients', el.getAttribute('data-arg')));
  App.action('client.export', () => {
    const rows = filtered().map(c => {
      const m = App.clientMoney(c.id);
      return {
        name: c.name, stage: c.stage, industry: c.industry, contact: c.contactName, phone: c.phone, whatsapp: c.whatsapp,
        email: c.email, address: c.address, website: c.website, contracted: m.contracts, paid: m.paid, due: m.due,
        startedAt: c.startedAt, endedAt: c.endedAt, notes: (c.notes || '').replace(/\n/g, ' ')
      };
    });
    U.download('triverse-clients-' + U.todayISO() + '.csv', U.toCSV(rows), 'text/csv');
    ui.toast('Exported ' + rows.length + ' clients', 'lime');
  });
  App.action('client.edit', el => clientForm(el.getAttribute('data-arg')));
  App.action('client.new', () => clientForm(''));

  function clientForm(id) {
    const c = id ? App.store.find('clients', id) : null;
    const catalog = App.store.get('catalog', []);
    ui.modal({
      title: c ? 'Edit ' + c.name : 'New client / company',
      size: 'lg',
      body: '<div class="grid grid-cols-1 md:grid-cols-2 gap-3">' +
        ui.field({ label: 'Company name', model: 'ui.c.name', value: c ? c.name : '' }) +
        ui.field({ label: 'Stage', model: 'ui.c.stage', value: c ? c.stage : 'prospect', options: App.dict.clientStages.map(s => [s, U.title(s)]) }) +
        ui.field({ label: 'Industry / business type', model: 'ui.c.industry', value: c ? c.industry : 'general', options: App.dict.businessTypes.map(t => [t[0], t[1]]).concat([['general', 'Other']]) }) +
        ui.field({ label: 'Contact person', model: 'ui.c.contactName', value: c ? c.contactName : '' }) +
        ui.field({ label: 'Designation', model: 'ui.c.designation', value: c ? c.designation : '' }) +
        ui.field({ label: 'Phone', model: 'ui.c.phone', value: c ? c.phone : '' }) +
        ui.field({ label: 'WhatsApp', model: 'ui.c.whatsapp', value: c ? c.whatsapp : '' }) +
        ui.field({ label: 'Telegram', model: 'ui.c.telegram', value: c ? c.telegram : '' }) +
        ui.field({ label: 'Email', model: 'ui.c.email', value: c ? c.email : '' }) +
        ui.field({ label: 'Website', model: 'ui.c.website', value: c ? c.website : '' }) +
        ui.field({ label: 'Address', model: 'ui.c.address', value: c ? c.address : '' }) +
        ui.field({ label: 'Account manager', model: 'ui.c.accountManager', value: c ? c.accountManager : App.store.get('settings.company.senderName', '') }) +
        ui.field({ label: 'Health', model: 'ui.c.health', value: c ? c.health : 'warm', options: [['excellent', 'Excellent'], ['good', 'Good'], ['warm', 'Warm'], ['poor', 'Poor'], ['muted', 'Dormant']] }) +
        ui.field({ label: 'Started', model: 'ui.c.startedAt', value: c ? c.startedAt : '', type: 'date' }) +
        ui.field({ label: 'Ended (past clients)', model: 'ui.c.endedAt', value: c ? c.endedAt : '', type: 'date' }) +
        ui.field({ label: 'Tags (comma separated)', model: 'ui.c.tags', value: c ? (c.tags || []).join(', ') : '' }) +
        '</div>' +
        '<p class="lbl mt-2">Services sold / planned</p>' +
        '<div class="flex flex-wrap gap-1.5 mb-2">' + catalog.map(s =>
          '<button class="chip ' + (c && (c.services || []).indexOf(s.id) !== -1 ? 'is-on' : '') + '" data-action="client.toggleSvc" data-arg="' + s.id + '">' + U.esc(s.name) + ' · ' + U.money(s.price) + '</button>').join('') + '</div>' +
        '<div class="flex flex-wrap gap-1.5">' + ['logo', 'banners', 'thumbnail', 'flyer', 'business-card', 'social-ads', 'website', 'qr-menu', 'hr-system', 'custom-software', 'maintenance']
          .map(t => '<button class="chip" data-action="client.presetTag" data-arg="' + t + '">+ ' + U.esc(t) + '</button>').join('') + '</div>' +
        ui.field({ label: 'Notes', model: 'ui.c.notes', value: c ? c.notes : '', rows: 3, wrapCls: 'mt-3' }),
      footer: '<button class="btn btn-ghost" data-action="close-modal">Cancel</button>' +
        '<button class="btn btn-lime" data-action="client.save" data-arg="' + (c ? c.id : '') + '"><i class="fa-solid fa-floppy-disk"></i> Save client</button>'
    });
    App.store.set('ui.c.services', c ? (c.services || []).slice() : [], { silent: true });
    App.store.set('ui.c.id', c ? c.id : '', { silent: true });
  }

  App.action('client.toggleSvc', el => {
    const id = el.getAttribute('data-arg');
    const arr = App.store.get('ui.c.services', []).slice();
    const i = arr.indexOf(id);
    if (i === -1) arr.push(id); else arr.splice(i, 1);
    App.store.set('ui.c.services', arr, { silent: true });
    el.classList.toggle('is-on');
  });
  App.action('client.presetTag', el => {
    const t = el.getAttribute('data-arg');
    const f = document.querySelector('[data-model="ui.c.tags"]');
    if (f) { const v = f.value ? f.value.split(',').map(x => x.trim()) : []; if (v.indexOf(t) === -1) v.push(t); f.value = v.join(', '); }
  });
  App.action('client.save', el => {
    const id = el.getAttribute('data-arg');
    const g = k => App.store.get('ui.c.' + k, '');
    const data = {
      name: g('name'), stage: g('stage'), industry: g('industry'), contactName: g('contactName'), designation: g('designation'),
      phone: g('phone'), whatsapp: g('whatsapp'), telegram: g('telegram'), email: g('email'), website: g('website'),
      address: g('address'), accountManager: g('accountManager'), health: g('health'),
      startedAt: g('startedAt'), endedAt: g('endedAt'), notes: g('notes'),
      tags: String(g('tags')).split(',').map(t => t.trim()).filter(Boolean),
      services: App.store.get('ui.c.services', [])
    };
    if (!data.name) { ui.toast('Company name is required', 'amber'); return; }
    if (!data.whatsapp && data.phone) data.whatsapp = data.phone;
    if (id) { App.store.patch('clients', id, data); ui.toast('Client updated', 'lime'); }
    else {
      const rec = App.store.add('clients', Object.assign({ type: 'company', source: 'manual', sourceLeadId: '', type2: '' }, data));
      App.log('client', data.name + ' added to the client list', rec.id);
      ui.toast('Client added', 'lime');
      setTimeout(() => App.router.go('clients', rec.id), 250);
    }
    ui.closeModal();
  });
  App.action('client.addNote', el => {
    const id = el.getAttribute('data-arg');
    const box = document.getElementById('client-note');
    const text = box ? box.value.trim() : '';
    if (!text) { ui.toast('Write the note first', 'amber'); return; }
    const c = App.store.find('clients', id);
    App.store.patch('clients', id, { notes: (c.notes ? c.notes + '\n\n' : '') + '[' + U.fmtDate(U.todayISO()) + '] ' + text });
    if (box) box.value = '';
    ui.toast('Note added', 'lime');
  });
  App.action('client.stage', el => {
    const id = el.getAttribute('data-arg');
    const c = App.store.find('clients', id);
    ui.modal({
      title: 'Move ' + c.name,
      size: 'sm',
      body: '<div class="space-y-1.5">' + App.dict.clientStages.map(s =>
        '<button class="w-full text-left btn ' + (c.stage === s ? 'btn-lime' : 'btn-ghost') + '" data-action="client.setStage" data-arg="' + id + '" data-extra="' + s + '">' + U.title(s) + '</button>').join('') + '</div>' +
        '<p class="text-[10px] text-textMuted mt-2">Rejected companies stop receiving outreach and appear in the do-not-chase list.</p>',
      footer: '<button class="btn btn-ghost" data-action="close-modal">Cancel</button>'
    });
  });
  App.action('client.setStage', el => {
    const id = el.getAttribute('data-arg'), stage = el.getAttribute('data-extra');
    const c = App.store.find('clients', id);
    const patch = { stage: stage };
    if (stage === 'active' && !c.startedAt) patch.startedAt = U.todayISO();
    if ((stage === 'past' || stage === 'rejected') && !c.endedAt) patch.endedAt = U.todayISO();
    App.store.patch('clients', id, patch);
    ui.closeModal();
    ui.toast(c.name + ' → ' + U.title(stage), stage === 'rejected' ? 'amber' : 'lime');
  });
  App.action('client.delete', el => {
    const id = el.getAttribute('data-arg');
    const c = App.store.find('clients', id);
    ui.confirm({
      title: 'Delete this client?', tone: 'danger', confirmLabel: 'Delete', message: c.name + ' and its link to invoices will be removed. Invoices stay in the ledger.',
      onConfirm() { App.store.remove('clients', id); ui.closeDrawer(); ui.toast('Client deleted', 'amber'); }
    });
  });
  App.action('client.compose', el => {
    const c = App.store.find('clients', el.getAttribute('data-arg'));
    const lead = c.sourceLeadId ? App.store.find('leads', c.sourceLeadId) : null;
    const tpl = App.msg.templates().filter(t => t.id === 'msg_wa_welcome')[0] || App.msg.templates()[0];
    const fake = lead || {
      id: c.id, name: c.name, category: App.dict.typeLabel(c.industry), city: '', rating: 0, reviews: 0,
      phone: c.whatsapp || c.phone, intlPhone: c.whatsapp || c.phone, whatsapp: true, telegram: c.telegram,
      email: c.email, website: c.website, businessType: c.industry, outreach: []
    };
    const body = App.msg.render(tpl, fake).body;
    ui.modal({
      title: 'Message ' + c.name,
      sub: 'Sent from your number with the text ready to send',
      size: 'lg',
      body: '<textarea class="inp" id="client-msg" rows="10">' + U.esc(body) + '</textarea>' +
        '<div class="flex items-center gap-2 mt-2">' + ui.badge(App.dict.chanLabel('whatsapp'), 'lime') + '<span class="text-[10px] text-textMuted">' + U.esc(c.whatsapp || c.phone || 'no number') + '</span></div>',
      footer: '<button class="btn btn-ghost" data-action="close-modal">Cancel</button>' +
        '<button class="btn btn-ghost" data-action="client.copyMsg" data-arg="' + c.id + '">Copy</button>' +
        '<button class="btn btn-lime" data-action="client.sendMsg" data-arg="' + c.id + '"><i class="fa-brands fa-whatsapp"></i> Open WhatsApp</button>'
    });
  });
  App.action('client.copyMsg', () => {
    const box = document.getElementById('client-msg');
    U.copy(box ? box.value : '').then(() => ui.toast('Copied', 'lime'));
  });
  App.action('client.sendMsg', el => {
    const c = App.store.find('clients', el.getAttribute('data-arg'));
    const box = document.getElementById('client-msg');
    const lead = { name: c.name, phone: c.whatsapp || c.phone, intlPhone: c.whatsapp || c.phone, whatsapp: true };
    const url = App.msg.deepLink('whatsapp', lead, { body: box ? box.value : '' });
    if (!url) { ui.toast('No WhatsApp number saved for this client', 'amber'); return; }
    U.openUrl(url);
    U.copy(box ? box.value : '');
    App.log('message', 'WhatsApp message sent to client ' + c.name, c.id);
    ui.closeModal();
    ui.toast('WhatsApp opened with the message', 'lime');
  });
  App.action('client.generate', el => {
    const c = App.store.find('clients', el.getAttribute('data-arg'));
    const lead = c.sourceLeadId ? App.store.find('leads', c.sourceLeadId) : null;
    const source = lead || {
      id: '', name: c.name, businessType: c.industry || 'general', category: App.dict.typeLabel(c.industry),
      city: '', address: c.address, phone: c.phone, intlPhone: c.whatsapp || c.phone, whatsapp: true,
      email: c.email, website: c.website, rating: 0, reviews: 0, outreach: [], tags: []
    };
    const out = App.sitegen.build({ lead: source, templateId: App.store.get('templates')[0].id, options: {} });
    ui.modal({
      title: 'Website for ' + c.name,
      size: 'xl',
      body: '<p class="text-[10px] text-textMuted mb-2">Built from the client record. Save it to their site list to keep the file.</p>' + ui.previewFrame(out.html, 520),
      footer: '<button class="btn btn-ghost" data-action="close-modal">Close</button>' +
        '<button class="btn btn-ghost" data-action="client.dlSite">Download HTML</button>' +
        '<button class="btn btn-lime" data-action="client.saveSite" data-arg="' + c.id + '">Save to their websites</button>'
    });
    App.router.q.tmpHtml = out.html;
    App.router.q.tmpMeta = out.meta;
  });
  App.action('client.dlSite', () => U.download('client-website.html', App.router.q.tmpHtml || '', 'text/html'));
  App.action('client.saveSite', el => {
    const c = App.store.find('clients', el.getAttribute('data-arg'));
    const rec = App.store.add('sites', {
      name: (U.slug(c.name) || 'client') + '.com', kind: 'client', status: 'draft', clientId: c.id, clientName: c.name,
      url: c.website || '', templateId: (App.router.q.tmpMeta || {}).templateId || '', businessType: c.industry || 'general',
      stack: 'Generated static page', hostingProvider: '', repoUrl: '', price: App.msg.recommend({ businessType: c.industry, website: c.website, reviews: 0 }).total,
      hostRenewDate: '', domainRenewDate: '', notes: 'Generated from the client record.', generatedFrom: { leadId: c.sourceLeadId || '', businessType: c.industry || 'general' }
    });
    App.store.setHTML(rec.id, App.router.q.tmpHtml || '');
    ui.closeModal();
    ui.toast('Saved to their websites', 'lime');
    App.router.go('sites', rec.id);
  });
  App.action('client.filterIndustry', () => App.emit('state:changed', { path: 'cfilter' }));

  /* -------------------------- service catalogue view ------------------------ */
  App.views.catalog = {
    title: 'Service catalogue',
    sub: 'What we sell, at what price — used by proposals, invoices and messages',
    icon: 'fa-award',
    render(el) {
      const catalog = App.store.get('catalog', []);
      const groups = U.groupBy(catalog, s => s.category);
      const used = App.store.get('payments', []);
      const totalPotential = U.sum(catalog.filter(s => s.active), s => Number(s.price) || 0);

      const activeCount = catalog.filter(s => s.active).length;
      el.innerHTML =
        ui.hero([
          { label: 'Services listed', value: String(catalog.length), tone: 'lime',
            sub: activeCount + ' active · ' + (catalog.length - activeCount) + ' hidden' },
          { label: 'Full basket value', value: U.money(totalPotential),
            sub: 'Everything a client could buy from us' },
          { label: 'Invoiced so far', value: String(used.length), tone: 'blue',
            sub: 'Services already sold and billed' }
        ]) +

        '<div class="page-bar">' +
        '<div class="page-bar__filters">' + Object.keys(groups).map(g => '<span class="chip">' + U.esc(g) + ' · ' + groups[g].length + '</span>').join('') + '</div>' +
        '<div class="page-bar__tools">' +
        '<button class="btn btn-ghost btn-sm" data-action="cat.export"><i class="fa-solid fa-file-csv"></i> Export price list</button>' +
        '<button class="btn btn-lime btn-sm" data-action="cat.new"><i class="fa-solid fa-plus"></i> Add service</button>' +
        '</div></div>' +

        Object.keys(groups).map(g =>
          ui.card(ui.head(U.title(g) + ' services', ui.badge(groups[g].length + '', 'muted')) +
            ui.table(['Service', 'Price', 'Unit', 'Delivery', 'Status', ''], groups[g].map(s => {
              const sold = used.filter(p => p.serviceId === s.id).length;
              return {
                cells: [
                  '<div><p class="text-[11px] text-gray-200">' + U.esc(s.name) + '</p><p class="text-[9px] text-textMuted">' + U.esc(s.desc || '') + '</p></div>',
                  '<b class="text-limeAccent">' + U.money(s.price) + '</b>',
                  U.esc(s.unit || '—'),
                  (s.deliveryDays ? s.deliveryDays + ' days' : '—'),
                  (s.active ? ui.badge('active', 'lime') : ui.badge('hidden', 'muted')) + (sold ? ' <span class="tag">' + sold + ' sold</span>' : ''),
                  '<button class="btn btn-ghost btn-sm" data-action="cat.edit" data-arg="' + s.id + '">Edit</button>'
                ],
                attrs: ' data-action="cat.edit" data-arg="' + s.id + '"'
              };
            })), 'mb-4')).join('');
    }
  };

  App.action('cat.new', () => catForm(''));
  App.action('cat.edit', el => catForm(el.getAttribute('data-arg')));
  function catForm(id) {
    const s = id ? App.store.find('catalog', id) : null;
    ui.modal({
      title: s ? 'Edit ' + s.name : 'Add a service / product',
      body: '<div class="grid grid-cols-1 md:grid-cols-2 gap-3">' +
        ui.field({ label: 'Name', model: 'ui.s.name', value: s ? s.name : '' }) +
        ui.field({ label: 'Category', model: 'ui.s.category', value: s ? s.category : 'website', options: [['website', 'Website'], ['software', 'Software'], ['design', 'Graphic design'], ['marketing', 'Marketing'], ['hosting', 'Hosting'], ['retainer', 'Retainer']] }) +
        ui.field({ label: 'Price', model: 'ui.s.price', value: s ? s.price : 0, type: 'number' }) +
        ui.field({ label: 'Unit', model: 'ui.s.unit', value: s ? s.unit : 'one-time', options: [['one-time', 'One time'], ['monthly', 'Monthly'], ['yearly', 'Yearly'], ['each', 'Each'], ['hourly', 'Hourly']] }) +
        ui.field({ label: 'Delivery days', model: 'ui.s.deliveryDays', value: s ? s.deliveryDays : 3, type: 'number' }) +
        ui.field({ label: 'Active', model: 'ui.s.active', value: s ? s.active : true, type: 'checkbox', checkLabel: 'Show in proposals and invoices' }) +
        '</div>' + ui.field({ label: 'Short description', model: 'ui.s.desc', value: s ? s.desc : '', rows: 2, wrapCls: 'mt-3' }),
      footer: (s ? '<button class="btn btn-danger" data-action="cat.delete" data-arg="' + s.id + '">Delete</button>' : '<button class="btn btn-ghost" data-action="close-modal">Cancel</button>') +
        '<button class="btn btn-lime" data-action="cat.save" data-arg="' + (s ? s.id : '') + '">Save</button>'
    });
  }
  App.action('cat.save', el => {
    const id = el.getAttribute('data-arg');
    const data = {
      name: App.store.get('ui.s.name', ''), category: App.store.get('ui.s.category', 'website'),
      price: Number(App.store.get('ui.s.price', 0)) || 0, unit: App.store.get('ui.s.unit', 'one-time'),
      deliveryDays: Number(App.store.get('ui.s.deliveryDays', 3)) || 0, desc: App.store.get('ui.s.desc', ''),
      active: Boolean(App.store.get('ui.s.active', true))
    };
    if (!data.name) { ui.toast('Name is required', 'amber'); return; }
    if (id) App.store.patch('catalog', id, data); else App.store.add('catalog', data);
    ui.closeModal(); ui.toast('Catalogue saved', 'lime');
  });
  App.action('cat.delete', el => {
    const id = el.getAttribute('data-arg');
    ui.confirm({
      title: 'Delete this service?', tone: 'danger', confirmLabel: 'Delete',
      message: 'Existing invoices keep their amounts; the service just stops appearing in new proposals.',
      onConfirm() { App.store.remove('catalog', id); ui.closeModal(); ui.toast('Service deleted', 'amber'); }
    });
  });
  App.action('cat.export', () => {
    U.download('triverse-price-list.csv', U.toCSV(App.store.get('catalog', []).map(s => ({
      name: s.name, category: s.category, price: s.price, unit: s.unit, deliveryDays: s.deliveryDays, active: s.active, desc: s.desc
    }))), 'text/csv');
    ui.toast('Price list exported', 'lime');
  });
})(window);
