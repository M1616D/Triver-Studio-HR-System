/* =============================================================================
   Triverse OS — File vault
   One place for every file the studio owns, with the information a real archive
   needs: what it is, which project and client it belongs to, its version,
   who made it, how big it is and a checksum that proves a download is intact.
   Upload anything — html, css, js, php, images, source archives, fonts — and
   download it again from any device the workspace is opened on.
   ========================================================================== */
(function (global) {
  'use strict';

  const App = global.App;
  const U = App.util;
  const ui = App.ui;

  function q() {
    App.router.q.files = App.router.q.files || { category: 'all', search: '', project: '' };
    return App.router.q.files;
  }

  function iconFor(doc) {
    if (doc.kind === 'Image' || doc.kind === 'Vector') return 'fa-image';
    if (doc.kind === 'Markup') return 'fa-code';
    if (doc.kind === 'Stylesheet') return 'fa-brush';
    if (doc.kind === 'JavaScript' || doc.kind === 'TypeScript' || doc.kind === 'React') return 'fa-file-code';
    if (doc.kind === 'PDF') return 'fa-file-pdf';
    if (doc.kind === 'Archive') return 'fa-file-zipper';
    if (doc.kind === 'Spreadsheet') return 'fa-file-excel';
    if (doc.kind === 'Document') return 'fa-file-word';
    if (doc.kind === 'Video' || doc.kind === 'Audio') return 'fa-photo-film';
    if (doc.kind === 'Font') return 'fa-font';
    return 'fa-file';
  }

  function sizeLabel(doc) { return U.bytes(doc.size); }

  function projectLabel(doc) {
    if (doc.projectId) {
      const site = App.store.find('sites', doc.projectId);
      if (site) return site.name;
    }
    if (doc.projectName) return doc.projectName;
    const client = doc.clientId ? App.store.find('clients', doc.clientId) : null;
    return client ? client.name : '';
  }

  /* --------------------------------- upload -------------------------------- */
  function uploadModal() {
    ui.modal({
      title: 'Add files to the vault',
      sub: 'Any file, any language. The description you add here is what makes it findable in a year.',
      size: 'lg',
      body:
        '<div id="drop-zone" class="drop-zone">' +
        ui.icon('fa-cloud-arrow-up', 'text-xl') +
        '<p class="text-[12px] font-semibold mt-2">Drop files here, or choose them</p>' +
        '<p class="text-[10px] text-textMuted mt-1">HTML, CSS, JS, PHP, Python, images, fonts, archives, PDFs — no limit per file beyond the browser’s storage</p>' +
        '<input id="file-input" type="file" multiple class="hidden" />' +
        '<button class="btn btn-lime btn-sm mt-3" data-action="files.pick">Choose files</button>' +
        '<ul id="drop-list" class="text-left text-[10px] text-textMuted mt-3 space-y-1"></ul>' +
        '</div>' +
        '<div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">' +
        ui.field({ label: 'Category', model: 'ui.upload.category', value: 'website', options: App.files.categories().map(c => [c[0], c[1]]) }) +
        ui.field({ label: 'Belongs to project / website', model: 'ui.upload.projectId', value: '', options: [['', '— not linked —']].concat(App.store.get('sites', []).map(s => [s.id, s.name])) }) +
        ui.field({ label: 'Client', model: 'ui.upload.clientId', value: '', options: [['', '— not linked —']].concat(App.store.get('clients', []).map(c => [c.id, c.name])) }) +
        ui.field({ label: 'Version', model: 'ui.upload.version', value: '1.0' }) +
        ui.field({ label: 'Language / stack', model: 'ui.upload.language', value: '', placeholder: 'e.g. HTML, PHP 8, React' }) +
        ui.field({ label: 'Tags (comma separated)', model: 'ui.upload.tags', value: '', placeholder: 'homepage, v2, approved' }) +
        '</div>' +
        ui.field({ label: 'What is this file?', model: 'ui.upload.description', value: '', rows: 2, wrapCls: 'mt-3', placeholder: 'Final homepage markup delivered to the client, approved on 12 March.' }) +
        '<div id="upload-progress" class="text-[10px] text-textMuted mt-3"></div>',
      footer: '<button class="btn btn-ghost" data-action="close-modal">Cancel</button>' +
        '<button class="btn btn-lime" id="upload-go" data-action="files.uploadGo"><i class="fa-solid fa-arrow-up-from-bracket"></i> Store in the vault</button>',
      onMount(root) {
        const input = root.querySelector('#file-input');
        const zone = root.querySelector('#drop-zone');
        const list = root.querySelector('#drop-list');
        ui._uploadFiles = [];
        const render = () => {
          list.innerHTML = (ui._uploadFiles || []).map(f =>
            '<li class="flex items-center gap-2"><i class="fa-solid ' + iconFor({ kind: U.fileKind(f.name, f.type) }) + '"></i>' +
            '<span class="truncate">' + U.esc(f.name) + '</span><span class="ml-auto num">' + U.bytes(f.size) + '</span></li>').join('');
        };
        const take = files => {
          ui._uploadFiles = (ui._uploadFiles || []).concat(Array.prototype.slice.call(files));
          render();
        };
        root.querySelector('[data-action="files.pick"]').addEventListener('click', () => input.click());
        input.addEventListener('change', () => take(input.files));
        zone.addEventListener('dragover', ev => { ev.preventDefault(); zone.classList.add('is-over'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
        zone.addEventListener('drop', ev => {
          ev.preventDefault();
          zone.classList.remove('is-over');
          if (ev.dataTransfer && ev.dataTransfer.files) take(ev.dataTransfer.files);
        });
      }
    });
  }

  /* --------------------------------- screen -------------------------------- */
  App.views = App.views || {};
  App.views.files = {
    title: 'File vault',
    sub: 'Every website build, design source and document we own — with its full record',
    icon: 'fa-box-archive',
    render(el, params) {
      const s = q();
      const stats = App.files.stats();
      const rows = U.sortBy(App.files.search(s.search, { category: s.category, projectId: s.project }), d => d.uploadedAt || '', 'desc');
      const backend = App.files.backend();

      el.innerHTML =
        '<div class="flex items-center justify-between gap-3 flex-wrap mb-3">' +
        '<div class="flex flex-wrap gap-1.5">' +
        [['all', 'All files']].concat(App.files.categories()).map(c =>
          ui.chip(c[1] + (c[0] === 'all' ? ' (' + stats.count + ')' : stats.byCategory[c[0]] ? ' (' + stats.byCategory[c[0]] + ')' : ''),
            s.category === c[0], 'files.category', c[0], c[0] === 'all' ? 'fa-layer-group' : c[2])).join('') +
        '</div>' +
        '<div class="btn-row">' +
        '<input class="inp w-[190px]" data-model="ui.filesSearch" data-change-action="files.applyFilters" data-enter="files.applyFilters" value="' + U.attr(s.search) + '" placeholder="Search name, tag, content…" />' +
        '<button class="btn btn-lime btn-sm" data-action="files.upload"><i class="fa-solid fa-arrow-up-from-bracket"></i> Add files</button>' +
        '</div></div>' +

        '<div class="four-col mb-4">' +
        ui.stat({ tag: 'Vault', label: 'Files stored', value: String(stats.count), badge: U.bytes(stats.bytes), sub: backend === 'indexedDB' ? 'On this device, in the browser database' : 'Device storage is limited — connect Drive' }) +
        ui.stat({ tag: 'Linked', label: 'Files linked to projects', value: String(stats.links), tone: 'blue', badge: stats.count ? U.pct(stats.links, stats.count) + '%' : '0%', sub: 'The rest are general studio files' }) +
        ui.stat({ tag: 'Latest', label: 'Most recent upload', value: stats.newest ? U.relTime(stats.newest.uploadedAt) : '—', tone: 'amber', badge: stats.newest ? U.bytes(stats.newest.size) : '', sub: stats.newest ? stats.newest.name : 'Nothing stored yet' }) +
        ui.stat({ tag: 'Cloud', label: 'Copies in Drive', value: String(App.files.all().filter(d => d.cloud && d.cloud.driveId).length), tone: 'violet', badge: App.cloud.isConnected() ? 'Drive connected' : 'Drive not connected', sub: App.cloud.status().http ? 'Backs the vault up off this device' : 'Needs the app opened over http://localhost' }) +
        '</div>' +

        (App.files.all().some(d => d.missing)
          ? '<div class="glass-soft rounded-xl p-3 mb-3 text-[11px] flex items-start gap-2.5 tone tone-amber border">' +
            ui.icon('fa-triangle-exclamation', 'mt-0.5') +
            '<div class="flex-1"><p class="font-semibold">Some records have no stored copy on this device</p>' +
            '<p class="text-textMuted">They are listed with an amber mark. Restore a backup, re-upload the file, or pull it back from Google Drive.</p></div>' +
            '<button class="btn btn-ghost btn-sm" data-action="files.audit">Re-check</button></div>'
          : '') +

        (rows.length
          ? '<div class="glass-card rounded-2xl overflow-hidden">' +
            ui.table(
              ['File', 'Type', 'Category', 'Project / client', 'Size', 'Version', 'Added', ''],
              rows.map(d => ({
                cells: [
                  '<div class="flex items-center gap-3 min-w-0">' +
                    '<span class="file-glyph"><i class="fa-solid ' + iconFor(d) + '"></i></span>' +
                    '<span class="min-w-0"><span class="block text-[11px] font-semibold truncate">' + U.esc(d.name) + (d.missing ? ' <i class="fa-solid fa-triangle-exclamation text-amber-300 text-[9px]"></i>' : '') + '</span>' +
                    '<span class="block text-[9px] text-textMuted truncate">' + U.esc(d.description || 'no description') + '</span></span></div>',
                  '<span class="tag">' + U.esc(d.kind) + '</span>',
                  U.esc(App.files.categoryLabel(d.category)),
                  U.esc(projectLabel(d) || '—'),
                  '<span class="num">' + sizeLabel(d) + '</span>',
                  'v' + U.esc(d.version || '1.0'),
                  U.relTime(d.uploadedAt),
                  '<div class="btn-row justify-end">' +
                    '<button class="btn btn-ghost btn-sm" data-action="files.detail" data-arg="' + d.id + '" title="Full record"><i class="fa-solid fa-circle-info"></i></button>' +
                    '<button class="btn btn-ghost btn-sm" data-action="files.download" data-arg="' + d.id + '" title="Download"><i class="fa-solid fa-download"></i></button>' +
                    (d.previewable ? '<button class="btn btn-lime btn-sm" data-action="files.open" data-arg="' + d.id + '" title="Open"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>' : '') +
                  '</div>'
                ],
                attrs: ' data-action="files.detail" data-arg="' + d.id + '"'
              })),
              { empty: 'No files yet', emptySub: '', emptyIcon: 'fa-box-archive' }
            ) + '</div>'
          : ui.empty(stats.count ? 'Nothing matches that filter' : 'The vault is empty',
            stats.count ? 'Clear the search or pick another category.' : 'Add the files you already own — website builds, logos, contracts, invoices. Each one keeps its full record here.',
            'fa-box-archive',
            '<button class="btn btn-lime btn-sm" data-action="files.upload"><i class="fa-solid fa-arrow-up-from-bracket"></i> Add your first files</button>'));

      if (params) openDetail(params);
    }
  };

  /* ------------------------------- detail view ----------------------------- */
  async function openDetail(id) {
    const d = App.store.find('documents', id);
    if (!d) return;
    const hasLocal = await App.files.has(d.id);
    const inDrive = Boolean(d.cloud && d.cloud.driveId);
    const project = d.projectId ? App.store.find('sites', d.projectId) : null;
    const client = d.clientId ? App.store.find('clients', d.clientId) : (project && project.clientId ? App.store.find('clients', project.clientId) : null);
    const isImage = /^image\//.test(d.mime || '') || /\.(png|jpe?g|gif|webp|svg|ico)$/i.test(d.name);
    const isText = /\.(html?|css|js|mjs|json|txt|md|csv|sql|php|py|ts|tsx|jsx|yml|yaml)$/i.test(d.name) || /^text\//.test(d.mime || '');
    const isPdf = d.kind === 'PDF';

    let preview = '';
    if (hasLocal && isImage) {
      const url = await App.files.blobUrl(d);
      preview = '<img src="' + U.attr(url) + '" alt="" class="w-full max-h-[320px] object-contain rounded-xl bg-black/20" />';
    } else if (isText && d.preview) {
      preview = '<pre class="code-preview">' + U.esc(String(d.preview).slice(0, 4000)) + (String(d.preview).length >= 4000 ? '\n…' : '') + '</pre>';
    } else if (isPdf && hasLocal) {
      const url = await App.files.blobUrl(d);
      preview = '<iframe src="' + U.attr(url) + '" class="w-full rounded-xl border border-line" style="height:340px"></iframe>';
    } else {
      preview = '<div class="glass-soft rounded-xl p-6 text-center text-[11px] text-textMuted">' +
        (hasLocal ? 'No preview for this file type — open or download it to inspect it.' : 'The stored copy is not on this device.') + '</div>';
    }

    ui.drawer({
      title: d.name,
      sub: App.files.categoryLabel(d.category) + ' · ' + d.kind + ' · v' + (d.version || '1.0'),
      body:
        '<div class="space-y-3">' +
        '<div class="flex flex-wrap gap-2">' +
        (hasLocal ? '<button class="btn btn-lime btn-sm" data-action="files.download" data-arg="' + d.id + '"><i class="fa-solid fa-download"></i> Download</button>' +
          '<button class="btn btn-ghost btn-sm" data-action="files.open" data-arg="' + d.id + '"><i class="fa-solid fa-arrow-up-right-from-square"></i> Open</button>' : '') +
        '<button class="btn btn-ghost btn-sm" data-action="files.replace" data-arg="' + d.id + '"><i class="fa-solid fa-arrows-rotate"></i> Upload a new version</button>' +
        '<button class="btn btn-ghost btn-sm" data-action="files.drive" data-arg="' + d.id + '" title="Keep a copy in Google Drive"><i class="fa-brands fa-google-drive"></i> ' + (inDrive ? 'Update Drive copy' : 'Copy to Drive') + '</button>' +
        (!hasLocal && inDrive ? '<button class="btn btn-ghost btn-sm" data-action="files.pull" data-arg="' + d.id + '"><i class="fa-solid fa-cloud-arrow-down"></i> Pull from Drive</button>' : '') +
        '<button class="btn btn-ghost btn-sm" data-action="files.edit" data-arg="' + d.id + '"><i class="fa-solid fa-pen"></i> Edit details</button>' +
        '<button class="btn btn-danger btn-sm" data-action="files.delete" data-arg="' + d.id + '"><i class="fa-solid fa-trash"></i> Delete</button>' +
        '</div>' +

        preview +

        ui.card(ui.head('File') +
          ui.kv('Name', U.esc(d.name)) +
          ui.kv('Type', U.esc(d.kind) + (d.mime ? ' <span class="text-textMuted">(' + U.esc(d.mime) + ')</span>' : '')) +
          ui.kv('Extension', '.' + U.esc(d.ext || '—')) +
          ui.kv('Size', '<span class="num">' + U.bytes(d.size) + '</span> (' + U.num(d.size) + ' bytes)') +
          ui.kv('Version', 'v' + U.esc(d.version || '1.0')) +
          ui.kv('Language / stack', U.esc(d.language || '—')) +
          ui.kv('SHA-256', '<span class="mono text-[9px] break-all">' + U.esc(d.checksum || 'not computed') + '</span>'), 'mb-3') +

        ui.card(ui.head('Ownership') +
          ui.kv('Category', U.esc(App.files.categoryLabel(d.category))) +
          ui.kv('Project', project ? ui.link('#/sites/' + project.id, project.name, 'link') : U.esc(d.projectName || '—')) +
          ui.kv('Client', client ? ui.link('#/clients/' + client.id, client.name, 'link') : '—') +
          ui.kv('Author', U.esc(d.author || '—')) +
          ui.kv('Tags', (d.tags && d.tags.length) ? d.tags.map(t => '<span class="tag">' + U.esc(t) + '</span>').join(' ') : '—'), 'mb-3') +

        ui.card(ui.head('History') +
          ui.kv('Added', U.fmtDateTime(d.uploadedAt)) +
          ui.kv('Last changed', U.fmtDateTime(d.updatedAt)) +
          ui.kv('Times opened', U.num(d.opened || 0)) +
          ui.kv('Times downloaded', U.num(d.downloads || 0)) +
          ((d.history && d.history.length) ? ui.kv('Previous versions', d.history.map(h => '<span class="tag">' + U.esc(h.version || '—') + ' · ' + U.bytes(h.size) + '</span>').join(' ')) : ''), 'mb-3') +

        ui.card(ui.head('Storage') +
          ui.kv('This device', hasLocal ? '<span class="text-limeAccent">stored</span> (' + U.esc(d.backend || App.files.backend()) + ')' : '<span class="text-amber-300">not on this device</span>') +
          ui.kv('Google Drive', inDrive ? '<span class="text-limeAccent">copied</span> · ' + U.fmtDateTime(d.cloud.syncedAt) + (d.cloud.link ? ' · ' + ui.link(d.cloud.link, 'open in Drive', 'link') : '') : 'not copied yet'), 'mb-3') +

        (d.description || d.notes
          ? ui.card(ui.head('Description') +
            (d.description ? '<p class="text-[11px] text-gray-300 whitespace-pre-line">' + U.esc(d.description) + '</p>' : '') +
            (d.notes ? '<p class="text-[10px] text-textMuted whitespace-pre-line mt-2">' + U.esc(d.notes) + '</p>' : ''))
          : '') +
        '</div>'
    });
  }
  App.openDocument = openDetail;

  /* --------------------------------- actions ------------------------------- */
  App.action('files.category', el => { q().category = el.getAttribute('data-arg'); App.emit('state:changed', { path: 'files' }); });
  App.action('files.applyFilters', () => { q().search = App.store.get('ui.filesSearch', ''); App.emit('state:changed', { path: 'files' }); });
  App.action('files.upload', uploadModal);
  App.action('files.pick', () => { const i = document.getElementById('file-input'); if (i) i.click(); });
  App.action('files.uploadGo', async () => {
    const list = ui._uploadFiles || [];
    if (!list.length) { ui.toast('Choose at least one file first', 'amber'); return; }
    const g = k => App.store.get('ui.upload.' + k, '');
    const project = App.store.find('sites', g('projectId'));
    const client = App.store.find('clients', g('clientId')) || (project && project.clientId ? App.store.find('clients', project.clientId) : null);
    const meta = {
      category: g('category') || 'other',
      projectId: g('projectId') || '',
      projectName: project ? project.name : '',
      clientId: client ? client.id : '',
      version: g('version') || '1.0',
      language: g('language') || '',
      description: g('description') || '',
      tags: String(g('tags') || '').split(',').map(x => x.trim()).filter(Boolean)
    };
    const bar = document.getElementById('upload-progress');
    const btn = document.getElementById('upload-go');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Storing…'; }
    const out = { added: [], failed: [] };
    for (let i = 0; i < list.length; i++) {
      if (bar) bar.textContent = 'Storing ' + (i + 1) + ' of ' + list.length + ' — ' + list[i].name;
      try { out.added.push(await App.files.add(list[i], meta)); }
      catch (e) { out.failed.push({ name: list[i].name, error: e.message }); }
    }
    ui._uploadFiles = [];
    ui.closeModal();
    ui.toast(out.added.length + ' file' + (out.added.length === 1 ? '' : 's') + ' stored' + (out.failed.length ? ' · ' + out.failed.length + ' failed' : ''), out.failed.length ? 'amber' : 'lime');
    if (out.failed.length) {
      ui.modal({
        title: 'Some files were not stored',
        size: 'sm',
        body: '<div class="space-y-1.5">' + out.failed.map(f =>
          '<div class="glass-soft rounded-lg p-2"><p class="text-[11px]">' + U.esc(f.name) + '</p>' +
          '<p class="text-[10px] text-red-300">' + U.esc(f.error) + '</p></div>').join('') + '</div>',
        footer: '<button class="btn btn-ghost" data-action="close-modal">Close</button>'
      });
    }
    App.emit('state:changed', { path: 'documents' });
  });

  App.action('files.detail', el => { const id = el.getAttribute('data-arg'); if (id) openDetail(id); });
  App.action('files.open', el => App.files.open(el.getAttribute('data-arg')));
  App.action('files.download', el => App.files.download(el.getAttribute('data-arg')));
  App.action('files.delete', el => {
    const id = el.getAttribute('data-arg');
    const d = App.store.find('documents', id);
    ui.confirm({
      title: 'Delete this file?', tone: 'danger', confirmLabel: 'Delete for good',
      message: '“' + (d ? d.name : '') + '” and its stored copy will be removed from this device. A copy already in Google Drive is not touched — delete it there too if you want it gone completely.',
      onConfirm: async () => {
        await App.files.remove(id);
        App.store.remove('documents', id);
        App.log('file', 'Deleted “' + (d ? d.name : '') + '” from the vault', '');
        ui.closeModal(); ui.closeDrawer(); ui.toast('File deleted', 'amber');
        App.refresh();
      }
    });
  });
  App.action('files.replace', el => {
    const id = el.getAttribute('data-arg');
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async () => {
      if (!input.files || !input.files[0]) return;
      try {
        await App.files.replace(id, input.files[0]);
        ui.toast('New version stored', 'lime');
        ui.closeDrawer();
        setTimeout(() => openDetail(id), 200);
      } catch (e) { ui.toast(e.message, 'red'); }
    };
    input.click();
  });
  App.action('files.drive', async el => {
    const id = el.getAttribute('data-arg');
    ui.toast('Copying to Google Drive…', 'blue');
    try {
      await App.cloud.uploadFile(id);
      ui.toast('Copied to the “Triverse OS” folder in Drive', 'lime');
      ui.closeDrawer();
      setTimeout(() => openDetail(id), 200);
    } catch (e) { ui.toast(String(e.message).split('\n')[0], 'red'); }
  });
  App.action('files.pull', async el => {
    const id = el.getAttribute('data-arg');
    try {
      await App.cloud.fetchFile(id);
      ui.toast('Pulled back from Google Drive', 'lime');
      ui.closeDrawer();
      setTimeout(() => openDetail(id), 200);
    } catch (e) { ui.toast(String(e.message).split('\n')[0], 'red'); }
  });
  App.action('files.audit', async () => {
    ui.toast('Checking the vault…', 'blue');
    const out = await App.files.audit();
    ui.toast(out.missing ? out.missing + ' of ' + out.total + ' files are not on this device' : 'All ' + out.total + ' files are stored here', out.missing ? 'amber' : 'lime');
    App.refresh();
  });

  App.action('files.edit', el => {
    const d = App.store.find('documents', el.getAttribute('data-arg'));
    if (!d) return;
    ui.closeDrawer();
    ui.modal({
      title: 'Edit the file record',
      sub: 'The description is the part that makes an archive usable years later',
      size: 'lg',
      body: '<div class="grid grid-cols-1 md:grid-cols-2 gap-3">' +
        ui.field({ label: 'File name', model: 'ui.doc.name', value: d.name }) +
        ui.field({ label: 'Category', model: 'ui.doc.category', value: d.category, options: App.files.categories().map(c => [c[0], c[1]]) }) +
        ui.field({ label: 'Version', model: 'ui.doc.version', value: d.version || '1.0' }) +
        ui.field({ label: 'Language / stack', model: 'ui.doc.language', value: d.language || '' }) +
        ui.field({ label: 'Project / website', model: 'ui.doc.projectId', value: d.projectId || '', options: [['', '— not linked —']].concat(App.store.get('sites', []).map(s => [s.id, s.name])) }) +
        ui.field({ label: 'Client', model: 'ui.doc.clientId', value: d.clientId || '', options: [['', '— not linked —']].concat(App.store.get('clients', []).map(c => [c.id, c.name])) }) +
        ui.field({ label: 'Author', model: 'ui.doc.author', value: d.author || '' }) +
        ui.field({ label: 'Tags (comma separated)', model: 'ui.doc.tags', value: (d.tags || []).join(', ') }) +
        '</div>' +
        ui.field({ label: 'What is this file?', model: 'ui.doc.description', value: d.description || '', rows: 3, wrapCls: 'mt-3' }) +
        ui.field({ label: 'Internal notes', model: 'ui.doc.notes', value: d.notes || '', rows: 2, wrapCls: 'mt-3' }),
      footer: '<button class="btn btn-ghost" data-action="close-modal">Cancel</button>' +
        '<button class="btn btn-lime" data-action="files.saveEdit" data-arg="' + d.id + '">Save</button>'
    });
  });
  App.action('files.saveEdit', el => {
    const id = el.getAttribute('data-arg');
    const g = k => App.store.get('ui.doc.' + k, '');
    const project = App.store.find('sites', g('projectId'));
    App.store.patch('documents', id, {
      name: g('name'), category: g('category'), version: g('version'), language: g('language'),
      projectId: g('projectId'), projectName: project ? project.name : '', clientId: g('clientId'),
      author: g('author'), description: g('description'), notes: g('notes'),
      tags: String(g('tags') || '').split(',').map(x => x.trim()).filter(Boolean)
    });
    ui.closeModal();
    ui.toast('Record updated', 'lime');
    App.refresh();
  });
})(window);
