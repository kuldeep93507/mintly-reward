# Ludo Mintly ko Google Play par daalna — step by step

Upar se neeche ek-ek karke karo. **[AAP]** wale kaam aapke account/decision ke hain; baaki repo me pehle se ready hai.
Store listing ka text `docs/store/listing.md` me hai.

## 0. Jo already ready hai (check kar liya)

- targetSdk / compileSdk **36** (31 Aug 2026 ke baad har upload ke liye zaroori), minSdk 24.
- Coins free hain: na khareed sakte, na cash/gift card me badal sakte → India ke Online Gaming Act 2025 me
  "online social game" (online money game nahi). **Kabhi bhi coin purchase ya cash-out mat jodna.**
- No ads, no third-party analytics/SDK, no free-text chat (sirf emoji aur fixed phrases).
- In-app **Delete account** (Settings) + bina app ke email se deletion (privacy policy `#delete-account`).
- Pehli baar khulne par **age screen** (13+), **break reminder** (1 ghante par), **Contact us / Report a problem**.
- Online matches me dice server random deta hai; owner ka online control `ONLINE_GAME_CONTROL` se **default band**.
- Icon 512×512 aur feature graphic 1024×500: `docs/store/`.

## 1. Support email chuno **[AAP]**

Ek email jo aap roz check karte ho (player complaints, deletion requests, Play Console contact).
- `docs/privacy-policy.html` me 3 jagah `[YOUR SUPPORT EMAIL]` ko us email se badlo.
- GitHub → repo **Settings → Secrets and variables → Actions → Variables** me `SUPPORT_EMAIL` = wahi email
  (app ke "Contact us" button me yahi jaata hai).

## 2. Game server online karo **[AAP]**

Players ke liye public **https** server chahiye. Render → New → Blueprint → ye repo. `render.yaml` sab set karta hai
(disk, `TRUST_PROXY=1`, **`ONLINE_GAME_CONTROL=0`**). Free plan so jaata hai; launch ke liye paid instance (~$7/mahina).
- Render dashboard se `OWNER_KEY` copy karke safe rakho (Ludo Admin login).
- GitHub Variables me `SERVER_URL` = server ka https URL (jaise `https://ludo-mintly.onrender.com`).
- **Production server par `ONLINE_GAME_CONTROL` kabhi `1` mat karna** (asli players ke match badalna = policy violation;
  privacy policy bhi players ko ye promise karti hai).

## 3. Upload key banao **[AAP]** (ek baar; kabhi mat khona)

```bash
keytool -genkeypair -v -keystore ludo-upload.jks -alias ludo -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 ludo-upload.jks > ludo-upload.b64
```

GitHub **Secrets**: `ANDROID_KEYSTORE_BASE64` (b64 file ka content), `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS` = `ludo`, `ANDROID_KEY_PASSWORD`. `.jks` aur passwords ka backup rakho, commit kabhi nahi.

## 4. Privacy policy live karo **[AAP]**

Kaam `main` branch par merge hone ke baad: GitHub → **Settings → Pages** → Deploy from a branch → `main` → `/docs`.
URL: `https://kuldeep93507.github.io/mintly-reward/privacy-policy.html` (app ki Settings me yahi link hai).
Browser me khol ke check karo ki email sahi dikh raha hai.

## 5. Build

GitHub → **Actions → Build Android app → Run workflow**. Artifacts:
- `ludo-mintly-release-aab` → Play Console me upload
- `ludo-mintly-debug-apk` → apne phone par test
- `ludo-admin-debug-apk` → sirf aapke liye (Ludo Admin). **Ise Play Store par kabhi mat daalna.**

Agar log me "SERVER_URL is not https" warning aaye to AAB upload mat karna, pehle step 2 pura karo.

## 6. Play Console **[AAP]**

1. <https://play.google.com/console> par developer account ($25 ek baar, ID verification).
2. **Create app** → "Ludo Mintly", Game, Free. Declarations: policies accept, US export laws accept.
3. **Store listing**: text `docs/store/listing.md` se; icon `docs/store/icon-512.png`; feature graphic
   `docs/store/feature-graphic-1024x500.png`; phone screenshots kam se kam 2 (behtar 4–8) — naye screenshots
   test phone se lo (home, game board, result screen, online lobby). Admin app ke screenshots **mat** daalna.
   Category: **Board**. Tags: Board, Ludo, Multiplayer.
4. **App content** — neeche wale exact jawab.
5. **Closed testing (zaroori)**: naye personal account par **kam se kam 12 testers, lagatar 14 din** opted-in.
   Closed testing track banao → AAB upload → testers ke Gmail list → opt-in link share → sab 14 din install rakhein
   aur thoda khelein. Beech me opt-out kiya to unka count nahi hoga.
6. 14 din baad **Apply for production** → release banao → roll out. Review me kuch din lag sakte hain.

## 7. App content — exact jawab

**Privacy policy:** step 4 wala URL.

**Ads:** No, my app does not contain ads.

**App access:** All functionality is available without special access (guest account apne aap banta hai).

**Content rating (IARC questionnaire)** — category *Game*:
- Violence / fear / sexuality / language / drugs: **No** (Ludo aur Snakes & Ladders, cartoon avatars).
- Real-money gambling: **No**.
- **Simulated gambling:** app me casino/slot/cards nahi hai; players online match me *free virtual coins* entry
  ke roop me lagate hain jo khareede ya cash nahi kiye ja sakte. Question ko sach-sach padh ke jawab do; agar
  "users can bet virtual currency on game outcome" jaisa poochha jaye to **Yes** bolo. Rating thodi upar aa sakti hai,
  jo theek hai — galat jawab dena app hatwa sakta hai.
- Users can interact / communicate: **Yes** — sirf preset emoji aur fixed phrases (free text chat nahi).
- Shares user location: **No**. Digital purchases: **No**.

**Target audience and content:** age groups **13–15, 16–17, 18+** (under 13 mat chunna). "Appeals to children?"
→ No (app pehli launch par age poochta hai aur under-13 ko rokta hai).

**News app:** No. **COVID / Government / Financial features:** No. **Health:** No.

**Data safety:**
| Sawal | Jawab |
|---|---|
| Collects or shares user data? | Collects: Yes. Shares with third parties: **No** |
| Encrypted in transit? | Yes (https server zaroori) |
| Users can request deletion? | Yes |
| Account creation | "Account created automatically (guest)". **Delete account URL:** `…/privacy-policy.html#delete-account` |
| Personal info → **Name** (nickname) | Collected; purpose: App functionality, Account management; not optional-shared |
| Personal info → **User IDs** (Player ID, account id) | Collected; App functionality, Account management, Fraud prevention |
| App activity → **Other user-generated content / in-game actions** (moves, coins, game progress, offline game board) | Collected; App functionality, Analytics = No |
| Device or other IDs (random app-generated device ID) | Collected; App functionality, Account management, Fraud prevention |
| Location, contacts, photos, messages, financial, health | **Not collected** |

IP address sirf connection ke liye server dekhta hai aur logs 30 din tak — ise "Device or other IDs" ke saath
Fraud prevention me cover karo.

## 8. Rules jo hamesha follow karne hain

- Coins sirf free: coin khareedna, cash/gift card/recharge me badalna **kabhi nahi** (India me online money game ban).
- Production par `ONLINE_GAME_CONTROL=0`. Asli players ke online match ka dice ya winner kabhi mat badlo.
- Listing ya app me "Ludo King" ya kisi aur brand ka naam/logo/artwork nahi.
- "Guaranteed win", "earn money", "real cash" jaise shabd listing me kabhi nahi.
- Player complaints ka jawab 24 ghante me acknowledge, 15 din me solve (privacy policy me yahi promise hai).
- Har naye Play upload par targetSdk latest requirement ke hisaab se (abhi 36).
