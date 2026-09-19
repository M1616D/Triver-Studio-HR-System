/* =============================================================================
   Triverse OS — outreach engine
   Merge fields, per-business service recommendation, channel detection,
   one-click sending (deep links + optional API/webhook), reply triage.
   ========================================================================== */
(function (global) {
  'use strict';

  const App = global.App;
  const U = App.util;

  const FOOD = ['restaurant', 'cafe', 'fastfood', 'hotel', 'grocery'];
  const SOFTWARE = ['school', 'tuition', 'logistics', 'clinic', 'accounting', 'itfirm', 'hotel'];
  const DESIGN_FIRST = ['boutique', 'photographer', 'eventdecor', 'printing'];

  const msg = App.msg = {

    /* ------------------------------------------------------------ variables */
    vars(lead, extra) {
      lead = lead || {};
      extra = extra || {};
      const c = App.store.get('settings.company', {});
      const t = App.dict.typeOf(lead.businessType);
      const rec = extra.rec || msg.recommend(lead);
      const rating = Number(lead.rating) || 0;
      const phone = lead.phone || lead.intlPhone || '';
      const wa = lead.intlPhone || (lead.whatsapp ? phone : '') || c.whatsapp || '';
      const out = {
        business: lead.name || 'there',
        category: lead.category || t.label,
        city: lead.city || App.store.get('settings.google.city', ''),
        area: (lead.address || '').split(',').slice(-2).join(',').trim(),
        rating: rating ? rating.toFixed(1) : '—',
        reviews: U.num(lead.reviews || 0),
        website: lead.website || '',
        phone: phone,
        whatsapp: wa || '',
        telegram: lead.telegram || '',
        email: lead.email || '',
        sender: c.senderName || c.owner || 'Studio Owner',
        sender_role: c.senderRole || 'Business Development',
        company: c.name || 'Triverse Studio',
        company_short: c.shortName || c.name || 'Triverse Studio',
        phone_company: c.phone || '',
        portfolio: c.portfolio || c.website || '',
        website_company: c.website || '',
        working_hours: c.workingHours || '',
        hook: t.pitch || 'a website that turns Google Maps visitors into paying customers',
        offer: rec.names.join(', '),
        price: U.money(rec.total),
        price_raw: rec.total,
        delivery: rec.deliveryLabel,
        services: rec.names.slice(1).join(', '),
        employees: (lead.reviews || 0) > 150 ? '25+' : '15+',
        invoice: extra.invoice || '',
        due: extra.due || '',
        amount: extra.amount ? U.money(extra.amount) : '',
        cta: 'Shall I send the link?',
        year: String(new Date().getFullYear())
      };
      out.signature = msg.renderText(App.store.get('settings.outreach.signature', ''), out);
      if (!out.signature) out.signature = '— ' + out.sender + ', ' + out.company + '\n' + out.phone_company;
      return out;
    },

    renderText(text, vars) {
      return String(text || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (m, k) => {
        const key = String(k).toLowerCase();
        return vars[key] === undefined || vars[key] === null ? '' : String(vars[key]);
      });
    },

    /** fill a template with the business's real data */
    render(tpl, lead, extra) {
      if (!tpl) return '';
      const vars = msg.vars(lead, extra);
      return {
        subject: msg.renderText(tpl.subject || '', vars),
        body: msg.renderText(tpl.body || '', vars),
        vars: vars,
        templateId: tpl.id,
        channel: tpl.channel
      };
    },

    templates() { return App.store.get('messages.templates', []).filter(t => t.active !== false); },
    template(id) { return msg.templates().filter(t => t.id === id)[0] || null; },

    /** choose the best first-touch template for a business */
    defaultTemplate(lead) {
      const hasSite = Boolean(lead.website);
      const list = msg.templates();
      const byId = id => list.filter(t => t.id === id)[0];
      if (!hasSite) {
        if (FOOD.indexOf(lead.businessType) !== -1) return byId('msg_wa_qr_menu') || byId('msg_wa_first_nowebsite') || list[0];
        if (SOFTWARE.indexOf(lead.businessType) !== -1) return byId('msg_wa_hr_system') || byId('msg_wa_first_nowebsite') || list[0];
        return byId('msg_wa_first_nowebsite') || list[0];
      }
      return byId('msg_wa_first_generic') || list[0];
    },

    /** which of our products to pitch to this business */
    /**
     * Which of our products to pitch to this business, priced in Birr.
     * A business with no website is quoted the website line built from its own
     * needs (see App.pricing); a business that already has one gets care work.
     */
    recommend(lead) {
      const catalog = App.store.get('catalog', []).filter(s => s.active !== false);
      const pick = id => catalog.filter(s => s.id === id)[0];
      const hasSite = Boolean(lead && lead.website);

      if (!hasSite && App.pricing) {
        const q = App.pricing.quote(lead);
        return {
          ids: q.ids,
          items: q.items,
          names: q.names,
          lines: q.lines,
          total: q.total,
          days: q.days,
          deliveryLabel: q.deliveryLabel,
          currency: 'ETB'
        };
      }

      let ids;
      if (!hasSite) {
        ids = ['svc_site_starter', 'svc_hosting'];
      } else {
        ids = ['svc_maintenance'];
        if (FOOD.indexOf(lead.businessType) !== -1) ids.push('svc_qr_menu');
        else if (DESIGN_FIRST.indexOf(lead.businessType) !== -1) ids.push('svc_social_pack');
        else ids.push('svc_ads_boost');
      }
      const items = ids.map(pick).filter(Boolean);
      const total = U.sum(items, i => Number(i.price) || 0);
      const days = Math.max.apply(null, items.map(i => Number(i.deliveryDays) || 0).concat([3]));
      return {
        ids: items.map(i => i.id),
        items: items,
        names: items.map(i => i.name + (i.unit && i.unit !== 'one-time' ? ' (' + i.unit + ')' : '')),
        total: total,
        days: days,
        deliveryLabel: days <= 3 ? '2–3 days' : days <= 7 ? '5–7 days' : days + '+ days'
      };
    },

    /* --------------------------------------------------------------- channels */
    channelsFor(lead) {
      const c = App.store.get('settings.company', {});
      const phone = lead.intlPhone || lead.phone || '';
      const list = [];
      if (phone && (lead.whatsapp || lead.source !== 'google')) list.push({ key: 'whatsapp', address: phone, ready: true });
      if (lead.telegram) list.push({ key: 'telegram', address: lead.telegram, ready: true });
      if (lead.email) list.push({ key: 'email', address: lead.email, ready: true });
      if (phone) { list.push({ key: 'sms', address: phone, ready: true }); list.push({ key: 'call', address: phone, ready: true }); }
      if (lead.socials && lead.socials.facebook) list.push({ key: 'facebook', address: lead.socials.facebook, ready: true });
      if (lead.socials && lead.socials.instagram) list.push({ key: 'instagram', address: lead.socials.instagram, ready: true });
      if (!list.length && c.whatsapp) list.push({ key: 'whatsapp', address: c.whatsapp, ready: false, note: 'No number saved for this business — add one first' });
      return list;
    },

    /** normalise to international digits for wa.me / tel: links */
    dial(lead, fallbackCountry) {
      const c = App.store.get('settings.company', {});
      let d = U.digits(lead.intlPhone || lead.phone || '');
      const cc = U.digits(fallbackCountry || c.defaultCountryCode || '');
      if (!d) return '';
      if (d.charAt(0) === '0' && cc) d = cc + d.slice(1);
      else if (d.length <= 10 && cc && d.indexOf(cc) !== 0) d = cc + d.replace(/^0+/, '');
      return d;
    },

    deepLink(channel, lead, payload) {
      const body = payload && payload.body ? payload.body : '';
      const subject = payload && payload.subject ? payload.subject : '';
      const enc = encodeURIComponent;
      const c = App.store.get('settings.company', {});
      if (channel === 'whatsapp') {
        const d = msg.dial(lead);
        return d ? 'https://wa.me/' + d + '?text=' + enc(body) : '';
      }
      if (channel === 'telegram') {
        const tg = String(lead.telegram || '').replace(/^@/, '').trim();
        if (tg) return 'https://t.me/' + tg;
        const d = msg.dial(lead);
        return d ? 'https://t.me/+' + d : '';
      }
      if (channel === 'email') {
        return 'mailto:' + (lead.email || '') + '?subject=' + enc(subject || ('A website concept for ' + lead.name)) + '&body=' + enc(body);
      }
      if (channel === 'sms') {
        const d = msg.dial(lead);
        return d ? 'sms:+' + d + '?&body=' + enc(body) : '';
      }
      if (channel === 'call') {
        const d = msg.dial(lead);
        return d ? 'tel:+' + d : '';
      }
      if (channel === 'facebook') return lead.socials && lead.socials.facebook ? lead.socials.facebook : (c.portfolioUrl || '');
      if (channel === 'instagram') return lead.socials && lead.socials.instagram ? lead.socials.instagram : '';
      return '';
    },

    /**
     * One tap send.
     *  - with an API/webhook configured (WhatsApp Cloud API or your own sender) → posts the message
     *  - otherwise → opens the chat with the message prefilled/copied so you press send
     * Always logs an outreach record so the pipeline stays accurate.
     */
    send(o) {
      const lead = o.lead, channel = o.channel, body = o.body || '';
      const payload = { body: body, subject: o.subject || '' };
      const integration = App.store.get('settings.integration', {});
      const canApi = integration.autoSendEnabled && integration.webhookUrl;

      const finish = (via, url) => {
        msg.logOutreach(lead, {
          channel: channel, templateId: o.templateId, body: body, subject: o.subject,
          via: via, url: url || ''
        });
        return { via: via, url: url || '' };
      };

      if (canApi) {
        const to = channel === 'email' ? lead.email : (channel === 'telegram' ? lead.telegram : msg.dial(lead));
        return fetch(integration.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Triverse-Token': integration.webhookToken || '' },
          body: JSON.stringify({
            channel: channel, to: to, toName: lead.name, message: body, subject: o.subject || '',
            leadId: lead.id, sentBy: App.store.get('settings.company.senderName', '')
          })
        }).then(res => {
          if (!res.ok) throw new Error('Sender API responded HTTP ' + res.status);
          App.ui.toast('Sent through your API sender ✓', 'lime');
          return finish('api', '');
        }).catch(err => {
          App.ui.toast('API send failed (' + err.message + ') — opening the chat manually instead', 'amber');
          const url = msg.deepLink(channel, lead, payload);
          if (url) U.openUrl(url);
          return finish('manual', url);
        });
      }

      const url = msg.deepLink(channel, lead, payload);
      if (url) {
        U.openUrl(url);
        if (channel !== 'email') U.copy(body);
      }
      return Promise.resolve(finish('manual', url));
    },

    logOutreach(lead, data) {
      const leadRow = App.store.find('leads', lead.id) || lead;
      const outreach = (leadRow.outreach || []).slice(0, 60);
      outreach.unshift({
        id: U.uid('out'), at: U.now(), channel: data.channel, templateId: data.templateId || '',
        body: data.body || '', subject: data.subject || '', status: 'sent', via: data.via || 'manual',
        url: data.url || '', reply: ''
      });
      const patch = { outreach: outreach };
      if (['new', 'qualified'].indexOf(leadRow.status) !== -1) patch.status = 'contacted';
      const days = App.store.get('settings.outreach.followUpDays', 3);
      if (!leadRow.nextFollowUp || leadRow.nextFollowUp < U.todayISO()) patch.nextFollowUp = U.addDays(U.todayISO(), days);
      App.store.patch('leads', leadRow.id, patch);
      App.log('message', 'Sent ' + App.dict.chanLabel(data.channel) + ' message to ' + leadRow.name, leadRow.id);
      return patch;
    },

    /* ------------------------------------------------------------ reply triage */
    classify(text) {
      const raw = String(text || '').toLowerCase().trim();
      const kw = App.store.get('messages.keywords', {});
      const reasons = [];
      let score = 0;
      const test = (needle) => {
        const n = needle.toLowerCase();
        if (n.length <= 2) return new RegExp('(^|\\s)' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s|$|[.,!])').test(raw);
        return raw.indexOf(n) !== -1;
      };
      (kw.negative || []).forEach(k => { if (test(k)) { score += k.indexOf(' ') !== -1 ? -3 : -2; reasons.push('“' + k + '”'); } });
      (kw.positive || []).forEach(k => { if (test(k)) { score += k.indexOf(' ') !== -1 ? 2 : 1; reasons.push('“' + k + '”'); } });
      const wantsSite = (kw.wantSite || []).some(k => test(k));
      if (wantsSite) { score += 2; reasons.push('mentioned a website/software need'); }
      const sentiment = score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
      return { sentiment: sentiment, score: score, wantsSite: wantsSite, reasons: U.uniq(reasons).slice(0, 6) };
    },

    /** store an incoming reply and move the lead accordingly */
    recordReply(leadId, text, channel) {
      const lead = App.store.find('leads', leadId);
      if (!lead) return null;
      const auto = App.store.get('settings.outreach.autoClassify', true);
      const res = auto ? msg.classify(text) : { sentiment: 'neutral', score: 0, wantsSite: false, reasons: ['manual review'] };
      /* positive → hot list (interested), negative → do-not-chase, unsure → needs triage */
      const status = res.sentiment === 'positive' ? 'interested'
        : res.sentiment === 'negative' ? 'rejected' : 'replied';
      const dropped = ['replied-positive', 'replied-negative', 'do-not-chase', 'wants-website', 'needs-qualify'];
      const tags = (lead.tags || []).filter(t => dropped.indexOf(t) === -1);
      if (res.sentiment === 'positive') tags.push('replied-positive');
      if (res.sentiment === 'negative') { tags.push('replied-negative'); tags.push('do-not-chase'); }
      if (res.wantsSite) tags.push('wants-website');
      if (res.sentiment === 'positive' && !res.wantsSite) tags.push('needs-qualify');

      const outreach = (lead.outreach || []).slice();
      if (outreach.length && !outreach[0].reply) outreach[0] = Object.assign({}, outreach[0], { reply: text, replyAt: U.now() });

      const nextFollowUp = res.sentiment === 'negative' ? ''
        : res.sentiment === 'positive' ? U.addDays(U.todayISO(), App.store.get('settings.outreach.followUpDays', 3))
          : U.addDays(U.todayISO(), App.store.get('settings.outreach.secondFollowUpDays', 7));

      App.store.patch('leads', leadId, {
        reply: { text: text, sentiment: res.sentiment, score: res.score, reasons: res.reasons, at: U.now(), channel: channel || 'whatsapp' },
        status: status, tags: tags, outreach: outreach, nextFollowUp: nextFollowUp, lastReplyAt: U.now()
      });
      App.log(res.sentiment === 'negative' ? 'reply-negative' : 'reply', lead.name + ' replied (' + res.sentiment + '): “' + String(text).slice(0, 90) + '”', leadId);

      const skip = App.store.get('settings.outreach.autoAdvanceOnNegative', true);
      return {
        sentiment: res.sentiment, score: res.score, reasons: res.reasons, wantsSite: res.wantsSite,
        status: status, lead: App.store.find('leads', leadId),
        nextLeadId: (res.sentiment === 'negative' && skip) ? msg.nextLead(leadId, l => ['new', 'qualified'].indexOf(l.status) !== -1) : ''
      };
    },

    /** the queue the operator is working through (last search order, filtered) */
    queueIds() {
      const q = App.router.q.queue;
      const all = App.store.get('leads', []);
      if (q && q.length) {
        const map = {};
        all.forEach(l => { map[l.id] = l; });
        return q.filter(id => map[id]);
      }
      return all.map(l => l.id);
    },

    nextLead(currentId, pred) {
      const ids = msg.queueIds();
      const map = {};
      App.store.get('leads', []).forEach(l => { map[l.id] = l; });
      const start = Math.max(0, ids.indexOf(currentId));
      for (let i = start + 1; i < ids.length + start; i++) {
        const id = ids[i % ids.length];
        if (!id || id === currentId) continue;
        const lead = map[id];
        if (!lead) continue;
        if (!pred || pred(lead)) return id;
      }
      return '';
    },

    /** quick stats for the dashboard / outreach screen */
    stats(leads) {
      const list = leads || App.store.get('leads', []);
      const contacted = list.filter(l => l.outreach && l.outreach.length);
      const replied = list.filter(l => l.reply);
      const positive = replied.filter(l => l.reply.sentiment === 'positive');
      const negative = replied.filter(l => l.reply.sentiment === 'negative');
      return {
        total: list.length,
        noWebsite: list.filter(l => !l.website).length,
        contacted: contacted.length,
        sent: U.sum(contacted, l => l.outreach.length),
        replied: replied.length,
        replyRate: contacted.length ? Math.round((replied.length / contacted.length) * 100) : 0,
        positive: positive.length,
        negative: negative.length,
        interested: list.filter(l => l.status === 'interested').length,
        won: list.filter(l => l.status === 'won').length,
        positiveRate: replied.length ? Math.round((positive.length / replied.length) * 100) : 0,
        pipelineValue: U.sum(list.filter(l => ['interested', 'proposal', 'contacted', 'replied'].indexOf(l.status) !== -1), l => Number(l.value) || 0)
      };
    }
  };
})(window);
