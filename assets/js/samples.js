/* =============================================================================
   Triverse OS — sample website library
   The way this is meant to work: we own a set of finished sample designs, one
   per category (SaaS, QR menu, restaurant, hotel, cosmetics, gym, shop, clinic,
   local service). When a business has no website we CLONE the sample for its
   category and change only the information — text, phone, map, photos, socials,
   opening hours, prices. The design, markup and CSS are never regenerated.

   Samples may also be uploaded by hand. An uploaded file is analysed first
   (title, headings, photos, phone, address, socials, colours, fonts, which
   parts are repeated blocks) and then becomes a normal sample that can be
   cloned for any business.

   Placeholders written as {{business}}, {{phone}}, {{map_embed}} ... are
   replaced directly. Samples that carry no placeholders are filled by
   detection: their own business name, phone, address, socials, map and photos
   are located in the markup and swapped for the new business's real data.
   ========================================================================== */
(function (global) {
  'use strict';

  const App = global.App;
  const U = App.util;
  const esc = U.esc;

  /* ==========================================================================
     the placeholder vocabulary — a sample may use any of these
     ====================================================================== */
  function ctx(lead, opts) {
    opts = opts || {};
    const c = App.store.get('settings.company', {});
    const t = App.dict.typeOf(lead.businessType);
    const items = (opts.items || App.sitegen.items(lead)) || [];
    const area = lead.areaLabel || lead.city || c.city || 'Addis Ababa';
    const photos = lead.photos || [];
    const reviews = (lead.reviewsList || []);
    const social = lead.socials || {};
    const phone = lead.phone || '';
    const waRaw = typeof lead.whatsapp === 'string' ? lead.whatsapp : (lead.intlPhone || '');
    const wa = String(waRaw).replace(/[^\d]/g, '');

    const hoursRows = (lead.hoursWeek && lead.hoursWeek.length
      ? lead.hoursWeek
      : (t.hours || ['Mon to Fri · 8:00 – 20:00', 'Saturday · 8:00 – 20:00', 'Sunday · 9:00 – 18:00'])
    ).map(h => {
      const parts = String(h).split(/[·:–-]/);
      return '<div class="row"><span>' + esc(String(parts[0] || h).trim()) + '</span><span>' +
        esc(String(parts.slice(1).join(' ').trim() || 'Open')) + '</span></div>';
    }).join('');

    const priceRows = items.map(i => '<div class="row"><span>' + esc(i.name) + '</span><span>' +
      (i.price ? U.money(i.price) : 'Ask us') + '</span></div>').join('');

    const serviceCards = items.map((i, n) => '<article class="card reveal" style="--d:' + (n * 60) + 'ms">' +
      '<div class="card-ico"><i class="' + esc(i.icon || t.icon || 'fa-solid fa-star') + '"></i></div>' +
      '<h3>' + esc(i.name) + '</h3><p>' + esc(i.desc) + '</p>' +
      (i.price ? '<p class="price">' + U.money(i.price) + '</p>' : '<p class="price">On request</p>') +
      '</article>').join('');

    const photoSet = photos.length ? photos : [];
    const gallery = photoSet.slice(0, 6).map((p, n) =>
      '<figure class="shot reveal" style="--d:' + (n * 70) + 'ms"><img src="' + esc(p) + '" alt="' +
      esc(lead.name) + '" loading="lazy"></figure>').join('');

    const reviewCards = reviews.slice(0, 6).map(r => '<figure class="quote reveal">' +
      '<div class="stars">' + starRow(r.rating) + '</div>' +
      '<blockquote>' + esc(String(r.text || '').slice(0, 300)) + '</blockquote>' +
      '<figcaption>' + esc(r.author || 'Google review') + (r.when ? ' · ' + esc(r.when) : '') + '</figcaption>' +
      '</figure>').join('');

    const faq = (t.faq || []).slice(0, 5).map((f, n) =>
      '<details' + (n === 0 ? ' open' : '') + '><summary>' + esc(f[0]) + '</summary><p>' + esc(f[1]) + '</p></details>').join('');

    const mapQuery = encodeURIComponent([lead.name, lead.address || area].join(', '));
    const mapEmbed = '<iframe title="Map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=' +
      mapQuery + '&output=embed"></iframe>';

    const socials = [['whatsapp', 'fa-brands fa-whatsapp', 'WhatsApp'], ['telegram', 'fa-brands fa-telegram', 'Telegram'],
      ['facebook', 'fa-brands fa-facebook-f', 'Facebook'], ['instagram', 'fa-brands fa-instagram', 'Instagram'],
      ['tiktok', 'fa-brands fa-tiktok', 'TikTok']]
      .filter(s => social[s[0]] || (s[0] === 'whatsapp' && wa))
      .map(s => '<a href="' + esc(social[s[0]] || ('https://wa.me/' + wa)) + '" aria-label="' + s[2] + '"><i class="' + s[1] + '"></i></a>')
      .join('');

    return {
      business: esc(lead.name || 'Our business'),
      tagline: esc(t.tagline || ''),
      category: esc(lead.category || t.label),
      about: esc(t.about || ''),
      area: esc(area),
      city: esc(c.city || 'Addis Ababa'),
      country: esc(c.country || 'Ethiopia'),
      address: esc(lead.address || area),
      phone: esc(phone),
      phone_link: 'tel:' + String(phone || '').replace(/[^\d+]/g, ''),
      intl_phone: esc(lead.intlPhone || phone),
      whatsapp: esc(wa ? 'https://wa.me/' + wa : ''),
      whatsapp_number: esc(wa ? '+' + wa : phone),
      email: esc(lead.email || c.email || ''),
      website: esc(lead.website || ''),
      rating: lead.rating ? Number(lead.rating).toFixed(1) : '5.0',
      reviews: String(lead.reviews || 0),
      review_stars: starRow(lead.rating || 5),
      map_embed: mapEmbed,
      map_embed_url: 'https://www.google.com/maps?q=' + mapQuery + '&output=embed',
      map_link: 'https://www.google.com/maps/search/?api=1&query=' + mapQuery,
      directions: 'https://www.google.com/maps/dir/?api=1&destination=' + mapQuery,
      hours_rows: hoursRows,
      price_rows: priceRows,
      service_cards: serviceCards,
      gallery: gallery,
      review_cards: reviewCards,
      faq: faq,
      socials: socials,
      hero_image: photoSet[0] || '',
      gallery_1: photoSet[0] || '',
      gallery_2: photoSet[1] || photoSet[0] || '',
      gallery_3: photoSet[2] || photoSet[0] || '',
      service_list: items.map(i => esc(i.name)).join(' · '),
      services: items.map(i => esc(i.name)).join(', '),
      owner: esc(c.senderName || ''),
      company: esc(c.name || 'Triverse Studio'),
      company_website: esc(c.portfolio || c.website || ''),
      year: String(new Date().getFullYear())
    };
  }

  function starRow(n) {
    n = Math.round(Number(n) || 5);
    let out = '';
    for (let i = 1; i <= 5; i++) out += '<i class="' + (i <= n ? 'fa-solid' : 'fa-regular') + ' fa-star"></i>';
    return out;
  }

  /* =========================================================================
     the library
     Nothing is shipped with the app. A design becomes a sample only when the
     studio uploads it — a single page or a whole folder — and the scanner reads
     its text, photos, map, socials and specifications so they can be swapped
     for a new client while the design itself stays exactly as uploaded.
     ====================================================================== */
  const BUILTIN = [];
  const IMPORTED = [];

  /* which sample family each business type belongs to */
  const TYPE_CATEGORY = {
    restaurant: 'food', cafe: 'food', coffee: 'food', fastfood: 'food',
    clinic: 'clinic', dentist: 'clinic', pharmacy: 'clinic',
    salon: 'beauty', spa: 'beauty', boutique: 'beauty', cosmetics: 'beauty',
    carrepair: 'auto',
    electronics: 'shop', furniture: 'shop', grocery: 'shop', shop: 'shop',
    hotel: 'shop', gym: 'shop', realestate: 'shop', travel: 'shop',
    tuition: 'shop', school: 'shop', construction: 'shop', lawfirm: 'shop',
    accounting: 'shop', photographer: 'shop', eventdecor: 'shop',
    logistics: 'shop', printing: 'shop',
    /* a plain local business gets the general retail/service design */
    general: 'shop'
  };

  const samples = App.samples = {
    builtin: BUILTIN,
    imported: IMPORTED,
    typeCategory: TYPE_CATEGORY,
    guessCategory: function (a, name) { return guessCategory(a, name); },

    /**
     * The library is exactly what the studio uploaded — newest first. Nothing
     * is shipped with the app, so a design can never be silently rewritten.
     */
    list() {
      return (App.store.get('samples.items', []) || []).slice().reverse();
    },

    /** true when there is nothing to clone from yet */
    empty() { return samples.list().length === 0; },

    /** samples the user uploaded, newest first */
    uploaded() {
      return (App.store.get('samples.items', []) || []).slice().reverse();
    },

    find(id) {
      return samples.list().filter(s => s.id === id)[0];
    },

    categories() {
      const seen = {};
      return samples.list().filter(s => {
        const k = s.category || 'other';
        if (seen[k]) return false;
        seen[k] = 1;
        return true;
      }).map(s => s.category || 'other');
    },

    /**
     * Which sample fits this business. An explicit choice on the lead always
     * wins, then the sample whose tags match the business type or category.
     */
    forBusiness(lead) {
      const list = samples.list();
      if (!list.length) return null;
      if (lead && lead.sampleId) {
        const chosen = samples.find(lead.sampleId);
        if (chosen) return chosen;
      }
      const t = App.dict.typeOf(lead ? lead.businessType : '');
      // a type object carries `key`, not `id` — reading the wrong field made every
      // business fall through to the first design in the library
      const typeKey = t.key || '';
      const wantCat = TYPE_CATEGORY[typeKey] || '';
      const hay = [typeKey, t.label, lead && lead.category, lead && lead.name, lead && lead.subtype]
        .filter(Boolean).join(' ').toLowerCase();
      let best = null, bestScore = 0;
      list.forEach(s => {
        let score = 0;
        (s.tags || []).forEach(tag => { if (tag && hay.indexOf(String(tag).toLowerCase()) !== -1) score += String(tag).length; });
        if (wantCat && s.category === wantCat) score += 60;
        // the studio's own imported designs are the real product: when the
        // category matches, one of them must win, then tags pick which one
        if (s.imported && wantCat && s.category === wantCat) score += 40;
        else if (s.imported) score += 6;
        if (score > bestScore) { bestScore = score; best = s; }
      });
      if (best) return best;
      const byCat = list.filter(s => s.category === wantCat)[0];
      return byCat || list[0];
    },

    /* ======================================================================
       analysis — read any HTML and report what it is made of
       ================================================================== */
    analyse(html) {
      const h = String(html || '');
      /* code is not content: stylesheets and scripts are scanned separately, and
         never mistaken for a phone number or an address sitting in the layout */
      const visible = h.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ');
      const one = re => { const m = h.match(re); return m ? m[1] : ''; };
      const all = re => { const out = []; let m; const r = new RegExp(re.source, 'gi'); while ((m = r.exec(h))) out.push(m[1]); return out; };

      const title = one(/<title[^>]*>([\s\S]*?)<\/title>/i).trim();
      const desc = one(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i);
      const headings = all(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i).map(s => strip(s)).filter(Boolean).slice(0, 24);
      const imgs = all(/<img[^>]+src=["']([^"']+)["']/i).filter(s => !/^data:/i.test(s)).slice(0, 40);
      const links = all(/<a[^>]+href=["']([^"']+)["']/i);
      // a phone can be written "+251 91 100 0111", "0911000111" or "+251911000111"
      const phones = uniq(all(/href=["']tel:([^"']+)["']/i).concat(
        (visible.match(/(?:\+?251|0)[\d\s\-().]{8,15}\d/g) || []).map(s => s.replace(/[\s\-().]+$/, '').trim())));
      const emails = uniq(visible.match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/g) || []);
      const social = {};
      links.concat(all(/<a[^>]+href=["']([^"']+)["']/gi)).forEach(u => {
        const m = String(u).match(/(wa\.me|whatsapp\.com|t\.me|telegram|facebook\.com|instagram\.com|tiktok\.com|twitter\.com|x\.com|linkedin\.com|youtube\.com)/i);
        if (!m) return;
        const key = /wa\.me|whatsapp/i.test(m[1]) ? 'whatsapp' : /t\.me|telegram/i.test(m[1]) ? 'telegram'
          : /facebook/i.test(m[1]) ? 'facebook' : /instagram/i.test(m[1]) ? 'instagram' : /tiktok/i.test(m[1]) ? 'tiktok'
            : /youtube/i.test(m[1]) ? 'youtube' : 'other';
        if (!social[key]) social[key] = u;
      });
      const mapIframe = one(/<iframe[^>]+src=["']([^"']*google[^"']*maps[^"']*)["']/i);
      const addresses = (visible.match(/\d+[^<>\n;{}]{6,60}(?:Street|St\.|Road|Rd\.|Avenue|Ave\.|Building|Bldg|Floor|Mall|Center|Centre|Addis|Bole|Piassa|Kazanchis|Megenagna)/gi) || [])
        .map(s => s.trim()).filter(s => !/[{};]/.test(s)).slice(0, 3);
      const placeholders = uniq((h.match(/\{\{[a-z_0-9]+\}\}/gi) || []).map(s => s.toLowerCase()));
      const colors = uniq((h.match(/#[0-9a-fA-F]{6}\b/g) || []).concat(
        (h.match(/rgba?\([^)]+\)/g) || []).slice(0, 12))).slice(0, 18);
      const fonts = uniq((h.match(/font-family\s*:\s*([^;"'}]+)/gi) || []).map(s => s.replace(/font-family\s*:\s*/i, '').trim())).slice(0, 5);
      const cssVars = uniq((h.match(/--[a-z0-9-]+\s*:\s*[^;"'}]+/gi) || []).slice(0, 24));
      const hasJsonLd = /application\/ld\+json/i.test(h);
      const sections = [
        /<header/i.test(h) && 'header', /<nav/i.test(h) && 'navigation', /<footer/i.test(h) && 'footer',
        /class=["'][^"']*(hero|banner)/i.test(h) && 'hero', /menu|dish|price/i.test(h) && 'menu or price list',
        /review|testimonial|quote/i.test(h) && 'reviews', /gallery|grid|photos?/i.test(h) && 'gallery',
        /<form/i.test(h) && 'contact form', /<details|accordion|faq/i.test(h) && 'FAQ',
        /map|iframe/i.test(h) && 'map', /<table/i.test(h) && 'table'
      ].filter(Boolean);

      const textNodes = samples.textNodes(h);
      const score = (
        (title ? 1 : 0) + (headings.length ? 1 : 0) + (imgs.length ? 1 : 0) +
        (phones.length ? 1 : 0) + (sections.length > 4 ? 2 : 1) + (textNodes.length > 12 ? 2 : 1) +
        (hasJsonLd ? 1 : 0)
      );

      return {
        title: title, description: desc, headings: headings, images: imgs, phones: phones, emails: emails,
        socials: social, mapIframe: mapIframe, addresses: addresses, placeholders: placeholders,
        colors: colors, fonts: fonts, cssVars: cssVars, sections: sections, hasJsonLd: hasJsonLd,
        words: strip(visible).split(/\s+/).filter(Boolean).length,
        textCount: textNodes.length,
        size: h.length,
        quality: Math.min(100, score * 11),
        analysedAt: U.now()
      };
    },

    /** the visible text blocks of a page, in document order, with their index */
    textNodes(html) {
      const out = [];
      const re = /<(h1|h2|h3|h4|p|li|span|a|b|strong|em|button|figcaption|blockquote|summary|label|div)\b[^>]*>([^<>{}]{14,240})<\/\1>/gi;
      let m;
      while ((m = re.exec(html))) {
        const txt = m[2].replace(/\s+/g, ' ').trim();
        if (!txt || /^[\d\s.,:%$+\-–—|/()]+$/.test(txt)) continue;
        if (/^\s*(javascript:|http)/i.test(txt)) continue;
        out.push({ i: out.length, tag: m[1].toLowerCase(), text: txt });
        if (out.length >= 90) break;
      }
      return out;
    },

    /* ======================================================================
       clone and fill — the heart of the whole thing
       ================================================================== */
    /**
     * Take the sample for this business's category and pour the business's own
     * information into it. Nothing about the design is regenerated: only text,
     * phones, address, map, photos, socials, hours and prices change.
     */
    fill(sample, lead, opts) {
      opts = opts || {};
      if (!sample) return '';
      const map = ctx(lead, opts);
      map.json_name = JSON.stringify(lead.name || 'Business');
      // a menu layout needs a different card shape than a service grid
      map.service_cards_menu = menuList(lead, opts);

      let html = String(sample.html || '');

      // 1. every {{placeholder}} the sample carries
      const used = [];
      Object.keys(map).forEach(k => {
        const re = new RegExp('\\{\\{\\s*' + k + '\\s*\\}\\}', 'gi');
        if (re.test(html)) used.push(k);
        html = html.replace(re, () => map[k]);
      });

      // 2. any leftover placeholder we do not know: empty, never shown raw
      html = html.replace(/\{\{[^}]{1,40}\}\}/g, '');

      // 3. samples written for someone else: swap their own facts for this one
      const fill = samples.autoFill(html, lead, sample.analysis || samples.analyse(sample.html), map);

      // 4. unknown photo hosts in a cloned sample would 404 — drop them
      fill.html = fill.html.replace(/<img\b[^>]*>/gi, tag => {
        const src = (tag.match(/src=["']([^"']+)["']/i) || [])[1] || '';
        if (!src || /^data:/i.test(src) || /googleusercontent|maps\.gstatic|encrypted-tbn|https?:\/\//i.test(src)) return tag;
        return tag.replace(/src=["'][^"']*["']/i, 'src=""');
      });

      return { html: fill.html, used: used, swapped: fill.swapped, map: map };
    },

    /**
     * Detection-based fill for samples that were authored for a different
     * business. We locate that business's own name, phone, address and map in
     * the markup and replace them with the new business's real values.
     */
    autoFill(html, lead, analysis, map) {
      const swapped = [];
      let out = html;

      // the sample's own brand name, taken from its title and its logo text
      const guesses = [];
      const t = String((analysis && analysis.title) || '').split(/[|\u2013\u2014-]/)[0].trim();
      if (t && t.length > 2) guesses.push(t);
      const og = (out.match(/property=["']og:site_name["'][^>]+content=["']([^"']+)/i) || [])[1];
      if (og) guesses.push(og);
      guesses.forEach(g => {
        if (!g || g.length < 3 || g === lead.name) return;
        const re = new RegExp(escapeRe(g), 'g');
        if (re.test(out)) { out = out.replace(re, lead.name); swapped.push('name: ' + g); }
      });

      // contact details — matched on digits so any spacing in the sample is caught
      const phones = (analysis && analysis.phones) || [];
      if (lead.phone) phones.forEach(p => {
        const re = phoneRegex(p);
        if (!re) return;
        if (re.test(out)) { out = out.replace(re, lead.phone); swapped.push('phone'); }
      });
      // and a call link must stay a valid tel: link
      if (lead.phone) {
        const dial = String(lead.phone).replace(/[^\d+]/g, '');
        out = out.replace(/href=["']tel:[^"']*["']/gi, 'href="tel:' + dial + '"');
      }
      (analysis && analysis.emails || []).forEach(e => {
        const target = lead.email || App.store.get('settings.company.email', '');
        if (!e || !target) return;
        out = out.replace(new RegExp(escapeRe(e), 'g'), target);
      });

      // social links
      const social = (analysis && analysis.socials) || {};
      const have = lead.socials || {};
      Object.keys(have).forEach(k => {
        if (social[k] && have[k]) { out = out.replace(new RegExp(escapeRe(social[k]), 'g'), have[k]); swapped.push('social: ' + k); }
      });
      const wa = String(typeof lead.whatsapp === 'string' ? lead.whatsapp : (lead.intlPhone || '')).replace(/\D/g, '');
      if (wa && social.whatsapp) out = out.replace(new RegExp(escapeRe(social.whatsapp), 'g'), 'https://wa.me/' + wa);

      // the map: point the existing embed at this business, or add one
      const embed = map.map_embed_url;
      if (analysis && analysis.mapIframe) {
        out = out.replace(new RegExp(escapeRe(analysis.mapIframe), 'g'), embed);
        swapped.push('map');
      }

      // a real photo where the sample used its own
      const photos = lead.photos || [];
      if (photos.length) {
        let n = 0;
        out = out.replace(/<img\b[^>]*>/gi, tag => {
          if (/logo|icon|avatar|sprite|\.svg/i.test(tag)) return tag;
          const src = photos[n % photos.length];
          n++;
          return tag.replace(/src=["'][^"']*["']/i, 'src="' + src + '"');
        });
        if (n) swapped.push('photos: ' + n);
      }

      // the sample's own address text
      ((analysis && analysis.addresses) || []).forEach(a => {
        if (!a || !lead.address || /[{};]/.test(a)) return;
        out = out.replace(new RegExp(escapeRe(a), 'g'), lead.address);
        swapped.push('address');
      });

      // its own price numbers, in order, become ours
      const items = App.sitegen.items(lead);
      let priceIdx = 0;
      out = out.replace(/(?:\$|Br\s?|ETB\s?)(\d[\d,]{2,7})(?![\d])/g, m => {
        if (priceIdx >= items.length || !items[priceIdx].price) return m;
        const v = U.money(items[priceIdx].price);
        priceIdx++;
        return v;
      });
      if (priceIdx) swapped.push('prices: ' + priceIdx);

      // hours blocks: replace a sample's weekday rows with the real ones
      if (lead.hoursWeek && lead.hoursWeek.length) {
        out = out.replace(/<([a-z0-9]+)([^>]*class=["'][^"']*(?:hours|opening|schedule|time)[^"']*["'][^>]*)>([\s\S]{0,600}?)<\/\1>/i,
          (m, tag, attrs, inner) => {
            if (!/\b(mon|tue|wed|thu|fri|sat|sun)/i.test(inner)) return m;
            return '<' + tag + attrs + '>' + map.hours_rows + '</' + tag + '>';
          });
      }

      return { html: samples.ensureEssentials(out, lead, map, swapped), swapped: swapped };
    },

    /**
     * Whatever design we clone, the finished site must always be able to be
     * called, messaged and located. Designs that shipped with their own contact
     * block keep it; the rest get one appended, so no clone is ever a dead end.
     */
    ensureEssentials(html, lead, map, swapped) {
      let out = String(html);
      swapped = swapped || [];
      const dial = String(lead.intlPhone || lead.phone || '').replace(/[^\d+]/g, '');
      const wa = String(typeof lead.whatsapp === 'string' ? lead.whatsapp : (lead.intlPhone || lead.phone || '')).replace(/\D/g, '');
      const dir = map.directions || '';

      const pill = 'display:inline-flex;align-items:center;gap:.5rem;padding:.7rem 1.15rem;border-radius:999px;' +
        'font:600 14px/1 Inter,system-ui,sans-serif;text-decoration:none;box-shadow:0 8px 24px rgba(0,0,0,.28)';

      /* 1. a way to call or message, when the design has none of its own */
      if (!/href=["']tel:/i.test(out) && !/href=["']https:\/\/wa\.me/i.test(out) && dial) {
        const chips = [];
        chips.push('<a href="tel:' + dial + '" style="' + pill + ';background:#cbfa31;color:#0b1205">' +
          '<i class="fa-solid fa-phone"></i> Call ' + esc(lead.phone || lead.intlPhone || dial) + '</a>');
        if (wa) chips.push('<a href="https://wa.me/' + wa + '" target="_blank" rel="noopener" style="' + pill + ';background:#25d366;color:#04220f">' +
          '<i class="fa-brands fa-whatsapp"></i> WhatsApp</a>');
        if (dir) chips.push('<a href="' + esc(dir) + '" target="_blank" rel="noopener" style="' + pill + ';background:#111827;color:#fff;border:1px solid rgba(255,255,255,.25)">' +
          '<i class="fa-solid fa-location-dot"></i> Directions</a>');
        out = out.replace(/<\/body>/i, '<div style="position:fixed;right:16px;bottom:16px;z-index:9999;display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">' +
          chips.join('') + '</div></body>');
        swapped.push('contact dock added');
      }

      /* 2. a map, when the design shipped none */
      if (!/google\.com\/maps\?q=|google\.com\/maps\/embed/i.test(out) && map.map_embed) {
        const mapBlock = '<section style="padding:3.5rem 20px 1rem"><div style="width:min(1140px,92vw);margin-inline:auto">' +
          '<h2 style="font:700 1.6rem/1.2 Inter,system-ui,sans-serif;margin:0 0 .35rem">Find us</h2>' +
          '<p style="opacity:.75;margin:0 0 1rem;font-size:.95rem">' + esc(lead.address || map.area) + '</p>' +
          '<div style="border-radius:22px;overflow:hidden;aspect-ratio:16/8;background:rgba(125,125,125,.12)">' +
          map.map_embed.replace('<iframe ', '<iframe style="width:100%;height:100%;border:0" ') + '</div>' +
          '</div></section>';
        out = out.replace(/<\/body>/i, mapBlock + '</body>');
        swapped.push('map added');
      }

      /* 3. structured data for search engines, written for THIS business */
      if (!/application\/ld\+json/i.test(out)) {
        const ld = {
          '@context': 'https://schema.org', '@type': 'LocalBusiness',
          name: lead.name || '', telephone: lead.phone || lead.intlPhone || '',
          address: lead.address || map.area || '', url: lead.website || ''
        };
        if (lead.rating) { ld.aggregateRating = { '@type': 'AggregateRating', ratingValue: String(Number(lead.rating).toFixed(1)), reviewCount: String(lead.reviews || 0) }; }
        out = out.replace(/<\/head>/i, '<script type="application/ld+json">' + JSON.stringify(ld) + '<\/script></head>');
      }

      return out;
    },

    /* ======================================================================
       uploading a sample of your own
       ================================================================== */
    /** the scanner: what a design is made of, and what can be filled later */
    scan(html) { return samples.analyse(html); },

    /**
     * Read a folder (or a handful of loose files) into ONE self-contained page.
     * The design is never altered: its stylesheets and scripts are folded in, its
     * own pictures are carried as data, and nothing about the layout is touched.
     * Everything else in the folder is kept alongside as extra pages.
     */
    bundle(files, opts) {
      opts = opts || {};
      const list = Array.prototype.slice.call(files || []).filter(Boolean);
      if (!list.length) return Promise.reject(new Error('Nothing was chosen.'));
      const pathOf = f => String(f.webkitRelativePath || f.name || '').replace(/\\/g, '/').toLowerCase();
      const byPath = {};
      list.forEach(f => { byPath[pathOf(f)] = f; byPath[pathOf(f).split('/').pop()] = f; });

      const readText = f => new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result || ''));
        fr.onerror = () => rej(new Error('Could not read ' + f.name));
        fr.readAsText(f);
      });
      const readUrl = f => new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result || ''));
        fr.onerror = () => rej(new Error('Could not read ' + f.name));
        fr.readAsDataURL(f);
      });

      const pages = list.filter(f => /\.html?$/i.test(f.name));
      if (!pages.length) return Promise.reject(new Error('That folder has no HTML page in it.'));
      const score = f => {
        let s = /(^|\/)index\.html?$/i.test(pathOf(f)) ? 200 : 0;
        s += /home/i.test(f.name) ? 60 : 0;
        s += Math.min(Number(f.size || 0), 400000) / 2000;
        return s;
      };
      const main = pages.slice().sort((a, b) => score(b) - score(a))[0];
      const mainPath = pathOf(main);
      const baseDir = mainPath.indexOf('/') !== -1 ? mainPath.slice(0, mainPath.lastIndexOf('/') + 1) : '';

      const resolve = ref => {
        let p = String(ref || '').trim().replace(/^["']|["']$/g, '');
        if (!p || /^(https?:|data:|mailto:|tel:|#|\/\/|javascript:)/i.test(p)) return '';
        p = p.split('?')[0].split('#')[0];
        const joined = (p.charAt(0) === '/' ? p.slice(1) : (baseDir + p)).toLowerCase();
        const parts = [];
        joined.split('/').forEach(seg => {
          if (seg === '..') parts.pop();
          else if (seg !== '.' && seg !== '') parts.push(seg);
        });
        const clean = parts.join('/');
        return byPath[clean] ? clean : (byPath[clean.split('/').pop()] ? clean.split('/').pop() : '');
      };

      return readText(main).then(html => {
        let out = html;
        const carried = { styles: 0, scripts: 0, images: 0, skipped: 0, bytes: 0 };
        const budget = { left: Number(opts.imageBudget || 3 * 1024 * 1024) };

        const jobs = [];
        const jobsFor = (re, build) => {
          out.replace(re, (m, ref) => { const key = resolve(ref); if (key) jobs.push(build(key, m, ref)); return m; });
        };
        jobsFor(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/gi, (key, m) => ({ kind: 'css', key: key, match: m }));
        jobsFor(/<script\b[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi, (key, m) => ({ kind: 'js', key: key, match: m }));
        jobsFor(/<img\b[^>]*src=["']([^"']+)["']/gi, (key, m, ref) => ({ kind: 'img', key: key, ref: ref }));
        jobsFor(/url\(\s*["']?([^"')]+)["']?\s*\)/gi, (key) => ({ kind: 'img', key: key }));

        return jobs.reduce((chain, job) => chain.then(() => {
          const f = byPath[job.key];
          if (!f) return;
          if (job.kind === 'img') {
            if (Number(f.size || 0) > budget.left || Number(f.size || 0) > 900 * 1024) { carried.skipped++; return; }
            return readUrl(f).then(url => {
              budget.left -= Number(f.size || 0);
              carried.images++;
              carried.bytes += url.length;
              // swap every reference to this exact picture, wherever it is written
              out = out.split(job.key).join(url);
              if (job.ref && job.ref !== job.key) out = out.split(job.ref).join(url);
            });
          }
          return readText(f).then(text => {
            if (job.kind === 'css') {
              carried.styles++;
              carried.bytes += text.length;
              out = out.replace(job.match, '<style data-design="' + job.key + '">' + text + '</style>');
            } else {
              carried.scripts++;
              carried.bytes += text.length;
              out = out.replace(job.match, '<script data-design="' + job.key + '">' + text + '<\/script>');
            }
          });
        }), Promise.resolve()).then(() => readText(main)).then(() => {
          const extras = [];
          return pages.reduce((chain, f) => chain.then(() => {
            if (pathOf(f) === mainPath) return;
            return readText(f).then(t => { extras.push({ path: pathOf(f), html: t, bytes: t.length }); });
          }), Promise.resolve()).then(() => ({
            html: out,
            name: opts.name || String(main.name).replace(/\.html?$/i, ''),
            source: String(mainPath || main.name) + (extras.length ? ' (+' + extras.length + ' more page' + (extras.length > 1 ? 's' : '') + ')' : ''),
            files: list.length,
            pages: extras,
            carried: carried,
            bytes: out.length + extras.reduce((n, e) => n + e.bytes, 0)
          }));
        });
      });
    },

    /** store an uploaded design as a reusable sample (analysis included) */
    save(o) {
      const html = String(o.html || '');
      if (html.length < 200) return { error: 'That file is too small to be a website.' };
      if (!/<html|<!doctype|<body|<div/i.test(html)) return { error: 'That does not look like an HTML page.' };
      const a = samples.analyse(html);
      const item = {
        id: 'up-' + Date.now().toString(36),
        name: o.name || a.title || 'Uploaded design',
        category: o.category || guessCategory(a, o.name || ''),
        tags: String(o.tags || '').split(',').map(s => s.trim()).filter(Boolean),
        blurb: o.note || (a.words + ' words · ' + a.images.length + ' photos · ' + a.sections.slice(0, 3).join(', ')),
        html: html,
        analysis: a,
        source: o.source || 'uploaded',
        files: Number(o.files || 0),
        pages: (o.pages || []).map(p => ({ path: p.path, bytes: p.bytes })),
        carried: o.carried || null,
        addedAt: U.now(),
        usedCount: 0
      };
      const items = (App.store.get('samples.items', []) || []).slice();
      items.push(item);
      App.store.set('samples.items', items);
      App.store.save();
      return { sample: item, analysis: a };
    },

    remove(id) {
      const items = (App.store.get('samples.items', []) || []).filter(s => s.id !== id);
      App.store.set('samples.items', items);
      App.store.save();
    },

    bump(id) {
      const items = (App.store.get('samples.items', []) || []).slice();
      const s = items.filter(x => x.id === id)[0];
      if (s) { s.usedCount = (s.usedCount || 0) + 1; App.store.set('samples.items', items, { silent: true }); App.store.save(); }
    },

    /** which business types this sample can serve */
    fits(typeIds) {
      // diagnostic helper: which samples would be chosen for each type
      return (typeIds || []).map(id => {
        const s = samples.forBusiness({ businessType: id, name: '' });
        return [id, s ? s.id : '(none)'];
      });
    },

    /* ======================================================================
       the AI pass — rewrite the sample's own wording for this business
       ================================================================== */
    aiFill(sample, lead, opts) {
      opts = opts || {};
      if (!App.ai.ready()) return Promise.resolve(null);
      const nodes = samples.textNodes(sample.html);
      const pick = nodes.filter(n => n.text.length > 20).slice(0, 34);
      if (!pick.length) return Promise.resolve(null);
      const list = pick.map(n => n.i + '. [' + n.tag + '] ' + n.text).join('\n');
      const prompt = App.ai.context(lead) + '\n\n' +
        'Below are the visible text blocks of a website sample that was written for another business. ' +
        'Rewrite them so the page reads as if it was made for ' + lead.name + ', using only the facts above. ' +
        'Keep every block about the same length, keep the same tone (' + (opts.tone || 'warm, plain, professional') + '), ' +
        'keep the language English, and never invent awards, years, staff numbers or claims. ' +
        'Leave a block unchanged if it is already correct for this business.\n\nTEXT BLOCKS:\n' + list + '\n\n' +
        'Return JSON: {"items":[{"i":0,"text":"the rewritten block"}]} — include only the blocks that changed.';
      return App.ai.call(prompt, { temperature: 0.7, maxTokens: 3000 })
        .then(txt => {
          const j = App.ai.parseJSON(txt);
          const items = (j && j.items) || [];
          if (!items.length) return null;
          const patch = {};
          items.forEach(it => {
            const n = pick.filter(p => p.i === Number(it.i))[0];
            if (n && it.text && String(it.text).trim() !== n.text) patch[n.text] = String(it.text).trim();
          });
          return Object.keys(patch).length ? patch : null;
        })
        .catch(() => null);
    },

    /** apply an AI patch on top of a filled sample */
    applyPatch(html, patch) {
      if (!patch) return html;
      let out = html;
      Object.keys(patch).forEach(from => {
        if (out.indexOf(from) !== -1) out = out.split(from).join(patch[from]);
      });
      return out;
    }
  };

  /* ==========================================================================
     small helpers
     ====================================================================== */
  function menuList(lead, opts) {
    const items = (opts && opts.items) || App.sitegen.items(lead);
    const t = App.dict.typeOf(lead.businessType);
    return items.map(i => '<div class="dish reveal"><div><h3>' + esc(i.name) + '</h3>' +
      '<p>' + esc(i.desc) + '</p></div><b>' + (i.price ? U.money(i.price) : 'Ask us') + '</b></div>').join('') ||
      '<div class="dish"><div><h3>' + esc(t.label) + '</h3><p>' + esc(t.tagline || '') + '</p></div></div>';
  }

  function strip(s) {
    return String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').replace(/&nbsp;/g, ' ').trim();
  }
  function uniq(a) {
    const seen = {}, out = [];
    (a || []).forEach(x => { const k = String(x); if (k && !seen[k]) { seen[k] = 1; out.push(k); } });
    return out;
  }
  function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  /** the same phone number however the sample spaced it out */
  function phoneRegex(p) {
    const digits = String(p || '').replace(/\D/g, '');
    if (digits.length < 9) return null;
    const body = digits.split('').map(escapeRe).join('[\\s\\-().]*');
    return new RegExp('\\+?' + body, 'g');
  }

  function guessCategory(a, name) {
    const hay = ([a.title, name, (a.headings || []).join(' '), (a.sections || []).join(' ')].join(' ')).toLowerCase();
    if (/software|saas|dashboard|erp|hr |payroll|system|app\b/.test(hay)) return 'saas';
    if (/menu|restaurant|cafe|café|coffee|food|kitchen|dish/.test(hay)) return 'food';
    return 'shop';
  }
})(window);
