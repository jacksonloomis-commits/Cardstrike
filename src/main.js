/* ============================================================
   CARDSTRIKE — boot & navigation glue.
   ============================================================ */
(function (NS) {
  'use strict';
  const U = NS.UI, M = () => NS.Meta;
  const $ = U.$, $$ = U.$$, el = U.el;

  function nav() {
    $$('[data-nav]').forEach((b) => {
      b.onclick = () => { U.sfx('click'); U.show(b.dataset.nav); };
    });
  }
  function playSetup() {
    const c = el('div', 'play-setup');
    c.innerHTML = '<h3>Choose your opponent</h3><p class="muted">Bot difficulties change real decision-making, not stats. Your active deck is used.</p>';
    const diffs = ['Easy', 'Normal', 'Hard', 'Expert'];
    const row = el('div', 'diff-grid');
    diffs.forEach((d, i) => {
      const b = el('button', 'btn diff d' + i, '<b>' + d + '</b><i>' +
        ['Random plays, attacks when possible', 'Greedy value plays', 'Full evaluation + threat awareness', 'Two-ply simulation + lethal hunting'][i] + '</i>');
      b.onclick = () => { m.close(); NS.Battle.open({ mode: 'bot', difficulty: i }); };
      row.appendChild(b);
    });
    c.appendChild(row);
    const ev = M().activeEvent();
    if (ev) {
      const eb = el('button', 'btn star', 'Event battle: ' + ev.name + ' (Normal bot, +50% coins)');
      eb.onclick = () => { m.close(); NS.Battle.open({ mode: 'bot', difficulty: 2, event: ev.id }); };
      c.appendChild(eb);
    }
    const hs = el('button', 'btn', 'Hotseat PvP — two players, one device');
    hs.onclick = () => { m.close(); NS.Battle.open({ mode: 'hotseat' }); };
    c.appendChild(hs);
    const note = el('p', 'muted', 'Note: deck exhaustion causes fatigue damage to your commanders — keep an eye on your deck count.');
    c.appendChild(note);
    const m = U.modal(c, 'wide');
  }
  function exportSave() {
    const data = JSON.stringify(M().get(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cardstrike-save.json';
    a.click();
    U.toast('Save exported.');
  }
  function importSave(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const s2 = JSON.parse(reader.result);
        if (!s2.profile || !s2.collection) throw new Error('bad save');
        M().replace(s2);
        U.toast('Save imported.');
        U.show('menu');
      } catch (e) { U.toast('Invalid save file.', 'bad'); }
    };
    reader.readAsText(file);
  }

  document.addEventListener('DOMContentLoaded', () => {
    M().load();
    nav();
    $('#btn-play').onclick = playSetup;
    U.setScreenHandlers({
      menu: U.renderMenu, collection: U.renderCollection, decks: U.renderDecks,
      packs: U.renderPacks, profile: U.renderProfile, trade: U.renderTrade,
      events: U.renderEvents, tournament: U.renderTournament,
    });
    // collection filters
    $('#col-type').onchange = (e) => { U.deckState && 0; NS.UI.colFilter.type = e.target.value; U.renderCollection(); };
    $('#col-rarity').onchange = (e) => { NS.UI.colFilter.rarity = e.target.value; U.renderCollection(); };
    $('#col-theme').onchange = (e) => { NS.UI.colFilter.theme = e.target.value; U.renderCollection(); };
    $('#col-owned').onchange = (e) => { NS.UI.colFilter.owned = e.target.checked; U.renderCollection(); };
    $('#col-q').oninput = (e) => { NS.UI.colFilter.q = e.target.value.toLowerCase(); U.renderCollection(); };
    // deck builder
    $('#deck-save').onclick = () => {
      const s = M().get();
      const r = M().saveDeck(s, U.deckState.idx, $('#deck-name').value, U.deckState.cards);
      if (r.ok) { U.deckState.dirty = false; M().persist(); U.toast('Deck saved.'); U.renderDecks(); }
      else U.toast(r.errors[0], 'bad');
    };
    $('#deck-activate').onclick = () => {
      const s = M().get();
      s.activeDeck = U.deckState.idx;
      M().persist();
      U.toast('Active deck: ' + s.decks[s.activeDeck].name);
      U.renderDecks();
    };
    $('#deck-autofill').onclick = () => {
      U.deckState.cards = M().autoDeck(M().get()).map((c) => ({ ...c }));
      U.deckState.dirty = true;
      U.toast('Deck auto-filled from your collection.');
      U.renderDecks();
    };
    $('#deck-name').oninput = (e) => { U.deckState.name = e.target.value; };
    // profile
    $('#pf-name').onchange = (e) => { M().get().profile.name = e.target.value.slice(0, 24) || 'Striker'; M().persist(); U.toast('Name updated.'); };
    $('#set-sfx').onchange = (e) => { M().get().settings.sfx = e.target.checked; M().persist(); };
    $('#set-anim').onchange = (e) => { M().get().settings.anim = e.target.checked; M().persist(); };
    $('#btn-export').onclick = exportSave;
    $('#btn-import').onclick = () => $('#file-import').click();
    $('#file-import').onchange = (e) => { if (e.target.files[0]) importSave(e.target.files[0]); };
    $('#btn-reset').onclick = () => {
      U.confirmBox('Reset progress?', 'This deletes your collection, currencies and stats permanently.', () => {
        M().replace(M().newSave());
        U.show('menu');
        U.toast('Progress reset.');
      }, 'Reset everything');
    };
    $('#bt-end').onclick = () => {
      const B = NS.Battle._B;
      if (B.st && B.st.phase === 'main' && !B.st.players[B.st.active].bot) {
        B.sel = null; B.handIdx = null; B.mode = 'idle';
        NS.Battle.doAction({ t: 'end' });
      }
    };
    $('#bt-forfeit').onclick = () => NS.Battle.forfeit();
    U.show('menu');
    if (M().get().pendingDupes.length) U.toast('You have duplicates to resolve — check the Collection.');
  });
})(typeof window !== 'undefined' ? (window.CS = window.CS || {}) : (globalThis.CS = globalThis.CS || {}));
