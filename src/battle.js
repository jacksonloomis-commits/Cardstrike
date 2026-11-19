/* ============================================================
   CARDSTRIKE — battle screen: board rendering, interaction,
   placement phase, bot pacing, animations, victory + rewards.
   ============================================================ */
(function (NS) {
  'use strict';
  const C = NS.CFG, M = () => NS.Meta, E = () => NS.Engine, U = NS.UI;
  const $ = U.$, $$ = U.$$, el = U.el, esc = U.esc;

  const B = {
    st: null, setup: null, mode: 'idle', sel: null, selAbility: null,
    handIdx: null, pendingCast: null, botTimer: null, unitEls: {}, built: false,
  };
  const DIFFS = ['Easy', 'Normal', 'Hard', 'Expert'];
  const STATUS_HELP = {
    burning: 'takes damage at the start of each of its turns',
    poison: 'takes growing damage at the start of each of its turns',
    frozen: 'cannot move, attack, or use abilities while it lasts',
    stunned: 'cannot act while it lasts',
    shielded: 'absorbs damage before HP',
    slowed: 'movement reduced',
    hasted: 'movement increased',
    buff: 'attack/defense boosted by an aura or spell',
    regen: 'heals at the start of each of its turns',
  };

  /* ---------------- opening a match ---------------- */
  function open(setup) {
    const s = M().get();
    setup = setup || { mode: 'bot', difficulty: 1 };
    const deckIdx = s.activeDeck;
    const deckDef = s.decks[deckIdx];
    if (!deckDef || !M().validateDeck(deckDef.cards).ok) { U.toast('Your active deck is not a valid 35-card deck — fix it in the Deck Builder.', 'bad'); U.show('decks'); return; }
    const playerCards = deckDef.cards.map((c) => ({ ...c, level: (s.collection[c.cardId] || {}).level || 1, choices: (s.collection[c.cardId] || {}).choices || {} }));
    let oppCards, oppName, bot = null;
    if (setup.mode === 'hotseat') {
      const d2 = s.decks[1] || s.decks[0];
      oppCards = d2.cards.map((c) => ({ ...c, level: (s.collection[c.cardId] || {}).level || 1, choices: (s.collection[c.cardId] || {}).choices || {} }));
      oppName = 'Player 2 (' + d2.name + ')';
    } else {
      const diff = setup.difficulty != null ? setup.difficulty : 1;
      const seedRng = (() => { let x = Date.now() % 100000; return () => (x = (x * 9301 + 49297) % 233280) / 233280; })();
      oppCards = NS.AI.buildBotDeck(seedRng, diff);
      oppName = setup.opponentName || (DIFFS[diff] + ' Bot');
      bot = diff;
    }
    const ev = setup.event ? M().EVENTS.find((e) => e.id === setup.event) : null;
    const st = E().createMatch({
      decks: [
        { name: s.profile.name, cards: playerCards, bot: null },
        { name: oppName, cards: oppCards, bot },
      ],
      seed: (Date.now() % 2147483647) >>> 0,
      mods: ev ? ev.ruleMod : {},
    });
    B.st = st; B.setup = setup; B.mode = 'placement'; B.sel = null; B.selAbility = null;
    B.handIdx = null; B.pendingCast = null; B.unitEls = {}; B.built = false;
    if (B.botTimer) { clearTimeout(B.botTimer); B.botTimer = null; }
    U.show('battle');
    $('#bt-help').onclick = () => showGlossary();
    render();
    U.toast(setup.mode === 'hotseat' ? 'Hotseat match — pass the device between turns!' : 'Place your commander on your side of the field.');
  }

  /* ---------------- rendering ---------------- */
  function render() {
    const st = B.st; if (!st) return;
    renderTop(); renderBoard(); renderUnits(); renderHand(); renderSide(); renderBanner();
  }

  function renderTop() {
    const st = B.st, p = st.active;
    const P = st.players[p], O = st.players[1 - p];
    const names = st.players.map((pl) => esc(pl.name) + (pl.bot != null ? ' <i class="muted">(' + DIFFS[pl.bot] + ')</i>' : ''));
    $('#bt-info').innerHTML = '<b>Turn ' + st.turnNo + '</b> · ' + names[p] + "'s move" +
      (st.mods.incomeBonus ? ' · <span class="evtag">EVENT: +' + st.mods.incomeBonus + ' energy</span>' : '');
    $('#bt-players').innerHTML =
      '<div class="bt-side p0"><span class="who">' + names[0] + '</span><span class="deck">⧉ ' + st.players[0].deck.length + '</span>' +
      (st.fatigue[0] ? '<span class="fatigue">☠' + st.fatigue[0] + '</span>' : '') + '</div>' +
      '<div class="bt-side p1"><span class="who">' + names[1] + '</span><span class="deck">⧉ ' + st.players[1].deck.length + '</span>' +
      (st.fatigue[1] ? '<span class="fatigue">☠' + st.fatigue[1] + '</span>' : '') + '</div>';
    $('#bt-energy').innerHTML = '<div class="orb"><span>' + P.energy + '</span><i>/' + C.energy.incomeCap + '⚡</i></div><div class="orb-sub">store ' + Math.min(P.energy, C.energy.carryCap) + ' next turn · hand ' + P.hand.length + '/' + P.maxHand + '</div>';
    $('#bt-end').disabled = st.phase !== 'main' || isBotTurn();
    $('#bt-end').textContent = isBotTurn() ? 'Opponent is playing…' : (st.phase === 'placement' ? 'Waiting for placement' : 'End turn ▶');
    $('#bt-forfeit').style.display = st.phase === 'over' ? 'none' : '';
  }

  function renderBanner() {
    const st = B.st;
    const b = $('#bt-banner');
    if (st.phase === 'placement') {
      const p = st.pendingPlacement[0];
      b.style.display = '';
      b.innerHTML = '⚑ <b>' + esc(st.players[p].name) + '</b>: place your commander (<b>' + esc(NS.CARD[E().pendingCard(st, p).cardId].name) + '</b>) on any tile of your side.';
    } else if (st.winner != null) {
      b.style.display = '';
      b.innerHTML = '★ <b>' + esc(st.players[st.winner].name) + ' wins!</b>';
    } else b.style.display = 'none';
  }

  function tileHighlightSet() {
    const st = B.st, out = { tiles: {}, units: {} };
    const p = st.active;
    if (st.phase === 'placement') {
      st.pendingPlacement.forEach((pl) => {
        for (let y = C.board.ownRows[pl][0]; y <= C.board.ownRows[pl][1]; y++) for (let x = 0; x < C.board.w; x++) {
          if (!E().unitAt(st, x, y) && !E().tileBlocked(st, x, y)) out.tiles[x + ',' + y] = 'hl-deploy';
        }
      });
      return out;
    }
    if (isBotTurn() || st.phase === 'over') return out;
    if (B.mode === 'deploy' && B.handIdx != null) {
      const hc = st.players[p].hand[B.handIdx];
      const card = NS.CARD[hc.cardId];
      if (card.type === 'spell') {
        E().spellTargets(st, hc).forEach((t) => {
          if (t.unit != null) out.units[t.unit] = 'hl-attack';
          else if (t.x != null) out.tiles[t.x + ',' + t.y] = 'hl-deploy';
        });
      } else {
        E().legalDeployTiles(st, p, hc).forEach((t) => { out.tiles[t.x + ',' + t.y] = 'hl-deploy'; });
      }
      return out;
    }
    if (B.mode === 'ability' && B.sel && B.selAbility != null) {
      const u = E().byId(st, B.sel);
      E().abilityTargets(st, u, B.selAbility).forEach((t) => {
        if (t.unit != null) out.units[t.unit] = 'hl-attack';
        else if (t.x != null) out.tiles[t.x + ',' + t.y] = 'hl-deploy';
        else if (t.none && u) out.units[u.id] = 'hl-self';
      });
      return out;
    }
    const o = E().getOptions(st);
    if (B.sel) {
      (o.moves[B.sel] || []).forEach((t) => { out.tiles[t.x + ',' + t.y] = t.ret ? 'hl-return' : 'hl-move'; });
      (o.attacks[B.sel] || []).forEach((a) => { out.units[a.target] = 'hl-attack'; });
      const u = E().byId(st, B.sel);
      if (u) out.units[u.id] = 'hl-sel';
    }
    return out;
  }

  function renderBoard() {
    const st = B.st;
    const board = $('#board');
    const hl = tileHighlightSet();
    if (!B.built) {
      board.innerHTML = '';
      const tl = el('div', 'tiles');
      for (let y = 0; y < C.board.h; y++) for (let x = 0; x < C.board.w; x++) {
        const t = el('div', 'tile');
        t.dataset.x = x; t.dataset.y = y;
        t.style.left = (x * 100 / C.board.w) + '%'; t.style.top = (y * 100 / C.board.h) + '%';
        tl.appendChild(t);
      }
      const ul = el('div', 'units'); ul.id = 'unit-layer';
      board.appendChild(tl); board.appendChild(ul);
      board.onclick = onBoardClick;
      B.built = true;
    }
    $$('#board .tile').forEach((t) => {
      const x = +t.dataset.x, y = +t.dataset.y;
      let cls = 'tile';
      if (E().ownSide(0, x, y)) cls += ' side0';
      if (E().ownSide(1, x, y)) cls += ' side1';
      const te = st.tiles.find((tf) => tf.x === x && tf.y === y);
      if (te) cls += ' te-' + te.kind;
      const h = hl.tiles[x + ',' + y];
      if (h) cls += ' ' + h;
      t.className = cls;
      t.innerHTML = te ? '<span class="te-icon">' + (te.kind === 'ember' ? '🔥' : te.kind === 'block' ? '🧊' : te.kind === 'rift' ? '🌌' : '❄') + '</span>' : '';
    });
  }

  function renderUnits() {
    const st = B.st;
    const layer = $('#unit-layer');
    const hlMap = tileHighlightSet().units;
    const seen = {};
    st.units.forEach((u) => {
      if (u.hp <= 0 && u.kind !== 'commander') return;
      if (u.hp <= 0 && u.kind === 'commander' && !u.fallen) return;
      seen[u.id] = true;
      let d = B.unitEls[u.id];
      if (!d) {
        d = el('div', 'unit');
        d.dataset.uid = u.id;
        d.addEventListener('contextmenu', (ev) => { ev.preventDefault(); inspectUnit(u.id); });
        let lpT = null;
        d.addEventListener('touchstart', () => { lpT = setTimeout(() => { lpT = null; B.lpAt = Date.now(); inspectUnit(u.id); }, 450); }, { passive: true });
        const cancelLp = () => { if (lpT) { clearTimeout(lpT); lpT = null; } };
        d.addEventListener('touchend', cancelLp);
        d.addEventListener('touchmove', cancelLp);
        layer.appendChild(d);
        B.unitEls[u.id] = d;
      }
      const w = (u.size ? u.size.w * 100 / C.board.w : 100 / C.board.w);
      const h = (u.size ? u.size.h * 100 / C.board.h : 100 / C.board.h);
      d.style.width = w + '%'; d.style.height = h + '%';
      d.style.left = (u.x * 100 / C.board.w) + '%'; d.style.top = (u.y * 100 / C.board.h) + '%';
      let cls = 'unit p' + u.owner + ' k-' + u.kind;
      if (u.fallen) cls += ' fallen';
      if (u.token) cls += ' token';
      if (B.sel === u.id) cls += ' selected';
      const hl = hlMap[u.id];
      if (hl) cls += ' ' + hl;
      if (u.statuses.some((x) => x.status === 'frozen')) cls += ' frozen';
      d.className = cls;
      const shield = u.statuses.find((x) => x.status === 'shielded');
      d.innerHTML =
        '<div class="u-art">' + U.art(u.cardId || 'spark', { color: u.owner === 0 ? '#7ec2ff' : '#e08ac2' }) + '</div>' +
        '<div class="u-badge">' + (u.kind === 'commander' ? '♛' : u.kind === 'base' ? '⌂' : u.kind === 'structure' ? '⌗' : '') + '</div>' +
        '<div class="u-stats">' +
        (u.kind === 'unit' || u.kind === 'commander' ? '<span class="u-atk">' + E().statOf(st, u, 'atk') + '</span>' : '') +
        '<span class="u-hp">' + u.hp + '</span>' +
        (u.kind === 'unit' || u.kind === 'commander' ? '<span class="u-def">' + E().statOf(st, u, 'def') + '</span>' : '') +
        '</div>' +
        '<div class="u-hpbar"><i style="width:' + Math.max(0, (u.hp / u.maxHp) * 100) + '%"></i>' +
        (shield ? '<b style="width:' + Math.min(100, (shield.power / Math.max(1, u.maxHp)) * 100) + '%"></b>' : '') + '</div>' +
        (u.statuses.length ? '<div class="u-st">' + u.statuses.map((x) => '<i title="' + x.status + '">' + (NS.Engine.STATUS[x.status] ? NS.Engine.STATUS[x.status].icon : '◆') + '</i>').join('') + '</div>' : '') +
        '<div class="u-name">' + esc(u.name) + '</div>';
      d.title = u.name + ' — HP ' + u.hp + '/' + u.maxHp +
        (u.kind === 'unit' || u.kind === 'commander' ? ' · ATK ' + E().statOf(st, u, 'atk') + ' · DEF ' + E().statOf(st, u, 'def') : '') +
        ' (tap & hold or right-click for full details)';
    });
    Object.keys(B.unitEls).forEach((id) => { if (!seen[id]) { B.unitEls[id].remove(); delete B.unitEls[id]; } });
  }

  function renderHand() {
    const st = B.st;
    const hand = $('#bt-hand');
    hand.innerHTML = '';
    if (st.phase === 'placement' || st.winner != null) { hand.innerHTML = '<div class="hand-hint">— battlefield phase —</div>'; return; }
    const p = st.active;
    if (isBotTurn()) { hand.innerHTML = '<div class="hand-hint">opponent playing…</div>'; return; }
    st.players[p].hand.forEach((hc, i) => {
      const card = NS.CARD[hc.cardId];
      const cost = card.type === 'spell' ? card.cost : E().deployCost(st, p, hc, 5, p === 0 ? 8 : 2);
      const canAfford = st.players[p].energy >= cost;
      const d = U.cardEl(hc.cardId, { cls: 'hand-card ' + (B.handIdx === i ? 'chosen' : '') + (canAfford ? '' : ' unaffordable') });
      d.dataset.idx = i;
      d.onclick = () => {
        if (isBotTurn()) return;
        if (B.handIdx === i) { B.handIdx = null; B.mode = 'idle'; }
        else { B.handIdx = i; B.sel = null; B.selAbility = null; B.mode = 'deploy'; U.sfx('click'); }
        render();
      };
      hand.appendChild(d);
    });
  }

  function renderSide() {
    const st = B.st;
    const side = $('#bt-side');
    side.innerHTML = '';
    if (B.mode === 'deploy' && B.handIdx != null) {
      const p = st.active, hc = st.players[p].hand[B.handIdx];
      const card = NS.CARD[hc.cardId];
      const box = el('div', 'side-box');
      box.innerHTML = '<h4>Playing: ' + esc(card.name) + '</h4><p class="muted">' + esc(card.desc) + '</p>' +
        (card.type === 'spell' && card.targeting === 'none' ? '<button class="btn primary" id="cast-now">Cast spell</button>' : '<p class="muted">Choose a highlighted ' + (card.type === 'spell' ? 'target' : 'tile on your side') + '.</p>');
      side.appendChild(box);
      const castNow = $('#cast-now', box);
      if (castNow) castNow.onclick = () => doAction({ t: 'deploy', handIdx: B.handIdx, targets: {} });
      return;
    }
    if (B.sel) {
      const u = E().byId(st, B.sel);
      if (u && st.units.includes(u)) {
        const o = E().getOptions(st) || { moves: {}, attacks: {}, abilities: {}, recover: [], deploys: [], spells: [] };
        const box = el('div', 'side-box');
        box.innerHTML = '<h4>' + esc(u.name) + (u.fallen ? ' — FALLEN' : '') + '</h4>' +
          '<div class="sel-stats">' +
          '<span>HP ' + u.hp + '/' + u.maxHp + '</span>' +
          (u.kind === 'unit' || u.kind === 'commander' ? '<span>ATK ' + E().statOf(st, u, 'atk') + '</span><span>DEF ' + E().statOf(st, u, 'def') + '</span><span>MOV ' + E().statOf(st, u, 'mv') + '</span><span>◎ ' + (u.pattern === 'cleave' ? 'all adjacent' : u.pattern + ' ' + (u.rng[0] === u.rng[1] ? u.rng[0] : u.rng[0] + '-' + u.rng[1]) + (u.los ? '' : ' (no LOS)')) + '</span>' : '') +
          '</div>' +
          (u.statuses.length ? '<div class="sel-st">' + u.statuses.map((x) => '<span class="stat-tag">' + esc(NS.Engine.STATUS[x.status] ? NS.Engine.STATUS[x.status].name : x.status) + (x.power ? ' ' + x.power : '') + ' (' + x.dur + 't)</span>').join('') + '</div>' : '');
        const acts = el('div', 'side-acts');
        if (!isBotTurn() && !u.fallen && u.owner === st.active && st.phase === 'main') {
          const canAttack = (o.attacks[u.id] || []).length > 0;
          const canMove = (o.moves[u.id] || []).length > 0;
          const btnA = el('button', 'btn small' + (canAttack ? '' : ' dim'), 'Attack' + (canAttack ? ' (1⚡)' : ' — no targets'));
          btnA.disabled = !canAttack;
          btnA.onclick = () => { U.sfx('click'); B.mode = 'unit'; toastSide('Click a highlighted enemy to attack.'); render(); };
          const btnM = el('button', 'btn small' + (canMove ? '' : ' dim'), canMove ? 'Move' : (E().legalMoves(st, u.id).length ? 'Moved ✓' : 'Cannot move'));
          btnM.disabled = !canMove;
          btnM.onclick = () => { U.sfx('click'); B.mode = 'unit'; toastSide('Click a highlighted tile to move.'); render(); };
          acts.appendChild(btnA); acts.appendChild(btnM);
          (u.abilities || []).forEach((a, i) => {
            const sUse = u.abilityUses[i];
            const usable = sUse.usesLeft > 0 && sUse.cdLeft <= 0 && (sUse.matchLeft == null || sUse.matchLeft > 0) && st.players[u.owner].energy >= a.cost && !u.statuses.some((x) => x.status === 'frozen' || x.status === 'stunned');
            const b = el('button', 'btn small' + (usable ? '' : ' dim'), a.name + ' (' + a.cost + '⚡' + (sUse.cdLeft > 0 ? ' · cd ' + sUse.cdLeft : '') + (sUse.matchLeft != null ? ' · ' + sUse.matchLeft + ' left' : '') + ')');
            b.disabled = !usable;
            b.onclick = () => { B.selAbility = i; B.mode = 'ability'; U.sfx('click'); render(); };
            acts.appendChild(b);
          });
          if (E().canRecover(st, u.id)) {
            const b = el('button', 'btn small star', 'Recover to 50% (' + C.energy.recoverCost + '⚡)');
            b.onclick = () => doAction({ t: 'recover', unit: u.id });
            acts.appendChild(b);
            toastSide('Wounded unit adjacent to your commander — recover or retreat.');
          }
        }
        box.appendChild(acts);
        side.appendChild(box);
      }
    } else if (st.phase === 'main' && !isBotTurn()) {
      const o = E().getOptions(st);
      const box = el('div', 'side-box');
      box.innerHTML = '<h4>Your options</h4>' +
        '<p class="muted">Select a unit to move/attack, or a card from your hand to deploy. Attacks cost ' + C.energy.attackCost + '⚡. Unused energy carries over (max ' + C.energy.carryCap + ').</p>' +
        '<div class="opt-counts">' + Object.keys(o.moves).length + ' movable · ' + Object.keys(o.attacks).length + ' attackers · ' + o.deploys.length + ' deployable cards</div>';
      side.appendChild(box);
    }
    // battle log
    const logBox = el('div', 'side-log');
    logBox.innerHTML = '<h4>Battle log</h4>';
    const ul = el('div', 'log-lines');
    ul.innerHTML = st.log.slice(-14).map((l) => '<div class="log-line">' + esc(l.text) + '</div>').join('');
    logBox.appendChild(ul);
    side.appendChild(logBox);
  }
  function toastSide(msg) { const t = $('#bt-hint'); if (t) { t.textContent = msg; t.style.display = ''; clearTimeout(t._h); t._h = setTimeout(() => { t.style.display = 'none'; }, 2600); } }

  /* ---------------- interaction ---------------- */
  function isBotTurn() {
    const st = B.st;
    return st && st.players[st.active].bot != null && st.winner == null;
  }
  function onBoardClick(e) {
    const st = B.st;
    if (st.winner != null || st.phase === 'over') return;
    const tile = e.target.closest('.tile');
    const unitEl = e.target.closest('.unit');
    if (unitEl) {
      const uid = unitEl.dataset.uid;
      onUnitClick(uid);
      return;
    }
    if (!tile) return;
    const x = +tile.dataset.x, y = +tile.dataset.y;
    if (isBotTurn()) return;
    const p = st.active;
    if (st.phase === 'placement') {
      const pl = st.pendingPlacement[0];
      if (pl == null || st.players[pl].bot != null) return; // bots place themselves
      E().applyAction(st, { t: 'placeCmd', player: pl, x, y });
      U.sfx('deploy');
      B.mode = 'idle';
      render();
      maybeBotAct();
      return;
    }
    if (B.mode === 'deploy' && B.handIdx != null) {
      doAction({ t: 'deploy', handIdx: B.handIdx, x, y, targets: { x, y } });
      return;
    }
    if (B.mode === 'ability' && B.sel && B.selAbility != null) {
      doAction({ t: 'ability', unit: B.sel, ai: B.selAbility, targets: { x, y } });
      return;
    }
    if (B.sel) {
      doAction({ t: 'move', unit: B.sel, x, y });
      return;
    }
  }
  function onUnitClick(uid) {
    const st = B.st;
    const u = E().byId(st, uid);
    if (!u) return;
    if (B.lpAt && Date.now() - B.lpAt < 600) { B.lpAt = 0; return; } // long-press just opened the inspector
    if (isBotTurn()) { inspectUnit(uid); return; } // inspecting the opponent is always allowed
    const p = st.active;
    if (st.phase === 'placement') { inspectUnit(uid); return; }
    if (B.mode === 'deploy' && B.handIdx != null) {
      doAction({ t: 'deploy', handIdx: B.handIdx, targets: { unit: uid } });
      return;
    }
    if (B.mode === 'ability' && B.sel && B.selAbility != null) {
      doAction({ t: 'ability', unit: B.sel, ai: B.selAbility, targets: { unit: uid } });
      return;
    }
    if (u.owner !== p) {
      if (B.sel) doAction({ t: 'attack', unit: B.sel, target: uid });
      else inspectUnit(uid); // nothing selected → tapping an enemy just explains it
      return;
    }
    if (B.sel === uid) { B.sel = null; B.mode = 'idle'; render(); return; }
    B.sel = uid; B.selAbility = null; B.mode = 'unit';
    U.sfx('click');
    render();
  }
  function doAction(act) {
    const st = B.st;
    const r = E().applyAction(st, act);
    if (!r.ok) { U.toast(r.error, 'bad'); U.sfx('error'); B.mode = 'idle'; render(); return; }
    animate(r.events || []);
    B.handIdx = null; B.selAbility = null; B.mode = 'idle';
    if (act.t === 'attack') U.sfx('hit');
    else if (act.t === 'deploy' || act.t === 'move') U.sfx(act.t === 'deploy' ? 'deploy' : 'click');
    B.sel = null;
    render();
    if (st.winner != null) { onVictory(); return; }
    if (act.t === 'end') maybeBotAct();
    else if (isBotTurn()) maybeBotAct();
  }

  /* ---------------- inspect: what does this piece do? ---------------- */
  function inspectUnit(uid) {
    const st = B.st;
    const u = E().byId(st, uid);
    if (!u) return;
    const card = u.cardId ? NS.CARD[u.cardId] : null;
    const color = u.owner === 0 ? '#7ec2ff' : '#e08ac2';
    const who = esc(st.players[u.owner].name) + (u.owner === 0 ? ' — yours' : ' — opponent');
    const c = el('div', 'card-detail insp');
    let html =
      '<div class="card-top"><span class="cost">' + (card ? card.cost : '—') + '</span><span class="cname">' + esc(u.name) + '</span></div>' +
      '<div class="card-art">' + U.art(u.cardId || 'spark', { color }) + '</div>' +
      '<div class="insp-owner">' + who + '</div>';
    if (u.kind === 'base') {
      html += '<div class="sel-stats"><span>HP ' + u.hp + '/' + u.maxHp + '</span></div>' +
        '<div class="card-desc">A Main Base. It cannot move or attack — if it is destroyed, its owner loses the match.</div>';
    } else {
      const combat = u.kind === 'unit' || u.kind === 'commander';
      html += '<div class="sel-stats"><span>HP ' + u.hp + '/' + u.maxHp + '</span>' +
        (combat ? '<span>ATK ' + E().statOf(st, u, 'atk') + '</span><span>DEF ' + E().statOf(st, u, 'def') + '</span><span>MOV ' + E().statOf(st, u, 'mv') + '</span>' +
        '<span>◎ ' + (u.pattern === 'cleave' ? 'cleave — hits ALL adjacent enemies' : u.pattern + ' attack, ' + (u.rng[0] === u.rng[1] ? u.rng[0] : u.rng[0] + '–' + u.rng[1]) + ' sq' + (u.los ? '' : ', ignores line of sight')) + '</span>' : '') +
        '</div>';
      html += '<div class="card-desc">' + esc(card ? card.desc : (u.token ? 'Summoned token.' : 'Battlefield piece.')) + '</div>';
      (u.abilities || []).forEach((a, i) => {
        const live = (u.abilityUses || {})[i];
        html += '<div class="insp-ab"><b>' + esc(a.name) + '</b> — ' + a.cost + '⚡ per use' +
          (live ? ' · ' + live.usesLeft + ' use' + (live.usesLeft === 1 ? '' : 's') + ' left this match' + (live.cdLeft > 0 ? ' · ready in ' + live.cdLeft + ' turn' + (live.cdLeft === 1 ? '' : 's') : '') : '') +
          (a.desc ? '<br>' + esc(a.desc) : '') + '</div>';
      });
      if (u.counter) html += '<div class="insp-ab"><b>Counterattack</b><br>Strikes back when an enemy attacks it.</div>';
    }
    if (u.statuses.length) {
      html += '<div class="sel-st">' + u.statuses.map((x) => {
        const S = NS.Engine.STATUS[x.status];
        return '<span class="stat-tag">' + (S ? S.icon + ' ' + esc(S.name) : esc(x.status)) + (x.power ? ' ' + x.power : '') + ' (' + x.dur + 't)</span>' +
          '<span class="insp-help">' + esc(STATUS_HELP[x.status] || '') + '</span>';
      }).join('<br>') + '</div>';
    }
    html += '<p class="muted insp-tip">Tip: tap & hold (or right-click) any piece on the field to open this panel — including the opponent\'s.</p>';
    c.innerHTML = html;
    U.modal(c);
  }

  /* ---------------- guide: what does any move do? ---------------- */
  function showGlossary() {
    const item = (k, v) => '<div class="gloss-item"><span class="gi">' + k + '</span><span>' + v + '</span></div>';
    const c = el('div', 'card-detail gloss');
    let html = '<h3>How to play — what every move does</h3>';
    html += '<h4>Your turn</h4>';
    html += item('⚡ Energy', 'You gain ' + C.energy.incomeBase + ' energy + ' + C.energy.incomeGrowth + ' per turn taken (max ' + C.energy.incomeCap + '/turn). Up to ' + C.energy.carryCap + ' unused energy carries over to your next turn.');
    html += item('Select', 'Tap one of your pieces. Blue tiles = where it can move; enemies glowing red are in attack range.');
    html += item('Move', 'With a piece selected, tap a blue tile. One move per turn.');
    html += item('Attack', 'With a piece selected, tap a red-glowing enemy. Each attack costs ' + C.energy.attackCost + '⚡. Range and attack pattern are shown on every piece.');
    html += item('Deploy', 'Tap a card in your hand, then a yellow-highlighted tile on your side. Costs the card\'s ⚡ cost shown on it.');
    html += item('Ability', 'Select a piece — its ability buttons appear in the side panel. Each has an energy cost, limited uses per match, and a cooldown.');
    html += item('Recover', 'A wounded unit standing next to your commander can be healed to ' + Math.round(C.energy.recoverTo * 100) + '% HP for ' + C.energy.recoverCost + '⚡.');
    html += item('End turn', 'You draw a card. If your hand is full the draw is lost; if your deck is empty, failed draws deal lethal fatigue — keep an eye on the ☠ counter.');
    html += '<h4>Winning</h4>';
    html += item('★', 'Destroy the enemy <b>Main Base</b>, or defeat <b>all of their commanders</b>.');
    html += '<h4>Combat details</h4>';
    html += item('DEF', 'Defense subtracts from incoming damage (minimum 1 gets through). Some effects pierce DEF; shields absorb damage first.');
    html += item('LOS', 'Attacks need a clear line between attacker and target — any piece standing in the way blocks it. Pieces marked "ignores line of sight" shoot over heads.');
    html += item('Cleave', 'Cleave pieces hit every adjacent enemy at once.');
    html += item('Counter', 'Pieces with Counterattack strike back when attacked.');
    html += '<h4>Tiles</h4>';
    html += item('🔥 Ember', 'Standing here burns for 1 damage (ignores DEF) at your turn start.');
    html += item('🌌 Rift', 'Enemies standing here take 2 damage at their turn start.');
    html += item('🧊 Wall', 'Impassable barrier — pieces cannot enter or cross it.');
    html += '<h4>Statuses</h4>';
    html += item('Icons', '🔥 Burning · ☠ Poison · ❄ Frozen · ✷ Stunned · ⛨ Shield · 🐌 Slowed · ⚡ Hasted · ↑ Empowered · ✚ Regen — tap & hold any piece to see exactly what afflicts it and for how long.');
    html += '<h4>Legend</h4>';
    html += item('Colors', 'Blue tiles = move · Yellow tiles = deploy · Red glow = attack target · Gold ring = selected · Green tiles = retreat/return squares.');
    html += '<p class="muted insp-tip">The opponent\'s pieces work the same way — inspect them before you walk into their range.</p>';
    c.innerHTML = html;
    U.modal(c);
  }

  /* ---------------- animations ---------------- */
  function animate(events) {
    const st = B.st;
    events.forEach((e2) => {
      if (e2.t === 'damage' || e2.t === 'heal') {
        const d = B.unitEls[e2.unit];
        if (d) {
          const pop = el('span', 'dmg-pop ' + (e2.t === 'heal' ? 'heal' : ''), (e2.t === 'heal' ? '+' : '-') + e2.amount);
          d.appendChild(pop);
          d.classList.add('shake');
          setTimeout(() => { pop.remove(); d.classList.remove('shake'); }, 700);
        }
      }
      if (e2.t === 'fallen' || e2.t === 'death') {
        const d = B.unitEls[e2.unit];
        if (d) d.classList.add('dying');
      }
      if (e2.t === 'fatigue') U.toast('FATIGUE ' + e2.amount + '! The deck is exhausted.', 'bad');
      if (e2.t === 'victory') void e2;
    });
  }

  /* ---------------- bot driver ---------------- */
  function maybeBotAct() {
    const st = B.st;
    if (st.winner != null) return;
    if (st.phase === 'placement' && st.pendingPlacement.some((p) => st.players[p].bot != null)) {
      B.botTimer = setTimeout(() => {
        st.pendingPlacement.filter((p) => st.players[p].bot != null).forEach((p) => NS.AI.aiPlaceCommander(st, p));
        render();
        U.toast('Opponent placed their commander.');
        if (st.phase === 'main' && isBotTurn()) botLoop();
      }, 600);
      return;
    }
    if (isBotTurn()) botLoop();
  }
  function botLoop() {
    const st = B.st;
    const p = st.active;
    const diff = st.players[p].bot;
    const step = () => {
      if (st.winner != null || st.active !== p) { render(); if (st.winner != null) onVictory(); return; }
      const act = NS.AI.chooseAction(st, p, diff);
      const r = E().applyAction(st, act);
      if (!r.ok) { E().applyAction(st, { t: 'end' }); render(); return; }
      animate(r.events || []);
      if (act.t === 'attack') U.sfx('hit');
      render();
      if (st.winner != null) { onVictory(); return; }
      if (act.t === 'end') return;
      B.botTimer = setTimeout(step, 460);
    };
    B.botTimer = setTimeout(step, 500);
  }

  /* ---------------- victory & rewards ---------------- */
  function onVictory() {
    const st = B.st, s = M().get();
    const setup = B.setup;
    const reason = (st.log.slice().reverse().find((l) => l.text.startsWith('VICTORY')) || {}).text || '';
    const playerWon = st.winner === 0;
    let rewards = null, ups = [], ach = [];
    if (setup.mode === 'bot') {
      rewards = M().battleRewards(setup.difficulty != null ? setup.difficulty : 1, playerWon, s);
      ups = M().gainRewards(s, rewards);
      ach = M().checkAchievements(s);
      if (setup.tournament) {
        M()[playerWon ? 'tournamentWin' : 'tournamentLoss'](s);
      }
    }
    M().persist();
    U.sfx(playerWon ? 'fanfare' : 'error');
    const box = el('div', 'victory-box ' + (playerWon ? 'won' : 'lost'));
    box.innerHTML = '<h2>' + (playerWon ? 'VICTORY' : 'DEFEAT') + '</h2><p class="vreason">' + esc(reason.replace('VICTORY: ' + st.players[st.winner].name + ' — ', '')) + '</p>' +
      '<div class="vconds"><span class="' + (st.winner != null ? '' : '') + '">Victory conditions: commander elimination · base destruction · deck exhaustion (fatigue)</span></div>';
    if (rewards) {
      box.innerHTML += '<div class="vrewards">' +
        '<span class="cur coins">+' + rewards.coins + '⬤' + (rewards.event > 1 ? ' <i class="muted">(event ×' + rewards.event + ')</i>' : '') + '</span>' +
        '<span class="cur credits">+' + rewards.credits + '◈</span>' +
        '<span class="cur xp">+' + rewards.xp + ' XP</span></div>';
      ups.forEach((u) => { box.innerHTML += '<div class="lvlup">▲ Account level ' + u.level + '!' + (u.unlock ? ' Unlocked: ' + esc(u.unlock) : '') + '</div>'; });
      ach.forEach((a) => { box.innerHTML += '<div class="achup">★ Achievement: ' + esc(a.name) + ' — ' + esc(a.reward.label) + '</div>'; });
      if (setup.tournament) {
        const t = s.tournament;
        box.innerHTML += '<div class="tourn-note">' + (t.done ? (t.champion ? '👑 TOURNAMENT CHAMPION! Crowned avatar unlocked.' : 'Tournament over — you were eliminated.') : 'Advancing to the FINAL.') + '</div>';
      }
    } else {
      box.innerHTML += '<p class="muted">Hotseat match — no rewards in local play.</p>';
    }
    const row = el('div', 'btnrow');
    const again = el('button', 'btn', 'Rematch');
    again.onclick = () => { box.closest('.modal-back').remove(); open(B.setup); };
    const back = el('button', 'btn primary', playerWon && setup.tournament ? 'Continue tournament' : 'Back to menu');
    back.onclick = () => { box.closest('.modal-back').remove(); U.show(setup.tournament ? 'tournament' : 'menu'); };
    row.appendChild(again); row.appendChild(back);
    box.appendChild(row);
    U.modal(box, 'victory-modal');
    render();
  }

  function forfeit() {
    const st = B.st, s = M().get();
    U.confirmBox('Forfeit match?', 'You will receive consolation rewards as a loss.', () => {
      if (B.botTimer) clearTimeout(B.botTimer);
      if (B.setup.mode === 'bot') {
        const r = M().battleRewards(B.setup.difficulty != null ? B.setup.difficulty : 1, false, s);
        M().gainRewards(s, r);
        M().checkAchievements(s);
        M().persist();
        U.toast('+' + r.coins + '⬤ +' + r.credits + '◈ +' + r.xp + ' XP');
      }
      st.winner = 1; // forfeit: player 0 loses
      U.show('menu');
    }, 'Forfeit');
  }

  NS.Battle = { open, render, forfeit, doAction, onVictory, _B: B };
})(typeof window !== 'undefined' ? (window.CS = window.CS || {}) : (globalThis.CS = globalThis.CS || {}));
