/* ============================================================
   CARDSTRIKE — UI shell + meta screens.
   Presentation only: reads Meta/Engine/AI state, emits actions.
   ============================================================ */
(function (NS) {
  'use strict';
  const C = NS.CFG, M = () => NS.Meta, E = () => NS.Engine;

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const el = (tag, cls, html) => { const d = document.createElement(tag); if (cls) d.className = cls; if (html != null) d.innerHTML = html; return d; };
  const esc = (s) => String(s == null ? '' : s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

  /* ---------------- procedural SVG card art ---------------- */
  const THEME_BG = {
    verdant: ['#0d2413', '#1d4d28', '#79e08c'], horde: ['#26091a', '#4d1533', '#e0629b'],
    legion: ['#0a1526', '#173256', '#6fb0ff'], custodes: ['#0c1418', '#173a45', '#5fd0e0'],
    arcane: ['#140f2b', '#2b1f5e', '#b48cff'], neutral: ['#101318', '#272d3a', '#9aa6bd'],
  };
  const MOTIFS = {
    skull: '<circle cx="50" cy="42" r="22" fill="none" stroke="CC" stroke-width="5"/><circle cx="41" cy="38" r="6" fill="CC"/><circle cx="59" cy="38" r="6" fill="CC"/><path d="M42 64 h16 l-4 12 h-8 z" fill="CC"/><path d="M34 66 v10 M50 66 v12 M66 66 v10" stroke="CC" stroke-width="4"/>',
    dragon: '<path d="M20 70 Q35 30 55 38 L78 24 L64 46 Q80 58 60 72 Q40 82 20 70 Z" fill="none" stroke="CC" stroke-width="5"/><circle cx="52" cy="48" r="5" fill="CC"/><path d="M30 62 L44 56 M38 70 L50 64" stroke="CC" stroke-width="4"/>',
    wolf: '<path d="M30 34 L42 46 L38 62 L50 74 L62 62 L58 46 L70 34 L60 44 L50 38 L40 44 Z" fill="none" stroke="CC" stroke-width="4"/><circle cx="44" cy="52" r="3.5" fill="CC"/><circle cx="56" cy="52" r="3.5" fill="CC"/>',
    spider: '<circle cx="50" cy="52" r="14" fill="none" stroke="CC" stroke-width="5"/><path d="M38 42 L20 26 M62 42 L80 26 M36 54 L16 54 M64 54 L84 54 M40 64 L24 80 M60 64 L76 80" stroke="CC" stroke-width="4"/><circle cx="50" cy="46" r="4" fill="CC"/>',
    leaf: '<path d="M50 20 Q78 40 50 82 Q22 40 50 20 Z" fill="none" stroke="CC" stroke-width="5"/><path d="M50 28 V72 M50 40 L38 50 M50 52 L62 62" stroke="CC" stroke-width="3.5"/>',
    flame: '<path d="M50 16 Q70 40 62 58 Q74 56 72 74 Q60 88 50 86 Q28 84 30 62 Q34 74 42 70 Q30 44 50 16 Z" fill="none" stroke="CC" stroke-width="4.5"/>',
    bolt: '<path d="M56 14 L34 52 L48 52 L40 86 L70 44 L54 44 Z" fill="none" stroke="CC" stroke-width="4.5"/>',
    shield: '<path d="M50 16 L78 28 V54 Q78 76 50 86 Q22 76 22 54 V28 Z" fill="none" stroke="CC" stroke-width="5"/><path d="M34 48 L46 60 L68 36" stroke="CC" stroke-width="5" fill="none"/>',
    blade: '<path d="M28 78 L60 20 L72 20 L64 44 L48 82 Z" fill="none" stroke="CC" stroke-width="4.5"/><path d="M30 70 L58 24" stroke="CC" stroke-width="3"/>',
    spear: '<path d="M50 12 L58 34 L54 34 L54 88 L46 88 L46 34 L42 34 Z" fill="CC"/><path d="M34 44 L50 28 L66 44" fill="none" stroke="CC" stroke-width="4"/>',
    bow: '<path d="M34 18 Q66 50 34 82" fill="none" stroke="CC" stroke-width="5"/><path d="M34 18 L34 82 M34 50 L72 50" stroke="CC" stroke-width="3"/><path d="M72 50 L62 44 M72 50 L62 56" stroke="CC" stroke-width="4"/>',
    hammer: '<path d="M32 26 H68 V44 H32 Z" fill="none" stroke="CC" stroke-width="5"/><path d="M50 44 V84 M42 84 H58" stroke="CC" stroke-width="6"/>',
    mech: '<rect x="30" y="26" width="40" height="34" rx="6" fill="none" stroke="CC" stroke-width="5"/><circle cx="42" cy="42" r="5" fill="CC"/><circle cx="58" cy="42" r="5" fill="CC"/><path d="M40 60 V78 M60 60 V78 M30 34 L18 26 M70 34 L82 26" stroke="CC" stroke-width="4"/>',
    orb: '<circle cx="50" cy="50" r="26" fill="none" stroke="CC" stroke-width="5"/><ellipse cx="50" cy="50" rx="26" ry="10" fill="none" stroke="CC" stroke-width="3"/><circle cx="50" cy="50" r="7" fill="CC"/>',
    rune: '<circle cx="50" cy="50" r="24" fill="none" stroke="CC" stroke-width="4"/><path d="M50 30 L66 62 H34 Z M50 30 V70" fill="none" stroke="CC" stroke-width="4"/><circle cx="50" cy="52" r="4" fill="CC"/>',
    crown: '<path d="M24 40 L36 54 L50 30 L64 54 L76 40 L70 70 H30 Z" fill="none" stroke="CC" stroke-width="5"/><circle cx="50" cy="26" r="4" fill="CC"/><path d="M30 78 H70" stroke="CC" stroke-width="4"/>',
    ghost: '<path d="M32 78 V46 Q32 24 50 24 Q68 24 68 46 V78 L60 70 L52 78 L44 70 Z" fill="none" stroke="CC" stroke-width="5"/><circle cx="42" cy="46" r="4.5" fill="CC"/><circle cx="58" cy="46" r="4.5" fill="CC"/>',
    comet: '<circle cx="64" cy="38" r="16" fill="none" stroke="CC" stroke-width="5"/><path d="M20 82 L52 50 M30 86 L58 58 M16 72 L44 44" stroke="CC" stroke-width="4"/>',
    hourglass: '<path d="M32 20 H68 L52 50 L68 80 H32 L48 50 Z" fill="none" stroke="CC" stroke-width="5"/><path d="M36 26 H64 M36 74 H64" stroke="CC" stroke-width="3"/>',
    wall: '<rect x="20" y="34" width="60" height="36" fill="none" stroke="CC" stroke-width="5"/><path d="M20 52 H80 M40 34 V52 M60 52 V70 M40 52 H60 M60 34 H80" stroke="CC" stroke-width="3"/>',
    font: '<path d="M28 40 Q50 20 72 40 L66 66 H34 Z" fill="none" stroke="CC" stroke-width="5"/><circle cx="50" cy="50" r="7" fill="CC"/><path d="M50 66 V82 M40 82 H60" stroke="CC" stroke-width="4"/>',
    brazier: '<path d="M34 46 H66 L60 62 H40 Z" fill="none" stroke="CC" stroke-width="4.5"/><path d="M50 46 Q58 34 50 22 Q46 32 40 34" fill="none" stroke="CC" stroke-width="4"/><path d="M36 62 L30 80 M64 62 L70 80 M30 80 H70" stroke="CC" stroke-width="4"/>',
    spring: '<path d="M26 56 Q50 44 74 56" fill="none" stroke="CC" stroke-width="5"/><path d="M30 66 Q50 56 70 66 M34 76 Q50 68 66 76" stroke="CC" stroke-width="3.5"/><path d="M50 20 Q60 34 50 44 Q40 34 50 20 Z" fill="none" stroke="CC" stroke-width="4"/>',
    crate: '<rect x="26" y="30" width="48" height="44" fill="none" stroke="CC" stroke-width="5"/><path d="M26 30 L74 74 M74 30 L26 74" stroke="CC" stroke-width="3"/>',
    pylon: '<path d="M50 16 L62 44 L56 84 H44 L38 44 Z" fill="none" stroke="CC" stroke-width="5"/><circle cx="50" cy="40" r="6" fill="CC"/><path d="M30 84 H70" stroke="CC" stroke-width="4"/>',
    fortress: '<rect x="22" y="38" width="56" height="44" fill="none" stroke="CC" stroke-width="5"/><path d="M22 38 L22 28 H32 V38 M42 38 V28 H52 V38 M62 38 V28 H72 V38" fill="none" stroke="CC" stroke-width="4"/><rect x="44" y="58" width="12" height="24" fill="CC"/>',
    guardian: '<path d="M50 16 L72 26 V54 Q72 76 50 86 Q28 76 28 54 V26 Z" fill="none" stroke="CC" stroke-width="5"/><path d="M40 48 L48 56 L62 40" stroke="CC" stroke-width="5" fill="none"/><circle cx="50" cy="30" r="4" fill="CC"/>',
    sling: '<circle cx="62" cy="34" r="10" fill="none" stroke="CC" stroke-width="4"/><path d="M56 42 Q40 56 34 78 M68 42 Q52 60 40 80 M34 78 Q40 84 40 80 M40 80 Q46 84 40 80" stroke="CC" stroke-width="3.5"/><circle cx="62" cy="34" r="3.5" fill="CC"/>',
    fang: '<path d="M36 22 Q50 40 44 74 Q40 60 36 48 M64 22 Q50 40 56 74 Q60 60 64 48" fill="none" stroke="CC" stroke-width="5"/>',
    banner: '<path d="M34 18 V84 M34 20 H70 L62 34 L70 48 H34" fill="none" stroke="CC" stroke-width="5"/>',
    flask: '<path d="M42 20 H58 V40 L70 72 Q72 82 62 82 H38 Q28 82 30 72 L42 40 Z" fill="none" stroke="CC" stroke-width="5"/><path d="M38 60 H62" stroke="CC" stroke-width="4"/><circle cx="47" cy="70" r="3" fill="CC"/>',
    tower: '<rect x="38" y="30" width="24" height="54" fill="none" stroke="CC" stroke-width="5"/><path d="M32 30 H68 L50 14 Z" fill="none" stroke="CC" stroke-width="4"/><rect x="46" y="52" width="8" height="10" fill="CC"/>',
  };
  function art(cardId, opts) {
    const card = NS.CARD[cardId] || { theme: 'neutral', motif: 'orb' };
    const o = opts || {};
    const bg = THEME_BG[card.theme] || THEME_BG.neutral;
    const motif = MOTIFS[card.motif] || MOTIFS.orb;
    const col = o.color || bg[2];
    const sym = motif.replace(/CC/g, col);
    const gid = 'g' + Math.random().toString(36).slice(2, 8);
    return '<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" class="art">' +
      '<defs><radialGradient id="' + gid + '" cx="50%" cy="38%" r="75%">' +
      '<stop offset="0%" stop-color="' + bg[1] + '"/><stop offset="100%" stop-color="' + bg[0] + '"/></radialGradient></defs>' +
      '<rect width="100" height="100" fill="url(#' + gid + ')"/>' +
      '<g opacity="0.85" transform="translate(0,2)">' + sym + '</g>' +
      '<circle cx="18" cy="20" r="1.6" fill="' + col + '" opacity="0.8"/><circle cx="84" cy="30" r="1.2" fill="' + col + '" opacity="0.7"/>' +
      '<circle cx="78" cy="82" r="1.6" fill="' + col + '" opacity="0.8"/><circle cx="24" cy="78" r="1.1" fill="' + col + '" opacity="0.6"/>' +
      '</svg>';
  }

  /* ---------------- card element ---------------- */
  function rarityClass(card) { return 'r' + card.rarity; }
  function statLine(card) {
    if (card.type === 'spell') return '<span class="tagline">Spell</span>';
    if (card.type === 'structure') return '<span class="tagline">Structure</span>';
    return '<span class="st atk">' + (card.atk || 0) + '</span><span class="st hp">' + (card.hp || card.sHp || 0) + '</span>' +
      '<span class="st">↑' + (card.mv || 0) + '</span><span class="st">◎' + rangeText(card) + '</span>';
  }
  function rangeText(card) {
    if (card.pattern === 'cleave') return 'adj';
    if (card.rng && (card.rng[0] > 1 || card.rng[1] > 1)) return card.rng[0] + '-' + card.rng[1];
    return '1';
  }
  function cardEl(cardId, opts) {
    const card = NS.CARD[cardId];
    const o = opts || {};
    const s = M().get().collection[cardId];
    const d = el('div', 'card ' + rarityClass(card) + (o.cls ? ' ' + o.cls : ''));
    const lvl = s ? s.level : 1;
    d.innerHTML =
      '<div class="card-top"><span class="cost">' + card.cost + '</span><span class="cname">' + esc(card.name) + '</span></div>' +
      '<div class="card-art">' + art(cardId, {}) + (card.rarity >= 4 ? '<div class="holo"></div>' : '') +
      (card.rarity >= 3 ? '<div class="rarity-gem"></div>' : '') + '</div>' +
      '<div class="card-stats">' + statLine(card) + '</div>' +
      '<div class="card-desc">' + esc(card.desc) + '</div>' +
      '<div class="card-bot"><span class="rname">' + C.rarities[card.rarity] + '</span>' +
      (o.showLevel && lvl > 1 ? '<span class="lvl">Lv ' + lvl + '</span>' : '') +
      (o.showCount && s && s.n > 1 ? '<span class="cnt">×' + s.n + '</span>' : '') + '</div>';
    if (o.onClick) d.addEventListener('click', () => o.onClick(cardId));
    return d;
  }

  /* ---------------- shell / navigation ---------------- */
  let screenHandlers = {};
  function show(id) {
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + id));
    if (screenHandlers[id]) screenHandlers[id]();
    M().persist();
  }
  function currencies() {
    const p = M().get().profile;
    return '<div class="curbar">' +
      '<span class="cur coins" title="Coins">⬤ ' + p.coins + '</span>' +
      '<span class="cur credits" title="Credits">◈ ' + p.credits + '</span>' +
      '<span class="cur stars" title="Star Points">★ ' + p.stars + '</span>' +
      '<span class="cur lvl" title="Account level">Lv ' + p.level + '</span></div>';
  }
  function toast(msg, kind) {
    const t = el('div', 'toast ' + (kind || ''), esc(msg));
    $('#toasts').appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 2600);
  }
  function modal(content, cls, onOpen) {
    const back = el('div', 'modal-back ' + (cls || ''));
    const box = el('div', 'modal-box');
    box.appendChild(content);
    back.appendChild(box);
    document.body.appendChild(back);
    back.addEventListener('click', (e) => { if (e.target === back && !back.dataset.locked) back.remove(); });
    if (onOpen) onOpen(box, back);
    return { box, back, close: () => back.remove() };
  }
  function confirmBox(title, body, onYes, yesLabel) {
    const c = el('div', 'confirm');
    c.innerHTML = '<h3>' + esc(title) + '</h3><div class="confirm-body">' + body + '</div>';
    const row = el('div', 'btnrow');
    const yes = el('button', 'btn primary', esc(yesLabel || 'Confirm'));
    const no = el('button', 'btn', 'Cancel');
    row.appendChild(no); row.appendChild(yes); c.appendChild(row);
    const m = modal(c, 'small');
    no.onclick = () => m.close();
    yes.onclick = () => { m.close(); onYes(); };
    return m;
  }

  /* ---------------- sound (WebAudio synth) ---------------- */
  let AC = null;
  function sfx(kind) {
    const s = M().get();
    if (!s || !s.settings.sfx) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      const t = AC.currentTime, g = AC.createGain(), o = AC.createOscillator();
      o.connect(g); g.connect(AC.destination);
      const table = {
        click: [520, 880, 0.06, 'triangle', 0.05], deploy: [180, 90, 0.22, 'square', 0.07],
        hit: [140, 60, 0.18, 'sawtooth', 0.08], spell: [720, 1200, 0.2, 'sine', 0.06],
        reveal: [420, 840, 0.3, 'sine', 0.05], fanfare: [520, 1040, 0.5, 'triangle', 0.08],
        error: [200, 120, 0.15, 'square', 0.06],
      };
      const cfg2 = table[kind] || table.click;
      o.type = cfg2[3]; o.frequency.setValueAtTime(cfg2[0], t); o.frequency.exponentialRampToValueAtTime(Math.max(40, cfg2[1]), t + cfg2[2]);
      g.gain.setValueAtTime(cfg2[4], t); g.gain.exponentialRampToValueAtTime(0.001, t + cfg2[2]);
      o.start(t); o.stop(t + cfg2[2] + 0.02);
    } catch (e) { /* audio unavailable */ }
  }

  /* ---------------- main menu ---------------- */
  function renderMenu() {
    const s = M().get();
    $('#cur-slot').innerHTML = currencies();
    const showcase = $('#menu-showcase');
    if (showcase && !showcase.dataset.filled) {
      showcase.dataset.filled = '1';
      ['pyraxis', 'matrix', 'zeraxim'].forEach((id, i) => {
        const c = cardEl(id, { cls: 'showcase-card' });
        c.style.setProperty('--tilt', (i - 1) * 4 + 'deg');
        c.onclick = () => cardDetail(id);
        showcase.appendChild(c);
      });
    }
    const dupes = s.pendingDupes.length;
    $('#menu-dupes-note').style.display = dupes ? '' : 'none';
    $('#menu-dupes-note').textContent = dupes + ' duplicate card(s) await your decision — visit the Collection.';
    $('#menu-deck-name').textContent = (s.decks[s.activeDeck] ? s.decks[s.activeDeck].name : 'No deck');
    $('#menu-deck-valid').textContent = s.decks[s.activeDeck] ? (NS.Meta.validateDeck(s.decks[s.activeDeck].cards).ok ? '✓ 35 cards ready' : '⚠ deck incomplete') : '';
  }

  /* ---------------- collection ---------------- */
  const colFilter = { type: 'all', rarity: 'all', theme: 'all', owned: false, q: '' };
  function renderCollection() {
    $('#cur-slot').innerHTML = currencies();
    const s = M().get();
    const grid = $('#col-grid');
    grid.innerHTML = '';
    const dupesBox = $('#col-dupes');
    dupesBox.innerHTML = '';
    dupesBox.style.display = s.pendingDupes.length ? '' : 'none';
    if (s.pendingDupes.length) {
      const head = el('div', 'dupe-head');
      head.innerHTML = '<b>' + s.pendingDupes.length + ' duplicate card(s)</b> — choose for each: sell for Coins, or convert to Star Points.';
      dupesBox.appendChild(head);
      s.pendingDupes.forEach((d) => {
        const r = NS.CARD[d.cardId].rarity;
        const row = el('div', 'dupe-row');
        row.appendChild(cardEl(d.cardId, { cls: 'mini' }));
        const acts = el('div', 'dupe-acts');
        const sell = el('button', 'btn', 'Sell · ' + C.duplicates.coins[r] + '⬤');
        const conv = el('button', 'btn star', 'Convert · ' + C.duplicates.stars[r] + '★');
        sell.onclick = () => { const res = M().resolveDuplicate(s, d.key, 'sell'); toast('Sold for ' + res.coins + ' coins'); renderCollection(); };
        conv.onclick = () => { const res = M().resolveDuplicate(s, d.key, 'convert'); toast('+' + res.stars + ' Star Points'); renderCollection(); };
        acts.appendChild(sell); acts.appendChild(conv); row.appendChild(acts); dupesBox.appendChild(row);
      });
    }
    const list = NS.CARDS.filter((c) => !c.token)
      .filter((c) => colFilter.type === 'all' || c.type === colFilter.type)
      .filter((c) => colFilter.rarity === 'all' || String(c.rarity) === colFilter.rarity)
      .filter((c) => colFilter.theme === 'all' || c.theme === colFilter.theme)
      .filter((c) => !colFilter.owned || s.collection[c.id])
      .filter((c) => !colFilter.q || c.name.toLowerCase().includes(colFilter.q));
    list.forEach((c) => {
      const owned = !!s.collection[c.id];
      grid.appendChild(cardEl(c.id, {
        cls: owned ? '' : 'unowned',
        showCount: true, showLevel: true,
        onClick: () => cardDetail(c.id),
      }));
    });
    if (!list.length) grid.innerHTML = '<div class="empty">No cards match these filters.</div>';
  }

  function cardDetail(cardId) {
    const s = M().get();
    const card = NS.CARD[cardId];
    const own = s.collection[cardId];
    const c = el('div', 'card-detail');
    const stats = NS.statsFor(cardId, own ? own.level : 1, own ? own.choices : {});
    let upHtml = '';
    if (own) {
      const cu = M().canUpgrade(s, cardId);
      const pips = Array.from({ length: C.upgrades.maxLevel }, (_, i) => '<span class="pip ' + (i < own.level ? 'on' : '') + '"></span>').join('');
      upHtml = '<div class="up-panel"><div class="lvl-row">Level ' + own.level + ' / ' + C.upgrades.maxLevel + ' ' + pips + '</div>';
      const g = card.growth || {}, gc = card.growthChoice;
      upHtml += '<div class="grow-line">Auto growth/level: ' + (['hp', 'atk', 'def'].filter((k) => g[k]).map((k) => '+' + g[k] + ' ' + k.toUpperCase()).join(', ') || '—') + '</div>';
      if (own.level > 1) {
        upHtml += '<div class="grow-line">Current: HP ' + stats.hp + ' · ATK ' + stats.atk + ' · DEF ' + stats.def + '</div>';
      }
      if (gc) {
        upHtml += '<div class="grow-line">Next level — choose one: ' + Object.keys(gc).map((k) => k.toUpperCase() + ' +' + gc[k]).join(' / ') + '</div>';
        upHtml += '<div class="btnrow2" id="up-btn-slot"></div>';
      } else if (card.growth && Object.keys(card.growth).length) {
        const b = el('button', 'btn primary', cu.ok ? 'Upgrade (' + cu.cost + ' ◈ credits)' : cu.error);
        b.disabled = !cu.ok;
        b.onclick = () => {
          const r = M().upgradeCard(s, cardId, null);
          if (r.ok) { sfx('fanfare'); toast(card.name + ' upgraded to level ' + r.level); M().checkAchievements(s); m.close(); cardDetail(cardId); }
          else toast(r.error, 'bad');
        };
        upHtml += '<div class="btnrow2" id="up-btn-slot"></div>';
      } else {
        upHtml += '<div class="grow-line">This card does not gain stats from upgrades.</div>';
      }
      upHtml += '</div>';
    } else {
      upHtml = '<div class="up-panel"><div class="grow-line">Not collected yet — open packs to find this card.</div></div>';
    }
    c.innerHTML = '<h3>' + esc(card.name) + ' <span class="rr" style="color:' + C.rarityColors[card.rarity] + '">' + C.rarities[card.rarity] + ' ' + card.type + '</span></h3>' +
      '<div class="detail-grid"><div class="big-art">' + art(cardId, {}) + '</div>' +
      '<div class="detail-info"><div class="statrow">' + statLine(card) + '<span class="st">Cost ' + card.cost + '</span></div>' +
      '<p class="desc">' + esc(card.desc) + '</p>' +
      (card.flavor ? '<p class="flavor">' + esc(card.flavor) + '</p>' : '') +
      (card.abilities ? card.abilities.map((a) => '<p class="abil"><b>' + esc(a.name) + '</b> (' + a.cost + '⚡' + (a.cd ? ', cd ' + a.cd : '') + '): ' + esc(a.desc) + '</p>').join('') : '') +
      '</div></div>' + upHtml;
    const m = modal(c, 'wide');
    const slot = $('#up-btn-slot', c);
    if (slot && own) {
      const cu = M().canUpgrade(s, cardId);
      if (card.growthChoice) {
        Object.keys(card.growthChoice).forEach((k) => {
          const b = el('button', 'btn small', k.toUpperCase() + ' +' + card.growthChoice[k] + (cu.ok ? ' · ' + cu.cost + '◈' : ''));
          b.disabled = !cu.ok;
          b.onclick = () => {
            const r = M().upgradeCard(s, cardId, k);
            if (r.ok) { sfx('fanfare'); toast(card.name + ' → level ' + r.level); M().checkAchievements(s); m.close(); cardDetail(cardId); }
            else toast(r.error, 'bad');
          };
          slot.appendChild(b);
        });
      } else {
        const b = el('button', 'btn primary', cu.ok ? 'Upgrade · ' + cu.cost + '◈' : cu.error);
        b.disabled = !cu.ok;
        b.onclick = () => {
          const r = M().upgradeCard(s, cardId, null);
          if (r.ok) { sfx('fanfare'); toast(card.name + ' → level ' + r.level); M().checkAchievements(s); m.close(); cardDetail(cardId); }
          else toast(r.error, 'bad');
        };
        slot.appendChild(b);
      }
    }
  }

  /* ---------------- deck builder ---------------- */
  const deckState = { idx: 0, cards: null, name: '' };
  function renderDecks() {
    const s = M().get();
    $('#cur-slot').innerHTML = currencies();
    if (deckState.cards == null) {
      deckState.idx = s.activeDeck;
      deckState.cards = s.decks[s.activeDeck].cards.map((c) => ({ ...c }));
      deckState.name = s.decks[s.activeDeck].name;
    }
    $('#deck-slots').innerHTML = s.decks.map((d, i) =>
      '<button class="slot-btn ' + (i === deckState.idx ? 'on' : '') + ' ' + (i === s.activeDeck ? 'active-deck' : '') + '" data-i="' + i + '">' +
      esc(d.name) + (i === s.activeDeck ? ' ★' : '') + '</button>').join('');
    $$('#deck-slots .slot-btn').forEach((b) => b.onclick = () => {
      if (deckState.dirty && !confirm('Abandon unsaved changes?')) return;
      deckState.idx = +b.dataset.i; deckState.cards = s.decks[deckState.idx].cards.map((c) => ({ ...c }));
      deckState.name = s.decks[deckState.idx].name; deckState.dirty = false; renderDecks();
    });
    $('#deck-name').value = deckState.name;
    const v = M().validateDeck(deckState.cards);
    const cmdrs = deckState.cards.filter((c) => NS.CARD[c.cardId].type === 'commander').length;
    const valid = v.ok && s.decks.every(() => true);
    $('#deck-status').innerHTML = '<span class="' + (v.ok ? 'ok' : 'bad') + '">' + deckState.cards.length + '/35 cards · ' + cmdrs + '/2 commanders</span>' +
      (v.errors.length ? ' <span class="bad">' + esc(v.errors[0]) + '</span>' : ' <span class="ok">✓ valid</span>');
    $('#deck-save').disabled = !v.ok;
    $('#deck-activate').disabled = !v.ok || deckState.idx === s.activeDeck;
    $('#deck-autofill').style.display = '';
    // pool
    const pool = $('#deck-pool');
    pool.innerHTML = '';
    NS.CARDS.filter((c) => !c.token && s.collection[c.id]).forEach((c) => {
      const inDeck = deckState.cards.filter((x) => x.cardId === c.id).length;
      const owned = s.collection[c.id].n;
      const d = cardEl(c.id, { cls: 'mini ' + (inDeck >= Math.min(owned, C.deck.maxCopies[c.rarity]) ? 'maxed' : ''), showLevel: true });
      const badge = el('span', 'pool-count', inDeck + '/' + owned);
      d.appendChild(badge);
      d.onclick = () => {
        if (inDeck >= Math.min(owned, C.deck.maxCopies[c.rarity])) { toast('No more copies available', 'bad'); return; }
        deckState.cards.push({ cardId: c.id, level: s.collection[c.id].level, choices: {} });
        deckState.dirty = true; sfx('click'); renderDecks();
      };
      pool.appendChild(d);
    });
    // deck list
    const dl = $('#deck-list');
    dl.innerHTML = '';
    deckState.cards.slice().sort((a, b) => (NS.CARD[a.cardId].type === 'commander' ? -1 : 0) - (NS.CARD[b.cardId].type === 'commander' ? -1 : 0) || NS.CARD[a.cardId].cost - NS.CARD[b.cardId].cost || NS.CARD[a.cardId].name.localeCompare(NS.CARD[b.cardId].name))
      .forEach((c, i) => {
        const card = NS.CARD[c.cardId];
        const row = el('div', 'deck-row ' + rarityClass(card));
        row.innerHTML = '<span class="dcost">' + card.cost + '</span><span class="dname">' + esc(card.name) + '</span><span class="dtype">' + card.type + '</span>';
        row.onclick = () => { deckState.cards.splice(deckState.cards.findIndex((x) => x === c), 1); deckState.dirty = true; renderDecks(); };
        dl.appendChild(row);
      });
  }

  /* ---------------- packs / shop ---------------- */
  function renderPacks() {
    const s = M().get();
    $('#cur-slot').innerHTML = currencies();
    const grid = $('#pack-grid');
    grid.innerHTML = '';
    Object.keys(C.packs).forEach((id) => {
      const p = C.packs[id];
      const locked = p.unlockLevel > s.profile.level;
      const d = el('div', 'pack-tile r' + (p.floor || 0) + (locked ? ' locked' : ''));
      d.innerHTML = '<div class="pack-art">' + art('spark', { color: C.rarityColors[p.floor || 0] }) + '</div>' +
        '<h3>' + esc(p.name) + '</h3><div class="pack-meta">' + p.count + ' cards · ' + p.price + '⬤</div>' +
        '<div class="odds">Odds: ' + p.odds.map((o, i) => o ? '<span style="color:' + C.rarityColors[i] + '">' + C.rarities[i].slice(0, 1) + ' ' + o + '%</span>' : '').filter(Boolean).join(' · ') + '</div>' +
        (locked ? '<div class="lock">Unlocks at account level ' + p.unlockLevel + '</div>' : '') +
        ((s.inventory[id] || 0) > 0 ? '<div class="free">' + s.inventory[id] + ' free pack(s) in inventory!</div>' : '');
      const b = el('button', 'btn primary', locked ? 'Locked' : 'Open for ' + p.price + '⬤');
      b.disabled = locked;
      b.onclick = () => purchasePack(id);
      d.appendChild(b);
      grid.appendChild(d);
    });
    const ev = M().activeEvent();
    if (ev) {
      const d = el('div', 'pack-tile event');
      d.innerHTML = '<div class="pack-art">' + art('flame', { color: '#ff9a5c' }) + '</div><h3>' + esc(ev.pack.name) + '</h3><div class="pack-meta">' + ev.pack.count + ' cards · ' + ev.pack.price + '⬤</div>' +
        '<div class="odds">' + esc(ev.blurb) + '</div>';
      const b = el('button', 'btn primary', 'Open for ' + ev.pack.price + '⬤');
      b.onclick = () => purchasePack(ev.pack.id);
      d.appendChild(b);
      grid.appendChild(d);
    }
  }
  function purchasePack(id) {
    const s = M().get();
    const def = M().packDef(s, id);
    const free = (s.inventory[id] || 0) > 0;
    const run = () => {
      const r = M().buyPack(s, id);
      if (!r.ok) { toast(r.error, 'bad'); sfx('error'); return; }
      const obtained = M().grantCards(s, r.grants || []);
      sfx('reveal');
      packOpeningAnimation(id, obtained, () => { M().checkAchievements(s); M().persist(); renderPacks(); });
    };
    if (free) run();
    else confirmBox('Buy pack', 'Spend <b>' + def.price + ' coins</b> on ' + esc(def.name) + '?', run, 'Buy');
  }
  function packOpeningAnimation(packId, obtained, onDone) {
    const s = M().get();
    const back = el('div', 'modal-back pack-overlay');
    back.dataset.locked = '1';
    const box = el('div', 'pack-stage');
    back.appendChild(box);
    document.body.appendChild(back);
    const queue = obtained.map((o) => ({ cardId: o.cardId, dupe: o.dupe }));
    const pack = el('div', 'pack-visual ' + packId);
    pack.innerHTML = '<div class="pack-inner">CARDSTRIKE<span>tap to tear open</span></div>';
    box.appendChild(pack);
    pack.onclick = () => {
      pack.classList.add('rip');
      sfx('deploy');
      setTimeout(next, 420);
    };
    function next() {
      if (!queue.length) return done();
      const item = queue.shift();
      pack.remove();
      const reveal = el('div', 'reveal-stage');
      const c = cardEl(item.cardId, { cls: 'reveal' });
      reveal.appendChild(c);
      if (item.dupe) reveal.appendChild(el('div', 'dupe-tag', 'DUPLICATE'));
      box.appendChild(reveal);
      requestAnimationFrame(() => c.classList.add('flip'));
      const r = NS.CARD[item.cardId].rarity;
      sfx(r >= 4 ? 'fanfare' : 'reveal');
      const hint = el('div', 'reveal-hint', 'click to continue (' + queue.length + ' left)');
      box.appendChild(hint);
      box.onclick = () => { box.onclick = null; hint.remove(); reveal.remove(); next(); };
    }
    function done() {
      back.dataset.locked = '';
      const sum = el('div', 'reveal-summary');
      sum.innerHTML = '<h3>Pack results</h3><div class="sum-grid">' +
        obtained.map((o) => '<div class="sum-item ' + rarityClass(NS.CARD[o.cardId]) + (o.dupe ? ' dupe' : '') + '">' + esc(NS.CARD[o.cardId].name) + (o.dupe ? ' <i>(dupe)</i>' : '') + '</div>').join('') + '</div>' +
        (s.pendingDupes.length ? '<p class="note">' + s.pendingDupes.length + ' duplicate(s) — decide in the Collection (sell or convert).</p>' : '');
      const btn = el('button', 'btn primary', 'Done');
      btn.onclick = () => { back.remove(); if (onDone) onDone(); };
      sum.appendChild(btn);
      box.appendChild(sum);
    }
  }

  /* ---------------- profile ---------------- */
  function renderProfile() {
    const s = M().get();
    $('#cur-slot').innerHTML = currencies();
    const p = s.profile;
    $('#pf-name').value = p.name;
    $('#pf-level').textContent = p.level;
    const need = M().xpNeed(p.level);
    $('#pf-xpbar').style.width = Math.min(100, (p.xp / need) * 100) + '%';
    $('#pf-xptext').textContent = p.xp + ' / ' + need + ' XP';
    const st = p.stats;
    $('#pf-stats').innerHTML = [
      ['Battles', st.battles], ['Wins', st.wins], ['Losses', st.losses], ['Win rate', st.battles ? Math.round(st.wins / st.battles * 100) + '%' : '—'],
      ['Packs opened', st.packs], ['Upgrades', st.upgrades], ['Trades', st.trades], ['Tournaments won', st.tournaments],
      ['Unique cards', Object.keys(s.collection).length], ['Expert wins', st.expertWins],
    ].map((r) => '<div class="stat"><b>' + r[1] + '</b><span>' + r[0] + '</span></div>').join('');
    // weekly
    M().ensureWeek(s);
    const wk = $('#pf-weekly');
    wk.innerHTML = '<h4>Weekly Rewards <span class="muted">· week ' + esc(s.weekly.week) + ' · ' + s.weekly.battles + ' battles</span></h4>';
    C.weekly.milestones.forEach((m2, i) => {
      const claimed = s.weekly.claimed[i];
      const ready = s.weekly.battles >= m2.at && !claimed;
      const row = el('div', 'week-row ' + (claimed ? 'claimed' : ready ? 'ready' : ''));
      row.innerHTML = '<span class="wgoal">' + m2.at + ' battles</span><span class="wrew">' +
        Object.keys(m2.reward).map((k) => (k === 'pack' ? '1× ' + C.packs[m2.reward[k]].name : k === 'cosmetic' ? m2.reward.cosmetic.label : '+' + m2.reward[k] + ' ' + k)).join(', ') + '</span>';
      const b = el('button', 'btn small', claimed ? 'Claimed ✓' : ready ? 'Claim!' : 'Locked');
      b.disabled = !ready;
      b.onclick = () => { const r = M().claimWeekly(s, i); if (r) { sfx('fanfare'); toast('Weekly reward claimed!'); renderProfile(); } };
      row.appendChild(b);
      wk.appendChild(row);
    });
    // achievements
    const ach = $('#pf-achievements');
    ach.innerHTML = '';
    C.achievements.forEach((a) => {
      const got = s.achievements[a.id];
      const stats = M().statMap(s);
      const row = el('div', 'ach-row ' + (got ? 'got' : ''));
      row.innerHTML = '<div><b>' + esc(a.name) + '</b> <span class="muted">' + esc(a.desc) + '</span><br><span class="muted">Reward: ' + esc(a.reward.label) + ' · ' + Math.min(stats[a.stat] || 0, a.goal) + '/' + a.goal + '</span></div><span class="ach-check">' + (got ? '★' : '') + '</span>';
      ach.appendChild(row);
    });
    // cosmetics shop
    const shop = $('#pf-shop');
    shop.innerHTML = '<h4>Cosmetics (Star Points ★)</h4>';
    ['cardbacks', 'frames', 'avatars'].forEach((kind) => {
      C.cosmetics[kind].forEach((item) => {
        const owned = s.profile[kind].includes(item.id);
        const equipped = p.equipped[kind.replace(/s$/, '')] === item.id;
        const row = el('div', 'cos-row');
        row.innerHTML = '<span>' + esc(item.name) + ' <i class="muted">(' + kind.slice(0, -1) + ')</i></span>';
        const b = el('button', 'btn small', owned ? (equipped ? 'Equipped ✓' : 'Equip') : item.price + '★');
        if (owned) {
          b.disabled = equipped;
          b.onclick = () => { p.equipped[kind.replace(/s$/, '')] = item.id; M().persist(); renderProfile(); };
        } else {
          b.onclick = () => { const r = M().buyCosmetic(s, kind, item.id); if (r.ok) { sfx('reveal'); toast('Purchased ' + item.name); renderProfile(); } else toast(r.error, 'bad'); };
        }
        row.appendChild(b);
        shop.appendChild(row);
      });
    });
    // titles equip
    if (p.titles.length) {
      const tr = el('div', 'cos-row');
      const sel = el('select');
      sel.innerHTML = '<option value="">— no title —</option>' + p.titles.map((t) => '<option ' + (p.equipped.title === t ? 'selected' : '') + '>' + esc(t) + '</option>').join('');
      sel.onchange = () => { p.equipped.title = sel.value || null; M().persist(); };
      tr.appendChild(el('span', '', 'Equipped title: '));
      tr.appendChild(sel);
      shop.appendChild(tr);
    }
    // settings
    $('#set-sfx').checked = !!s.settings.sfx;
    $('#set-anim').checked = !!s.settings.anim;
  }

  /* ---------------- trade post ---------------- */
  function renderTrade() {
    const s = M().get();
    $('#cur-slot').innerHTML = currencies();
    M().ensureTrade(s);
    $('#trade-used').textContent = 'Trades today: ' + s.trade.used + ' / ' + C.trade.perDay;
    const offers = M().tradeOffers(s);
    const list = $('#trade-offers');
    list.innerHTML = '';
    if (!offers.length) { list.innerHTML = '<div class="empty">No offers left today. Come back tomorrow.</div>'; return; }
    offers.forEach((o, i) => {
      const row = el('div', 'trade-row');
      row.innerHTML = '<div class="broker"><b>' + esc(o.broker) + '</b> proposes:</div>';
      const ex = el('div', 'trade-ex');
      const give = cardEl(o.want, { cls: 'mini', showLevel: true });
      const arrow = el('div', 'trade-arrow', '⇄');
      const get = cardEl(o.give, { cls: 'mini' });
      ex.appendChild(give); ex.appendChild(arrow); ex.appendChild(get);
      row.appendChild(ex);
      const b = el('button', 'btn primary', 'Accept trade');
      b.onclick = () => confirmBox('Confirm trade',
        'Give <b>' + esc(NS.CARD[o.want].name) + '</b> → receive <b>' + esc(NS.CARD[o.give].name) + '</b>?<br><i class="muted">This removes your copy. Both cards are unique — no duplication is possible.</i>',
        () => { const r = M().doTrade(s, i); if (r.ok) { sfx('fanfare'); toast('Trade complete! Received ' + NS.CARD[r.got].name); M().checkAchievements(s); renderTrade(); } else { toast(r.error, 'bad'); sfx('error'); } }, 'Trade');
      row.appendChild(b);
      list.appendChild(row);
    });
  }

  /* ---------------- events ---------------- */
  function renderEvents() {
    const s = M().get();
    $('#cur-slot').innerHTML = currencies();
    const list = $('#event-list');
    list.innerHTML = '';
    M().EVENTS.forEach((e) => {
      const d = el('div', 'event-tile ' + (e.active ? 'active-ev' : 'sched'));
      d.innerHTML = '<h3>' + esc(e.name) + (e.active ? ' <span class="live">LIVE</span>' : ' <span class="schedtag">SCHEDULED ' + esc(e.start) + '</span>') + '</h3>' +
        '<p>' + esc(e.desc) + '</p><p class="blurb">' + esc(e.blurb) + '</p>' +
        '<div class="muted">' + esc(e.start) + ' → ' + esc(e.end) + (e.coinMult > 1 ? ' · +' + Math.round((e.coinMult - 1) * 100) + '% coins' : '') + '</div>';
      if (e.active) {
        const row = el('div', 'btnrow');
        const b1 = el('button', 'btn primary', 'Play event battle');
        b1.onclick = () => NS.Battle.open({ mode: 'bot', difficulty: 2, event: e.id });
        const b2 = el('button', 'btn', 'Buy ' + esc(e.pack.name) + ' (' + e.pack.price + '⬤)');
        b2.onclick = () => purchasePack(e.pack.id);
        row.appendChild(b1); row.appendChild(b2);
        d.appendChild(row);
      }
      list.appendChild(d);
    });
  }

  /* ---------------- tournament ---------------- */
  function renderTournament() {
    const s = M().get();
    $('#cur-slot').innerHTML = currencies();
    const t = s.tournament;
    const box = $('#tourn-body');
    box.innerHTML = '';
    if (!t || t.done) {
      const d = el('div', 'tourn-idle');
      d.innerHTML = '<h3>Grand Tournament</h3><p>Four fighters. Single elimination. You must beat a <b>Normal</b> bot in the semifinal, then a <b>Hard</b> bot in the final to be crowned Champion and earn the Crowned avatar.</p>' +
        (t && t.champion ? '<div class="champ">👑 Last champion: ' + esc(t.champion) + '</div>' : (t ? '<div class="muted">You were eliminated. Regroup and try again.</div>' : ''));
      const b = el('button', 'btn primary', 'Enter tournament (uses your active deck)');
      b.onclick = () => { M().newTournament(s); M().persist(); renderTournament(); };
      d.appendChild(b);
      box.appendChild(d);
      return;
    }
    const opp = M().tournamentOpponent(t);
    const d = el('div', 'tourn-live');
    d.innerHTML = '<h3>Tournament — ' + (t.stage === 0 ? 'Semifinal' : 'FINAL') + '</h3>' +
      '<p>Your opponent: <b>' + esc(opp.name) + '</b> (' + ['Easy', 'Normal', 'Hard', 'Expert'][opp.difficulty] + ' bot)</p>' +
      '<div class="bracket"><div class="brk-slot you">You</div><div class="brk-vs">vs</div><div class="brk-slot">' + esc(t.roster[0]) + '</div>' +
      '<div class="brk-note">' + (t.stage === 0 ? 'other semifinal: ' + esc(t.roster[1]) + ' vs ' + esc(t.roster[2]) : (t.otherWinner ? esc(t.roster[1]) + ' vs ' + esc(t.roster[2]) + ' → won by ' + esc(t.otherWinner) : '')) + '</div></div>';
    const b = el('button', 'btn primary', t.stage === 0 ? 'Play semifinal' : 'Play the FINAL');
    b.onclick = () => NS.Battle.open({ mode: 'bot', difficulty: opp.difficulty, tournament: true, opponentName: opp.name });
    d.appendChild(b);
    box.appendChild(d);
  }

  NS.UI = {
    show, toast, modal, confirmBox, cardEl, art, currencies, sfx, esc, el, $, $$,
    renderMenu, renderCollection, renderDecks, renderPacks, renderProfile, renderTrade, renderEvents, renderTournament,
    packOpeningAnimation, cardDetail, purchasePack,
    setScreenHandlers: (h) => { screenHandlers = h; },
    deckState, colFilter,
  };
})(typeof window !== 'undefined' ? (window.CS = window.CS || {}) : (globalThis.CS = globalThis.CS || {}));
