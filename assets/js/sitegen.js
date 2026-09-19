/* =============================================================================
   Triverse OS — website generator
   Turns a discovered business (Google Maps info + business type) plus one of
   our design templates into a complete, standalone, ready-to-host HTML page.
   ========================================================================== */
(function (global) {
  'use strict';

  const App = global.App;
  const U = App.util;
  const esc = U.esc;

  /* per-type content: [ [item name, price, one-line description], ... ] */
  const ITEMS = {
    restaurant: [['Doro Wat', 520, 'Slow-cooked, served with injera'], ['Kitfo', 580, 'Minced beef, mitmita, served with kocho'], ['Beyaynetu (fasting platter)', 380, 'Shiro, lentils and seasonal vegetables'], ['Tibs (beef or lamb)', 600, 'Sizzling, with injera and awaze'], ['Family Package', 1850, '4–5 persons, 6 items + coffee ceremony']],
    cafe: [['Espresso / Americano', 180, 'Single origin, roasted weekly'], ['Cappuccino', 220, 'Double shot, steamed milk'], ['Chocolate Brownie', 180, 'Served warm with ice cream'], ['Breakfast Platter', 390, 'Eggs, toast, sausage, juice'], ['Afternoon Tea Set', 650, 'Two persons, 4 items']],
    fastfood: [['Chicken Burger', 220, 'Crispy fillet, house sauce'], ['Beef Cheese Burger', 290, 'Double patty, cheddar'], ['Fried Chicken (2 pcs)', 260, 'Spicy or regular'], ['French Fries', 120, 'Large, peri-peri sprinkle'], ['Combo Meal', 520, 'Burger + fries + drink']],
    hotel: [['Deluxe Room', 4500, 'Per night, breakfast included'], ['Executive Suite', 7500, 'Per night, city view'], ['Family Room', 6000, 'Per night, 4 guests'], ['Day Room', 2500, '6 hours, single'], ['Airport Pickup', 1200, 'Per trip, sedan']],
    clinic: [['General Consultation', 800, 'Medicine specialist, 20 min'], ['Full Health Check-up', 4500, 'Blood, ECG, X-ray, report'], ['Diabetes Package', 2500, 'Fasting + 2hr glucose, HbA1c'], ['Home Sample Collection', 500, 'Addis Ababa, next-day report'], ['Digital X-Ray', 900, 'Report within 2 hours']],
    dentist: [['Consultation & Check-up', 500, 'Includes X-ray if needed'], ['Scaling & Polishing', 2000, 'Ultrasonic, 40 minutes'], ['Tooth Filling', 1500, 'Composite, per tooth'], ['Root Canal', 6000, 'Single sitting option'], ['Braces Consultation', 1000, 'Full plan with costing']],
    pharmacy: [['Prescription Medicine', 0, 'Genuine stock, invoice provided'], ['Home Delivery', 0, 'Inside 5 km, 2-hour window'], ['Blood Pressure Monitor', 2800, 'Omron, 1 year warranty'], ['Glucometer + 25 Strips', 1900, 'Free demo at counter'], ['Baby Care Corner', 0, 'Formula, diapers, wipes']],
    gym: [['Monthly Membership', 2500, 'All equipment + free weights'], ['3-Month Package', 6500, 'Save 13%, includes diet chart'], ['Personal Training', 6000, '8 sessions per month'], ['Cardio + Zumba Access', 3000, 'Morning & evening batches'], ['Student Membership', 1800, 'With valid student ID']],
    salon: [['Hair Cut & Styling', 500, 'Wash, cut, blow dry'], ['Facial (Gold)', 1800, '60 minutes, glow finish'], ['Bridal Package', 14000, 'Makeup, hair and traditional shuruba'], ['Hair Spa', 1500, 'Deep conditioning'], ['Manicure + Pedicure', 1200, 'Combo, gel polish']],
    spa: [['Full Body Massage', 2500, '60 minutes, aroma oil'], ['Foot Reflexology', 1200, '40 minutes'], ['Couple Package', 4500, '90 minutes, private room'], ['Body Scrub + Wrap', 3000, '75 minutes'], ['Head & Shoulder', 900, '30 minutes']],
    realestate: [['Ready Apartments', 0, '2 & 3 bedroom, handover ready'], ['Land (Residential)', 0, 'Title deed checked, no dispute'], ['Office Space', 0, 'Rent or sale — Bole, CMC, Kazanchis'], ['Duplex / Villa', 0, 'Custom build, turnkey'], ['Property Management', 0, 'Tenant, rent and maintenance handling']],
    carrepair: [['Engine Oil & Filter Change', 2500, 'Full synthetic, 5000 km interval'], ['Full Servicing', 6500, 'Engine, brakes, suspension check'], ['AC Servicing & Gas', 3500, 'Leak test included'], ['Wheel Alignment', 1500, 'Digital, 4 wheels'], ['Battery Replacement', 7500, 'Branded, 1 year warranty']],
    travel: [['Lalibela 3 Days', 18500, 'Per person, hotel + guide + flights'], ['Simien Mountains Trek', 25000, '4 days, guide, cook and camping'], ['Danakil Depression', 32000, '3 days, 4x4, escort and camping'], ['Harar & Dire Dawa', 14500, '3 days, Walled City tour'], ['Zanzibar Beach Holiday', 95000, '5 days, flights + resort']],
    tuition: [['Grade 6–8 (All subjects)', 3000, 'Monthly, 5 days a week'], ['Grade 9–10 (Science)', 4500, 'Monthly, batch of 12'], ['Grade 11–12 (Natural Science)', 6000, 'Monthly, exam-focused'], ['Spoken English', 3500, 'Monthly, weekend batch'], ['EUEE Exam Prep', 7000, 'Monthly, university entrance']],
    school: [['KG / Play Group (Age 4+)', 3500, 'Monthly, 3 days a week'], ['Primary (Grade 1–6)', 4500, 'Monthly, national curriculum'], ['Secondary (Grade 7–12)', 5500, 'Monthly, natural & social science'], ['Science Lab Programme', 1500, 'Monthly, practical classes'], ['Transport Service', 2500, 'Monthly, school bus']],
    boutique: [['Habesha Kemis', 6500, 'Hand-woven cotton, tilet embroidery'], ['Netela', 1800, 'Fine cotton, all colours'], ['Gabi (wool wrap)', 4500, 'Hand-loomed, warm, unisex'], ['Men\u2019s Suit / Kemis', 12000, 'Tailored, two fittings'], ['Custom Tailoring', 1500, 'Your own fabric, 5 days']],
    electronics: [['Smartphone (64GB)', 18500, 'Official warranty, EMI available'], ['LED TV 43"', 32000, 'Smart TV, 2 year warranty'], ['Ceiling Fan', 4200, 'Energy efficient, 5 star'], ['Refrigerator 250L', 45000, 'No-frost, free delivery'], ['Headphone / Earbuds', 1600, 'TWS, 20hr backup']],
    furniture: [['Three-Seater Sofa', 32000, 'Teak frame, custom fabric'], ['Dining Table (6 seat)', 28000, 'Solid wood, made to order'], ['Bed King (with storage)', 42000, 'Wood + board, 2 weeks'], ['Office Chair', 8500, 'Ergonomic, mesh back'], ['Wardrobe (4 door)', 36000, 'Locally made, 1 year warranty']],
    grocery: [['Teff (5 kg)', 1450, 'White or brown, freshly milled'], ['Berbere (1 kg)', 850, 'Sun-dried, ground to order'], ['Cooking Oil (3 L)', 780, 'Sealed pack, own label'], ['Fresh Vegetables', 90, 'Per kg, daily market price'], ['Monthly Family Pack', 8500, 'Delivered to your door']],
    construction: [['Interior Design & Build', 0, '3D concept + execution'], ['Apartment Renovation', 0, 'Turnkey, 30–60 days'], ['False Ceiling Work', 0, 'Per square foot rate'], ['Office Fit-out', 0, 'Corporate, with furniture'], ['Painting & Waterproofing', 0, 'Per square foot, 2 year workmanship']],
    lawfirm: [['Legal Consultation', 3000, 'Per session, 45 minutes'], ['Deed Drafting', 12000, 'Sale, gift or partition of property'], ['Company Registration', 18000, 'MoTRI, TIN and bank account'], ['Land Title Verification', 15000, 'Carta, map and registry check'], ['Power of Attorney', 6000, 'Draft + notary arrangement']],
    accounting: [['Bookkeeping (Monthly)', 8000, 'Up to 200 vouchers, IFRS format'], ['VAT Return Filing', 5000, 'Monthly, filed with ERCA'], ['Payroll & Pension', 6500, 'Monthly, up to 15 staff'], ['Annual Audit', 45000, 'Chartered report, per company'], ['Business Licence Renewal', 12000, 'MoTRI, TIN and tax clearance']],
    photographer: [['Wedding Day Coverage', 95000, 'Two photographers, 500+ edited photos'], ['Mels / Telosh Traditional', 45000, '4 hours, 150 photos, album'], ['Corporate Event', 30000, '4 hours, edited album'], ['Product Shoot', 15000, '20 photos, white background'], ['Portrait Session', 9000, 'Studio, 30 edited frames']],
    eventdecor: [['Wedding Stage Decor', 140000, 'Full floral, drapes and lighting'], ['Melse / Telosh Decor', 60000, 'Traditional setup with seating'], ['Birthday Setup', 22000, 'Balloon arch, table and cake stand'], ['Corporate Event', 70000, 'Stage, backdrop and signage'], ['Photo Booth Corner', 18000, 'Props and attendant']],
    logistics: [['Same-day Delivery', 120, 'Inside city, per parcel'], ['Inter-city Parcel', 180, 'Per kg, 24–48 hours'], ['Corporate Contract', 0, 'Monthly billing, dedicated rider'], ['Warehouse Storage', 0, 'Per square foot monthly'], ['Return Pickup', 150, 'E-commerce returns']],
    printing: [['Business Card (100 pcs)', 900, '300gsm, both sides'], ['Flyer (100 pcs)', 1500, 'A5, 150gsm art paper'], ['Banner (per sqft)', 35, 'Vinyl, eyelet included'], ['Letterhead (100 pcs)', 1200, '80gsm, 1 colour'], ['ID Card (50 pcs)', 2500, 'PVC, laminated']],
    itfirm: [['Business Website', 25000, '6 pages, custom design'], ['Digital QR Menu', 6000, 'Table QR + WhatsApp orders'], ['HR & Payroll System', 120000, 'Attendance, leave, salary'], ['Inventory & Billing', 95000, 'Stock, sales, reports'], ['Logo & Brand Kit', 15000, 'Logo, colour, stationery']],
    general: [['Consultation', 0, 'Talk to us about your requirement'], ['Service Package', 0, 'Customised for your business'], ['Home / On-site Visit', 0, 'Available inside city'], ['Annual Contract', 0, 'Discounted yearly rate']]
  };

  const HEADLINE = {
    restaurant: 'Authentic taste, served fresh every day',
    cafe: 'Your neighbourhood coffee stop',
    fastfood: 'Fast, fresh and full of flavour',
    hotel: 'Stay in comfort, right in the city',
    clinic: 'Care you can trust, reports you can understand',
    dentist: 'Healthy smiles, gentle treatment',
    pharmacy: 'Genuine medicine, right around the corner',
    gym: 'Train with a plan, not just a machine',
    salon: 'Look sharp, feel confident',
    spa: 'Relax, refresh, repeat',
    realestate: 'Verified properties, honest advice',
    carrepair: 'Your car in expert hands',
    travel: 'Travel more, plan less',
    tuition: 'Where results speak louder than promises',
    school: 'An education your child will thank you for',
    boutique: 'Fashion that fits you',
    electronics: 'Genuine products, honest prices',
    furniture: 'Furniture built to last',
    grocery: 'Daily needs, delivered to your door',
    construction: 'We build what you imagine',
    lawfirm: 'Clear legal advice, on time',
    accounting: 'Your numbers, in safe hands',
    photographer: 'Moments captured with care',
    eventdecor: 'Events your guests will remember',
    logistics: 'Deliveries that never go missing',
    printing: 'Printing that looks premium',
    itfirm: 'Software that runs your business',
    general: 'Serving the local community with pride'
  };

  const FAQ = {
    _default: [
      ['Do you have a website?', 'Yes — this page is your live website. Customer enquiries land directly on the owner\'s phone.'],
      ['What are your opening hours?', 'Our timings are listed in this page and kept in sync with our Google Maps profile.'],
      ['Where are you located?', 'Tap the map or the directions button and Google Maps will guide you to our door.'],
      ['How do I contact you fastest?', 'The fastest way is a WhatsApp message or a phone call — both buttons are on this page.']
    ]
  };

  function sym() {
    const cur = App.store.get('settings.company.currency', 'ETB');
    const found = (App.dict.currencies || []).filter(c => c[0] === cur)[0];
    return found ? found[1] + ' ' : cur + ' ';
  }
  function money(n) { return n ? sym() + U.num(n) : 'Ask for price'; }
  function telHref(lead) { const d = App.msg.dial(lead); return d ? 'tel:+' + d : ''; }
  function waHref(lead, text) { const d = App.msg.dial(lead); return d ? 'https://wa.me/' + d + '?text=' + encodeURIComponent(text || '') : ''; }
  function mapsHref(lead) {
    if (lead.mapsUrl) return lead.mapsUrl;
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([lead.name, lead.address].join(' '));
  }
  function initials(name) { return String(name || 'B').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase(); }

  const gen = App.sitegen = {

    items(lead) { return (ITEMS[lead.businessType] || ITEMS.general).map(i => ({ name: i[0], price: i[1], desc: i[2] })); },
    headline(lead) { return HEADLINE[lead.businessType] || HEADLINE.general; },

    sectionsFor(typeKey) {
      const t = App.dict.typeOf(typeKey);
      const alias = App.dict.sectionAliases || {};
      return U.uniq((t.sections || []).map(s => alias[s] || s));
    },

    /* --------------------------------------------------------------- context */
    context(lead, templateId, options) {
      options = options || {};
      const tpl = (App.store.get('templates', []).filter(t => t.id === templateId)[0]) ||
        (App.store.get('templates', [])[0]);
      const t = App.dict.typeOf(lead.businessType);
      const rec = App.msg.recommend(lead);
      const company = App.store.get('settings.company', {});
      const vars = App.msg.vars(lead, { rec: rec });
      const city = lead.city || App.store.get('settings.google.city', '');
      /* AI copy (when the studio turned it on) replaces the built-in wording, but the
         business facts — name, phone, address, rating, reviews, hours — always come
         from the Google Maps record itself */
      const ai = options.ai || {};
      const aiItems = (ai.services || [])[0] ? ai.services : null;
      const photos = (lead.photos || []).length ? App.providers.photoUrls(lead, 1000, 6) : [];
      const reviews = (lead.reviewsList || []).filter(r => r.text).slice(0, 3);
      return {
        lead: lead, tpl: tpl, t: t, options: options, rec: rec, vars: vars, company: company, ai: ai,
        name: lead.name, city: city, headline: ai.headline || gen.headline(lead),
        tagline: ai.tagline || '', about: ai.about || '', ctaLine: ai.cta || '',
        items: aiItems ? aiItems.map(s => ({ name: s.name || 'Service', price: Number(s.price) || 0, desc: s.desc || '' })) : gen.items(lead),
        sections: options.sections || gen.sectionsFor(lead.businessType),
        tel: telHref(lead), wa: waHref(lead, 'Hello ' + lead.name + ', I found you online and would like to know more.'),
        maps: mapsHref(lead), photos: photos, reviews: reviews, hoursWeek: lead.hoursWeek || [],
        faqs: (ai.faq && ai.faq.length) ? ai.faq : (FAQ[lead.businessType] || FAQ._default),
        credit: options.credit !== false
      };
    },

    /* ------------------------------------------------------------ section views */
    R: {
      hero(c) {
        const style = c.tpl.hero || 'split';
        const btn = (href, label, cls, icon) => href ? '<a class="btn ' + cls + '" href="' + esc(href) + '"' + (href.indexOf('http') === 0 ? ' target="_blank" rel="noopener"' : '') + '>' + (icon ? '<i class="' + icon + '"></i> ' : '') + esc(label) + '</a>' : '';
        const actions = '<div class="btnrow">' + btn(c.tel, 'Call now', 'btn-accent', 'fa-solid fa-phone') + btn(c.wa, 'WhatsApp', 'btn-ghost', 'fa-brands fa-whatsapp') + btn(c.maps, 'Directions', 'btn-ghost', 'fa-solid fa-location-dot') + '</div>';
        const facts = '<div class="factcard">' +
          '<div class="factrow"><span>Rating</span><b>' + (Number(c.lead.rating) ? '★ ' + Number(c.lead.rating).toFixed(1) + ' / 5' : 'New listing') + '</b></div>' +
          '<div class="factrow"><span>Google reviews</span><b>' + U.num(c.lead.reviews || 0) + '</b></div>' +
          '<div class="factrow"><span>Category</span><b>' + esc(c.lead.category || c.t.label) + '</b></div>' +
          '<div class="factrow"><span>Hours</span><b>' + esc(c.lead.hours || 'Call to confirm') + '</b></div>' +
          '<div class="factrow"><span>Address</span><b>' + esc(c.lead.address || c.city) + '</b></div>' +
          '</div>';
        return '<section id="home" class="hero hero-' + esc(style) + '"><div class="wrap hero-grid">' +
          '<div class="hero-copy"><span class="eyebrow">' + esc(c.lead.category || c.t.label) + (c.city ? ' · ' + esc(c.city) : '') + '</span>' +
          '<h1>' + esc(c.headline) + '</h1>' +
          '<p class="lead">' + (c.tagline ? esc(c.tagline) + ' ' : '') + (Number(c.lead.rating) ? 'Rated ★' + Number(c.lead.rating).toFixed(1) + ' by ' + U.num(c.lead.reviews) + ' customers on Google. ' : '') + 'Get in touch and we will take care of the rest.</p>' +
          (c.photos[0] ? '<p class="muted small">Photos below are from their own Google Maps listing.</p>' : '') +
          actions + '</div>' + facts + '</div></section>';
      },

      about(c) {
        const paras = String(c.about || '').split(/\n\s*\n/).filter(Boolean);
        return '<section id="about" class="sec"><div class="wrap two">' +
          '<div><span class="eyebrow">About us</span><h2>Welcome to ' + esc(c.name) + '</h2>' +
          (paras.length
            ? paras.map(p => '<p>' + esc(p) + '</p>').join('')
            : '<p>We are a ' + esc((c.lead.category || c.t.label).toLowerCase()) + ' based in ' + esc(c.city || 'the city') + ', serving customers who value ' + esc(c.t.pitch.replace(/^a /, '')) + '.</p>' +
              '<p>Every day our team works to keep the standard that earned us ' + (Number(c.lead.rating) ? '★' + Number(c.lead.rating).toFixed(1) + ' from ' : '') + U.num(c.lead.reviews || 0) + ' Google reviews. Walk in, call, or message us on WhatsApp — whichever is easiest for you.</p>') +
          '<ul class="ticks">' + ['Trusted local business', 'Transparent pricing', 'Quick response on WhatsApp', 'Google Maps directions available'].map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>' +
          '<div class="surface pad"><h3>Why customers choose us</h3>' +
          '<p class="muted">Owner note: edit this text in a minute — the whole page is yours.</p>' +
          '<div class="factrow"><span>Response time</span><b>Under 1 hour</b></div>' +
          '<div class="factrow"><span>Payment</span><b>Cash · Telebirr · Card</b></div>' +
          '<div class="factrow"><span>Find us on</span><b>' + (c.lead.website ? 'Google & our website' : 'Google Maps') + '</b></div>' +
          '</div></div></section>';
      },

      services(c) {
        return '<section id="services" class="sec alt"><div class="wrap"><span class="eyebrow">What we offer</span><h2>Our services</h2>' +
          '<div class="grid three">' + c.items.map(i => '<article class="card"><h3>' + esc(i.name) + '</h3><p class="muted">' + esc(i.desc) + '</p>' +
            '<div class="price">' + esc(money(i.price)) + '</div>' + (c.wa ? '<a class="link" href="' + esc(waHref(c.lead, 'Hello ' + c.name + ', I want to know about: ' + i.name)) + '" target="_blank" rel="noopener">Ask about this →</a>' : '') + '</article>').join('') +
          '</div></div></section>';
      },

      menu(c) {
        return '<section id="menu" class="sec"><div class="wrap"><span class="eyebrow">Menu &amp; prices</span><h2>Our menu</h2>' +
          '<p class="muted small">Prices are indicative and easy to change — the owner can update this list any time.</p>' +
          '<div class="grid two">' + c.items.map(i => '<div class="menurow"><div><b>' + esc(i.name) + '</b><span class="muted small">' + esc(i.desc) + '</span></div><span class="price">' + esc(money(i.price)) + '</span></div>').join('') + '</div>' +
          (c.wa ? '<div class="btnrow center"><a class="btn btn-accent" href="' + esc(waHref(c.lead, 'Hello ' + c.name + ', I would like to place an order.')) + '" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> Order on WhatsApp</a></div>' : '') +
          '</div></section>';
      },

      products(c) {
        return '<section id="products" class="sec alt"><div class="wrap"><span class="eyebrow">Catalogue</span><h2>Products &amp; prices</h2>' +
          '<div class="grid three">' + c.items.map(i => '<article class="card"><div class="thumb">' + esc(initials(i.name)) + '</div><h3>' + esc(i.name) + '</h3><p class="muted">' + esc(i.desc) + '</p><div class="price">' + esc(money(i.price)) + '</div></article>').join('') + '</div></div></section>';
      },

      packages(c) {
        const items = c.items.slice(0, 3);
        return '<section id="packages" class="sec"><div class="wrap"><span class="eyebrow">Membership</span><h2>Packages</h2><div class="grid three">' +
          items.map((i, idx) => '<article class="card' + (idx === 1 ? ' featured' : '') + '">' + (idx === 1 ? '<span class="ribbon">Most popular</span>' : '') +
            '<h3>' + esc(i.name) + '</h3><div class="price big">' + esc(money(i.price)) + '</div><p class="muted">' + esc(i.desc) + '</p>' +
            '<ul class="ticks small">' + ['No hidden charge', 'Free first session', 'Flexible timing'].map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' +
            (c.wa ? '<a class="btn btn-accent full" href="' + esc(waHref(c.lead, 'Hello ' + c.name + ', I am interested in: ' + i.name)) + '" target="_blank" rel="noopener">Join now</a>' : '') + '</article>').join('') +
          '</div></div></section>';
      },

      pricing(c) {
        const items = c.items.slice(0, 3);
        return '<section id="pricing" class="sec alt"><div class="wrap"><span class="eyebrow">Price list</span><h2>Transparent pricing</h2>' +
          '<div class="grid three">' + items.map((i, idx) => '<article class="card' + (idx === 0 ? ' featured' : '') + '"><h3>' + esc(i.name) + '</h3>' +
            '<div class="price big">' + esc(money(i.price)) + '</div><p class="muted">' + esc(i.desc) + '</p></article>').join('') +
          '</div><p class="muted small center">Need something custom? ' + (c.tel ? 'Call us' : 'Message us') + ' — we quote within a day.</p></div></section>';
      },

      gallery(c) {
        if (c.photos && c.photos.length) {
          return '<section id="gallery" class="sec"><div class="wrap"><span class="eyebrow">Gallery</span><h2>A look inside</h2>' +
            '<div class="grid three">' + c.photos.map((u, i) =>
              '<a class="tile photo" href="' + esc(c.maps) + '" target="_blank" rel="noopener" title="Open their Google Maps listing">' +
              '<img src="' + esc(u) + '" alt="' + esc(c.name) + ' photo ' + (i + 1) + '" loading="lazy" onerror="this.parentNode.classList.add(&quot;tile-fallback&quot;);this.remove()" /></a>').join('') +
            '</div><p class="muted small center">Photos loaded from the business’s own Google Maps listing.</p></div></section>';
        }
        const labels = c.items.map(i => i.name).concat(['Store front', 'Our team']).slice(0, 6);
        return '<section id="gallery" class="sec"><div class="wrap"><span class="eyebrow">Gallery</span><h2>A look inside</h2>' +
          '<div class="grid three">' + labels.map((l, i) => '<div class="tile tile-' + ((i % 6) + 1) + '"><span>' + esc(l) + '</span>' +
            '<small>Replace with a real photo</small></div>').join('') + '</div>' +
          '<p class="muted small center">Tip: open this business in the app and its Google Maps photos load straight in here.</p></div></section>';
      },

      testimonials(c) {
        const r = Number(c.lead.rating) || 0;
        const real = c.reviews || [];
        return '<section id="reviews" class="sec alt"><div class="wrap"><span class="eyebrow">Reviews</span><h2>What customers say</h2>' +
          '<div class="ratingbox"><b>' + (r ? r.toFixed(1) : '—') + '</b><span class="stars">' + (r ? '★★★★★'.slice(0, Math.round(r)) : '') + '</span>' +
          '<span class="muted">from ' + U.num(c.lead.reviews || 0) + ' Google reviews</span>' +
          (c.lead.mapsUrl ? ' <a class="link" href="' + esc(c.lead.mapsUrl) + '" target="_blank" rel="noopener">Read them on Google →</a>' : '') + '</div>' +
          '<div class="grid two">' + (real.length
            ? real.map(rv => '<blockquote class="card">“' + esc(String(rv.text).slice(0, 300)) + '” <footer class="small">— ' + esc(rv.author) + (rv.when ? ', ' + esc(rv.when) : '') + ' · ★' + (rv.rating || '') + '</footer></blockquote>').join('')
            : '<blockquote class="card muted">“Paste one of your real Google reviews here.” <footer class="small">— verified customer (edit this block)</footer></blockquote>') + '</div>' +
          (real.length ? '<p class="muted small center">Real reviews, copied from the business’s Google Maps listing.</p>' : '') +
          '</div></section>';
      },

      team(c) {
        return '<section id="team" class="sec"><div class="wrap"><span class="eyebrow">Our people</span><h2>Meet the team</h2><div class="grid three">' +
          [['Owner', 'Founder'], ['Manager', 'Operations'], ['Specialist', 'Service']].map(m => '<article class="card center"><div class="avatar">' + esc(m[0].charAt(0)) + '</div><h3>' + esc(m[0]) + '</h3><p class="muted small">' + esc(m[1]) + '</p></article>').join('') +
          '</div></div></section>';
      },

      stats(c) {
        return '<section class="sec band"><div class="wrap grid four">' +
          [['★ ' + (Number(c.lead.rating) ? Number(c.lead.rating).toFixed(1) : '—'), 'Google rating'],
          [U.num(c.lead.reviews || 0), 'Customer reviews'],
          [esc(c.city || 'Local'), 'Service area'],
          ['< 1 hr', 'Response time']].map(s => '<div class="stat"><b>' + s[0] + '</b><span>' + esc(s[1]) + '</span></div>').join('') +
          '</div></section>';
      },

      faq(c) {
        return '<section id="faq" class="sec"><div class="wrap"><span class="eyebrow">Questions</span><h2>Frequently asked</h2>' +
          c.faqs.map(f => '<details class="faq"><summary>' + esc(f[0]) + '</summary><p>' + esc(f[1]) + '</p></details>').join('') + '</div></section>';
      },

      booking(c) {
        const opts = c.items.map(i => '<option>' + esc(i.name) + '</option>').join('');
        return '<section id="booking" class="sec alt"><div class="wrap two">' +
          '<div><span class="eyebrow">Booking</span><h2>Book an appointment</h2>' +
          '<p class="muted">Fill this in and it opens WhatsApp with your details already written — no app to install, no waiting on hold.</p></div>' +
          '<form class="surface pad" id="booking-form"><input class="in" name="name" placeholder="Your name" required />' +
          '<input class="in" name="phone" placeholder="Your phone number" required />' +
          '<label class="inlbl">Service</label><select class="in" name="service">' + opts + '</select>' +
          '<input class="in" name="date" type="date" />' +
          '<textarea class="in" name="note" rows="3" placeholder="Anything we should know?"></textarea>' +
          '<button class="btn btn-accent full" type="submit"><i class="fa-brands fa-whatsapp"></i> Send booking request</button>' +
          '<p class="muted small">Delivered to ' + esc(c.lead.phone || 'our number') + '</p></form></div></section>';
      },

      order(c) {
        return '<section id="order" class="sec"><div class="wrap"><span class="eyebrow">Order</span><h2>Order in one tap</h2>' +
          '<div class="grid two">' + c.items.map(i => '<div class="orderrow"><div><b>' + esc(i.name) + '</b><span class="muted small">' + esc(i.desc) + '</span></div>' +
            '<div class="orderright"><span class="price">' + esc(money(i.price)) + '</span>' +
            (c.wa ? '<a class="btn btn-accent sm" href="' + esc(waHref(c.lead, 'Hello ' + c.name + ', I want to order: ' + i.name)) + '" target="_blank" rel="noopener">Order</a>' : '') +
            '</div></div>').join('') + '</div></div></section>';
      },

      hours(c) {
        const week = c.hoursWeek || [];
        const rows = week.length
          ? week.map(line => {
            const parts = String(line).split(': ');
            const day = parts.shift();
            return '<div class="factrow"><span>' + esc(day) + '</span><b>' + esc(parts.join(': ')) + '</b></div>';
          }).join('')
          : '<div class="factrow"><span>Today</span><b>' + esc(c.lead.hours || 'Call to confirm') + '</b></div>' +
            ['Saturday – Thursday', 'Friday', 'Government holidays'].map((d, i) => '<div class="factrow"><span>' + esc(d) + '</span><b>' + esc(['10:00 – 21:00', '3:00 – 21:00', 'Call ahead'][i]) + '</b></div>').join('');
        return '<section id="hours" class="sec alt"><div class="wrap"><span class="eyebrow">Timing</span><h2>Opening hours</h2>' +
          '<div class="surface pad">' + rows +
          '<p class="muted small">' + (week.length ? 'Taken from our Google listing — always current.' : 'Timings are easy to update — ask us to change them any time.') + '</p></div></div></section>';
      },

      contact(c) {
        return '<section id="contact" class="sec"><div class="wrap two"><div><span class="eyebrow">Contact</span><h2>Talk to us</h2>' +
          '<div class="factrow"><span>Phone</span><b>' + esc(c.lead.phone || '—') + '</b></div>' +
          (c.lead.email ? '<div class="factrow"><span>Email</span><b>' + esc(c.lead.email) + '</b></div>' : '') +
          '<div class="factrow"><span>Address</span><b>' + esc(c.lead.address || c.city) + '</b></div>' +
          '<div class="factrow"><span>Hours</span><b>' + esc(c.lead.hours || 'Call to confirm') + '</b></div>' +
          '<div class="btnrow">' + (c.tel ? '<a class="btn btn-accent" href="' + esc(c.tel) + '"><i class="fa-solid fa-phone"></i> Call</a>' : '') +
          (c.wa ? '<a class="btn btn-ghost" href="' + esc(c.wa) + '" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>' : '') +
          (c.maps ? '<a class="btn btn-ghost" href="' + esc(c.maps) + '" target="_blank" rel="noopener"><i class="fa-solid fa-map"></i> Directions</a>' : '') + '</div></div>' +
          '<div class="surface pad"><h3>Quick message</h3><p class="muted small">Send us your question — we reply fast.</p>' +
          (c.wa ? '<a class="btn btn-accent full" href="' + esc(waHref(c.lead, 'Hello ' + c.name + ', I have a question.')) + '" target="_blank" rel="noopener">Message on WhatsApp</a>' : '') +
          '</div></div></section>';
      },

      map(c) {
        const q = encodeURIComponent([c.name, c.lead.address || c.city].join(' '));
        /* the live Google embed is opt-in: pages stay fast, offline-safe and free of third-party calls by default */
        const box = c.options.mapEmbed
          ? '<div class="mapbox"><iframe title="Map" loading="lazy" src="https://www.google.com/maps?q=' + q + '&output=embed"></iframe></div>'
          : '<div class="mapbox mapstatic"><div class="mapinner"><i class="fa-solid fa-map-location-dot"></i>' +
          '<p><b>' + esc(c.lead.address || c.city || 'Tap to open the map') + '</b></p>' +
          '<p class="muted small">Open Google Maps for live directions</p></div></div>';
        return '<section id="map" class="sec alt"><div class="wrap"><span class="eyebrow">Find us</span><h2>On the map</h2>' +
          box +
          '<div class="btnrow center"><a class="btn btn-accent" href="' + esc(c.maps) + '" target="_blank" rel="noopener"><i class="fa-solid fa-location-dot"></i> Open in Google Maps</a></div></div></section>';
      },

      cta(c) {
        return '<section class="sec ctaband"><div class="wrap center"><h2>' + esc(c.headline) + '</h2>' +
          '<p class="muted">' + esc(c.ctaLine || 'One message is all it takes — we answer within an hour during business hours.') + '</p>' +
          '<div class="btnrow center">' + (c.tel ? '<a class="btn btn-accent" href="' + esc(c.tel) + '">Call ' + esc(c.lead.phone || '') + '</a>' : '') +
          (c.wa ? '<a class="btn btn-ghost" href="' + esc(c.wa) + '" target="_blank" rel="noopener">WhatsApp us</a>' : '') + '</div></div></section>';
      }
    },

    /* ------------------------------------------------------- sample pipeline */
    /**
     * The preferred way: clone the finished sample that fits this category and
     * change only the information. Nothing about the design is regenerated.
     */
    fromSample(lead, sample, options) {
      options = options || {};
      const out = App.samples.fill(sample, lead, options);
      const t = App.dict.typeOf(lead.businessType);
      const title = lead.name + ' \u2014 ' + (lead.category || t.label) +
        ((lead.areaLabel || lead.city) ? ' in ' + (lead.areaLabel || lead.city) : '');
      return {
        title: title,
        html: out.html,
        meta: {
          sampleId: sample.id, sampleName: sample.name, category: sample.category,
          templateId: sample.id, templateName: sample.name,
          swapped: out.swapped, placeholders: out.used,
          businessType: lead.businessType, generatedAt: U.now(), title: title, mode: 'sample'
        }
      };
    },

    /** which sample a business will use (shown in the UI before building) */
    sampleFor(lead) { return App.samples.forBusiness(lead); },

    /* ------------------------------------------------------------------ build */
    build(o) {
      const wantSample = o.sampleId !== undefined ? o.sampleId : (o.lead && o.lead.sampleId);
      const off = o.preferSample === false || wantSample === 'none' || wantSample === '';
      const sample = off ? null
        : (wantSample ? App.samples.find(wantSample)
          // no explicit choice: a named template wins, otherwise the category sample
          : (o.templateId ? null : App.samples.forBusiness(o.lead)));
      if (sample) return gen.fromSample(o.lead, sample, o.options || {});
      const c = gen.context(o.lead, o.templateId, o.options || {});
      const tpl = c.tpl;
      const t = c.t;
      const font = tpl.font || "'Segoe UI', system-ui, sans-serif";
      const title = c.name + ' — ' + (c.lead.category || t.label) + (c.city ? ' in ' + c.city : '') + ' | ' + c.headline;
      const desc = c.name + ' is a ' + (c.lead.category || t.label).toLowerCase() + ' in ' + (c.city || 'your city') + '. ' + c.headline + '. Call ' + (c.lead.phone || '') + ' or message us on WhatsApp.';

      const navItems = c.sections
        .filter(k => k !== 'hero' && gen.R[k])
        .map(k => '<a href="#' + esc(k === 'cta' ? 'contact' : k) + '">' + esc(sectionLabel(k)) + '</a>').join('');

      const body = c.sections.map(k => (gen.R[k] ? gen.R[k](c) : '')).join('\n');

      const jsonLd = {
        '@context': 'https://schema.org', '@type': 'LocalBusiness', name: c.name,
        description: desc, telephone: c.lead.phone || undefined, address: c.lead.address || undefined,
        url: c.lead.website || undefined,
        aggregateRating: Number(c.lead.rating) ? { '@type': 'AggregateRating', ratingValue: Number(c.lead.rating), reviewCount: Number(c.lead.reviews) || 1 } : undefined
      };

      const css = cssFor(tpl);
      const script = bookingScript(c);

      return {
        title: title,
        html: '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8" />\n' +
          '<meta name="viewport" content="width=device-width, initial-scale=1" />\n' +
          '<title>' + esc(title) + '</title>\n' +
          '<meta name="description" content="' + esc(desc) + '" />\n' +
          '<meta property="og:title" content="' + esc(c.name) + '" />\n' +
          '<meta property="og:description" content="' + esc(desc) + '" />\n' +
          '<meta property="og:type" content="business.business" />\n' +
          '<link rel="icon" href="data:image/svg+xml,' + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='" + tpl.accent + "'/><text x='16' y='22' font-size='15' font-family='sans-serif' font-weight='bold' text-anchor='middle' fill='" + tpl.bg + "'>" + initials(c.name) + "</text></svg>") + '" />\n' +
          '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />\n' +
          '<script type="application/ld+json">' + JSON.stringify(jsonLd, (k, v) => v === undefined ? undefined : v) + '<\/script>\n' +
          '<style>' + css + '</style>\n</head>\n<body>\n' +
          '<header class="topbar"><div class="wrap bar">' +
          '<a class="brand" href="#home"><span class="mark">' + esc(initials(c.name)) + '</span><span><b>' + esc(c.name) + '</b><small>' + esc(c.lead.category || t.label) + (c.city ? ' · ' + esc(c.city) : '') + '</small></span></a>' +
          '<nav class="nav" id="nav">' + navItems + '</nav>' +
          '<div class="bar-actions">' + (c.tel ? '<a class="btn btn-accent sm" href="' + esc(c.tel) + '"><i class="fa-solid fa-phone"></i> Call</a>' : '') +
          '<button class="burger" id="burger" aria-label="Menu"><i class="fa-solid fa-bars"></i></button></div>' +
          '</div></header>\n' + body + '\n' + footer(c) + floating(c) + script + '\n</body>\n</html>',
        meta: { templateId: tpl.id, templateName: tpl.name, sections: c.sections, businessType: c.lead.businessType, generatedAt: U.now(), title: title }
      };
    },

    /** build + store a draft site record for a lead */
    save(lead, templateId, options) {
      const out = gen.build({ lead: lead, templateId: templateId, sampleId: options && options.sampleId, options: options });
      const key = out.meta.mode === 'sample' ? out.meta.sampleId : templateId;
      const existing = App.store.get('sites', []).filter(s => s.generatedFrom && s.generatedFrom.leadId === lead.id && s.templateId === key)[0];
      const rec = existing || {
        id: U.uid('site'), name: (U.slug(lead.name) || 'site') + '.com (draft)', kind: 'draft', status: 'draft',
        clientId: lead.clientId || '', clientName: lead.name, url: '', templateId: key,
        sampleId: out.meta.sampleId || '', sampleName: out.meta.sampleName || '',
        businessType: lead.businessType, stack: 'Generated static page', hostingProvider: '', repoUrl: '',
        price: App.msg.recommend(lead).total, hostRenewDate: '', domainRenewDate: '',
        notes: 'Auto-generated from ' + (lead.source === 'google' ? 'Google Maps data' : 'the saved business data') +
          ' · ' + (out.meta.mode === 'sample' ? 'sample \u201c' + (out.meta.sampleName || '') + '\u201d' : 'template ' + (out.meta.templateName || '')),
        generatedFrom: { leadId: lead.id, businessType: lead.businessType, placeId: lead.placeId || '' },
        createdAt: U.now(), updatedAt: U.now()
      };
      App.store.setHTML(rec.id, out.html);
      if (existing) {
        App.store.patch('sites', rec.id, { updatedAt: U.now(), price: rec.price, sampleId: rec.sampleId || '' });
      } else {
        const sites = App.store.get('sites', []).slice();
        sites.unshift(rec);
        App.store.set('sites', sites, { silent: true });
        App.store.patch('leads', lead.id, { siteId: rec.id, siteTemplateId: key, siteUrl: '' });
      }
      App.store.save();
      App.log('site', 'Website generated for ' + lead.name + ' from ' + (out.meta.mode === 'sample' ? 'sample \u201c' + (out.meta.sampleName || '') + '\u201d' : 'template ' + (out.meta.templateName || templateId)), lead.id);
      App.emit('state:changed', { path: 'sites' });
      return { site: rec, html: out.html, meta: out.meta };
    },

    htmlFor(site) { return App.store.html(site.id); },

    rebuild(siteId) {
      const site = App.store.find('sites', siteId);
      if (!site) return null;
      const lead = site.generatedFrom ? App.store.find('leads', site.generatedFrom.leadId) : null;
      const source = lead || { id: '', name: site.clientName || site.name, businessType: site.businessType || 'general', category: App.dict.typeLabel(site.businessType), city: App.store.get('settings.google.city', '') };
      const out = gen.build({ lead: source, templateId: site.templateId, options: {} });
      App.store.setHTML(site.id, out.html);
      App.store.patch('sites', site.id, { updatedAt: U.now() });
      return out;
    }
  };

  function sectionLabel(key) {
    const s = App.dict.sections[key];
    if (key === 'testimonials') return 'Reviews';
    if (key === 'menu') return 'Menu';
    if (key === 'hours') return 'Hours';
    return s ? s.label.split(' / ')[0] : U.title(key);
  }

  function footer(c) {
    return '<footer class="foot"><div class="wrap fgrid">' +
      '<div><b>' + esc(c.name) + '</b><p class="muted small">' + esc(c.lead.address || c.city) + '</p>' +
      '<p class="muted small">' + (c.tel ? 'Phone: ' + esc(c.lead.phone || '') : '') + (c.lead.email ? ' · ' + esc(c.lead.email) : '') + '</p></div>' +
      '<div><b>Quick links</b><p class="small"><a class="link" href="#services">Services</a> · <a class="link" href="#contact">Contact</a> · <a class="link" href="#map">Map</a></p></div>' +
      '<div><b>Hours</b><p class="muted small">' + esc(c.lead.hours || c.company.workingHours || 'Call to confirm') + '</p></div>' +
      '</div><div class="wrap fbottom"><span class="muted small">© ' + new Date().getFullYear() + ' ' + esc(c.name) + '. All rights reserved.</span>' +
      (c.credit ? '<span class="muted small">Website by <a class="link" href="' + esc(c.company.website || '#') + '" target="_blank" rel="noopener">' + esc(c.company.name || 'Triverse Studio') + '</a></span>' : '') +
      '</div></footer>';
  }

  function floating(c) {
    if (!c.wa) return '';
    return '<a class="float" href="' + esc(c.wa) + '" target="_blank" rel="noopener" aria-label="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>';
  }

  function bookingScript(c) {
    const num = App.msg.dial(c.lead);
    return '<script>\n(function(){\n' +
      '  var b=document.getElementById("burger"),n=document.getElementById("nav");\n' +
      '  if(b&&n){b.addEventListener("click",function(){n.classList.toggle("open");});}\n' +
      '  var f=document.getElementById("booking-form"),num="' + num + '";\n' +
      '  if(f){f.addEventListener("submit",function(e){e.preventDefault();\n' +
      '    var g=function(nm){var el=f.querySelector("[name="+nm+"]");return el?el.value:"";};\n' +
      '    var msg="New booking request%0A%0AName: "+encodeURIComponent(g("name"))+"%0APhone: "+encodeURIComponent(g("phone"))+' +
      '"%0AService: "+encodeURIComponent(g("service"))+"%0APreferred date: "+encodeURIComponent(g("date"))+"%0ANote: "+encodeURIComponent(g("note"));\n' +
      '    if(num){window.open("https://wa.me/"+num+"?text="+msg,"_blank");}\n' +
      '  });}\n' +
      '})();\n<\/script>';
  }

  function cssFor(tpl) {
    const dark = tpl.style !== 'light';
    return [
      ':root{--accent:' + tpl.accent + ';--accent-soft:' + tpl.accentSoft + ';--bg:' + tpl.bg + ';--surface:' + tpl.surface + ';--border:' + tpl.border + ';--text:' + tpl.text + ';--muted:' + tpl.muted + ';--radius:' + tpl.radius + ';--font:' + tpl.font + '}',
      '*{box-sizing:border-box}html{scroll-behavior:smooth}',
      'body{margin:0;background:var(--bg);color:var(--text);font-family:var(--font);line-height:1.6;-webkit-font-smoothing:antialiased}',
      'a{color:inherit;text-decoration:none}img{max-width:100%}',
      '.wrap{max-width:1120px;margin:0 auto;padding:0 20px}',
      'h1{font-size:clamp(28px,4.6vw,50px);line-height:1.1;margin:.2em 0 .4em;letter-spacing:-.02em}',
      'h2{font-size:clamp(22px,3vw,34px);line-height:1.2;margin:.2em 0 .5em;letter-spacing:-.01em}',
      'h3{font-size:16px;margin:0 0 .4em}p{margin:.4em 0}.muted{color:var(--muted)}.small{font-size:12px}',
      '.eyebrow{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin-bottom:6px}',
      '.center{text-align:center}',
      '.btn{display:inline-flex;align-items:center;gap:8px;font-weight:700;font-size:14px;padding:12px 20px;border-radius:999px;border:1px solid transparent;transition:.18s}',
      '.btn-accent{background:var(--accent);color:' + (dark ? '#0a0b0d' : '#fff') + '}.btn-accent:hover{filter:brightness(1.08);transform:translateY(-1px)}',
      '.btn-ghost{border-color:var(--border);background:var(--accent-soft);color:var(--text)}.btn-ghost:hover{border-color:var(--accent)}',
      '.btn.sm{padding:8px 14px;font-size:12px}.btn.full{width:100%;justify-content:center;margin-top:10px}',
      '.btnrow{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}.btnrow.center{justify-content:center}',
      '.link{color:var(--accent);font-weight:600}.link:hover{text-decoration:underline}',
      /* header */
      '.topbar{position:sticky;top:0;z-index:40;backdrop-filter:blur(12px);background:' + (dark ? 'rgba(8,9,11,.78)' : 'rgba(255,255,255,.82)') + ';border-bottom:1px solid var(--border)}',
      '.bar{display:flex;align-items:center;gap:16px;padding:12px 20px}',
      '.brand{display:flex;align-items:center;gap:10px;font-weight:800}',
      '.brand small{display:block;font-size:11px;color:var(--muted);font-weight:500}',
      '.mark{width:38px;height:38px;border-radius:12px;background:var(--accent);color:' + (dark ? '#0a0b0d' : '#fff') + ';display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px}',
      '.nav{margin-left:auto;display:flex;gap:18px;font-size:13px;font-weight:600}',
      '.nav a{color:var(--muted)}.nav a:hover{color:var(--accent)}',
      '.bar-actions{display:flex;align-items:center;gap:8px}',
      '.burger{display:none;background:none;border:1px solid var(--border);color:var(--text);border-radius:10px;padding:8px 10px;cursor:pointer}',
      '@media(max-width:900px){.nav{position:absolute;top:64px;left:0;right:0;background:var(--surface);border-bottom:1px solid var(--border);flex-direction:column;gap:0;padding:8px 20px;display:none}.nav.open{display:flex}.nav a{padding:10px 0;border-bottom:1px solid var(--border)}.burger{display:inline-block}}',
      /* hero */
      '.hero{padding:70px 0 60px;background:radial-gradient(1000px 420px at 15% -10%,var(--accent-soft),transparent 70%)}',
      '.hero-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:36px;align-items:center}',
      '@media(max-width:900px){.hero-grid{grid-template-columns:1fr}.hero{padding:46px 0}}',
      '.lead{font-size:16px;color:var(--muted);max-width:56ch}',
      '.factcard,.surface{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px}',
      '.pad{padding:22px}',
      '.factrow{display:flex;justify-content:space-between;gap:14px;padding:9px 0;border-bottom:1px dashed var(--border);font-size:13px}',
      '.factrow:last-child{border-bottom:0}.factrow span{color:var(--muted)}.factrow b{text-align:right}',
      /* sections */
      '.sec{padding:64px 0}.sec.alt{background:' + (dark ? 'rgba(255,255,255,.02)' : 'rgba(15,23,42,.03)') + '}',
      '.band{background:var(--accent-soft);border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:28px 0}',
      '.ctaband{background:radial-gradient(700px 260px at 50% 0,var(--accent-soft),transparent 70%)}',
      '.two{display:grid;grid-template-columns:1fr 1fr;gap:34px;align-items:start}',
      '.grid{display:grid;gap:18px}.grid.two{grid-template-columns:1fr 1fr}.grid.three{grid-template-columns:repeat(3,1fr)}.grid.four{grid-template-columns:repeat(4,1fr)}',
      '@media(max-width:900px){.grid.three,.grid.four{grid-template-columns:1fr 1fr}}@media(max-width:640px){.two,.grid.two,.grid.three,.grid.four{grid-template-columns:1fr}.sec{padding:44px 0}}',
      '.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;position:relative}',
      '.card:hover{border-color:var(--accent)}.card.featured{border-color:var(--accent)}',
      '.card .price{font-weight:800;color:var(--accent);margin:6px 0}',
      '.price.big{font-size:26px}.ribbon{position:absolute;top:-10px;right:14px;background:var(--accent);color:' + (dark ? '#0a0b0d' : '#fff') + ';font-size:10px;font-weight:800;padding:3px 10px;border-radius:999px}',
      '.thumb{height:74px;border-radius:12px;background:var(--accent-soft);color:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:20px;margin-bottom:12px}',
      '.avatar{width:56px;height:56px;border-radius:999px;background:var(--accent-soft);color:var(--accent);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;margin:0 auto 10px}',
      '.ticks{list-style:none;padding:0;margin:14px 0}.ticks li{padding-left:26px;position:relative;margin:6px 0;font-size:14px}',
      '.ticks li:before{content:"✓";position:absolute;left:0;color:var(--accent);font-weight:900}',
      '.ticks.small li{font-size:13px}',
      '.menurow,.orderrow{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:12px 0;border-bottom:1px dashed var(--border)}',
      '.menurow b,.orderrow b{display:block}.menurow .muted,.orderrow .muted{display:block;font-size:12px}',
      '.menurow .price,.orderright .price{color:var(--accent);font-weight:800}',
      '.orderright{display:flex;align-items:center;gap:10px}',
      '.tile{height:150px;border-radius:var(--radius);border:1px solid var(--border);display:flex;flex-direction:column;justify-content:flex-end;padding:14px;font-weight:700}',
      '.tile span{position:relative}.tile small{color:var(--muted);font-weight:400;position:relative}',
      '.tile-1{background:linear-gradient(140deg,var(--accent-soft),transparent)}',
      '.tile-2{background:linear-gradient(140deg,rgba(120,120,255,.18),transparent)}',
      '.tile-3{background:linear-gradient(140deg,rgba(255,140,120,.16),transparent)}',
      '.tile-4{background:linear-gradient(140deg,rgba(120,255,200,.16),transparent)}',
      '.tile-5{background:linear-gradient(140deg,rgba(255,200,90,.16),transparent)}',
      '.tile-6{background:linear-gradient(140deg,rgba(200,120,255,.16),transparent)}',
      '.tile.photo{padding:0;overflow:hidden;background:var(--surface)}',
      '.tile.photo img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .8s ease}',
      '.tile.photo:hover img{transform:scale(1.06)}',
      '.ratingbox{display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:18px;margin-bottom:20px}',
      '.ratingbox b{font-size:30px}.stars{color:var(--accent);font-size:18px;letter-spacing:2px}',
      'blockquote{margin:0;font-style:italic}blockquote footer{margin-top:10px}',
      '.faq{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:10px}',
      '.faq summary{cursor:pointer;font-weight:700}.faq p{color:var(--muted);font-size:14px}',
      '.stat b{display:block;font-size:clamp(20px,3vw,30px);color:var(--accent)}.stat span{font-size:12px;color:var(--muted)}',
      '.in,.inlbl{display:block;width:100%}.in{background:' + (dark ? 'rgba(255,255,255,.04)' : '#fff') + ';border:1px solid var(--border);border-radius:12px;padding:12px 14px;color:var(--text);font-family:inherit;font-size:14px;margin-bottom:10px}',
      '.in:focus{outline:none;border-color:var(--accent)}.inlbl{font-size:12px;color:var(--muted);margin-bottom:4px;font-weight:600}',
      '.mapbox{border-radius:var(--radius);overflow:hidden;border:1px solid var(--border);height:380px;background:linear-gradient(140deg,var(--accent-soft),transparent)}',
      '.mapbox iframe{width:100%;height:100%;border:0}',
      '.mapstatic{display:flex;align-items:center;justify-content:center;text-align:center}',
      '.mapinner i{font-size:34px;color:var(--accent);display:block;margin-bottom:10px}',
      '.mapinner p{margin:2px 0}',
      '.foot{border-top:1px solid var(--border);padding:40px 0 22px;margin-top:20px}',
      '.fgrid{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:24px}@media(max-width:760px){.fgrid{grid-template-columns:1fr}}',
      '.fbottom{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;border-top:1px solid var(--border);margin-top:22px;padding-top:16px}',
      '.float{position:fixed;right:18px;bottom:18px;width:56px;height:56px;border-radius:999px;background:#25D366;color:#fff;display:flex;align-items:center;justify-content:center;font-size:26px;box-shadow:0 12px 30px -8px rgba(0,0,0,.6);z-index:50}',
      '.float:hover{transform:translateY(-2px)}'
    ].join('\n');
  }
})(window);
