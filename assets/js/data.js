/* =============================================================================
   Triverse OS — dictionaries + first-run settings  (Ethiopia edition)
   Everything the system ships with on first run: company profile, service
   catalogue, design templates, business-type presets, Addis Ababa areas and
   the cold-message library. Every business, client, invoice and website is
   real data — the system starts with none of them.
   ========================================================================== */
(function (global) {
  'use strict';

  const App = global.App;
  const U = App.util;

  /* turn a stored handle, @name or full URL into one clickable address */
  const digits = v => String(v || '').replace(/[^0-9]/g, '');
  function handle(v, base) {
    const s = String(v || '').trim();
    if (!s) return '';
    if (/^https?:/i.test(s)) return s;
    return base + s.replace(/^@/, '');
  }

  /* ------------------------------- dictionaries ---------------------------- */
  App.dict = {
    currencies: [
      ['ETB', 'Br'], ['USD', '$'], ['EUR', '€'], ['GBP', '£'], ['AED', 'AED'],
      ['SAR', 'SAR'], ['KES', 'KSh'], ['DJF', 'Fdj'], ['INR', '₹'], ['CNY', '¥']
    ],

    channels: [
      ['whatsapp', 'WhatsApp', 'fa-whatsapp', 'brands', 'lime'],
      ['telegram', 'Telegram', 'fa-telegram', 'brands', 'blue'],
      ['email', 'Email', 'fa-envelope', 'solid', 'violet'],
      ['sms', 'SMS', 'fa-comment-sms', 'solid', 'amber'],
      ['call', 'Phone call', 'fa-phone', 'solid', 'muted'],
      ['facebook', 'Facebook', 'fa-facebook', 'brands', 'blue'],
      ['instagram', 'Instagram', 'fa-instagram', 'brands', 'violet']
    ],

    /* the studio's own public profiles — order is the order they are shown.
       `key` matches settings.company.socials, `url` builds the link when the
       stored value is a handle rather than a full address. */
    socials: [
      { key: 'website', label: 'Website', icon: 'fa-globe', tone: 'lime', url: v => v },
      { key: 'portfolio', label: 'Portfolio', icon: 'fa-images', tone: 'blue', url: v => v },
      { key: 'telegramChannel', label: 'Telegram channel', icon: 'fa-telegram', brand: true, tone: 'blue', url: v => handle(v, 'https://t.me/') },
      { key: 'telegramGroup', label: 'Telegram group', icon: 'fa-comments', tone: 'blue', url: v => handle(v, 'https://t.me/') },
      { key: 'whatsapp', label: 'WhatsApp', icon: 'fa-whatsapp', brand: true, tone: 'lime', url: v => /^https?:/i.test(v) ? v : 'https://wa.me/' + digits(v) },
      { key: 'instagram', label: 'Instagram', icon: 'fa-instagram', brand: true, tone: 'violet', url: v => handle(v, 'https://instagram.com/') },
      { key: 'facebook', label: 'Facebook', icon: 'fa-facebook', brand: true, tone: 'blue', url: v => handle(v, 'https://facebook.com/') },
      { key: 'tiktok', label: 'TikTok', icon: 'fa-tiktok', brand: true, tone: 'muted', url: v => handle(v, 'https://tiktok.com/@') },
      { key: 'linkedin', label: 'LinkedIn', icon: 'fa-linkedin', brand: true, tone: 'blue', url: v => handle(v, 'https://linkedin.com/in/') },
      { key: 'upwork', label: 'Upwork', icon: 'fa-briefcase', tone: 'lime', url: v => handle(v, 'https://upwork.com/') },
      { key: 'fiverr', label: 'Fiverr', icon: 'fa-handshake', tone: 'lime', url: v => handle(v, 'https://fiverr.com/') },
      { key: 'afriwork', label: 'Afriwork', icon: 'fa-bullseye', tone: 'amber', url: v => handle(v, 'https://afriworket.com/') },
      { key: 'github', label: 'GitHub', icon: 'fa-github', brand: true, tone: 'muted', url: v => handle(v, 'https://github.com/') }
    ],

    /* discovery funnel */
    leadStages: ['new', 'qualified', 'contacted', 'replied', 'interested', 'proposal', 'won', 'lost', 'rejected', 'skipped'],
    pipelineStages: ['new', 'qualified', 'contacted', 'replied', 'interested', 'proposal', 'won'],
    leadTones: { new: 'muted', qualified: 'blue', contacted: 'blue', replied: 'violet', interested: 'lime', proposal: 'amber', won: 'lime', lost: 'red', rejected: 'red', skipped: 'muted' },

    clientStages: ['prospect', 'active', 'paused', 'past', 'rejected'],
    clientTones: { prospect: 'blue', active: 'lime', paused: 'amber', past: 'muted', rejected: 'red' },

    paymentStatuses: ['paid', 'partial', 'pending', 'overdue', 'cancelled'],
    paymentTones: { paid: 'lime', partial: 'amber', pending: 'blue', overdue: 'red', cancelled: 'muted' },
    paymentMethods: ['Cash', 'Telebirr', 'CBE Birr', 'M-Pesa', 'Chapa', 'Bank transfer (CBE)', 'Bank transfer (Awash)', 'Bank transfer (Dashen)', 'Card', 'PayPal', 'Wise', 'Crypto/USDT', 'Other'],

    siteKinds: [['hosted', 'Hosted website'], ['client', 'Client website'], ['sample', 'Sample / demo page'], ['draft', 'Generated draft'], ['template', 'Template file']],
    siteStatuses: ['live', 'draft', 'staging', 'offline', 'archived'],
    siteTones: { live: 'lime', draft: 'amber', staging: 'blue', offline: 'red', archived: 'muted' },

    /* website builder sections */
    sections: {
      hero: { label: 'Hero / headline', icon: 'fa-image' },
      about: { label: 'About / story', icon: 'fa-circle-info' },
      services: { label: 'Services', icon: 'fa-list-check' },
      menu: { label: 'Menu / price list', icon: 'fa-book-open' },
      products: { label: 'Products', icon: 'fa-box' },
      packages: { label: 'Packages', icon: 'fa-layer-group' },
      pricing: { label: 'Pricing plans', icon: 'fa-tags' },
      gallery: { label: 'Gallery', icon: 'fa-images' },
      testimonials: { label: 'Reviews / testimonials', icon: 'fa-star' },
      team: { label: 'Team', icon: 'fa-users' },
      stats: { label: 'Numbers / trust bar', icon: 'fa-chart-simple' },
      faq: { label: 'FAQ', icon: 'fa-circle-question' },
      booking: { label: 'Booking / appointment', icon: 'fa-calendar-check' },
      order: { label: 'Order on WhatsApp', icon: 'fa-bag-shopping' },
      hours: { label: 'Opening hours', icon: 'fa-clock' },
      contact: { label: 'Contact block', icon: 'fa-address-book' },
      map: { label: 'Google map', icon: 'fa-map-location-dot' },
      cta: { label: 'Call to action', icon: 'fa-bullhorn' }
    },

    /* business types: key,label,icon,accent,sections,typical project value (ETB),pitch angle
       The value is the real package we would quote: the 15,000 base plus only the
       functions that industry actually needs. */
    businessTypes: [
      ['restaurant', 'Restaurant', 'fa-utensils', '#f97316', 'hero,about,menu,gallery,testimonials,order,hours,map,contact', 30000, 'online menu + table booking so customers stop calling for the menu'],
      ['cafe', 'Café / Bakery', 'fa-mug-hot', '#d97706', 'hero,about,menu,gallery,testimonials,order,hours,map,contact', 25000, 'a digital menu with photos that brings in walk-in customers'],
      ['coffee', 'Coffee Roastery / Export', 'fa-mug-saucer', '#a16207', 'hero,about,products,menu,stats,testimonials,order,contact', 35000, 'a single page that tells the origin story and takes export enquiries'],
      ['fastfood', 'Fast Food / Takeaway', 'fa-burger', '#ef4444', 'hero,menu,order,gallery,hours,map,contact', 22000, 'one-tap ordering on WhatsApp instead of missed calls at peak hours'],
      ['hotel', 'Hotel / Guest House', 'fa-hotel', '#0ea5e9', 'hero,about,pricing,gallery,testimonials,booking,faq,map,contact', 45000, 'direct bookings that skip the commission you pay to travel sites'],
      ['clinic', 'Clinic / Diagnostic Centre', 'fa-stethoscope', '#22d3ee', 'hero,services,about,testimonials,booking,hours,faq,map,contact', 40000, 'appointment booking with doctor schedules and report collection info'],
      ['dentist', 'Dental Clinic', 'fa-tooth', '#38bdf8', 'hero,services,about,pricing,testimonials,booking,faq,map,contact', 40000, 'treatment pages + online appointments so the front desk is free'],
      ['pharmacy', 'Pharmacy', 'fa-prescription-bottle-medical', '#34d399', 'hero,services,products,hours,order,map,contact', 25000, 'medicine availability and a home-delivery order form'],
      ['gym', 'Gym / Fitness Studio', 'fa-dumbbell', '#f43f5e', 'hero,about,packages,pricing,gallery,team,testimonials,booking,contact', 30000, 'membership plans, trainer profiles and trial-signup forms'],
      ['salon', 'Salon / Beauty Parlour', 'fa-scissors', '#ec4899', 'hero,services,pricing,gallery,testimonials,booking,hours,contact', 30000, 'a service price list with online booking slots'],
      ['spa', 'Spa / Wellness', 'fa-spa', '#a78bfa', 'hero,services,packages,gallery,testimonials,booking,hours,contact', 35000, 'package menus and a calm gallery that sells relaxation'],
      ['realestate', 'Real Estate', 'fa-building', '#14b8a6', 'hero,about,products,gallery,stats,testimonials,cta,contact', 55000, 'property listings with filters and enquiry capture'],
      ['carrepair', 'Car Repair / Garage', 'fa-car', '#f59e0b', 'hero,services,about,pricing,stats,testimonials,booking,hours,contact', 30000, 'service prices, booking form and trust badges'],
      ['travel', 'Travel & Tour Agency', 'fa-plane', '#60a5fa', 'hero,packages,about,gallery,testimonials,booking,faq,contact', 45000, 'tour packages with enquiry forms and itinerary pages'],
      ['tuition', 'Coaching / Tutorial Centre', 'fa-graduation-cap', '#8b5cf6', 'hero,menu,about,team,stats,testimonials,booking,contact', 30000, 'course details and online registration for parents'],
      ['school', 'School / Academy', 'fa-school', '#6366f1', 'hero,about,services,stats,team,gallery,booking,contact', 50000, 'admission info, staff pages and notice downloads'],
      ['boutique', 'Clothing / Boutique', 'fa-shirt', '#d946ef', 'hero,products,about,gallery,testimonials,order,contact', 30000, 'a product catalogue with WhatsApp / cash-on-delivery ordering'],
      ['electronics', 'Electronics Store', 'fa-mobile-screen', '#06b6d4', 'hero,products,about,pricing,faq,testimonials,order,contact', 35000, 'product list, warranty info and an order form'],
      ['furniture', 'Furniture Store', 'fa-couch', '#b45309', 'hero,products,about,gallery,testimonials,order,contact', 30000, 'catalogue with dimensions and price ranges'],
      ['grocery', 'Grocery / Supermarket', 'fa-cart-shopping', '#84cc16', 'hero,products,pricing,delivery,order,map,contact', 25000, 'daily offers plus home-delivery ordering'],
      ['construction', 'Construction / Interior', 'fa-trowel-bricks', '#eab308', 'hero,services,gallery,stats,testimonials,faq,contact', 45000, 'a project portfolio that wins tenders and contracts'],
      ['lawfirm', 'Law Firm', 'fa-scale-balanced', '#64748b', 'hero,services,about,team,faq,testimonials,booking,contact', 50000, 'practice-area pages, credentials and consultation booking'],
      ['accounting', 'Accounting / Tax', 'fa-calculator', '#0ea5e9', 'hero,services,pricing,about,team,faq,booking,contact', 40000, 'service packages, deadline reminders and a document checklist'],
      ['photographer', 'Photographer / Studio', 'fa-camera', '#f472b6', 'hero,gallery,packages,about,testimonials,booking,contact', 25000, 'a portfolio gallery with package pricing'],
      ['eventdecor', 'Event / Decor', 'fa-champagne-glasses', '#fb7185', 'hero,services,packages,gallery,testimonials,booking,faq,contact', 30000, 'event packages, a gallery and date enquiries'],
      ['logistics', 'Courier / Logistics', 'fa-truck-fast', '#3b82f6', 'hero,services,pricing,map,about,faq,booking,contact', 40000, 'a rate card, coverage map and pickup request form'],
      ['printing', 'Printing Press', 'fa-print', '#a3e635', 'hero,services,pricing,gallery,about,order,faq,contact', 25000, 'an online order form with file upload instructions']
    ]
  };

  /* preset section lists used by niche business types */
  App.dict.sectionAliases = {
    courses: 'menu', results: 'stats', trainers: 'team', faculty: 'team', practice: 'services',
    programs: 'services', warranty: 'faq', delivery: 'hours', offers: 'pricing', projects: 'gallery',
    admission: 'booking', consult: 'booking', coverage: 'map'
  };

  App.dict.typeByKey = {};
  App.dict.businessTypes.forEach(t => { App.dict.typeByKey[t[0]] = { key: t[0], label: t[1], icon: t[2], accent: t[3], sections: t[4].split(','), avgValue: t[5], pitch: t[6] }; });

  /* fallback used when a live listing has no matching preset */
  App.dict.genericType = { key: 'general', label: 'Local Business', icon: 'fa-store', accent: '#cbfa31', avgValue: 25000, pitch: 'a website that turns Google Maps visitors into paying customers', sections: ['hero', 'about', 'services', 'gallery', 'testimonials', 'cta', 'contact', 'map'] };
  App.dict.typeOf = function (key) { return App.dict.typeByKey[key] || App.dict.genericType; };
  App.dict.typeLabel = function (key) { const t = App.dict.typeByKey[key]; return t ? t.label : (key ? U.title(key) : 'Business'); };
  App.dict.chanLabel = function (key) { const c = App.dict.channels.filter(x => x[0] === key)[0]; return c ? c[1] : U.title(key); };
  App.dict.chanIcon = function (key, cls) {
    const c = App.dict.channels.filter(x => x[0] === key)[0];
    if (!c) return App.ui.icon('fa-comment', cls);
    return '<i class="fa-' + c[3] + ' ' + c[2] + ' ' + (cls || '') + '"></i>';
  };

  /* --------------------------- Addis Ababa areas --------------------------- */
  /* key, label, lat, lng, sub-city — used for the area picker, map links and
     distance sorting when searching Google / OpenStreetMap                   */
  App.dict.areas = [
    ['addis-ababa', 'Addis Ababa (whole city)', 9.0192, 38.7525, '—'],
    ['bole-medhanealem', 'Bole · Medhanealem', 8.9972, 38.7869, 'Bole'],
    ['bole-road', 'Bole · Bole Road / Africa Avenue', 9.0006, 38.7650, 'Bole'],
    ['cmc', 'CMC · Ayat', 9.0192, 38.8560, 'Yeka'],
    ['summit', 'Summit · Bole Bulbula', 9.0350, 38.8300, 'Bole'],
    ['gerji', 'Gerji · Imperial', 9.0110, 38.8020, 'Bole'],
    ['megenagna', 'Megenagna', 9.0170, 38.7980, 'Yeka'],
    ['kazanchis', 'Kazanchis', 9.0165, 38.7700, 'Kirkos'],
    ['piassa', 'Piassa · Arada', 9.0350, 38.7500, 'Arada'],
    ['merkato', 'Merkato · Addis Ketema', 9.0340, 38.7400, 'Addis Ketema'],
    ['saris', 'Saris · Ayer Tena', 8.9800, 38.7300, 'Nifas Silk-Lafto'],
    ['sarbet', 'Sarbet · Old Airport', 9.0030, 38.7400, 'Nifas Silk-Lafto'],
    ['hayahulet', 'Hayahulet · Urael', 9.0090, 38.7810, 'Bole'],
    ['gotera', 'Gotera · Nifas Silk', 8.9950, 38.7470, 'Nifas Silk-Lafto'],
    ['lafto', 'Lafto · Jemo', 8.9500, 38.7200, 'Nifas Silk-Lafto'],
    ['shiromeda', 'Shiromeda · Gullele', 9.0430, 38.7460, 'Gullele'],
    ['kolfe', 'Kolfe Keranio', 9.0250, 38.7050, 'Kolfe Keranio'],
    ['kality', 'Kality · Akaki', 8.9100, 38.7600, 'Akaki Kaliti'],
    ['entoto', 'Entoto · Gullele foothills', 9.0700, 38.7600, 'Gullele'],
    ['wollosefer', 'Wollo Sefer · Gotera', 9.0050, 38.7760, 'Kirkos']
  ];
  App.dict.areaOf = function (key) {
    const hit = App.dict.areas.filter(a => a[0] === key)[0];
    return hit ? { key: hit[0], label: hit[1], lat: hit[2], lng: hit[3], subCity: hit[4] } : null;
  };
  /** "Bole" or "Kazanchis" → the area row we should use for that text */
  App.dict.findArea = function (text) {
    const t = U.slug(text || '').replace(/-/g, ' ').trim();
    if (!t || t.length < 3) return null;
    let best = null, bestScore = 0;
    App.dict.areas.forEach(a => {
      const key = a[0].replace(/-/g, ' ');
      const label = U.slug(a[1]).replace(/-/g, ' ');
      const sub = a[4] && a[4] !== '—' ? U.slug(a[4]).replace(/-/g, ' ') : '';
      let score = 0;
      if (t === key || t === label) score = 200 + t.length;
      else if (key.indexOf(t) === 0 || label.indexOf(t) === 0) score = 100 + t.length;
      else if (label.split(' ').indexOf(t) !== -1) score = 60 + t.length;
      else if (sub && sub.indexOf(t) === 0) score = 40 + t.length;
      if (score > bestScore) { best = a; bestScore = score; }
    });
    return best ? App.dict.areaOf(best[0]) : null;
  };

  /* --------------------------------- seed ---------------------------------- */
  App.seed = function () {
    const day = (n) => U.addDays(U.todayISO(), n);
    const TS = (n) => new Date(Date.now() + n * 864e5).toISOString();

    /* -------- company / system settings -------- */
    const settings = {
      company: {
        name: 'Triverse Studio Software Solution',
        shortName: 'Triverse Studio',
        tagline: 'Websites, software & design that grow Ethiopian businesses',
        owner: 'Bereket Mamuye',
        ceo: 'Bereket Mamuye',
        email: 'bereket1515mamuye@gmail.com',
        phone: '+251902468625',
        whatsapp: '+251902468625',
        telegram: '@triversestudio',
        website: 'https://m1616d.github.io/Triverse-Studio/',
        portfolio: 'https://m1616d.github.io/Triverse-Studio/',
        /* every place the studio can be found. Empty ones are simply hidden, so
           a link can be dropped in the moment the account exists. */
        socials: {
          telegramChannel: 'https://t.me/M_Dron_Sci_Tech_Channel',
          telegramGroup: 'https://t.me/Triverse_Studio_Group',
          tiktok: 'https://www.tiktok.com/@triverse.studio3',
          instagram: '',
          facebook: '',
          linkedin: '',
          upwork: '',
          fiverr: '',
          afriwork: '',
          whatsapp: 'https://wa.me/251902468625',
          github: 'https://github.com/M1616D'
        },
        address: 'Addis Ababa, Ethiopia',
        city: 'Addis Ababa',
        region: 'Addis Ababa',
        postalCode: '1000',
        country: 'Ethiopia',
        currency: 'ETB',
        defaultCountryCode: '+251',
        workingHours: 'Mon–Sat · 08:30 – 18:00 (EAT)',
        senderName: 'Bereket Mamuye',
        senderRole: 'Co-founder & CEO',
        calendly: '',
        /* the studio logo, stored inside the workspace so it travels with a backup */
        logo: '',
        registrationNo: '',
        tin: '',
        foundedYear: '',
        bankName: '',
        bankAccount: '',
        telebirrNo: '',
        invoicePrefix: 'INV'
      },
      /* the workspace itself: encrypted at rest behind a passphrase */
      security: {
        requireLogin: false,
        autoLockMinutes: 30,
        lastUnlock: '',
        lockOnHide: false
      },
      /* Google Drive: the studio's own account as the off-device store.
         The OAuth client is Triverse Studio's own; signing in with it is what
         makes the workspace follow you to any device. The client id is not a
         secret — it is the public half of a Google OAuth client. */
      cloud: {
        clientId: '440939143986-nefs0f1260tv58v1d8p6vtigphtpaoil.apps.googleusercontent.com',
        connected: false,
        account: 'bereket1515mamuye@gmail.com',
        auto: false,
        lastSync: '',
        lastPull: '',
        lastError: '',
        backupId: ''
      },
      google: {
        /* the studio's own Google Places key — enough for a real Maps-style search */
        apiKey: 'AIzaSyD3es3VxVtt9ryJFWOENWpAkeWu61vxOXY',
        region: 'et',
        radiusKm: 8,
        pageSize: 20,
        centerLat: 9.0192,
        centerLng: 38.7525,
        city: 'Addis Ababa',
        provider: 'google'
      },
      outreach: {
        autoClassify: true,
        autoAdvanceOnNegative: true,
        followUpDays: 3,
        secondFollowUpDays: 7,
        dailySendLimit: 40,
        signature: '— {{sender}}\n{{company}}\n{{phone}} · {{portfolio}}'
      },
      integration: {
        webhookUrl: '',
        webhookToken: '',
        whatsappCloudToken: '',
        whatsappPhoneId: '',
        autoSendEnabled: false
      },
      /* Gemini writes the website copy and personalises the first message from the
         business's own Google Maps record. Optional: the system works without it. */
      ai: {
        geminiKey: '',
        model: 'gemini-2.5-flash',
        enabled: false,
        useForSites: true,
        useForMessages: true,
        lastCheck: '',
        lastCheckState: '',
        lastCheckText: ''
      },
      ui: { lastRoute: 'dashboard', compact: false }
    };

    /* -------- service catalogue (what we sell, priced in ETB) --------
       Prices are in Ethiopian Birr, one-time unless the unit says otherwise.
       The website line starts at 15,000; every extra function is a priced
       add-on below, so a quote is always base + the functions they asked for. */
    const catalog = [
      { id: 'svc_site_starter', name: 'Standard Website', category: 'website', price: 15000, unit: 'one-time', deliveryDays: 3, base: true, desc: 'The 15,000 Birr starting point: up to four sections — home, about, services, contact — mobile ready, WhatsApp button, Google map, basic SEO.', active: true },
      { id: 'svc_site_booking', name: 'Website + booking & enquiry forms', category: 'website', price: 22000, unit: 'one-time', deliveryDays: 5, desc: 'Everything in the standard website plus online booking, enquiry forms and a gallery.', active: true },
      { id: 'svc_site_order', name: 'Website + online ordering', category: 'website', price: 23000, unit: 'one-time', deliveryDays: 6, desc: 'Standard website with a product or menu catalogue that orders straight to WhatsApp or Telebirr.', active: true },
      { id: 'svc_site_business', name: 'Business Website (6+ pages)', category: 'website', price: 45000, unit: 'one-time', deliveryDays: 8, desc: 'Custom design across six or more pages, gallery, services, map, forms, speed optimised.', active: true },
      { id: 'svc_site_premium', name: 'Premium Brand Website (10+ pages)', category: 'website', price: 90000, unit: 'one-time', deliveryDays: 14, desc: 'Multi-section custom build, animations, blog, analytics, copywriting.', active: true },
      { id: 'svc_ecommerce', name: 'E-commerce Store', category: 'website', price: 150000, unit: 'one-time', deliveryDays: 18, desc: 'Products, cart, Telebirr / cash-on-delivery checkout, order dashboard, stock alerts.', active: true },
      { id: 'svc_qr_menu', name: 'Digital QR Menu', category: 'software', price: 15000, unit: 'one-time', deliveryDays: 2, qr: true, desc: 'The 15,000 Birr starting point: table QR codes plus a mobile menu with photos, unlimited edits and a WhatsApp button.', active: true },
      { id: 'svc_qr_menu_order', name: 'QR Menu + order & call waiter', category: 'software', price: 30000, unit: 'one-time', deliveryDays: 6, qr: true, full: true, desc: 'The 30,000 Birr top of the QR menu line: guests order from the table and press call-waiter, and you get a counter dashboard with the daily sales report.', active: true },
      { id: 'svc_hr_system', name: 'HR & Payroll System', category: 'software', price: 260000, unit: 'one-time', deliveryDays: 30, desc: 'Employee records, attendance, leave, payroll sheets, payslips, roles.', active: true },
      { id: 'svc_inventory', name: 'Inventory & Billing Software', category: 'software', price: 190000, unit: 'one-time', deliveryDays: 25, desc: 'Stock, purchase, sales, invoices, VAT/report exports.', active: true },
      { id: 'svc_custom_module', name: 'Custom Software Module', category: 'software', price: 75000, unit: 'one-time', deliveryDays: 12, desc: 'A single workflow or automation built into your existing system.', active: true },
      { id: 'svc_mobile_app', name: 'Mobile App (Android)', category: 'software', price: 320000, unit: 'one-time', deliveryDays: 40, desc: 'Cross-platform app, push notifications, dashboard, Play Store release.', active: true },
      { id: 'svc_logo', name: 'Logo Design', category: 'design', price: 8000, unit: 'one-time', deliveryDays: 2, desc: '3 concepts, unlimited minor revisions, all source files.', active: true },
      { id: 'svc_brand_kit', name: 'Brand Identity Kit', category: 'design', price: 35000, unit: 'one-time', deliveryDays: 5, desc: 'Logo, colour, fonts, stationery mockups and usage guide.', active: true },
      { id: 'svc_card', name: 'Business Card', category: 'design', price: 3500, unit: 'one-time', deliveryDays: 1, desc: 'Double-sided print-ready card in 2 designs.', active: true },
      { id: 'svc_flyer', name: 'Flyer / Poster', category: 'design', price: 5500, unit: 'one-time', deliveryDays: 2, desc: 'Print-ready A4/A5 creative with 2 revisions.', active: true },
      { id: 'svc_banner', name: 'Banner / Flex Design', category: 'design', price: 4500, unit: 'one-time', deliveryDays: 1, desc: 'Large-format banner sized to your shop front.', active: true },
      { id: 'svc_thumbnail', name: 'YouTube Thumbnail', category: 'design', price: 2000, unit: 'each', deliveryDays: 1, desc: 'Click-optimised thumbnail, unlimited text swaps for 7 days.', active: true },
      { id: 'svc_social_pack', name: 'Social Media Ad Pack (10 posts)', category: 'design', price: 18000, unit: 'monthly', deliveryDays: 5, desc: '10 branded posts + 3 story sets for Facebook/Instagram/TikTok.', active: true },
      { id: 'svc_ads_boost', name: 'Meta / TikTok Ads Setup', category: 'marketing', price: 25000, unit: 'monthly', deliveryDays: 3, desc: 'Pixel, audiences, creatives, campaign optimisation, weekly report.', active: true },
      { id: 'svc_hosting', name: 'Hosting + Domain (1 year)', category: 'hosting', price: 12000, unit: 'yearly', deliveryDays: 1, desc: 'SSL, daily backup, business email, uptime monitoring.', active: true },
      { id: 'svc_maintenance', name: 'Maintenance Retainer', category: 'retainer', price: 9000, unit: 'monthly', deliveryDays: 0, desc: 'Unlimited small edits, backups, security patches, speed checks.', active: true },

      /* ---- add-ons: each one raises the total when the client asks for it ---- */
      { id: 'add_extra_page', name: 'Extra page beyond the package', category: 'addon', price: 3500, unit: 'each', deliveryDays: 1, addon: true, desc: 'One more page, built to the same design and written in the same voice.', active: true },
      { id: 'add_booking', name: 'Booking / appointment system', category: 'addon', price: 7000, unit: 'one-time', deliveryDays: 3, addon: true, desc: 'Real availability, date and time selection, and a booking list you can check from your phone.', active: true },
      { id: 'add_ordering', name: 'Online order + delivery flow', category: 'addon', price: 8000, unit: 'one-time', deliveryDays: 3, addon: true, desc: 'Guests build an order, it arrives on WhatsApp or your dashboard with the total already added up.', active: true },
      { id: 'add_call_waiter', name: 'Call-waiter button', category: 'addon', price: 7000, unit: 'one-time', deliveryDays: 2, addon: true, desc: 'A per-table button that rings the counter with the table number — no waving, no missed guests.', active: true },
      { id: 'add_bilingual', name: 'Amharic + English bilingual', category: 'addon', price: 5000, unit: 'one-time', deliveryDays: 3, addon: true, desc: 'Every page in both languages with a one-tap switcher, including Ethiopic typography.', active: true },
      { id: 'add_google_profile', name: 'Google Business profile setup', category: 'addon', price: 4000, unit: 'one-time', deliveryDays: 2, addon: true, desc: 'Your listing claimed, categories fixed, photos uploaded and hours corrected.', active: true },
      { id: 'add_content_day', name: 'Copywriting & photo day', category: 'addon', price: 12000, unit: 'one-time', deliveryDays: 5, addon: true, desc: 'Half a day on site: we write the words and shoot the photos the website needs.', active: true },
      { id: 'add_domain_host', name: 'Domain + hosting (1 year)', category: 'addon', price: 12000, unit: 'yearly', deliveryDays: 1, addon: true, desc: 'Your own .et or .com domain, SSL, daily backups, business email and uptime monitoring.', active: true }
    ];

    /* -------- website templates (our design inventory) -------- */
    const templates = [
      {
        id: 'tpl_lime_night', name: 'Lime Night — Studio Signature', style: 'dark', bestFor: ['restaurant', 'gym', 'electronics', 'carrepair', 'coffee'],
        accent: '#cbfa31', accentSoft: 'rgba(203,250,49,.14)', bg: '#0a0b0d', surface: '#15171f', border: 'rgba(255,255,255,.07)',
        text: '#ffffff', muted: '#8b90a1', font: "'Segoe UI', system-ui, -apple-system, sans-serif", radius: '18px', hero: 'split',
        notes: 'The dashboard look our own work is known for — high contrast, lime accent, card grid.', sampleUrl: '', active: true
      },
      {
        id: 'tpl_midnight_cyan', name: 'Midnight Cyan', style: 'dark', bestFor: ['clinic', 'dentist', 'logistics', 'accounting'],
        accent: '#22d3ee', accentSoft: 'rgba(34,211,238,.14)', bg: '#071013', surface: '#0f1c21', border: 'rgba(34,211,238,.18)',
        text: '#ecfeff', muted: '#8ba3ad', font: "'Segoe UI', system-ui, sans-serif", radius: '14px', hero: 'center',
        notes: 'Calm clinical blue — good for medical, finance and logistics.', sampleUrl: '', active: true
      },
      {
        id: 'tpl_aurora_violet', name: 'Aurora Violet', style: 'dark', bestFor: ['salon', 'spa', 'tuition', 'photographer'],
        accent: '#a78bfa', accentSoft: 'rgba(167,139,250,.16)', bg: '#0b0916', surface: '#171331', border: 'rgba(167,139,250,.2)',
        text: '#f5f3ff', muted: '#a79fc7', font: "'Trebuchet MS', 'Segoe UI', sans-serif", radius: '22px', hero: 'split',
        notes: 'Soft glow gradient, rounded cards — beauty and education brands.', sampleUrl: '', active: true
      },
      {
        id: 'tpl_sunset_orange', name: 'Sunset Orange', style: 'dark', bestFor: ['restaurant', 'fastfood', 'grocery', 'eventdecor'],
        accent: '#fb923c', accentSoft: 'rgba(251,146,60,.16)', bg: '#14100c', surface: '#221a13', border: 'rgba(251,146,60,.2)',
        text: '#fff7ed', muted: '#c3a58f', font: "'Segoe UI', system-ui, sans-serif", radius: '16px', hero: 'banner',
        notes: 'Warm food-friendly palette with big imagery and order buttons.', sampleUrl: '', active: true
      },
      {
        id: 'tpl_clean_white', name: 'Clean White (light)', style: 'light', bestFor: ['realestate', 'lawfirm', 'accounting', 'school'],
        accent: '#0f766e', accentSoft: 'rgba(15,118,110,.10)', bg: '#f7f8fa', surface: '#ffffff', border: 'rgba(15,23,42,.10)',
        text: '#0f172a', muted: '#5b6472', font: "'Segoe UI', system-ui, sans-serif", radius: '16px', hero: 'split',
        notes: 'Bright corporate look with generous whitespace — trust-first buyers.', sampleUrl: '', active: true
      },
      {
        id: 'tpl_emerald_fresh', name: 'Emerald Fresh (light)', style: 'light', bestFor: ['pharmacy', 'grocery', 'hotel', 'travel'],
        accent: '#059669', accentSoft: 'rgba(5,150,105,.12)', bg: '#f5fbf7', surface: '#ffffff', border: 'rgba(5,60,40,.12)',
        text: '#062e21', muted: '#5c7768', font: "'Segoe UI', system-ui, sans-serif", radius: '14px', hero: 'banner',
        notes: 'Fresh green, product-grid friendly, great for retail and travel.', sampleUrl: '', active: true
      }
    ];

    /* -------- cold-outreach message library -------- */
    const messages = {
      templates: [
        {
          id: 'msg_wa_first_nowebsite', name: 'First touch — no website', channel: 'whatsapp', stage: 'first', lang: 'en',
          designedFor: ['*'], offeredService: 'svc_site_business', active: true,
          body: 'Selam {{business}},\n\nI found your {{category}} on Google Maps ({{rating}} from {{reviews}} reviews). Your reputation is strong, but you do not have a website yet.\n\nI am {{sender}} from {{company}}. We build {{hook}} for {{category}} businesses, and your Google listing already gives us most of what is needed: photos, opening hours, location and reviews.\n\nI have prepared a demonstration of how a website could look using your own business information. May I send you the link? There is no cost and no obligation.\n\n{{signature}}'
        },
        {
          id: 'msg_wa_first_generic', name: 'First touch — has a website', channel: 'whatsapp', stage: 'first', lang: 'en',
          designedFor: ['*'], offeredService: 'svc_maintenance', active: true,
          body: 'Selam {{business}},\n\nI am {{sender}} from {{company}}. We build {{hook}} for {{category}} businesses around {{city}}.\n\nI went through {{website}} and your Google profile ({{rating}} from {{reviews}} reviews). Your business looks well established, and a few small changes could turn that traffic into more orders.\n\nMay I send a short review with three concrete suggestions? No cost, no obligation.\n\n{{signature}}'
        },
        {
          id: 'msg_wa_qr_menu', name: 'First touch — QR menu / restaurant', channel: 'whatsapp', stage: 'first', lang: 'en',
          designedFor: ['restaurant', 'cafe', 'fastfood', 'hotel', 'coffee'], offeredService: 'svc_qr_menu', active: true,
          body: 'Selam {{business}},\n\n{{sender}} here from {{company}}. We set up {{hook}} for restaurants in {{city}}. A customer scans one QR code at the table, sees the full menu with photographs and orders straight to your WhatsApp.\n\nYour Google profile shows {{rating}} from {{reviews}} customers. A QR menu usually increases repeat orders because nobody has to wait for a menu or a waiter.\n\nMay I send a live sample menu built with your own dishes? It takes about ten minutes.\n\n{{signature}}'
        },
        {
          id: 'msg_wa_hr_system', name: 'First touch — HR / software', channel: 'whatsapp', stage: 'first', lang: 'en',
          designedFor: ['school', 'tuition', 'logistics', 'clinic', 'accounting', 'coffee'], offeredService: 'svc_hr_system', active: true,
          body: 'Selam {{business}},\n\n{{sender}} from {{company}}. We build software for growing {{category}} businesses: {{hook}}.\n\nAttendance, leave and payroll sheets usually consume hours every month. Our HR and payroll system handles all of it and pays for itself within the first month.\n\nMay I send a short screen recording and the price list?\n\n{{signature}}'
        },
        {
          id: 'msg_wa_followup_1', name: 'Follow-up 1 (no reply)', channel: 'whatsapp', stage: 'followup', lang: 'en',
          designedFor: ['*'], offeredService: '', active: true,
          body: 'Selam {{business}},\n\nFollowing up on my message from earlier this week. The demonstration website I mentioned is already built with your own information: your name, {{category}}, address, photographs and reviews. If it is not useful, tell me and I will stop writing.\n\nShall I send the link?\n\n{{signature}}'
        },
        {
          id: 'msg_wa_followup_2', name: 'Follow-up 2 (last nudge)', channel: 'whatsapp', stage: 'followup', lang: 'en',
          designedFor: ['*'], offeredService: '', active: true,
          body: 'Hi {{business}}, last message from my side — no pressure at all.\n\nWe keep the demo of your website live for 7 days: {{portfolio}}\n\nIf {{hook}} is something you\'d like this year, reply "YES" and I\'ll prepare the full plan. If not, I\'ll close the file and won\'t disturb you again. Either way, wishing you a great week.\n\n{{signature}}'
        },
        {
          id: 'msg_wa_proposal', name: 'Proposal + price (after positive reply)', channel: 'whatsapp', stage: 'proposal', lang: 'en',
          designedFor: ['*'], offeredService: 'svc_site_business', active: true,
          body: 'Thank you for coming back to me, {{business}}.\n\nHere is what I recommend:\n• {{offer}}\n• Delivery: {{delivery}}\n• Includes hosting, SSL, mobile design and unlimited small edits for 30 days\n• Price: {{price}} (50% advance, 50% on delivery)\n• Payment: Telebirr / CBE Birr / bank transfer\n\nSample of a similar project: {{portfolio}}\n\nShall I start today and send you the first draft within 48 hours?\n\n{{signature}}'
        },
        {
          id: 'msg_tg_first', name: 'Telegram first touch', channel: 'telegram', stage: 'first', lang: 'en',
          designedFor: ['*'], offeredService: 'svc_site_business', active: true,
          body: 'Selam {{business}},\n\nI am {{sender}} from {{company}} ({{portfolio}}). We build {{hook}}.\n\nI saw your listing on the map: {{rating}} from {{reviews}} reviews. I have already prepared a website concept using your own information and photographs. There is nothing to pay to see it.\n\nWould you like the preview link?\n\n{{signature}}'
        },
        {
          id: 'msg_email_first', name: 'Email — first touch', channel: 'email', stage: 'first', lang: 'en',
          designedFor: ['*'], offeredService: 'svc_site_business', active: true,
          subject: 'A website concept for {{business}} (prepared free)',
          body: 'Dear {{business}} team,\n\nI am {{sender}}, {{sender_role}} at {{company}} — we design websites, QR menus and business software for {{category}} businesses in {{city}}.\n\nWhile reviewing local {{category}} businesses, your profile stood out: {{rating}}★ from {{reviews}} reviews. Since you do not have a website yet, I took the liberty of building a design concept with your own information, photos and hours.\n\nYou can see it here: {{portfolio}}\n\nIf it looks useful I will send a full plan with the price and timeline. If not, simply reply "no" and I will not follow up.\n\nWarm regards,\n{{sender}}\n{{sender_role}}, {{company}}\n{{phone}} · {{whatsapp}} · {{portfolio}}'
        },
        {
          id: 'msg_sms_first', name: 'SMS — short first touch', channel: 'sms', stage: 'first', lang: 'en',
          designedFor: ['*'], offeredService: 'svc_site_business', active: true,
          body: '{{business}}, we built a website demo from your business profile (free to see). {{sender}} from {{company}}. Reply YES for the link, NO to stop.'
        },
        {
          id: 'msg_call_script', name: 'Cold call script', channel: 'call', stage: 'first', lang: 'en',
          designedFor: ['*'], offeredService: 'svc_site_business', active: true,
          body: 'Opening: "Selam, am I speaking with the owner of {{business}}? I\'ll take 40 seconds."\n\nHook: "I saw {{business}} on the map — {{rating}}★ from {{reviews}} reviews. I build {{hook}} and I already prepared a free concept using your own business information."\n\nAsk: "Can I send the preview on WhatsApp right now so you can see it while we talk?"\n\nHandle "no budget": "Understood. The preview stays free — if it makes sense later, I\'m one message away."\n\nClose: "I\'m sending it now from {{whatsapp}}. Please save the number — I\'ll send the price list today."'
        },
        {
          id: 'msg_wa_invoice', name: 'Payment reminder', channel: 'whatsapp', stage: 'payment', lang: 'en',
          designedFor: ['*'], offeredService: '', active: true,
          body: 'Selam {{business}},\n\nA reminder that invoice {{invoice}} for {{price}} is due on {{due}}. Payment can be made by Telebirr, CBE Birr or bank transfer; the details are below.\n\nIf it has already been paid, please ignore this message and send the transaction reference so our records stay accurate.\n\nThank you.\n{{signature}}'
        },
        {
          id: 'msg_wa_welcome', name: 'Won — onboarding message', channel: 'whatsapp', stage: 'won', lang: 'en',
          designedFor: ['*'], offeredService: '', active: true,
          body: 'Welcome aboard, {{business}}.\n\nHere is our five-step onboarding:\n1. You send logo, photos and text (or I reuse your public profile)\n2. I send the design draft in {{delivery}}\n3. Two rounds of revisions\n4. We publish on your domain + hosting\n5. Free training call for your staff\n\nAdvance: {{price}} (50%). Please share the payment reference once done and I\'ll start today.\n\n{{signature}}'
        }
      ],
      /* reply sentiment keywords (scored) — English + Amharic */
      keywords: {
        positive: ['yes', 'yeah', 'yep', 'sure', 'interested', 'send', 'share', 'demo', 'link', 'price', 'pricing', 'how much', 'cost', 'quotation', 'quote', 'details', 'tell me more', 'ok', 'okay', 'sounds good', 'go ahead', 'let\'s talk', 'lets talk', 'call me', 'when can', 'budget', 'need it', 'want it', 'please', 'thanks', 'selam', 'amesegen', 'ishey', 'eshi', 'awo', 'እሺ', 'አዎ', 'ዋጋ', 'ስንት', 'ፍላጎት አለኝ', 'ላኩልኝ', 'አመሰግናለሁ'],
        negative: ['no thanks', 'not interested', 'no need', 'don\'t need', 'dont need', 'already have', 'we have a website', 'stop messaging', 'stop', 'remove me', 'not now', 'don\'t message', 'dont message', 'busy', 'later', 'no.', 'no,', 'never', 'too expensive', 'cannot afford', 'can\'t afford', 'not possible', 'አልፈልግም', 'አያስፈልግም', 'አሁን አይደለም', 'በዝቶብኛል', 'የለኝም', 'አቅም የለኝም'],
        question: ['?', 'how', 'what', 'when', 'which', 'can you', 'do you', 'ስንት', 'እንዴት', 'ምን'],
        wantSite: ['website', 'web site', 'site', 'qr menu', 'menu', 'software', 'app', 'landing', 'page', 'online',
          'demo', 'sample', 'price', 'price list', 'pricing', 'cost', 'quote', 'quotation', 'proposal', 'estimate', 'how much', 'budget', 'package', 'packages',
          'ዌብሳይት', 'ዋጋ', 'ሜኑ', 'ዲጂታል ሜኑ']
      }
    };

    /* The system starts EMPTY on purpose: every number on the dashboard is then
       something you actually discovered, quoted or collected — nothing invented. */
    return {
      schema: App.SCHEMA,
      meta: { createdAt: U.now(), lastOpen: U.now(), seededAt: U.now(), demoData: false, pricingVersion: App.PRICING_VERSION },
      settings: settings,
      catalog: catalog,
      templates: templates,
      clients: [],
      payments: [],
      sites: [],
      documents: [],
      leads: [],
      messages: messages,
      activities: [],
      counters: { invoice: 0 }
    };
  };
})(window);
