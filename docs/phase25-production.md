# Liflow Phase 2.5 production runbook

## 1. Clean clone

Required locally: Git, Node.js 22.13 or newer, npm.

```powershell
git clone <repository-url> liflow
cd liflow
npm ci
npm run typecheck
npm test
npm run lint
npm run build
npm run deploy:dry-run
```

The build must not require `.openai/hosting.json`, `.sites-runtime`, a local absolute path, or an ignored file. D1/R2 are optional compatibility bindings for the legacy `/api/entities` route; the Firebase Liflow client does not depend on them.

## 2. Cloudflare Workers deployment

In Cloudflare Workers & Pages, connect the GitHub repository and create a Workers Builds project.

- Root directory: repository root
- Build command: `npm ci && npm run build`
- Deploy command: `npx wrangler deploy --config dist/server/wrangler.json`
- Node version: 22 or newer
- Production branch: `main`

For a first deployment from a trusted terminal, sign in with `npx wrangler login`, then run `npm run deploy`. The resulting `https://<worker>.<account>.workers.dev` URL is the production origin. Add a custom domain later if desired.

Deploy the notification scheduler separately:

```powershell
npx wrangler deploy --config wrangler.notifications.jsonc
npx wrangler secret put FIREBASE_PROJECT_ID --config wrangler.notifications.jsonc
npx wrangler secret put FIREBASE_CLIENT_EMAIL --config wrangler.notifications.jsonc
npx wrangler secret put FIREBASE_PRIVATE_KEY --config wrangler.notifications.jsonc
npx wrangler secret put APP_ORIGIN --config wrangler.notifications.jsonc
```

`APP_ORIGIN` is the exact HTTPS production origin without a trailing slash.

## 3. Variables and secrets

Never commit values from `.env.production`, a service-account JSON file, a Discord Bot token, or a private key. `.env.production.example` only lists names.

| Name | Kind | Required for | Where |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Public | Web Push subscription | Build variable |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Secret | Discord Interaction Firestore access | Worker secret |
| `DISCORD_PUBLIC_KEY` | Secret | Interaction signature verification | Worker secret |
| `DISCORD_TRUSTED_CHANNEL_IDS` | Variable | Read allow-list | Worker variable/secret |
| `DISCORD_ALLOWED_USER_IDS` | Variable | Mutation allow-list | Worker variable/secret |
| `LIFLOW_FIREBASE_UID` | Secret | Target Liflow user | Worker secret |
| `LIFLOW_BUILD_ID` | Variable | Diagnostics | Optional build variable |
| `APP_ORIGIN` | Variable | Notification click URL | Scheduler secret |

Use Cloudflare Dashboard > Worker > Settings > Variables and Secrets, or `npx wrangler secret put NAME --config dist/server/wrangler.json`. `npm run env:check` checks a local environment without printing values; Dashboard-only secrets cannot be detected locally.

## 4. Firebase

1. Firebase Authentication: enable the intended provider and add the Cloudflare hostname under Authorized domains.
2. Firestore: deploy `firebase/firestore.rules` and verify a signed-in user can access only `users/{uid}` plus their own notification jobs.
3. Cloud Messaging: create a Web Push certificate and set its public key as `NEXT_PUBLIC_FIREBASE_VAPID_KEY` during the production build.
4. Create a least-privilege service account used only by the Discord route and scheduler; store its one-line JSON as a Cloudflare secret.
5. In two signed-in browsers, create/edit the same Task, Plan, Actual, Execution Session, and Money record. Confirm live sync, schema v7, conflict UI, and no silent overwrite.
6. Seed a pre-v7 test user only, sign in, and confirm migration backup is `ready`/`migrated` before checking migrated entities. Never use production data for destructive migration experiments.

## 5. Discord Developer Portal

1. Set Interactions Endpoint URL to `https://<production-origin>/api/discord/interactions`.
2. Copy General Information > Public Key to the Cloudflare `DISCORD_PUBLIC_KEY` secret.
3. Put permitted Channel IDs in `DISCORD_TRUSTED_CHANNEL_IDS`; put mutation-capable User IDs in `DISCORD_ALLOWED_USER_IDS`.
4. Set `LIFLOW_FIREBASE_UID` to the target Firebase Authentication UID.
5. Register/sync the commands using the existing Phase 2.45 Discord command setup.
6. Verify `/schedule`, `/tasks`, `/money`, one mutation, and bulk input. Also verify an untrusted channel, an untrusted mutation user, an invalid signature, and output over 1900 characters.

The interaction endpoint uses the raw request body with Web Crypto Ed25519 verification and Firestore REST, so it does not depend on Node-only Firebase Admin in the Cloudflare request path.

## 6. PWA, mobile, offline, notifications

Test at least one physical phone over HTTPS.

1. Open the production URL, sign in, and install Liflow from the browser menu.
2. Launch standalone and inspect Settings > Diagnostics. Confirm Service Worker is `controlled`, schema is v7, Firebase is synchronized, and required configuration flags are set.
3. Exercise Now, Calendar day/week/month, Task, Quick Capture, Actual edit/delete, Money, and a running Execution Session across screen lock/reopen.
4. Turn network off after one successful load. Confirm the shell reopens and explains offline sync state; reconnect and confirm Firestore catches up without duplicate Plans.
5. Publish a new build. Confirm the update becomes available and can be applied from Diagnostics.
6. Enable notifications only from the explicit Settings button. Confirm token creation, foreground delivery, background delivery, closed-PWA delivery, dedupe, and notification click navigation.
7. Sign out or disable notifications and confirm the stored device subscription is disabled. Sign in as another user and confirm tokens/data are not crossed.

Safari/iOS Web Push requires an installed Home Screen PWA and user-triggered permission. Notification delivery also requires the scheduler Worker and its four secrets.

## 7. Deployment smoke

Against the real HTTPS URL verify:

- `/` returns 200 and contains Liflow HTML.
- `/manifest.webmanifest`, `/sw.js`, and all 192/512 icons return 200.
- `/api/health` returns booleans only, never credentials.
- unsigned POST `/api/discord/interactions` returns 401.
- signed Discord PING returns type 1 through Discord Developer Portal validation.
- Firebase login/read/write and two-client sync work.
- PWA install, offline reopen, reconnect, update, push receipt, and notification click work.

Record date, device/OS/browser, production URL, build ID, tester, and pass/fail evidence. External device, account, Dashboard, and live delivery checks cannot be truthfully completed by an automated local run.
