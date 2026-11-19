/* ============================================================
   CARDSTRIKE — card database (data-driven).
   Adding a new card = adding one object here. The engine reads
   effect descriptors; no card logic is hardcoded in UI/engine.
   ============================================================ */
(function (NS) {
  'use strict';
  const C = NS.CFG;

  // Effect op vocabulary (interpreted by engine):
  //  damage {amount, targets, radius?, pierce?}   heal {amount, targets}
  //  status {status, power, dur, targets}         shield {amount, targets}
  //  tile {kind, dur, area}                       draw {n}
  //  energy {amount}                              income {amount, turns}
  //  maxHand {amount}                             summon {token, count}
  //  destroy {maxHp?}                             buffTemp {atk, def, dur, targets}
  //  refresh {what, targets}                      teleport {range}
  //  transform {into}
  // targets: 'target' | 'self' | 'adjacentEnemiesOfSelf' | 'adjacentAlliesOfSelf'
  //        | 'allEnemyUnits' | 'allFriendlyUnits' | 'allFriendlyCommanders'
  //        | 'randomEnemyNearTarget' | 'enemiesNearTarget' | 'adjacentOfTarget'
  const D = [];

  function card(o) {
    o.rng = o.rng || [1, 1];
    o.pattern = o.pattern || 'melee';
    D.push(o);
  }
  function cmdr(o) { o.type = 'commander'; card(o); }
  function unit(o) { o.type = 'unit'; card(o); }
  function spell(o) { o.type = 'spell'; card(o); }
  function struct(o) { o.type = 'structure'; card(o); }

  /* ---------------- COMMANDERS (deployed at match start) ---------------- */
  cmdr({ id: 'bram', name: 'Sgt. Bram Holt', rarity: 0, cost: 0, theme: 'legion', motif: 'spear',
    hp: 26, atk: 4, def: 1, mv: 1, desc: 'Legion line sergeant. Keeps the front moving.',
    abilities: [{ name: 'Rally', cost: 1, cd: 0, uses: 1, targeting: 'adjacentAlliesOfSelf',
      effects: [{ op: 'refresh', what: 'move', targets: 'target' }], desc: 'Target adjacent ally may move again this turn.' }],
    growth: { hp: 2 }, flavor: '“Hold the line — then take theirs.”' });

  cmdr({ id: 'korgath', name: 'Korgath Bonebreaker', rarity: 2, cost: 0, theme: 'horde', motif: 'skull',
    hp: 28, atk: 6, def: 0, mv: 1, desc: 'Warlord of the Bone Plains.',
    abilities: [{ name: 'War Cry', cost: 2, cd: 2, uses: 1, targeting: 'self',
      effects: [{ op: 'buffTemp', atk: 2, def: 0, dur: 1, targets: 'adjacentAlliesOfSelf' }], desc: 'Adjacent allies get +2 attack this turn.' }],
    growth: { hp: 2 }, flavor: '“Bones break. Wills do not.”' });

  cmdr({ id: 'maerwyn', name: 'Maerwyn of the Verdant', rarity: 2, cost: 0, theme: 'verdant', motif: 'leaf',
    hp: 27, atk: 4, def: 1, mv: 1, desc: 'Warden of the deep groves.',
    abilities: [{ name: 'Verdant Blessing', cost: 2, cd: 1, uses: 1, targeting: 'adjacentAlliesOfSelf',
      effects: [{ op: 'heal', amount: 6, targets: 'target' }], desc: 'Heal an adjacent ally for 6.' }],
    growth: { hp: 2 }, flavor: '“The grove remembers every wound.”' });

  cmdr({ id: 'vaelric', name: 'Vaelric, the Dawnward', rarity: 3, cost: 0, theme: 'arcane', motif: 'crown',
    hp: 26, atk: 5, def: 1, mv: 1, desc: 'His aura hardens the faithful.',
    passive: [{ op: 'auraAdj', stat: 'def', amount: 1 }],
    abilities: [{ name: 'Radiant Smite', cost: 2, cd: 1, uses: 1, targeting: 'adjacentEnemiesOfSelf',
      effects: [{ op: 'damage', amount: 3, targets: 'target' }], desc: 'Deal 3 to an adjacent enemy.' }],
    growth: { hp: 2 }, flavor: '“Dawn does not negotiate.”' });

  cmdr({ id: 'halcyon', name: "Unit-07 'Halcyon'", rarity: 3, cost: 0, theme: 'custodes', motif: 'mech',
    hp: 24, atk: 5, def: 1, mv: 1, desc: 'Prototype frame, hand-finished.',
    passive: [{ op: 'reduceDamage', amount: 1 }],
    abilities: [{ name: 'Overclock', cost: 2, cd: 3, uses: 1, targeting: 'self',
      effects: [{ op: 'refresh', what: 'all', targets: 'self' }], desc: 'Refresh Halcyon: move and act again this turn.' }],
    growth: { hp: 2 }, flavor: '“Calm is a weapons system.”' });

  cmdr({ id: 'nyx', name: 'Nyx, the Hollow Queen', rarity: 3, cost: 0, theme: 'horde', motif: 'spider',
    hp: 26, atk: 5, def: 0, mv: 1, desc: 'Cold radiates from her court.',
    passive: [{ op: 'enemyStartDamage', amount: 2, radius: 1 }],
    abilities: [{ name: 'Siphon', cost: 2, cd: 1, uses: 1, targeting: 'adjacentEnemiesOfSelf',
      effects: [{ op: 'damage', amount: 3, targets: 'target' }, { op: 'heal', amount: 3, targets: 'self' }], desc: 'Deal 3 to an adjacent enemy; heal Nyx for 3.' }],
    growth: { hp: 2 }, flavor: '“Everything hollows, given time.”' });

  cmdr({ id: 'zeraxim', name: 'Archon Zeraxim', rarity: 4, cost: 0, theme: 'arcane', motif: 'orb',
    hp: 25, atk: 5, def: 0, mv: 1, desc: 'A living battery of the Ley Line.',
    passive: [{ op: 'incomeBonus', amount: 1 }],
    abilities: [{ name: 'Rift Step', cost: 1, cd: 2, uses: 1, targeting: 'self',
      effects: [{ op: 'teleport', range: 3, targets: 'self' }], desc: 'Teleport to an empty tile within 3 squares (pathless).' }],
    growth: { hp: 2 }, flavor: '“Distance is a superstition.”' });

  cmdr({ id: 'grom', name: 'Warden Grom Ironclad', rarity: 4, cost: 0, theme: 'custodes', motif: 'shield',
    hp: 30, atk: 4, def: 2, mv: 1, desc: 'Mends plating mid-fight.',
    passive: [{ op: 'regenerate', amount: 1 }],
    abilities: [{ name: 'Shield Bash', cost: 1, cd: 1, uses: 1, targeting: 'adjacentEnemiesOfSelf',
      effects: [{ op: 'damage', amount: 2, targets: 'target' }, { op: 'status', status: 'stunned', power: 0, dur: 1, targets: 'target' }], desc: 'Deal 2 to an adjacent enemy and Stun it for 1 turn.' }],
    growth: { hp: 2 }, flavor: '“The wall also hits back.”' });

  /* ---------------- UNITS — COMMON ---------------- */
  unit({ id: 'emberling', name: 'Emberling', rarity: 0, cost: 1, theme: 'verdant', motif: 'flame',
    hp: 3, atk: 2, mv: 2, desc: 'Its bites smoulder.',
    passive: [{ op: 'onHitStatus', status: 'burning', power: 1, dur: 2 }],
    growth: { atk: 1, hp: 1 }, growthChoice: { atk: 1, hp: 2 }, flavor: 'Kindling with ambition.' });

  unit({ id: 'pikeman', name: 'Pikeman', rarity: 0, cost: 2, theme: 'legion', motif: 'spear',
    hp: 6, atk: 2, def: 1, mv: 2, counter: 'melee', desc: 'Counterattacks melee attackers.',
    growth: { hp: 1 }, flavor: 'Cheap. Numerous. Pointy.' });

  unit({ id: 'slinger', name: 'Stone Slinger', rarity: 0, cost: 2, theme: 'neutral', motif: 'sling',
    hp: 4, atk: 2, mv: 2, pattern: 'ortho', rng: [2, 2], desc: 'Ranged attack along straight rows/columns (range 2, needs line of sight).',
    growth: { atk: 1, hp: 1 }, flavor: 'Geometry is a weapon.' });

  unit({ id: 'scamp', name: 'Rift Scamp', rarity: 0, cost: 1, theme: 'arcane', motif: 'orb',
    hp: 3, atk: 1, mv: 3, desc: 'Fast, fragile, everywhere.',
    growth: { hp: 1 }, flavor: 'Borrowed from somewhere else.' });

  unit({ id: 'acolyte', name: 'Grave Acolyte', rarity: 0, cost: 2, theme: 'horde', motif: 'skull',
    hp: 4, atk: 2, mv: 2, desc: 'Deathrattle: deal 2 to adjacent enemies.',
    passive: [{ op: 'onDeathDamage', amount: 2, radius: 1 }],
    growth: { hp: 1 }, flavor: 'Dying is the job description.' });

  unit({ id: 'drone', name: 'Scrap Drone', rarity: 0, cost: 2, theme: 'custodes', motif: 'mech',
    hp: 3, atk: 2, mv: 3, desc: 'Cheap, quick recon frame.',
    growth: { atk: 1, hp: 1 }, flavor: 'Salvage with opinions.' });

  unit({ id: 'hound', name: 'Vault Hound', rarity: 0, cost: 2, theme: 'neutral', motif: 'fang',
    hp: 5, atk: 3, mv: 3, pattern: 'diag', rng: [1, 1], desc: 'Can only attack diagonally.',
    growth: { atk: 1, hp: 1 }, flavor: 'Corners are its territory.' });

  unit({ id: 'sentry', name: 'Vault Sentry', rarity: 0, cost: 3, theme: 'custodes', motif: 'shield',
    hp: 7, atk: 2, def: 2, mv: 1, counter: true, desc: 'Counterattacks any attacker in range.',
    growth: { hp: 2, def: 1 }, flavor: 'Anchored. Patient.' });

  unit({ id: 'broodling', name: 'Broodling', rarity: 0, cost: 3, theme: 'horde', motif: 'spider',
    hp: 6, atk: 3, mv: 2, desc: 'Venom touch: attacks apply Poison 1 for 2 turns.',
    passive: [{ op: 'onHitStatus', status: 'poison', power: 1, dur: 2 }],
    growth: { atk: 1, hp: 1 }, flavor: 'The swarm sends its regards.' });

  unit({ id: 'thornling', name: 'Thornling', rarity: 0, cost: 3, theme: 'verdant', motif: 'leaf',
    hp: 6, atk: 2, def: 1, mv: 2, desc: 'Thorns 1: melee attackers take 1 damage.',
    passive: [{ op: 'thorns', amount: 1 }],
    growth: { hp: 1 }, flavor: 'Do not hug.' });

  unit({ id: 'grunt', name: 'Legion Grunt', rarity: 0, cost: 3, theme: 'legion', motif: 'spear',
    hp: 7, atk: 3, mv: 2, desc: 'Standard-issue frontline infantry.',
    growth: { hp: 1, atk: 1 }, flavor: 'Follows orders. Survives some.' });

  unit({ id: 'wispling', name: 'Wispling', rarity: 0, cost: 2, theme: 'arcane', motif: 'orb',
    hp: 3, atk: 2, mv: 2, pattern: 'radial', rng: [1, 1], desc: 'Attacks any adjacent square, including diagonals.',
    growth: { atk: 1 }, flavor: 'A rumour given form.' });

  /* ---------------- UNITS — UNCOMMON ---------------- */
  unit({ id: 'emberhound', name: 'Ember Hound', rarity: 1, cost: 3, theme: 'verdant', motif: 'flame',
    hp: 6, atk: 3, mv: 3, desc: 'Attacks apply Burning 2 for 2 turns.',
    passive: [{ op: 'onHitStatus', status: 'burning', power: 2, dur: 2 }],
    growth: { atk: 1, hp: 1 }, growthChoice: { atk: 2, hp: 2 }, flavor: 'The forest burns back.' });

  unit({ id: 'frostadept', name: 'Frost Adept', rarity: 1, cost: 3, theme: 'arcane', motif: 'rune',
    hp: 4, atk: 2, mv: 2, pattern: 'ortho', rng: [2, 2], desc: 'Ranged frost caster.',
    abilities: [{ name: 'Frost Bolt', cost: 2, cd: 2, uses: 1, targeting: 'enemyUnitOrtho3',
      effects: [{ op: 'damage', amount: 2, targets: 'target' }, { op: 'status', status: 'frozen', power: 0, dur: 1, targets: 'target' }], desc: 'Deal 2 to an enemy in a straight line up to 3 and Freeze it for 1 turn.' }],
    growth: { hp: 1 }, flavor: 'Patience, crystallised.' });

  unit({ id: 'bonearcher', name: 'Bone Archer', rarity: 1, cost: 3, theme: 'horde', motif: 'bow',
    hp: 4, atk: 3, mv: 2, pattern: 'ortho', rng: [2, 3], desc: 'Ranged attack, straight lines, range 2–3.',
    growth: { atk: 1, hp: 1 }, flavor: 'The quiver is not empty. It never is.' });

  unit({ id: 'medic', name: 'Field Medic', rarity: 1, cost: 3, theme: 'legion', motif: 'flask',
    hp: 5, atk: 1, mv: 2, desc: 'Keeps the line alive.',
    abilities: [{ name: 'Field Triage', cost: 1, cd: 0, uses: 1, targeting: 'adjacentAlliesOfSelf',
      effects: [{ op: 'heal', amount: 4, targets: 'target' }], desc: 'Heal an adjacent ally for 4.' }],
    growth: { hp: 1 }, flavor: 'Triage first, triage always.' });

  unit({ id: 'shieldgolem', name: 'Shield Golem', rarity: 1, cost: 4, theme: 'custodes', motif: 'shield',
    hp: 8, atk: 2, def: 3, mv: 1, desc: 'Deploy: gains Shield 3.',
    passive: [{ op: 'onDeployShield', amount: 3 }],
    growth: { hp: 2, def: 1 }, flavor: 'A door that walks.' });

  unit({ id: 'servitor', name: 'Arcane Servitor', rarity: 1, cost: 2, theme: 'arcane', motif: 'rune',
    hp: 3, atk: 1, mv: 2, desc: 'Deploy: draw 1 card.',
    passive: [{ op: 'onDeployDraw', amount: 1 }],
    growth: { hp: 1 }, flavor: 'It fetches. Efficiently.' });

  unit({ id: 'stonehide', name: 'Stonehide Behemoth', rarity: 1, cost: 4, theme: 'verdant', motif: 'leaf',
    hp: 9, atk: 2, def: 2, mv: 1, desc: 'Thorns 2: attackers in melee take 2.',
    passive: [{ op: 'thorns', amount: 2 }],
    growth: { hp: 2 }, flavor: 'The mountain grew legs. And grudges.' });

  unit({ id: 'ravager', name: 'Ash Ravager', rarity: 1, cost: 4, theme: 'horde', motif: 'fang',
    hp: 6, atk: 4, mv: 3, desc: 'Relentless shock trooper.',
    growth: { atk: 1, hp: 1 }, growthChoice: { atk: 2, hp: 2 }, flavor: 'Fast. Angry. Flammable.' });

  unit({ id: 'sapper', name: 'Tech Sapper', rarity: 1, cost: 4, theme: 'legion', motif: 'bolt',
    hp: 5, atk: 3, mv: 2, pattern: 'ortho', rng: [2, 2], desc: 'Ranged disruptor.',
    abilities: [{ name: 'EMP Burst', cost: 2, cd: 2, uses: 1, targeting: 'enemyUnitOrtho3',
      effects: [{ op: 'status', status: 'stunned', power: 0, dur: 1, targets: 'target' }], desc: 'Stun an enemy in a straight line up to 3 for 1 turn.' }],
    growth: { hp: 1 }, flavor: 'Turns off things that were on.' });

  unit({ id: 'vaultbreaker', name: 'Vaultbreaker', rarity: 1, cost: 4, theme: 'neutral', motif: 'hammer',
    hp: 8, atk: 3, mv: 2, pattern: 'cleave', desc: 'Cleave: its attack hits ALL adjacent enemies.',
    growth: { atk: 1, hp: 1 }, flavor: 'One swing, many regrets.' });

  /* ---------------- UNITS — RARE ---------------- */
  unit({ id: 'duelist', name: 'Runeblade Duelist', rarity: 2, cost: 4, theme: 'arcane', motif: 'blade',
    hp: 6, atk: 4, mv: 2, pattern: 'knight', desc: 'Knight move-attack pattern (L-shapes).',
    abilities: [{ name: 'Rune Slash', cost: 2, cd: 1, uses: 1, targeting: 'enemyUnitKnight',
      effects: [{ op: 'damage', amount: 4, targets: 'target' }], desc: 'Deal 4 to an enemy in knight range.' }],
    growth: { atk: 1, hp: 1 }, growthChoice: { atk: 1, hp: 2, def: 1 }, flavor: 'Geometry, sharpened.' });

  unit({ id: 'flamecaller', name: 'Flamecaller', rarity: 2, cost: 5, theme: 'arcane', motif: 'flame',
    hp: 5, atk: 3, mv: 2, pattern: 'ortho', rng: [3, 3], desc: 'Long-range pyromancer.',
    abilities: [{ name: 'Ignite', cost: 3, cd: 2, uses: 1, targeting: 'enemyUnitRadial3',
      effects: [{ op: 'damage', amount: 1, targets: 'target' }, { op: 'status', status: 'burning', power: 2, dur: 2, targets: 'target' }], desc: 'Deal 1 to an enemy within 3 (any direction) and set it Burning 2 for 2 turns.' }],
    growth: { atk: 1, hp: 1 }, flavor: 'Fire is a language. She is fluent.' });

  unit({ id: 'siegegolem', name: 'Siege Golem', rarity: 2, cost: 6, theme: 'custodes', motif: 'hammer',
    hp: 10, atk: 4, def: 2, mv: 1, pattern: 'cleave', desc: 'Cleave attack hits all adjacent enemies.',
    growth: { hp: 2, atk: 1 }, flavor: 'Built to break buildings.' });

  unit({ id: 'wraith', name: 'Wraith of Sorrows', rarity: 2, cost: 4, theme: 'horde', motif: 'ghost',
    hp: 5, atk: 3, mv: 3, desc: 'Phase: moves through occupied squares.',
    passive: [{ op: 'phaseMove' }],
    growth: { atk: 1, hp: 1 }, flavor: 'Walls are a courtesy it declines.' });

  unit({ id: 'fenrir', name: 'Pack Alpha Fenrir', rarity: 2, cost: 5, theme: 'verdant', motif: 'wolf',
    hp: 8, atk: 4, mv: 3, desc: 'Aura: adjacent allies get +1 attack.',
    passive: [{ op: 'auraAdj', stat: 'atk', amount: 1 }],
    growth: { atk: 1, hp: 1 }, flavor: 'The pack moves as one jaw.' });

  unit({ id: 'vex', name: 'Techmarine Vex', rarity: 2, cost: 4, theme: 'legion', motif: 'bolt',
    hp: 5, atk: 2, mv: 2, pattern: 'ortho', rng: [2, 2], desc: 'Combat engineer.',
    abilities: [{ name: 'Repair', cost: 1, cd: 1, uses: 1, targeting: 'friendlyStructureOrBase4',
      effects: [{ op: 'heal', amount: 5, targets: 'target' }], desc: 'Heal a friendly structure or base within 4 for 5.' }],
    growth: { hp: 1 }, flavor: 'Everything is fixable with enough grit.' });

  unit({ id: 'swarm', name: 'Chitterling Matriarch', rarity: 2, cost: 3, theme: 'horde', motif: 'spider',
    hp: 8, atk: 2, mv: 2, desc: 'Deathrattle: summon two Chitterling tokens on adjacent empty tiles.',
    passive: [{ op: 'onDeathSummon', token: 'chitterling', count: 2 }],
    growth: { hp: 2 }, flavor: 'Grief, expressed reproductively.' });

  unit({ id: 'skirmisher', name: 'Storm Skirmisher', rarity: 2, cost: 5, theme: 'custodes', motif: 'bolt',
    hp: 5, atk: 3, mv: 4, pattern: 'radial', rng: [1, 2], desc: 'Hit and Run: after attacking, may move 1 square.',
    passive: [{ op: 'afterAttackMove', amount: 1 }],
    growth: { atk: 1, hp: 1 }, growthChoice: { atk: 1, hp: 2, mv: 0 }, flavor: 'Lightning does not stay to chat.' });

  /* ---------------- UNITS — EPIC ---------------- */
  unit({ id: 'colossus', name: 'Colossus of the Deep Vault', rarity: 3, cost: 7, theme: 'neutral', motif: 'guardian',
    hp: 14, atk: 6, def: 3, mv: 2, desc: 'Ancient siege entity. Simply refuses to die quickly.',
    growth: { hp: 2, def: 1 }, flavor: 'Older than the vault it guarded.' });

  unit({ id: 'voidcaller', name: 'Void Caller', rarity: 3, cost: 6, theme: 'arcane', motif: 'orb',
    hp: 6, atk: 3, mv: 2, pattern: 'ortho', rng: [3, 3], desc: 'Tears small holes in the battlefield.',
    abilities: [{ name: 'Rift Zone', cost: 3, cd: 2, uses: 1, targeting: 'anyTile',
      effects: [{ op: 'tile', kind: 'rift', dur: 2, area: 'radius1' }], desc: 'Target tile + neighbours become a Rift for 2 turns: enemies standing there take 2 at their turn start.' }],
    growth: { hp: 1, atk: 1 }, flavor: 'Do not lean over the edge. There is none.' });

  unit({ id: 'malen', name: 'High Inquisitor Malen', rarity: 3, cost: 6, theme: 'legion', motif: 'crown',
    hp: 8, atk: 4, def: 1, mv: 2, desc: 'Aura: adjacent allies +1 defense.',
    passive: [{ op: 'auraAdj', stat: 'def', amount: 1 }],
    abilities: [{ name: 'Judgment', cost: 3, cd: 2, uses: 1, targeting: 'enemyUnitOrtho2',
      effects: [{ op: 'damage', amount: 4, targets: 'target' }, { op: 'status', status: 'stunned', power: 0, dur: 1, targets: 'target' }], desc: 'Deal 4 to an enemy within 2 straight squares and Stun it.' }],
    growth: { hp: 1, atk: 1 }, flavor: 'The verdict is always guilty.' });

  unit({ id: 'plague', name: 'Plague Abomination', rarity: 3, cost: 6, theme: 'horde', motif: 'ghost',
    hp: 10, atk: 4, mv: 2, desc: 'Attacks apply Poison 2 for 3 turns (Poison stacks).',
    passive: [{ op: 'onHitStatus', status: 'poison', power: 2, dur: 3 }],
    growth: { hp: 2, atk: 1 }, flavor: 'A ceremony of decay.' });

  unit({ id: 'aegis', name: 'Aegis Frame', rarity: 3, cost: 6, theme: 'custodes', motif: 'shield',
    hp: 9, atk: 3, def: 3, mv: 1, desc: 'Protective assault platform.',
    abilities: [{ name: 'Fortress Protocol', cost: 3, cd: 3, uses: 1, targeting: 'self',
      effects: [{ op: 'buffTemp', atk: 0, def: 2, dur: 1, targets: 'adjacentAlliesOfSelf' }], desc: 'Adjacent allies get +2 defense until your next turn.' }],
    growth: { hp: 2, def: 1 }, flavor: 'Safety, enforced.' });

  /* ---------------- UNITS — LEGENDARY / MYTHIC ---------------- */
  unit({ id: 'pyraxis', name: 'Pyraxis, Ember Tyrant', rarity: 4, cost: 7, theme: 'horde', motif: 'dragon',
    hp: 9, atk: 6, mv: 2, desc: 'Deploy: every enemy unit starts Burning 2 for 2 turns.',
    passive: [{ op: 'onDeployStatusAllEnemies', status: 'burning', power: 2, dur: 2 }],
    growth: { atk: 1, hp: 1 }, growthChoice: { atk: 2, hp: 2 }, flavor: 'The sky was never safe.' });

  unit({ id: 'matrix', name: 'Sovereign Matrix α', rarity: 4, cost: 7, theme: 'custodes', motif: 'guardian',
    hp: 10, atk: 5, def: 2, mv: 1, desc: 'Aura within 2 squares: allies +1 attack, +1 defense.',
    passive: [{ op: 'auraRadius', radius: 2, atk: 1, def: 1 }],
    abilities: [{ name: 'Purge', cost: 3, cd: 2, uses: 1, targeting: 'self',
      effects: [{ op: 'damage', amount: 3, targets: 'enemiesNearSelfRadius2' }], desc: 'Deal 3 to every enemy within 2 squares.' }],
    growth: { hp: 2, def: 1 }, flavor: 'Order, projected outward.' });

  unit({ id: 'morvane', name: 'Lich Sovereign Morvane', rarity: 4, cost: 7, theme: 'horde', motif: 'crown',
    hp: 8, atk: 5, mv: 2, desc: 'When it kills a unit, a Wraith token rises in the victim’s square.',
    passive: [{ op: 'onKillSummon', token: 'wraith_token' }],
    growth: { atk: 1, hp: 1 }, flavor: 'Its army is everyone it has ever beaten.' });

  unit({ id: 'worldbreaker', name: 'The Worldbreaker', rarity: 5, cost: 9, theme: 'neutral', motif: 'comet',
    hp: 15, atk: 8, def: 2, mv: 2, desc: 'Deploy: deal 2 to every enemy within 2 squares.',
    passive: [{ op: 'onDeployDamageNear', amount: 2, radius: 2 }],
    growth: { atk: 1, hp: 2 }, flavor: 'Named honestly.' });

  unit({ id: 'aeon', name: 'Aeon, the Timeless', rarity: 5, cost: 8, theme: 'arcane', motif: 'hourglass',
    hp: 10, atk: 4, def: 1, mv: 2, pattern: 'radial', rng: [1, 2], los: false, desc: 'Acts twice each turn. Attacks within 2 squares ignore line of sight.',
    passive: [{ op: 'actTwice' }],
    growth: { atk: 1, hp: 1 }, growthChoice: { atk: 2, hp: 2, def: 1 }, flavor: 'It has already won, somewhere.' });

  /* ---------------- TOKENS (summoned, not collectible) ---------------- */
  card({ id: 'chitterling', name: 'Chitterling', type: 'unit', token: true, rarity: 0, cost: 0, theme: 'horde', motif: 'spider',
    hp: 1, atk: 1, mv: 2, desc: 'Summoned token.', growth: {} });
  card({ id: 'wraith_token', name: 'Wraith', type: 'unit', token: true, rarity: 0, cost: 0, theme: 'horde', motif: 'ghost',
    hp: 2, atk: 2, mv: 2, desc: 'Summoned token.', growth: {} });
  card({ id: 'skeleton', name: 'Skeleton', type: 'unit', token: true, rarity: 0, cost: 0, theme: 'horde', motif: 'skull',
    hp: 2, atk: 2, mv: 2, desc: 'Summoned token.', growth: {} });

  /* ---------------- SPELLS ---------------- */
  spell({ id: 'spark', name: 'Spark', rarity: 0, cost: 1, theme: 'arcane', motif: 'bolt',
    targeting: 'enemyUnit', effects: [{ op: 'damage', amount: 2, targets: 'target' }],
    desc: 'Deal 2 damage to an enemy unit.', growth: {} });
  spell({ id: 'mend', name: 'Mend', rarity: 0, cost: 2, theme: 'verdant', motif: 'flask',
    targeting: 'friendlyUnit', effects: [{ op: 'heal', amount: 6, targets: 'target' }],
    desc: 'Heal a friendly unit for 6.', growth: {} });
  spell({ id: 'hymn', name: 'Battle Hymn', rarity: 0, cost: 1, theme: 'legion', motif: 'banner',
    targeting: 'friendlyUnit', effects: [{ op: 'buffTemp', atk: 3, def: 0, dur: 1, targets: 'target' }],
    desc: 'Target friendly unit gets +3 attack this turn.', growth: {} });
  spell({ id: 'icebolt', name: 'Ice Bolt', rarity: 0, cost: 2, theme: 'arcane', motif: 'rune',
    targeting: 'enemyUnit', effects: [{ op: 'damage', amount: 2, targets: 'target' }, { op: 'status', status: 'frozen', power: 0, dur: 1, targets: 'target' }],
    desc: 'Deal 2 damage to an enemy unit and Freeze it for 1 turn.', growth: {} });
  spell({ id: 'insight', name: 'Arcane Insight', rarity: 0, cost: 2, theme: 'arcane', motif: 'orb',
    targeting: 'none', effects: [{ op: 'draw', n: 2 }],
    desc: 'Draw 2 cards.', growth: {} });
  spell({ id: 'fireball', name: 'Fireball', rarity: 1, cost: 3, theme: 'arcane', motif: 'flame',
    targeting: 'enemyUnit', effects: [{ op: 'damage', amount: 4, targets: 'target' }, { op: 'damage', amount: 2, targets: 'adjacentOfTarget' }],
    desc: 'Deal 4 to an enemy unit and 2 to enemies adjacent to it.', growth: {} });
  spell({ id: 'venom', name: 'Venom Bolt', rarity: 1, cost: 2, theme: 'horde', motif: 'flask',
    targeting: 'enemyUnit', effects: [{ op: 'status', status: 'poison', power: 2, dur: 3, targets: 'target' }],
    desc: 'Poison an enemy unit: 2 damage at each of its turns, 3 turns (stacks).', growth: {} });
  spell({ id: 'ward', name: 'Ward Stone', rarity: 1, cost: 2, theme: 'arcane', motif: 'shield',
    targeting: 'friendlyUnit', effects: [{ op: 'shield', amount: 6, targets: 'target' }],
    desc: 'Give a friendly unit Shield 6.', growth: {} });
  spell({ id: 'icewall', name: 'Ice Wall', rarity: 1, cost: 1, theme: 'arcane', motif: 'rune',
    targeting: 'emptyTile', effects: [{ op: 'tile', kind: 'block', dur: 3, area: 'single' }],
    desc: 'The target tile becomes impassable for 3 turns.', growth: {} });
  spell({ id: 'emberfield', name: 'Ember Field', rarity: 1, cost: 2, theme: 'verdant', motif: 'flame',
    targeting: 'anyTile', effects: [{ op: 'tile', kind: 'ember', dur: 2, area: 'cross' }],
    desc: 'Target tile + its 4 orthogonal neighbours burn for 2 turns: units standing there take 1 at their turn start.', growth: {} });
  spell({ id: 'skyfall', name: 'Strike From Above', rarity: 2, cost: 4, theme: 'legion', motif: 'comet',
    targeting: 'enemyUnit', effects: [{ op: 'damage', amount: 5, targets: 'target', pierce: true }],
    desc: 'Deal 5 damage to an enemy unit. Ignores line of sight.', growth: {} });
  spell({ id: 'rallylines', name: 'Rally the Lines', rarity: 2, cost: 3, theme: 'legion', motif: 'banner',
    targeting: 'none', effects: [{ op: 'buffTemp', atk: 0, def: 1, dur: 1, targets: 'allFriendlyUnits' }],
    desc: 'All friendly units get +1 defense until your next turn.', growth: {} });
  spell({ id: 'execute', name: 'Reap', rarity: 2, cost: 4, theme: 'horde', motif: 'blade',
    targeting: 'enemyUnit', effects: [{ op: 'destroy', maxHp: 4 }],
    desc: 'Destroy an enemy unit with 4 or less current HP.', growth: {} });
  spell({ id: 'surge', name: 'Ley Surge', rarity: 2, cost: 2, theme: 'arcane', motif: 'orb',
    targeting: 'none', effects: [{ op: 'energy', amount: 3 }],
    desc: 'Gain 3 energy now.', growth: {} });
  spell({ id: 'deepstrat', name: 'Deep Stratagem', rarity: 2, cost: 1, theme: 'legion', motif: 'banner',
    targeting: 'none', effects: [{ op: 'maxHand', amount: 1 }],
    desc: 'Your maximum hand size increases by 1 for the rest of the match.', growth: {} });
  spell({ id: 'chainlight', name: 'Chain Lightning', rarity: 3, cost: 4, theme: 'arcane', motif: 'bolt',
    targeting: 'enemyUnit', effects: [{ op: 'damage', amount: 4, targets: 'target' }, { op: 'damage', amount: 2, targets: 'randomEnemyNearTarget', radius: 3 }],
    desc: 'Deal 4 to an enemy, then 2 to a second random enemy within 3 squares of it.', growth: {} });
  spell({ id: 'massmend', name: 'Mass Mend', rarity: 3, cost: 5, theme: 'verdant', motif: 'leaf',
    targeting: 'none', effects: [{ op: 'heal', amount: 4, targets: 'allFriendlyUnits' }],
    desc: 'Heal all friendly units for 4.', growth: {} });
  spell({ id: 'cataclysm', name: 'Cataclysm', rarity: 4, cost: 7, theme: 'arcane', motif: 'comet',
    targeting: 'none', effects: [{ op: 'damage', amount: 3, targets: 'allEnemyUnits' }],
    desc: 'Deal 3 damage to every enemy unit.', growth: {} });

  /* ---------------- STRUCTURES ---------------- */
  struct({ id: 'barricade', name: 'Barricade', rarity: 0, cost: 1, theme: 'neutral', motif: 'wall',
    sHp: 6, desc: 'Blocks movement. Cheap and stubborn.', growth: {} });
  struct({ id: 'manafont', name: 'Mana Font', rarity: 1, cost: 2, theme: 'arcane', motif: 'font',
    sHp: 6, passive: [{ op: 'incomeBonus', amount: 1 }],
    abilities: [{ name: 'Attune', cost: 3, cd: 0, uses: 1, usesMatch: 1, targeting: 'self',
      effects: [{ op: 'transform', into: 'manafont2' }], desc: 'Transform into Mana Font Prime (+2 energy per turn).' }],
    desc: '+1 energy at the start of each of your turns. Can be attuned once into a stronger form.', growth: {} });
  card({ id: 'manafont2', name: 'Mana Font Prime', type: 'structure', token: true, rarity: 1, cost: 0, theme: 'arcane', motif: 'font',
    sHp: 6, passive: [{ op: 'incomeBonus', amount: 2 }], desc: '+2 energy at the start of each of your turns.', growth: {} });
  struct({ id: 'bastion', name: 'Bastion Gate', rarity: 1, cost: 2, theme: 'legion', motif: 'wall',
    sHp: 8, passive: [{ op: 'auraAdj', stat: 'def', amount: 1 }],
    desc: 'Adjacent friendly units get +1 defense.', growth: {} });
  struct({ id: 'watchtower', name: 'Watchtower', rarity: 2, cost: 3, theme: 'legion', motif: 'tower',
    sHp: 7, passive: [{ op: 'rangeAura', amount: 1, radius: 1 }],
    desc: 'Adjacent friendly units get +1 attack range (max range +1).', growth: {} });
  struct({ id: 'brazier', name: 'Ember Brazier', rarity: 2, cost: 3, theme: 'horde', motif: 'brazier',
    sHp: 6, passive: [{ op: 'enemyStartDamage', amount: 1, radius: 1 }],
    desc: 'Adjacent enemies take 1 damage at the start of their turns.', growth: {} });
  struct({ id: 'spring', name: 'Healing Spring', rarity: 1, cost: 3, theme: 'verdant', motif: 'spring',
    sHp: 7, passive: [{ op: 'allyStartHeal', amount: 2, radius: 1 }],
    desc: 'Adjacent friendly units heal 2 at the start of your turns.', growth: {} });
  struct({ id: 'depot', name: 'Supply Depot', rarity: 2, cost: 2, theme: 'legion', motif: 'crate',
    sHp: 7, passive: [{ op: 'deployDiscount', amount: 1, radius: 2 }],
    desc: 'Your units and structures deployed within 2 squares cost 1 less energy (min 1).', growth: {} });
  struct({ id: 'pylon', name: 'Arcane Pylon', rarity: 3, cost: 4, theme: 'arcane', motif: 'pylon',
    sHp: 6, passive: [{ op: 'startDamageRandom', amount: 1, radius: 3 }],
    desc: 'At the start of your turns, deal 1 damage to a random enemy within 3 squares.', growth: {} });
  struct({ id: 'fortress', name: 'Vault Fortress', rarity: 4, cost: 6, theme: 'custodes', motif: 'fortress',
    sHp: 20, multiTile: { w: 2, h: 2 }, passive: [{ op: 'auraAdj', stat: 'def', amount: 2 }],
    desc: 'Occupies a 2×2 area. Blocks movement. Adjacent friendly units get +2 defense.', growth: {} });

  /* ============================================================ */
  const BY_ID = {};
  D.forEach((c) => { BY_ID[c.id] = c; });

  // ---- derived stats: base + auto growth + chosen growth, capped at level 7 ----
  function statsFor(id, level, choices) {
    const c = BY_ID[id];
    if (!c) throw new Error('unknown card ' + id);
    level = Math.min(level || 1, C.upgrades.maxLevel);
    choices = choices || {};
    const n = level - 1;
    const s = {
      hp: c.hp || (c.type === 'structure' ? c.sHp : 0),
      atk: c.atk || 0, def: c.def || 0, mv: c.mv || 0,
      hpBonus: (choices.hp || 0), atkBonus: (choices.atk || 0), defBonus: (choices.def || 0),
    };
    const g = c.growth || {};
    s.hp += (g.hp || 0) * n + (choices.hp || 0);
    s.atk += (g.atk || 0) * n + (choices.atk || 0);
    s.def += (g.def || 0) * n + (choices.def || 0);
    return s;
  }

  NS.CARDS = D;
  NS.CARD = BY_ID;
  NS.statsFor = statsFor;
})(typeof window !== 'undefined' ? (window.CS = window.CS || {}) : (globalThis.CS = globalThis.CS || {}));
