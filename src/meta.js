/* ============================================================
   CARDSTRIKE — meta systems: profile, collection, packs, dupes,
   upgrades, decks, achievements, weekly rewards, XP levels,
   trading (simulated), events (admin-configured), tournaments.
   Persistence is a pluggable store: localStorage in browser.
   ============================================================ */
(function (NS) {
  'use strict';
  const C = NS.CFG;

  /* ---------------- events (admin-managed configuration) ---------------- */
  const EVENTS = [
    {
      id: 'emberfall', name: 'Emberfall Festival', active: true,
      start: '2026-11-01', end: '2026-12-31',
      desc: 'The ley lines run hot. All battles pay +50% coins, and the Emberfall Pack burns brighter odds.',
      coinMult: 1.5, ruleMod: { incomeBonus: 1 },
      pack: { id: 'emberfall', name: 'Emberfall Pack', price: 300, count: 5, odds: [35, 28, 20, 10, 5, 2], floor: 1 },
      blurb: 'Event rule: +1 energy income every turn for both commanders.',
    },
    {
      id: 'frostwrath', name: 'Frostwrath Vigil', active: false,
      start: '2027-01-05', end: '2027-01-26',
      desc: 'Scheduled event — the arena freezes over. Double credits for every battle won.',
      coinMult: 1.0, creditMult: 2, ruleMod: {},
      pack: { id: 'frostwrath', name: 'Frostwrath Pack', price: 350, count: 5, odds: [30, 28, 22, 11, 6, 3], floor: 1 },
      blurb: 'Administrators can activate this event by setting active: true.',
    },
  ];
  function activeEvent() { return EVENTS.find((e) => e.active) || null; }

  /* ---------------- persistence ---------------- */
  let store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  function setStore(s) { store = s; }

  function weekKey(d) {
    const dt = d || new Date();
    const jan1 = new Date(dt.getFullYear(), 0, 1);
    const wk = Math.floor((dt - jan1) / 604800000);
    return dt.getFullYear() + '-W' + wk;
  }
  function todayKey() { return new Date().toISOString().slice(0, 10); }

  function newSave(name) {
    const s = {
      version: C.VERSION, createdAt: Date.now(),
      profile: {
        name: name || 'Striker', level: 1, xp: 0,
        coins: C.starter.coins, credits: C.starter.credits, stars: C.starter.stars,
        equipped: { title: null, cardback: 'default', frame: 'default', avatar: 'default' },
        cardbacks: ['default'], frames: ['default'], avatars: ['default'], badges: [], titles: [],
        stats: { battles: 0, wins: 0, losses: 0, packs: 0, converted: 0, sold: 0, upgrades: 0, trades: 0, tournaments: 0, eventWins: 0, expertWins: 0, mythics: 0 },
      },
      collection: {}, decks: [], activeDeck: 0,
      pendingDupes: [], inventory: {},
      weekly: { week: weekKey(), battles: 0, claimed: C.weekly.milestones.map(() => false) },
      achievements: {}, settings: { sfx: true, anim: true },
      trade: { day: todayKey(), used: 0 },
      tournament: null, seed: 1 + Math.floor(Math.random() * 1e9),
    };
    C.starter.cards.forEach((c) => addToCollection(s, c.id, c.count));
    s.decks.push({ id: 0, name: 'First Strike', cards: autoDeck(s) });
    return s;
  }
  function autoDeck(s) {
    // build a valid 35-card deck from what the player owns
    const cards = [];
    const cmdrs = Object.keys(s.collection).filter((id) => NS.CARD[id] && NS.CARD[id].type === 'commander').slice(0, C.deck.maxCommanders);
    cmdrs.forEach((id) => cards.push({ cardId: id, level: s.collection[id].level, choices: {} }));
    const others = Object.keys(s.collection)
      .filter((id) => NS.CARD[id] && NS.CARD[id].type !== 'commander' && !NS.CARD[id].token)
      .sort((a, b) => (NS.CARD[a].rarity - NS.CARD[b].rarity) || a.localeCompare(b));
    let guard = 0;
    while (cards.length < C.deck.size && guard++ < 500) {
      let added = false;
      for (const id of others) {
        if (cards.length >= C.deck.size) break;
        const used = cards.filter((c) => c.cardId === id).length;
        if (used < Math.min(s.collection[id].n, C.deck.maxCopies[NS.CARD[id].rarity])) { cards.push({ cardId: id, level: s.collection[id].level, choices: {} }); added = true; }
      }
      if (!added) break;
    }
    return cards;
  }

  let SAVE = null;
  function load() {
    const raw = store.get(C.SAVE_KEY);
    if (raw) { try { SAVE = JSON.parse(raw); } catch (e) { SAVE = null; } }
    if (!SAVE || SAVE.version !== C.VERSION) { SAVE = newSave(); persist(); }
    ensureWeek(SAVE); ensureTrade(SAVE);
    return SAVE;
  }
  function persist() { if (SAVE) store.set(C.SAVE_KEY, JSON.stringify(SAVE)); }
  function get() { return SAVE || load(); }
  function replace(s2) { SAVE = s2; persist(); }

  /* ---------------- collection & dupes ---------------- */
  function addToCollection(s, cardId, n) {
    if (!NS.CARD[cardId] || NS.CARD[cardId].token) return { added: 0, dupes: 0 };
    if (!s.collection[cardId]) {
      s.collection[cardId] = { n: 0, level: 1, choices: {} };
    }
    const entry = s.collection[cardId];
    const card = NS.CARD[cardId];
    // ownership caps: commons may be owned in multiples (deck max 3); unique cards own 1
    const maxOwn = card.rarity === 0 ? C.deck.maxCopies[0] : 1;
    const addable = Math.max(0, maxOwn - entry.n);
    const dupes = Math.max(0, n - addable);
    entry.n += Math.min(n, addable);
    if (NS.CARD[cardId].rarity === 5 && entry.n > 0 && !s._mythicCounted) {
      s.profile.stats.mythics++; s._mythicCounted = true;
    }
    return { added: Math.min(n, addable), dupes };
  }
  // Called after pack opening / rewards: converts dupes into pending player decisions
  function grantCards(s, grants) {
    const res = [];
    grants.forEach((g) => {
      const r = addToCollection(s, g.cardId, g.count || 1);
      for (let i = 0; i < r.dupes; i++) {
        s.pendingDupes.push({ key: 'd' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), cardId: g.cardId });
      }
      if (r.added) res.push({ cardId: g.cardId, dupe: false });
      for (let i = 0; i < r.dupes; i++) res.push({ cardId: g.cardId, dupe: true });
    });
    return res;
  }
  function resolveDuplicate(s, key, choice) {
    const i = s.pendingDupes.findIndex((d) => d.key === key);
    if (i < 0) return null;
    const d = s.pendingDupes.splice(i, 1)[0];
    const r = NS.CARD[d.cardId].rarity;
    if (choice === 'sell') { s.profile.coins += C.duplicates.coins[r]; s.profile.stats.sold++; return { coins: C.duplicates.coins[r] }; }
    s.profile.stars += C.duplicates.stars[r]; s.profile.stats.converted++;
    return { stars: C.duplicates.stars[r] };
  }

  /* ---------------- packs ---------------- */
  function rollRarity(rng, odds, floor) {
    const total = odds.reduce((a, b) => a + b, 0);
    let roll = rng() * total;
    for (let i = 0; i < odds.length; i++) { roll -= odds[i]; if (roll <= 0) return Math.max(i, floor || 0); }
    return Math.max(odds.length - 1, floor || 0);
  }
  function packPool(rarity) {
    return NS.CARDS.filter((c) => !c.token && c.rarity === rarity && c.type !== 'commander')
      .concat(NS.CARDS.filter((c) => c.type === 'commander' && c.rarity === rarity));
  }
  function openPack(s, packId, rng) {
    const def = packDef(s, packId);
    if (!def) return null;
    rng = rng || Math.random;
    const grants = [];
    for (let i = 0; i < def.count; i++) {
      const r = rollRarity(rng, def.odds, def.floor);
      const pool = packPool(r);
      if (!pool.length) continue;
      grants.push({ cardId: pool[Math.floor(rng() * pool.length)].id, count: 1 });
    }
    return grants;
  }
  function packDef(s, packId) {
    if (C.packs[packId]) {
      const p = C.packs[packId];
      if (p.unlockLevel > s.profile.level) return null;
      return { ...p, id: packId };
    }
    const ev = EVENTS.find((e) => e.pack && e.pack.id === packId);
    return ev ? { ...ev.pack } : null;
  }
  function buyPack(s, packId) {
    const def = packDef(s, packId);
    if (!def) return { ok: false, error: 'Pack locked (account level too low).' };
    if ((s.inventory[packId] || 0) > 0) { s.inventory[packId]--; s.profile.stats.packs++; return { ok: true, free: true, grants: openPack(s, packId) }; }
    if (s.profile.coins < def.price) return { ok: false, error: 'Not enough coins.' };
    s.profile.coins -= def.price;
    s.profile.stats.packs++;
    return { ok: true, grants: openPack(s, packId) };
  }

  /* ---------------- upgrades ---------------- */
  function upgradeCost(cardId, level) {
    const c = NS.CARD[cardId];
    const base = C.upgrades.costBase[c.rarity];
    return Math.round(base * Math.pow(C.upgrades.costGrowth, level - 1));
  }
  function canUpgrade(s, cardId) {
    const e = s.collection[cardId];
    if (!e) return { ok: false, error: 'Card not owned.' };
    if (e.level >= C.upgrades.maxLevel) return { ok: false, error: 'Already at max level.' };
    const cost = upgradeCost(cardId, e.level);
    if (s.profile.credits < cost) return { ok: false, error: 'Not enough Credits (' + cost + ' needed).' };
    return { ok: true, cost };
  }
  function upgradeCard(s, cardId, choice) {
    const c = canUpgrade(s, cardId);
    if (!c.ok) return c;
    const card = NS.CARD[cardId];
    const e = s.collection[cardId];
    if (card.growthChoice && choice) e.choices[choice] = (e.choices[choice] || 0) + (card.growthChoice[choice] || 0);
    e.level++;
    s.profile.credits -= c.cost;
    s.profile.stats.upgrades++;
    return { ok: true, level: e.level };
  }

  /* ---------------- decks ---------------- */
  function validateDeck(cards) {
    const errors = [];
    if (cards.length !== C.deck.size) errors.push('Deck must contain exactly ' + C.deck.size + ' cards (currently ' + cards.length + ').');
    const cmdrs = cards.filter((c) => NS.CARD[c.cardId] && NS.CARD[c.cardId].type === 'commander').length;
    if (cmdrs > C.deck.maxCommanders) errors.push('Maximum ' + C.deck.maxCommanders + ' commanders.');
    if (cmdrs < 1) errors.push('Deck needs at least one commander.');
    const counts = {};
    cards.forEach((c) => {
      counts[c.cardId] = (counts[c.cardId] || 0) + 1;
      if (!NS.CARD[c.cardId]) errors.push('Unknown card ' + c.cardId);
    });
    Object.keys(counts).forEach((id) => {
      const card = NS.CARD[id]; if (!card || card.token) return;
      if (counts[id] > C.deck.maxCopies[card.rarity]) errors.push(card.name + ': max ' + C.deck.maxCopies[card.rarity] + ' copy(ies) per deck.');
    });
    return { ok: !errors.length, errors };
  }
  function saveDeck(s, idx, name, cards) {
    const v = validateDeck(cards);
    if (!v.ok) return v;
    s.decks[idx] = { id: idx, name: name || s.decks[idx]?.name || 'Deck ' + (idx + 1), cards };
    return v;
  }

  /* ---------------- rewards / xp / levels ---------------- */
  function xpNeed(level) { return C.xp.base + C.xp.growth * (level - 1); }
  function gainRewards(s, r) {
    const ups = [];
    if (r.coins) s.profile.coins += Math.round(r.coins);
    if (r.credits) s.profile.credits += Math.round(r.credits);
    if (r.stars) s.profile.stars += Math.round(r.stars);
    if (r.pack) s.inventory[r.pack] = (s.inventory[r.pack] || 0) + 1;
    if (r.xp) {
      s.profile.xp += Math.round(r.xp);
      while (s.profile.xp >= xpNeed(s.profile.level)) {
        s.profile.xp -= xpNeed(s.profile.level);
        s.profile.level++;
        const unlock = C.levelUnlocks[s.profile.level];
        if (unlock) {
          if (unlock.cardback && !s.profile.cardbacks.includes(unlock.cardback)) s.profile.cardbacks.push(unlock.cardback);
          if (unlock.frame && !s.profile.frames.includes(unlock.frame)) s.profile.frames.push(unlock.frame);
          if (unlock.avatar && !s.profile.avatars.includes(unlock.avatar)) s.profile.avatars.push(unlock.avatar);
          if (unlock.title && !s.profile.titles.includes(unlock.title)) s.profile.titles.push(unlock.title);
        }
        ups.push({ level: s.profile.level, unlock: unlock ? unlock.label : null });
      }
    }
    return ups;
  }
  function battleRewards(difficulty, won, s) {
    const ev2 = activeEvent();
    let coins, credits, xp;
    if (won) {
      coins = C.rewards.winCoins[difficulty] || 150;
      credits = C.rewards.winCredits[difficulty] || 40;
      xp = C.rewards.winXp[difficulty] || 60;
      if (ev2 && ev2.coinMult) coins = Math.round(coins * ev2.coinMult);
      if (ev2 && ev2.creditMult) credits = Math.round(credits * ev2.creditMult);
      s.profile.stats.wins++;
      if (difficulty === 3) s.profile.stats.expertWins++;
      if (ev2) s.profile.stats.eventWins++;
    } else {
      coins = C.rewards.lossCoins; credits = C.rewards.lossCredits; xp = C.rewards.lossXp;
      s.profile.stats.losses++;
    }
    s.profile.stats.battles++;
    ensureWeek(s); s.weekly.battles++;
    return { coins, credits, xp, event: ev2 && won ? ev2.coinMult : 1 };
  }

  /* ---------------- weekly track ---------------- */
  function ensureWeek(s) {
    if (!s.weekly || s.weekly.week !== weekKey()) {
      s.weekly = { week: weekKey(), battles: 0, claimed: C.weekly.milestones.map(() => false) };
    }
  }
  function claimWeekly(s, i) {
    ensureWeek(s);
    const m = C.weekly.milestones[i];
    if (!m || s.weekly.claimed[i] || s.weekly.battles < m.at) return null;
    s.weekly.claimed[i] = true;
    const ups = gainRewards(s, m.reward);
    return { reward: m.reward, ups };
  }

  /* ---------------- achievements ---------------- */
  function statMap(s) {
    return {
      wins: s.profile.stats.wins,
      uniques: Object.keys(s.collection).filter((id) => NS.CARD[id] && !NS.CARD[id].token).length,
      mythics: s.profile.stats.mythics,
      upgrades: s.profile.stats.upgrades,
      trades: s.profile.stats.trades,
      tournaments: s.profile.stats.tournaments,
      eventWins: s.profile.stats.eventWins,
      expertWins: s.profile.stats.expertWins,
      packs: s.profile.stats.packs,
    };
  }
  function checkAchievements(s) {
    const stats = statMap(s);
    const news = [];
    C.achievements.forEach((a) => {
      if (s.achievements[a.id]) return;
      if ((stats[a.stat] || 0) >= a.goal) {
        s.achievements[a.id] = true;
        const r = a.reward;
        if (r.badge && !s.profile.badges.includes(r.badge)) s.profile.badges.push(r.badge);
        if (r.title && !s.profile.titles.includes(r.title)) s.profile.titles.push(r.title);
        if (r.cardback && !s.profile.cardbacks.includes(r.cardback)) s.profile.cardbacks.push(r.cardback);
        if (r.frame && !s.profile.frames.includes(r.frame)) s.profile.frames.push(r.frame);
        if (r.avatar && !s.profile.avatars.includes(r.avatar)) s.profile.avatars.push(r.avatar);
        news.push(a);
      }
    });
    return news;
  }

  /* ---------------- cosmetics shop (Star Points) ---------------- */
  function buyCosmetic(s, kind, id) {
    const list = C.cosmetics[kind] || [];
    const item = list.find((x) => x.id === id);
    if (!item) return { ok: false, error: 'Unknown cosmetic.' };
    const bucket = kind === 'titles' ? s.profile.titles : s.profile[kind];
    if (bucket.includes(id)) return { ok: false, error: 'Already owned.' };
    if (s.profile.stars < item.price) return { ok: false, error: 'Not enough Star Points.' };
    s.profile.stars -= item.price;
    bucket.push(id);
    return { ok: true };
  }

  /* ---------------- trading (simulated local trade post) ---------------- */
  function ensureTrade(s) {
    if (!s.trade || s.trade.day !== todayKey()) s.trade = { day: todayKey(), used: 0, offers: null, seed: Math.random() };
  }
  function tradeOffers(s) {
    ensureTrade(s);
    if (s.trade.offers) return s.trade.offers;
    const owned = Object.keys(s.collection).filter((id) => !NS.CARD[id].token);
    const offers = [];
    const names = ['Rook the Broker', 'Madame Vexis', 'The Cartel Coil', 'Grimwald & Sons'];
    for (let i = 0; i < C.trade.offers; i++) {
      if (!owned.length) break;
      const want = owned[Math.floor(Math.random() * owned.length)];
      const wr = NS.CARD[want].rarity;
      const targetR = Math.max(0, Math.min(5, wr + (Math.random() < 0.35 ? 1 : 0) - (Math.random() < 0.3 ? 1 : 0)));
      let candidates2 = NS.CARDS.filter((c) => !c.token && c.rarity === targetR && !s.collection[c.id]);
      if (!candidates2.length) candidates2 = NS.CARDS.filter((c) => !c.token && !s.collection[c.id]); // fallback: broker offers anything unowned
      if (!candidates2.length) continue;
      const give = candidates2[Math.floor(Math.random() * candidates2.length)];
      offers.push({ i, want, give: give.id, broker: names[Math.floor(Math.random() * names.length)] });
    }
    s.trade.offers = offers;
    return offers;
  }
  function doTrade(s, offerIndex) {
    ensureTrade(s);
    if (s.trade.used >= C.trade.perDay) return { ok: false, error: 'Daily trade limit reached (' + C.trade.perDay + ').' };
    const offers = tradeOffers(s);
    const offer = offers[offerIndex];
    if (!offer) return { ok: false, error: 'Offer no longer available.' };
    if (!s.collection[offer.want] || s.collection[offer.want].n < 1) return { ok: false, error: 'You do not own the requested card.' };
    if (s.collection[offer.give]) return { ok: false, error: 'You already own ' + NS.CARD[offer.give].name + ' — unique cards cannot be duplicated via trade.' };
    // execute: give away the copy, receive the offer
    s.collection[offer.want].n--;
    if (s.collection[offer.want].n <= 0) delete s.collection[offer.want];
    addToCollection(s, offer.give, 1);
    // remove card from decks that used it
    s.decks.forEach((d) => { d.cards = d.cards.filter((c) => c.cardId !== offer.want); });
    offers.splice(offerIndex, 1);
    s.trade.used++;
    s.profile.stats.trades++;
    return { ok: true, got: offer.give, gave: offer.want };
  }

  /* ---------------- tournaments (single elimination vs bots) ---------------- */
  function newTournament(s) {
    const roster = ['Warden Axios', 'Blight-Marshal Krogh', 'Zero-Cult Envoy'];
    s.tournament = { stage: 0, roster, won: [], otherResult: null, done: false, champion: null };
    return s.tournament;
  }
  function tournamentOpponent(t) {
    // player semifinal = roster[0]; final = winner of simulated other semifinal
    return t.stage === 0 ? { name: t.roster[0], difficulty: 1 } : { name: t.otherWinner || t.roster[1], difficulty: 3 };
  }
  function tournamentWin(s) {
    const t = s.tournament;
    t.won.push(t.stage);
    if (t.stage === 0) {
      t.stage = 1;
      t.otherWinner = Math.random() < 0.5 ? t.roster[1] : t.roster[2];
    } else {
      t.done = true; t.champion = s.profile.name;
      s.profile.stats.tournaments++;
      if (!s.profile.avatars.includes('crown')) s.profile.avatars.push('crown');
    }
    return t;
  }
  function tournamentLoss(s) {
    const t = s.tournament;
    t.done = true; t.champion = null;
    return t;
  }

  NS.Meta = {
    newSave, load, persist, get, replace, setStore, weekKey, todayKey,
    addToCollection, grantCards, resolveDuplicate,
    openPack, packDef, buyPack,
    upgradeCost, canUpgrade, upgradeCard,
    validateDeck, saveDeck, autoDeck,
    xpNeed, gainRewards, battleRewards,
    ensureWeek, claimWeekly, checkAchievements, statMap, buyCosmetic,
    ensureTrade, tradeOffers, doTrade,
    EVENTS, activeEvent, newTournament, tournamentOpponent, tournamentWin, tournamentLoss,
    _save: () => SAVE,
  };
})(typeof window !== 'undefined' ? (window.CS = window.CS || {}) : (globalThis.CS = globalThis.CS || {}));
