# Cardstrike — Tactical Collectible Strategy Card Game

A dark-fantasy × sci-fi collectible tactical card game in a **single self-contained HTML file** (`cardstrike.html`). No build step, no server, no dependencies — open it in any modern browser and play. Progress saves to `localStorage` (export/import from Profile).

**How to run:** open `cardstrike.html` in Chrome / Edge / Firefox / Safari (desktop or mobile).

---

## What's implemented (Milestones 1–6)

| System | Status |
|---|---|
| Main menu, navigation, design system | ✅ |
| Card database — **75 unique cards** (40 units, 8 commanders, 18 spells, 9 structures), 6 rarities, 6 themes | ✅ |
| Player profile, stats, save/load, export/import | ✅ |
| Card collection with filters + card detail | ✅ |
| Pack shop (5 tiers + event pack) with rarity odds, level gating, opening animation | ✅ |
| Duplicate handling — explicit **sell for coins / convert to Star Points** choice | ✅ |
| Deck builder — exactly 35 cards, ≤2 commanders, copy limits (commons ×3, others ×1), 3 slots, validation, auto-fill | ✅ |
| 11×11 battlefield, placement phase, deploy / move / block, attack patterns (melee, ortho, diag, radial, knight, cleave), line of sight | ✅ |
| Turn phases, energy income + carryover (cap 3), attack energy cost, hand size 5, replacement draws, start-phase draw | ✅ |
| Commanders — starting placement, second-commander deployment adjacent, auras, actives, **recovery system** (return <15% HP → heal to 50% for 2⚡) | ✅ |
| Status effects — burning, poison (stacks), frozen, stunned, shield, slowed, buffs — each with defined stacking rules | ✅ |
| Structures — blockers, mana generation, auras, range aura, deploy discounts, transform upgrade (Mana Font → Prime), **multi-tile 2×2 Fortress** | ✅ |
| Tile effects — ember fields, rift zones, ice walls (block), frost | ✅ |
| All 3 victory conditions — commander elimination, base destruction, deck-exhaustion fatigue | ✅ |
| AI — 4 difficulties with genuinely different decision-making | ✅ |
| Rewards (coins/credits/XP scaled by difficulty), card upgrades to L7 (auto + chosen stats) | ✅ |
| Weekly reward track (7 milestones, no daily streaks), achievements (cosmetics only), account levels (cosmetic/feature unlocks only) | ✅ |
| Trade Post (simulated brokers, ownership + uniqueness validation, daily limit) | ✅ |
| Events (admin-configured; **Emberfall Festival** live with +50% coins, rule modifier, event pack; a scheduled event defined) | ✅ |
| Tournament — 4-player single elimination (Normal semifinal, Hard final), champion cosmetic | ✅ |
| Hotseat PvP (2 players, 1 device) | ✅ |
| Sound (WebAudio synth, toggleable), animations, responsive down to 375px | ✅ |

**Not in scope (per spec):** ranked matchmaking, real-money Credits, equipment cards (do not exist), online PvP (architecture-ready, see below).

---

## ⚠️ Flagged design conflict — commander elimination vs. "defeat ≠ match end"

The build card states two things that conflict:

1. *Victory condition 1 is commander elimination.*
2. *An earlier decision: reducing a commander's HP to 0 removes its abilities but does **not** end the match.*

**Proposed rule (implemented, configurable, not silently invented):**

- When a commander reaches 0 HP it becomes **Fallen**: it loses all abilities, actions and auras, but remains on the battlefield as a grayed "wraith anchor" that still **blocks its tile** and still serves as a **deployment/recovery anchor point**.
- The match only ends when **all** of a player's commanders are Fallen. With one-commander decks this behaves exactly like classic commander elimination; with two-commander decks the first death cripples but doesn't eliminate.
- Rationale: keeps the earlier decision true (defeating *a* commander ≠ match end), keeps victory condition 1 meaningful, and preserves the commander's deployment/recovery role — the part that matters structurally.
- If the intended rule differs (e.g., Fallen commanders should also lose the anchor role, or should be removed from the board), it is a ~10-line change in `engine.js` (`killUnit`, `checkVictory`).

## Other designed rules (spec left open)

- **Main Base** — auto-placed at back-edge centre (5,10 / 5,0), 25 HP, blocks movement, gives adjacent friendly units +1 defense, has no attack. Destroying it wins instantly.
- **Fatigue** — each failed draw (deck empty, hand not full) raises that player's fatigue counter and deals `counter` damage to **each of that player's commanders**. A draw attempt on an **empty deck always fails** — even when the hand is full — so deck exhaustion always escalates and hands-full stalemates can never block the fatigue victory condition.
- **Drawing** — opening hand 4; the opening hand *is* the turn-1 hand (no extra start draw on turn 1); from turn 2 onward each start phase draws 1 (skipped if hand full); playing any card triggers a **replacement draw** (not a bonus draw), also skipped when full.
- **Deployed units act immediately** (move + attack the turn they hit the field). Attacks cost 1⚡; moves are free but each unit moves/attacks once per turn (Aeon: twice).
- **Line of sight** — required for directional ranged patterns (ortho / diag / radial); melee, knight and cleave ignore it. Card flag `los:false` bypasses (e.g., Aeon, Strike From Above).
- **Spells ignore defense** (pierce); attack damage is `max(1, ATK − DEF)`.
- **Counters** — `counter:'melee'` retaliates vs adjacent attackers; `counter:true` uses the unit's own pattern. Once per turn, not vs structures/bases, not while frozen/stunned.
- **Spells target commanders** (they're units on the field) but not structures — attack patterns are the anti-structure tool.
- **Energy** — income 3 + 1/own turn, cap 10; unused energy carries over capped at 3 (storage limit); Pool max 10.

## Economy configuration

Every value lives in `scripts/cardstrike/config.js` (pack prices, per-tier rarity odds + floor rarity, duplicate coin/Star-Point values by rarity, upgrade cost curve, battle rewards, weekly milestones, achievement rewards, level unlocks, trade limits, AI noise/budgets, battle rules). Events are admin-editable in `meta.js` (`EVENTS` array: dates, coin/credit multipliers, rule modifiers, event pack definition).

## Architecture

```
scripts/cardstrike/
  config.js    — all balance/economy knobs (single source of truth)
  cards.js     — data-driven card DB; add a card = add one object (effects are descriptors)
  engine.js    — pure battle engine: serializable state + applyAction(state, action)
  ai.js        — difficulty policies over shared evaluation (threat map, 2-ply Expert chains)
  meta.js      — profile/collection/packs/upgrades/achievements/weekly/trade/events/tournament
  ui.js        — shell, screens, procedural SVG card art, sound
  battle.js    — battlefield rendering + interaction + bot pacing
  main.js      — boot & navigation glue
  styles.css   — design system
  template.html + build.js → download/cardstrike.html (single-file build)
  test.js      — Node test suite (41 tests: rules, victory, economy, AI)
```

**Server-ready:** the engine is DOM-free and fully serializable (`JSON.parse(JSON.stringify(state))`); every mutation flows through `applyAction(state, action)`, the same API the AI and the UI use. An authoritative server can run `engine.js` + `meta.js` verbatim, validate client actions, and broadcast state diffs — the UI renders whatever state it's given.

**Procedural art:** card illustrations are generated SVG sigils (28 motifs × theme palettes) with rarity glows — Legendary/Mythic get animated holo effects. Zero asset downloads.

## Testing

`node scripts/cardstrike/test.js` → 41 assertions across deck rules, placement, energy, movement/blocking, combat/counters/cleave, statuses, commander mechanics (incl. the Fallen-anchor rule), all three victory conditions, fatigue, drawing rules, pack odds, duplicates, upgrades, rewards, XP, trading, weekly/achievements, and full AI matches for every difficulty (incl. Expert-beats-Easy gradient).

## Verified in-browser

Full scripted session via headless Chromium: pack purchase → animation → duplicate resolution (coins/stars posted), commander placement, unit/structure deployment (incl. bot's 2×2 fortress), movement with highlights, attack kill, end-turn/bot turns, victory modal with rewards, profile stats/weekly/achievements, deck builder validation, zero console errors, no horizontal overflow at 375px.

## Known limitations / next steps

- Trading is simulated (brokers) — real PvP trading reuses `doTrade` validation server-side.
- Tournament bracket is you + 3 bots; the other semifinal is auto-simulated.
- Events/tournaments reward cosmetics + currencies only; no card prizes (spec: achievements never pay cards — event rewards kept to currencies/cosmetics/packs).
- Bot decks are generated (curve-weighted); scripted boss decks would add flavor.
- AI tuning: deploys are paced (max 2/turn per side for Normal+) and the evaluation values deck/hand conservation — without this, greedy bots burned their whole deck by ~turn 30 and lost to their own fatigue. Expert still shows variance vs Easy in short matches; deeper search (proper minimax, longer horizons) is the next quality step.
