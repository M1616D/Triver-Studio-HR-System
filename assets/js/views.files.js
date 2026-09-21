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
    App.router.q.files = App.router.q.files || { category: 'all', search: '', project: '', folder: '' };
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
        '<p class="text-[12px] font-semibold mt-2">Drop a folder, or choose files</p>' +
        '<p class="text-[10px] text-textMuted mt-1">A whole project folder is read as it is, with every sub-folder. HTML, CSS, JS, PHP, Python, images, fonts, archives, PDFs, any language.</p>' +
        '<input id="file-input" type="file" multiple class="hidden" />' +
        '<input id="dir-input" type="file" webkitdirectory directory multiple class="hidden" />' +
        '<div class="btn-row mt-3">' +
        '<button class="btn btn-lime btn-sm" data-pick="folder"><i class="fa-solid fa-folder-tree"></i> Choose a folder</button>' +
        '<button class="btn btn-ghost btn-sm" data-pick="files"><i class="fa-solid fa-file-circle-plus"></i> Choose files</button>' +
        '</div>' +
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
          const rows = ui._uploadFiles || [];
          const folders = {};
          rows.forEach(f => { if (f.folder) folders[f.folder] = 1; });
          list.innerHTML = (Object.keys(folders).length ? '<li class="text-accentMint"><i class="fa-solid fa-folder-tree"></i> ' +
            rows.length + ' file(s) from ' + Object.keys(folders).length + ' folder(s) — the structure is kept</li>' : '') +
            rows.slice(0, 60).map(f =>
            '<li class="flex items-center gap-2"><i class="fa-solid ' + iconFor({ kind: U.fileKind(f.name, f.type) }) + '"></i>' +
            '<span class="truncate">' + U.esc(f.folder ? f.folder + '/' + f.name : f.name) + '</span>' +
            '<span class="ml-auto num">' + U.bytes(f.size) + '</span></li>').join('') +
            (rows.length > 60 ? '<li class="text-textMuted">… and ' + (rows.length - 60) + ' more</li>' : '');
        };
        const dir = root.querySelector('#dir-input');
        const take = files => {
          const rows = Array.prototype.slice.call(files || []);
          // a folder keeps its shape: the relative path becomes part of the name
          rows.forEach(f => { if (f.webkitRelativePath && f.webkitRelativePath.indexOf('/') !== -1) f.folder = f.webkitRelativePath.split('/').slice(0, -1).join('/'); });
          ui._uploadFiles = (ui._uploadFiles || []).concat(rows);
          render();
        };
        root.querySelectorAll('[data-pick="files"]').forEach(b => b.addEventListener('click', () => input.click()));
        root.querySelectorAll('[data-pick="folder"]').forEach(b => b.addEventListener('click', () => dir.click()));
        input.addEventListener('change', () => take(input.files));
        dir.addEventListener('change', () => take(dir.files));
        zone.addEventListener('dragover', ev => { ev.preventDefault(); zone.classList.add('is-over'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
        zone.addEventListener('drop', ev => {
          ev.preventDefault();
          zone.classList.remove('is-over');
          if (!ev.dataTransfer) return;
          const items = ev.dataTransfer.items ? Array.prototype.slice.call(ev.dataTransfer.items) : [];
          const entries = items.map(i => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null)).filter(Boolean);
          if (!entries.length) { take(ev.dataTransfer.files); return; }
          const found = [];
          const walk = entry => new Promise(res => {
            if (!entry) return res();
            if (entry.isFile) return entry.file(f => { f.folder = entry.fullPath ? entry.fullPath.replace(/^\//, '').split('/').slice(0, -1).join('/') : ''; found.push(f); res(); }, () => res());
            if (!entry.isDirectory) return res();
            const reader = entry.createReader();
            const read = () => reader.readEntries(entries2 => {
              if (!entries2.length) return res();
              Promise.all(entries2.map(walk)).then(read);
            }, () => res());
            read();
          });
          Promise.all(entries.map(walk)).then(() => take(found));
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
      const here = App.files.browse(s.folder);
      const rows = U.sortBy(App.files.search(s.search, { category: s.category, projectId: s.project, folder: s.folder }), d => d.uploadedAt || '', 'desc');
      const backend = App.files.backend();
      const crumbs = s.folder ? s.folder.split('/') : [];

      el.innerHTML =
        '<div class="flex items-center justify-between gap-3 flex-wrap mb-3">' +
        '<div class="flex flex-wrap gap-1.5">' +
        [['all', 'All files']].concat(App.files.categories()).map(c =>
          ui.chip(c[1] + (c[0] === 'all' ? ' (' + stats.count + ')' : stats.byCategory[c[0]] ? ' (' + stats.byCategory[c[0]] + ')' : ''),
            s.category === c[0], 'files.category', c[0], c[0] === 'all' ? 'fa-layer-group' : c[2])).join('') +
        '</div>' +
        '<div class="btn-row">' +
        '<input class="inp w-[190px]" data-model="ui.filesSearch" data-change-action="files.applyFilters" data-enter="files.applyFilters" value="' + U.attr(s.search) + '" placeholder="Search name, tag, content…" />' +
        '<button class="btn btn-ghost btn-sm" data-action="files.newFolder"><i class="fa-solid fa-folder-plus"></i> New folder</button>' +
        '<button class="btn btn-lime btn-sm" data-action="files.upload"><i class="fa-solid fa-arrow-up-from-bracket"></i> Add files</button>' +
        '</div></div>' +

        /* the folder strip: where you are, and what is inside */
        '<div class="folders glass-soft rounded-xl mb-4">' +
        '<div class="folders__crumbs">' +
        '<button class="folders__crumb' + (s.folder ? '' : ' is-on') + '" data-action="files.folder" data-arg="">' +
        '<i class="fa-solid fa-hard-drive"></i> Vault root</button>' +
        crumbs.map((c, i) => {
          const path = crumbs.slice(0, i + 1).join('/');
          return '<i class="fa-solid fa-chevron-right folders__sep"></i>' +
            '<button class="folders__crumb' + (i === crumbs.length - 1 ? ' is-on' : '') + '" data-action="files.folder" data-arg="' + U.attr(path) + '">' + U.esc(c) + '</button>';
        }).join('') +
        (s.folder ? '<span class="folders__tools"><button class="btn btn-ghost btn-sm" data-action="files.renameFolder" data-arg="' + U.attr(s.folder) + '"><i class="fa-solid fa-pen"></i> Rename</button>' +
          '<button class="btn btn-ghost btn-sm" data-action="files.delFolder" data-arg="' + U.attr(s.folder) + '"><i class="fa-solid fa-trash"></i></button></span>' : '') +
        '</div>' +
        ((here.folders.length || s.folder === '')
          ? '<div class="folders__grid">' +
            here.folders.map(f =>
              '<button class="folder-tile" data-action="files.folder" data-arg="' + U.attr(f.path) + '">' +
              '<span class="folder-tile__icon"><i class="fa-solid fa-folder"></i></span>' +
              '<span class="folder-tile__name">' + U.esc(f.path.split('/').pop()) + '</span>' +
              '<span class="folder-tile__meta">' + f.count + ' item' + (f.count === 1 ? '' : 's') + '</span>' +
              '</button>').join('') +
            (s.folder === '' ? '<button class="folder-tile folder-tile--new" data-action="files.newFolder">' +
              '<span class="folder-tile__icon"><i class="fa-solid fa-plus"></i></span>' +
              '<span class="folder-tile__name">New folder</span>' +
              '<span class="folder-tile__meta">group files your way</span></button>' : '') +
            '</div>'
          : '') +
        '</div>' +

        ui.hero([
          { label: 'Files stored', value: String(stats.count), sub: U.bytes(stats.bytes) + (backend === 'indexedDB' ? ' · on this device' : ' · storage is limited'),
            cta: 'Add files', icon: 'fa-arrow-up-from-bracket', action: 'files.upload' },
          { label: 'Linked to a project', value: String(stats.links), tone: 'blue',
            sub: stats.count ? U.pct(stats.links, stats.count) + '% of the vault' : 'nothing linked yet' },
          { label: 'In Drive', value: String(App.files.all().filter(d => d.cloud && d.cloud.driveId).length), tone: 'violet',
            sub: App.cloud.isConnected() ? 'backed up off this device' : 'Drive is not connected',
            cta: 'Cloud settings', icon: 'fa-cloud', nav: 'settings' },
          { label: 'Latest', value: stats.newest ? U.relTime(stats.newest.uploadedAt) : '—', tone: 'amber',
            sub: stats.newest ? U.esc(stats.newest.name) : 'nothing stored yet' }
        ]) +
        '<div class="mt-4"></div>' +

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
          : (here.folders.length
            ? ''
            : ui.empty(stats.count ? 'Nothing matches that filter' : (s.folder ? 'This folder is empty' : 'The vault is empty'),
              stats.count ? 'Clear the search or pick another category.' : 'Add the files you already own — website builds, logos, contracts, invoices. Each one keeps its full record here.',
              'fa-box-archive',
              '<button class="btn btn-lime btn-sm" data-action="files.upload"><i class="fa-solid fa-arrow-up-from-bracket"></i> Add your first files</button>')));

      if (params) openDetail(params);
    }
  };

  /* ------------------------------ folder actions --------------------------- */
  App.action('files.folder', el => {
    q().folder = el.getAttribute('data-arg') || '';
    q().search = '';
    App.store.set('ui.filesSearch', '', { silent: true });
    App.emit('state:changed', { path: 'files' });
  });

  App.action('files.newFolder', () => {
    const s = q();
    App.store.set('ui.newFolder', { name: '' }, { silent: true });
    ui.modal({
      title: 'New folder',
      sub: s.folder ? 'Created inside “' + s.folder + '”' : 'A folder groups files in the vault. Uploads can keep their own folder shape too.',
      size: 'sm',
      body: ui.field({ label: 'Folder name', model: 'ui.newFolder.name', value: '', placeholder: 'Client sites' }),
      footer: '<button class="btn btn-ghost" data-action="close-modal">Cancel</button>' +
        '<button class="btn btn-lime" data-action="files.newFolderGo">Create</button>'
    });
  });

  App.action('files.newFolderGo', () => {
    const base = q().folder;
    const name = App.store.get('ui.newFolder.name', '').trim();
    if (!name) { ui.toast('Give the folder a name', 'amber'); return; }
    const res = App.files.createFolder(base ? base + '/' + name : name);
    if (res.error) { ui.toast(res.error, 'red'); return; }
    ui.closeModal();
    ui.toast('Folder created', 'lime');
    App.emit('state:changed', { path: 'files' });
  });

  App.action('files.renameFolder', el => {
    const path = el.getAttribute('data-arg');
    App.store.set('ui.renFolder', { name: path.split('/').pop() }, { silent: true });
    ui.modal({
      title: 'Rename folder',
      sub: 'Every file inside follows to the new name.',
      size: 'sm',
      body: ui.field({ label: 'Folder name', model: 'ui.renFolder.name', value: path.split('/').pop() }),
      footer: '<button class="btn btn-ghost" data-action="close-modal">Cancel</button>' +
        '<button class="btn btn-lime" data-action="files.renameFolderGo" data-arg="' + U.attr(path) + '">Rename</button>'
    });
  });

  App.action('files.renameFolderGo', el => {
    const path = el.getAttribute('data-arg');
    const name = App.store.get('ui.renFolder.name', '').trim();
    if (!name) { ui.toast('Give the folder a name', 'amber'); return; }
    const parts = path.split('/'); parts.pop();
    const res = App.files.renameFolder(path, parts.concat(name).join('/'));
    if (res.error) { ui.toast(res.error, 'red'); return; }
    q().folder = res.path;
    ui.closeModal();
    ui.toast(res.moved + ' file(s) moved to “' + res.path + '”', 'lime');
    App.emit('state:changed', { path: 'files' });
  });

  App.action('files.delFolder', el => {
    const path = el.getAttribute('data-arg');
    const count = App.files.browse(path);
    const total = count.files.length + count.folders.reduce((n, f) => n + f.count, 0);
    ui.confirm({
      title: 'Delete the folder “' + path.split('/').pop() + '”?',
      sub: 'The folder and everything inside it — about ' + total + ' file(s) — is removed from the vault. Files already copied to Drive keep their copies there.',
      tone: 'danger',
      confirmLabel: 'Delete the folder',
      onConfirm: () => {
        App.files.deleteFolder(path).then(r => {
          q().folder = '';
          ui.toast('Folder deleted · ' + r.removed + ' file(s) removed', 'amber');
          App.emit('state:changed', { path: 'files' });
        }).catch(e => ui.toast(e.message, 'red'));
      }
    });
  });

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
      try { out.added.push(await App.files.add(list[i], Object.assign({}, meta, { folder: list[i].folder || '' }))); }
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
