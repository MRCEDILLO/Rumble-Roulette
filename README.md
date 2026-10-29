# Rumble Roulette

An in-person party game for 3 to 10 players. One computer is the big screen; everyone else plays on
their phone. Each round two players duel in a random minigame picked by a spin wheel, a third player
referees, and everyone else bets coins on the winner. After the last round the two richest players
meet in the final.

- **Party mode:** coins, betting, referee, tie-breaks, the final, awards and all-time stats.
- **Free play:** pick any minigame (or spin) and play it with no coins. Handy for testing new games.

Rules and design decisions: [design brief](https://claude.ai/artifact/SXf8WEs9f2zxdzjgHRqiiA) ·
build plan: [docs/PLAN.md](docs/PLAN.md).

## Try it right now (offline demo)

Until Firebase is set up, the site runs in **offline demo mode**: the host and players are tabs in the
same browser.

```bash
npm install
npm run dev
```

Open the printed address, click **Host on this screen**, create a room, then open the join link in
two or three more tabs to act as players. (Add `?local` to the address to force demo mode later, even
after Firebase is set up.)

## One-time setup (free)

### 1. Firebase

1. Go to the [Firebase console](https://console.firebase.google.com), click **Add project**, and
   follow the steps (Google Analytics isn't needed). Stay on the free **Spark** plan.
2. **Build → Authentication → Get started.** Under *Sign-in method*, enable **Google** and
   **Anonymous**. (Anonymous lets phones join without logging in.)
3. **Build → Realtime Database → Create database.** Pick a location, start in **locked mode**. Open
   the **Rules** tab, replace everything with the contents of
   [`firebase/database.rules.json`](firebase/database.rules.json) and click **Publish**. Copy the
   database URL shown at the top (it ends in `firebasedatabase.app` or `firebaseio.com`).
4. **Build → Firestore Database → Create database** (production mode). Open **Rules**, paste
   [`firebase/firestore.rules`](firebase/firestore.rules) and **Publish**.
5. **Project settings (gear icon) → General → Your apps → Web (`</>`)**. Register an app (no
   Firebase Hosting needed) and copy the `firebaseConfig` values into
   [`src/firebase-config.ts`](src/firebase-config.ts). Make sure `databaseURL` is filled in with the
   URL from step 3.
6. **Authentication → Settings → Authorized domains → Add domain:** `mrcedillo.github.io`.

The config values aren't secret; the database rules are what keep games and profiles safe.

### 2. GitHub Pages

1. In this repo on GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Push to `main`. The workflow in `.github/workflows/deploy.yml` runs the tests, builds the site and
   publishes it to **https://mrcedillo.github.io/Rumble-Roulette/**.

## How to play

1. Open the site on the computer connected to the TV and choose **Host on this screen**. Sign in with
   Google.
2. Pick **Party** or **Free play**, a game length (10 / 20 / 30 / custom rounds) and which minigames
   are on the wheel, then **Create room**.
3. Players scan the QR code (or go to the site and type the 4-letter code), pick their profile or make
   a new one (name, colour, accessory), and wait in the lobby.
4. Press **Start game**. From then on the referee runs each round from their phone. The host's
   **☰ Menu** has the same referee buttons in case a phone dies, plus *Skip to the final*, removing
   players, volume, and closing the room.

If a phone locks or refreshes, reopen the link and pick the same profile to carry on.

## Adding a minigame

Each minigame lives in its own folder under `src/games/` with two files:

- `logic.ts` exports a `MinigameLogic`: its info (name, rules, icon, colour, whether it needs a
  referee, auto or referee scoring) and pure functions `init`, `onInput`, `tick`, `result` and
  `project` (what everyone is allowed to see). It runs only on the host.
- `views.tsx` exports `MinigameViews`: `HostView` (the big screen, which must always show what the
  duelists are doing), `DuelistView` (each duelist's phone) and optionally `RefereeView`.

Register the game in `src/games/logic.ts` and `src/games/views.ts`, and it appears on the wheel and in
free play. `src/games/rps/` and `src/games/timer/` are the examples to copy.

## Development

```bash
npm test        # engine tests (fair selection, betting, referee, final)
npm run build   # type-check and build to dist/
```

- `src/engine/` is the whole game as pure TypeScript, run by the host's browser.
- `src/net/` talks to Firebase (`firebase.ts`) or to other tabs in demo mode (`local.ts`).
- `src/host/` is the big screen, `src/player/` is the phone controller.
- `src/characters/` has the Screenbot character, colours and accessories (SVG).
