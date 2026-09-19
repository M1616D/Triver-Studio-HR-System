/* =============================================================================
   Triverse OS — Gemini layer
   Reads a business's own Google Maps record and writes what a good salesperson
   would write: the brief, the offers to pitch, the first message, and the full
   copy for their new website (headline, about, services, FAQ, testimonials from
   their real reviews). Optional — set a key in Settings → AI. Without a key the
   system behaves exactly as before, with the built-in templates.
   ========================================================================== */
(function (global) {
  'use strict';

  const App = global.App;
  const U = App.util;

  const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/';
  const LIST_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
  // Google retires model names without warning (2.0-flash and 2.5-flash have
  // already been withdrawn). So we never trust a hard-coded name: the app asks
  // the key which models it can actually use, then picks the best one.
  const PREFERRED = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];
  const FALLBACK_MODEL = 'gemini-2.5-flash';

  const HOUSE_RULES = [
    'You write for Triverse Studio Software Solution, a studio in Addis Ababa, Ethiopia (CEO: Bereket Mamuye).',
    'The studio sells: websites, digital QR menus, HR & payroll software, inventory & billing software, custom modules, mobile apps, logos, brand kits, flyers, banners, thumbnails, social media ad packs, Meta/TikTok ad setup, hosting and maintenance retainers.',
    'All prices are in Ethiopian Birr (ETB) and shown like "Br 55,000".',
    'Use ONLY the facts given about the business. Never invent awards, years in business, staff numbers, certificates or claims.',
    'Write in warm, plain, professional English. Short sentences. No hype words like "revolutionary" or "cutting-edge".',
    'Speak to the owner, not to a marketing department. Ethiopian business context: Telebirr / CBE Birr payments, WhatsApp as the main channel, walk-in customers.',
    'Return JSON only. No markdown, no code fences, no commentary around it.'
  ].join('\n');

  const ai = App.ai = {
    ready() {
      const a = App.store.get('settings.ai', {});
      return Boolean(a && a.geminiKey && String(a.geminiKey).length > 15);
    },
    key() { return String(App.store.get('settings.ai.geminiKey', '') || '').trim(); },
    model() {
      const m = String(App.store.get('settings.ai.model', '') || '').trim();
      return m || PREFERRED[0];
    },
    setModel(name) {
      App.store.set('settings.ai.model', String(name || '').replace(/^models\//, ''), { silent: true });
      App.store.save();
    },

    /* --------------------------------------------------- which models exist? */
    /**
     * Ask the key itself which models it may call. This is the fix for
     * "models/gemini-2.0-flash is no longer available": we stop guessing names
     * and read the list Google returns for this exact key.
     */
    listModels(force) {
      const cached = App.store.get('settings.ai.modelList', null);
      const at = App.store.get('settings.ai.modelListAt', 0);
      if (!force && Array.isArray(cached) && cached.length && (U.now() - at) < 6 * 60 * 60 * 1000) {
        return Promise.resolve(cached);
      }
      if (!ai.key()) return Promise.reject(new Error('No Gemini API key saved. Add one in Settings \u2192 AI.'));
      return fetch(LIST_URL + '?pageSize=200&key=' + encodeURIComponent(ai.key()))
        .then(res => res.json().then(data => ({ res: res, data: data })))
        .then(r => {
          if (!r.res.ok) {
            const err = (r.data && r.data.error) || {};
            throw new Error('Gemini: ' + (err.message || ('HTTP ' + r.res.status)) + ai.hint(r.res.status, err));
          }
          const names = ((r.data && r.data.models) || [])
            .filter(m => ((m.supportedGenerationMethods || m.supportedActions) || []).indexOf('generateContent') !== -1)
            .map(m => String(m.name || '').replace(/^models\//, ''))
            .filter(Boolean);
          const list = ai.rank(names);
          App.store.set('settings.ai.modelList', list, { silent: true });
          App.store.set('settings.ai.modelListAt', U.now(), { silent: true });
          App.store.save();
          return list;
        });
    },

    /** only text models that can actually answer; best first */
    rank(names) {
      const bad = /embedding|aqa|imagen|image|vision-only|tts|audio|learnlm|gemma/i;
      const seen = {};
      const ok = (names || []).filter(n => {
        if (!/^gemini/i.test(n) || bad.test(n) || seen[n]) return false;
        seen[n] = 1;
        return true;
      });
      function score(n) {
        const v = parseFloat((n.match(/(\d+(?:\.\d+)?)/) || [])[1] || '0');
        let s = v * 100;
        if (/flash/.test(n)) s += 40;            // fast enough for a sales desk
        if (/flash-lite/.test(n)) s -= 10;
        if (/pro/.test(n)) s -= 5;
        if (/preview|exp|experimental/.test(n)) s -= 20;
        if (/latest/.test(n)) s += 5;
        if (/thinking/.test(n)) s -= 15;
        const pref = PREFERRED.indexOf(n);
        if (pref !== -1) s += 500 - pref;
        return s;
      }
      return ok.sort((a, b) => score(b) - score(a));
    },

    /** the best model this key can use (asks Google once, then caches) */
    bestModel(force) {
      return ai.listModels(force).then(list => list[0] || FALLBACK_MODEL).catch(() => ai.model());
    },

    /** if the saved name is dead, swap it for a live one and remember the swap */
    ensureModel(force) {
      return ai.listModels(force).then(list => {
        if (!list.length) return FALLBACK_MODEL;
        const cur = ai.model();
        if (list.indexOf(cur) !== -1) return cur;
        const next = list[0];
        ai.setModel(next);
        App.store.set('settings.ai.modelSwappedFrom', cur, { silent: true });
        App.store.save();
        return next;
      });
    },

    /** one raw Gemini call: prompt in, text out */
    call(prompt, opts) {
      return ai.attempt(prompt, opts, false);
    },

    attempt(prompt, opts, retried) {
      opts = opts || {};
      if (!ai.key()) return Promise.reject(new Error('No Gemini API key saved. Add one in Settings → AI.'));
      const model = ai.model();
      const gen = {
        temperature: opts.temperature === undefined ? 0.75 : opts.temperature,
        maxOutputTokens: opts.maxTokens || 3000,
        responseMimeType: 'application/json'
      };
      /*
       * 2.5-and-later models THINK before answering, and thinking tokens are
       * charged against maxOutputTokens. Left on, the model can spend the whole
       * budget thinking and the JSON comes back chopped — which is exactly what
       * "The AI answer was not JSON: {"ok":true,"message":" was. Every call here
       * wants one short exact object, so thinking is switched off.
       */
      const thinking = !opts.noThinking && ai.supportsThinking(model);
      if (thinking) gen.thinkingConfig = { thinkingBudget: 0 };

      const body = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        systemInstruction: { role: 'system', parts: [{ text: opts.system || HOUSE_RULES }] },
        generationConfig: gen
      };
      return fetch(ENDPOINT + encodeURIComponent(model) + ':generateContent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': ai.key() },
        body: JSON.stringify(body)
      }).then(res => res.json().then(data => ({ res: res, data: data })))
        .then(r => {
          if (!r.res.ok) {
            const err = (r.data && r.data.error) || {};
            const text = String(err.message || '');
            const deadModel = r.res.status === 404 || /no longer available|not found for API version|not supported for/i.test(text);
            const badThinking = thinking && /thinking|unknown name|invalid.*field|Invalid JSON payload/i.test(text);
            // Self-heal: a retired model name is not the user's problem to fix.
            if (deadModel && !retried) {
              return ai.ensureModel(true)
                .then(live => ai.attempt(prompt, opts, true))
                .then(txt => txt, () => Promise.reject(new Error('Gemini: ' + text + ai.hint(r.res.status, err))));
            }
            // Self-heal: a model that rejects thinkingConfig is called without it.
            if (badThinking && !retried) {
              return ai.attempt(prompt, Object.assign({}, opts, { noThinking: true }), true);
            }
            throw new Error('Gemini: ' + (err.message || ('HTTP ' + r.res.status)) + ai.hint(r.res.status, err));
          }
          const cand = (r.data.candidates || [])[0] || {};
          const parts = (cand.content && cand.content.parts) || [];
          // a thought part is the model thinking out loud — never the answer
          const text = parts.filter(p => !p.thought).map(p => p.text || '').join('').trim();
          if (!text) throw new Error('Gemini returned an empty answer' + (cand.finishReason ? ' (' + cand.finishReason + ')' : ''));
          /*
           * MAX_TOKENS means the object was cut off mid-sentence. Retrying with a
           * bigger budget is far better than showing a broken answer, which is
           * what used to happen here.
           */
          if (cand.finishReason === 'MAX_TOKENS' && !retried) {
            return ai.attempt(prompt, Object.assign({}, opts, {
              maxTokens: Math.min((gen.maxOutputTokens || 3000) * 2, 16000)
            }), true);
          }
          return text;
        });
    },

    /** only 2.5-and-later models accept thinkingConfig */
    supportsThinking(model) {
      return /gemini-(?:2\.5|3|4)|thinking/i.test(String(model || ''));
    },

    hint(status, err) {
      const msg = String((err && err.message) || '');
      if (status === 400 && /API key not valid/i.test(msg)) return ' The key was rejected — copy it again from aistudio.google.com/apikey (it starts with AIza).';
      if (status === 403) return ' The key is valid but the Generative Language API is not enabled for its project. Open console.cloud.google.com → APIs & Services → Library → enable “Generative Language API”.';
      if (status === 429) return ' Free-tier rate limit reached — wait a minute and try again.';
      if (status === 404 || /no longer available/i.test(msg)) return ' That model has been retired by Google. Press “Detect models” in Settings \u2192 AI and the app will switch to a live one automatically.';
      return '';
    },

    /**
     * Gemini often wraps JSON in prose or fences, and a truncated answer has no
     * closing brace at all. This pulls the object out, and when the tail is
     * missing it closes the brackets rather than failing the whole call.
     */
    parseJSON(text) {
      let t = String(text || '').trim()
        .replace(/^```(?:json)?/i, '').replace(/```\s*$/, '')
        .replace(/^[\s\S]*?(?=\{)/, '').trim();
      if (!t) throw new Error('The AI answer was empty where JSON was expected.');

      const direct = ai.tryParse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
      if (direct) return direct;

      /* the answer was cut off — close whatever is still open */
      const repaired = ai.repairJSON(t.slice(t.indexOf('{')));
      const parsed = ai.tryParse(repaired);
      if (parsed) return parsed;

      throw new Error('The AI answer was not usable JSON: ' + t.slice(0, 160));
    },

    tryParse(s) {
      if (!s || s.length < 2) return null;
      try { return JSON.parse(s); } catch (e) { return null; }
    },

    /** close open strings, arrays and objects so a truncated answer still reads */
    repairJSON(s) {
      let out = '', depth = 0, inStr = false, esc = false;
      const stack = [];
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (esc) { out += c; esc = false; continue; }
        if (c === '\\') { out += c; esc = true; continue; }
        if (c === '"') { inStr = !inStr; out += c; continue; }
        if (!inStr) {
          if (c === '{' || c === '[') { stack.push(c); depth++; }
          else if (c === '}' || c === ']') { stack.pop(); depth--; }
        }
        out += c;
      }
      if (inStr) out += '"';
      /* a half-written member (  ,"key":  ) is dropped before we close brackets */
      out = out.replace(/,?\s*"[^"]*"\s*:\s*$/, '');
      out = out.replace(/[,:]\s*$/, '');
      out = out.replace(/,\s*$/, '');
      while (stack.length) out += stack.pop() === '{' ? '}' : ']';
      return out;
    },

    /* --------------------------------------------------------- the facts we send */
    /** the business's real Google record, in plain text, for the model */
    context(lead) {
      const c = App.store.get('settings.company', {});
      const t = App.dict.typeOf(lead.businessType);
      const reviews = (lead.reviewsList || []).slice(0, 5).map(r =>
        '- ' + r.when + ', ' + r.rating + '★, ' + r.author + ': ' + String(r.text || '(rating only)').slice(0, 240));
      return [
        'BUSINESS FACTS (from Google Maps)',
        'Name: ' + (lead.name || ''),
        'Category: ' + (lead.category || t.label),
        'Type group: ' + t.label,
        'Address: ' + (lead.address || ''),
        'Area: ' + (lead.areaLabel || lead.city || 'Addis Ababa'),
        'Google rating: ' + (lead.rating ? Number(lead.rating).toFixed(1) + ' out of 5' : 'not rated'),
        'Number of Google reviews: ' + (lead.reviews || 0),
        'Website on Google: ' + (lead.website ? lead.website : 'NONE — this is the opportunity'),
        'Phone on Google: ' + (lead.phone || lead.intlPhone || 'none listed'),
        'Opening hours: ' + ((lead.hoursWeek && lead.hoursWeek.length) ? lead.hoursWeek.join(' | ') : (lead.hours || 'not listed')),
        'Currently: ' + (lead.openNow === true ? 'open now' : lead.openNow === false ? 'closed now' : 'unknown'),
        'Price level: ' + (lead.priceLevelLabel || 'not listed'),
        lead.lat ? 'Coordinates: ' + lead.lat + ', ' + lead.lng : '',
        lead.summary ? 'Google description: ' + lead.summary : '',
        reviews.length ? 'REAL CUSTOMER REVIEWS:\n' + reviews.join('\n') : 'No written reviews available.',
        '',
        'OUR STUDIO:',
        'Company: ' + (c.name || 'Triverse Studio Software Solution'),
        'Sender: ' + (c.senderName || 'Bereket Mamuye') + ', ' + (c.senderRole || 'Co-founder & CEO'),
        'City: ' + (c.city || 'Addis Ababa') + ', ' + (c.country || 'Ethiopia'),
        'Portfolio: ' + (c.portfolio || c.website || ''),
        'Recommended offer from our catalogue: ' + App.msg.recommend(lead).items.map(i => i.name + ' (' + U.money(i.price) + ')').join(', ')
      ].filter(Boolean).join('\n');
    },

    /* ------------------------------------------------------------- lead brief */
    brief(lead) {
      const prompt = ai.context(lead) + '\n\n' +
        'Write the sales brief for this business and the first cold message to its owner.\n' +
        'Return JSON with exactly these keys: {"summary": "2 sentences a salesperson would say about this business and why a website matters to it", "angle": "the single strongest reason they should care, in under 20 words", "offer": "the one product to lead with and why", "risks": "one honest thing to be careful about when approaching them", "message": "a WhatsApp-ready first message, maximum 120 words, using: their name, their own rating and review count, one detail taken from their real reviews, a no-pressure question asking permission to send a free design concept. Sign as the sender from the studio. Never claim the website exists already."}';
      return ai.call(prompt, { temperature: 0.8 }).then(txt => ai.parseJSON(txt));
    },

    /* ------------------------------------------------------------- site copy */
    siteCopy(lead, sections) {
      const items = App.sitegen.items(lead).map(i => i.name + ' — ' + (i.price ? U.money(i.price) : 'price on request') + ' — ' + i.desc).join('\n');
      const prompt = ai.context(lead) + '\n\n' +
        'These are the draft service items our system prepared for their page (keep the names and prices unless a fact above contradicts them):\n' + items + '\n\n' +
        'Sections the page will show: ' + (sections || []).join(', ') + '\n\n' +
        'Write the website copy for this business, in their voice, using their real facts.\n' +
        'Return JSON with exactly these keys:\n' +
        '{"headline":"max 8 words", "tagline":"one sentence under the headline", "about":"two short paragraphs about the business as they would write it, based only on the facts", ' +
        '"services":[{"name":"service or dish name","desc":"one clear line","price":number_or_0}], "faq":[["question","answer"]], "cta":"one short line inviting the customer to call or message"}\n' +
        'Give 4 to 6 services and exactly 4 FAQ entries. Prices are ETB numbers only (no currency symbol).';
      return ai.call(prompt, { temperature: 0.8, maxTokens: 2600 }).then(txt => ai.parseJSON(txt));
    },

    /* ------------------------------------------------------- reply analysis */
    replyHelp(lead, replyText) {
      const prompt = ai.context(lead) + '\n\n' +
        'The owner replied to our first message with:\n"' + String(replyText || '').slice(0, 900) + '"\n\n' +
        'Return JSON with exactly these keys: {"sentiment":"positive" or "negative" or "unclear", "reason":"why, in under 15 words", ' +
        '"next":"the single best next step", "answer":"a short, warm reply we should send back (max 90 words) that moves them toward seeing the design concept or explaining the price"}';
      return ai.call(prompt, { temperature: 0.6 }).then(txt => ai.parseJSON(txt));
    },

    /* ------------------------------------------------------------ connectivity */
    /** proves the key AND picks a live model in one press */
    test() {
      return ai.listModels(true).then(list => {
        if (!list.length) throw new Error('The key works but exposes no text model.');
        const cur = ai.model();
        const use = list.indexOf(cur) !== -1 ? cur : list[0];
        if (use !== cur) {
          ai.setModel(use);
          App.store.set('settings.ai.modelSwappedFrom', cur, { silent: true });
          App.store.save();
        }
        return ai.attempt('Return JSON: {"ok":true,"message":"Gemini is connected."}', { temperature: 0, maxTokens: 200 }, true)
          .then(j => {
            ai.parseJSON(j);
            return {
              model: use,
              total: list.length,
              swapped: use !== cur ? cur : '',
              alt: list.slice(1, 4)
            };
          });
      });
    }
  };

  /* ============================== the screens ============================== */

  /** drawer action: brief + a message written from this business's real record */
  App.action('lead.aiBrief', el => {
    const lead = App.store.find('leads', el.getAttribute('data-arg'));
    if (!lead) return;
    const body = '<div id="ai-brief"><div class="glass-soft rounded-xl p-4 text-[11px] text-textMuted flex items-center gap-2">' +
      '<i class="fa-solid fa-brain fa-fade text-accentMint"></i> Reading ' + U.esc(lead.name) + '’s Google Maps record — reviews, hours, website gaps — and writing the brief…</div></div>';
    App.ui.modal({
      title: 'AI brief · ' + lead.name,
      sub: 'Written from this business’s own Maps data, never from a template',
      size: 'lg',
      body: body,
      footer: '<button class="btn btn-ghost" data-action="close-modal">Close</button>' +
        '<button class="btn btn-lime" data-action="ai.useMessage" data-arg="' + lead.id + '"><i class="fa-solid fa-paper-plane"></i> Put this message in the composer</button>'
    });
    ai.brief(lead).then(b => {
      App.router.q.aiBrief = b;
      const box = document.getElementById('ai-brief');
      if (!box) return;
      const rows = [
        ['What we know', b.summary, 'fa-circle-info'],
        ['Why they should care', b.angle, 'fa-bolt'],
        ['Lead with', b.offer, 'fa-tag'],
        ['Watch out', b.risks, 'fa-triangle-exclamation']
      ];
      box.innerHTML = rows.map(r => r[1] ? '<div class="glass-soft rounded-xl p-3 mb-2">' +
        '<p class="text-[10px] text-accentMint font-semibold mb-1">' + App.ui.icon(r[2], '') + ' ' + U.esc(r[0]) + '</p>' +
        '<p class="text-[11px] text-gray-300 leading-relaxed">' + U.esc(r[1]) + '</p></div>' : '').join('') +
        '<p class="lbl mt-3">First WhatsApp message</p>' +
        '<textarea class="inp" id="ai-message" rows="9">' + U.esc(b.message || '') + '</textarea>' +
        '<div class="btn-row mt-2">' +
        '<button class="btn btn-ghost btn-sm" data-action="ai.copyMessage"><i class="fa-solid fa-copy"></i> Copy</button>' +
        '<button class="btn btn-ghost btn-sm" data-action="ai.sendMessage" data-arg="' + lead.id + '"><i class="fa-brands fa-whatsapp"></i> Send on WhatsApp</button>' +
        '</div>';
    }).catch(err => {
      const box = document.getElementById('ai-brief');
      if (box) box.innerHTML = '<div class="glass-soft rounded-xl p-3 text-[11px] tone tone-red border whitespace-pre-line">' + U.esc(err.message) + '</div>' +
        '<p class="text-[10px] text-textMuted mt-2">Without the AI layer you can still work: the built-in message templates in the drawer and in Settings → Messages are personalised with the same Google data.</p>';
    });
  });

  App.action('ai.copyMessage', () => {
    const box = document.getElementById('ai-message');
    if (box) U.copy(box.value).then(() => App.ui.toast('Message copied', 'lime'));
  });
  App.action('ai.sendMessage', el => {
    const lead = App.store.find('leads', el.getAttribute('data-arg'));
    const box = document.getElementById('ai-message');
    if (!lead || !box) return;
    const tpl = App.msg.defaultTemplate(lead);
    App.ui.closeModal();
    App.msg.send({ lead: lead, channel: 'whatsapp', templateId: tpl ? tpl.id : '', body: box.value }).then(() => {
      App.ui.toast('Chat opened with the AI-written message — press send', 'lime');
      App.emit('state:changed', { path: 'sent' });
    });
  });
  App.action('ai.useMessage', el => {
    const lead = App.store.find('leads', el.getAttribute('data-arg'));
    const box = document.getElementById('ai-message');
    if (!lead || !box) { App.ui.closeModal(); return; }
    App.router.q.compose = App.router.q.compose || {};
    App.router.q.compose[lead.id] = box.value;
    App.ui.closeModal();
    App.ui.toast('Message ready in the composer', 'lime');
    if (App.actions['outreach.openCompose']) App.actions['outreach.openCompose']({ getAttribute: () => lead.id }, null);
  });

  /** generator action: swap the generated copy for AI copy built on the record */
  App.action('gen.ai', () => {
    const g = App.router.q.gen;
    const lead = App.store.find('leads', g.leadId);
    if (!lead) return;
    const box = document.getElementById('gen-preview');
    if (box) box.innerHTML = '<div class="glass-soft rounded-xl p-4 text-[11px] text-textMuted flex items-center gap-2">' +
      '<i class="fa-solid fa-brain fa-fade text-accentMint"></i> Gemini is writing the copy from this business’s reviews, hours and services…</div>';
    ai.siteCopy(lead, g.sections).then(copy => {
      g.ai = copy;
      if (App.openGenPreview) App.openGenPreview();
      else if (App.actions['gen.build']) App.actions['gen.build']({}, null);
      App.ui.toast('AI copy written — check the preview', 'lime');
    }).catch(err => {
      if (box) box.innerHTML = '<div class="glass-soft rounded-xl p-3 text-[11px] tone tone-red border whitespace-pre-line">' + U.esc(err.message) + '</div>' +
        '<p class="text-[10px] text-textMuted mt-2">The template copy is still there — press “Regenerate preview”.</p>';
    });
  });

  /** settings action: is the key working? */
  App.action('settings.aiTest', () => {
    const out = document.getElementById('ai-check');
    if (!out) return;
    const key = ai.key();
    if (!key) { out.innerHTML = '<div class="glass-soft p-3 text-[11px] tone tone-amber border">Paste your Gemini API key above first (aistudio.google.com/apikey).</div>'; return; }
    out.innerHTML = '<div class="glass-soft p-3 text-[11px] text-textMuted flex items-center gap-2"><i class="fa-solid fa-spinner fa-spin text-accentMint"></i> Asking Gemini a one-word question…</div>';
    ai.test().then(info => {
      App.store.set('settings.ai.lastCheck', U.now(), { silent: true });
      App.store.set('settings.ai.lastCheckState', 'ok', { silent: true });
      App.store.set('settings.ai.lastCheckText', 'Connected on ' + info.model, { silent: true });
      App.store.set('settings.ai.enabled', true, { silent: true });
      App.store.save();
      out.innerHTML = '<div class="glass-soft p-3 text-[11px] tone tone-lime border">' +
        '<b>Connected.</b> Model in use: <b>' + U.esc(info.model) + '</b>' +
        (info.swapped ? ' <span class="text-textMuted">(“' + U.esc(info.swapped) + '” was retired by Google, switched automatically)</span>' : '') +
        '. ' + info.total + ' text models available on this key' +
        (info.alt.length ? ', e.g. ' + info.alt.map(x => U.esc(x)).join(', ') : '') + '.' +
        '<div class="btn-row mt-2">' +
        '<button class="btn btn-ghost btn-sm" data-action="settings.aiTest"><i class="fa-solid fa-rotate"></i> Test again</button>' +
        '<button class="btn btn-ghost btn-sm" data-action="ai.openAssistant"><i class="fa-solid fa-wand-magic-sparkles"></i> Open the assistant</button>' +
        '</div></div>';
      App.emit('ai:changed', {});
    }).catch(err => {
      App.store.set('settings.ai.lastCheck', U.now(), { silent: true });
      App.store.set('settings.ai.lastCheckState', 'bad', { silent: true });
      App.store.set('settings.ai.lastCheckText', err.message, { silent: true });
      App.store.set('settings.ai.enabled', false, { silent: true });
      App.store.save();
      out.innerHTML = '<div class="glass-soft p-3 text-[11px] tone tone-red border whitespace-pre-line">' + U.esc(err.message) + '</div>' +
        '<div class="btn-row mt-2"><button class="btn btn-ghost btn-sm" data-action="settings.aiTest"><i class="fa-solid fa-rotate"></i> Try again</button></div>';
    });
  });

  /** Settings → AI: list every model the key can really call */
  App.action('settings.aiModels', () => {
    const out = document.getElementById('ai-check');
    if (!out) return;
    if (!ai.key()) { out.innerHTML = '<div class="glass-soft p-3 text-[11px] tone tone-amber border">Paste the key above first.</div>'; return; }
    out.innerHTML = '<div class="glass-soft p-3 text-[11px] text-textMuted"><i class="fa-solid fa-spinner fa-spin"></i> Asking Google which models this key can use…</div>';
    ai.listModels(true).then(list => {
      const cur = ai.model();
      out.innerHTML = '<div class="glass-soft p-3 text-[11px]">' +
        '<p class="text-accentMint font-semibold mb-2">' + list.length + ' models available</p>' +
        '<div class="flex flex-wrap gap-1 max-h-40 overflow-auto">' +
        list.map(n => '<button class="chip ' + (n === cur ? 'is-on' : '') + '" data-action="ai.pickModel" data-arg="' + U.esc(n) + '">' + U.esc(n) + '</button>').join('') +
        '</div><div class="btn-row mt-2"><button class="btn btn-ghost btn-sm" data-action="settings.aiTest"><i class="fa-solid fa-plug-circle-check"></i> Test the selected one</button></div></div>';
    }).catch(err => {
      out.innerHTML = '<div class="glass-soft p-3 text-[11px] tone tone-red border whitespace-pre-line">' + U.esc(err.message) + '</div>';
    });
  });

  App.action('ai.pickModel', el => {
    ai.setModel(el.getAttribute('data-arg'));
    App.ui.toast('Model set to ' + ai.model(), 'lime');
    if (App.actions['settings.aiModels']) App.actions['settings.aiModels']({}, null);
  });
})(window);
