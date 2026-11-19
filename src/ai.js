/* ============================================================
   CARDSTRIKE — AI opponent.
   All difficulties enumerate legal actions and differ in HOW they
   choose: Easy = noisy heuristic, Normal = greedy 1-ply,
   Hard = full 1-ply evaluation + threat avoidance,
   Expert = simulated 2-ply action chains + lethal detection.
   ============================================================ */
(function (NS) {
  'use strict';
  const E = () => NS.Engine;
  const C = NS.CFG;

  /* ---------------- evaluation ---------------- */
  function unitValue(st, u) {
    const card = u.cardId ? NS.CARD[u.cardId] : null;
    const cost = card ? card.cost : 3;
    if (u.kind === 'commander') return u.fallen ? -70 : 55 + u.hp * 2.6 + u.atk * 2;
    if (u.kind === 'base') return 25 + u.hp * 2.4;
    if (u.kind === 'structure') return 6 + u.hp * 0.9;
    return 5 + u.hp * 1.15 + u.atk * 2.3 + u.def * 1.6 + u.mv * 0.7 + cost * 1.1;
  }
  function nearestFoeDist(st, u) {
    let best = 99;
    st.units.forEach((e) => {
      if (e.owner === u.owner || e.fallen || e.hp <= 0 || e.kind === 'base') return;
      const d = Math.max(Math.abs(e.x - u.x), Math.abs(e.y - u.y));
      if (d < best) best = d;
    });
    return best;
  }
  // geometric threat: damage enemy units COULD deal next turn (ignores per-turn flags).
  // statOf results are cached per call — this keeps cost near O(units²) instead of worse.
  function threatMap(st, p) {
    const dmg = {};
    const foeList = [], targetList = [];
    st.units.forEach((u) => {
      if (u.fallen || u.hp <= 0) return;
      if (u.owner === p) { if (u.kind !== 'base') targetList.push(u); else targetList.push(u); }
      else if (u.kind === 'unit' && !u.statuses.some((s) => s.status === 'frozen' || s.status === 'stunned') && statAtk(u) > 0) foeList.push(u);
    });
    function statAtk(e) { return NS.Engine.statOf(st, e, 'atk'); }
    const defOf = {};
    targetList.forEach((t) => { defOf[t.id] = NS.Engine.statOf(st, t, 'def'); });
    foeList.forEach((e) => {
      const eAtk = NS.Engine.statOf(st, e, 'atk');
      const rmax = NS.Engine.statOf(st, e, 'rangeMax');
      targetList.forEach((t) => {
        const dx = t.x - e.x, dy = t.y - e.y;
        if (!NS.Engine.inPattern(e, dx, dy, rmax)) return;
        if ((e.pattern === 'ortho' || e.pattern === 'diag' || e.pattern === 'radial') && e.los && !NS.Engine.hasLos(st, e, t)) return;
        const d = Math.max(1, eAtk - (t.kind === 'base' ? 0 : defOf[t.id]));
        dmg[t.id] = (dmg[t.id] || 0) + d;
      });
    });
    return dmg;
  }
  function evaluate(st, p, quick) {
    if (st.winner != null) return st.winner === p ? 100000 : -100000;
    let s = 0;
    st.units.forEach((u) => {
      const v = unitValue(st, u);
      s += u.owner === p ? v : -v * 1.06;
      if (u.owner === p && (u.kind === 'unit') && !u.fallen) s -= nearestFoeDist(st, u) * 0.35;
    });
    const P = st.players[p], O = st.players[1 - p];
    // deck + hand conservation: burning your whole deck trades future turns for present material
    s += P.energy * 0.3 + P.hand.length * 1.8 + P.deck.length * 1.1;
    s -= O.energy * 0.3 + O.hand.length * 1.8 + O.deck.length * 1.1;
    s -= st.fatigue[p] * 4;
    if (!quick) {
      const tm = threatMap(st, p);
      Object.keys(tm).forEach((id) => {
        const u = NS.Engine.byId(st, id); if (!u || u.hp <= 0) return;
        const w = u.kind === 'commander' ? 2.2 : u.kind === 'base' ? 1.6 : Math.min(1, u.hp / u.maxHp) * 0.9;
        s -= tm[id] * w;
      });
    }
    return s;
  }

  /* ---------------- candidate generation ---------------- */
  function dist(a, b) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)); }
  function sampleTiles(st, tiles, u, cap) {
    if (tiles.length <= cap) return tiles;
    const foes = st.units.filter((e) => e.owner !== (u ? u.owner : 0) && !e.fallen && e.kind !== 'base');
    const ref = foes.length ? foes[0] : { x: 5, y: u && u.owner === 0 ? 4 : 6 };
    return tiles.slice().sort((a, b) => dist(a, ref) - dist(b, ref)).slice(0, cap);
  }
  function candidates(st, o, p) {
    const out = [];
    const me = (id) => NS.Engine.byId(st, id);
    Object.keys(o.moves).forEach((uid) => {
      const u = me(uid);
      sampleTiles(st, o.moves[uid], u, 8).forEach((t) => out.push({ t: 'move', unit: uid, x: t.x, y: t.y }));
    });
    Object.keys(o.attacks).forEach((uid) => {
      o.attacks[uid].forEach((a) => out.push({ t: 'attack', unit: uid, target: a.target }));
    });
    Object.keys(o.abilities).forEach((uid) => {
      o.abilities[uid].forEach((ab) => {
        ab.targets.slice(0, 5).forEach((tg) => out.push({ t: 'ability', unit: uid, ai: ab.ai, targets: tg }));
      });
    });
    o.deploys.forEach((d) => {
      sampleTiles(st, d.tiles, null, 6).forEach((t) => out.push({ t: 'deploy', handIdx: d.handIdx, x: t.x, y: t.y }));
    });
    o.spells.forEach((s2) => {
      s2.targets.slice(0, 6).forEach((tg) => out.push({ t: 'deploy', handIdx: s2.handIdx, targets: tg, x: tg.x, y: tg.y }));
    });
    o.recover.forEach((uid) => out.push({ t: 'recover', unit: uid }));
    out.push({ t: 'end' });
    return out;
  }
  // simulation clone: strips the (possibly huge) battle log before deep-copying
  function simClone(st) {
    return E().clone(Object.assign({}, st, { log: [], events: [] }));
  }
  function simScore(st, act, p, base, quick) {
    const s2 = simClone(st);
    const r = E().applyAction(s2, act);
    if (!r.ok) return { score: -1e9, st: null, act };
    let sc = evaluate(s2, p, quick);
    // explicit lethality bonus (covers all three victory conditions)
    if (s2.winner === p) sc += 50000;
    // reward commander-focused damage slightly beyond raw eval
    (r.events || []).forEach((e2) => {
      if (e2.t === 'damage') {
        const u = E().byId(s2, e2.unit);
        if (u && u.owner !== p && u.kind === 'commander') sc += 2;
      }
    });
    return { score: sc - base * 0.001, st: s2, act };
  }

  /* ---------------- difficulty policies ---------------- */
  function easyPick(st, o, p) {
    const acts = candidates(st, o, p).filter((a) => a.t !== 'end');
    if (!acts.length || Math.random() < 0.18) return { t: 'end' };
    // mild preference: attacks that kill, else random
    const kills = acts.filter((a) => a.t === 'attack');
    if (kills.length && Math.random() < 0.6) return kills[Math.floor(Math.random() * kills.length)];
    return acts[Math.floor(Math.random() * acts.length)];
  }
  function pickBest(scored, noise) {
    let best = null;
    scored.forEach((s2) => {
      const sc = s2.score + (noise ? (Math.random() * 2 - 1) * noise : 0);
      if (!best || sc > best.sc) best = { sc, act: s2.act };
    });
    return best.act;
  }
  function chooseAction(st, p, diff) {
    const o = E().getOptions(st);
    if (!o) return { t: 'end' };
    if (diff === 0) return easyPick(st, o, p);
    const acts = candidates(st, o, p);
    const base = evaluate(st, p, true);
    const noise = C.ai.noise[diff] || 0;
    // two-stage: quick-eval everything, then full threat-aware eval on the shortlist
    // (stage 1 already simulated each action — stage 2 only re-evaluates, no re-sim)
    let scored = acts.map((a) => simScore(st, a, p, base, true)).filter((s2) => s2.score > -1e8);
    scored.sort((a, b) => b.score - a.score);
    const shortlist = scored.slice(0, 12);
    shortlist.forEach((s2) => {
      if (s2.st) s2.score = evaluate(s2.st, p, false) - base * 0.001 + (s2.st.winner === p ? 50000 : 0);
    });
    if (diff === 3) {
      // Expert: extend top chains one more ply, under a hard time budget
      const t0 = Date.now();
      scored.sort((a, b) => b.score - a.score);
      const top = scored.slice(0, 3).filter((s2) => s2.st && s2.st.winner == null);
      const extended = [];
      for (const s2 of top) {
        if (Date.now() - t0 > 220) { extended.push(s2); continue; }
        const o2 = E().getOptions(s2.st);
        if (!o2) { extended.push(s2); return; }
        const base2 = evaluate(s2.st, p, true);
        const acts2 = candidates(s2.st, o2, p);
        let bestFollow = null;
        for (const a2 of acts2) {
          if (Date.now() - t0 > 220) break;
          const r = simScore(s2.st, a2, p, base2, true);
          if (r.score > -1e8 && (!bestFollow || r.score > bestFollow.score)) bestFollow = r;
        }
        extended.push(bestFollow ? { score: bestFollow.score, st: bestFollow.st, act: s2.act } : s2);
      }
      scored = scored.filter((s2) => !top.includes(s2)).concat(extended);
    }
    return pickBest(scored, noise);
  }

  /* ---------------- turn driver ---------------- */
  function aiTakeTurn(st, difficulty) {
    const p = st.active;
    let guard = 0;
    let deploys = 0;
    const turnStart = Date.now();
    while (st.winner == null && st.phase === 'main' && st.active === p && guard++ < 16) {
      if (Date.now() - turnStart > 3500) { E().applyAction(st, { t: 'end' }); break; } // hard per-turn budget
      const act = chooseAction(st, p, difficulty);
      if (!act || act.t === 'end') { E().applyAction(st, { t: 'end' }); break; }
      if (act.t === 'deploy') {
        deploys++;
        if (deploys > 2 && difficulty > 0) { E().applyAction(st, { t: 'end' }); break; } // paced deployment: 2 cards/turn max
      }
      const r = E().applyAction(st, act);
      if (!r.ok) { E().applyAction(st, { t: 'end' }); break; }
    }
  }
  function aiPlaceCommander(st, p) {
    const rows = C.board.ownRows[p];
    const midY = Math.round((rows[0] + rows[1]) / 2) + (p === 1 ? 1 : -1);
    const base = E().byId(st, st.players[p].baseUid);
    let best = null;
    for (let y = rows[0]; y <= rows[1]; y++) for (let x = 0; x < C.board.w; x++) {
      if (NS.Engine.unitAt(st, x, y) || NS.Engine.tileBlocked(st, x, y)) continue;
      let sc = -Math.abs(y - midY) * 2 - Math.abs(x - 5) * 1.2;
      if (base) sc += dist({ x, y }, base) * 0.5; // near own base (defensive aura)
      if (!best || sc > best.sc) best = { sc, x, y };
    }
    E().applyAction(st, { t: 'placeCmd', player: p, x: best.x, y: best.y });
  }

  /* ---------------- bot deck generation ---------------- */
  function buildBotDeck(seedRng, difficulty) {
    const pool = NS.CARDS.filter((c) => !c.token && c.type !== 'commander');
    const cmdrs = NS.CARDS.filter((c) => c.type === 'commander');
    const deck = [];
    const nCmd = seedRng() < (difficulty >= 2 ? 0.55 : 0.25) ? 2 : 1;
    const pickedCmd = [];
    const start = Math.floor(seedRng() * cmdrs.length);
    for (let k = 0; k < cmdrs.length && pickedCmd.length < nCmd; k++) {
      pickedCmd.push(cmdrs[(start + k) % cmdrs.length]);
    }
    pickedCmd.forEach((c) => deck.push({ cardId: c.id, level: 1, choices: {} }));
    // shuffled bag: every card enters at its per-deck copy limit (commons ×3 ⇒ weighted naturally)
    const bag = [];
    pool.forEach((c) => {
      const copies = C.deck.maxCopies[c.rarity];
      for (let i = 0; i < copies; i++) bag.push(c);
      if (difficulty >= 2 && c.rarity >= 2) bag.push(c, c); // harder bots lean on higher rarities
    });
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(seedRng() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    const counts = {};
    for (const c of bag) {
      if (deck.length >= C.deck.size) break;
      if ((counts[c.id] || 0) >= C.deck.maxCopies[c.rarity]) continue;
      counts[c.id] = (counts[c.id] || 0) + 1;
      deck.push({ cardId: c.id, level: 1, choices: {} });
    }
    // absolute fallback (should never trigger): pad with any commons
    for (const c of pool) {
      if (deck.length >= C.deck.size) break;
      if ((counts[c.id] || 0) < C.deck.maxCopies[c.rarity]) { counts[c.id]++; deck.push({ cardId: c.id, level: 1, choices: {} }); }
    }
    return deck;
  }

  NS.AI = { evaluate, chooseAction, aiTakeTurn, aiPlaceCommander, buildBotDeck, threatMap };
})(typeof window !== 'undefined' ? (window.CS = window.CS || {}) : (globalThis.CS = globalThis.CS || {}));
