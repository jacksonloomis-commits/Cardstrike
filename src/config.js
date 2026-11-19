/* ============================================================
   CARDSTRIKE — centralized rules & balance configuration
   Every economy number, pack price, drop rate, upgrade cost and
   battle rule knob lives here. No gameplay values hardcoded in UI.
   ============================================================ */
(function (NS) {
  'use strict';

  const CFG = {
    VERSION: 1,
    SAVE_KEY: 'cardstrike_save_v1',

    board: {
      w: 11, h: 11,
      // own-side deployment rows (inclusive). Player 0 = bottom, Player 1 = top.
      ownRows: { 0: [7, 10], 1: [0, 3] },
    },

    // Main base (victory condition 2). Auto-placed at back-edge centre.
    base: {
      hp: 25,
      name: 'Main Base',
      auraRadius: 1,
      auraDefense: 1, // friendly units adjacent to own base get +1 defense
    },

    energy: {
      incomeBase: 3,      // turn 1 income
      incomeGrowth: 1,    // +1 per own turn taken
      incomeCap: 10,      // per-turn income ceiling AND pool ceiling
      carryCap: 3,        // max unused energy carried into next turn
      attackCost: 1,      // energy per attack action
      recoverCost: 2,     // energy to heal a returned unit to 50%
      recoverTo: 0.5,     // recover target fraction of max HP
      returnThreshold: 0.15, // units below 15% HP may "return" to a commander
    },

    deck: {
      size: 35,
      maxCommanders: 2,
      startHand: 4,
      maxHand: 5,
      maxCopies: [3, 1, 1, 1, 1, 1], // by rarity index (commons 3, others 1)
      startDraw: 1,                  // start-phase draw (skipped if hand full)
    },

    rarities: ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'],
    rarityShort: ['C', 'U', 'R', 'E', 'L', 'M'],
    rarityColors: ['#9aa3b2', '#5fbf77', '#4f9cf0', '#a86ef0', '#f0b429', '#f05cd0'],

    // ---- Card packs (price / card count / rarity odds % / floor rarity index) ----
    packs: {
      basic:     { name: 'Basic Pack',     price: 100,  count: 3, odds: [70, 20, 7, 2.5, 0.45, 0.05], floor: 0, unlockLevel: 0 },
      advanced:  { name: 'Advanced Pack',  price: 240,  count: 4, odds: [55, 26, 12, 5, 1.7, 0.3],   floor: 0, unlockLevel: 2 },
      premium:   { name: 'Premium Pack',   price: 480,  count: 5, odds: [40, 27, 19, 9, 4, 1],       floor: 2, unlockLevel: 4 },
      elite:     { name: 'Elite Pack',     price: 850,  count: 5, odds: [25, 25, 25, 15, 8, 2],      floor: 3, unlockLevel: 7 },
      legendary: { name: 'Legendary Pack', price: 1500, count: 6, odds: [0, 35, 30, 20, 11, 4],      floor: 4, unlockLevel: 10 },
    },

    // ---- Duplicate conversion values (by rarity index) ----
    duplicates: {
      coins: [8, 20, 45, 90, 200, 450],
      stars: [5, 12, 25, 50, 100, 220],
    },

    // ---- Card upgrades (Credits). maxLevel 7 = 6 upgrades ----
    upgrades: {
      maxLevel: 7,
      costBase: [20, 35, 60, 100, 160, 260], // by rarity index
      costGrowth: 1.55,                       // cost(level) = base * growth^(level-1)
    },

    // ---- Battle rewards (index = bot difficulty 0..4; hotseat uses 1) ----
    rewards: {
      winCoins:   [120, 150, 180, 220, 270],
      winCredits: [30, 40, 50, 60, 75],
      winXp:      [50, 60, 70, 85, 100],
      lossCoins: 35, lossCredits: 10, lossXp: 22,
      eventCoinMult: 1.5,
    },

    // ---- Account levels (cosmetic / feature unlocks only) ----
    xp: { base: 100, growth: 60 }, // need(level) = base + growth*(level-1)
    levelUnlocks: {
      2:  { cardback: 'nebula', label: 'Card back: Nebula' },
      3:  { title: 'Adept of the Striking Hand', label: 'Title: Adept of the Striking Hand' },
      4:  { pack: 'premium', label: 'Premium Packs unlocked' },
      5:  { frame: 'gold', label: 'Card frame: Gilded' },
      7:  { pack: 'elite', label: 'Elite Packs unlocked' },
      8:  { avatar: 'wraith', label: 'Avatar: Hollow Wraith' },
      10: { pack: 'legendary', label: 'Legendary Packs unlocked' },
      12: { title: 'Grandmaster of the Grid', label: 'Title: Grandmaster of the Grid' },
    },

    // ---- Weekly reward track (by battles played this week; no daily streaks) ----
    weekly: {
      milestones: [
        { at: 1,  reward: { coins: 100 } },
        { at: 2,  reward: { credits: 40 } },
        { at: 4,  reward: { pack: 'basic' } },
        { at: 6,  reward: { coins: 200 } },
        { at: 9,  reward: { credits: 80 } },
        { at: 12, reward: { pack: 'advanced' } },
        { at: 16, reward: { coins: 400, cosmetic: { cardback: 'emberline', label: 'Card back: Emberline' } } },
      ],
    },

    // ---- Achievements: cosmetics only, never currency/cards ----
    achievements: [
      { id: 'firstblood', name: 'First Blood',      desc: 'Win your first battle.',              stat: 'wins', goal: 1,  reward: { title: 'Blooded', label: 'Title: Blooded' } },
      { id: 'veteran5',   name: 'Grid Veteran',     desc: 'Win 5 battles.',                      stat: 'wins', goal: 5,  reward: { badge: 'veteran', label: 'Badge: Grid Veteran' } },
      { id: 'veteran20',  name: 'Strike Commander', desc: 'Win 20 battles.',                     stat: 'wins', goal: 20, reward: { title: 'Strike Commander', label: 'Title: Strike Commander' } },
      { id: 'collector25', name: 'Curator',         desc: 'Own 25 unique cards.',                stat: 'uniques', goal: 25, reward: { cardback: 'archive', label: 'Card back: Archive' } },
      { id: 'collector45', name: 'Full Arsenal',    desc: 'Own 45 unique cards.',                stat: 'uniques', goal: 45, reward: { cardback: 'prismatic', label: 'Card back: Prismatic' } },
      { id: 'mythicpull', name: 'Fated Pull',       desc: 'Obtain a Mythic card.',               stat: 'mythics', goal: 1,  reward: { frame: 'mythic', label: 'Card frame: Mythic Weave' } },
      { id: 'upgrader10', name: 'Refined Edge',     desc: 'Purchase 10 card upgrades.',          stat: 'upgrades', goal: 10, reward: { title: 'Artisan of War', label: 'Title: Artisan of War' } },
      { id: 'beatexpert', name: 'Beyond Reason',    desc: 'Defeat an Expert bot.',               stat: 'expertWins', goal: 1, reward: { badge: 'beyond', label: 'Badge: Beyond Reason' } },
      { id: 'champion',   name: 'Tournament Champion', desc: 'Win a tournament.',                stat: 'tournaments', goal: 1, reward: { avatar: 'crown', label: 'Avatar: Crowned' } },
      { id: 'trader3',    name: 'Silver Tongue',    desc: 'Complete 3 trades.',                  stat: 'trades', goal: 3,  reward: { title: 'Silver Tongue', label: 'Title: Silver Tongue' } },
      { id: 'eventgoer',  name: 'Festivalgoer',     desc: 'Win an event battle.',                stat: 'eventWins', goal: 1, reward: { badge: 'ember', label: 'Badge: Emberfall' } },
      { id: 'packs20',    name: 'Unsealer',         desc: 'Open 20 packs.',                      stat: 'packs', goal: 20, reward: { frame: 'gilded2', label: 'Card frame: Double Gilt' } },
    ],

    // ---- Cosmetics catalogue (Star Points shop) ----
    cosmetics: {
      cardbacks: [
        { id: 'default',   name: 'Strike Sigil',  price: 0 },
        { id: 'nebula',    name: 'Nebula',        price: 60 },
        { id: 'emberline', name: 'Emberline',     price: 60 },
        { id: 'archive',   name: 'Archive',       price: 80 },
        { id: 'prismatic', name: 'Prismatic',     price: 120 },
        { id: 'voidweave', name: 'Voidweave',     price: 120 },
      ],
      frames: [
        { id: 'default', name: 'Standard', price: 0 },
        { id: 'gold',    name: 'Gilded',   price: 80 },
        { id: 'mythic',  name: 'Mythic Weave', price: 150 },
        { id: 'gilded2', name: 'Double Gilt', price: 100 },
      ],
      titles: [], // unlocked via achievements/levels only
      avatars: [
        { id: 'default', name: 'Striker', price: 0 },
        { id: 'wraith',  name: 'Hollow Wraith', price: 90 },
        { id: 'crown',   name: 'Crowned', price: 0 }, // tournament reward only
      ],
    },

    // ---- Trading (simulated local trade post for prototype) ----
    trade: {
      perDay: 3,
      offers: 3,
    },

    // ---- AI ----
    ai: {
      // score noise applied per difficulty (0 = plays near-optimally)
      noise: [6.0, 2.5, 0.8, 0.0],
      // how many own-action chains Expert simulates per unit before committing
      expertChainDepth: 3,
      simCap: 260,
    },

    // ---- Starter collection for a fresh account ----
    starter: {
      coins: 650, credits: 150, stars: 0,
      cards: [
        { id: 'korgath', count: 1 }, { id: 'bram', count: 1 },
        { id: 'emberling', count: 3 }, { id: 'pikeman', count: 3 }, { id: 'slinger', count: 3 },
        { id: 'scamp', count: 3 }, { id: 'acolyte', count: 3 }, { id: 'drone', count: 3 },
        { id: 'hound', count: 3 }, { id: 'sentry', count: 3 }, { id: 'wispling', count: 3 },
        { id: 'broodling', count: 2 }, { id: 'thornling', count: 2 }, { id: 'grunt', count: 2 },
        { id: 'emberhound', count: 1 }, { id: 'frostadept', count: 1 }, { id: 'bonearcher', count: 1 },
        { id: 'medic', count: 1 }, { id: 'shieldgolem', count: 1 }, { id: 'servitor', count: 1 },
        { id: 'barricade', count: 3 }, { id: 'manafont', count: 1 }, { id: 'bastion', count: 1 },
        { id: 'spark', count: 3 }, { id: 'mend', count: 3 }, { id: 'hymn', count: 3 },
        { id: 'icebolt', count: 3 }, { id: 'insight', count: 2 }, { id: 'fireball', count: 1 },
        { id: 'venom', count: 1 }, { id: 'ward', count: 1 }, { id: 'icewall', count: 1 },
        { id: 'emberfield', count: 1 }, { id: 'surge', count: 1 },
      ],
      starterDeck: 'First Strike',
    },
  };

  NS.CFG = CFG;
})(typeof window !== 'undefined' ? (window.CS = window.CS || {}) : (globalThis.CS = globalThis.CS || {}));
