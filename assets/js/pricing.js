/* =============================================================================
   Triverse OS — pricing
   Every figure in this system is Ethiopian Birr (ETB) and is built from the
   service catalogue, never guessed. The website line starts at 15,000 Birr and
   the QR menu line runs from 15,000 to 30,000 — the top of that range is a
   table QR menu with ordering and a call-waiter button.

   A quote is always:  base package  +  only the functions this business needs.

   Nothing here invents a number. If the catalogue does not contain a service,
   the quote does not contain it either.
   ========================================================================== */
(function (global) {
  'use strict';

  const App = global.App;
  const U = App.util;

  /* quoted in Birr; the ids match the service catalogue in data.js */
  const BASE = { website: 'svc_site_starter', qrmenu: 'svc_qr_menu' };

  /* an add-on only ever appears because a reason asked for it */
  const FUNCTION_BY_SECTION = {
    booking: 'add_booking',
    order: 'add_ordering',
    delivery: 'add_ordering',
    qr: 'svc_qr_menu'
  };

  /* business types whose first product is the QR menu, not a website */
  const QR_FIRST = ['restaurant', 'cafe', 'coffee', 'fastfood', 'bakery', 'juice', 'lounge', 'bar'];

  function catalogue() {
    return App.store.get('catalog', []).filter(s => s.active !== false);
  }
  function service(id) {
    return catalogue().filter(s => s.id === id)[0] || null;
  }
  function priceOf(id) {
    const s = service(id);
    return s ? Number(s.price) || 0 : 0;
  }

  const pricing = App.pricing = {
    BASE: BASE,
    QR_FIRST: QR_FIRST,

    /**
     * The minimum a business can be quoted, in Birr. This is the honest floor:
     * a standard website, or the entry QR menu.
     */
    floor(kind) {
      return priceOf(BASE[kind === 'qrmenu' ? 'qrmenu' : 'website']);
    },

    /**
     * The most the QR menu line can reach — ordering plus call-waiter.
     * Kept as a function so the ceiling follows the catalogue if prices change.
     */
    qrCeiling() {
      const base = priceOf('svc_qr_menu');
      return priceOf('svc_qr_menu_order') || (base + priceOf('add_ordering') + priceOf('add_call_waiter'));
    },

    /** does this business sell food and drink? */
    isFood(lead) {
      const t = App.dict.typeOf(lead && lead.businessType);
      return QR_FIRST.indexOf(t.key) !== -1;
    },

    /**
     * What this business actually needs, read from its type's section list and
     * its Google record. These become the line items of the quote.
     */
    suggestWants(lead) {
      const t = App.dict.typeOf(lead && lead.businessType);
      const sections = t.sections || [];
      const food = pricing.isFood(lead);
      const wants = {
        kind: food ? 'qrmenu' : 'website',
        booking: sections.indexOf('booking') !== -1,
        ordering: sections.indexOf('order') !== -1,
        callWaiter: false,
        bilingual: false,
        extraPages: 0,
        /* the studio's own work is what is quoted by default; domain, hosting
           and profile setup are offered separately so a plain website stays at
           the 15,000 Birr figure and the client can see what each extra costs */
        googleProfile: false,
        domain: false
      };
      /* a business with a strong review count is ready for the bigger package */
      if (!food && (lead && (lead.reviews || 0) >= 80)) wants.extraPages = 2;
      /* a kitchen that already takes orders by phone wants the table button too */
      if (food && (lead && (lead.reviews || 0) >= 120)) wants.callWaiter = true;
      return wants;
    },

    /**
     * The quote. Returns the exact lines, the total, and the range, so the UI can
     * show the client what each function costs instead of one unexplained number.
     */
    quote(lead, wants) {
      wants = Object.assign({}, pricing.suggestWants(lead), wants || {});
      const kind = wants.kind === 'qrmenu' ? 'qrmenu' : 'website';
      const lines = [];
      const push = (id, why) => {
        const s = service(id);
        if (!s) return;
        lines.push({ id: s.id, name: s.name, price: Number(s.price) || 0, unit: s.unit || 'one-time', desc: s.desc || '', why: why || '' });
      };

      if (kind === 'qrmenu') {
        /* the QR menu line has exactly two shapes: entry, or ordering + waiter */
        const full = wants.ordering && wants.callWaiter;
        push(full ? 'svc_qr_menu_order' : 'svc_qr_menu', full
          ? 'Table QR menu with ordering and a call-waiter button — the top of this line'
          : 'Table QR menu with photos and a WhatsApp button — the 15,000 Birr entry point');
      } else {
        push(BASE.website, 'The 15,000 Birr starting point for any website');
        if (wants.ordering) push('add_ordering', 'They take orders — this puts the order form on the site');
        if (wants.booking) push('add_booking', 'Their customers book appointments, so the site must take bookings');
        if (wants.callWaiter) push('add_call_waiter', 'A per-table button for the counter');
      }

      if (wants.bilingual) push('add_bilingual', 'Amharic alongside English');
      if (wants.extraPages > 0) {
        for (let i = 0; i < wants.extraPages; i++) push('add_extra_page', 'Extra page beyond the package');
      }
      if (wants.googleProfile) push('add_google_profile', 'Their Google listing needs fixing before traffic can convert');
      if (wants.domain) push('add_domain_host', 'Domain, hosting, SSL and business email for the first year');

      const total = U.sum(lines, l => l.price);
      const days = Math.max.apply(null, lines.map(l => {
        const s = service(l.id);
        return Number((s && s.deliveryDays) || 0);
      }).concat([3]));

      return {
        kind: kind,
        wants: wants,
        lines: lines,
        ids: lines.map(l => l.id),
        items: lines.map(l => service(l.id)).filter(Boolean),
        names: lines.map(l => l.name + (l.unit && l.unit !== 'one-time' ? ' (' + l.unit + ')' : '')),
        total: total,
        days: days,
        deliveryLabel: days <= 3 ? '2–3 days' : days <= 7 ? '5–7 days' : days <= 14 ? '1–2 weeks' : days + '+ days',
        currency: 'ETB'
      };
    },

    /**
     * What the same business could add later, priced — used in the proposal so
     * the upsell is a real number rather than "ask us".
     */
    upsell(lead, quote) {
      const have = (quote || pricing.quote(lead)).ids;
      return catalogue()
        .filter(s => (s.addon || s.qr || s.category === 'website') && s.price > 0)
        .filter(s => have.indexOf(s.id) === -1)
        .filter(s => s.category !== 'website' || s.id === 'svc_ecommerce' || s.id === 'svc_site_business' || s.id === 'svc_site_premium')
        .slice(0, 8)
        .map(s => ({ id: s.id, name: s.name, price: Number(s.price) || 0, unit: s.unit || 'one-time', desc: s.desc || '' }));
    },

    /** plain-text quote the studio can paste into WhatsApp */
    text(lead, quote) {
      const q = quote || pricing.quote(lead);
      const rows = q.lines.map(l => '• ' + l.name + ' — ' + U.money(l.price) + ' / ' + l.unit);
      return [
        'Quote for ' + (lead.name || 'your business'),
        'All prices are in Ethiopian Birr.',
        '',
        rows.join('\n'),
        '',
        'Total: ' + U.money(q.total),
        'Estimated delivery: ' + q.deliveryLabel
      ].join('\n');
    }
  };
})(window);
