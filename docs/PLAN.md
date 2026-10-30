# Rumble Roulette build plan

Source of truth for the rules: the approved [design brief](https://claude.ai/artifact/SXf8WEs9f2zxdzjgHRqiiA).

## Architecture

- **Static React app** (Vite + TypeScript) served from GitHub Pages. Hash routes so Pages never 404s:
  - `#/` landing (Host a game / Join a game)
  - `#/host` host screen (TV / laptop)
  - `#/play/ABCD` phone controller for room `ABCD`
- **Host-authoritative engine.** The host browser runs all game logic in a pure TypeScript engine
  (`src/engine/`). Phones only send *inputs* (join, bet, RPS throw, referee call). The host applies them,
  then publishes a *public projection* of the state (hidden bets and secret picks stripped out).
- **Transport abstraction** (`src/net/`), two implementations:
  - `FirebaseTransport`: Realtime Database for the live room, Firestore for profiles and history,
    Google sign-in for the host, anonymous auth for phones.
  - `LocalTransport`: BroadcastChannel + localStorage. Used automatically when no Firebase config is
    filled in, so the whole game can be tried in one browser with several tabs (and is what the tests use).

### Realtime Database layout (`rooms/{code}`)

| Path | Written by | Read by | Holds |
| --- | --- | --- | --- |
| `meta` | host | everyone | host uid, created time |
| `state` | host | everyone signed in | public projection of the game |
| `host` | host | host | full engine state (for resume after refresh) |
| `inputs/{pushId}` | any phone (own uid) | host | queued inputs, deleted once applied |
| `presence/{uid}` | that phone | host | `true` while connected (`onDisconnect` removes it) |

### Firestore layout (`hosts/{googleUid}`)

- `profiles/{id}`: name, colour, accessory, all-time stats.
- `games/{id}`: summary of each finished party game.
- Phones never touch Firestore; the host publishes the profile list into the room for the lobby.

## Engine

- Phases: `lobby → pick → spin → bet → duel → result → (next round) … → tiebreak/final → awards → end`.
  Free play: `lobby → freeMenu → spin? → duel → result → freeMenu`.
- Deadlines (pick animation, wheel spin, 15 s bet timer, RPS throw timer) are timestamps in state; the host
  runs a 250 ms tick that advances them, so a refreshed host resumes correctly.
- Fair selection: a shuffled "bag" of seats, 2 drawn per round, refilled when empty (never the same seat
  twice in a duel, avoids repeating last round's pair). Referee = random among non-duelists with the fewest
  referee turns. Skipped rounds return duelists to the bag and don't count.
- Coins and bets exactly as the brief: 12 start, bet 1–3 (never more than you have), 0 coins → gifted 1,
  auto-bet 1 on a random duelist at the deadline, duel winner +2, duel loser -1 (never below 0), bets hidden until the result.
- Final: top two by coins; ties for a spot go to knockout tie-break duels; no betting in tie-breaks or
  the final; a draw is redone.

## Minigames (`src/games/`)

Each game is one folder exporting a `MinigameDef`: info (name, rules, icon, colour, category,
scoring), `init`, `onInput`, `tick`, `result`, `project` (public view), and three React views
(`HostView`, `DuelistView`, `RefereeView`). Register it in `src/games/index.ts` and it appears on the wheel.

Starter games: Rock Paper Scissors (best of 3, 10 s per throw, auto-scored) and Timer (referee-judged,
auto-stop at 30 s).

## Build steps

1. Scaffold: Vite/React/TS, lint-free build, GitHub Actions deploy to Pages.
2. Transport layer (local + Firebase), room creation with code + QR, phone join, presence.
3. Profiles + character creator (SVG Screenbot, 12 colours, 8 accessories), all-time stats on the picker.
4. Minigame framework + RPS + Timer, playable in free play.
5. Party mode engine: selection, wheel, betting, referee controls, payouts, final, tie-breaks.
6. Awards rundown, scoreboard, saving stats, sound (Web Audio), vibration, wake lock, reconnects.
7. Unit tests for the engine (Vitest) and a scripted browser playthrough (Playwright, local mode).
8. Setup guide for Firebase + GitHub Pages in the README.
