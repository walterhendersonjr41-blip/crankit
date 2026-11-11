# CrankIt: Real 2-Stroke Mechanic

A mobile-first PWA that walks homeowners, tree workers, and landscapers through cheap driveway fixes for 2-stroke chainsaws, weed eaters, leaf blowers, and hedge trimmers — and tells them honestly when the engine core is dead.

Nothing in this app needs a login or a server. Garage tools, fuel batches, and diagnostic history are stored in the browser (`localStorage`).

## What’s included

- **Diagnose** — all 6 decision trees, every step with cost, time, a color badge, **FIXED IT! (Save to Garage Log)** and **STILL BROKEN → next check**. Tree 4 branches on the wet test and on the compression/scoring check.
- **Carb & Tune** — interactive SVG of L / H / T-LA screws that animates direction and turn fraction for each symptom, plus a screw-head identifier (flathead, Double-D, Pac-Man, splined 21-tooth).
- **Fuel Mix** — 50:1, 40:1, and 32:1 calculator in fl oz, mL, and tablespoons, with custom can size and a 30/90-day batch freshness tracker.
- **My Garage** — fleet tracker with an optional sample fleet (2 chainsaws + 4 weed eaters).
- **Shop Meter** — four-question evaluator with green / amber / red banners.

Accuracy notes baked into the copy:

- Identify L, H, and T/LA by the letters stamped next to the screws. Do not assume L is always closest to the cylinder.
- Limiter caps on newer tools restrict travel. The 1.5-turn baseline varies by model — check the manual.
- Fire-safety warning on the carb-throat wet test (outdoors, no sparks or flames, extinguisher handy, wipe spills).
- Hot-muffler warnings, and disconnect the plug wire before chain/clutch work.
- Propane-torch screen cleaning is included, with a safety note.
- A short disclaimer: this is general guidance; follow the manufacturer’s manual.

## Develop

```bash
npm install
npm run dev
npm test
npm run build
```

Install the production build as a PWA from a phone (Add to Home Screen). The service worker and manifest live in `public/`.

## Turning on money features

All switches live in **`src/config/monetization.ts`**. They ship empty. The app works fully without them. Do not put personal names, phone numbers, addresses, or dates of birth in this file or the site.

### 1. Amazon Associates parts links

Every step that names a part already has a **Get this part** button. With `amazonAssociateTag` empty, the button opens a plain Amazon search for that part (no tag).

To turn on affiliate commissions:

1. Enroll in [Amazon Associates](https://affiliate-program.amazon.com/) (or your region’s program) and get a tracking tag, such as `yourtag-20`.
2. Set `amazonAssociateTag` to that tag.
3. Rebuild and redeploy. Links will append `tag=...`, and an FTC affiliate disclosure will appear in the footer.

### 2. CrankIt Pro ($4.99 one-time)

Pro unlocks:

- Unlimited garage tools (free plan is 2)
- Diagnostic history export and print
- Maintenance reminders (stale mix and overdue tunes)
- A printable carburetor tune sheet

`stripePaymentLink` is set to the live $4.99 Payment Link, so **Get Pro** opens real Stripe checkout. Do not edit the Payment Link in the Stripe dashboard from this project.

After paying, the buyer returns to the app and unlocks this device in one of two ways:

- **I paid — unlock this device** (honor system)
- An optional unlock-code field, if you later set `proUnlockCode`

**Limits (important):** there is no server-side verification yet. The app cannot check a Stripe receipt or session. The honor-system button will unlock Pro on that browser if the buyer says they paid. A shared `proUnlockCode` is also only checked in the client. If you later want automatic unlock after payment, you will need a small backend or a Stripe checkout return URL of your own.

If `stripePaymentLink` is cleared, the button falls back to **Coming soon** and no checkout runs.

### 3. Unlock-code stub (manual fulfillment)

You can set `proUnlockCode` to a string of your choosing, then give that exact code to a customer. They type it under Get Pro. Unlock is stored only on that device in `localStorage` (`crankit.proUnlocked`).

Leave `proUnlockCode` empty until you have a code you actually want to honor. While it is empty, any typed code is rejected (the honor-system button still works after a live checkout).

### 4. Local repair-shop sponsor

On a Shop Meter **red** result, a sponsor slot can appear. It is hidden while `localRepairShop.name` is empty. Fill in `name` (required to show), plus optional `phone`, `url`, and `blurb`. Do not put a private personal number here unless that shop agreed to be listed.

## Deploy (free GitHub Pages)

The live app is a static SPA at [https://walterhendersonjr41-blip.github.io/crankit/](https://walterhendersonjr41-blip.github.io/crankit/). Vite `base` is `/crankit/`. A `404.html` copy of `index.html` is the SPA fallback so `/crankit/privacy` works. Pushing to `main` runs the GitHub Actions Pages workflow (test, build, deploy). No paid plan is required.

```bash
npm test
npm run build
```

An older copy may still exist on a previous host. This repo is the source of truth; do not treat that older site as current.

## License / positioning

A practical driveway mechanic app. Not affiliated with any saw or trimmer manufacturer.

## Ask Mechanic chat

A safety-orange **Ask Mechanic** button (bottom-right, above the tab bar) opens the **Master 2-Stroke Mechanic AI** drawer. Answers come from a free, offline, client-side rule engine — no paid API. It greets you with the tool names saved in My Garage, follows no-shop-first checks, and only points to a shop when you report zero compression or visible vertical scoring.

Quick-tap chips cover the common questions. Chat is saved on the device in `localStorage`.

A future remote LLM can be pointed at `src/config/mechanicAi.ts` (`endpoint` / `apiKey`). Both ship empty. Do not turn that on without checking the cost first.

## Local learning (this device only)

The mechanic records what worked in `localStorage` (`crankit.mechanicLearning` and `crankit.mechanicTips`) — no server, no cost:

- Each Diagnose **FIXED IT** is saved against that garage tool and symptom.
- Bot answers can be rated **That fixed it** or **Didn't help**.
- Later answers put proven fixes first and say *Last time your [tool] did this, [fix] worked.*
- **Teach the mechanic** lets you add a symptom + fix tip that is matched on later questions.
- **Reset learning** clears all of that on this device. **Clear chat** only clears the conversation.

A future shared-learning hook lives in `src/config/mechanicSync.ts` (`endpoint` / `apiKey`). Both ship empty, so nothing is uploaded.

## Brand notes

A built-in table covers STIHL, Husqvarna, ECHO, Poulan, Craftsman, Ryobi, and Homelite. Each listed mix ratio, spark plug, carb maker, or screw-head type was taken from a manufacturer manual or official support page (URLs are in `src/data/brands.ts`). Unverified facts are omitted rather than guessed. The bot and My Garage always include a check-your-manual note. Pick a brand on a garage tool (or put the brand in the tool name) so answers are tailored to that maker.

## Share a fix (opt-in, anonymous)

After Diagnose **FIXED IT**, a **That fixed it** bot rating, or a **Teach the mechanic** tip, a **Share this fix with CrankIt** button can open a prefilled email. A one-line consent note is shown and nothing is sent until the user confirms and then sends the message from their email app.

The message goes to `waltinvents@agentmail.to`. The body includes only: tool type, brand/model if entered, symptom, fix, worked (yes/no), app version, and date. It does not include name, phone, garage tool nickname, IP, or device IDs. Because this uses the user’s email app, the **sender address is visible** to the reviewer. The privacy page says this plainly.

A short privacy page lives at `/crankit/privacy`.

Reviewed submissions can be copied into `src/data/learnedRules.ts` in a later release. That file ships empty. The service worker (`crankit-v` + app version) uses network-first HTML so installed apps pick up a new release the next time they open the app.

### How to review submissions (weekly)

1. Open the House inbox at `waltinvents@agentmail.to`.
2. Look for messages whose subject starts with `CrankIt shared fix:`.
3. Read the anonymous fields in the body (tool type, brand/model, symptom, fix, worked, app version, date). The sender address will be visible; do not copy that address into the app or into `learnedRules.ts`.
4. If a fix is safe, accurate, and not just a copy of an existing tree, add a curated entry to `src/data/learnedRules.ts`, bump `APP_VERSION` in `src/config/appInfo.ts` (and the `CACHE` name in `public/sw.js` to `crankit-v` + that version), then push to `main`. Users get the new rules on their next open.


## Acoustic RPM & Carb Sound Tuner

On the **Carb & Tune** tab, **Listen to My Engine (Live RPM & Tune Check)** estimates RPM on the device from the firing frequency (Hz × 60) using the Web Audio API. Nothing is recorded or uploaded. Detection is band-limited (~25–250 Hz) with autocorrelation and harmonic peak picking, then smoothed. A 2-second full-throttle capture with countdown, a no-mic simulator, and general idle / WOT verdicts are included. Every screw instruction repeats the stamped-letter note.

If My Garage includes a recognized model number, the tuner uses official idle and max/WOT figures from `src/data/modelSpecs.ts` (each entry cites a manufacturer manual or official spec page). Unverified numbers are omitted. Current Craftsman WC215 / CMXGTAMDZ20C manuals do not list RPM, so those fall back to the general ranges plus an optional “max RPM from your manual” field. The Ask Mechanic chip **Listen to my engine** opens the tuner.
