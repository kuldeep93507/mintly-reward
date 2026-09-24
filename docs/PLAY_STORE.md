# Publishing Ludo Mintly on Google Play

Do these steps in order. Everything marked **[YOU]** needs your own account or
decision; the rest is already set up in this repo.

## 1. Put the game server online **[YOU]**

`localhost` only works on your own computer (and phones on the same Wi-Fi via
your PC's IP). Players from the Play Store need a public **https** server.

Easiest: [Render](https://render.com) → New → Blueprint → pick this GitHub
repo. `render.yaml` creates the web service with a disk for the database.
Free instances sleep when idle; use a paid instance ($7/month) for a real
launch so coins and matches aren't interrupted. Any VPS with Docker works too
(see `server/README.md`).

Then in GitHub → repo **Settings → Secrets and variables → Actions → Variables**
add `SERVER_URL` = your server URL (for example `https://ludo-mintly.onrender.com`).

## 2. Create your upload key **[YOU]** (once; never lose it)

On any computer with Java:

```bash
keytool -genkeypair -v -keystore ludo-upload.jks -alias ludo -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 ludo-upload.jks > ludo-upload.b64    # macOS: base64 -i ludo-upload.jks -o ludo-upload.b64
```

Add these GitHub **Secrets** (same settings page, Secrets tab):

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | contents of `ludo-upload.b64` |
| `ANDROID_KEYSTORE_PASSWORD` | the keystore password you typed |
| `ANDROID_KEY_ALIAS` | `ludo` |
| `ANDROID_KEY_PASSWORD` | the key password (same as keystore password if you pressed Enter) |

Keep `ludo-upload.jks` and the passwords backed up somewhere safe. Never commit
them.

## 3. Build

GitHub → **Actions → Build Android app → Run workflow**. When it finishes,
download from the run's **Artifacts**:

- `ludo-mintly-release-aab` → the `.aab` you upload to Play Console
- `ludo-mintly-debug-apk` → install on your phone to test (it's named "Ludo Mintly (Test)" and can live next to the Play version)

Each run gets a higher `versionCode` automatically, which Play needs for every
new upload.

## 4. Privacy policy page **[YOU]**

Edit `docs/privacy-policy.html` and replace `[YOUR SUPPORT EMAIL]`. Then
GitHub → **Settings → Pages** → Source "Deploy from a branch", branch `main`,
folder `/docs`. The policy is then at
`https://kuldeep93507.github.io/mintly-reward/privacy-policy.html` (already
linked from the app's Settings screen).

## 5. Play Console **[YOU]**

1. Create a developer account at <https://play.google.com/console> (one-time
   US$25, identity verification).
2. **Create app** → name "Ludo Mintly", Game, Free.
3. **Store listing**
   - Short description: *Classic Ludo with friends, family and players online. Free coins every day!*
   - Full description: modes (vs Computer, Pass & Play, Online 2/4 players,
     Play with Friends via room code), daily rewards, emojis, leaderboards.
     Say that coins are free and have no cash value.
   - App icon: `docs/store/icon-512.png`
   - Feature graphic: `docs/store/feature-graphic-1024x500.png`
   - Phone screenshots (at least 2): `docs/screenshots/`
4. **App content**
   - Privacy policy: the URL from step 4.
   - Ads: No.
   - App access: all features available without login.
   - Content rating (IARC questionnaire): answer honestly. Players stake free
     virtual coins on matches, so answer the "simulated gambling" question
     truthfully. There's no free-text chat, only preset emojis and phrases.
   - Target audience: 13+ (keeps the app out of the Families programme).
   - Data safety: collects *Device or other IDs* (guest account), *User IDs /
     name* (nickname), *App activity: in-game progress*. Not shared with third
     parties, encrypted in transit, and users can request deletion (in-app +
     email).
   - Account deletion URL: the privacy policy URL (it explains in-app deletion
     and the email fallback).
5. **Closed testing** — new *personal* developer accounts must run a closed
   test with **at least 12 testers opted in for 14 days in a row** before they
   can apply for production. Create a Closed testing track, upload the AAB,
   add testers' Gmail addresses, share the opt-in link, and keep them
   installed for 14 days.
6. **Production** → apply for access → create a release with the latest AAB →
   roll out.

## Rules to stay inside

- Keep coins free: no buying coins with money, and no withdrawing them as
  money, gift cards or recharge. India's Online Gaming Act 2025 bans real-money
  games.
- Don't use "Ludo King" or other brands' names, logos or artwork in the app or
  listing.
- Every Play upload needs targetSdk 36 or higher from 31 Aug 2026 (already set).
