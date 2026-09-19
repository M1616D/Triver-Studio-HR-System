/* =============================================================================
   Triverse OS — Google Maps discovery
   One live source: Google Places API (New). Text Search brings the businesses
   for a business type + area; Place Details brings everything else the Maps
   record holds — phone, website, opening hours, photos and the actual reviews.
   Offline sources: businesses already saved, and a CSV/JSON scraper import.
   ========================================================================== */
(function (global) {
  'use strict';

  const App = global.App;
  const U = App.util;

  const PLACES_URL = 'https://places.googleapis.com/v1/';

  /* every field we read from Text Search */
  const SEARCH_FIELDS = [
    'places.id', 'places.displayName', 'places.formattedAddress', 'places.shortFormattedAddress',
    'places.location', 'places.rating', 'places.userRatingCount', 'places.websiteUri',
    'places.nationalPhoneNumber', 'places.internationalPhoneNumber',
    'places.primaryType', 'places.primaryTypeDisplayName', 'places.types',
    'places.priceLevel', 'places.businessStatus',
    'places.regularOpeningHours.openNow', 'places.currentOpeningHours.openNow', 'places.utcOffsetMinutes',
    'places.googleMapsUri', 'places.editorialSummary', 'places.photos',
    'places.addressComponents',
    'nextPageToken'
  ].join(',');

  /* the part of the record the deep-info panel cannot do without: enough to build a
     website and write a message even if Google retires one of the optional fields */
  const CORE_FIELDS = [
    'id', 'displayName', 'formattedAddress', 'location', 'rating', 'userRatingCount',
    'websiteUri', 'nationalPhoneNumber', 'internationalPhoneNumber', 'primaryTypeDisplayName',
    'types', 'priceLevel', 'businessStatus', 'googleMapsUri', 'editorialSummary',
    'photos', 'regularOpeningHours', 'addressComponents'
  ].join(',');

  /* everything the deep-info panel shows, straight from the business's own record */
  const DETAIL_FIELDS = [
    'id', 'displayName', 'formattedAddress', 'shortFormattedAddress', 'adrFormatAddress',
    'location', 'plusCode', 'rating', 'userRatingCount', 'websiteUri',
    'nationalPhoneNumber', 'internationalPhoneNumber', 'primaryType', 'primaryTypeDisplayName',
    'types', 'priceLevel', 'businessStatus', 'googleMapsUri', 'editorialSummary',
    'photos', 'reviews', 'regularOpeningHours', 'currentOpeningHours', 'utcOffsetMinutes',
    'addressComponents',
    /* Each service option is its own field on the Place resource. There is no
       composite “serviceOptions” path — asking for one fails the entire call,
       which is why the drawer once had no phone, website, hours or reviews. */
    'delivery', 'dineIn', 'takeout', 'reservable', 'curbsidePickup', 'paymentOptions'
  ].join(',');

  /* our business types → the Google Places type used to narrow a text search.
     Every value here was verified against the live API: Google answers
     INVALID_ARGUMENT — and returns nothing at all — for an unknown type, so a
     guessed type is worse than no type. “coffee_shop” deliberately falls
     through to the alias table below, where a café wins over a roastery. */
  const GOOGLE_TYPE = {
    restaurant: 'restaurant', cafe: 'cafe', fastfood: 'fast_food_restaurant',
    hotel: 'hotel', clinic: 'medical_clinic', dentist: 'dental_clinic', pharmacy: 'pharmacy',
    gym: 'gym', salon: 'beauty_salon', spa: 'spa', realestate: 'real_estate_agency',
    carrepair: 'car_repair', travel: 'travel_agency', tuition: 'educational_institution',
    school: 'school', boutique: 'clothing_store', electronics: 'electronics_store',
    furniture: 'furniture_store', grocery: 'supermarket', lawfirm: 'lawyer',
    accounting: 'accounting', logistics: 'courier_service', eventdecor: 'event_venue'
  };

  /* Types Google has no filter for. The words of the query carry them instead —
     there is no “photographer”, “printer” or “general_contractor” place type. */
  const SEARCH_WORDS = {
    construction: 'construction and interior contractor',
    photographer: 'photographer studio',
    printing: 'printing press',
    eventdecor: 'event decorator and wedding planner'
  };

  /* the two-letter CLDR region codes Google accepts (a country name is refused) */
  const REGIONS = ('ET KE DJ SO SD ER SS TZ UG RW BI EG LY TN DZ MA GH NG ZA CM CI SN ' +
    'AE SA QA KW BH OM YE JO LB IL TR IQ SY IR PK IN BD LK NP CN JP KR MY SG HK ID PH TH VN ' +
    'US CA MX BR GB IE FR DE NL BE ES PT IT CH AT SE NO DK FI IS PL CZ SK HU RO BG GR HR RS RU UA ' +
    'AU NZ').split(' ');

  const REGION_NAMES = {
    ethiopia: 'ET', kenya: 'KE', somalia: 'SO', djibouti: 'DJ', sudan: 'SD', eritrea: 'ER',
    'south sudan': 'SS', tanzania: 'TZ', uganda: 'UG', rwanda: 'RW', burundi: 'BI', egypt: 'EG',
    libya: 'LY', tunisia: 'TN', algeria: 'DZ', morocco: 'MA', ghana: 'GH', nigeria: 'NG',
    'south africa': 'ZA', 'united arab emirates': 'AE', dubai: 'AE', 'saudi arabia': 'SA',
    qatar: 'QA', kuwait: 'KW', bahrain: 'BH', oman: 'OM', yemen: 'YE', jordan: 'JO',
    lebanon: 'LB', israel: 'IL', turkey: 'TR', iraq: 'IQ', pakistan: 'PK', india: 'IN',
    bangladesh: 'BD', 'sri lanka': 'LK', nepal: 'NP', china: 'CN', japan: 'JP', malaysia: 'MY',
    singapore: 'SG', 'hong kong': 'HK', indonesia: 'ID', philippines: 'PH', thailand: 'TH',
    vietnam: 'VN', 'united states': 'US', usa: 'US', 'united states of america': 'US',
    canada: 'CA', mexico: 'MX', brazil: 'BR', 'united kingdom': 'GB', uk: 'GB', ireland: 'IE',
    france: 'FR', germany: 'DE', netherlands: 'NL', belgium: 'BE', spain: 'ES', portugal: 'PT',
    italy: 'IT', switzerland: 'CH', austria: 'AT', sweden: 'SE', norway: 'NO', denmark: 'DK',
    finland: 'FI', poland: 'PL', greece: 'GR', russia: 'RU', ukraine: 'UA', australia: 'AU',
    'new zealand': 'NZ',
    /* the shorthand owners actually type */
    eth: 'ET', abyssinia: 'ET', uae: 'AE', usa: 'US', 'u.s.a': 'US', uk: 'GB',
    'u.k': 'GB', ksa: 'SA', rsa: 'ZA'
  };

  const PRICE_LABEL = {
    PRICE_LEVEL_FREE: 'Free', PRICE_LEVEL_INEXPENSIVE: 'Br · budget', PRICE_LEVEL_MODERATE: 'Br Br · mid-range',
    PRICE_LEVEL_EXPENSIVE: 'Br Br Br · premium', PRICE_LEVEL_VERY_EXPENSIVE: 'Br Br Br Br · luxury'
  };

  const providers = App.providers = {

    /* ------------------------------------------------------------------ setup */
    key() { return String(App.store.get('settings.google.apiKey', '') || '').trim(); },
    hasKey() { return providers.key().length > 10; },

    /* ------------------------------------------------------------ text search */
    /** the businesses of a type in an area, from the Google Maps record itself */
    google(params) {
      params = params || {};
      const key = providers.key();
      const g = App.store.get('settings.google', {});
      if (!key) {
        return Promise.reject(new Error('No Google Places API key saved. Add one in Settings → Google Maps (the field is pre-filled with your studio key).'));
      }

      const typeKey = params.typeKey || '';
      const typeLabel = App.dict.typeOf(typeKey).label;
      const city = params.city || g.city || 'Addis Ababa';
      const free = String(params.query || '').trim();
      const words = SEARCH_WORDS[typeKey] || (typeLabel === 'Local Business' ? 'business' : typeLabel);
      const textQuery = params.textQuery ||
        (((free && free.toLowerCase() !== typeLabel.toLowerCase()) ? free : words) + ' in ' + city + ', Ethiopia');

      const body = {
        textQuery: textQuery,
        pageSize: U.clamp(Math.round(Number(params.pageSize || g.pageSize || 20)) || 20, 1, 20),
        languageCode: params.language || g.language || 'en'
      };
      const region = providers.regionCode();
      if (region) body.regionCode = region;
      if (params.pageToken) body.pageToken = params.pageToken;
      const gtype = GOOGLE_TYPE[typeKey];
      if (gtype && !params.noTypeFilter) body.includedType = gtype;
      /* bias the search around the chosen Addis Ababa area, so "dentist" means
         "dentist near Bole" rather than anywhere in the country */
      const area = params.areaKey ? App.dict.areaOf(params.areaKey) : null;
      const lat = Number((area && area.lat) || g.centerLat);
      const lng = Number((area && area.lng) || g.centerLng);
      const radius = U.clamp(Math.round(Number(g.radiusKm || 8) * 1000) || 8000, 500, 50000);
      if (params.useBias !== false && providers.validPoint(lat, lng)) {
        body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: radius } };
      }

      /* A search you have run before is answered from your own saved copy: no
         quota spent, no waiting, and it still works when Google is capped. */
      const cached = params.fresh ? null : providers.cacheGet(params);
      if (cached) {
        return Promise.resolve(Object.assign({}, cached, {
          provider: 'cache', fromCache: true, failed: false, nextPageToken: cached.nextPageToken || '',
          note: cached.leads.length + ' businesses — the same real Google Maps result you saved on ' +
            U.fmtDate(cached.at) + ', served from your own list at no cost to the daily allowance.'
        }));
      }

      const run = b => providers.call('places:searchText', { method: 'POST', body: b, fields: SEARCH_FIELDS });
      return run(body)
        .then(data => providers.finish(data, textQuery, typeKey, city, params, ''))
        .catch(err => {
          /* Google refused part of the request itself. Ask again with nothing but
             the search, so the screen shows real businesses instead of an error. */
          if (!providers.isBadRequest(err)) throw err;
          const lean = { textQuery: body.textQuery, pageSize: body.pageSize, languageCode: body.languageCode };
          return run(lean).then(data => providers.finish(data, textQuery, typeKey, city, params,
            'Google rejected part of the request, so the search ran without the extra filters.'));
        })
        .then(out => {
          if (!out.fromCache && out.leads.length) providers.cachePut(params, out);
          return out;
        });
    },

    /** Google's answer → the shape every screen reads */
    finish(data, textQuery, typeKey, city, params, warning) {
      const leads = (data.places || [])
        .filter(p => p.businessStatus !== 'CLOSED_PERMANENTLY')
        .map(p => providers.mapPlace(p, typeKey, city, params));
      const missing = leads.filter(l => !l.website).length;
      return {
        leads: leads,
        provider: 'google',
        nextPageToken: data.nextPageToken || '',
        warning: warning || '',
        note: leads.length + ' real businesses from Google Maps for “' + textQuery + '”' +
          (missing ? ' · ' + missing + ' have no website' : '') + (warning ? ' · ' + warning : '')
      };
    },

    /* ------------------------------------------------------ request safety */
    /** the Google type filter for one of our business types ('' = no filter) */
    typeFilter(typeKey) { return GOOGLE_TYPE[typeKey] || ''; },
    /** the words that carry a business type Google has no filter for */
    searchWords(typeKey) { return SEARCH_WORDS[typeKey] || ''; },

    /** Google accepts only a two-letter CLDR region code — “Ethiopia” is refused.
        A country name or a stray value is repaired and written back once. */
    regionCode(raw) {
      const saved = String(raw === undefined ? App.store.get('settings.google.region', 'et') : (raw || 'et')).trim();
      const letters = saved.replace(/[^a-zA-Z]/g, '');
      let code = '';
      if (letters.length === 2 && REGIONS.indexOf(letters.toUpperCase()) !== -1) code = letters.toUpperCase();
      else code = REGION_NAMES[saved.toLowerCase()] || REGION_NAMES[letters.toLowerCase()] || '';
      if (raw === undefined && code && code.toLowerCase() !== saved.toLowerCase()) {
        App.store.set('settings.google.region', code.toLowerCase(), { silent: true });
        App.store.save();
      }
      return code;
    },

    /** a map point Google will accept as a search bias */
    validPoint(lat, lng) {
      const a = Number(lat), b = Number(lng);
      if (!isFinite(a) || !isFinite(b)) return false;
      if (!a || !b) return false;                 /* 0,0 is open ocean — never a bias */
      return a > -90 && a < 90 && b > -180 && b < 180;
    },

    /** Google refused the request itself, rather than the key */
    isBadRequest(err) { return Boolean(err && err.google && err.google.status === 400); },

    /* ------------------------------------------------------- quota safety */
    /**
     * Google allows only so many searches a day on a project. Counting them means
     * the owner sees the wall coming instead of hitting it mid-campaign.
     */
    countUsage(endpoint) {
      const today = U.todayISO();
      const saved = App.store.get('google.usage', {}) || {};
      const day = saved.day === today ? saved : { day: today, searches: 0, records: 0 };
      if (endpoint === 'places:searchText') day.searches = (day.searches || 0) + 1;
      else day.records = (day.records || 0) + 1;
      App.store.set('google.usage', day, { silent: true });
      App.store.save();
      return day;
    },

    /** remember a quota refusal, so the app does not silently retry into the wall */
    noteQuota(data) {
      const meta = providers.errorMetadata(data) || {};
      const perDay = String(meta.quota_unit || '').indexOf('/d/') !== -1 || /per day/i.test(String(meta.quota_limit || ''));
      App.store.set('google.quota', {
        at: U.now(), day: U.todayISO(), limit: Number(meta.quota_limit_value || 0) || 0,
        perDay: perDay, metric: String(meta.quota_metric || ''),
        /* the wall lifts when Google resets it (midnight Pacific), not at local
           midnight — storing the instant means the banner disappears by itself */
        resetAt: perDay ? new Date(nextPacificMidnight()).toISOString() : ''
      }, { silent: true });
      App.store.save();
    },

    /** the quota wall, while it is still up */
    quotaBlocked() {
      const q = App.store.get('google.quota', null);
      if (!q || !q.perDay) return null;
      const until = q.resetAt ? new Date(q.resetAt).getTime() : 0;
      if (!until || Date.now() >= until) return null;
      return q;
    },

    /** "6 h 20 m" — how long the wall still stands */
    quotaWait() {
      const q = providers.quotaBlocked();
      if (!q) return '';
      const mins = Math.max(1, Math.round((new Date(q.resetAt).getTime() - Date.now()) / 60000));
      if (mins < 60) return mins + ' minutes';
      const h = Math.floor(mins / 60), m = mins % 60;
      return h + ' h' + (m ? ' ' + m + ' m' : '');
    },

    /** one honest sentence about the wall, for a banner */
    quotaNote() {
      const q = providers.quotaBlocked();
      if (!q) return '';
      return 'Google\u2019s daily search allowance for this project' + (q.limit ? ' (' + q.limit + ' searches a day)' : '') +
        ' is spent. It comes back in about ' + providers.quotaWait() + '.\n\n' +
        'Nothing else is affected: every list you have already searched opens instantly from your own saved results, and opening a business, building its website, sending the message and taking payment all keep working.';
    },

    /* ------------------------------------------------------- search cache
       The practical answer to a daily cap: a search you have run once is kept, so
       running it again — today, next week, with the internet off — costs nothing.
       Search volume that the owner actually re-uses therefore never touches
       Google at all, which is what makes the screen feel unlimited. */
    CACHE_KEY: 'google.cache',
    CACHE_MAX: 150,

    cacheSig(params) {
      params = params || {};
      const g = App.store.get('settings.google', {});
      const area = params.areaKey || '';
      return [
        String(params.typeKey || ''), String(params.query || '').toLowerCase().trim(),
        String(params.city || g.city || '').toLowerCase(), area,
        String(params.radiusKm || g.radiusKm || 8), String(params.pageSize || g.pageSize || 20),
        String(params.pageToken || '')
      ].join('|');
    },

    cacheAll() {
      const c = App.store.get('google.cache', null);
      return c && typeof c === 'object' && c.sets ? c : { sets: {}, order: [] };
    },

    cacheGet(params) {
      const c = providers.cacheAll();
      const hit = c.sets[providers.cacheSig(params)];
      return hit && hit.leads && hit.leads.length ? hit : null;
    },

    /** keep the newest CACHE_MAX searches; older ones are dropped */
    cachePut(params, out) {
      if (!out || !out.leads || !out.leads.length) return;
      const sig = providers.cacheSig(params);
      const c = providers.cacheAll();
      c.sets[sig] = { at: U.now(), textQuery: out.textQuery || '', note: out.note || '', nextPageToken: out.nextPageToken || '', leads: out.leads };
      c.order = U.uniq([sig].concat(c.order || []));
      while (c.order.length > providers.CACHE_MAX) delete c.sets[c.order.pop()];
      App.store.set(providers.CACHE_KEY, c, { silent: true });
      App.store.save();
    },

    cacheCount() { const c = providers.cacheAll(); return (c.order || []).length; },

    cacheClear() {
      App.store.set(providers.CACHE_KEY, { sets: {}, order: [] }, { silent: true });
      App.store.save();
    },

    errorMetadata(data) {
      const details = ((data && data.error && data.error.details) || []);
      for (let i = 0; i < details.length; i++) {
        if (details[i] && details[i].metadata) return details[i].metadata;
      }
      return null;
    },

    /**
     * Why a business shows its phone, website and hours but no reviews or photos:
     * Google withholds its Atmosphere data (review text, photos, its own
     * description) from projects that cannot use the Enterprise SKUs.
     */
    atmosphereHelp(lead) {
      const ratings = U.num((lead && lead.reviews) || 0);
      return 'Google lists ' + ratings + ' ratings for this business but released no review text and no photos.\n\n' +
        'Those three come from Google’s Enterprise “Atmosphere” data (reviews, photos and its own business description), ' +
        'which needs billing switched on for the project that owns the key. Everything else — phone, website, opening hours, ' +
        'address, price level and the pin map — is already real and working.\n\n' +
        'To unlock it: Google Cloud → Billing → link a billing account to the project ' +
        '(https://console.cloud.google.com/billing/linkedaccount), then press Refresh from Google.';
    },

    /** the same fact, said in one short line for tight spaces */
    atmosphereNote() {
      return 'Google released no review text or photos to this project — that is its Enterprise “Atmosphere” data. ' +
        'Phone, website, hours and address are all real. Link billing on the project to unlock reviews and photos.';
    },

    /** one thin wrapper so every Google call shares the error translation */
    call(endpoint, opts) {
      opts = opts || {};
      const key = providers.key();
      const headers = { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key };
      const isSearch = endpoint === 'places:searchText';
      headers['X-Goog-FieldMask'] = opts.fields || (isSearch ? SEARCH_FIELDS : DETAIL_FIELDS);
      const url = PLACES_URL + endpoint + (isSearch ? '' : '?languageCode=en');
      return fetch(url, {
        method: opts.method || 'GET',
        headers: headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined
      }).then(res => res.json().then(data => ({ res: res, data: data })))
        .then(r => {
          if (!r.res.ok) {
            const err = (r.data && r.data.error) || {};
            if (r.res.status === 429) providers.noteQuota(r.data);
            const hint = providers.hintFor(r.res.status, r.data);
            const e = new Error(hint || ('Google Places: ' + (err.message || ('HTTP ' + r.res.status))));
            /* the machine-readable part is kept so the caller can tell a request
               problem (retryable without the extras) from a key problem */
            e.google = { status: r.res.status, message: String(err.message || ''), violation: providers.violationOf(r.data) };
            throw e;
          }
          providers.countUsage(endpoint);
          return r.data;
        });
    },

    /** every field of one business: reviews, hours, phone, website, photos */
    details(placeId, opts) {
      opts = opts || {};
      const id = String(placeId || '').replace(/^places\//, '');
      if (!id) return Promise.reject(new Error('This business has no Google place ID, so there is nothing more to fetch.'));
      if (!providers.hasKey()) return Promise.reject(new Error('Add your Google Places API key in Settings → Google Maps to load the full record.'));
      const path = 'places/' + encodeURIComponent(id);
      const load = fields => providers.call(path, { method: 'GET', fields: fields });
      return load(DETAIL_FIELDS)
        .catch(err => {
          /* a single unsupported field rejects the whole call, so fall back to the
             core record rather than losing phone, website and reviews entirely */
          if (!providers.isBadRequest(err)) throw err;
          return load(CORE_FIELDS);
        })
        .then(d => {
          if (opts.apply !== false) providers.applyDetails(id, d);
          return providers.normaliseDetails(d);
        });
    },

    /** write a Google record onto the saved business so it is never fetched twice */
    applyDetails(placeId, d) {
      const lead = App.store.findBy('leads', l => l.placeId === placeId || l.placeId === 'places/' + placeId);
      if (!lead) return null;
      const n = providers.normaliseDetails(d);
      const patch = {
        rating: n.rating || lead.rating,
        reviews: n.reviews || lead.reviews,
        website: n.website || lead.website,
        phone: n.nationalPhone || lead.phone,
        intlPhone: n.intlPhone || lead.intlPhone,
        whatsapp: Boolean(n.intlPhone || n.nationalPhone || lead.intlPhone || lead.phone),
        hours: n.hoursLine || lead.hours,
        openNow: n.openNow,
        hoursWeek: n.hoursWeek.length ? n.hoursWeek : (lead.hoursWeek || []),
        photos: n.photos.length ? n.photos : (lead.photos || []),
        reviewsList: n.reviewsList.length ? n.reviewsList : (lead.reviewsList || []),
        summary: n.summary || lead.summary,
        mapsUrl: n.mapsUrl || lead.mapsUrl,
        lat: n.lat || lead.lat,
        lng: n.lng || lead.lng,
        address: n.address || lead.address,
        category: n.categoryLabel || lead.category,
        types: n.types.length ? n.types : (lead.types || []),
        priceLevelLabel: n.priceLevelLabel || lead.priceLevelLabel || '',
        serviceOptions: n.serviceOptions || lead.serviceOptions || {},
        detailsAt: U.now(),
        detailsError: '',
        atmosphereBlocked: n.atmosphereBlocked
      };
      const tags = (lead.tags || []).filter(t => ['no-website', 'has-website', 'whatsapp', 'high-rated', 'busy', 'open-now', 'has-reviews'].indexOf(t) === -1);
      if (!patch.website) tags.push('no-website'); else tags.push('has-website');
      if (patch.whatsapp) tags.push('whatsapp');
      if (patch.rating >= 4.5) tags.push('high-rated');
      if (patch.reviews >= 300) tags.push('busy');
      if (patch.openNow) tags.push('open-now');
      if (patch.reviewsList.length) tags.push('has-reviews');
      patch.tags = U.uniq(tags);
      return App.store.patch('leads', lead.id, patch);
    },

    /** Google's payload → the flat shape the screens use */
    normaliseDetails(d) {
      d = d || {};
      const hours = d.regularOpeningHours || d.currentOpeningHours || {};
      const openNow = typeof hours.openNow === 'boolean' ? hours.openNow : null;
      const photos = (d.photos || []).slice(0, 8).map(p => p.name).filter(Boolean);
      const reviewsList = (d.reviews || []).slice(0, 8).map(r => ({
        author: (r.authorAttribution && r.authorAttribution.displayName) || 'Google user',
        authorPhoto: (r.authorAttribution && r.authorAttribution.photoUri) || '',
        authorUrl: (r.authorAttribution && r.authorAttribution.uri) || '',
        rating: Number(r.rating) || 0,
        when: r.relativePublishTimeDescription || '',
        at: r.publishTime || '',
        text: (r.text && r.text.text) || (typeof r.originalText === 'string' ? r.originalText : '') || '',
        mapsUrl: r.googleMapsUri || ''
      }));
      /* Google has no composite serviceOptions field: each option stands alone */
      const so = { delivery: d.delivery, takeout: d.takeout, dineIn: d.dineIn, reservable: d.reservable, curbsidePickup: d.curbsidePickup };
      return {
        placeId: d.id || '',
        name: (d.displayName && d.displayName.text) || '',
        address: d.formattedAddress || '',
        shortAddress: d.shortFormattedAddress || '',
        adrAddress: d.adrFormatAddress || '',
        lat: (d.location && d.location.latitude) || 0,
        lng: (d.location && d.location.longitude) || 0,
        rating: Number(d.rating) || 0,
        reviews: Number(d.userRatingCount) || 0,
        website: d.websiteUri || '',
        nationalPhone: d.nationalPhoneNumber || '',
        intlPhone: d.internationalPhoneNumber || '',
        categoryLabel: (d.primaryTypeDisplayName && d.primaryTypeDisplayName.text) || '',
        types: d.types || [],
        priceLevelLabel: PRICE_LABEL[d.priceLevel] || '',
        businessStatus: d.businessStatus || '',
        mapsUrl: d.googleMapsUri || '',
        summary: (d.editorialSummary && d.editorialSummary.text) || '',
        openNow: openNow,
        hoursWeek: hours.weekdayDescriptions || [],
        hoursLine: providers.hoursLine(hours),
        photos: photos,
        reviewsList: reviewsList,
        /* Google serves photos, review text and its own description from the
           Enterprise “Atmosphere” SKUs. When the project cannot use them Google
           answers 200 and simply leaves them out — detect that instead of showing
           an empty reviews section forever. */
        atmosphere: (photos.length > 0 || reviewsList.length > 0),
        atmosphereBlocked: (!photos.length && !reviewsList.length && Number(d.userRatingCount) > 0),
        serviceOptions: {
          delivery: so.delivery === true, takeout: so.takeout === true,
          dineIn: so.dineIn === true, reservable: so.reservable === true,
          curbsidePickup: so.curbsidePickup === true
        },
        plusCode: (d.plusCode && d.plusCode.globalCode) || ''
      };
    },

    hoursLine(hours) {
      if (!hours) return '';
      const open = hours.openNow === true ? 'Open now' : (hours.openNow === false ? 'Closed now' : '');
      const next = hours.nextCloseTime ? new Date(hours.nextCloseTime) : null;
      const opens = hours.nextOpenTime ? new Date(hours.nextOpenTime) : null;
      const clock = dt => isNaN(dt) ? '' : dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      if (open && next && open === 'Open now') return open + ' · closes ' + clock(next);
      if (open === 'Closed now' && opens) return open + ' · opens ' + clock(opens);
      return open;
    },

    /* ---------------------------------------------------------------- mapping */
    /** map one Text Search result into our business shape */
    mapPlace(p, wantedType, city, params) {
      const typeKey = providers.detectType(p, wantedType);
      const t = App.dict.typeOf(typeKey);
      const loc = p.location || {};
      const hours = p.regularOpeningHours || p.currentOpeningHours || {};
      const phone = p.nationalPhoneNumber || '';
      const intl = p.internationalPhoneNumber || '';
      const area = (params && params.areaKey && App.dict.areaOf(params.areaKey)) || null;
      const centre = area ? { lat: area.lat, lng: area.lng } : {
        lat: Number(App.store.get('settings.google.centerLat', 9.0192)),
        lng: Number(App.store.get('settings.google.centerLng', 38.7525))
      };
      const dist = (loc.latitude && centre.lat) ? haversine(centre.lat, centre.lng, Number(loc.latitude), Number(loc.longitude)) : 0;
      const detected = providers.areaFromComponents(p.addressComponents) || area;

      const lead = {
        source: 'google',
        placeId: p.id || '',
        name: (p.displayName && p.displayName.text) || 'Unnamed business',
        businessType: typeKey,
        category: (p.primaryTypeDisplayName && p.primaryTypeDisplayName.text) || t.label,
        types: p.types || [],
        address: p.formattedAddress || '',
        shortAddress: p.shortFormattedAddress || '',
        area: detected && detected.key ? detected.key : '',
        areaLabel: detected && detected.label ? detected.label : (city || 'Addis Ababa'),
        subCity: detected && detected.subCity ? detected.subCity : '',
        city: city || 'Addis Ababa',
        country: 'Ethiopia',
        lat: loc.latitude || 0,
        lng: loc.longitude || 0,
        dist: Math.round(dist * 10) / 10,
        phone: phone,
        intlPhone: intl,
        whatsapp: Boolean(intl || phone),
        telegram: '',
        email: '',
        website: p.websiteUri || '',
        socials: {},
        rating: p.rating || 0,
        reviews: p.userRatingCount || 0,
        priceLevelLabel: PRICE_LABEL[p.priceLevel] || '',
        photoName: (p.photos && p.photos[0] && p.photos[0].name) || '',
        photos: (p.photos || []).slice(0, 8).map(x => x.name).filter(Boolean),
        openNow: typeof hours.openNow === 'boolean' ? hours.openNow : null,
        hours: hours.openNow === true ? 'Open now' : (hours.openNow === false ? 'Closed now' : ''),
        hoursWeek: [],
        reviewsList: [],
        mapsUrl: p.googleMapsUri || ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent((p.displayName && p.displayName.text) || '')),
        claimed: true,
        status: 'new',
        value: t.avgValue,
        tags: [], notes: [], outreach: [], reply: null, clientId: '', nextFollowUp: '',
        summary: (p.editorialSummary && p.editorialSummary.text) || '',
        atmosphereBlocked: false,
        fetchedAt: U.now()
      };
      if (!lead.website) lead.tags.push('no-website'); else lead.tags.push('has-website');
      if (lead.whatsapp) lead.tags.push('whatsapp');
      if (lead.rating >= 4.5) lead.tags.push('high-rated');
      if (lead.reviews >= 300) lead.tags.push('busy');
      if (lead.openNow) lead.tags.push('open-now');
      return lead;
    },

    /** Google's address components → one of our Addis Ababa areas */
    areaFromComponents(components) {
      if (!components || !components.length) return null;
      const pick = type => {
        const hit = components.filter(c => (c.types || []).indexOf(type) !== -1)[0];
        return hit ? ((hit.shortText || hit.longText) || '') : '';
      };
      const sub = pick('sublocality_level_1') || pick('sublocality') || pick('neighborhood') || pick('administrative_area_level_3');
      const city = pick('locality');
      const found = App.dict.findArea(sub) || App.dict.findArea(city);
      if (found) return found;
      if (sub) return { key: '', label: sub, lat: 0, lng: 0, subCity: sub };
      return null;
    },

    /** guess the closest business-type preset from Google's type list */
    detectType(p, wantedType) {
      if (wantedType && wantedType !== 'auto') return wantedType;
      const hay = []
        .concat(p.types || [])
        .concat([p.primaryType || '', (p.primaryTypeDisplayName && p.primaryTypeDisplayName.text) || ''])
        .join(' ').toLowerCase();
      let best = '', bestLen = 0;
      Object.keys(GOOGLE_TYPE).forEach(k => {
        if (hay.indexOf(GOOGLE_TYPE[k]) !== -1 && GOOGLE_TYPE[k].length > bestLen) { best = k; bestLen = GOOGLE_TYPE[k].length; }
      });
      if (best) return best;
      /* no exact Google type matched, so use our own keyword table (declaration order
         is the priority order: a “coffee_shop” is a café before it is a roastery) */
      const alias = {
        restaurant: ['restaurant', 'food', 'diner', 'eatery'], cafe: ['cafe', 'coffee', 'bakery'], coffee: ['coffee_shop', 'roastery', 'coffee'],
        fastfood: ['fast_food', 'burger', 'pizza', 'fried', 'takeaway', 'sandwich'],
        hotel: ['hotel', 'lodging', 'guest_house', 'resort'], clinic: ['clinic', 'hospital', 'doctor', 'medical', 'diagnostic'],
        dentist: ['dentist', 'dental', 'orthodont'], pharmacy: ['pharmacy', 'drugstore', 'chemist'], gym: ['gym', 'fitness', 'yoga', 'sport'],
        salon: ['salon', 'hair', 'beauty', 'parlour', 'barber'], spa: ['spa', 'massage', 'wellness'], realestate: ['real_estate', 'property', 'realtor'],
        carrepair: ['car_repair', 'auto_repair', 'mechanic', 'workshop'], travel: ['travel', 'tour', 'agency'], tuition: ['school', 'coaching', 'tutor', 'academy', 'education', 'university'],
        boutique: ['clothing', 'boutique', 'fashion', 'apparel', 'tailor'], electronics: ['electronics', 'mobile', 'computer', 'phone_store'],
        grocery: ['grocery', 'supermarket', 'convenience', 'market'], construction: ['construction', 'contractor', 'interior', 'builder', 'architect'],
        lawfirm: ['lawyer', 'law_firm', 'legal'], accounting: ['accounting', 'tax', 'bookkeeping', 'audit'],
        photographer: ['photograph', 'studio_portrait'], eventdecor: ['event', 'wedding', 'decor', 'caterer', 'banquet'],
        logistics: ['courier', 'logistic', 'freight', 'shipping', 'transport'], printing: ['print', 'copy', 'stationery']
      };
      const keys = Object.keys(alias);
      for (let i = 0; i < keys.length; i++) {
        if (alias[keys[i]].some(w => hay.indexOf(w) !== -1)) return keys[i];
      }
      return 'general';
    },

    /* ---------------------------------------------------------------- photos */
    /** the real Google photo of a business, ready for an <img> */
    photoUrl(leadOrName, width) {
      const name = typeof leadOrName === 'string'
        ? leadOrName
        : (leadOrName && (leadOrName.photoName || (leadOrName.photos || [])[0]));
      const key = providers.key();
      if (!key || !name) return '';
      return PLACES_URL + name + '/media?maxWidthPx=' + (width || 400) + '&key=' + encodeURIComponent(key);
    },
    photoUrls(lead, width, max) {
      const names = (lead && lead.photos && lead.photos.length) ? lead.photos : (lead && lead.photoName ? [lead.photoName] : []);
      return names.slice(0, max || 6).map(n => providers.photoUrl(n, width));
    },

    /* ----------------------------------------------------------------- saved */
    /** businesses already in your list (the offline, always-working source) */
    saved(params) {
      params = params || {};
      const q = String(params.query || '').toLowerCase().trim();
      const typeKey = params.typeKey || '';
      const areaKey = params.areaKey || '';
      const seen = {};
      const scored = App.store.get('leads', []).filter(l => {
        if (seen[l.id] || l.status === 'skipped') return false;
        seen[l.id] = 1;
        return true;
      }).map(l => {
        let score = 1;
        if (typeKey && l.businessType === typeKey) score += 10;
        if (areaKey && areaKey !== 'addis-ababa' && l.area === areaKey) score += 8;
        if (q && q !== App.dict.typeLabel(typeKey).toLowerCase()) {
          if (U.hit(l.name, q)) score += 8;
          if (U.hit(l.category, q)) score += 5;
          if (U.hit(l.address, q)) score += 3;
        }
        return { lead: l, score: score };
      });
      const leads = U.sortBy(scored, x => x.score, 'desc').map(x => x.lead);
      return Promise.resolve({
        leads: leads, provider: 'saved',
        note: leads.length + ' businesses already in your list'
      });
    },

    /* ---------------------------------------------------------------- search */
    /**
     * What every screen calls. Google Maps is the source; on a failure the note
     * says exactly why, and your own saved businesses are shown instead so the
     * screen is never empty and never invented.
     */
    search(params) {
      params = params || {};
      const fallback = reason => providers.saved(params).then(out => {
        out.note = reason + (out.leads.length ? ' Showing the ' + out.leads.length + ' businesses already in your list.' : '');
        out.failed = true;
        return out;
      });
      return providers.google(params).then(out => {
        if (out.leads.length) return out;
        return fallback('Google Maps knows no business for that search in this area.');
      }).catch(err => fallback(err.message));
    },

    /* ---------------------------------------------------------------- import */
    /** accepts CSV text or a JSON array; maps the usual scraper column names */
    importText(text, opts) {
      opts = opts || {};
      let rows = [];
      const trimmed = String(text || '').trim();
      if (!trimmed) return { leads: [], note: 'Nothing to import' };
      if (trimmed[0] === '[' || trimmed[0] === '{') {
        const parsed = JSON.parse(trimmed);
        rows = Array.isArray(parsed) ? parsed : (parsed.leads || parsed.data || parsed.places || []);
      } else {
        rows = U.csv(trimmed);
      }
      const get = (row, names) => {
        const keys = Object.keys(row);
        for (let i = 0; i < names.length; i++) {
          const hit = keys.filter(k => U.slug(k).replace(/-/g, '') === U.slug(names[i]).replace(/-/g, ''));
          if (hit.length && String(row[hit[0]] || '').trim()) return String(row[hit[0]]).trim();
        }
        return '';
      };
      const leads = rows.map(row => {
        const typeKey = opts.typeKey && opts.typeKey !== 'auto' ? opts.typeKey
          : providers.detectType({ types: [get(row, ['category', 'type', 'business_type', 'primary_type'])], primaryTypeDisplayName: { text: get(row, ['category', 'type']) } }, 'auto');
        const t = App.dict.typeOf(typeKey);
        const phone = get(row, ['phone', 'phone_number', 'national_phone_number', 'mobile', 'contact_number', 'telephone']);
        const intl = get(row, ['international_phone_number', 'intl_phone', 'phone_international']) || phone;
        const website = get(row, ['website', 'site', 'website_uri', 'web', 'url']);
        const reviews = Number(get(row, ['reviews', 'reviews_count', 'user_rating_count', 'review_count']) || 0) || 0;
        const rating = Number(get(row, ['rating', 'average_rating', 'stars']) || 0) || 0;
        const areaText = get(row, ['area', 'suburb', 'neighbourhood', 'sub_city']);
        const area = App.dict.findArea(areaText);
        const lead = {
          source: opts.source || 'import',
          placeId: get(row, ['place_id', 'google_id', 'cid', 'id']) || '',
          name: get(row, ['name', 'title', 'business_name', 'business', 'display_name']) || 'Unnamed business',
          businessType: typeKey,
          category: get(row, ['category', 'type', 'primary_type', 'primary_type_display_name']) || t.label,
          types: [typeKey],
          address: get(row, ['address', 'full_address', 'formatted_address', 'street', 'location']) || '',
          area: area ? area.key : '',
          areaLabel: area ? area.label : areaText,
          city: get(row, ['city', 'town', 'area']) || (opts.city || 'Addis Ababa'),
          country: 'Ethiopia',
          lat: Number(get(row, ['latitude', 'lat']) || 0) || 0,
          lng: Number(get(row, ['longitude', 'lng', 'lon']) || 0) || 0,
          dist: 0,
          phone: phone,
          intlPhone: intl,
          whatsapp: Boolean(phone),
          telegram: get(row, ['telegram', 'telegram_username']) || '',
          email: get(row, ['email', 'emails', 'email_address']) || '',
          website: website,
          socials: {
            facebook: get(row, ['facebook', 'facebook_url', 'fb']) || '',
            instagram: get(row, ['instagram', 'instagram_url', 'insta']) || ''
          },
          rating: rating,
          reviews: reviews,
          priceLevelLabel: get(row, ['price_level', 'price_range']) || '',
          hours: get(row, ['hours', 'opening_hours', 'working_hours']) || '',
          rowsAvailable: true,
          mapsUrl: get(row, ['google_maps_url', 'maps_url', 'link', 'url_maps', 'google_url']) || '',
          claimed: true,
          status: 'new',
          value: t.avgValue,
          tags: [], notes: [], outreach: [], reply: null, clientId: '', nextFollowUp: '',
          summary: get(row, ['description', 'summary', 'editorial_summary']) || '',
          fetchedAt: U.now()
        };
        if (!lead.website) lead.tags.push('no-website'); else lead.tags.push('has-website');
        if (lead.whatsapp) lead.tags.push('whatsapp');
        if (lead.rating >= 4.5) lead.tags.push('high-rated');
        if (lead.area) lead.tags.push(lead.area);
        return lead;
      }).filter(l => l.name && l.name !== 'Unnamed business');

      return { leads: leads, note: leads.length + ' rows parsed from ' + (opts.fileName || 'the pasted text') };
    },

    /** merge discovered businesses into the store, skipping duplicates */
    ingest(newLeads, opts) {
      opts = opts || {};
      const existing = App.store.get('leads', []);
      const key = l => (l.placeId ? 'p:' + l.placeId : 'n:' + U.slug(l.name) + '|' + U.slug(l.address || '').slice(0, 24));
      const seen = {};
      existing.forEach(l => { seen[key(l)] = l; });
      let added = 0, skipped = 0, refreshed = 0;
      const batch = [];
      (newLeads || []).forEach(l => {
        const k = key(l);
        if (seen[k]) {
          if (opts.refresh) {
            Object.assign(seen[k], {
              rating: l.rating || seen[k].rating, reviews: l.reviews || seen[k].reviews,
              website: l.website || seen[k].website, phone: l.phone || seen[k].phone,
              intlPhone: l.intlPhone || seen[k].intlPhone,
              hours: l.hours || seen[k].hours, openNow: (l.openNow === null || l.openNow === undefined) ? seen[k].openNow : l.openNow,
              photos: (l.photos && l.photos.length) ? l.photos : seen[k].photos,
              mapsUrl: l.mapsUrl || seen[k].mapsUrl, updatedAt: U.now()
            });
            refreshed++;
          } else skipped++;
          return;
        }
        const saved = Object.assign({ id: U.uid('lead'), createdAt: U.now(), updatedAt: U.now() }, l);
        seen[k] = saved; batch.push(saved); added++;
      });
      if (batch.length) App.store.set('leads', batch.concat(existing), { silent: true });
      App.store.save();
      if (added) App.log('lead', added + ' businesses added from Google Maps' + (skipped ? ' · ' + skipped + ' duplicates skipped' : ''), '');
      App.emit('state:changed', { path: 'leads' });
      return { added: added, skipped: skipped, refreshed: refreshed };
    }
  };

  /* ----------------------------------------------------------------------------
     Quota resets happen at midnight Pacific Time, not at local midnight. Working
     out that instant is what stops the "limit used up" banner from lingering into
     the owner's next working day.
     ------------------------------------------------------------------------- */
  function pacificOffsetMinutes(when) {
    try {
      const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles', hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      const p = {};
      dtf.formatToParts(when).forEach(x => { p[x.type] = x.value; });
      const asUTC = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute), Number(p.second));
      return (asUTC - when.getTime()) / 60000;
    } catch (e) { return -480; }
  }

  function nextPacificMidnight(from) {
    const d = from ? new Date(from) : new Date();
    const off = pacificOffsetMinutes(d);
    const wall = new Date(d.getTime() + off * 60000);
    const nextWall = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate() + 1, 0, 0, 0);
    return nextWall - off * 60000;
  }

  function haversine(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /** the field Google says it cannot match, straight out of its own payload */
  providers.violationOf = function (data) {
    const details = ((data && data.error && data.error.details) || []);
    for (let i = 0; i < details.length; i++) {
      const v = details[i] && details[i].fieldViolations;
      if (v && v.length && (v[0].description || v[0].field)) {
        return { field: String(v[0].field || ''), why: String(v[0].description || '') };
      }
    }
    return null;
  };

  /**
   * Turn a Google error into something the studio owner can act on. Google's own
   * sentence is always quoted — it names the exact field it disliked, which is the
   * single most useful thing in the whole response.
   */
  providers.hintFor = function (status, data) {
    const err = (data && data.error) || {};
    const raw = String(err.message || '');
    const detail = err.status || err.status_code || '';
    const violation = providers.violationOf(data);
    const reason = (function () {
      const d = err.details || [];
      for (let i = 0; i < d.length; i++) if (d[i] && d[i].reason) return d[i].reason;
      return '';
    })();
    const project = (raw.match(/project[^0-9]{0,24}(\d{6,})/i) || [])[1];
    const enable = (function () {
      const m = raw.match(/https?:\/\/[^\s"']*console[^\s"']*/);
      if (m) return m[0].replace(/[.,]$/, '');
      return project
        ? 'https://console.cloud.google.com/apis/api/places.googleapis.com/overview?project=' + project
        : 'https://console.cloud.google.com/apis/library/places.googleapis.com';
    })();
    const fix = '\n\nWhat to do (about a minute):\n' +
      '1. Open ' + enable + ' and press Enable for “Places API (New)”.\n' +
      '2. Google Cloud → APIs & Services → Credentials → your key: Application restrictions = None, and Places API (New) allowed.\n' +
      '3. Billing must be active on' + (project ? ' project ' + project : ' the project') + '.\n' +
      '4. Come back and press Try again — your key itself is fine.';

    /* — the four ways the *request* is refused: all fixed by this app — */
    if (/Invalid region code|CLDR/i.test(raw)) {
      return 'Google refused the saved region code:\n' + raw +
        '\n\nA region code is two letters, not a country name — et for Ethiopia, ke for Kenya, ae for the UAE.\n' +
        'Settings → Google Maps → “Region code”. It has already been reset to a valid code and the search ran again without it, so your results are real.';
    }
    if (/Invalid included_type/i.test(raw)) {
      const bad = (raw.match(/'([^']+)'/) || [])[1] || '';
      return 'Google has no business type called' + (bad ? ' “' + bad.replace(/_/g, ' ') + '”' : ' that') + '.\n' + raw +
        '\n\nThe search has already run again without that type filter, so you are seeing real businesses.';
    }
    if (/circle\.radius|Radius must be/i.test(raw)) {
      return 'The saved search radius is outside Google’s range.\n' + raw +
        '\n\nSettings → Google Maps → “Search radius (km)” accepts 0.5 to 50 km.';
    }
    if (violation && violation.why) {
      return 'Google rejected one field of the request — ' + violation.why + '\n' +
        (violation.field ? 'Field: ' + violation.field.slice(0, 200) + '\n' : '') +
        '\nDetails: ' + raw;
    }

    /* — the key / project problems — */
    const disabled = reason === 'SERVICE_DISABLED' || /has not been used in project|it is disabled|is disabled/i.test(raw);
    if (disabled) {
      return 'Google has Places API (New) switched OFF for' + (project ? ' project ' + project : ' this key') +
        '.\nThe key itself is fine — the API it calls is what is not enabled yet.\n\n' + raw + fix;
    }
    if (reason === 'API_KEY_SERVICE_BLOCKED' || /are blocked/i.test(raw)) return 'Google blocked this call for the saved key.\n' + raw + fix;
    if (reason === 'API_KEY_HTTP_REFERRER_BLOCKED' || /referer|referrer/i.test(raw)) {
      return 'This key is restricted to particular websites, and a page opened from your disk (file://) sends none.\n' + raw +
        '\n\nSettings → Google Maps → Check connections, and in Google Cloud: Credentials → your key → Application restrictions → None.';
    }
    if (reason === 'API_KEY_INVALID' || /API key not valid/i.test(raw)) {
      return 'Google says this API key is not valid.\n' + raw +
        '\n\nCopy it again from Google Cloud → APIs & Services → Credentials into Settings → Google Maps.';
    }
    if (status === 403) return 'Google refused this call (' + (reason || detail || 'PERMISSION_DENIED') + ').\n' + raw + fix;
    if (status === 400) return 'Google rejected the request: ' + raw + '\n\nNothing is wrong with your key; this is a request the app built.';
    if (status === 404) return 'Google knows no business with that place ID.' + (raw ? '\n' + raw : '');
    if (status === 429) {
      const meta = providers.errorMetadata(data) || {};
      const limit = Number(meta.quota_limit_value || 0) || 0;
      const perDay = String(meta.quota_unit || '').indexOf('/d/') !== -1 || /per day/i.test(String(meta.quota_limit || ''));
      const quotas = 'https://console.cloud.google.com/apis/api/places.googleapis.com/quotas' + (project ? '?project=' + project : '');
      if (perDay) {
        const wait = providers.quotaWait();
        return 'Google\u2019s daily search allowance for this project' + (limit ? ' (' + limit + ' searches a day)' : '') + ' is spent.\n' + raw +
          '\n\nIt is a daily allowance, not a per-minute one: it returns in about ' + (wait || 'a day') + ' (Google resets at midnight Pacific Time).\n' +
          '\nNothing is broken and nothing is lost. A search you have already run is answered from your own saved copy without touching Google, so re-opening the lists you worked on today is instant and always available. Opening a business, building its website, sending the message and taking payment all keep working.\n\n' +
          'To raise the allowance: ' + quotas + ' → “SearchTextRequest per day” → Edit quota.\n' +
          'One search returns up to 20 businesses, so 100 a day is roughly 2,000 businesses.';
      }
      return 'Google is rate-limiting this project for the moment.\n' + raw +
        '\n\nThis one does pass — wait about a minute and search again, and avoid pressing search repeatedly.\nQuotas: ' + quotas;
    }
    if (status >= 500) return 'Google had a problem on its own side (' + status + '). Wait a few seconds and try again.';
    return '';
  };
})(window);
