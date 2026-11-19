/* ============================================================
   CARDSTRIKE — battle engine (pure, serializable, DOM-free).
   All state transitions go through applyAction(); presentation
   only reads state + events. Future server can re-run this file.
   ============================================================ */
(function (NS) {
  'use strict';
  const C = NS.CFG;

  /* ---------------- RNG (seeded, serializable) ---------------- */
  function rngNext(state) {
    let t = (state.rngS = (state.rngS + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function rngInt(state, n) { return Math.floor(rngNext(state) * n); }
  function shuffle(state, arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = rngInt(state, i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }

  /* ---------------- geometry ---------------- */
  const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const inBoard = (x, y) => x >= 0 && y >= 0 && x < C.board.w && y < C.board.h;
  function ownSide(p, x, y) {
    const r = C.board.ownRows[p]; return y >= r[0] && y <= r[1];
  }
  function rectOf(u) {
    const s = u.size || { w: 1, h: 1 }, out = [];
    for (let dy = 0; dy < s.h; dy++) for (let dx = 0; dx < s.w; dx++) out.push({ x: u.x + dx, y: u.y + dy });
    return out;
  }
  function unitAt(state, x, y) {
    return state.units.find((u) =>
      (u.hp > 0 || (u.kind === 'commander' && u.fallen)) && rectOf(u).some((t) => t.x === x && t.y === y)) || null;
  }
  function tileBlocked(state, x, y) {
    return state.tiles.some((t) => t.kind === 'block' && t.x === x && t.y === y);
  }

  /* ---------------- status registry ---------------- */
  const STATUS = {
    burning: { name: 'Burning', icon: '🔥', stack: 'maxPow', tickStart: 'damage' },
    poison:  { name: 'Poison',  icon: '☠', stack: 'addPow', tickStart: 'damage' },
    frozen:  { name: 'Frozen',  icon: '❄', stack: 'maxDur', blocks: true, tickEnd: true },
    stunned: { name: 'Stunned', icon: '✷', stack: 'maxDur', blocks: true, tickEnd: true },
    shielded:{ name: 'Shield',  icon: '⛨', stack: 'addPow' },
    slowed:  { name: 'Slowed',  icon: '🐌', stack: 'maxDur', tickEnd: true },
    hasted:  { name: 'Hasted',  icon: '⚡', stack: 'maxDur', tickEnd: true },
    buff:    { name: 'Empowered', icon: '↑', stack: 'add', tickEnd: true },
    regen:   { name: 'Regen',   icon: '✚', stack: 'maxPow', tickStart: 'heal' },
  };

  /* ---------------- match creation ---------------- */
  function inst(cid, level, choices) {
    return { uid: 'c' + cid + '_' + Math.random().toString(36).slice(2, 8), cardId: cid, level: level || 1, choices: choices || {} };
  }
  function createMatch(opts) {
    const st = {
      seed: opts.seed || 1, rngS: (opts.seed || 1) >>> 0,
      turnNo: 0, active: 0, phase: 'placement', winner: null,
      fatigue: [0, 0], mods: opts.mods || {},
      tiles: [], log: [], seq: 1,
      pendingPlacement: [0, 1], placeCard: {},
      players: [], units: [], events: [],
    };
    opts.decks.forEach((spec, p) => {
      const cmdrs = spec.cards.filter((c) => NS.CARD[c.cardId].type === 'commander');
      if (cmdrs.length < 1) throw new Error('deck needs at least one commander');
      const rest = spec.cards.filter((c) => NS.CARD[c.cardId].type !== 'commander');
      shuffle(st, rest);
      const restCmdrs = shuffle(st, cmdrs.slice(1)); // 2nd commander stays in deck
      st.placeCard[p] = cmdrs[0];
      st.players.push({
        id: p, name: spec.name || 'Player ' + (p + 1), bot: (spec.bot == null ? null : spec.bot),
        hand: [], deck: rest.concat(restCmdrs), energy: 0, carry: 0, turnsTaken: 0,
        maxHand: C.deck.maxHand, commanders: [], baseUid: null, fatigueSeen: 0,
      });
      // auto-placed main base (victory condition 2)
      const bx = Math.floor(C.board.w / 2), by = p === 0 ? C.board.h - 1 : 0;
      st.units.push(mkUnit(st, { cardId: '__base', name: C.base.name, owner: p, kind: 'base', hp: C.base.hp, x: bx, y: by, passive: [{ op: 'auraAdj', stat: 'def', amount: C.base.auraDefense }] }));
      st.players[p].baseUid = st.units[st.units.length - 1].id;
    });
    log(st, 'Commanders, take the field. Place your commanders.');
    return st;
  }
  function mkUnit(st, o) {
    const u = Object.assign({
      id: 'u' + st.seq++, cardId: null, kind: 'unit', owner: 0, hp: 1, maxHp: 1,
      atk: 0, def: 0, mv: 0, pattern: 'melee', rng: [1, 1], los: true, counter: null,
      passive: [], abilities: [], statuses: [], level: 1, choices: {},
      moved: 0, attacksLeft: 0, counterUsed: false, abilityUses: {}, afterMove: 0,
      fallen: false, size: null, movesLeft: 0, x: 0, y: 0,
    }, o);
    u.maxHp = u.hp;
    (u.abilities || []).forEach((a, i) => { u.abilityUses[i] = { usesLeft: a.uses || 1, matchLeft: a.usesMatch || null, cdLeft: 0 }; });
    st.units.push(u);
    return u;
  }
  function spawnFromCard(st, handCard, owner, x, y) {
    const c = NS.CARD[handCard.cardId];
    const s = NS.statsFor(handCard.cardId, handCard.level, handCard.choices);
    const twice = (c.passive || []).some((ps) => ps.op === 'actTwice');
    const u = mkUnit(st, {
      cardId: c.id, name: c.name, owner, kind: c.type === 'commander' ? 'commander' : c.type,
      hp: s.hp, atk: s.atk, def: s.def, mv: c.type === 'structure' ? 0 : s.mv,
      pattern: c.pattern, rng: c.rng, los: c.los !== false, counter: c.counter || null,
      passive: c.passive || [], abilities: c.abilities || [], level: handCard.level, choices: handCard.choices,
      x, y, size: c.multiTile || null, token: !!c.token,
    });
    // freshly deployed units may act this turn (actTwice units act twice)
    if (u.kind === 'unit' || u.kind === 'commander') {
      u.movesLeft = twice ? 2 : 1;
      u.attacksLeft = twice ? 2 : 1;
    }
    return u;
  }

  function placeCommander(st, p, x, y) {
    if (st.phase !== 'placement' || !st.pendingPlacement.includes(p)) return err('not placing');
    if (!inBoard(x, y) || !ownSide(p, x, y)) return err('commanders deploy on your own side');
    if (unitAt(st, x, y) || tileBlocked(st, x, y)) return err('tile occupied');
    const hc = st.placeCard[p];
    const u = spawnFromCard(st, { cardId: hc.cardId, level: hc.level || 1, choices: hc.choices || {} }, p, x, y);
    st.players[p].commanders.push(u.id);
    st.pendingPlacement = st.pendingPlacement.filter((q) => q !== p);
    ev(st, { t: 'deploy', unit: u.id, player: p });
    log(st, st.players[p].name + ' places ' + u.name + '.');
    if (!st.pendingPlacement.length) beginMain(st);
    return true;
  }
  function beginMain(st) {
    st.players.forEach((p) => { for (let i = 0; i < C.deck.startHand; i++) drawCard(st, p.id, true); });
    st.active = 0; st.turnNo = 1;
    startPhase(st);
  }

  /* ---------------- turn phases ---------------- */
  function income(st, p) {
    let inc = Math.min(C.energy.incomeCap, C.energy.incomeBase + C.energy.incomeGrowth * (st.players[p].turnsTaken - 1));
    st.units.forEach((u) => {
      if (u.owner !== p || u.fallen || (u.kind !== 'commander' && u.kind !== 'unit' && u.kind !== 'structure')) return;
      (u.passive || []).forEach((ps) => { if (ps.op === 'incomeBonus') inc += ps.amount; });
    });
    inc += st.mods.incomeBonus || 0;
    return Math.min(inc, C.energy.incomeCap);
  }
  function startPhase(st) {
    const p = st.active, P = st.players[p];
    P.turnsTaken++;
    // per-turn flags refresh
    st.units.forEach((u) => {
      if (u.owner !== p || u.fallen || u.kind === 'structure' || u.kind === 'base') return;
      const twice = (u.passive || []).some((ps) => ps.op === 'actTwice');
      u.movesLeft = twice ? 2 : 1; u.attacksLeft = twice ? 2 : 1;
      u.counterUsed = false; u.afterMove = 0;
      (u.abilities || []).forEach((a, i) => {
        const s = u.abilityUses[i]; s.usesLeft = a.uses || 1; if (s.cdLeft > 0) s.cdLeft--;
      });
    });
    // start-of-turn ticks: burning/poison/regen, ember tiles, radiating passives
    st.units.filter((u) => u.owner === p && !u.fallen).forEach((u) => {
      u.statuses.forEach((s) => {
        const def = STATUS[s.status];
        if (def && def.tickStart === 'damage') { dealDamage(st, u, s.power, { pierce: true, silentSrc: s.status }); }
        if (def && def.tickStart === 'heal') { healUnit(st, u, s.power); }
      });
      u.statuses = u.statuses.filter((s) => { const d = STATUS[s.status]; return !(d && d.tickStart) || (s.dur--, s.dur > 0); });
    });
    // enemy-start passives (Nyx, Brazier): hurt enemies of the passive owner adjacent to it
    st.units.filter((u) => !u.fallen && (u.passive || []).some((ps) => ps.op === 'enemyStartDamage') && u.owner !== p).forEach((src) => {
      const ps = src.passive.find((x) => x.op === 'enemyStartDamage');
      st.units.filter((e) => e.owner === p && !e.fallen && e.kind !== 'base' && cheb(e, src) <= (ps.radius || 1))
        .forEach((e) => dealDamage(st, e, ps.amount, { pierce: true, silentSrc: 'aura' }));
    });
    // random-start passives (Arcane Pylon): owner's turn
    st.units.filter((u) => u.owner === p && !u.fallen && (u.passive || []).some((ps) => ps.op === 'startDamageRandom')).forEach((src) => {
      const ps = src.passive.find((x) => x.op === 'startDamageRandom');
      const foes = st.units.filter((e) => e.owner !== p && !e.fallen && e.kind !== 'base' && cheb(e, src) <= ps.radius);
      if (foes.length) dealDamage(st, foes[rngInt(st, foes.length)], ps.amount, { pierce: true, silentSrc: 'pylon' });
    });
    // ember tiles burn whoever stands on them at their turn start
    st.units.filter((u) => u.owner === p && !u.fallen && u.kind !== 'base').forEach((u) => {
      if (st.tiles.some((t) => t.kind === 'ember' && t.x === u.x && t.y === u.y)) dealDamage(st, u, 1, { pierce: true, silentSrc: 'ember' });
    });
    // energy
    P.carry = Math.min(P.carry, C.energy.carryCap);
    P.energy = Math.min(C.energy.incomeCap, income(st, p) + P.carry);
    P.carry = 0;
    if (P.turnsTaken > 1) drawCard(st, p); // opening hand IS the first-turn hand (no extra draw on turn 1)
    if (st.winner != null) return; // fatigue during the draw can end the match right here
    st.phase = 'main';
    ev(st, { t: 'turn', player: p, turn: st.turnNo });
    log(st, '— Turn ' + st.turnNo + ': ' + P.name + ' (' + P.energy + '⚡) —');
    checkVictory(st);
  }
  function endTurn(st) {
    const p = st.active, P = st.players[p];
    // end-of-turn ticks
    st.units.filter((u) => u.owner === p).forEach((u) => {
      u.statuses = u.statuses.filter((s) => { const d = STATUS[s.status]; return !(d && d.tickEnd) || (s.dur--, s.dur > 0); });
    });
    st.tiles = st.tiles.filter((t) => { if (t.owner === p) t.dur--; return t.dur > 0; });
    P.carry = Math.min(Math.max(0, P.energy), C.energy.carryCap);
    log(st, P.name + ' ends the turn (+' + P.carry + '⚡ stored).');
    st.active = 1 - p; st.turnNo++;
    startPhase(st);
  }

  /* ---------------- stats with auras/statuses ---------------- */
  function hasPassive(u, op) { return !u.fallen && (u.passive || []).some((p) => p.op === op); }
  function getPassive(u, op) { return (u.passive || []).find((p) => p.op === op) || null; }
  function statOf(st, u, which) {
    if (u.fallen) return which === 'hp' ? 0 : 0;
    let v = which === 'atk' ? u.atk : which === 'def' ? u.def : which === 'mv' ? u.mv : 0;
    let rangeBonus = 0;
    if (u.kind !== 'structure' && u.kind !== 'base') {
      u.statuses.forEach((s) => {
        if (s.status === 'buff') { if (which === 'atk') v += s.atkBonus || 0; if (which === 'def') v += s.defBonus || 0; }
        if (s.status === 'slowed' && which === 'mv') v -= 1;
        if (s.status === 'hasted' && which === 'mv') v += 1;
      });
    }
    st.units.forEach((src) => {
      if (src === u || src.fallen || src.owner !== u.owner || src.hp <= 0) return;
      const passives = (src.kind === 'base') ? src.passive : (src.passive || []);
      passives.forEach((ps) => {
        if (ps.op === 'auraAdj' && ps.stat === which && cheb(u, src) <= 1) v += ps.amount;
        if (ps.op === 'auraRadius') {
          const amt = which === 'atk' ? ps.atk : which === 'def' ? ps.def : 0;
          if (amt && cheb(u, src) <= (ps.radius || 1)) v += amt;
        }
        if (ps.op === 'rangeAura' && which === 'rangeMax' && cheb(u, src) <= (ps.radius || 1)) rangeBonus += ps.amount;
      });
    });
    if (which === 'mv') v = Math.max(u.kind === 'structure' || u.kind === 'base' ? 0 : 1, v);
    if (which === 'rangeMax') return (u.rng ? u.rng[1] : 1) + Math.min(rangeBonus, 1);
    return v;
  }

  /* ---------------- targeting helpers ---------------- */
  function inPattern(att, dx, dy, rangeMax) {
    const ax = Math.abs(dx), ay = Math.abs(dy);
    const min = att.rng ? att.rng[0] : 1, max = rangeMax != null ? rangeMax : (att.rng ? att.rng[1] : 1);
    switch (att.pattern) {
      case 'ortho': return ((dx === 0) !== (dy === 0)) && (ax + ay) >= min && (ax + ay) <= max;
      case 'diag': return ax === ay && ax > 0 && ax >= min && ax <= max;
      case 'radial': return Math.max(ax, ay) >= min && Math.max(ax, ay) <= max;
      case 'knight': return (ax === 1 && ay === 2) || (ax === 2 && ay === 1);
      case 'cleave': return Math.max(ax, ay) === 1;
      default: return Math.max(ax, ay) >= min && Math.max(ax, ay) <= max;
    }
  }
  function hasLos(st, a, b, owner) {
    // bounded Bresenham ray — handles non-aligned pairs without overshoot.
    // pieces owned by `owner` are transparent: you fire over your own lines;
    // enemy bodies block. Fallen commanders still anchor/block (they are bodies).
    let x = a.x, y = a.y;
    const sx = Math.sign(b.x - a.x), sy = Math.sign(b.y - a.y);
    let nx = Math.abs(b.x - a.x), ny = Math.abs(b.y - a.y);
    let err = nx - ny;
    let guard = nx + ny + 2;
    while ((x !== b.x || y !== b.y) && guard-- > 0) {
      if (2 * err > -ny) { err -= ny; x += sx; } else { err += nx; y += sy; }
      if (x === b.x && y === b.y) break;
      if (!inBoard(x, y)) return false;
      const blk = unitAt(st, x, y);
      if (blk && blk.owner !== owner) return false;
    }
    return x === b.x && y === b.y;
  }
  function legalAttacks(st, uid) {
    const u = byId(st, uid); if (!u || u.fallen || u.attacksLeft <= 0) return [];
    if (blocked(st, u)) return [];
    const rmax = statOf(st, u, 'rangeMax');
    const out = [];
    st.units.forEach((e) => {
      if (e.owner === u.owner || e.fallen || (e.kind === 'commander' && e.fallen)) return;
      if (e.hp <= 0) return;
      const dx = e.x - u.x, dy = e.y - u.y;
      if (!inPattern(u, dx, dy, rmax)) return;
      if (u.pattern === 'ortho' || u.pattern === 'diag' || u.pattern === 'radial') {
        if (u.los && !hasLos(st, u, e, u.owner)) return;
      }
      out.push({ target: e.id });
    });
    return out;
  }
  function blocked(st, u) {
    return u.statuses.some((s) => s.status === 'frozen' || s.status === 'stunned');
  }
  function legalMoves(st, uid) {
    const u = byId(st, uid); if (!u || u.fallen) return [];
    if (u.kind === 'structure' || u.kind === 'base') return [];
    if (u.movesLeft <= 0 || blocked(st, u)) return [];
    const mv = Math.max(1, statOf(st, u, 'mv'));
    const phase = hasPassive(u, 'phaseMove');
    const seen = {}, out = [];
    const key = (x, y) => x + ',' + y;
    let frontier = [{ x: u.x, y: u.y }];
    seen[key(u.x, u.y)] = true;
    for (let step = 0; step < mv; step++) {
      const next = [];
      frontier.forEach((t) => {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const x = t.x + dx, y = t.y + dy, k = key(x, y);
          if (!inBoard(x, y) || seen[k]) continue;
          seen[k] = true;
          const occ = unitAt(st, x, y), blk = tileBlocked(st, x, y);
          if (!occ && !blk) { out.push({ x, y }); next.push({ x, y }); }
          else if (occ && phase) next.push({ x, y }); // pass through, can't stop
        }
      });
      frontier = next;
    }
    // tactical return: units below 15% HP may retreat adjacent to a friendly commander
    if (u.hp / u.maxHp < C.energy.returnThreshold) {
      st.units.filter((c) => c.owner === u.owner && c.kind === 'commander').forEach((c) => {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const x = c.x + dx, y = c.y + dy;
          if (inBoard(x, y) && !unitAt(st, x, y) && !tileBlocked(st, x, y) && !(x === u.x && y === u.y)) {
            if (!out.some((o) => o.x === x && o.y === y)) out.push({ x, y, ret: true });
          }
        }
      });
    }
    return out;
  }
  function canRecover(st, uid) {
    const u = byId(st, uid); if (!u || u.fallen) return false;
    if (u.kind === 'structure' || u.kind === 'base') return false;
    if (u.hp / u.maxHp >= C.energy.recoverTo) return false;
    return st.players[u.owner].commanders.some((cid) => {
      const c = byId(st, cid); return c && cheb(u, c) <= 1;
    }) && st.players[u.owner].energy >= C.energy.recoverCost;
  }

  /* ---------------- deploys & spells ---------------- */
  function deployCost(st, p, handCard, x, y) {
    if (NS.CARD[handCard.cardId].type === 'commander') return 0;
    let cost = NS.CARD[handCard.cardId].cost;
    st.units.forEach((u) => {
      if (u.owner === p && !u.fallen && (u.passive || []).some((ps) => ps.op === 'deployDiscount') && cheb({ x, y }, u) <= 2) cost -= 1;
    });
    return Math.max(1, cost);
  }
  function legalDeployTiles(st, p, handCard) {
    const c = NS.CARD[handCard.cardId];
    const out = [];
    if (c.type === 'commander') {
      st.players[p].commanders.forEach((cid) => {
        const cmd = byId(st, cid); if (!cmd) return;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const x = cmd.x + dx, y = cmd.y + dy;
          if (inBoard(x, y) && ownSide(p, x, y) && !unitAt(st, x, y) && !tileBlocked(st, x, y)) out.push({ x, y });
        }
      });
      return out;
    }
    const size = c.multiTile || { w: 1, h: 1 };
    for (let y = 0; y < C.board.h; y++) for (let x = 0; x < C.board.w; x++) {
      if (!ownSide(p, x, y)) continue;
      let ok = true;
      for (let dy = 0; dy < size.h && ok; dy++) for (let dx = 0; dx < size.w && ok; dx++) {
        if (!inBoard(x + dx, y + dy) || !ownSide(p, x + dx, y + dy) || unitAt(st, x + dx, y + dy) || tileBlocked(st, x + dx, y + dy)) ok = false;
      }
      if (ok) out.push({ x, y });
    }
    return out;
  }
  function spellTargets(st, handCard) {
    const c = NS.CARD[handCard.cardId], t = c.targeting, out = [];
    if (t === 'none') return [{ none: true }];
    st.units.forEach((u) => {
      if (u.fallen || u.hp <= 0 || u.kind === 'base') return;
      if (t === 'enemyUnit' && u.owner !== st.active) out.push({ unit: u.id });
      if (t === 'friendlyUnit' && u.owner === st.active) out.push({ unit: u.id });
      if (t === 'anyUnit') out.push({ unit: u.id });
    });
    if (t === 'emptyTile' || t === 'anyTile') {
      for (let y = 0; y < C.board.h; y++) for (let x = 0; x < C.board.w; x++) {
        if (t === 'emptyTile' && (unitAt(st, x, y) || tileBlocked(st, x, y))) continue;
        out.push({ x, y });
      }
    }
    return out;
  }
  function abilityTargets(st, u, ai) {
    const a = u.abilities[ai], t = a.targeting, out = [];
    if (t === 'self') return [{ none: true }];
    const rmax = statOf(st, u, 'rangeMax');
    st.units.forEach((e) => {
      if (e.fallen || e.hp <= 0) return;
      const dx = e.x - u.x, dy = e.y - u.y;
      const ally = e.owner === u.owner;
      if (t === 'adjacentAlliesOfSelf' && ally && cheb(u, e) === 1 && e.kind !== 'base') out.push({ unit: e.id });
      if (t === 'adjacentEnemiesOfSelf' && !ally && cheb(u, e) === 1 && e.kind !== 'base') out.push({ unit: e.id });
      if (t === 'enemyUnitOrtho3' && !ally && inPattern({ pattern: 'ortho', rng: [1, 3] }, dx, dy)) out.push({ unit: e.id });
      if (t === 'enemyUnitOrtho2' && !ally && inPattern({ pattern: 'ortho', rng: [1, 2] }, dx, dy)) out.push({ unit: e.id });
      if (t === 'enemyUnitRadial3' && !ally && Math.max(Math.abs(dx), Math.abs(dy)) <= 3 && cheb(u, e) >= 1) out.push({ unit: e.id });
      if (t === 'enemyUnitKnight' && !ally && inPattern({ pattern: 'knight', rng: [1, 1] }, dx, dy)) out.push({ unit: e.id });
      if (t === 'friendlyStructureOrBase4' && ally && (e.kind === 'structure' || e.kind === 'base') && cheb(u, e) <= 4) out.push({ unit: e.id });
    });
    if (t === 'anyTile') {
      for (let y = 0; y < C.board.h; y++) for (let x = 0; x < C.board.w; x++) out.push({ x, y });
    }
    return out;
  }

  /* ---------------- effect resolution ---------------- */
  function resolveEffects(st, caster, owner, effects, tgt) {
    effects.forEach((ef) => {
      // these ops read the raw target (tile / global) and must not go through target lists
      if (['tile', 'draw', 'energy', 'maxHand', 'summon', 'teleport'].includes(ef.op)) {
        applyOp(st, caster, owner, ef, tgt, tgt);
        return;
      }
      const targets = resolveTargets(st, caster, owner, ef, tgt);
      targets.forEach((t) => applyOp(st, caster, owner, ef, t, tgt));
    });
  }
  function resolveTargets(st, caster, owner, ef, tgt) {
    const op = ef.targets;
    const unitList = (pred) => st.units.filter((u) => !u.fallen && u.hp > 0 && pred(u));
    switch (op) {
      case 'target':
        if (tgt && tgt.unit != null) { const u = byId(st, tgt.unit); return u ? [u] : []; }
        if (tgt && tgt.x != null) return [{ x: tgt.x, y: tgt.y }];
        return [];
      case 'self': return caster ? [caster] : [];
      case 'adjacentEnemiesOfSelf': return caster ? unitList((u) => u.owner !== owner && u.kind !== 'base' && cheb(u, caster) === 1) : [];
      case 'adjacentAlliesOfSelf': return caster ? unitList((u) => u.owner === owner && cheb(u, caster) === 1) : [];
      case 'allEnemyUnits': return unitList((u) => u.owner !== owner && u.kind === 'unit');
      case 'allFriendlyUnits': return unitList((u) => u.owner === owner && (u.kind === 'unit' || u.kind === 'commander'));
      case 'allFriendlyCommanders': return unitList((u) => u.owner === owner && u.kind === 'commander');
      case 'adjacentOfTarget': {
        if (!tgt || tgt.unit == null) return [];
        const c = byId(st, tgt.unit); if (!c) return [];
        return unitList((u) => u.owner !== owner && cheb(u, c) === 1);
      }
      case 'randomEnemyNearTarget': {
        if (!tgt || tgt.unit == null) return [];
        const c = byId(st, tgt.unit); if (!c) return [];
        const foes = unitList((u) => u.owner !== owner && u.kind === 'unit' && cheb(u, c) <= (ef.radius || 3) && u !== c);
        return foes.length ? [foes[rngInt(st, foes.length)]] : [];
      }
      case 'enemiesNearSelfRadius2': return caster ? unitList((u) => u.owner !== owner && cheb(u, caster) <= 2) : [];
      default: return [];
    }
  }
  function applyOp(st, caster, owner, ef, t, tgt) {
    switch (ef.op) {
      case 'damage': {
        if (t.unit != null || t.id) { const u = byId(st, t.unit || t.id); if (u) dealDamage(st, u, ef.amount, { pierce: !!ef.pierce }); }
        break;
      }
      case 'heal': {
        const u = byId(st, t.unit || t.id); if (u) healUnit(st, u, ef.amount);
        break;
      }
      case 'status': {
        const u = byId(st, t.unit || t.id); if (u && !u.fallen) applyStatus(st, u, ef.status, ef.power || 0, ef.dur || 1);
        break;
      }
      case 'shield': {
        const u = byId(st, t.unit || t.id); if (u && !u.fallen) applyStatus(st, u, 'shielded', ef.amount, 99);
        break;
      }
      case 'buffTemp': {
        const u = byId(st, t.unit || t.id); if (u && !u.fallen) {
          u.statuses.push({ status: 'buff', atkBonus: ef.atk || 0, defBonus: ef.def || 0, dur: ef.dur || 1 });
          ev(st, { t: 'buff', unit: u.id });
        }
        break;
      }
      case 'tile': {
        const area = ef.area || 'single';
        const coords = [];
        if (tgt && tgt.x != null) coords.push({ x: tgt.x, y: tgt.y });
        if (area === 'cross' && tgt && tgt.x != null) [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach((d) => coords.push({ x: tgt.x + d[0], y: tgt.y + d[1] }));
        if (area === 'radius1' && tgt && tgt.x != null) {
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) coords.push({ x: tgt.x + dx, y: tgt.y + dy });
        }
        coords.forEach((c2) => {
          if (!inBoard(c2.x, c2.y)) return;
          if (ef.kind === 'block' && unitAt(st, c2.x, c2.y)) return;
          const existing = st.tiles.find((tl) => tl.x === c2.x && tl.y === c2.y && tl.kind === ef.kind);
          if (existing) existing.dur = Math.max(existing.dur, ef.dur);
          else st.tiles.push({ x: c2.x, y: c2.y, kind: ef.kind, owner, dur: ef.dur });
          ev(st, { t: 'tile', x: c2.x, y: c2.y, kind: ef.kind });
        });
        break;
      }
      case 'draw': for (let i = 0; i < (ef.n || 1); i++) drawCard(st, owner); break;
      case 'energy': st.players[owner].energy = Math.min(C.energy.incomeCap, st.players[owner].energy + (ef.amount || 0)); ev(st, { t: 'energy', player: owner }); break;
      case 'maxHand': st.players[owner].maxHand += ef.amount || 1; break;
      case 'summon': {
        const n = ef.count || 1;
        let placed = 0;
        for (let r = 1; r <= 2 && placed < n; r++) {
          for (let dy = -r; dy <= r && placed < n; dy++) for (let dx = -r; dx <= r && placed < n; dx++) {
            const x = tgt.x + dx, y = tgt.y + dy;
            if (inBoard(x, y) && !unitAt(st, x, y) && !tileBlocked(st, x, y)) {
              const tk = spawnFromCard(st, { cardId: ef.token, level: 1, choices: {} }, owner, x, y);
              tk.token = true; placed++;
              ev(st, { t: 'deploy', unit: tk.id, player: owner });
            }
          }
        }
        break;
      }
      case 'destroy': {
        const u = byId(st, t.unit || t.id);
        if (u && (!ef.maxHp || u.hp <= ef.maxHp)) dealDamage(st, u, u.hp, { pierce: true });
        break;
      }
      case 'teleport': {
        if (!caster) break;
        const opts = [];
        for (let dy = -(ef.range || 1); dy <= (ef.range || 1); dy++) for (let dx = -(ef.range || 1); dx <= (ef.range || 1); dx++) {
          const x = caster.x + dx, y = caster.y + dy;
          if ((dx || dy) && inBoard(x, y) && !unitAt(st, x, y) && !tileBlocked(st, x, y)) opts.push({ x, y });
        }
        if (opts.length) {
          const pick = tgt && tgt.x != null ? opts.find((o) => o.x === tgt.x && o.y === tgt.y) || opts[0] : opts[rngInt(st, opts.length)];
          ev(st, { t: 'move', unit: caster.id, from: { x: caster.x, y: caster.y }, to: pick });
          caster.x = pick.x; caster.y = pick.y;
        }
        break;
      }
      case 'refresh': {
        const u = byId(st, t.unit || t.id); if (!u || u.fallen) break;
        if (ef.what === 'move' || ef.what === 'all') { u.movesLeft = Math.max(u.movesLeft, 1); }
        if (ef.what === 'all') { u.attacksLeft = Math.max(u.attacksLeft, 1); }
        ev(st, { t: 'refresh', unit: u.id });
        break;
      }
      case 'transform': {
        if (!caster) break;
        const into = NS.CARD[ef.into];
        caster.name = into.name; caster.cardId = into.id;
        caster.passive = into.passive || []; caster.abilities = into.abilities || [];
        caster.abilityUses = {}; (into.abilities || []).forEach((a, i) => { caster.abilityUses[i] = { usesLeft: 1, matchLeft: null, cdLeft: 0 }; });
        ev(st, { t: 'transform', unit: caster.id });
        break;
      }
    }
  }
  function applyStatus(st, u, status, power, dur) {
    const def = STATUS[status]; if (!def) return;
    const ex = u.statuses.find((s) => s.status === status);
    if (ex) {
      if (def.stack === 'addPow') { ex.power += power; ex.dur = Math.max(ex.dur, dur); }
      else if (def.stack === 'add') { ex.atkBonus = (ex.atkBonus || 0) + (power || 0); ex.dur = Math.max(ex.dur, dur); }
      else { ex.power = Math.max(ex.power, power); ex.dur = Math.max(ex.dur, dur); }
    } else u.statuses.push({ status, power: power || 0, dur });
    ev(st, { t: 'status', unit: u.id, status });
  }

  /* ---------------- damage / death ---------------- */
  function dealDamage(st, u, amount, opts) {
    if (!u || u.fallen || u.hp <= 0 || amount <= 0) return 0;
    opts = opts || {};
    let amt = amount;
    if (!opts.pierce) {
      const def = statOf(st, u, 'def');
      amt = Math.max(1, amt - def);
      if (hasPassive(u, 'reduceDamage')) amt = Math.max(1, amt - getPassive(u, 'reduceDamage').amount);
    }
    const sh = u.statuses.find((s) => s.status === 'shielded');
    if (sh && sh.power > 0) {
      const absorbed = Math.min(sh.power, amt);
      sh.power -= absorbed; amt -= absorbed;
      ev(st, { t: 'shieldBlock', unit: u.id, absorbed });
      if (sh.power <= 0) u.statuses = u.statuses.filter((s) => s !== sh);
    }
    if (amt <= 0) return 0;
    u.hp -= amt;
    ev(st, { t: 'damage', unit: u.id, amount: amt, hp: Math.max(0, u.hp), src: opts.silentSrc || null });
    if (u.hp <= 0) killUnit(st, u);
    else checkVictory(st);
    return amt;
  }
  function healUnit(st, u, amount) {
    if (!u || u.fallen || u.hp <= 0) return;
    const before = u.hp;
    u.hp = Math.min(u.maxHp, u.hp + amount);
    if (u.hp !== before) ev(st, { t: 'heal', unit: u.id, amount: u.hp - before });
  }
  function killUnit(st, u) {
    if (u.kind === 'commander') {
      u.hp = 0; u.fallen = true;
      u.statuses = []; u.atk = 0; u.mv = 0;
      ev(st, { t: 'fallen', unit: u.id });
      log(st, u.name + ' has FALLEN — its abilities are lost, but it remains as a battlefield anchor.');
    } else {
      u.hp = 0;
      ev(st, { t: 'death', unit: u.id });
      log(st, u.name + ' is destroyed.');
      (u.passive || []).forEach((ps) => {
        if (ps.op === 'onDeathDamage') {
          st.units.filter((e) => !e.fallen && e.hp > 0 && e.owner !== u.owner && cheb(e, u) <= (ps.radius || 1))
            .forEach((e) => dealDamage(st, e, ps.amount, { pierce: true, silentSrc: 'deathrattle' }));
        }
        if (ps.op === 'onDeathSummon') {
          for (let i = 0, placed = 0; i < ps.count && placed < 8; i++) {
            const spots = [];
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
              const x = u.x + dx, y = u.y + dy;
              if ((dx || dy) && inBoard(x, y) && !unitAt(st, x, y) && !tileBlocked(st, x, y)) spots.push({ x, y });
            }
            if (!spots.length) break;
            const s2 = spots[rngInt(st, spots.length)];
            const tk = spawnFromCard(st, { cardId: ps.token, level: 1, choices: {} }, u.owner, s2.x, s2.y);
            tk.token = true; placed++;
            ev(st, { t: 'deploy', unit: tk.id, player: u.owner });
            spots.splice(spots.indexOf(s2), 1);
            if (!spots.length) break;
          }
        }
      });
    }
    checkVictory(st);
  }

  /* ---------------- drawing & fatigue ---------------- */
  function drawCard(st, p, opening) {
    const P = st.players[p];
    if (!P.deck.length) {
      // failed draw: deck exhausted — fatigue strikes even if the hand is full
      // (otherwise hands-full stalemates could never reach the fatigue victory condition)
      st.fatigue[p]++;
      P.fatigueSeen = st.fatigue[p];
      ev(st, { t: 'fatigue', player: p, amount: st.fatigue[p] });
      log(st, P.name + "'s deck is empty — FATIGUE " + st.fatigue[p] + ' strikes their commanders!');
      st.players[p].commanders.forEach((cid) => {
        const c = byId(st, cid);
        if (c && !c.fallen) dealDamage(st, c, st.fatigue[p], { pierce: true, silentSrc: 'fatigue' });
      });
      checkVictory(st);
      return;
    }
    if (P.hand.length >= P.maxHand) { if (!opening) ev(st, { t: 'handFull', player: p }); return; }
    const card2 = P.deck.pop();
    P.hand.push(card2);
    ev(st, { t: 'draw', player: p, card: card2.cardId });
  }

  /* ---------------- victory ---------------- */
  function checkVictory(st) {
    if (st.winner != null) return;
    for (let p = 0; p < 2; p++) {
      const alive = st.players[p].commanders.some((cid) => { const c = byId(st, cid); return c && !c.fallen; });
      if (!alive) { setWinner(st, 1 - p, 'Commander elimination — all of ' + st.players[p].name + "'s commanders have fallen."); return; }
      const base = byId(st, st.players[p].baseUid);
      if (!base || base.hp <= 0) { setWinner(st, 1 - p, 'Base destruction — ' + st.players[p].name + "'s Main Base lies in ruin."); return; }
    }
  }
  function setWinner(st, p, reason) {
    st.winner = p; st.phase = 'over';
    log(st, 'VICTORY: ' + st.players[p].name + ' — ' + reason);
    ev(st, { t: 'victory', player: p, reason });
  }

  /* ---------------- applyAction ---------------- */
  function err(msg) { return { ok: false, error: msg }; }
  function applyAction(st, act) {
    if (st.winner != null) return err('match over');
    const p = st.active, P = st.players[p];
    let out = [];
    st.events = out;
    let ok = true;
    switch (act.t) {
      case 'placeCmd': ok = placeCommander(st, act.player != null ? act.player : p, act.x, act.y); if (ok !== true) return ok; break;
      case 'deploy': {
        const hc = P.hand[act.handIdx]; if (!hc) return err('no card');
        const c = NS.CARD[hc.cardId];
        if (c.type === 'spell') {
          const valid = spellTargets(st, hc);
          const tg = act.targets || {};
          const okT = valid.some((v) =>
            (v.unit != null && v.unit === tg.unit) ||
            (v.x != null && tg.x != null && v.x === tg.x && v.y === tg.y) ||
            !!v.none);
          if (!okT) return err('invalid spell target');
          if (P.energy < c.cost) return err('not enough energy');
          P.energy -= c.cost;
          P.hand.splice(act.handIdx, 1);
          resolveEffects(st, null, p, c.effects, tg);
          ev(st, { t: 'spell', card: hc.cardId, player: p });
          log(st, P.name + ' casts ' + c.name + '.');
          drawCard(st, p); // replacement draw
          break;
        }
        const tiles = legalDeployTiles(st, p, hc);
        if (!tiles.some((t) => t.x === act.x && t.y === act.y)) return err('invalid deploy tile');
        const cost = deployCost(st, p, hc, act.x, act.y);
        if (P.energy < cost) return err('not enough energy');
        P.energy -= cost;
        P.hand.splice(act.handIdx, 1);
        const u = spawnFromCard(st, hc, p, act.x, act.y);
        ev(st, { t: 'deploy', unit: u.id, player: p });
        log(st, P.name + ' deploys ' + c.name + '.');
        if (c.type === 'commander') { P.commanders.push(u.id); log(st, c.name + ' takes the field as commander.'); }
        (u.passive || []).forEach((ps) => {
          if (ps.op === 'onDeployShield') applyStatus(st, u, 'shielded', ps.amount, 99);
          if (ps.op === 'onDeployDraw') { for (let i = 0; i < (ps.amount || 1); i++) drawCard(st, p); }
          if (ps.op === 'onDeployStatusAllEnemies') st.units.filter((e) => e.owner !== p && !e.fallen && e.kind === 'unit').forEach((e) => applyStatus(st, e, ps.status, ps.power, ps.dur));
          if (ps.op === 'onDeployDamageNear') st.units.filter((e) => e.owner !== p && !e.fallen && cheb(e, u) <= (ps.radius || 2)).forEach((e) => dealDamage(st, e, ps.amount, { pierce: true, silentSrc: 'deploy' }));
        });
        drawCard(st, p); // replacement draw (skipped silently if hand full)
        break;
      }
      case 'move': {
        const u = byId(st, act.unit);
        if (!u || u.owner !== p) return err('not your unit');
        const moves = legalMoves(st, act.unit);
        const m = moves.find((t) => t.x === act.x && t.y === act.y);
        if (!m) return err('invalid move');
        ev(st, { t: 'move', unit: u.id, from: { x: u.x, y: u.y }, to: { x: act.x, y: act.y }, ret: !!m.ret });
        u.x = act.x; u.y = act.y;
        u.movesLeft--;
        if (m.ret) log(st, u.name + ' retreats to the friendly commander banner.');
        break;
      }
      case 'attack': {
        const u = byId(st, act.unit), e = byId(st, act.target);
        if (!u || !e || u.owner !== p) return err('bad attack');
        if (!legalAttacks(st, act.unit).some((a) => a.target === act.target)) return err('target out of range/pattern');
        if (P.energy < C.energy.attackCost) return err('not enough energy to attack');
        P.energy -= C.energy.attackCost;
        u.attacksLeft--;
        doAttack(st, u, e);
        if (hasPassive(u, 'afterAttackMove') && u.movesLeft <= 0 && !blocked(st, u)) u.movesLeft += getPassive(u, 'afterAttackMove').amount;
        break;
      }
      case 'ability': {
        const u = byId(st, act.unit); if (!u || u.owner !== p || u.fallen) return err('bad ability');
        const a = u.abilities[act.ai]; const s = u.abilityUses[act.ai];
        if (!a || !s || s.usesLeft <= 0 || s.cdLeft > 0 || (s.matchLeft != null && s.matchLeft <= 0)) return err('ability unavailable');
        if (P.energy < a.cost) return err('not enough energy');
        if (blocked(st, u)) return err('unit cannot act');
        const tgts = abilityTargets(st, u, act.ai);
        if (!tgts.length) return err('no targets');
        if (!(a.targeting === 'self' || a.targeting === 'anyTile') && !tgts.some((t2) => act.targets && act.targets.unit != null && t2.unit === act.targets.unit)) return err('invalid target');
        P.energy -= a.cost;
        s.usesLeft--; if (s.matchLeft != null) s.matchLeft--; s.cdLeft = a.cd || 0;
        log(st, u.name + ' uses ' + a.name + '.');
        resolveEffects(st, u, p, a.effects, act.targets || {});
        break;
      }
      case 'recover': {
        const u = byId(st, act.unit);
        if (!canRecover(st, act.unit)) return err('cannot recover');
        P.energy -= C.energy.recoverCost;
        const target = Math.ceil(u.maxHp * C.energy.recoverTo);
        const amt = target - u.hp;
        healUnit(st, u, amt);
        log(st, u.name + ' is restored to ' + u.hp + ' HP by the commander.');
        ev(st, { t: 'recover', unit: u.id });
        break;
      }
      case 'end': endTurn(st); break;
      default: return err('unknown action');
    }
    const evs = out; st.events = [];
    return { ok: true, events: evs };
  }
  function doAttack(st, u, e) {
    const atk = statOf(st, u, 'atk');
    ev(st, { t: 'attack', unit: u.id, target: e.id });
    log(st, u.name + ' attacks ' + e.name + '.');
    if (u.pattern === 'cleave') {
      st.units.filter((x) => !x.fallen && x.hp > 0 && x.owner !== u.owner && cheb(x, u) === 1)
        .forEach((x) => strike(st, u, x, atk));
    } else {
      strike(st, u, e, atk);
    }
  }
  function strike(st, u, e, atk) {
    const dealt = dealDamage(st, e, atk, {});
    (u.passive || []).forEach((ps) => {
      if (ps.op === 'onHitStatus' && !e.fallen) applyStatus(st, e, ps.status, ps.power, ps.dur);
    });
    if (e.fallen && hasPassive(u, 'onKillSummon')) {
      const ps = getPassive(u, 'onKillSummon');
      if (!unitAt(st, e.x, e.y)) {
        const tk = spawnFromCard(st, { cardId: ps.token, level: 1, choices: {} }, u.owner, e.x, e.y);
        tk.token = true;
        ev(st, { t: 'deploy', unit: tk.id, player: u.owner });
      }
    }
    // counterattack
    if (!e.fallen && e.hp > 0 && e.counter && !e.counterUsed && !blocked(st, e) && e.kind !== 'structure' && e.kind !== 'base') {
      const okRange = e.counter === 'melee' ? cheb(u, e) <= 1 : inPattern(e, u.x - e.x, u.y - e.y, statOf(st, e, 'rangeMax'));
      if (okRange) {
        e.counterUsed = true;
        ev(st, { t: 'counter', unit: e.id, target: u.id });
        log(st, e.name + ' counterattacks!');
        dealDamage(st, u, statOf(st, e, 'atk'), {});
      }
    }
  }

  /* ---------------- options aggregate (UI + AI share this) ---------------- */
  function getOptions(st) {
    if (st.winner != null || st.phase !== 'main') return null;
    const p = st.active, P = st.players[p];
    const o = { player: p, energy: P.energy, moves: {}, attacks: {}, abilities: {}, recover: [], deploys: [], spells: [] };
    st.units.forEach((u) => {
      if (u.owner !== p || u.fallen || u.hp <= 0) return;
      if (u.kind === 'unit' || u.kind === 'commander') {
        const mv = legalMoves(st, u.id); if (mv.length) o.moves[u.id] = mv;
        const at = legalAttacks(st, u.id); if (at.length) o.attacks[u.id] = at;
        if (canRecover(st, u.id)) o.recover.push(u.id);
        (u.abilities || []).forEach((a, i) => {
          const s = u.abilityUses[i];
          if (s.usesLeft > 0 && s.cdLeft <= 0 && (s.matchLeft == null || s.matchLeft > 0) && P.energy >= a.cost && !blocked(st, u)) {
            const tg = abilityTargets(st, u, i);
            if (tg.length) (o.abilities[u.id] = o.abilities[u.id] || []).push({ ai: i, name: a.name, cost: a.cost, targets: tg });
          }
        });
      }
    });
    P.hand.forEach((hc, i) => {
      const c = NS.CARD[hc.cardId];
      if (c.type === 'spell') {
        const tg = spellTargets(st, hc);
        if (tg.length && P.energy >= c.cost) o.spells.push({ handIdx: i, uid: hc.uid, cardId: hc.cardId, cost: c.cost, targets: tg });
      } else {
        const tiles = legalDeployTiles(st, p, hc);
        if (tiles.length) o.deploys.push({ handIdx: i, uid: hc.uid, cardId: hc.cardId, tiles, cost: Math.min(...tiles.map((t2) => deployCost(st, p, hc, t2.x, t2.y))) });
      }
    });
    return o;
  }

  function byId(st, id) { return st.units.find((u) => u.id === id) || null; }
  function ev(st, e) { st.events.push(e); }
  function log(st, text) { st.log.push({ turn: st.turnNo, text }); }

  NS.Engine = {
    createMatch, placeCommander, applyAction, getOptions, byId, unitAt, tileBlocked,
    legalMoves, legalAttacks, canRecover, legalDeployTiles, spellTargets, abilityTargets,
    deployCost, statOf, inPattern, hasLos, rectOf, inBoard, ownSide, STATUS,
    clone: (st) => (typeof structuredClone === 'function' ? structuredClone(st) : JSON.parse(JSON.stringify(st))),
    rngNext, rngInt,
    pendingCard: (st, p) => st.placeCard[p],
    // test/debug hooks (no gameplay path uses these)
    _spawn: (st, cardId, owner, x, y) => spawnFromCard(st, { cardId, level: 1, choices: {} }, owner, x, y),
    _dealDamage: dealDamage,
  };
})(typeof window !== 'undefined' ? (window.CS = window.CS || {}) : (globalThis.CS = globalThis.CS || {}));
