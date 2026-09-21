/* =============================================================================
   Triverse OS — Discover
   1 Search a business type in an Addis Ababa area → 2 filter → 3 open the deep
   info → 4 build their website → 5 send the message and triage the reply.
   ========================================================================== */
(function (global) {
  'use strict';

  const App = global.App;
  const U = App.util;
  const ui = App.ui;

  const FILTERS = [
    ['all', 'All', 'fa-layer-group'],
    ['no-site', 'No website', 'fa-triangle-exclamation'],
    ['has-site', 'Has website', 'fa-globe'],
    ['whatsapp', 'WhatsApp', 'fa-whatsapp'],
    ['high-rated', '4.5★ and up', 'fa-star'],
    ['new', 'Not contacted', 'fa-bolt-lightning'],
    ['replied', 'Replied', 'fa-reply'],
    ['won', 'Won', 'fa-trophy']
  ];

  /* how far around the chosen area Google should look */
  const RADIUS = [[3, 'within 3 km'], [5, 'within 5 km'], [8, 'within 8 km'], [15, 'within 15 km'], [30, 'within 30 km']];

  /** escape text but make any URL in it clickable (Google tells you where to go) */
  function linkify(text) {
    return U.esc(String(text || '')).replace(/(https?:\/\/[^\s<)]+)/g,
      '<a class="link break-all" href="$1" target="_blank" rel="noopener">$1</a>');
  }

  function q() {
    App.router.q.discover = App.router.q.discover || {
      typeKey: '', query: '', areaKey: 'addis-ababa', city: App.store.get('settings.google.city', 'Addis Ababa'),
      radiusKm: Number(App.store.get('settings.google.radiusKm', 8)) || 8, filter: 'all', sort: 'rating', search: '',
      queue: [], selected: [], note: '', error: '', pageToken: '', loading: false, at: '', cursor: -1, suggest: []
    };
    const s = App.router.q.discover;
    if (!s.areaKey) s.areaKey = 'addis-ababa';
    return s;
  }

  /* ------------------------------ the current list -------------------------- */
  /** queue order + text search + sort, before the chip filter */
  function queueLeads() {
    const s = q();
    const byId = {};
    App.store.get('leads', []).forEach(l => { byId[l.id] = l; });
    const ids = s.queue.length ? s.queue : App.store.get('leads', []).map(l => l.id);
    let list = ids.map(id => byId[id]).filter(Boolean);
    if (s.search) {
      list = list.filter(l => U.hit(l.name, s.search) || U.hit(l.category, s.search) || U.hit(l.address, s.search) || U.hit(l.phone, s.search));
    }
    const key = {
      rating: l => Number(l.rating) || 0, reviews: l => Number(l.reviews) || 0,
      value: l => Number(l.value) || 0, name: l => String(l.name).toLowerCase(),
      dist: l => Number(l.dist) || 999, status: l => l.status, updated: l => l.updatedAt || ''
    }[s.sort] || (l => 0);
    const dir = s.sort === 'name' || s.sort === 'dist' ? 'asc' : 'desc';
    return U.sortBy(list, key, dir);
  }

  function applyChip(list, filter) {
    if (filter === 'has-site') return list.filter(l => l.website);
    if (filter === 'no-site') return list.filter(l => !l.website);
    if (filter === 'whatsapp') return list.filter(l => l.whatsapp);
    if (filter === 'high-rated') return list.filter(l => Number(l.rating) >= 4.5);
    if (filter === 'new') return list.filter(l => ['new', 'qualified'].indexOf(l.status) !== -1);
    if (filter === 'replied') return list.filter(l => l.reply);
    if (filter === 'won') return list.filter(l => l.status === 'won');
    return list;
  }

  function leadsOfQueue() { const s = q(); return applyChip(queueLeads(), s.filter); }

  App.ui.leadBadges = function (lead) {
    const out = [];
    if (!lead.website) out.push(ui.badge('no website', 'amber'));
    else out.push(ui.badge('has website', 'muted'));
    if (lead.whatsapp) out.push(ui.badge('WhatsApp', 'lime'));
    if (lead.telegram) out.push(ui.badge('Telegram', 'blue'));
    if (Number(lead.rating) >= 4.5) out.push(ui.badge('★ ' + Number(lead.rating).toFixed(1), 'lime'));
    if (lead.clientId) out.push(ui.badge('client', 'lime'));
    if (lead.siteId) out.push(ui.badge('website built', 'violet'));
    return out.join(' ');
  };

  /* --------------------------- which step are we on ------------------------- */
  function stepIndex(leads) {
    const s = q();
    if (!leads.length) return 0;
    if (App.router.q.openLead) return 2;
    if (leads.some(l => (l.outreach || []).length)) return leads.some(l => l.siteId) ? 4 : 3;
    if (leads.some(l => l.siteId)) return 3;
    return 1;
  }

  /* --------------------------------- search -------------------------------- */
  /** "dental clinic" → the dentist preset, unknown text → a free-text search */
  function resolveType(raw) {
    const t = String(raw || '').trim().toLowerCase();
    if (!t) return { key: '', label: '' };
    const list = App.dict.businessTypes;
    const exact = list.filter(b => b[0] === t || b[1].toLowerCase() === t)[0];
    if (exact) return { key: exact[0], label: exact[1] };
    const partial = list.filter(b => b[0].indexOf(t) !== -1 || b[1].toLowerCase().indexOf(t) !== -1)[0];
    if (partial) return { key: partial[0], label: partial[1] };
    return { key: '', label: String(raw).trim() };
  }
  App.discoverResolveType = resolveType;

  function runSearch(extra) {
    const s = q();
    const more = Boolean(extra && extra.more);
    const box = document.getElementById('discover-results');
    const raw = String(App.store.get('ui.discoverType', '') || '').trim();
    const resolved = resolveType(raw);
    s.typeKey = resolved.key;
    s.query = resolved.label || raw;
    s.areaKey = App.store.get('ui.discoverArea', s.areaKey) || s.areaKey;
    s.radiusKm = Number(App.store.get('ui.discoverRadius', s.radiusKm || 8)) || 8;
    const area = App.dict.areaOf(s.areaKey);
    s.city = area && area.key !== 'addis-ababa' ? area.label + ', Addis Ababa' : 'Addis Ababa';
    if (area) {
      App.store.set('settings.google.centerLat', area.lat, { silent: true });
      App.store.set('settings.google.centerLng', area.lng, { silent: true });
    }
    App.store.set('settings.google.radiusKm', s.radiusKm, { silent: true });
    closeSuggest();
    if (!more && !s.typeKey && !s.query) {
      ui.toast('Type a business type first — dentist, restaurant, gym, hotel…', 'amber');
      return;
    }
    if (!App.providers.hasKey()) {
      s.loading = false;
      s.error = 'No Google Places API key saved. Open Settings → Google Maps and paste your key — the app then searches the real Maps record.';
      App.emit('state:changed', { path: 'search' });
      App.router.go('settings');
      ui.toast('Add your Google Places key first', 'amber');
      return;
    }
    /* Never block a search up front. A search that has been run before is served
       from the studio's own saved copy at no cost, so the wall only ever matters
       for a genuinely new search — and even then the app keeps working. */
    if (!more) { s.queue = []; s.pageToken = ''; s.at = ''; }
    s.loading = true; s.error = '';
    if (box) box.innerHTML = skeleton();
    const t = App.dict.typeOf(s.typeKey);
    App.providers.search({
      typeKey: s.typeKey, query: s.query || t.label, city: s.city,
      areaKey: s.areaKey, pageToken: more ? s.pageToken : '', radiusKm: s.radiusKm,
      fresh: Boolean(extra && extra.fresh)
    })
      .then(out => {
        const keys = {};
        out.leads.forEach(l => { keys[l.placeId || ('n:' + U.slug(l.name))] = true; });
        App.providers.ingest(out.leads, { refresh: true });
        const ids = App.store.get('leads', []).filter(l => keys[l.placeId || ('n:' + U.slug(l.name))]).map(l => l.id);
        s.queue = more ? U.uniq(s.queue.concat(ids)) : ids;
        s.pageToken = out.nextPageToken || '';
        s.note = out.note;
        s.error = out.failed ? out.note : '';
        s.fromCache = Boolean(out.fromCache);
        s.loading = false; s.at = U.now();
        App.log('lead', 'Searched “' + (s.query || App.dict.typeLabel(s.typeKey)) + '” in ' + s.city + ' — ' + ids.length + ' results (' + (out.fromCache ? 'saved copy' : 'Google Maps') + ')', '');
        App.emit('state:changed', { path: 'search' });
        if (!s.error) ui.toast(out.fromCache
          ? ids.length + ' businesses loaded from your own saved results — no daily allowance spent'
          : ids.length + ' businesses loaded from Google Maps', out.fromCache ? 'blue' : 'lime');
      })
      .catch(err => {
        s.loading = false; s.error = err.message; s.note = '';
        App.emit('state:changed', { path: 'search' });
        ui.toast(String(err.message).split('\n')[0], 'red');
      });
  }

  function skeleton() {
    return '<div class="space-y-2">' + [1, 2, 3, 4, 5].map(() =>
      '<div class="skeleton h-[64px]"></div>').join('') + '</div>';
  }

  /* ---------------------------------- map ----------------------------------- */
  /* A real Google map with a pin per result. If the Maps JavaScript API is not
     enabled for the saved key we keep the keyless Google embed, so a map is
     always on screen. */
  const MAP_LIB = { ok: false, promise: null, map: null, pins: [] };

  const DARK_MAP_STYLE = [
    { elementType: 'geometry', stylers: [{ color: '#15161c' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8f95b2' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#15161c' }] },
    { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1c1d24' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#242632' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8f95b2' }] },
    { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1c1d24' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f1015' }] },
    { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#303342' }] }
  ];

  function currentArea() {
    const s = q();
    return App.dict.areaOf(App.store.get('ui.discoverArea', s.areaKey || 'addis-ababa')) || App.dict.areaOf('addis-ababa');
  }

  function mapsReady(key) {
    if (MAP_LIB.ok) return Promise.resolve(true);
    if (MAP_LIB.promise) return MAP_LIB.promise;
    MAP_LIB.promise = new Promise((resolve, reject) => {
      let done = false;
      const cb = '__triMapsReady';
      window[cb] = () => { done = true; MAP_LIB.ok = true; resolve(true); };
      const s = document.createElement('script');
      s.async = true;
      /* the marker library is what lets us use AdvancedMarkerElement instead of
         the deprecated google.maps.Marker */
      s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(key) +
        '&libraries=marker&loading=async&callback=' + cb;
      s.onerror = () => { if (!done) reject(new Error('the map script was blocked')); };
      setTimeout(() => { if (!done) reject(new Error('the map did not answer')); }, 9000);
      document.head.appendChild(s);
    });
    return MAP_LIB.promise;
  }

  /** draw (or redraw) the pins for the current result list */
  function drawPins(leads) {
    const box = document.getElementById('discover-map');
    if (!box || !MAP_LIB.ok || !window.google || !window.google.maps) return false;
    const area = currentArea();
    const pale = document.documentElement.getAttribute('data-theme') !== 'light';
    let host = document.getElementById('tri-map');
    if (!host) {
      box.innerHTML = '<div id="tri-map" style="width:100%;height:100%"></div>';
      MAP_LIB.map = null;
      host = document.getElementById('tri-map');
    }
    /*
     * google.maps.Marker is deprecated and logs a warning on every load. The
     * replacement, AdvancedMarkerElement, needs a map ID — and a map ID makes
     * Google ignore the inline `styles` array. So: dark mode is now painted by
     * a CSS filter on the map container (which works with a map ID) and the
     * markers are AdvancedMarkerElement. Marker is kept only as the fallback
     * for a library that loaded without the marker bundle.
     */
    const g = window.google.maps;
    const Advanced = g.marker && g.marker.AdvancedMarkerElement;
    if (!MAP_LIB.map) {
      const opts = {
        center: { lat: area.lat, lng: area.lng }, zoom: 13,
        mapTypeControl: false, streetViewControl: false, fullscreenControl: true,
        backgroundColor: pale ? '#15161c' : '#f2f5f7'
      };
      if (Advanced) opts.mapId = 'DEMO_MAP_ID';
      else if (pale) opts.styles = DARK_MAP_STYLE;
      MAP_LIB.map = new g.Map(host, opts);
      host.classList.toggle('map-dark', Boolean(Advanced) && pale);
      MAP_LIB.pins = [];
    }
    MAP_LIB.pins.forEach(p => {
      if (p.setMap) p.setMap(null);
      if (p.remove) p.remove();
    });
    MAP_LIB.pins = [];
    const bounds = new g.LatLngBounds();
    let placed = 0;
    leads.forEach(l => {
      const lat = Number(l.lat), lng = Number(l.lng);
      if (!lat || !lng) return;
      let pin;
      if (Advanced) {
        const dot = document.createElement('div');
        dot.className = 'tri-pin' + (l.website ? ' has-site' : '');
        dot.title = l.name || '';
        pin = new Advanced({ position: { lat: lat, lng: lng }, map: MAP_LIB.map, title: l.name, content: dot });
        dot.addEventListener('click', () => openLead(l.id));
      } else {
        pin = new g.Marker({
          position: { lat: lat, lng: lng }, map: MAP_LIB.map, title: l.name,
          icon: {
            path: g.SymbolPath.CIRCLE, scale: 8,
            fillColor: l.website ? '#5A8679' : '#91C8B9', fillOpacity: 1,
            strokeColor: '#0F1015', strokeWeight: 2
          }
        });
        pin.addListener('click', () => openLead(l.id));
      }
      MAP_LIB.pins.push(pin);
      bounds.extend({ lat: lat, lng: lng });
      placed++;
    });
    if (placed > 1) MAP_LIB.map.fitBounds(bounds, 60);
    else if (!placed) MAP_LIB.map.setCenter({ lat: area.lat, lng: area.lng });
    return true;
  }

  function mapCard(leads) {
    const area = currentArea();
    const key = App.store.get('settings.google.apiKey', '');
    const embedQ = encodeURIComponent((q().query || App.dict.typeLabel(q().typeKey) || 'businesses') + ' ' + area.label + ' Addis Ababa Ethiopia');
    return '<div class="glass-card p-3.5 mb-5">' +
      '<div class="flex items-center justify-between gap-3 mb-3 flex-wrap">' +
      '<div class="flex items-center gap-2.5 min-w-0">' +
      '<span class="w-9 h-9 rounded-full bg-accentMint/10 text-accentMint flex items-center justify-center shrink-0"><i class="fa-solid fa-map-location-dot"></i></span>' +
      '<div class="min-w-0"><p class="text-xs font-semibold text-white truncate">' + U.esc(area.label) + '</p>' +
      '<p class="text-[10px] text-textMuted">' + leads.length + ' businesses on the map' +
      (q().query ? ' · “' + U.esc(q().query) + '”' : '') + '</p></div></div>' +
      '<div class="btn-row">' +
      '<button class="btn btn-ghost btn-sm" data-action="discover.mapRefresh"><i class="fa-solid fa-rotate"></i> Refresh map</button>' +
      '<button class="btn btn-ghost btn-sm" data-action="discover.selectAll"><i class="fa-solid fa-check-double"></i> Select all shown</button></div>' +
      '</div>' +
      '<div id="discover-map" class="w-full rounded-xl overflow-hidden border border-line" style="height:320px;background:rgb(var(--bg-panel-2))">' +
      '<iframe title="Google map of ' + U.attr(area.label) + '" style="width:100%;height:100%;border:0" loading="lazy" ' +
      'src="https://www.google.com/maps?q=' + embedQ + '&z=13&output=embed"></iframe></div>' +
      '<p class="text-[10px] text-textMuted mt-2 flex items-center gap-1.5">' + ui.icon('fa-circle-info', '') +
      '<span id="discover-map-note">' + (key
        ? (MAP_LIB.ok ? 'Live Google map — every pin is one of the businesses below, tap it to open.'
          : 'Google embed view. Press “Refresh map” to load the interactive map with a pin per business.')
        : 'Add your Google key in Settings → Google Maps to switch on the interactive map.') + '</span></p></div>';
  }

  /** try to upgrade the embed to the pinnable map, silently */
  function upgradeMap(silent) {
    const key = App.store.get('settings.google.apiKey', '');
    if (!key) { if (!silent) ui.toast('Add your Google key in Settings → Discovery first', 'amber'); return; }
    mapsReady(key).then(() => {
      const list = leadsOfQueue();
      const drew = drawPins(list);
      const note = document.getElementById('discover-map-note');
      if (drew && note) note.textContent = 'Live Google map — ' + list.length + ' businesses, tap a pin to open it.';
      if (drew && !silent) ui.toast('Live map ready — pins follow every search', 'lime');
    }).catch(err => {
      if (!silent) ui.toast('The interactive map did not load (' + err.message + ') — the Google embed stays on screen instead.', 'amber');
    });
  }

  /* ------------------------------ type-ahead ------------------------------- */
  function buildSuggestions(text) {
    const t = String(text || '').trim().toLowerCase();
    const out = [];
    if (!t) return out;
    App.dict.businessTypes.forEach(bt => {
      if (bt[0].indexOf(t) !== -1 || bt[1].toLowerCase().indexOf(t) !== -1) {
        out.push({ label: bt[1], sub: 'Business type · typical deal ' + U.money(bt[5]), icon: bt[2], action: 'discover.pickType', arg: bt[0] });
      }
    });
    App.dict.areas.forEach(a => {
      const hay = (a[1] + ' ' + a[4]).toLowerCase();
      if (hay.indexOf(t) !== -1) out.push({ label: a[1], sub: 'Addis Ababa area · ' + a[4], icon: 'fa-location-dot', action: 'discover.pickArea', arg: a[0] });
    });
    App.store.get('leads', []).filter(l => U.hit(l.name, t)).slice(0, 4).forEach(l =>
      out.push({ label: l.name, sub: 'Saved business · ' + (l.areaLabel || l.city || ''), icon: 'fa-store', action: 'lead-open', arg: l.id }));
    if (!out.length || (out[0] && out[0].label.toLowerCase() !== t)) {
      out.push({ label: 'Search “' + text + '” as typed', sub: 'Live search on the map for exactly this text', icon: 'fa-magnifying-glass', action: 'discover.freeText', arg: text });
    }
    return out.slice(0, 8);
  }

  function renderSuggest() {
    const s = q();
    const box = document.getElementById('discover-suggest');
    if (!box) return;
    if (!s.suggest.length) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    box.innerHTML = s.suggest.map((x, i) =>
      '<button class="' + (i === s.cursor ? 'is-cursor' : '') + '" data-action="' + x.action + '" data-arg="' + U.attr(x.arg) + '" data-sug="' + i + '">' +
      '<span class="sug-ico">' + ui.icon(x.icon, '') + '</span>' +
      '<span class="min-w-0"><span class="block truncate">' + U.esc(x.label) + '</span>' +
      '<span class="block text-[9px] text-textMuted truncate">' + U.esc(x.sub) + '</span></span></button>').join('');
    box.classList.remove('hidden');
  }

  function closeSuggest() {
    const s = q();
    s.suggest = []; s.cursor = -1;
    const box = document.getElementById('discover-suggest');
    if (box) { box.classList.add('hidden'); box.innerHTML = ''; }
  }

  function onTypeKeydown(ev) {
    const s = q();
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      if (!s.suggest.length) s.suggest = buildSuggestions(App.store.get('ui.discoverType', ''));
      s.cursor = ev.key === 'ArrowDown'
        ? Math.min(s.cursor + 1, s.suggest.length - 1)
        : Math.max(s.cursor - 1, 0);
      renderSuggest();
      return;
    }
    if (ev.key === 'Escape') { closeSuggest(); ev.target.blur(); return; }
    if (ev.key === 'Enter') {
      ev.preventDefault();
      ev.stopPropagation();
      if (s.cursor >= 0 && s.suggest[s.cursor]) {
        const pick = s.suggest[s.cursor];
        const fn = App.actions[pick.action];
        if (fn) fn({ getAttribute: () => pick.arg });
        return;
      }
      runSearch();
    }
  }

  function bindHero() {
    const box = document.getElementById('discover-type');
    if (box) {
      box.addEventListener('input', U.debounce(() => {
        const s = q();
        s.suggest = buildSuggestions(box.value);
        s.cursor = -1;
        renderSuggest();
      }, 90));
      box.addEventListener('keydown', onTypeKeydown);
      box.addEventListener('blur', () => setTimeout(closeSuggest, 140));
    }
  }

  /* --------------------------------- rows ---------------------------------- */
  function resultRow(lead) {
    const sel = q().selected.indexOf(lead.id) !== -1;
    return '<div class="row-card ' + (sel ? 'is-sel' : '') + ' p-3 flex items-center gap-3" data-action="lead-open" data-arg="' + lead.id + '">' +
      '<button class="w-4 h-4 rounded border ' + (sel ? 'bg-limeAccent border-limeAccent' : 'border-line') + ' flex items-center justify-center shrink-0" data-action="discover.select" data-arg="' + lead.id + '" title="Select for a batch">' +
      (sel ? '<i class="fa-solid fa-check text-[8px] text-black"></i>' : '') + '</button>' +
      (function () {
        const photo = App.providers.photoUrl(lead, 80);
        return photo
          ? '<img src="' + U.attr(photo) + '" alt="" loading="lazy" class="w-11 h-11 rounded-lg object-cover border border-line shrink-0" onerror="this.style.display=\'none\'">'
          : ui.avatar(lead.name, 'w-9 h-9 text-[11px]');
      })() +
      '<div class="min-w-0 flex-1">' +
      '<div class="flex items-center gap-1.5 flex-wrap"><p class="text-[12px] font-bold text-white truncate">' + U.esc(lead.name) + '</p>' +
      ui.badge(lead.status, App.dict.leadTones[lead.status] || 'muted') + ui.leadBadges(lead) + '</div>' +
      '<p class="text-[9px] text-textMuted truncate mt-0.5">' + U.esc(lead.category || '') + ' · ' + U.esc(lead.areaLabel || lead.address || '') +
      (lead.dist ? ' · ' + lead.dist + ' km' : '') + (lead.hours ? ' · ' + U.esc(lead.hours) : '') + '</p>' +
      '</div>' +
      '<div class="hidden xl:flex flex-col items-end gap-1 shrink-0 w-[200px]">' +
      (lead.rating ? ui.stars(lead.rating, lead.reviews) : '<span class="text-[9px] text-textMuted">not rated on maps</span>') +
      '<div class="flex items-center gap-1">' +
      (lead.phone
        ? '<button class="mini-btn" data-action="lead.call" data-arg="' + lead.id + '" title="Call ' + U.attr(lead.phone) + '">' + ui.icon('fa-phone', 'text-[9px]') + ' Call</button>'
        : '<span class="text-[9px] text-textMuted">no phone</span>') +
      (lead.website
        ? '<button class="mini-btn" data-action="lead.openWebsite" data-arg="' + lead.id + '" title="' + U.attr(lead.website) + '">' + ui.icon('fa-globe', 'text-[9px]') + ' Site</button>'
        : '<span class="text-[9px] text-amber-300">no website</span>') +
      '</div></div>' +
      '<span class="text-[10px] font-bold text-limeAccent hidden lg:block">' + U.money(lead.value) + '</span>' +
      '<i class="fa-solid fa-chevron-right text-[10px] text-textMuted"></i></div>';
  }

  /* -------------------------------- drawer --------------------------------- */
  /* The business's own Google record — phone, website, hours, photos and the real
     reviews — is fetched the first time it is opened, then cached on the record. */
  const DETAILS = {};

  function openLead(id) {
    const lead = App.store.find('leads', id);
    if (!lead) { ui.toast('Business not found', 'red'); return; }
    App.router.q.openLead = id;
    renderDrawer();
    loadDetails(lead);
  }

  function loadDetails(lead, force) {
    const id = lead.id;
    if (lead.source !== 'google' || !lead.placeId) return;
    const st = DETAILS[id];
    if (!force && (st === 'loading' || st === 'done')) return;
    if (!force && lead.detailsAt && !lead.detailsError) { DETAILS[id] = 'done'; return; }
    DETAILS[id] = 'loading';
    if (App.router.q.openLead === id) renderDrawer();
    App.providers.details(lead.placeId).then(d => {
      DETAILS[id] = 'done';
      if (App.router.q.openLead === id) renderDrawer();
      if (force) ui.toast('Pulled ' + d.reviewsList.length + ' reviews and ' + d.photos.length + ' photos from Google', 'lime');
    }).catch(err => {
      DETAILS[id] = 'error:' + err.message;
      App.store.patch('leads', id, { detailsAt: U.now(), detailsError: err.message });
      if (App.router.q.openLead === id) renderDrawer();
    });
  }

  /* --- one-tap contact buttons ------------------------------------------- */
  function callBtn(lead, cls) {
    const href = U.telHref(lead);
    if (!href) return '<span class="btn btn-ghost btn-sm opacity-50" title="No phone number on the Maps record">' + ui.icon('fa-phone', '') + ' No phone listed</span>';
    return '<a class="' + (cls || 'btn btn-lime btn-sm') + '" href="' + U.attr(href) + '" title="Click to call ' + U.attr(lead.phone) + '">' + ui.icon('fa-phone', '') + ' Call ' + U.esc(lead.phone || '') + '</a>';
  }
  function waBtn(lead, cls) {
    const d = App.msg.dial(lead);
    if (!d) return '';
    const text = 'Selam ' + lead.name + ', this is ' + App.store.get('settings.company.senderName', '') + ' from ' + App.store.get('settings.company.shortName', 'Triverse Studio') + '.';
    return '<a class="' + (cls || 'btn btn-ghost btn-sm') + '" target="_blank" rel="noopener" href="https://wa.me/' + U.attr(d) + '?text=' + U.attr(encodeURIComponent(text)) + '">' + App.dict.chanIcon('whatsapp', '') + ' WhatsApp ' + U.esc(lead.intlPhone || lead.phone) + '</a>';
  }
  function siteBtn(lead, cls) {
    if (!lead.website) return '';
    const url = /^https?:/i.test(lead.website) ? lead.website : 'https://' + lead.website;
    return '<a class="' + (cls || 'btn btn-ghost btn-sm') + '" target="_blank" rel="noopener" href="' + U.attr(url) + '">' + ui.icon('fa-globe', '') + ' Open their website ↗</a>';
  }
  function dirBtn(lead, cls) {
    const url = lead.mapsUrl || ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([lead.name, lead.address].join(' ')));
    return '<a class="' + (cls || 'btn btn-ghost btn-sm') + '" target="_blank" rel="noopener" href="' + U.attr(url) + '">' + ui.icon('fa-diamond-turn-right', '') + ' Directions</a>';
  }

  function detailsStatus(lead) {
    const st = DETAILS[lead.id] || (lead.detailsAt ? 'done' : '');
    if (st === 'loading') {
      return '<div class="glass-soft rounded-xl p-3 mb-3 text-[10px] text-textMuted flex items-center gap-2">' +
        '<i class="fa-solid fa-spinner fa-spin text-accentMint"></i> Reading this business\u2019s Google Maps record — reviews, opening hours, photos, website…</div>';
    }
    if (String(st).indexOf('error:') === 0) {
      return '<div class="glass-soft rounded-xl p-3 mb-3 text-[11px] tone tone-red border">' +
        '<p class="whitespace-pre-line">' + U.esc(String(st).slice(6)) + '</p>' +
        '<div class="btn-row mt-2"><button class="btn btn-ghost btn-sm" data-action="lead.googleRefresh" data-arg="' + lead.id + '">' +
        ui.icon('fa-rotate', '') + ' Try again</button>' +
        '<button class="btn btn-ghost btn-sm" data-action="discover.check">' + ui.icon('fa-plug-circle-check', '') + ' Check the key</button></div></div>';
    }
    return '';
  }

  function photoStrip(lead) {
    const urls = App.providers.photoUrls(lead, 480, 5);
    if (!urls.length) return '';
    const link = lead.mapsUrl || '#';
    return '<div class="grid grid-cols-5 gap-1.5 mb-3">' + urls.map(u =>
      '<a class="block rounded-lg overflow-hidden border border-line group" target="_blank" rel="noopener" href="' + U.attr(link) + '"' +
      ' title="Open this business on Google Maps"><img src="' + U.attr(u) + '" alt="Photo from Google Maps" loading="lazy"' +
      ' class="w-full h-16 object-cover group-hover:scale-110 transition-transform duration-700" onerror="this.parentNode.style.display=&#39;none&#39;"></a>').join('') + '</div>';
  }

  function reviewsBlock(lead) {
    const list = lead.reviewsList || [];
    if (!list.length) {
      if (!lead.reviews) return '';
      /* Google answered, but sent no review text: say why, and give the two ways
         forward — read them on Maps now, or unlock them with billing */
      if (lead.atmosphereBlocked) {
        return ui.card(ui.head('Reviews', ui.badge(U.num(lead.reviews) + ' ratings on Google', 'amber'),
          'Google released no review text to this project') +
          '<p class="text-[11px] text-gray-300 leading-relaxed">' + U.esc(App.providers.atmosphereNote()) + '</p>' +
          '<div class="btn-row mt-3">' +
          (lead.mapsUrl ? '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="' + U.attr(lead.mapsUrl) + '">' +
            ui.icon('fa-arrow-up-right-from-square', '') + ' Read them on Google Maps</a>' : '') +
          '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://console.cloud.google.com/billing/linkedaccount">' +
            ui.icon('fa-credit-card', '') + ' Link billing to unlock</a>' +
          '<button class="btn btn-ghost btn-sm" data-action="lead.googleRefresh" data-arg="' + lead.id + '">' +
            ui.icon('fa-rotate', '') + ' Refresh from Google</button>' +
          '</div>', 'mb-4');
      }
      return ui.card(ui.head('Reviews', ui.badge(U.num(lead.reviews) + ' on Google', 'lime')) +
        '<p class="text-[10px] text-textMuted">Review text loads the first time you open this business. ' +
        '<button class="link" data-action="lead.googleRefresh" data-arg="' + lead.id + '">pull it from Google now</button></p>', 'mb-4');
    }
    return ui.card(ui.head('What customers wrote on Google', ui.badge(list.length + ' of ' + U.num(lead.reviews || list.length), 'lime'),
      'Real reviews from this business\u2019s Maps record — use them as testimonials on their new site') +
      '<div class="space-y-2">' + list.map(r =>
        '<div class="bg-field border border-line rounded-xl p-2.5 hover-lift">' +
        '<div class="flex items-center gap-2 mb-1">' +
        (r.authorPhoto
          ? '<img src="' + U.attr(r.authorPhoto) + '" alt="" class="w-6 h-6 rounded-full object-cover" loading="lazy">'
          : ui.avatar(r.author, 'w-6 h-6 text-[9px]')) +
        '<span class="text-[10px] font-semibold text-white truncate">' + U.esc(r.author) + '</span>' +
        '<span class="text-[10px] text-limeAccent">' + '★'.repeat(Math.max(1, Math.round(r.rating))) + '</span>' +
        '<span class="text-[9px] text-textMuted ml-auto shrink-0">' + U.esc(r.when) + '</span></div>' +
        (r.text ? '<p class="text-[11px] text-gray-300 leading-relaxed">' + U.esc(r.text) + '</p>' : '<p class="text-[10px] text-textMuted">Rating only — no written comment.</p>') +
        '</div>').join('') + '</div>' +
      (lead.mapsUrl ? '<a class="link text-[10px] inline-block mt-2" target="_blank" rel="noopener" href="' + U.attr(lead.mapsUrl) + '">Read every review on Google Maps ↗</a>' : ''), 'mb-4');
  }

  function hoursBlock(lead) {
    const week = lead.hoursWeek || [];
    if (!week.length && !lead.hours) return '';
    return ui.card(ui.head('Opening hours',
      lead.openNow === true ? ui.badge('Open now', 'lime') : (lead.openNow === false ? ui.badge('Closed now', 'red') : ''),
      'Kept in sync with their Google Maps profile') +
      (week.length
        ? '<div class="grid grid-cols-1 gap-1">' + week.map(line => {
          const parts = String(line).split(': ');
          const day = parts.shift();
          const rest = parts.join(': ');
          const closed = /closed/i.test(rest);
          return '<div class="flex items-center justify-between text-[11px] px-2.5 py-1 rounded-lg hover:bg-hover transition">' +
            '<span class="text-textMuted">' + U.esc(day) + '</span>' +
            '<span class="' + (closed ? 'text-red-300' : 'text-gray-300') + '">' + U.esc(rest) + '</span></div>';
        }).join('') + '</div>'
        : '<p class="text-[11px] text-gray-300">' + U.esc(lead.hours) + '</p>'), 'mb-4');
  }

  /** the Google record itself: every field the Maps listing holds */
  function googleBlock(lead) {
    const st = DETAILS[lead.id] || (lead.detailsAt ? 'done' : '');
    const so = lead.serviceOptions || {};
    const serviceBits = [];
    if (so.delivery) serviceBits.push('Delivery');
    if (so.takeout) serviceBits.push('Takeaway');
    if (so.dineIn) serviceBits.push('Dine-in');
    if (so.reservable) serviceBits.push('Takes reservations');
    return ui.card(
      ui.head('Google Maps record',
        '<div class="btn-row">' +
        (st !== 'loading' ? '<button class="btn btn-ghost btn-sm" data-action="lead.googleRefresh" data-arg="' + lead.id + '">' + ui.icon('fa-rotate', '') + ' Refresh from Google</button>' : '') +
        '<button class="btn btn-ghost btn-sm" data-action="lead.copyDetails" data-arg="' + lead.id + '">' + ui.icon('fa-copy', '') + ' Copy all</button>' +
        '</div>',
        lead.detailsAt ? 'Synced ' + U.relTime(lead.detailsAt) + ' · place ID ' + (lead.placeId || '—') : 'Everything Google publishes about this business') +
      photoStrip(lead) +
      ui.kv('Phone', lead.phone
        ? '<a class="link" href="' + U.attr(U.telHref(lead)) + '">' + U.esc(lead.phone) + '</a>' +
          (lead.intlPhone && lead.intlPhone !== lead.phone ? ' <span class="text-[9px] text-textMuted">' + U.esc(lead.intlPhone) + '</span>' : '')
        : '<span class="text-amber-300">no phone number listed</span>') +
      ui.kv('WhatsApp', lead.whatsapp ? ui.badge('number available', 'lime') + ' <span class="text-[10px]">' + U.esc(lead.intlPhone || lead.phone) + '</span>' : 'no number') +
      ui.kv('Website', lead.website
        ? ui.link(lead.website, lead.website.replace(/^https?:\/\//, '').replace(/\/$/, '')) + ' ' + ui.link(lead.website, '↗')
        : '<span class="text-amber-300">none on Google — this is your opening</span>') +
      ui.kv('Rating', lead.rating ? ui.stars(lead.rating, lead.reviews) + (lead.mapsUrl ? ' ' + ui.link(lead.mapsUrl, 'reviews ↗') : '') : 'not rated') +
      ui.kv('Category', U.esc(lead.category || '—') + (lead.priceLevelLabel ? ' · ' + U.esc(lead.priceLevelLabel) : '')) +
      ui.kv('Status', U.esc(lead.openNow === true ? 'Open now' : (lead.openNow === false ? 'Closed now' : (lead.hours || '—')))) +
      ui.kv('Address', U.esc(lead.address || '—') + ' <a class="link" target="_blank" rel="noopener" href="' + U.attr(lead.mapsUrl || '#') + '">map ↗</a>') +
      ui.kv('Area', U.esc(lead.areaLabel || '—') + (lead.subCity && lead.subCity !== '—' ? ' · ' + U.esc(lead.subCity) : '') + (lead.dist ? ' · ' + lead.dist + ' km away' : '')) +
      ui.kv('Coordinates', lead.lat ? '<span class="mono text-[9px]">' + lead.lat + ', ' + lead.lng + '</span>' : '—') +
      (serviceBits.length ? ui.kv('Service options', U.esc(serviceBits.join(' · '))) : '') +
      (!lead.website && lead.reviews ? ui.kv('Their footfall', U.num(lead.reviews) + ' customers already rate them ' + Number(lead.rating).toFixed(1) + '★ — none of them can find a website') : '') +
      (lead.summary ? '<p class="text-[10px] text-gray-300 mt-2 italic">“' + U.esc(lead.summary) + '”</p>' : ''), 'mb-4');
  }

  function renderDrawer() {
    const id = App.router.q.openLead;
    const lead = App.store.find('leads', id);
    if (!lead) { ui.closeDrawer(); return; }
    const rec = App.msg.recommend(lead);
    const tpl = App.msg.defaultTemplate(lead);
    const preview = tpl ? App.msg.render(tpl, lead) : { body: '' };
    const channels = App.msg.channelsFor(lead);
    const notes = (lead.notes || []).slice(0, 6);
    const outreach = (lead.outreach || []).slice(0, 6);
    const idx = q().queue.indexOf(id);
    const total = q().queue.length;

    ui.drawer({
      title: lead.name,
      sub: (lead.category || App.dict.typeLabel(lead.businessType)) + (lead.areaLabel ? ' · ' + lead.areaLabel : '') +
        (idx >= 0 ? ' · #' + (idx + 1) + ' of ' + total + ' in this search' : ' · not in the current search'),
      body:
        '<div class="flex items-center gap-2 flex-wrap mb-3">' + ui.badge(lead.status, App.dict.leadTones[lead.status] || 'muted') + ui.leadBadges(lead) +
        '<span class="tag">' + U.esc(lead.source === 'google' ? 'Google Maps' : (lead.source || 'manual')) + '</span>' +
        (lead.detailsAt ? '<span class="tag">synced ' + U.esc(U.relTime(lead.detailsAt)) + '</span>' : '') + '</div>' +

        detailsStatus(lead) +

        /* the three things you actually do with a business, one tap each */
        '<div class="flex flex-wrap gap-2 mb-2">' +
        callBtn(lead) +
        waBtn(lead) +
        siteBtn(lead) +
        dirBtn(lead) +
        (!lead.website ? '<span class="btn btn-ghost btn-sm tone tone-amber border cursor-default" title="No website on their Google record">' +
          ui.icon('fa-triangle-exclamation', '') + ' No website — your opening</span>' : '') +
        '</div>' +

        '<div class="btn-row mb-4">' +
        '<button class="btn btn-lime btn-sm" data-action="lead.generate" data-arg="' + lead.id + '"><i class="fa-solid fa-wand-magic-sparkles"></i> Try this — build their website</button>' +
        '<button class="btn btn-ghost btn-sm" data-action="outreach.openCompose" data-arg="' + lead.id + '"><i class="fa-solid fa-comment-dots"></i> Compose message</button>' +
        (App.ai && App.ai.ready() ? '<button class="btn btn-ghost btn-sm" data-action="lead.aiBrief" data-arg="' + lead.id + '"><i class="fa-solid fa-brain"></i> AI brief &amp; first message</button>' : '') +
        '<button class="btn btn-ghost btn-sm" data-action="lead.reply" data-arg="' + lead.id + '"><i class="fa-solid fa-reply"></i> Log reply</button>' +
        '<button class="btn btn-ghost btn-sm" data-action="lead.toClient" data-arg="' + lead.id + '"><i class="fa-solid fa-user-plus"></i> Make client</button>' +
        '<button class="btn btn-ghost btn-sm" data-action="lead.next" data-arg="' + lead.id + '"><i class="fa-solid fa-forward"></i> Next business</button>' +
        '</div>' +

        googleBlock(lead) +
        reviewsBlock(lead) +
        hoursBlock(lead) +

        ui.card(ui.head('Recommended offer', ui.badge(U.money(rec.total), 'lime'), 'Picked from your catalogue based on what this business is missing') +
          '<div class="space-y-1.5">' + rec.items.map(i =>
            '<div class="flex items-center justify-between text-[11px] bg-field border border-line rounded-lg px-2.5 py-1.5 hover-lift">' +
            '<span class="text-gray-300">' + U.esc(i.name) + '</span><span class="text-limeAccent font-semibold">' + U.money(i.price) + '</span></div>').join('') + '</div>' +
          '<p class="text-[10px] text-textMuted mt-2">Delivery ' + U.esc(rec.deliveryLabel) + ' · total ' + U.money(rec.total) + ' · payment Telebirr / CBE Birr / bank transfer</p>', 'mb-4') +

        ui.card(ui.head('Pipeline', '<button class="btn btn-ghost btn-sm" data-action="lead.saveMeta" data-arg="' + lead.id + '"><i class="fa-solid fa-floppy-disk"></i> Save</button>') +
          '<div class="grid grid-cols-2 gap-2">' +
          ui.field({ label: 'Status', model: 'ui.leadStatus', value: lead.status, options: App.dict.leadStages.map(s => [s, U.title(s)]) }) +
          ui.field({ label: 'Estimated value (ETB)', model: 'ui.leadValue', value: lead.value, type: 'number' }) +
          ui.field({ label: 'Next follow-up', model: 'ui.leadFollow', value: lead.nextFollowUp, type: 'date' }) +
          ui.field({ label: 'Tags (comma separated)', model: 'ui.leadTags', value: (lead.tags || []).join(', ') }) +
          '</div>', 'mb-4') +

        ui.card(ui.head('Notes', ui.badge((lead.notes || []).length + '', 'muted')) +
          '<div class="flex gap-2 mb-2"><input class="inp" id="lead-note" placeholder="What did they say? What is the next step?" />' +
          '<button class="btn btn-lime btn-sm" data-action="lead.addNote" data-arg="' + lead.id + '">Add</button></div>' +
          (notes.length ? '<div class="space-y-1.5">' + notes.map(n =>
            '<div class="bg-field border border-line rounded-lg p-2"><p class="text-[10px] text-gray-300">' + U.esc(n.text) + '</p>' +
            '<p class="text-[9px] text-textMuted">' + U.relTime(n.at) + '</p></div>').join('') + '</div>' : '<p class="text-[10px] text-textMuted">No notes yet.</p>'), 'mb-4') +

        ui.card(ui.head('Conversation history', ui.badge((lead.outreach || []).length + ' messages', 'blue')) +
          (lead.reply ? '<div class="bg-field border border-limeAccent/30 rounded-lg p-2.5 mb-2">' +
            '<div class="flex items-center justify-between"><p class="text-[10px] font-semibold text-limeAccent">Their reply · ' + U.esc(lead.reply.sentiment) + '</p>' +
            '<span class="text-[9px] text-textMuted">' + U.relTime(lead.reply.at) + '</span></div>' +
            '<p class="text-[11px] text-gray-200 mt-1">' + U.esc(lead.reply.text) + '</p>' +
            '<p class="text-[9px] text-textMuted mt-1">Detected: ' + U.esc((lead.reply.reasons || []).join(', ') || 'no keywords') + '</p></div>' : '') +
          (outreach.length ? '<div class="space-y-1.5">' + outreach.map(o =>
            '<div class="bg-field border border-line rounded-lg p-2"><div class="flex items-center gap-2 mb-1">' + App.dict.chanIcon(o.channel, 'text-[10px] text-limeAccent') +
            '<span class="text-[9px] text-textMuted">' + U.relTime(o.at) + ' · ' + U.esc(o.via || 'manual') + '</span>' +
            (o.reply ? ui.badge('replied', 'lime') : ui.badge('awaiting reply', 'muted')) + '</div>' +
            '<p class="text-[10px] text-gray-300 whitespace-pre-line">' + U.esc(String(o.body).slice(0, 220)) + (String(o.body).length > 220 ? '…' : '') + '</p>' +
            (o.reply ? '<p class="text-[10px] text-limeAccent mt-1">↳ ' + U.esc(o.reply) + '</p>' : '') + '</div>').join('') + '</div>'
            : '<p class="text-[10px] text-textMuted">No message sent yet.</p>'), 'mb-4') +

        ui.card(ui.head('Suggested first message', tpl ? ui.badge(App.dict.chanLabel(tpl.channel), 'lime') : '') +
          '<p class="text-[10px] text-gray-300 whitespace-pre-line bg-field border border-line rounded-lg p-2.5">' + U.esc(preview.body) + '</p>' +
          '<div class="btn-row mt-2">' +
          '<button class="btn btn-ghost btn-sm" data-action="lead.copyMsg" data-arg="' + lead.id + '"><i class="fa-solid fa-copy"></i> Copy</button>' +
          channels.slice(0, 3).map(ch => '<button class="btn btn-ghost btn-sm" data-action="lead.sendOne" data-arg="' + lead.id + '" data-extra="' + ch.key + '">' +
            App.dict.chanIcon(ch.key, '') + ' ' + App.dict.chanLabel(ch.key) + '</button>').join('') +
          '</div>'),
      footer: '<button class="btn btn-ghost btn-sm" data-action="lead.skip" data-arg="' + lead.id + '">Skip</button>' +
        '<button class="btn btn-danger btn-sm" data-action="lead.reject" data-arg="' + lead.id + '">Mark rejected</button>' +
        '<button class="btn btn-lime" data-action="lead.next" data-arg="' + lead.id + '">Next business <i class="fa-solid fa-forward"></i></button>'
    });
  }

  /* ---------------------------- website generator --------------------------- */
  function siteModal(leadId, preselectedTemplate) {
    const lead = App.store.find('leads', leadId);
    if (!lead) return;
    App.router.q.gen = App.router.q.gen || {};
    const g = App.router.q.gen;
    if (g.leadId !== leadId || !g.mode) {
      g.leadId = leadId;
      // with nothing uploaded yet there is no design to clone, so start on template
      g.mode = App.samples.empty() ? 'template' : 'sample';
      g.sampleId = (App.samples.forBusiness(lead) || {}).id || '';
      g.templateId = preselectedTemplate || (App.store.get('templates')[0] || {}).id;
      g.sections = App.sitegen.sectionsFor(lead.businessType);
      g.credit = true;
      g.mapEmbed = false;
      g.ai = null;
      g.html = '';
      g.meta = null;
    }
    const templates = App.store.get('templates', []);
    const sampleList = App.samples.list();
    const activeSample = App.samples.find(g.sampleId) || App.samples.forBusiness(lead);
    const isSample = g.mode !== 'template';

    const sampleRow = s => '<button class="w-full text-left glass-soft rounded-xl p-2.5 border ' +
      (s.id === (activeSample || {}).id && isSample ? 'border-limeAccent' : 'border-transparent') + '" data-action="gen.sample" data-arg="' + U.attr(s.id) + '">' +
      '<p class="text-[11px] font-semibold truncate">' + U.esc(s.name) + '</p>' +
      '<p class="text-[9px] text-textMuted truncate">' + U.esc(s.blurb || s.category || '') + '</p></button>';

    ui.modal({
      title: 'Build the website for ' + lead.name,
      sub: (activeSample && isSample ? 'Cloning sample “' + activeSample.name + '” — only the information changes' : 'Generated from a template'),
      size: 'xl',
      body:
        '<div class="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">' +
        '<div>' +
        '<div class="btn-row mb-3">' +
        '<button class="btn btn-sm ' + (isSample ? 'btn-lime' : 'btn-ghost') + '" data-action="gen.mode" data-arg="sample">Sample site</button>' +
        '<button class="btn btn-sm ' + (isSample ? 'btn-ghost' : 'btn-lime') + '" data-action="gen.mode" data-arg="template">Template</button>' +
        '</div>' +
        (isSample
          ? '<p class="lbl">Design for this category</p>' +
            (sampleList.length
              ? '<div class="space-y-2 max-h-[210px] overflow-y-auto pr-1">' + sampleList.map(sampleRow).join('') + '</div>'
              : '<p class="text-[10px] text-textMuted leading-relaxed">No design uploaded yet. Add the page you sell with and every business of this category is built from it, word for word, with their own information.</p>') +
            '<div class="btn-row mt-2"><button class="btn btn-ghost btn-sm" data-action="samples.library"><i class="fa-solid fa-folder-plus"></i> ' + (sampleList.length ? 'Add a design' : 'Upload a design') + '</button></div>'
          : '<p class="lbl">Design template</p>' +
            '<div class="space-y-2 max-h-[210px] overflow-y-auto pr-1">' + templates.map(t =>
              '<button class="w-full text-left glass-soft rounded-xl p-2.5 border ' + (t.id === g.templateId ? 'border-limeAccent' : 'border-transparent') + '" data-action="gen.template" data-arg="' + U.attr(t.id) + '">' +
              '<div class="flex items-center gap-2"><span class="w-6 h-6 rounded-md shrink-0" style="background:' + U.attr(t.accent) + '"></span>' +
              '<div class="min-w-0"><p class="text-[11px] font-semibold truncate">' + U.esc(t.name) + '</p>' +
              '<p class="text-[9px] text-textMuted truncate">' + U.esc(t.style) + '</p></div></div></button>').join('') + '</div>') +

        '<div class="mt-3 space-y-2">' +
        ui.field({ label: 'Business type', model: 'ui.genType', value: lead.businessType, options: App.dict.businessTypes.map(t => [t[0], t[1]]).concat([['general', 'Other / general']]) }) +
        ui.field({ label: '', model: 'ui.genCredit', value: g.credit, type: 'checkbox', checkLabel: 'Show “Website by ' +
          App.store.get('settings.company.shortName', 'Triverse Studio') + '”' }) +
        '</div>' +
        (App.ai && App.ai.ready()
          ? '<button class="btn btn-ghost btn-sm w-full mt-2" data-action="gen.ai"><i class="fa-solid fa-wand-magic-sparkles"></i> Rewrite the wording with AI</button>'
          : '<button class="btn btn-ghost btn-sm w-full mt-2" data-nav="settings"><i class="fa-solid fa-wand-magic-sparkles"></i> Connect AI to rewrite the wording</button>') +
        '</div>' +
        '<div>' +
        '<div class="flex items-center justify-between mb-2">' +
        '<p class="text-[10px] text-textMuted">Live preview' + (g.meta ? ' · ' + U.esc(g.meta.templateName) + (g.meta.swapped && g.meta.swapped.length ? ' · ' + g.meta.swapped.length + ' details replaced' : (g.meta.placeholders && g.meta.placeholders.length ? ' · ' + g.meta.placeholders.length + ' fields filled' : '')) : '') + '</p>' +
        '<div class="btn-row">' +
        '<button class="btn btn-ghost btn-sm" data-action="gen.open"><i class="fa-solid fa-arrow-up-right-from-square"></i> Open in tab</button>' +
        '<button class="btn btn-ghost btn-sm" data-action="gen.download"><i class="fa-solid fa-download"></i> Download HTML</button>' +
        '<button class="btn btn-ghost btn-sm" data-action="gen.copy"><i class="fa-solid fa-copy"></i> Copy code</button>' +
        '</div></div>' +
        '<div id="gen-preview">' + (g.html ? ui.previewFrame(g.html, 520) : '<div class="skeleton h-[520px]"></div>') + '</div>' +
        '</div></div>',
      footer: '<span class="text-[10px] text-textMuted mr-auto">Static and offline-safe — host it anywhere or send the demo link as a teaser.</span>' +
        '<button class="btn btn-ghost" data-action="gen.sendDemo" data-arg="' + lead.id + '"><i class="fa-brands fa-whatsapp"></i> Send demo message</button>' +
        '<button class="btn btn-lime" data-action="gen.save" data-arg="' + lead.id + '"><i class="fa-solid fa-wand-magic-sparkles"></i> Save &amp; use in pipeline</button>',
      onMount() { if (!g.html) buildPreview(); }
    });
    if (!g.html) buildPreview();
  }

  function buildPreview() {
    const g = App.router.q.gen;
    const lead = App.store.find('leads', g.leadId);
    if (!lead) return;
    const effectiveLead = Object.assign({}, lead, { businessType: App.store.get('ui.genType', lead.businessType) || lead.businessType });
    g.credit = App.store.get('ui.genCredit', g.credit) !== false;
    g.mapEmbed = App.store.get('ui.genMap', g.mapEmbed) === true;
    const useSample = g.mode !== 'template';
    const out = App.sitegen.build({
      lead: effectiveLead,
      sampleId: useSample ? (g.sampleId || ((App.samples.forBusiness(effectiveLead) || {}).id || '')) : undefined,
      preferSample: useSample,
      templateId: useSample ? undefined : g.templateId,
      options: { sections: g.sections, credit: g.credit, mapEmbed: g.mapEmbed, ai: g.ai }
    });
    g.html = out.html; g.meta = out.meta;
    if (out.meta && out.meta.sampleId) App.samples.bump(out.meta.sampleId);
    const box = document.getElementById('gen-preview');
    if (box) box.innerHTML = ui.previewFrame(g.html, 520);
    App.store.set('ui.genType', effectiveLead.businessType, { silent: true });
  }

  /* ------------------------------- view render ------------------------------ */
  App.views.discover = {
    title: 'Discover businesses',
    sub: 'Addis Ababa map search → filter → deep info → website → message',
    icon: 'fa-map-location-dot',
    render(el, params) {
      const s = q();
      const all = queueLeads();
      const leads = applyChip(all, s.filter);
      const total = App.store.get('leads', []).length;
      const radiusInit = Number(App.store.get('ui.discoverRadius', s.radiusKm || 8)) || 8;
      const areaInit = App.store.get('ui.discoverArea', s.areaKey) || s.areaKey;
      const area = App.dict.areaOf(areaInit);
      const typed = App.store.get('ui.discoverType', '');

      const counts = {};
      FILTERS.forEach(f => { counts[f[0]] = applyChip(all, f[0]).length; });

      /*
       * The new structure: the search is the page — one wide bar at the top
       * with the area beside it, the map immediately under the results so a
       * search answers in two places at once, and the filter chips as a quiet
       * count strip between them. No steps ribbon explaining the obvious.
       */
      el.innerHTML =
        '<div class="disc-hero">' +
          '<div class="disc-hero__bar">' +
            '<span class="disc-hero__glass">' + ui.icon('fa-magnifying-glass') + '</span>' +
            '<input id="discover-type" data-model="ui.discoverType" value="' + U.attr(typed) + '" placeholder="What are you looking for — dentist, restaurant, gym?" autocomplete="off" />' +
            '<button class="btn btn-lime" data-action="discover.search">Search</button>' +
          '</div>' +
          '<div id="discover-suggest" class="suggest hidden"></div>' +
          '<div class="disc-hero__meta">' +
            '<span class="disc-hero__pair">' + ui.icon('fa-location-dot') + App.dict.areas.map(function (a) { return '<button class="disc-area' + (a[0] === areaInit ? ' is-on' : '') + '" data-action="discover.areaSet" data-arg="' + a[0] + '">' + U.esc(a[1]) + '</button>'; }).join('') + '</span>' +
            '<span class="disc-hero__pair">' + ui.icon('fa-circle-notch') + RADIUS.map(function (r) { return '<button class="disc-area' + (String(r[0]) === String(radiusInit) ? ' is-on' : '') + '" data-action="discover.radiusSet" data-arg="' + r[0] + '">' + U.esc(r[1].replace(' km', 'km')) + '</button>'; }).join('') + '</span>' +
            '<button class="disc-area" data-action="discover.import" title="Import CSV / JSON"><i class="fa-solid fa-file-import"></i></button>' +
          '</div>' +
        '</div>' +
        (s.error || s.note || App.providers.quotaBlocked()
          ? '<div class="mt-3">' + (s.error
            ? '<div class="glass-soft rounded-xl p-3 mb-3 text-[11px] flex items-start gap-2.5 tone tone-red border">' + ui.icon('fa-triangle-exclamation', 'mt-0.5') +
              '<div class="min-w-0 flex-1"><p class="whitespace-pre-line">' + linkify(s.error) + '</p>' +
              '<div class="btn-row mt-2"><button class="btn btn-lime btn-sm" data-action="discover.search"><i class="fa-solid fa-rotate"></i> Try again</button>' +
              '<button class="btn btn-ghost btn-sm" data-nav="settings"><i class="fa-solid fa-gear"></i> Google Maps settings</button>' +
              '<button class="btn btn-ghost btn-sm" data-action="discover.check"><i class="fa-solid fa-plug-circle-check"></i> Why is Google refusing?</button></div></div></div>'
            : App.providers.quotaBlocked()
              ? '<div class="glass-soft rounded-xl p-3 mb-3 text-[11px] flex items-start gap-2.5 tone tone-amber border">' + ui.icon('fa-gauge-high', 'mt-0.5') +
                '<div class="min-w-0 flex-1"><p class="font-semibold mb-1">Google\u2019s search allowance for today is spent</p>' +
                '<p class="text-textMuted whitespace-pre-line">' + U.esc(App.providers.quotaNote()) + '</p>' +
                '<div class="btn-row mt-2"><button class="btn btn-ghost btn-sm" data-action="discover.search">Open a list I already searched</button>' +
                '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://console.cloud.google.com/apis/api/places.googleapis.com/quotas">Raise the allowance</a>' +
                '<button class="btn btn-ghost btn-sm" data-action="discover.import">Import a list instead</button></div></div></div>'
              : '<div class="glass-soft rounded-xl p-2.5 mb-3 text-[10px] flex items-center gap-2 tone tone-blue border">' + ui.icon('fa-circle-info', '') + '<span>' + U.esc(s.note) + '</span>' +
                (s.fromCache ? '<button class="btn btn-ghost btn-sm ml-auto shrink-0" data-action="discover.refreshLive">Pull the newest from Google</button>' : '') + '</div>') + '</div>'
          : '') +
        '<div class="disc-strip">' +
          '<div class="disc-strip__filters">' + FILTERS.map(f =>
            '<button class="chip ' + (s.filter === f[0] ? 'is-on' : '') + '" data-action="discover.filter" data-arg="' + f[0] + '">' +
            ui.icon(f[2], 'text-[9px]') + U.esc(f[1]) + '<span class="chip-n">' + counts[f[0]] + '</span></button>').join('') + '</div>' +
          '<input class="inp disc-strip__search" id="discover-search" data-model="ui.discoverSearch" data-change-action="discover.applyFilters" data-enter="discover.applyFilters" value="' + U.attr(s.search) + '" placeholder="Filter by name / phone…" />' +
        '</div>';

      el.innerHTML +=
        '<div class="flex items-center justify-between gap-2 mb-2 flex-wrap">' +
        '<p class="text-[10px] text-textMuted flex items-center gap-2">' +
        (s.loading ? '<span class="dot-live"></span> Searching ' + U.esc(area ? area.label : 'Addis Ababa') + '…'
          : '<b class="text-gray-300">' + leads.length + '</b> businesses' +
            (all.length !== leads.length ? ' of ' + all.length : '') + ' · ' +
            leads.filter(l => !l.website).length + ' without a website · ' +
            leads.filter(l => l.whatsapp).length + ' reachable on WhatsApp' +
            (s.at ? ' · updated ' + U.relTime(s.at) : '')) + '</p>' +
        '<div class="btn-row">' +
        (s.pageToken ? '<button class="btn btn-ghost btn-sm" data-action="discover.more">' + ui.icon('fa-plus', 'text-[9px]') + ' Load 20 more</button>' : '') +
        '<button class="btn btn-lime btn-sm" data-action="discover.bulkSend">' + ui.icon('fa-paper-plane', 'text-[9px]') + ' Batch send (' + s.selected.length + ')</button>' +
        '<button class="btn btn-ghost btn-sm" data-action="discover.export">' + ui.icon('fa-file-csv', 'text-[9px]') + ' Export CSV</button>' +
        '</div></div>';

      el.innerHTML += mapCard(leads);
      el.innerHTML += '<div id="discover-results" class="space-y-2 stagger">' +
        (s.loading ? skeleton() : (leads.length ? leads.map(resultRow).join('')
          : ui.empty('Nothing in this list yet',
            'Type a business type above and press Enter — or pick an area and search “restaurant”, “dentist”, “gym”…',
            'fa-map-location-dot',
            '<button class="btn btn-lime btn-sm" data-action="discover.search">Search Addis Ababa</button>'))) +
        '</div>';

      bindHero();
      if (MAP_LIB.ok) drawPins(leads);
      else if (!MAP_LIB.promise) upgradeMap(true);
      if (params) openLead(params);
    }
  };

  /* -------------------------------- actions -------------------------------- */
  App.action('discover.search', () => runSearch());
  App.action('discover.areaSet', el => {
    App.store.set('ui.discoverArea', el.getAttribute('data-arg'), { silent: true });
    App.refresh();
    if (q().queue.length) runSearch();
  });
  App.action('discover.radiusSet', el => {
    App.store.set('ui.discoverRadius', Number(el.getAttribute('data-arg')) || 8, { silent: true });
    App.refresh();
    if (q().queue.length) runSearch();
  });
  App.action('discover.refreshLive', () => runSearch({ fresh: true }));
  App.action('discover.mapRefresh', () => upgradeMap(false));
  App.action('discover.pickType', el => {
    const key = el.getAttribute('data-arg');
    App.store.set('ui.discoverType', key, { silent: true });
    const box = document.getElementById('discover-type');
    if (box) box.value = App.dict.typeLabel(key);
    closeSuggest();
    runSearch();
  });
  App.action('discover.pickArea', el => {
    const key = el.getAttribute('data-arg');
    App.store.set('ui.discoverArea', key, { silent: true });
    closeSuggest();
    if (q().queue.length) runSearch();
    else App.emit('state:changed', { path: 'area' });
  });
  App.action('discover.freeText', el => {
    App.store.set('ui.discoverType', el.getAttribute('data-arg'), { silent: true });
    closeSuggest();
    runSearch();
  });
  App.action('discover.surprise', () => {
    const t = App.dict.businessTypes[Math.floor(Math.random() * App.dict.businessTypes.length)];
    const a = App.dict.areas[1 + Math.floor(Math.random() * (App.dict.areas.length - 1))];
    App.store.set('ui.discoverType', t[0], { silent: true });
    App.store.set('ui.discoverArea', a[0], { silent: true });
    const box = document.getElementById('discover-type');
    if (box) box.value = t[1];
    ui.toast('Try ' + t[1] + ' in ' + a[1], 'blue');
    runSearch();
  });
  App.action('discover.quickType', el => {
    const key = el.getAttribute('data-arg');
    q().typeKey = key; q().query = App.dict.typeLabel(key);
    App.store.set('ui.discoverType', key, { silent: true });
    App.emit('state:changed', { path: 'discover' });
    runSearch();
  });
  App.action('discover.applyFilters', () => {
    const s = q();
    s.search = App.store.get('ui.discoverSearch', '');
    s.sort = App.store.get('ui.discoverSort', s.sort);
    App.emit('state:changed', { path: 'filter' });
  });
  App.action('discover.filter', el => { q().filter = el.getAttribute('data-arg'); App.emit('state:changed', { path: 'filter' }); });
  App.action('discover.select', (el, ev) => {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const s = q(), id = el.getAttribute('data-arg');
    const i = s.selected.indexOf(id);
    if (i === -1) s.selected.push(id); else s.selected.splice(i, 1);
    App.emit('state:changed', { path: 'select' });
  });
  App.action('discover.selectAll', () => {
    const s = q();
    const ids = leadsOfQueue().map(l => l.id);
    s.selected = s.selected.length === ids.length ? [] : ids;
    App.emit('state:changed', { path: 'selectAll' });
  });
  App.action('discover.reset', () => { const s = q(); s.queue = []; s.filter = 'all'; s.search = ''; s.note = ''; App.emit('state:changed', { path: 'reset' }); });
  App.action('discover.export', () => {
    const rows = leadsOfQueue().map(l => ({
      name: l.name, category: l.category, area: l.areaLabel || '', phone: l.phone, website: l.website,
      rating: l.rating, reviews: l.reviews, address: l.address, status: l.status,
      whatsapp: l.whatsapp ? 'yes' : 'no', email: l.email, maps: l.mapsUrl
    }));
    U.download('triverse-leads-' + U.todayISO() + '.csv', U.toCSV(rows), 'text/csv');
    ui.toast('Exported ' + rows.length + ' businesses', 'lime');
  });
  App.action('discover.import', () => {
    ui.modal({
      title: 'Import businesses from a CSV / JSON export',
      sub: 'Works with Outscraper, Apify, Instant Data Scraper or any sheet with name / phone / website columns',
      size: 'lg',
      body: ui.field({ label: 'Paste CSV or JSON (or pick a file below)', model: 'ui.importText', value: App.store.get('ui.importText', ''), rows: 9, placeholder: 'name,category,phone,website,rating,reviews,address\n…' }) +
        ui.field({ label: 'Business type for imported rows', model: 'ui.importType', value: 'auto', options: [['auto', 'Detect automatically']].concat(App.dict.businessTypes.map(t => [t[0], t[1]])) }) +
        '<input type="file" id="import-file" accept=".csv,.json,.txt" class="inp mt-2" />' +
        '<p class="text-[9px] text-textMuted mt-2">Run a search in any Maps scraper, export CSV, and drop it here. Duplicates (same place ID or name + address) are skipped automatically. Nothing leaves this computer.</p>',
      footer: '<button class="btn btn-ghost" data-action="close-modal">Cancel</button>' +
        '<button class="btn btn-lime" data-action="discover.importRun"><i class="fa-solid fa-file-import"></i> Import</button>',
      onMount(root) {
        const f = root.querySelector('#import-file');
        if (!f) return;
        f.addEventListener('change', () => {
          const file = f.files && f.files[0];
          if (!file) return;
          const r = new FileReader();
          r.onload = () => {
            App.store.set('ui.importText', String(r.result), { silent: true });
            const box = root.querySelector('textarea');
            if (box) box.value = String(r.result);
            ui.toast('Loaded ' + file.name + ' — now press Import', 'lime');
          };
          r.readAsText(file);
        });
      }
    });
  });
  App.action('discover.importRun', () => {
    try {
      const text = App.store.get('ui.importText', '');
      if (!text.trim()) { ui.toast('Paste or pick a file first', 'amber'); return; }
      const typeKey = App.store.get('ui.importType', 'auto');
      const parsed = App.providers.importText(text, { typeKey: typeKey, source: 'import' });
      if (!parsed.leads.length) { ui.toast('No usable rows found — check the column names', 'red'); return; }
      const res = App.providers.ingest(parsed.leads, { refresh: false });
      const s = q();
      s.queue = App.store.get('leads', []).filter(l => l.source === 'import' && l.createdAt).map(l => l.id).slice(0, 500);
      s.note = res.added + ' rows imported · ' + res.skipped + ' duplicates skipped';
      ui.closeModal();
      ui.toast(res.added + ' businesses imported', 'lime');
      App.emit('state:changed', { path: 'import' });
    } catch (e) { ui.toast('Import failed: ' + e.message, 'red'); }
  });

  /* ------------------------------ lead actions ----------------------------- */
  App.action('lead-open', el => App.router.go('discover', el.getAttribute('data-arg')));
  App.openLead = openLead;
  App.action('lead.saveMeta', el => {
    const id = el.getAttribute('data-arg');
    App.store.patch('leads', id, {
      status: App.store.get('ui.leadStatus', 'new'),
      value: Number(App.store.get('ui.leadValue', 0)) || 0,
      nextFollowUp: App.store.get('ui.leadFollow', ''),
      tags: String(App.store.get('ui.leadTags', '')).split(',').map(t => t.trim()).filter(Boolean)
    });
    ui.toast('Saved', 'lime');
  });
  App.action('lead.addNote', el => {
    const id = el.getAttribute('data-arg');
    const box = document.getElementById('lead-note');
    const text = box ? box.value.trim() : '';
    if (!text) { ui.toast('Write a note first', 'amber'); return; }
    const lead = App.store.find('leads', id);
    App.store.patch('leads', id, { notes: [{ id: U.uid('note'), at: U.now(), text: text }].concat(lead.notes || []).slice(0, 60) });
    if (box) box.value = '';
    ui.toast('Note added', 'lime');
  });
  App.action('lead.skip', el => { App.store.patch('leads', el.getAttribute('data-arg'), { status: 'skipped' }); App.actions['lead.next'](el); });
  App.action('lead.reject', el => {
    const id = el.getAttribute('data-arg');
    const lead = App.store.find('leads', id);
    ui.confirm({
      title: 'Mark as rejected?', tone: 'danger', confirmLabel: 'Reject',
      message: lead.name + ' will move to the rejected list and stop receiving follow-ups until you change the status back.',
      onConfirm() {
        App.store.patch('leads', id, { status: 'rejected', nextFollowUp: '', clientId: lead.clientId || '' });
        App.log('reply-negative', lead.name + ' marked as rejected', id);
        ui.toast('Moved to rejected — loading the next business', 'amber');
        App.router.go('discover');
        setTimeout(() => App.actions['lead.next']({ getAttribute: () => id }), 350);
      }
    });
  });
  App.action('lead.next', el => {
    const id = el.getAttribute('data-arg');
    const next = App.msg.nextLead(id, l => ['won', 'lost', 'rejected'].indexOf(l.status) === -1);
    if (!next) { ui.toast('That was the last business in this list', 'amber'); return; }
    ui.closeDrawer();
    App.router.go('discover', next);
  });
  App.action('lead.reply', el => App.openReply(el.getAttribute('data-arg')));
  App.action('lead.toClient', el => {
    const id = el.getAttribute('data-arg');
    const lead = App.store.find('leads', id);
    const existing = App.store.findBy('clients', c => c.sourceLeadId === id);
    if (existing) { ui.toast('Already a client record', 'amber'); App.router.go('clients', existing.id); return; }
    const client = App.store.add('clients', {
      name: lead.name, type: 'company', stage: 'prospect', industry: lead.businessType,
      contactName: '', designation: '', phone: lead.phone,
      whatsapp: lead.whatsapp ? lead.phone : '', telegram: lead.telegram, email: lead.email,
      address: lead.address, website: lead.website, services: App.msg.recommend(lead).ids,
      accountManager: App.store.get('settings.company.senderName', ''), source: lead.source, sourceLeadId: lead.id,
      startedAt: '', endedAt: '', health: 'warm', tags: ['from-discovery'], notes: 'Created from discovery.'
    });
    App.store.patch('leads', id, { clientId: client.id, status: lead.status === 'rejected' ? 'rejected' : (lead.status === 'won' ? 'won' : 'proposal') });
    App.log('client', lead.name + ' added to the client list', client.id);
    ui.closeDrawer();
    ui.toast('Client record created', 'lime');
    App.router.go('clients', client.id);
  });
  App.action('lead.copyMsg', el => {
    const lead = App.store.find('leads', el.getAttribute('data-arg'));
    const tpl = App.msg.defaultTemplate(lead);
    U.copy(App.msg.render(tpl, lead).body).then(() => ui.toast('Message copied', 'lime'));
  });
  App.action('lead.sendOne', el => {
    const lead = App.store.find('leads', el.getAttribute('data-arg'));
    const channel = el.getAttribute('data-extra') || 'whatsapp';
    const tpl = App.msg.defaultTemplate(lead);
    const msgText = App.msg.render(tpl, lead).body;
    App.msg.send({ lead: lead, channel: channel, templateId: tpl.id, body: msgText }).then(r => {
      ui.toast(r.via === 'api' ? 'Sent automatically through your API' : 'Chat opened with the message ready — press send', 'lime');
      App.emit('state:changed', { path: 'sent' });
    });
  });
  App.action('lead.generate', el => siteModal(el.getAttribute('data-arg')));

  /* ------------------- Google record & one-tap contact --------------------- */
  App.action('discover.more', () => runSearch({ more: true }));
  App.action('discover.check', () => {
    App.router.go('settings');
    setTimeout(() => { if (App.actions['settings.checkSources']) App.actions['settings.checkSources']({}); }, 450);
  });
  App.action('lead.call', el => {
    const lead = App.store.find('leads', el.getAttribute('data-arg'));
    const href = U.telHref(lead);
    if (!href) { ui.toast('No phone number on this Google record', 'amber'); return; }
    App.log('note', 'Called ' + lead.name + ' (' + (lead.phone || '') + ')', lead.id);
    location.href = href;
  });
  App.action('lead.openWebsite', el => {
    const lead = App.store.find('leads', el.getAttribute('data-arg'));
    if (!lead || !lead.website) { ui.toast('No website on this business’s Google record', 'amber'); return; }
    U.openUrl(/^https?:/i.test(lead.website) ? lead.website : 'https://' + lead.website);
  });
  App.action('lead.googleRefresh', el => {
    const lead = App.store.find('leads', el.getAttribute('data-arg'));
    if (!lead) return;
    delete DETAILS[lead.id];
    loadDetails(lead, true);
  });
  App.action('lead.copyDetails', el => {
    const lead = App.store.find('leads', el.getAttribute('data-arg'));
    if (!lead) return;
    const lines = [
      lead.name + (lead.category ? ' — ' + lead.category : ''),
      'Phone: ' + (lead.phone || '—') + (lead.intlPhone && lead.intlPhone !== lead.phone ? ' / ' + lead.intlPhone : ''),
      'Website: ' + (lead.website || 'none on Google'),
      'Rating: ' + (lead.rating ? Number(lead.rating).toFixed(1) + '★ from ' + U.num(lead.reviews || 0) + ' reviews' : 'not rated'),
      'Address: ' + (lead.address || '—'),
      'Hours: ' + (lead.hoursWeek && lead.hoursWeek.length ? lead.hoursWeek.join(' | ') : (lead.hours || '—')),
      'Google Maps: ' + (lead.mapsUrl || '—'),
      'Place ID: ' + (lead.placeId || '—')
    ];
    if ((lead.reviewsList || []).length) {
      lines.push('', 'Recent reviews:');
      lead.reviewsList.slice(0, 2).forEach(r => lines.push('- ' + r.author + ' (' + r.rating + '★, ' + r.when + '): ' + r.text));
    }
    U.copy(lines.join('\n')).then(() => ui.toast('Full business record copied', 'lime'));
  });

  /* ------------------------- generator modal actions ----------------------- */
  App.action('gen.template', el => { App.router.q.gen.templateId = el.getAttribute('data-arg'); buildPreview(); refreshGenModal(); });
  App.action('gen.sample', el => {
    const g = App.router.q.gen;
    g.sampleId = el.getAttribute('data-arg');
    g.mode = 'sample';
    g.html = '';
    buildPreview();
    refreshGenModal();
  });
  App.action('gen.mode', el => {
    const g = App.router.q.gen;
    g.mode = el.getAttribute('data-arg');
    g.html = '';
    buildPreview();
    refreshGenModal();
  });
  App.action('gen.section', el => {
    const g = App.router.q.gen, key = el.getAttribute('data-arg');
    const i = g.sections.indexOf(key);
    if (i === -1) g.sections.push(key); else g.sections.splice(i, 1);
    buildPreview(); refreshGenModal();
  });
  App.action('gen.build', () => { buildPreview(); ui.toast('Preview regenerated', 'lime'); refreshGenModal(); });
  App.action('gen.open', () => {
    const g = App.router.q.gen;
    if (!g.html) buildPreview();
    U.openHTML(g.html, 'preview');
  });
  App.action('gen.download', () => {
    const g = App.router.q.gen;
    if (!g.html) buildPreview();
    const lead = App.store.find('leads', g.leadId);
    U.download(U.slug(lead.name) + '-website.html', g.html, 'text/html');
    ui.toast('HTML downloaded — upload it to any hosting', 'lime');
  });
  App.action('gen.copy', () => {
    const g = App.router.q.gen;
    if (!g.html) buildPreview();
    U.copy(g.html).then(() => ui.toast('Full HTML copied to clipboard', 'lime'));
  });
  App.action('gen.save', () => {
    const g = App.router.q.gen;
    const lead = App.store.find('leads', g.leadId);
    if (!lead) return;
    const res = App.sitegen.save(lead, g.templateId, { sections: g.sections, credit: g.credit, ai: g.ai });
    ui.closeModal();
    ui.toast('Draft saved to Websites & templates', 'lime');
    App.emit('state:changed', { path: 'sites' });
    App.router.go('sites', res.site.id);
  });
  App.action('gen.sendDemo', el => {
    const lead = App.store.find('leads', el.getAttribute('data-arg'));
    const g = App.router.q.gen;
    if (!g.html) buildPreview();
    App.sitegen.save(lead, g.templateId, { sections: g.sections, credit: g.credit, ai: g.ai });
    const tpl = App.msg.templates().filter(t => t.id === 'msg_wa_first_nowebsite')[0] || App.msg.templates()[0];
    const body = App.msg.render(tpl, lead).body + '\n\n(P.S. I attached the concept — I can also make it live on a free subdomain this week.)';
    App.msg.send({ lead: lead, channel: 'whatsapp', templateId: tpl.id, body: body }).then(() => {
      ui.toast('Demo message sent — the draft is saved in Websites', 'lime');
      App.emit('state:changed', { path: 'sent' });
    });
  });

  function refreshGenModal() {
    const g = App.router.q.gen;
    const box = document.getElementById('gen-preview');
    if (box) box.innerHTML = ui.previewFrame(g.html, 520);
    document.querySelectorAll('[data-action="gen.template"]').forEach(btn => {
      const on = btn.getAttribute('data-arg') === g.templateId;
      btn.className = 'w-full text-left glass-soft rounded-xl p-2.5 border ' + (on ? 'border-limeAccent' : 'border-transparent');
    });
    document.querySelectorAll('[data-action="gen.section"]').forEach(btn => {
      const on = g.sections.indexOf(btn.getAttribute('data-arg')) !== -1;
      btn.className = 'chip ' + (on ? 'is-on' : '');
    });
  }

  /* --------------------------- batch send session --------------------------- */
  App.action('discover.bulkSend', () => {
    const s = q();
    if (!s.selected.length) { ui.toast('Tick businesses with the checkbox first (or “Select all shown”)', 'amber'); return; }
    App.router.q.batch = { ids: s.selected.slice(), index: 0, templateId: '', sent: 0 };
    openBatch();
  });

  function openBatch() {
    const b = App.router.q.batch;
    if (!b || b.index >= b.ids.length) {
      ui.closeDrawer();
      ui.toast('Batch finished — ' + (b ? b.sent : 0) + ' messages sent', 'lime');
      App.router.q.batch = null;
      const s = q(); s.selected = [];
      App.emit('state:changed', { path: 'batch-done' });
      return;
    }
    const lead = App.store.find('leads', b.ids[b.index]);
    if (!lead) { b.index++; openBatch(); return; }
    const tpl = App.msg.template(b.templateId) || App.msg.defaultTemplate(lead);
    b.templateId = tpl.id;
    const rendered = App.msg.render(tpl, lead).body;
    const channels = App.msg.channelsFor(lead);
    ui.drawer({
      title: 'Batch send · ' + (b.index + 1) + ' of ' + b.ids.length,
      sub: 'One tap per business — the chat opens with the message already written',
      body:
        '<div class="mb-3 flex items-center gap-3">' + ui.avatar(lead.name, 'w-10 h-10 text-xs') +
        '<div><p class="text-[12px] font-bold">' + U.esc(lead.name) + '</p><p class="text-[10px] text-textMuted">' + U.esc(lead.category) + ' · ' + U.esc(lead.phone || 'no phone') + '</p></div></div>' +
        ui.field({ label: 'Template', model: 'ui.batchTemplate', value: tpl.id, options: App.msg.templates().map(t => [t.id, App.dict.chanLabel(t.channel) + ' · ' + t.name]) }) +
        ui.card('<textarea class="inp" id="batch-body" rows="12">' + U.esc(rendered) + '</textarea>', 'mt-3') +
        '<p class="text-[9px] text-textMuted mt-2">Sent from this batch: ' + b.sent + '. Missing phone numbers are skipped automatically.</p>',
      footer: '<button class="btn btn-ghost btn-sm" data-action="batch.stop">Stop</button>' +
        '<button class="btn btn-ghost btn-sm" data-action="batch.skip">Skip this one</button>' +
        channels.slice(0, 2).map(ch => '<button class="btn ' + (ch.key === 'whatsapp' ? 'btn-lime' : 'btn-ghost') + '" data-action="batch.send" data-extra="' + ch.key + '">' +
          App.dict.chanIcon(ch.key) + ' Send on ' + App.dict.chanLabel(ch.key) + '</button>').join('')
    });
  }

  App.action('batch.send', el => {
    const b = App.router.q.batch;
    const channel = el.getAttribute('data-extra') || 'whatsapp';
    const lead = App.store.find('leads', b.ids[b.index]);
    const box = document.getElementById('batch-body');
    const body = box ? box.value : '';
    const tpl = App.msg.template(App.store.get('ui.batchTemplate', b.templateId)) || App.msg.defaultTemplate(lead);
    App.msg.send({ lead: lead, channel: channel, templateId: tpl.id, body: body }).then(() => {
      b.sent++; b.index++;
      setTimeout(openBatch, 400);
    });
  });
  App.action('batch.skip', () => { const b = App.router.q.batch; b.index++; openBatch(); });
  App.action('batch.stop', () => { App.router.q.batch = null; ui.closeDrawer(); ui.toast('Batch stopped', 'amber'); });

  /* ------------------------- live refresh of the drawer --------------------- */
  App.on('state:changed', payload => {
    if (App.router.q.openLead && document.getElementById('drawer-root').innerHTML &&
      payload && ['discover', 'filter', 'select', 'selectAll'].indexOf(payload.path) === -1) {
      if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].indexOf(document.activeElement.tagName) !== -1) return;
      renderDrawer();
    }
  });
})(window);
