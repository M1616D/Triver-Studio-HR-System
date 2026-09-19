/* =============================================================================
   Triverse OS — Websites, samples & templates
   Everything we already own: hosted sites, client sites, sample pages,
   auto-generated drafts and the design templates they come from.
   ========================================================================== */
(function (global) {
  'use strict';

  const App = global.App;
  const U = App.util;
  const ui = App.ui;

  function q() {
    App.router.q.assets = App.router.q.assets || { tab: 'all', search: '' };
    return App.router.q.assets;
  }

  const KINDS = [['all', 'Everything', 'fa-layer-group'], ['hosted', 'Our hosted sites', 'fa-server'], ['client', 'Client websites', 'fa-handshake'],
    ['library', 'Sample library', 'fa-cubes'], ['sample', 'Reference pages', 'fa-images'],
    ['template', 'Design templates', 'fa-swatchbook'], ['draft', 'Generated drafts', 'fa-wand-magic-sparkles']];

  function sitesFiltered() {
    const s = q();
    let list = App.store.get('sites', []).slice();
    if (s.tab !== 'all' && s.tab !== 'template') list = list.filter(x => x.kind === s.tab);
    if (s.search) list = list.filter(x => U.hit(x.name, s.search) || U.hit(x.clientName, s.search) || U.hit(x.url, s.search) || U.hit(x.notes, s.search));
    return U.sortBy(list, x => x.updatedAt || x.createdAt || '', 'desc');
  }

  function renewChip(date, label) {
    if (!date) return '';
    const d = U.daysUntil(date);
    const tone = d < 0 ? 'red' : d <= 30 ? 'amber' : 'muted';
    return '<span class="chip ' + (tone === 'amber' ? 'is-on' : '') + '">' + ui.icon('fa-rotate', 'text-[9px]') + ' ' + label + ' ' + U.fmtDate(date) + (d < 0 ? ' (expired)' : ' · ' + d + 'd') + '</span>';
  }

  function siteCard(x) {
    const hasHtml = x.kind === 'draft' && App.store.html(x.id);
    return '<div class="glass-card rounded-2xl p-4 flex flex-col justify-between">' +
      '<div>' +
      '<div class="flex items-start justify-between gap-2 mb-2">' +
      '<div class="min-w-0"><p class="text-[12px] font-bold truncate">' + U.esc(x.name) + '</p>' +
      '<p class="text-[9px] text-textMuted truncate">' + U.esc(x.clientName || 'Triverse Studio') + (x.businessType ? ' · ' + U.esc(App.dict.typeLabel(x.businessType)) : '') + '</p></div>' +
      '<div class="flex flex-col items-end gap-1 shrink-0">' + ui.badge(x.status, App.dict.siteTones[x.status] || 'muted') +
      '<span class="tag">' + U.esc(x.kind) + '</span></div></div>' +
      (x.url ? '<p class="text-[10px] mb-2">' + ui.link(x.url, x.url.replace(/^https?:\/\//, '')) + '</p>' : '<p class="text-[10px] text-textMuted mb-2">not published yet' + (hasHtml ? ' · local draft stored' : '') + '</p>') +
      '<div class="flex flex-wrap gap-1 mb-2">' +
      (x.templateId ? '<span class="tag">' + U.esc((App.store.find('templates', x.templateId) || {}).name || x.templateId) + '</span>' : '') +
      (x.hostingProvider ? '<span class="tag">' + U.esc(x.hostingProvider) + '</span>' : '') +
      (x.price ? '<span class="tag" style="color:#cbfa31">' + U.money(x.price) + '</span>' : '') +
      (x.generatedFrom && x.generatedFrom.leadId ? '<span class="tag">from lead</span>' : '') +
      '</div>' +
      '<p class="text-[9px] text-textMuted line-clamp-2">' + U.esc(x.notes || '') + '</p>' +
      '</div>' +
      '<div class="mt-3">' +
      '<div class="flex flex-wrap gap-1 mb-2">' + renewChip(x.hostRenewDate, 'hosting') + renewChip(x.domainRenewDate, 'domain') + '</div>' +
      '<div class="btn-row">' +
      (x.kind === 'draft' || x.kind === 'sample'
        ? '<button class="btn btn-lime btn-sm" data-action="sites.open" data-arg="' + x.id + '"><i class="fa-solid fa-eye"></i> Preview</button>'
        : '<a class="btn btn-lime btn-sm" href="' + U.attr(x.url) + '" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> Visit</a>') +
      '<button class="btn btn-ghost btn-sm" data-action="sites.edit" data-arg="' + x.id + '"><i class="fa-solid fa-pen"></i></button>' +
      (x.kind === 'draft' ? '<button class="btn btn-ghost btn-sm" data-action="sites.rebuild" data-arg="' + x.id + '" title="Rebuild from the latest data and template"><i class="fa-solid fa-rotate"></i></button>' : '') +
      (App.store.html(x.id) || x.url ? '<button class="btn btn-ghost btn-sm" data-action="sites.send" data-arg="' + x.id + '" title="Send to the client"><i class="fa-brands fa-whatsapp"></i></button>' : '') +
      '</div></div></div>';
  }

  function templateCard(t) {
    const used = App.store.get('sites', []).filter(s => s.templateId === t.id).length;
    return '<div class="glass-card rounded-2xl p-4">' +
      '<div class="flex items-start justify-between gap-2 mb-2">' +
      '<div class="min-w-0"><p class="text-[12px] font-bold truncate">' + U.esc(t.name) + '</p>' +
      '<p class="text-[9px] text-textMuted">' + U.esc(t.style) + ' · ' + U.esc(t.hero) + ' hero</p></div>' +
      (t.active === false ? ui.badge('hidden', 'muted') : ui.badge('active', 'lime')) + '</div>' +
      '<div class="h-16 rounded-xl mb-2 flex items-end p-2" style="background:linear-gradient(135deg,' + U.attr(t.accent) + '22,' + U.attr(t.bg) + ');border:1px solid ' + U.attr(t.border) + '">' +
      '<span class="px-2 py-1 rounded-lg text-[9px] font-bold" style="background:' + U.attr(t.accent) + ';color:' + U.attr(t.bg) + '">' + U.esc((t.bestFor || []).slice(0, 2).map(b => App.dict.typeLabel(b)).join(' + ') || 'any business') + '</span></div>' +
      '<p class="text-[9px] text-textMuted mb-2">' + U.esc(t.notes || '') + '</p>' +
      '<div class="flex flex-wrap gap-1 mb-2"><span class="tag">used ' + used + '×</span>' +
      [['accent', t.accent], ['bg', t.bg], ['surface', t.surface], ['text', t.text]].map(c =>
        '<span class="w-4 h-4 rounded" style="background:' + U.attr(c[1]) + ';border:1px solid ' + U.attr(t.border) + '" title="' + c[0] + ' ' + U.attr(c[1]) + '"></span>').join('') + '</div>' +
      '<div class="btn-row">' +
      '<button class="btn btn-lime btn-sm" data-action="tpl.use" data-arg="' + t.id + '"><i class="fa-solid fa-wand-magic-sparkles"></i> Build with this</button>' +
      '<button class="btn btn-ghost btn-sm" data-action="tpl.edit" data-arg="' + t.id + '"><i class="fa-solid fa-pen"></i> Edit theme</button>' +
      '</div></div>';
  }

  App.views = App.views || {};
  /* ======================= sample site library (clone + fill) =============== */
  const CATEGORY_LABELS = {
    saas: 'Software / SaaS', qrmenu: 'Digital QR menu', food: 'Restaurant & cafe',
    hotel: 'Hotel & guest house', cosmetics: 'Cosmetics & beauty', gym: 'Gym & fitness',
    shop: 'Shop & retail', clinic: 'Clinic & pharmacy', services: 'Local service', other: 'Other'
  };

  function categoryLabel(k) { return CATEGORY_LABELS[k] || U.title(String(k || 'other')); }

  function analysisBox(a) {
    if (!a) return '';
    const row = (l, v) => '<div><p class="text-[9px] text-textMuted uppercase tracking-wide">' + l + '</p><p class="text-[11px]">' + v + '</p></div>';
    return '<div class="glass-soft rounded-xl p-3 mb-3">' +
      '<p class="text-[11px] font-semibold mb-2">' + ui.icon('fa-circle-check', 'text-accentMint') + ' Sample read: ' + U.esc(a.title || 'untitled') + '</p>' +
      '<div class="grid grid-cols-2 md:grid-cols-4 gap-3">' +
      row('Can be cloned', a.quality + '% confidence') +
      row('Text', a.words + ' words · ' + a.textCount + ' blocks') +
      row('Photos', a.images.length + '') +
      row('Sections', U.esc(a.sections.slice(0, 3).join(', ') || 'basic page')) +
      row('Phone found', U.esc(a.phones[0] || 'none')) +
      row('Map found', a.mapIframe ? 'yes' : 'no — one will be added') +
      row('Socials found', U.esc(Object.keys(a.socials).join(', ') || 'none')) +
      row('Live fields', a.placeholders.length ? a.placeholders.length + ' {{placeholders}}' : 'filled by detection') +
      '</div></div>';
  }

  function sampleCard(s) {
    const types = App.dict.businessTypes.filter(t => (App.samples.typeCategory[t[0]] || 'other') === s.category)
      .map(t => t[1]).slice(0, 4).join(', ');
    return '<div class="glass-card rounded-2xl p-4 flex flex-col justify-between">' +
      '<div>' +
      '<div class="flex items-start justify-between gap-2 mb-2">' +
      '<div class="min-w-0"><p class="text-[12px] font-bold truncate">' + U.esc(s.name) + '</p>' +
      '<p class="text-[9px] text-textMuted">' + U.esc(categoryLabel(s.category)) +
      (s.imported ? ' · your design' : s.source === 'uploaded' ? ' · uploaded' : ' · studio default') + '</p></div>' +
      (s.usedCount ? '<span class="tag">' + s.usedCount + 'x</span>' : '') + '</div>' +
      '<p class="text-[10px] text-textMuted mb-2">' + U.esc(s.blurb || '') + '</p>' +
      (types ? '<p class="text-[9px] text-textMuted mb-2">Used for: ' + U.esc(types) + '</p>' : '') +
      (s.imported && s.source ? '<p class="text-[9px] text-textMuted mb-2 truncate" title="' + U.attr(s.source) + '">' +
        ui.icon('fa-folder-open', 'text-[8px]') + ' ' + U.esc(String(s.source).split('/').slice(-2).join('/')) + '</p>' : '') +
      '</div>' +
      '<div class="btn-row mt-2">' +
      '<button class="btn btn-lime btn-sm" data-action="samples.open" data-arg="' + U.attr(s.id) + '"><i class="fa-solid fa-eye"></i> Preview</button>' +
      '<button class="btn btn-ghost btn-sm" data-action="samples.clone" data-arg="' + U.attr(s.id) + '"><i class="fa-solid fa-copy"></i> Copy into the library</button>' +
      (s.source === 'uploaded' || s.imported
        ? (s.imported ? '' : '<button class="btn btn-ghost btn-sm" data-action="samples.edit" data-arg="' + U.attr(s.id) + '"><i class="fa-solid fa-pen"></i></button>') +
          (s.imported ? '' : '<button class="btn btn-ghost btn-sm" data-action="samples.del" data-arg="' + U.attr(s.id) + '"><i class="fa-solid fa-trash"></i></button>')
        : '<span class="text-[9px] text-textMuted self-center">studio default</span>') +
      '</div></div>';
  }

  function sampleLibrary() {
    const list = App.samples.list();
    const uploaded = list.filter(s => s.source === 'uploaded').length;
    const last = App.router.q.samplesLast;
    return ui.card(
      ui.head('Sample library',
        '<div class="btn-row">' +
        '<button class="btn btn-ghost btn-sm" data-action="samples.match"><i class="fa-solid fa-diagram-project"></i> Which sample for which type</button>' +
        '<button class="btn btn-lime btn-sm" data-action="samples.new"><i class="fa-solid fa-arrow-up-from-bracket"></i> Upload a sample</button>' +
        '</div>',
        list.length + ' designs (' + App.samples.imported.length + ' from your sample folder, ' + uploaded + ' uploaded by hand) · one per category, only the information changes.') +
      (last ? analysisBox(last) : '') +
      '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">' + list.map(sampleCard).join('') + '</div>', 'mb-4');
  }

  /** the category chips, shared by every tab including the sample library */
  function tabChips(s, sites, templates) {
    const count = k => k === 'library' ? App.samples.list().length
      : k === 'template' ? templates.length
        : k === 'all' ? sites.length
          : sites.filter(x => x.kind === k).length;
    return '<div class="flex flex-wrap gap-1.5">' +
      KINDS.map(k => ui.chip(k[1] + ' (' + count(k[0]) + ')', s.tab === k[0], 'assets.tab', k[0], k[2])).join('') + '</div>';
  }

  App.views.sites = {
    title: 'Websites & templates',
    sub: 'Hosted sites, sample pages, generated drafts and design templates',
    icon: 'fa-folder-closed',
    render(el, params) {
      const s = q();
      const sites = App.store.get('sites', []);
      const templates = App.store.get('templates', []);
      const live = sites.filter(x => x.status === 'live').length;
      const hostingCost = U.sum(sites.filter(x => x.hostRenewDate), x => 0);

      /* #/sites/library — the sidebar "Samples" link lands straight on the library */
      if (params === 'library') { s.tab = 'library'; s.search = ''; }

      if (s.tab === 'library') {
        el.innerHTML = '<div class="mb-3">' + tabChips(s, sites, templates) + '</div>' + sampleLibrary();
        return;
      }

      el.innerHTML =
        '<div class="flex items-center justify-between gap-3 flex-wrap mb-3">' +
        tabChips(s, sites, templates) +
        '<div class="btn-row">' +
        '<input class="inp w-[180px]" data-model="ui.assetsSearch" data-change-action="assets.applyFilters" data-enter="assets.applyFilters" value="' + U.attr(s.search) + '" placeholder="Search sites…" />' +
        '<button class="btn btn-ghost btn-sm" data-action="sites.new"><i class="fa-solid fa-plus"></i> Register a website</button>' +
        '<button class="btn btn-ghost btn-sm" data-action="tpl.new"><i class="fa-solid fa-swatchbook"></i> New template</button>' +
        '<button class="btn btn-lime btn-sm" data-action="sites.generate"><i class="fa-solid fa-wand-magic-sparkles"></i> Generate from a lead</button>' +
        '</div></div>' +

        '<div class="four-col mb-4">' +
        ui.stat({ tag: 'Live', label: 'Websites online', value: live + '', badge: sites.filter(x => x.kind === 'client').length + ' client sites', sub: 'Our own site + client properties' }) +
        ui.stat({ tag: 'Library', label: 'Sample pages', value: sites.filter(x => x.kind === 'sample').length + '', badge: templates.length + ' templates', tone: 'blue', sub: 'Send a sample link in the first message' }) +
        ui.stat({ tag: 'Drafts', label: 'Generated drafts', value: sites.filter(x => x.kind === 'draft').length + '', badge: 'ready to demo', tone: 'amber', sub: 'Built by the generator from Google data' }) +
        ui.stat({ tag: 'Pipeline', label: 'Website deal value', value: U.money(U.sum(sites, x => Number(x.price) || 0)), badge: 'all properties', sub: 'Renewals feed the retainer column' }) +
        '</div>' +

        (function () {
          const items = sites.filter(x => (x.hostRenewDate && U.daysUntil(x.hostRenewDate) <= 60) || (x.domainRenewDate && U.daysUntil(x.domainRenewDate) <= 60))
            .concat(App.store.get('payments', []).filter(p => p.renewalDate && U.daysUntil(p.renewalDate) <= 60 && U.daysUntil(p.renewalDate) > -30)
              .map(p => ({ name: p.projectTitle + ' · ' + (App.store.find('clients', p.clientId) || {}).name, hostRenewDate: p.renewalDate, clientName: 'payment' })));
          if (!items.length) return '';
          return ui.card(ui.head('Renewals to watch', ui.badge('next 60 days', 'amber')) +
            '<div class="space-y-1.5">' + items.map(x =>
            '<div class="flex items-center gap-3 row-card p-2.5" data-action="sites.open" data-arg="' + (x.id || '') + '">' +
            ui.badge(U.daysUntil(x.hostRenewDate) < 0 ? 'expired' : U.daysUntil(x.hostRenewDate) + ' days', U.daysUntil(x.hostRenewDate) <= 14 ? 'red' : 'amber') +
            '<div class="min-w-0 flex-1"><p class="text-[11px] truncate">' + U.esc(x.name) + '</p>' +
            '<p class="text-[9px] text-textMuted">renews ' + U.fmtDate(x.hostRenewDate) + ' · ' + U.esc(x.clientName || '') + '</p></div></div>').join('') + '</div>', 'mb-4');
        })() +

        (s.tab === 'template'
          ? (templates.length ? '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">' + templates.map(templateCard).join('') + '</div>' : ui.empty('No templates yet', 'Add a template to generate websites instantly', 'fa-swatchbook'))
          : (sitesFiltered().length
            ? '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">' +
              (s.tab === 'all' ? sitesFiltered().map(siteCard).join('') : sitesFiltered().map(siteCard).join('')) + '</div>'
            : ui.empty('Nothing here yet', 'Generate a website from any discovered business — it is saved here as a draft.', 'fa-folder-closed',
              '<button class="btn btn-lime btn-sm" data-action="sites.generate">Generate a website</button>'))) +

        (s.tab === 'all' ? ui.card(ui.head('Design templates', '<button class="btn btn-ghost btn-sm" data-action="assets.tab" data-arg="template">See all</button>', 'Pick one and the generator fills it with the business data') +
          '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">' + templates.slice(0, 3).map(templateCard).join('') + '</div>', 'mt-4') : '');

      if (params) openSite(params);
    }
  };

  /* ---------------------------------- site drawer -------------------------- */
  function openSite(id) {
    const x = App.store.find('sites', id);
    if (!x) return;
    const html = App.store.html(id);
    ui.modal({
      title: x.name,
      sub: (x.clientName || 'Triverse Studio') + ' · ' + x.kind + ' · ' + App.dict.typeLabel(x.businessType),
      size: 'xl',
      body:
        '<div class="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">' +
        '<div>' + (html ? ui.previewFrame(html, 520)
          : (x.url ? '<p class="text-[10px] text-textMuted mb-2">No local copy stored — opening the live site instead.</p>' + ui.previewFrame('<div style="font:14px system-ui;padding:24px;color:#333">Live site: <a href="' + x.url + '">' + x.url + '</a></div>', 90)
            : '<div class="glass-soft rounded-xl p-6 text-center text-[11px] text-textMuted">No stored HTML for this record. Register it with a URL, or rebuild it from a lead.</div>')) +
        '<div class="btn-row mt-3">' +
        (html ? '<button class="btn btn-lime btn-sm" data-action="sites.previewOpen" data-arg="' + x.id + '"><i class="fa-solid fa-arrow-up-right-from-square"></i> Open in tab</button>' +
          '<button class="btn btn-ghost btn-sm" data-action="sites.download" data-arg="' + x.id + '"><i class="fa-solid fa-download"></i> Download</button>' : '') +
        (x.kind === 'draft' ? '<button class="btn btn-ghost btn-sm" data-action="sites.rebuild" data-arg="' + x.id + '"><i class="fa-solid fa-rotate"></i> Rebuild from latest data</button>' : '') +
        (x.url ? '<a class="btn btn-ghost btn-sm" href="' + U.attr(x.url) + '" target="_blank" rel="noopener"><i class="fa-solid fa-globe"></i> ' + U.esc(x.url.replace(/^https?:\/\//, '')) + '</a>' : '') +
        '</div></div>' +
        '<div>' +
        ui.card(ui.head('Details') +
          ui.kv('Kind', U.esc(x.kind)) +
          ui.kv('Status', ui.badge(x.status, App.dict.siteTones[x.status] || 'muted')) +
          ui.kv('Client', x.clientId ? ui.link('#/clients/' + x.clientId, x.clientName || 'open client', 'link') : U.esc(x.clientName || '—')) +
          ui.kv('Template', U.esc((App.store.find('templates', x.templateId) || {}).name || '—')) +
          ui.kv('Stack', U.esc(x.stack || '—')) +
          ui.kv('Host', U.esc(x.hostingProvider || '—')) +
          ui.kv('Price', U.money(x.price)) +
          ui.kv('Hosting renewal', x.hostRenewDate ? U.fmtDate(x.hostRenewDate) + ' (' + U.daysUntil(x.hostRenewDate) + 'd)' : '—') +
          ui.kv('Domain renewal', x.domainRenewDate ? U.fmtDate(x.domainRenewDate) + ' (' + U.daysUntil(x.domainRenewDate) + 'd)' : '—') +
          ui.kv('Repo', U.esc(x.repoUrl || '—')) +
          ui.kv('Created', U.fmtDate(x.createdAt)) +
          ui.kv('Updated', U.relTime(x.updatedAt)), 'mb-3') +
        ui.card(ui.head('Notes') + '<p class="text-[10px] text-gray-300 whitespace-pre-line">' + U.esc(x.notes || '—') + '</p>') +
        '</div></div>',
      footer: '<button class="btn btn-ghost btn-sm" data-action="sites.send" data-arg="' + x.id + '"><i class="fa-brands fa-whatsapp"></i> Send link to client</button>' +
        '<button class="btn btn-ghost btn-sm" data-action="sites.edit" data-arg="' + x.id + '">Edit record</button>' +
        '<button class="btn btn-danger btn-sm" data-action="sites.delete" data-arg="' + x.id + '">Delete</button>'
    });
  }
  App.openSite = openSite;

  /* --------------------------------- actions ------------------------------- */
  App.action('assets.tab', el => { q().tab = el.getAttribute('data-arg'); App.emit('state:changed', { path: 'assets' }); });
  App.action('assets.applyFilters', () => {
    q().search = App.store.get('ui.assetsSearch', '');
    App.emit('state:changed', { path: 'assets' });
  });
  App.action('sites.open', el => { const id = el.getAttribute('data-arg'); if (id) openSite(id); });
  App.action('sites.previewOpen', el => U.openHTML(App.store.html(el.getAttribute('data-arg')) || '', 'preview'));
  App.action('sites.download', el => {
    const x = App.store.find('sites', el.getAttribute('data-arg'));
    U.download(U.slug(x.name) + '.html', App.store.html(x.id) || '', 'text/html');
  });
  App.action('sites.rebuild', el => {
    const id = el.getAttribute('data-arg');
    const out = App.sitegen.rebuild(id);
    if (out) { ui.toast('Rebuilt with the latest data', 'lime'); ui.closeModal(); setTimeout(() => openSite(id), 200); }
    else ui.toast('Could not rebuild — no source business found', 'amber');
  });
  App.action('sites.send', el => {
    const x = App.store.find('sites', el.getAttribute('data-arg'));
    const client = x.clientId ? App.store.find('clients', x.clientId) : null;
    const lead = x.generatedFrom && x.generatedFrom.leadId ? App.store.find('leads', x.generatedFrom.leadId) : null;
    const target = client || lead;
    const number = target ? (target.whatsapp || target.phone) : '';
    if (!number) { ui.toast('No WhatsApp number on this record — add a client or lead phone first', 'amber'); return; }
    const link = x.url || App.store.get('settings.company.portfolio', '');
    const body = 'Hello ' + (target.name || 'team') + ',\n\n' + App.store.get('settings.company.senderName', '') + ' here from ' + App.store.get('settings.company.name', '') + '.\n\n' +
      (x.kind === 'sample' ? 'Here is a sample of the style of website we build: ' : 'Here is the website: ') + link + '\n\n' +
      'Tell me what you would like changed: text, photographs, colours, anything. I can also add online ordering or booking if you need it.\n\n' +
      App.store.get('settings.outreach.signature', '').replace(/\{\{sender\}\}/g, App.store.get('settings.company.senderName', '')).replace(/\{\{company\}\}/g, App.store.get('settings.company.name', '')).replace(/\{\{phone\}\}/g, App.store.get('settings.company.phone', '')).replace(/\{\{portfolio\}\}/g, App.store.get('settings.company.portfolio', ''));
    App.msg.send({ lead: { name: target.name, phone: number, intlPhone: number, whatsapp: true }, channel: 'whatsapp', templateId: 'sites.send', body: body })
      .then(() => ui.toast('Message ready in WhatsApp', 'lime'));
  });
  App.action('sites.edit', el => siteForm(el.getAttribute('data-arg')));
  App.action('sites.new', () => siteForm(''));
  App.action('sites.generate', () => {
    const leads = U.sortBy(App.store.get('leads', []).filter(l => !l.siteId), l => Number(l.value) || 0, 'desc');
    ui.modal({
      title: 'Generate a website from a business',
      sub: 'Pick any discovered business — the generator uses its Google info and type',
      size: 'lg',
      body: leads.length ? '<div class="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">' + leads.slice(0, 40).map(l =>
        '<button class="w-full text-left row-card p-2.5 flex items-center gap-3" data-action="sites.genPick" data-arg="' + l.id + '">' +
        ui.avatar(l.name, 'w-8 h-8 text-[10px]') +
        '<div class="min-w-0 flex-1"><p class="text-[11px] font-semibold truncate">' + U.esc(l.name) + '</p>' +
        '<p class="text-[9px] text-textMuted truncate">' + U.esc(l.category) + ' · ' + (l.website ? 'has website' : 'no website') + '</p></div>' +
        ui.badge(U.money(App.msg.recommend(l).total), 'lime') + '</button>').join('') + '</div>'
        : ui.empty('No leads available', 'Discover businesses first, then generate websites for them', 'fa-map-location-dot'),
      footer: '<button class="btn btn-ghost" data-action="close-modal">Close</button><button class="btn btn-ghost" data-action="nav" data-arg="discover">Open Discover</button>'
    });
  });
  App.action('sites.genPick', el => {
    const leadId = el.getAttribute('data-arg');
    const lead = App.store.find('leads', leadId);
    const leadTpl = App.msg.defaultTemplate(lead);
    const out = App.sitegen.build({ lead: lead, templateId: App.store.get('templates')[0].id, options: {} });
    ui.closeModal();
    App.router.q.tmpHtml = out.html; App.router.q.tmpMeta = out.meta; App.router.q.tmpLead = leadId;
    ui.modal({
      title: 'Preview for ' + lead.name,
      sub: 'Save it to keep the file — you can change the template later from Websites & templates',
      size: 'xl',
      body: ui.previewFrame(out.html, 540),
      footer: '<button class="btn btn-ghost" data-action="client.dlSite">Download</button>' +
        '<button class="btn btn-ghost" data-action="close-modal">Close</button>' +
        '<button class="btn btn-lime" data-action="sites.genSave">Save draft &amp; send demo</button>'
    });
  });
  App.action('sites.genSave', () => {
    const lead = App.store.find('leads', App.router.q.tmpLead);
    const res = App.sitegen.save(lead, (App.router.q.tmpMeta || {}).templateId, {});
    ui.closeModal();
    ui.toast('Draft saved', 'lime');
    App.router.go('sites', res.site.id);
    setTimeout(() => App.actions['sites.send']({ getAttribute: () => res.site.id }), 400);
  });

  function siteForm(id) {
    const x = id ? App.store.find('sites', id) : null;
    const clients = App.store.get('clients', []);
    ui.modal({
      title: x ? 'Edit ' + x.name : 'Register a website / sample',
      sub: 'Track hosting, renewals, price and notes for anything you own or manage',
      size: 'lg',
      body: '<div class="grid grid-cols-1 md:grid-cols-2 gap-3">' +
        ui.field({ label: 'Name', model: 'ui.site.name', value: x ? x.name : '' }) +
        ui.field({ label: 'Kind', model: 'ui.site.kind', value: x ? x.kind : 'client', options: App.dict.siteKinds.map(k => [k[0], k[1]]) }) +
        ui.field({ label: 'Status', model: 'ui.site.status', value: x ? x.status : 'live', options: App.dict.siteStatuses.map(s => [s, U.title(s)]) }) +
        ui.field({ label: 'Client', model: 'ui.site.clientId', value: x ? x.clientId : '', options: [['', '— none / our own —']].concat(clients.map(c => [c.id, c.name])) }) +
        ui.field({ label: 'URL', model: 'ui.site.url', value: x ? x.url : '', placeholder: 'https://…' }) +
        ui.field({ label: 'Template', model: 'ui.site.templateId', value: x ? x.templateId : (App.store.get('templates')[0] || {}).id, options: App.store.get('templates', []).map(t => [t.id, t.name]) }) +
        ui.field({ label: 'Business type', model: 'ui.site.businessType', value: x ? x.businessType : 'general', options: App.dict.businessTypes.map(t => [t[0], t[1]]).concat([['general', 'Other']]) }) +
        ui.field({ label: 'Stack', model: 'ui.site.stack', value: x ? x.stack : 'Static HTML' }) +
        ui.field({ label: 'Hosting provider', model: 'ui.site.hostingProvider', value: x ? x.hostingProvider : '' }) +
        ui.field({ label: 'Repo / folder', model: 'ui.site.repoUrl', value: x ? x.repoUrl : '' }) +
        ui.field({ label: 'Price', model: 'ui.site.price', value: x ? x.price : 0, type: 'number' }) +
        ui.field({ label: 'Hosting renewal', model: 'ui.site.hostRenewDate', value: x ? x.hostRenewDate : '', type: 'date' }) +
        ui.field({ label: 'Domain renewal', model: 'ui.site.domainRenewDate', value: x ? x.domainRenewDate : '', type: 'date' }) +
        '</div>' + ui.field({ label: 'Notes', model: 'ui.site.notes', value: x ? x.notes : '', rows: 2, wrapCls: 'mt-3' }),
      footer: '<button class="btn btn-ghost" data-action="close-modal">Cancel</button>' +
        '<button class="btn btn-lime" data-action="sites.saveForm" data-arg="' + (x ? x.id : '') + '"><i class="fa-solid fa-floppy-disk"></i> Save</button>'
    });
  }
  App.action('sites.saveForm', el => {
    const id = el.getAttribute('data-arg');
    const g = k => App.store.get('ui.site.' + k, '');
    const client = App.store.find('clients', g('clientId'));
    const data = {
      name: g('name'), kind: g('kind'), status: g('status'), clientId: g('clientId'),
      clientName: client ? client.name : 'Triverse Studio', url: g('url'), templateId: g('templateId'),
      businessType: g('businessType'), stack: g('stack'), hostingProvider: g('hostingProvider'), repoUrl: g('repoUrl'),
      price: Number(g('price')) || 0, hostRenewDate: g('hostRenewDate'), domainRenewDate: g('domainRenewDate'), notes: g('notes')
    };
    if (!data.name) { ui.toast('Give it a name', 'amber'); return; }
    if (id) App.store.patch('sites', id, data);
    else App.store.add('sites', Object.assign({ generatedFrom: null }, data));
    ui.closeModal(); ui.toast('Saved', 'lime');
    App.emit('state:changed', { path: 'sites' });
  });
  App.action('sites.delete', el => {
    const id = el.getAttribute('data-arg');
    const x = App.store.find('sites', id);
    ui.confirm({
      title: 'Delete this record?', tone: 'danger', confirmLabel: 'Delete',
      message: (x ? x.name : '') + ' and its stored HTML copy will be removed. Client invoices are untouched.',
      onConfirm() { App.store.dropHTML(id); App.store.remove('sites', id); ui.closeModal(); ui.toast('Deleted', 'amber'); }
    });
  });

  /* ------------------------------- templates ------------------------------- */
  function tplForm(id, copyFrom) {
    const base = id ? App.store.find('templates', id) : (copyFrom ? App.store.find('templates', copyFrom) : null);
    const t = base || {
      name: 'New template', style: 'dark', accent: '#cbfa31', accentSoft: 'rgba(203,250,49,.14)', bg: '#0a0b0d', surface: '#15171f',
      border: 'rgba(255,255,255,.07)', text: '#ffffff', muted: '#8b90a1', font: "'Segoe UI', system-ui, sans-serif", radius: '18px', hero: 'split', bestFor: [], notes: ''
    };
    ui.modal({
      title: id ? 'Edit ' + t.name : 'New design template',
      sub: 'Theme values are used by the generator — preview updates live from a sample business',
      size: 'lg',
      body: '<div class="grid grid-cols-1 md:grid-cols-2 gap-3">' +
        ui.field({ label: 'Template name', model: 'ui.tpl.name', value: t.name }) +
        ui.field({ label: 'Mode', model: 'ui.tpl.style', value: t.style, options: [['dark', 'Dark'], ['light', 'Light']] }) +
        ui.field({ label: 'Accent colour', model: 'ui.tpl.accent', value: t.accent, type: 'color' }) +
        ui.field({ label: 'Page background', model: 'ui.tpl.bg', value: t.bg, type: 'color' }) +
        ui.field({ label: 'Card surface', model: 'ui.tpl.surface', value: t.surface, type: 'color' }) +
        ui.field({ label: 'Text colour', model: 'ui.tpl.text', value: t.text, type: 'color' }) +
        ui.field({ label: 'Muted text', model: 'ui.tpl.muted', value: t.muted, type: 'color' }) +
        ui.field({ label: 'Corner radius', model: 'ui.tpl.radius', value: t.radius, placeholder: '18px' }) +
        ui.field({ label: 'Hero layout', model: 'ui.tpl.hero', value: t.hero, options: [['split', 'Split (text + facts)'], ['center', 'Centered'], ['banner', 'Banner']] }) +
        ui.field({ label: 'Font family', model: 'ui.tpl.font', value: t.font }) +
        ui.field({ label: 'Active', model: 'ui.tpl.active', value: t.active !== false, type: 'checkbox', checkLabel: 'Show in the generator' }) +
        '</div>' +
        ui.field({ label: 'Best for (business types, comma separated keys)', model: 'ui.tpl.bestFor', value: (t.bestFor || []).join(', '), wrapCls: 'mt-2' }) +
        ui.field({ label: 'Notes', model: 'ui.tpl.notes', value: t.notes, rows: 2, wrapCls: 'mt-2' }) +
        '<div id="tpl-preview" class="mt-3"></div>',
      footer: '<button class="btn btn-ghost" data-action="close-modal">Cancel</button>' +
        '<button class="btn btn-ghost" data-action="tpl.preview">Refresh preview</button>' +
        '<button class="btn btn-lime" data-action="tpl.save" data-arg="' + (id || '') + '">Save template</button>',
      onMount(root) {
        root.querySelectorAll('input,select').forEach(inp => {
          inp.addEventListener('change', () => App.actions['tpl.preview']());
        });
      }
    });
  }

  App.action('tpl.preview', () => {
    const box = document.getElementById('tpl-preview');
    if (!box) return;
    box.innerHTML = '<p class="text-[10px] text-textMuted mb-2">Live preview (sample business of the first “best for” type)</p><div class="skeleton h-[300px]"></div>';
    const read = k => App.store.get('ui.tpl.' + k, '');
    const bestFor = String(read('bestFor') || 'restaurant').split(',')[0].trim() || 'restaurant';
    const tpl = {
      id: 'preview', name: read('name') || 'Preview', style: read('style') || 'dark',
      accent: read('accent') || '#cbfa31', accentSoft: hexSoft(read('accent') || '#cbfa31'),
      bg: read('bg') || '#0a0b0d', surface: read('surface') || '#15171f', border: 'rgba(255,255,255,.08)',
      text: read('text') || '#ffffff', muted: read('muted') || '#8b90a1', font: read('font') || "'Segoe UI', system-ui, sans-serif",
      radius: read('radius') || '18px', hero: read('hero') || 'split', bestFor: [bestFor], notes: '', active: true, _temp: true
    };
    const templates = App.store.get('templates', []).slice();
    templates.push(tpl);
    App.store.set('templates', templates, { silent: true });
    const sampleLead = App.store.get('leads', []).filter(l => l.businessType === bestFor)[0] ||
      { id: '', name: 'Sample Business', businessType: bestFor, category: App.dict.typeLabel(bestFor), city: App.store.get('settings.google.city', 'Addis Ababa'), address: 'Bole Road, Addis Ababa', phone: '+251911000000', intlPhone: '+251911000000', whatsapp: true, rating: 4.6, reviews: 180, hours: 'Open now', outreach: [] };
    const out = App.sitegen.build({ lead: sampleLead, templateId: 'preview', options: {} });
    templates.pop();
    App.store.set('templates', templates, { silent: true });
    box.innerHTML = ui.previewFrame(out.html, 360);
  });

  function hexSoft(hex) {
    const h = String(hex).replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const r = parseInt(full.slice(0, 2), 16) || 203, g = parseInt(full.slice(2, 4), 16) || 250, b = parseInt(full.slice(4, 6), 16) || 49;
    return 'rgba(' + r + ',' + g + ',' + b + ',.16)';
  }

  App.action('tpl.new', () => { tplForm(''); setTimeout(() => App.actions['tpl.preview'](), 400); });
  App.action('tpl.edit', el => { tplForm(el.getAttribute('data-arg')); setTimeout(() => App.actions['tpl.preview'](), 400); });
  App.action('tpl.use', el => {
    const t = App.store.find('templates', el.getAttribute('data-arg'));
    const lead = U.sortBy(App.store.get('leads', []).filter(l => !l.siteId && (t.bestFor || []).indexOf(l.businessType) !== -1), l => Number(l.value) || 0, 'desc')[0] ||
      U.sortBy(App.store.get('leads', []), l => Number(l.value) || 0, 'desc')[0];
    if (!lead) { ui.toast('No business in the list yet — discover some first', 'amber'); return; }
    const out = App.sitegen.build({ lead: lead, templateId: t.id, options: {} });
    App.router.q.tmpHtml = out.html; App.router.q.tmpMeta = out.meta; App.router.q.tmpLead = lead.id;
    ui.modal({
      title: t.name + ' applied to ' + lead.name,
      size: 'xl',
      body: ui.previewFrame(out.html, 520),
      footer: '<button class="btn btn-ghost" data-action="client.dlSite">Download</button>' +
        '<button class="btn btn-ghost" data-action="close-modal">Close</button>' +
        '<button class="btn btn-lime" data-action="sites.genSave">Save draft</button>'
    });
  });
  App.action('tpl.save', el => {
    const id = el.getAttribute('data-arg');
    const g = k => App.store.get('ui.tpl.' + k, '');
    const accent = g('accent') || '#cbfa31';
    const data = {
      name: g('name') || 'Untitled template', style: g('style') || 'dark', accent: accent, accentSoft: hexSoft(accent),
      bg: g('bg'), surface: g('surface'), border: 'rgba(255,255,255,.08)', text: g('text'), muted: g('muted'),
      font: g('font'), radius: g('radius'), hero: g('hero'), active: Boolean(App.store.get('ui.tpl.active', true)),
      notes: g('notes'), bestFor: String(g('bestFor') || '').split(',').map(x => x.trim()).filter(Boolean)
    };
    if (id) App.store.patch('templates', id, data);
    else App.store.add('templates', data);
    ui.closeModal();
    ui.toast('Template saved', 'lime');
    App.emit('state:changed', { path: 'templates' });
  });

  /* ========================= sample library: upload and manage ============= */
  App.action('samples.new', () => {
    const cats = Object.keys(CATEGORY_LABELS).map(k => [k, categoryLabel(k)]);
    App.router.q.samplesUp = { text: '', name: '', category: 'shop', tags: '', note: '' };
    ui.modal({
      title: 'Upload a sample website',
      sub: 'A finished HTML page. The system reads it, reports what it found, and makes it ready to clone for a business in that category.',
      size: 'lg',
      body:
        '<div class="rounded-2xl border-2 border-dashed border-borderMain p-6 text-center" id="sample-drop">' +
        '<i class="fa-solid fa-file-code text-2xl text-textMuted"></i>' +
        '<p class="text-[12px] mt-2">Drop the .html file here</p>' +
        '<p class="text-[10px] text-textMuted">or</p>' +
        '<input type="file" id="sample-file" accept=".html,.htm,text/html" class="hidden" />' +
        '<button class="btn btn-ghost btn-sm mt-2" data-action="samples.pick"><i class="fa-solid fa-folder-open"></i> Choose a file</button>' +
        '<p class="text-[10px] text-textMuted mt-2" id="sample-file-name">no file chosen yet</p>' +
        '</div>' +
        '<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">' +
        ui.field({ label: 'Sample name', model: 'ui.samplesUp.name', value: '', placeholder: 'Restaurant — warm photo layout' }) +
        ui.field({ label: 'Category', model: 'ui.samplesUp.category', value: 'shop', options: cats }) +
        ui.field({ label: 'Extra match words', model: 'ui.samplesUp.tags', value: '', placeholder: 'cafe, coffee, bakery' }) +
        '</div>' +
        ui.field({ label: 'Note', model: 'ui.samplesUp.note', value: '', rows: 2, wrapCls: 'mt-3', placeholder: 'Approved by the client on 12 March, reusable for cafes.' }) +
        '<div id="sample-analysis" class="mt-3"></div>',
      footer: '<button class="btn btn-ghost" data-action="close-modal">Cancel</button>' +
        '<button class="btn btn-ghost" data-action="samples.analyse"><i class="fa-solid fa-magnifying-glass-chart"></i> Analyse first</button>' +
        '<button class="btn btn-lime" data-action="samples.save"><i class="fa-solid fa-floppy-disk"></i> Read &amp; save as a sample</button>',
      onMount(root) {
        const input = root.querySelector('#sample-file');
        const zone = root.querySelector('#sample-drop');
        const label = root.querySelector('#sample-file-name');
        const take = files => {
          const f = files && files[0];
          if (!f) return;
          label.textContent = f.name + ' · ' + U.bytes(f.size);
          App.router.q.samplesUp.file = f;
          if (/^text\/html|html/i.test(f.type) || /\.html?$/i.test(f.name)) {
            if (f.text) {
              f.text().then(t => {
                App.router.q.samplesUp.text = t;
                App.router.q.samplesUp.name = App.router.q.samplesUp.name || String(f.name).replace(/\.html?$/i, '');
                const box = document.getElementById('sample-analysis');
                if (box) box.innerHTML = '<p class="text-[10px] text-accentMint">' + ui.icon('fa-circle-check') + ' File read (' + U.bytes(t.length) + '). Press Analyse to see what can be filled.</p>';
              });
            } else {
              const fr = new FileReader();
              fr.onload = () => { App.router.q.samplesUp.text = String(fr.result); };
              fr.readAsText(f);
            }
          }
        };
        root.querySelector('[data-action="samples.pick"]').addEventListener('click', () => input.click());
        input.addEventListener('change', () => take(input.files));
        zone.addEventListener('dragover', ev => { ev.preventDefault(); zone.style.borderColor = '#cbfa31'; });
        zone.addEventListener('dragleave', () => { zone.style.borderColor = ''; });
        zone.addEventListener('drop', ev => { ev.preventDefault(); zone.style.borderColor = ''; if (ev.dataTransfer) take(ev.dataTransfer.files); });
      }
    });
  });

  function sampleText() {
    const up = App.router.q.samplesUp || {};
    return String(up.text || '');
  }

  App.action('samples.analyse', () => {
    const box = document.getElementById('sample-analysis');
    const html = sampleText();
    if (!html) { if (box) box.innerHTML = '<p class="text-[11px] text-amber-300">Choose an HTML file first.</p>'; return; }
    const a = App.samples.analyse(html);
    App.router.q.samplesLast = a;
    if (box) box.innerHTML = analysisBox(a) +
      '<p class="text-[10px] text-textMuted">Everything found above will be replaced with each new business\u2019s own Google Maps information when this sample is used. Keep the file to watch its design; the text is rewritten per business.</p>';
  });

  App.action('samples.save', () => {
    const up = App.router.q.samplesUp || {};
    if (!up.text) { ui.toast('Choose an HTML file first', 'amber'); return; }
    const res = App.samples.save({
      name: up.name || '', category: up.category || 'shop', tags: up.tags || '', note: up.note || '', html: up.text
    });
    if (res.error) { ui.toast(res.error, 'red'); return; }
    App.router.q.samplesLast = res.analysis;
    // the raw file also goes into the vault, so it is backed up with its record
    if (up.file && App.files && App.files.add) {
      App.files.add(up.file, { category: 'Sample website', description: 'Sample site: ' + res.sample.name }).catch(() => {});
    }
    App.router.q.samplesUp = { text: '', name: '', category: 'shop', tags: '', note: '' };
    App.router.q.assets.tab = 'library';
    ui.closeModal();
    ui.toast('Sample saved — ' + res.analysis.quality + '% ready to clone', 'lime');
    App.emit('state:changed', { path: 'samples' });
  });

  App.action('samples.open', el => {
    const s = App.samples.find(el.getAttribute('data-arg'));
    if (!s) return;
    const lead = demoLeadFor(s);
    const out = App.samples.fill(s, lead, {});
    U.openHTML(out.html, 'sample');
  });

  /*
   * Take one of the studio's own imported designs and fork it into the editable
   * library — so a design from the sample folder can be tuned for one client
   * without touching the original.
   */
  App.action('samples.clone', el => {
    const s = App.samples.find(el.getAttribute('data-arg'));
    if (!s) return;
    const name = (s.name || 'Sample') + ' copy';
    const res = App.samples.save({
      name: name, category: s.category || 'shop',
      tags: (s.tags || []).join(', '),
      note: 'Forked from ' + (s.source || s.id) + ' on ' + U.todayISO(),
      html: s.html
    });
    if (res.error) { ui.toast(res.error, 'red'); return; }
    App.router.q.assets.tab = 'library';
    ui.toast('“' + name + '” added to the library — edit it freely', 'lime');
    App.emit('state:changed', { path: 'samples' });
  });

  App.action('samples.del', el => {
    const id = el.getAttribute('data-arg');
    const s = App.samples.find(id);
    if (!s) return;
    ui.confirm('Delete the sample “' + s.name + '”?', () => {
      App.samples.remove(id);
      ui.toast('Sample deleted', 'amber');
      App.emit('state:changed', { path: 'samples' });
    }, 'Delete');
  });

  App.action('samples.edit', el => {
    const s = App.samples.find(el.getAttribute('data-arg'));
    if (!s) return;
    const cats = Object.keys(CATEGORY_LABELS).map(k => [k, categoryLabel(k)]);
    App.router.q.sampleEdit = s.id;
    App.store.set('ui.sampleEdit', { name: s.name, category: s.category, tags: (s.tags || []).join(', '), note: s.blurb }, { silent: true });
    ui.modal({
      title: 'Edit “' + s.name + '”',
      size: 'md',
      body: '<div class="grid grid-cols-1 md:grid-cols-2 gap-3">' +
        ui.field({ label: 'Name', model: 'ui.sampleEdit.name', value: s.name }) +
        ui.field({ label: 'Category', model: 'ui.sampleEdit.category', value: s.category, options: cats }) +
        '</div>' +
        ui.field({ label: 'Match words', model: 'ui.sampleEdit.tags', value: (s.tags || []).join(', '), hint: 'Comma separated. A business type containing any of these words will pick this sample.', wrapCls: 'mt-3' }) +
        ui.field({ label: 'Note', model: 'ui.sampleEdit.note', value: s.blurb, rows: 2, wrapCls: 'mt-3' }),
      footer: '<button class="btn btn-ghost" data-action="close-modal">Cancel</button>' +
        '<button class="btn btn-lime" data-action="samples.editSave">Save</button>'
    });
  });

  App.action('samples.editSave', () => {
    const id = App.router.q.sampleEdit;
    const items = (App.store.get('samples.items', []) || []).slice();
    const s = items.filter(x => x.id === id)[0];
    if (!s) return;
    s.name = App.store.get('ui.sampleEdit.name', s.name);
    s.category = App.store.get('ui.sampleEdit.category', s.category);
    s.tags = String(App.store.get('ui.sampleEdit.tags', '')).split(',').map(x => x.trim()).filter(Boolean);
    s.blurb = App.store.get('ui.sampleEdit.note', s.blurb);
    App.store.set('samples.items', items);
    App.store.save();
    ui.closeModal();
    ui.toast('Sample updated', 'lime');
    App.emit('state:changed', { path: 'samples' });
  });

  /** a throwaway business record so a sample can be previewed with real detail */
  function demoLeadFor(s) {
    const t = App.dict.businessTypes.filter(x => (App.samples.typeCategory[x[0]] || 'other') === s.category)[0] ||
      App.dict.businessTypes[0];
    return {
      id: 'demo', name: 'Sample ' + categoryLabel(s.category), businessType: (t || [])[0] || 'general',
      category: (t || [])[1] || '', areaLabel: 'Bole, Addis Ababa', address: 'Bole Road, Addis Ababa',
      phone: '+251 90 246 8625', rating: 4.8, reviews: 126, photos: [],
      hoursWeek: [], source: 'demo'
    };
  }

  App.action('samples.match', () => {
    const rows = App.dict.businessTypes.map(t => {
      const s = App.samples.forBusiness({ businessType: t[0], name: '', category: t[1] });
      return [t[1], s ? s.name : '(none)'];
    });
    ui.modal({
      title: 'Which sample each business type gets',
      sub: 'Nothing to configure — the category decides. Upload more samples to change the mix.',
      size: 'md',
      body: '<div class="max-h-[420px] overflow-auto">' + rows.map(r =>
        '<div class="flex items-center justify-between gap-3 py-1.5 border-b border-borderMain">' +
        '<span class="text-[11px]">' + U.esc(r[0]) + '</span><span class="text-[10px] text-textMuted">' + U.esc(r[1]) + '</span></div>').join('') + '</div>',
      footer: '<button class="btn btn-ghost" data-action="close-modal">Close</button>'
    });
  });
})(window);
