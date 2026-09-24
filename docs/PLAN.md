# Ludo Mintly — research & plan

## 1. What players expect (research)

Ludo King is the reference for what a Ludo game on the Play Store needs to feel
complete. From its store listing and popular competitors, players expect:

| Area | Expected features | v1 (this repo) |
|---|---|---|
| Modes | Play vs Computer, Local / Pass & Play, Online with random players, Private room with friends (room code) | All four |
| Online | 2 or 4 players, quick matchmaking, entry fee in coins, winner takes the pot, turn timer, auto-move / kick after missed turns, reconnect after a network drop | All of these; empty seats are filled with clearly marked computer players if no one joins within ~12 s |
| Economy | Starting coins, daily reward streak, free coins when broke, coin prizes | All of these. Coins are **free virtual coins only** (see §4) |
| Social | Emoji reactions and quick chat in game, share room code | Emoji + preset quick chat (no free-text chat, so no moderation needed), Android share sheet |
| Profile | Name, avatar, level/XP, wins, win % | All, plus a leaderboard |
| Feel | Animated dice, token hopping square by square, capture animation, sounds, vibration | All; sounds are synthesised in-app (no licensed audio files) |
| Extras (later) | Snakes & Ladders, themes/dice skins, voice chat, tournaments, Google/Facebook login, push notifications, ads | Not in v1 — see roadmap |

We do **not** copy Ludo King's name, logo, artwork or layout (trademark and
copyright). Board rules are public domain; everything visual here is original.

## 2. Architecture

```
┌────────────── Android app (Capacitor) ──────────────┐        ┌──────── Game server (Node.js) ────────┐
│ React UI  ─ screens, board SVG, animations, sounds   │  REST  │ /api/auth/guest, /api/me, /api/daily,  │
│ @ludo/engine ─ rules + bots for offline modes        │◄──────►│ /api/free-coins, /api/leaderboard      │
│ socket.io-client ─ online games                      │  WS    │ Socket.IO: queue, rooms, games         │
└──────────────────────────────────────────────────────┘◄──────►│ @ludo/engine ─ authoritative rules     │
                                                                │ SQLite (node:sqlite) ─ users, coins    │
                                                                └────────────────────────────────────────┘
```

- **engine/** — pure TypeScript Ludo rules (board geometry, legal moves,
  captures, bonus turns, three-sixes rule, finishing order), the computer
  player, and the app↔server protocol types. Shared by app and server so both
  always agree on the rules.
- **server/** — authoritative multiplayer server. The server rolls the dice
  and validates every move, so a modified app cannot cheat. Coins live only
  on the server with a ledger of every change. Runs on `localhost` for
  development; deploy the same code (Docker / Render) for real players.
- **app/** — React + Vite UI packaged as a native Android app with
  Capacitor 8 (targets Android 16 / API 36 as Play requires from 31 Aug 2026).
- **.github/workflows/android.yml** — builds the debug APK, release APK and
  the signed AAB for Play Console on every push.

## 3. Game rules implemented

- 4 tokens each; a 6 is needed to bring a token out.
- Rolling a 6, capturing, or getting a token home gives another roll.
- Three 6s in a row: the turn is lost.
- Landing on an opponent sends it back to its yard, except on the 8 safe
  squares (4 start squares + 4 stars).
- Exact roll needed to reach home. The game ends when only one player is left;
  in 2-player games the first player home wins.
- Online: 15 s per turn. A missed turn is auto-played; 3 misses in a row
  remove the player (they forfeit).
- Prizes: 2 players — winner gets 2× entry. 4 players — 1st gets 3× entry,
  2nd gets the entry back.

## 4. Coins and the law (important)

India's *Promotion and Regulation of Online Gaming Act, 2025* bans online
real-money games, and treats virtual coins that are "equivalent or convertible
to money" as stakes. So in this app:

- Coins can only be **earned free** (starting bonus, daily reward, free
  top-ups, winning matches).
- Coins **cannot be bought** and **cannot be withdrawn or exchanged** for
  money, gift cards or rewards.

Adding coin purchases or cash-out later can turn this into a banned money
game. Get legal advice before you add either.

## 5. Milestones

1. ✅ Rules engine + tests
2. ✅ Game server: guest accounts, coins ledger, daily/free coins, quick match,
   private rooms, authoritative turns, timers, reconnect, bots fill-in, leaderboard
3. ✅ App: all screens, offline modes, online modes, animations, sound, haptics
4. ✅ Android project, icon/splash, signing, CI builds (APK + AAB)
5. ⏭ Deploy the server publicly (Render or a VPS) and set `SERVER_URL`
6. ⏭ Closed test on Play Console (12 testers × 14 days for new personal accounts)
7. ⏭ Production release

## 6. Roadmap after v1

- Google sign-in so progress survives reinstalling (guest accounts are tied to the device)
- Push notifications for friend invites (Firebase Cloud Messaging)
- Rewarded ads for free coins (AdMob) — needs Data safety + ads declaration updates
- Snakes & Ladders mode, dice/board themes, tournaments, friend list
- Hindi language UI
