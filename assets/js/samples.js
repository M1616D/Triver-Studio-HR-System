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

  /* ==========================================================================
     the shared base stylesheet every sample build starts from
     ====================================================================== */
  const BASE_CSS = [
    '*,*::before,*::after{box-sizing:border-box}',
    'html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}',
    'body{margin:0;font-family:"Inter","Noto Sans Ethiopic",system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased}',
    'img{max-width:100%;display:block}',
    'a{color:inherit;text-decoration:none}',
    'h1,h2,h3{margin:0 0 .6em;line-height:1.15;letter-spacing:-.02em}',
    '.wrap{width:min(1140px,92vw);margin-inline:auto}',
    '.row{display:flex;justify-content:space-between;gap:1rem;padding:.55rem 0;border-bottom:1px solid currentColor;border-color:color-mix(in srgb,currentColor 12%,transparent)}',
    '.row:last-child{border-bottom:0}',
    '.btn{display:inline-flex;align-items:center;gap:.5rem;padding:.85rem 1.4rem;border-radius:999px;font-weight:600;font-size:.95rem;border:0;cursor:pointer;transition:transform .18s,box-shadow .18s,opacity .18s}',
    '.btn:hover{transform:translateY(-2px)}',
    '.btn-primary{background:var(--accent);color:var(--accent-ink)}',
    '.btn-primary:hover{box-shadow:0 14px 34px color-mix(in srgb,var(--accent) 45%,transparent)}',
    '.btn-ghost{border:1px solid color-mix(in srgb,currentColor 25%,transparent);background:transparent}',
    '.reveal{opacity:0;transform:translateY(18px);animation:rise .7s cubic-bezier(.22,.9,.28,1) forwards;animation-delay:var(--d,0ms)}',
    '@keyframes rise{to{opacity:1;transform:none}}',
    '@media (prefers-reduced-motion:reduce){.reveal{opacity:1;transform:none;animation:none}}',
    '.stars{color:#f4b83f;display:flex;gap:2px;font-size:.8rem}',
    '.quote blockquote{margin:.5rem 0;font-size:.95rem}',
    '.quote figcaption{font-size:.8rem;opacity:.7}',
    'details{border-bottom:1px solid color-mix(in srgb,currentColor 12%,transparent);padding:.9rem 0}',
    'summary{cursor:pointer;font-weight:600}',
    'details p{opacity:.78;font-size:.94rem}',
    '.foot{padding:3rem 0 2rem;font-size:.86rem;opacity:.85}',
    '.foot-grid{display:grid;gap:2rem;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}',
    '.mapbox{position:relative;border-radius:22px;overflow:hidden;aspect-ratio:16/8;background:rgba(125,125,125,.12)}',
    '.mapbox iframe{width:100%;height:100%;border:0;display:block}',
    '.socials-inline{display:flex;gap:.55rem}',
    '.socials-inline a{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:color-mix(in srgb,currentColor 10%,transparent);transition:.2s}',
    '.socials-inline a:hover{background:var(--accent);color:var(--accent-ink)}'
  ].join('');

  function doc(o) {
    return '<!doctype html>\n<html lang="en">\n<head>\n' +
      '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
      '<title>{{business}} — {{tagline}}</title>\n' +
      '<meta name="description" content="{{about}}">\n' +
      '<meta property="og:title" content="{{business}}">\n' +
      '<meta property="og:description" content="{{tagline}}">\n' +
      '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
      '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">\n' +
      '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">\n' +
      '<script type="application/ld+json">{"@context":"https://schema.org","@type":"LocalBusiness","name":{{json_name}},"telephone":"{{phone}}","address":"{{address}}","aggregateRating":{"@type":"AggregateRating","ratingValue":"{{rating}}","reviewCount":"{{reviews}}"}}</script>\n' +
      '<style>' + BASE_CSS + (o.css || '') + '</style>\n</head>\n<body>\n' + (o.body || '') + '\n</body>\n</html>';
  }

  /* ==========================================================================
     the built-in samples, one per category family
     ====================================================================== */

  const SAMPLE_SAAS = doc({
    css: [
      ':root{--accent:#7df2a8;--accent-ink:#04170d}',
      'body{background:#070b10;color:#e8eef5}',
      'a,b{color:inherit}',
      'header{position:sticky;top:0;z-index:20;backdrop-filter:blur(14px);background:rgba(7,11,16,.82);border-bottom:1px solid rgba(255,255,255,.07)}',
      '.bar{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.95rem 0}',
      '.logo{display:flex;align-items:center;gap:.7rem;font-weight:800;letter-spacing:-.02em}',
      '.logo i{color:var(--accent)}',
      'nav a{opacity:.72;margin-left:1.4rem;font-size:.92rem}',
      'nav a:hover{opacity:1;color:var(--accent)}',
      '.hero{padding:5.5rem 0 4rem;position:relative;overflow:hidden}',
      '.hero::after{content:"";position:absolute;inset:-30% 40% 30% -10%;background:radial-gradient(circle at 30% 30%,rgba(125,242,168,.16),transparent 60%);pointer-events:none}',
      '.hero h1{font-size:clamp(2.2rem,5vw,3.6rem);font-weight:800;max-width:19ch}',
      '.hero p{max-width:56ch;opacity:.78;font-size:1.05rem}',
      '.pill{display:inline-flex;align-items:center;gap:.5rem;font-size:.78rem;padding:.4rem .9rem;border-radius:999px;border:1px solid rgba(255,255,255,.14);opacity:.85;margin-bottom:1.2rem}',
      '.grid-3{display:grid;gap:1.2rem;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));margin-top:2.4rem}',
      '.card{background:linear-gradient(160deg,rgba(255,255,255,.06),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.08);border-radius:22px;padding:1.6rem;transition:.25s}',
      '.card:hover{transform:translateY(-6px);border-color:rgba(125,242,168,.4);box-shadow:0 22px 50px rgba(0,0,0,.5)}',
      '.card-ico{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;background:rgba(125,242,168,.12);color:var(--accent);margin-bottom:1rem}',
      '.card h3{font-size:1.05rem}',
      '.card p{opacity:.72;font-size:.92rem;margin:0}',
      '.price{color:var(--accent);font-weight:700;margin-top:.8rem}',
      'section{padding:4rem 0}',
      'h2{font-size:clamp(1.6rem,3vw,2.2rem)}',
      '.split{display:grid;gap:2.5rem;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));align-items:center}',
      '.panel{border:1px solid rgba(255,255,255,.09);border-radius:26px;padding:1.8rem;background:rgba(255,255,255,.03)}',
      '.hero-cta{display:flex;gap:.8rem;flex-wrap:wrap;margin-top:1.6rem}',
      '.statline{display:flex;gap:2.2rem;flex-wrap:wrap;margin-top:2.4rem;opacity:.85;font-size:.9rem}',
      '.statline b{display:block;font-size:1.5rem;color:var(--accent)}'
    ].join(''),
    body: [
      '<header><div class="wrap bar">',
      '<span class="logo"><i class="fa-solid fa-cube"></i>{{business}}</span>',
      '<nav><a href="#offer">What we do</a><a href="#pricing">Pricing</a><a href="#visit">Visit</a></nav>',
      '</div></header>',

      '<div class="wrap hero">',
      '<span class="pill"><i class="fa-solid fa-circle-check"></i> {{category}} · {{area}}</span>',
      '<h1>{{tagline}}</h1>',
      '<p>{{about}}</p>',
      '<div class="hero-cta">',
      '<a class="btn btn-primary" href="{{phone_link}}"><i class="fa-solid fa-phone"></i> Call {{phone}}</a>',
      '<a class="btn btn-ghost" href="{{map_link}}" target="_blank" rel="noopener"><i class="fa-solid fa-location-dot"></i> Get directions</a>',
      '</div>',
      '<div class="statline">',
      '<div><b>{{rating}}<i class="fa-solid fa-star" style="font-size:.8rem"></i></b>{{reviews}} Google reviews</div>',
      '<div><b>{{area}}</b>Where you find us</div>',
      '<div><b class="js-open">Open now</b>Today\u2019s hours</div>',
      '</div></div>',

      '<section id="offer"><div class="wrap">',
      '<h2>What we do</h2>',
      '<p style="opacity:.75;max-width:60ch">{{about}}</p>',
      '<div class="grid-3">{{service_cards}}</div>',
      '</div></section>',

      '<section id="pricing"><div class="wrap split">',
      '<div><h2>Plans that stay simple</h2><p style="opacity:.75">Clear pricing, no hidden extras. Everything below is quoted in Ethiopian Birr.</p>',
      '<div class="socials-inline" style="margin-top:1.4rem">{{socials}}</div></div>',
      '<div class="panel"><div class="rows">{{price_rows}}</div>',
      '<a class="btn btn-primary" style="margin-top:1.4rem" href="{{whatsapp}}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> Talk to us</a></div>',
      '</div></section>',

      '<section id="visit"><div class="wrap split">',
      '<div><h2>Find us</h2><p style="opacity:.78">',
      '<i class="fa-solid fa-location-dot"></i> {{address}}<br>',
      '<i class="fa-solid fa-phone"></i> {{phone}}<br>',
      '<i class="fa-regular fa-clock"></i> {{hours_rows}}</p>',
      '<div class="socials-inline" style="margin-top:1.2rem">{{socials}}</div></div>',
      '<div class="mapbox">{{map_embed}}</div>',
      '</div></section>',

      '<section><div class="wrap"><h2>Frequently asked</h2>{{faq}}</div></section>',

      '<footer class="foot"><div class="wrap foot-grid">',
      '<div><span class="logo"><i class="fa-solid fa-cube"></i>{{business}}</span><p style="opacity:.7">{{address}}</p></div>',
      '<div><p><a href="{{phone_link}}">{{phone}}</a><br><a href="{{website}}">{{website}}</a></p><div class="socials-inline">{{socials}}</div></div>',
      '<div><p style="opacity:.7">Website by {{company}} · {{year}}</p></div>',
      '</div></footer>'
    ].join('')
  });

  const SAMPLE_FOOD = doc({
    css: [
      ':root{--accent:#c8531f;--accent-ink:#fff8f2}',
      'body{background:#fffaf5;color:#241a12}',
      'header{position:sticky;top:0;z-index:20;backdrop-filter:blur(14px);background:rgba(255,250,245,.9);border-bottom:1px solid rgba(36,26,18,.08)}',
      '.bar{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.9rem 0}',
      '.logo{display:flex;align-items:center;gap:.6rem;font-weight:800}',
      '.logo i{color:var(--accent)}',
      'nav a{margin-left:1.3rem;font-size:.92rem;opacity:.8}',
      'nav a:hover{color:var(--accent);opacity:1}',
      '.hero{padding:3.4rem 0 2rem}',
      '.hero-grid{display:grid;gap:2.2rem;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));align-items:center}',
      '.hero h1{font-size:clamp(2rem,4.6vw,3.2rem);font-weight:800}',
      '.hero p{opacity:.78;max-width:52ch}',
      '.hero-shot{border-radius:26px;overflow:hidden;aspect-ratio:4/3;background:#f1e5da;box-shadow:0 30px 60px rgba(60,30,10,.16)}',
      '.hero-shot img{width:100%;height:100%;object-fit:cover}',
      '.hero-shot .ph{width:100%;height:100%;display:grid;place-items:center;font-size:3rem;color:#c9a68c}',
      '.badge{display:inline-flex;gap:.5rem;align-items:center;font-size:.8rem;background:rgba(200,83,31,.1);color:var(--accent);padding:.4rem .9rem;border-radius:999px;font-weight:600}',
      'section{padding:3.2rem 0}',
      'h2{font-size:clamp(1.5rem,3vw,2.1rem)}',
      '.menu{display:grid;gap:1rem 2.4rem;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}',
      '.dish{display:flex;justify-content:space-between;gap:1rem;align-items:baseline;padding:.7rem 0;border-bottom:1px dashed rgba(36,26,18,.16)}',
      '.dish h3{font-size:1rem;margin:0}',
      '.dish p{font-size:.84rem;opacity:.65;margin:.2rem 0 0}',
      '.dish b{color:var(--accent);white-space:nowrap}',
      '.gal{display:grid;gap:.7rem;grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}',
      '.shot{border-radius:18px;overflow:hidden;aspect-ratio:1;background:#f1e5da}',
      '.shot img{width:100%;height:100%;object-fit:cover;transition:.4s}',
      '.shot:hover img{transform:scale(1.06)}',
      '.quotes{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}',
      '.quote{background:#fff;border:1px solid rgba(36,26,18,.08);border-radius:20px;padding:1.3rem;margin:0}',
      '.info-grid{display:grid;gap:2rem;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}',
      '.foot{background:#241a12;color:#f6ece3;margin-top:2rem}'
    ].join(''),
    body: [
      '<header><div class="wrap bar">',
      '<span class="logo"><i class="fa-solid fa-utensils"></i>{{business}}</span>',
      '<nav><a href="#menu">Menu</a><a href="#gallery">Photos</a><a href="#visit">Visit us</a></nav>',
      '</div></header>',

      '<div class="wrap hero"><div class="hero-grid">',
      '<div><span class="badge"><i class="fa-solid fa-star"></i> {{rating}} · {{reviews}} Google reviews</span>',
      '<h1>{{tagline}}</h1><p>{{about}}</p>',
      '<div class="hero-cta" style="display:flex;gap:.7rem;flex-wrap:wrap;margin-top:1.4rem">',
      '<a class="btn btn-primary" href="{{whatsapp}}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> Order on WhatsApp</a>',
      '<a class="btn btn-ghost" href="{{phone_link}}"><i class="fa-solid fa-phone"></i> {{phone}}</a>',
      '</div><div class="socials-inline" style="margin-top:1.2rem">{{socials}}</div></div>',
      '<div class="hero-shot"><img src="{{hero_image}}" alt="{{business}}" onerror="this.parentNode.innerHTML=\'<div class=&quot;ph&quot;><i class=&quot;fa-solid fa-bowl-food&quot;></i></div>\'"></div>',
      '</div></div>',

      '<section id="menu"><div class="wrap">',
      '<h2>Our menu</h2>',
      '<div class="menu">{{service_cards_menu}}</div>',
      '</div></section>',

      '<section id="gallery"><div class="wrap"><h2>A look inside</h2><div class="gal">{{gallery}}</div></div></section>',

      '<section><div class="wrap"><h2>What guests say</h2><div class="quotes">{{review_cards}}</div></div></section>',

      '<section id="visit"><div class="wrap"><h2>Opening hours &amp; location</h2><div class="info-grid">',
      '<div class="panel" style="border:1px solid rgba(36,26,18,.1);border-radius:22px;padding:1.5rem">{{hours_rows}}',
      '<p style="margin-top:1rem;opacity:.8"><i class="fa-solid fa-location-dot"></i> {{address}}</p></div>',
      '<div class="mapbox">{{map_embed}}</div>',
      '</div></div></section>',

      '<section><div class="wrap"><h2>Questions</h2>{{faq}}</div></section>',

      '<footer class="foot"><div class="wrap foot-grid foot-grid" style="padding:2.6rem 0">',
      '<div><span class="logo"><i class="fa-solid fa-utensils"></i>{{business}}</span><p style="opacity:.7">{{address}}</p></div>',
      '<div><p><a href="{{phone_link}}">{{phone}}</a></p><div class="socials-inline">{{socials}}</div></div>',
      '<div><p style="opacity:.7">{{category}} in {{area}} · website by {{company}}</p></div>',
      '</div></footer>'
    ].join('')
  });

  const SAMPLE_SHOP = doc({
    css: [
      ':root{--accent:#7a4ddb;--accent-ink:#fff}',
      'body{background:#f7f6fb;color:#1b1a24}',
      'header{position:sticky;top:0;z-index:20;backdrop-filter:blur(14px);background:rgba(247,246,251,.88);border-bottom:1px solid rgba(27,26,36,.07)}',
      '.bar{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.9rem 0}',
      '.logo{display:flex;align-items:center;gap:.6rem;font-weight:800}',
      '.logo i{color:var(--accent)}',
      'nav a{margin-left:1.3rem;font-size:.92rem;opacity:.75}',
      'nav a:hover{opacity:1;color:var(--accent)}',
      '.hero{padding:3.6rem 0 2.6rem;text-align:center}',
      '.hero h1{font-size:clamp(2rem,4.8vw,3.3rem);font-weight:800;margin-inline:auto;max-width:22ch}',
      '.hero p{opacity:.75;max-width:58ch;margin-inline:auto}',
      '.chiprow{display:flex;gap:.5rem;flex-wrap:wrap;justify-content:center;margin-top:1.5rem}',
      '.chip{font-size:.82rem;padding:.45rem 1rem;border-radius:999px;background:#fff;border:1px solid rgba(27,26,36,.08)}',
      'section{padding:3rem 0}',
      'h2{font-size:clamp(1.5rem,3vw,2.1rem)}',
      '.cards{display:grid;gap:1.1rem;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}',
      '.card{background:#fff;border:1px solid rgba(27,26,36,.07);border-radius:22px;padding:1.5rem;transition:.25s}',
      '.card:hover{transform:translateY(-6px);box-shadow:0 24px 48px rgba(40,20,90,.12);border-color:color-mix(in srgb,var(--accent) 40%,transparent)}',
      '.card-ico{width:48px;height:48px;border-radius:16px;background:rgba(122,77,219,.1);color:var(--accent);display:grid;place-items:center;margin-bottom:1rem;font-size:1.05rem}',
      '.card h3{font-size:1.05rem}.card p{opacity:.7;font-size:.92rem}',
      '.price{color:var(--accent);font-weight:700}',
      '.band{background:linear-gradient(135deg,var(--accent),#4b2ba8);color:#fff;border-radius:28px;padding:2.6rem}',
      '.band .btn-primary{background:#fff;color:#4b2ba8}',
      '.split{display:grid;gap:2rem;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));align-items:start}',
      '.panel{background:#fff;border:1px solid rgba(27,26,36,.08);border-radius:22px;padding:1.5rem}',
      '.gal{display:grid;gap:.7rem;grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}',
      '.shot{border-radius:18px;overflow:hidden;aspect-ratio:4/3;background:#ece9f5}',
      '.shot img{width:100%;height:100%;object-fit:cover;transition:.4s}.shot:hover img{transform:scale(1.05)}',
      '.foot{background:#fff;border-top:1px solid rgba(27,26,36,.08);margin-top:2rem}'
    ].join(''),
    body: [
      '<header><div class="wrap bar">',
      '<span class="logo"><i class="fa-solid fa-gem"></i>{{business}}</span>',
      '<nav><a href="#services">Services</a><a href="#photos">Photos</a><a href="#visit">Contact</a></nav>',
      '</div></header>',

      '<div class="wrap hero">',
      '<span class="badge" style="display:inline-flex;gap:.5rem;align-items:center;font-size:.8rem;background:rgba(122,77,219,.1);color:var(--accent);padding:.4rem .9rem;border-radius:999px;font-weight:600">',
      '<i class="fa-solid fa-star"></i> {{rating}} out of 5 · {{reviews}} reviews</span>',
      '<h1>{{tagline}}</h1>',
      '<p>{{about}}</p>',
      '<div class="chiprow"><span class="chip"><i class="fa-solid fa-location-dot"></i> {{area}}</span>',
      '<span class="chip"><i class="fa-solid fa-phone"></i> {{phone}}</span>',
      '<span class="chip"><i class="fa-regular fa-clock"></i> Open today</span></div>',
      '</div>',

      '<section id="services"><div class="wrap"><h2>What we offer</h2><div class="cards">{{service_cards}}</div></div></section>',

      '<section><div class="wrap"><div class="band">',
      '<h2 style="color:#fff">Ready when you are</h2>',
      '<p style="opacity:.9;max-width:54ch">Message us and we will confirm availability, prices and timing straight away.</p>',
      '<div style="display:flex;gap:.7rem;flex-wrap:wrap;margin-top:1.4rem">',
      '<a class="btn btn-primary" href="{{whatsapp}}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> Message us</a>',
      '<a class="btn btn-ghost" style="color:#fff;border-color:rgba(255,255,255,.5)" href="{{phone_link}}"><i class="fa-solid fa-phone"></i> {{phone}}</a>',
      '</div></div></div></section>',

      '<section id="photos"><div class="wrap"><h2>Inside {{business}}</h2><div class="gal">{{gallery}}</div></div></section>',

      '<section><div class="wrap split">',
      '<div class="panel"><h2 style="font-size:1.2rem">Prices</h2><div>{{price_rows}}</div></div>',
      '<div class="panel"><h2 style="font-size:1.2rem">Opening hours</h2><div>{{hours_rows}}</div>',
      '<p style="margin-top:1rem;opacity:.75;font-size:.9rem"><i class="fa-solid fa-location-dot"></i> {{address}}</p></div>',
      '</div></section>',

      '<section><div class="wrap"><h2>What customers say</h2><div class="cards">{{review_cards}}</div></div></section>',

      '<section id="visit"><div class="wrap"><h2>Come and see us</h2><div class="mapbox">{{map_embed}}</div></div></section>',

      '<section><div class="wrap"><h2>Questions</h2>{{faq}}</div></section>',

      '<footer class="foot"><div class="wrap foot-grid" style="padding:2.4rem 0">',
      '<div><span class="logo"><i class="fa-solid fa-gem"></i>{{business}}</span><p style="opacity:.7">{{category}} · {{area}}</p></div>',
      '<div><p><a href="{{phone_link}}">{{phone}}</a></p><div class="socials-inline">{{socials}}</div></div>',
      '<div><p style="opacity:.7">Website by {{company}} · {{year}}</p></div>',
      '</div></footer>'
    ].join('')
  });

  /* ==========================================================================
     the library: which category a business belongs to, and which sample it gets
     ====================================================================== */
  const BUILTIN = [
    {
      id: 'sample-saas',
      name: 'Software / product page',
      category: 'saas',
      tags: ['saas', 'software', 'hr', 'payroll', 'inventory', 'billing', 'app', 'system', 'dashboard', 'agency', 'studio', 'technology'],
      blurb: 'Dark product-led layout for software: hero, service grid, priced plans, FAQ.',
      html: SAMPLE_SAAS
    },
    {
      id: 'sample-food',
      name: 'Restaurant / cafe / QR menu',
      category: 'food',
      tags: ['restaurant', 'cafe', 'café', 'coffee', 'bakery', 'fast_food', 'fast food', 'bar', 'lounge', 'juice', 'pizza', 'burger', 'injera', 'menu', 'catering', 'food', 'hotel restaurant'],
      blurb: 'Warm photo-led layout with a full menu list, gallery, guest reviews, hours and map.',
      html: SAMPLE_FOOD
    },
    {
      id: 'sample-shop',
      name: 'Shop / salon / gym / clinic',
      category: 'shop',
      tags: ['shop', 'store', 'boutique', 'cosmetic', 'cosmetics', 'beauty', 'salon', 'barber', 'spa', 'gym', 'fitness', 'clinic', 'dental', 'pharmacy', 'hotel', 'guest house', 'lodge', 'services', 'auto', 'repair', 'construction', 'real estate', 'travel', 'photographer', 'print'],
      blurb: 'Clean light layout for a shop, salon, gym, clinic, hotel or local service.',
      html: SAMPLE_SHOP
    }
  ];

  /*
   * The studio's own designs, imported from the uploaded sample folder by
   * scripts/import-samples.js. These are the designs the generator actually
   * clones — markup and CSS are untouched, only the information changes.
   */
  const IMPORTED = (App.samplesReal || []).map(s => ({
    id: s.id,
    name: s.name,
    category: s.category,
    tags: s.tags || [],
    blurb: s.blurb || '',
    source: s.source || '',
    imported: true,
    html: s.html
  }));

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

    /**
     * The studio's imported designs first (they are the real ones), then the
     * drawn-in-code fallbacks, then anything uploaded from this browser.
     */
    list() {
      const mine = App.store.get('samples.items', []) || [];
      return IMPORTED.concat(BUILTIN, mine);
    },

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
      const one = re => { const m = h.match(re); return m ? m[1] : ''; };
      const all = re => { const out = []; let m; const r = new RegExp(re.source, 'gi'); while ((m = r.exec(h))) out.push(m[1]); return out; };

      const title = one(/<title[^>]*>([\s\S]*?)<\/title>/i).trim();
      const desc = one(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i);
      const headings = all(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i).map(s => strip(s)).filter(Boolean).slice(0, 24);
      const imgs = all(/<img[^>]+src=["']([^"']+)["']/i).filter(s => !/^data:/i.test(s)).slice(0, 40);
      const links = all(/<a[^>]+href=["']([^"']+)["']/i);
      // a phone can be written "+251 91 100 0111", "0911000111" or "+251911000111"
      const phones = uniq(all(/href=["']tel:([^"']+)["']/i).concat(
        (h.match(/(?:\+?251|0)[\d\s\-().]{8,15}\d/g) || []).map(s => s.replace(/[\s\-().]+$/, '').trim())));
      const emails = uniq(h.match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/g) || []);
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
      const addresses = (h.match(/\d+[^<>\n]{6,60}(?:Street|St\.|Road|Rd\.|Avenue|Ave\.|Building|Bldg|Floor|Mall|Center|Centre|Addis|Bole|Piassa|Kazanchis|Megenagna)/gi) || []).map(s => s.trim()).slice(0, 3);
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
        words: strip(h).split(/\s+/).filter(Boolean).length,
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
        if (!a || !lead.address) return;
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
    /** store an uploaded file as a reusable sample (analysis included) */
    save(o) {
      const html = String(o.html || '');
      if (html.length < 200) return { error: 'That file is too small to be a website.' };
      if (!/<html|<!doctype|<body|<div/i.test(html)) return { error: 'That does not look like an HTML page.' };
      const a = samples.analyse(html);
      const item = {
        id: 'up-' + Date.now().toString(36),
        name: o.name || a.title || 'Uploaded sample',
        category: o.category || guessCategory(a, o.name || ''),
        tags: String(o.tags || '').split(',').map(s => s.trim()).filter(Boolean),
        blurb: o.note || (a.words + ' words · ' + a.images.length + ' photos · ' + a.sections.slice(0, 3).join(', ')),
        html: html,
        analysis: a,
        source: 'uploaded',
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
