// Quick node smoke test of engine+ai+meta wiring (dev only)
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = __dirname;
['config.js', 'cards.js', 'engine.js', 'ai.js', 'meta.js'].forEach((f) => {
  vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f });
});
const CS = globalThis.CS;

// --- meta smoke ---
const mem = {};
CS.Meta.setStore({ get: (k) => mem[k] || null, set: (k, v) => { mem[k] = v; }, del: (k) => delete mem[k] });
const save = CS.Meta.load();
console.log('save ok, coins', save.profile.coins, 'cards owned', Object.keys(save.collection).length);
console.log('starter deck size', save.decks[0].cards.length, CS.Meta.validateDeck(save.decks[0].cards));

// --- pack smoke ---
const grants = CS.Meta.openPack(save, 'basic');
console.log('pack grants', grants.length, grants.map(g => CS.CARD[g.cardId].name).join(', '));
const res = CS.Meta.grantCards(save, grants);
console.log('grant result (dupe flags):', res.map(r => (r.dupe ? 'D:' : '+') + CS.CARD[r.cardId].id).join(' '));

// --- engine + AI smoke: bot vs bot match ---
const deckA = CS.AI.buildBotDeck(Math.random, 2);
const deckB = CS.AI.buildBotDeck(Math.random, 2);
const st = CS.Engine.createMatch({ decks: [{ name: 'A', bot: 'normal', cards: deckA }, { name: 'B', bot: 'hard', cards: deckB }], seed: 42 });
CS.Engine.applyAction(st, { t: 'placeCmd', player: 0, x: 5, y: 9 });
CS.Engine.applyAction(st, { t: 'placeCmd', player: 1, x: 5, y: 1 });
console.log('phase', st.phase, 'hand sizes', st.players.map(p => p.hand.length).join('/'));
let turns = 0, t0 = Date.now();
while (st.winner == null && turns < 80) {
  CS.AI.aiTakeTurn(st, turns % 2 === 0 ? 1 : 2);
  turns++;
}
console.log('bot-vs-bot finished in', turns, 'turns,', (Date.now() - t0) + 'ms, winner', st.winner, st.winner != null ? '(' + st.players[st.winner].name + ')' : '');
console.log('last log:', st.log.slice(-3).map(l => l.text).join(' | '));
console.log('SMOKE OK');
