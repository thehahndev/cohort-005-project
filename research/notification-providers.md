# Which notification providers fit Cadence?

Research for [#9](https://github.com/thehahndev/cohort-005-project/issues/9) (map: [#7](https://github.com/thehahndev/cohort-005-project/issues/7)).
Sources read on 2026-11-10. All pricing figures come from the vendors' own pricing pages on that date and can change.

## Context that shapes the answer

- Cadence runs React Router in framework mode with SSR (`react-router` 8.3.0 in `package.json`, not v7), with Drizzle on a local SQLite file (`better-sqlite3`).
- Users live in `users` (`app/db/schema.ts`) with a unique `email` and a `role`. The DevUI panel (`app/components/dev-ui.tsx`) switches the session user by posting to `/api/switch-user`. Any provider has to accept "the current user is whoever the DevUI picked", with no login against the provider.
- **Hard requirement:** local dev and tests run without the provider's cloud.

## Summary table

| Option | In-app React SDK | Live transport | Email + unsubscribe | Preferences | Free tier (2026-11-10) | Runs without vendor cloud? |
| --- | --- | --- | --- | --- | --- | --- |
| **Build it ourselves** (SQLite + Resend/Postmark) | Our own components (shadcn/radix already in repo) | SSE from a resource route, or polling via `useRevalidator`/fetcher | We render templates and add the link and `List-Unsubscribe` headers ourselves | Our own table | Resend: 3,000/mo, 100/day. Postmark: 100/mo | **Yes.** SQLite is already local. Email goes to Mailpit or a console/in-memory transport |
| **Novu** | `@novu/react` `<Inbox />` with bell and preferences | WebSocket (socket.io self-hosted, PartySocket cloud) | Email step with editor. **No automatic unsubscribe link** | Global + per-workflow + per-channel; "critical" workflows | 10,000 workflow runs/mo, **5 workflows**, 24h activity retention | **Partly.** The MIT Community edition runs via Docker Compose, but needs MongoDB, Redis, API, worker, WS and dashboard. That is heavy for tests |
| **Knock** | `@knocklabs/react` (feed, popover, bell, preference hooks) | WebSocket (`listenForUpdates`) | Email channel. Configurable one-click commercial unsubscribe | Categories, workflows, channel types | 10,000 messages/mo, Knock branding | **No.** Cloud only. "Sandbox mode" still runs in Knock's cloud |
| **Courier** | `@trycourier/courier-react` Inbox and Toast | WebSocket | Email with hosted preference page and `unsubscribe` URL variable | Topic-based, hosted page | 10,000 sends/mo | **No.** Cloud only |
| **MagicBell** | `@magicbell/react` (Inbox, FloatingInbox, UserPreferences) | Not stated on the pages read | Email via SES, SendGrid, SMTP and others | `UserPreferences` component by category/channel | 1,000 deliveries/mo, 1 project | **No.** Cloud only |
| **SuprSend** | In-app feed (branded on free tier) | n/a (not investigated in depth) | Yes | Yes | 10,000 notifications/mo, SuprSend branding | **No.** Self-hosting is Enterprise only |

## Per option

### Build it ourselves: SQLite table + email sender

- **In-app feed:** a `notifications` table (recipient user id, kind, payload, created_at, read_at, maybe seen_at/archived_at) in the existing SQLite database, read in the app layout loader. The UI can use the existing shadcn/radix primitives. SSR works well here: the unread count and first page render on the server with no client-only SDK and no hydration flash.
- **Live delivery:** React Router has no built-in SSE helper. A resource route (a module exporting a `loader` and no default component) can return any `Response`, so it can return a `text/event-stream` `ReadableStream` ([React Router: resource routes](https://reactrouter.com/how-to/resource-routes)). The simpler fallback is polling with a fetcher. With a single Node process and SQLite, an in-process event emitter is enough to fan out to SSE connections. Several instances would need a shared pub/sub, which Cadence does not have today.
- **Read/unread:** columns on our own table, changed by an `action`. Forms and fetchers revalidate loaders automatically ([resource routes doc](https://reactrouter.com/how-to/resource-routes)).
- **Email:**
  - Resend free: 3,000 emails/month and 100/day, 3 domains. Pro is $20/mo for 50,000 ([resend.com/pricing](https://resend.com/pricing), 2026-11-10). For API (non-broadcast) sends, you must add your own visible unsubscribe link and the `List-Unsubscribe` / `List-Unsubscribe-Post` headers (same page).
  - Postmark free: 100 emails/month with no overages. Basic is $15/mo for 10,000, then $1.80 per 1,000. It separates transactional and broadcast streams and handles suppression ([postmarkapp.com/pricing](https://postmarkapp.com/pricing), 2026-11-10).
  - Templates are ours to build, for example as plain functions or with an email-rendering library.
- **Preferences:** a `notification_preferences` table (user, kind, channel, enabled). The unsubscribe link is a signed token that flips one row.
- **Local dev and tests:** nothing to stub for in-app, because it is the same SQLite file the seed and Vitest already use. For email, put the sender behind a small interface. Use a console or in-memory transport in tests, and optionally [Mailpit](https://mailpit.axllent.org/) for dev. Mailpit is a "zero-dependency ... email testing tool & API" that acts as an SMTP server, with a web UI and a REST API for integration tests. DevUI user switching works for free because a notification is just a row keyed by `users.id`.
- **Identity sync:** none. Recipients are the `users` table.
- **Cost:** our own build and maintenance time for the feed UI, live transport, preferences, digest/grouping, and retention. No vendor fees.

### Novu (the only third party with a real self-host story)

- **SDK:** `@novu/react` `<Inbox />` takes an application identifier and a `subscriberId`. It includes a bell, a real-time unread count, read state synced to the backend, and a preferences UI. It requires React 18 or later and supports React 19 ([Novu Inbox overview](https://docs.novu.co/platform/inbox/overview)). The pages read give no SSR guidance, so treat it as a client-only island.
- **Live:** a WebSocket service. Self-hosted uses socket.io and cloud uses PartySocket, chosen by URL or `VITE_WEBSOCKET_TYPE` ([run locally](https://docs.novu.co/community/run-in-local-machine)). Self-hosters pass `backendUrl`/`socketUrl` (some examples say `apiUrl`, and the docs are inconsistent) ([@novu/react](https://docs.novu.co/platform/sdks/react), [deploy with Docker](https://docs.novu.co/community/self-hosting-novu/deploy-with-docker)).
- **Email and unsubscribe:** "By default, Novu does not add any unsubscribe links to the email". You build a tokenized link that calls the preferences API ([Novu preferences](https://docs.novu.co/platform/concepts/preferences)).
- **Preferences:** global, per-workflow and per-channel. Workflows marked critical (`readOnly`) cannot be opted out of (same page).
- **Pricing (2026-11-10, [novu.co/pricing](https://novu.co/pricing)):**
  - Free: $0 for 10,000 workflow runs/mo, **up to 5 workflows**, 2 environments, 3 team members, 24-hour activity retention.
  - Pro: from $30 (30,000 runs, 7 days retention).
  - Team: from $250.
  - Overage: $1.20 per 1,000 runs.
  - The 5-workflow cap matters if each Notification kind is its own workflow.
- **Local / self-host:**
  - The core is MIT-licensed. The `enterprise` folder is under a commercial license ([github.com/novuhq/novu](https://github.com/novuhq/novu)).
  - The Community edition is deployed with a Docker Compose file: API, worker, WS, dashboard, MongoDB, and Redis. Images such as `ghcr.io/novuhq/novu/api:3.19.0` are pinned to one version ([deploy with Docker](https://docs.novu.co/community/self-hosting-novu/deploy-with-docker)).
  - A single-VM install needs 4 vCPU and 8 GB RAM ([self-hosting overview](https://docs.novu.co/community/self-hosting-novu/overview)).
  - Community lacks snooze, branding removal, email activity tracking, custom environments, environment variables, and translations, and allows **1 team member** ([self-hosted vs cloud](https://docs.novu.co/community/self-hosted-and-novu-cloud)).
  - **Verdict:** it can run without Novu's cloud, but every developer and every CI test run then needs a six-container stack. `npm run test` against a SQLite file would gain Mongo and Redis dependencies.
- **Identity:** subscribers are keyed by `subscriberId`. The Inbox creates them on first session. Updating a profile from the client needs an HMAC `subscriberHash` ([Inbox overview](https://docs.novu.co/platform/inbox/overview)). In DevUI, `subscriberId = users.id` works, but every seeded user needs syncing or lazy creation.

### Knock

- **SDK:** `@knocklabs/react` provides `NotificationFeed`, `NotificationFeedPopover`, `NotificationIconButton`, preference guides, and headless hooks ([Knock React overview](https://docs.knock.app/in-app-ui/react/overview)). Real-time works through the feed client's `listenForUpdates` WebSocket ([FeedClient reference](https://docs.knock.app/in-app-ui/javascript/sdk/feed-client)). The pages read give no SSR guidance, so it is client-side.
- **Auth:** without enhanced security, "a request with your public key can act as any user". With it, the backend signs an RS256 JWT (`sub` = user id) with `KNOCK_SIGNING_KEY` ([security and authentication](https://docs.knock.app/in-app-ui/security-and-authentication)). That fits SSR: mint the token in the root loader.
- **Preferences and unsubscribe:** PreferenceSets by category, workflow, channel and channel type. Configurable one-click unsubscribe for commercial messages updates the default set ([preferences overview](https://docs.knock.app/preferences/overview)).
- **Identity:** an upsert identify (`PUT /v1/users/{id}`), bulk identify, or inline identification on trigger. Only `id` is required. Email is needed for email steps ([identifying recipients](https://docs.knock.app/managing-recipients/identifying-recipients)).
- **Pricing (2026-11-10, [knock.app/pricing](https://knock.app/pricing)):** Free is $0 for 10,000 messages/mo, with in-app feeds, email, preferences, and 30-day logs, but no branding removal. Over the limit Knock contacts you, with no hard cap. Starter is $250/mo for 50,000, then $0.005 each.
- **Local:** no local runtime. Testing options are the cloud test runner, `settings.sandbox_mode`, and `settings.skip_delay`, all executed by Knock ([testing workflows](https://docs.knock.app/send-notifications/testing-workflows)). The CLI pulls workflows and templates into files but does not execute them. **Fails the hard requirement** unless we hide Knock behind our own adapter and fake it in dev and tests. In that case the fake is effectively the build-it-ourselves option anyway.

### Courier

- **SDK:** `@trycourier/courier-react` Inbox and Toast. They "support Next.js but render client-side only" and need `'use client'`. Real-time comes from `listenForUpdates()` opening a WebSocket. The backend mints a JWT with scopes `inbox:read:messages inbox:write:events` and the client calls `signIn({ userId, jwt })` ([Courier React docs](https://www.courier.com/docs/sdk-libraries/courier-react-web)). Read and archive state syncs across devices ([Inbox overview](https://www.courier.com/docs/platform/inbox/inbox-overview)).
- **Email and unsubscribe:** a hosted preference page and per-user `urls.unsubscribe` / `urls.preferences` template variables. `List-Unsubscribe` headers are emitted only through SendGrid ([hosted preference page](https://courier.com/docs/platform/preferences/hosted-page)).
- **Pricing (2026-11-10, [courier.com/pricing](https://www.courier.com/pricing)):** Developer is free for 10,000 sends/mo. Business is $0.005 per send.
- **Local:** no local or offline option is documented. **Fails the hard requirement.**

### MagicBell

- **SDK:** `@magicbell/react` with ContextProvider, Inbox (read/unread, pagination), FloatingInbox, ToastContainer, and UserPreferences. Auth uses a server-minted User JWT ([MagicBell React](https://www.magicbell.com/docs/libraries/magicbell-react)). Email goes through SES, Mailgun, SendGrid or SMTP ([docs index](https://www.magicbell.com/docs)).
- **Pricing (2026-11-10, [magicbell.com/pricing](https://www.magicbell.com/pricing)):** Builder is $0 for 1,000 deliveries/mo and 1 project. Startup is $249/mo for 50,000. The free tier is the smallest of the group.
- **Local:** none documented. **Fails the hard requirement.**

### SuprSend (other serious contender, checked briefly)

- Free is $0 for 10,000 notifications/mo, with an in-app feed carrying SuprSend branding. Essentials is $100/mo for 50,000. Self-hosting is Enterprise only ([suprsend.com/pricing](https://www.suprsend.com/pricing), 2026-11-10). **Fails the hard requirement** on any affordable plan.

## Recommendation

**Leading candidate: build it ourselves.** Store Notifications in a SQLite table, keep preferences in our own table, and send email through Resend behind a small sender interface. Use a console or in-memory transport in tests and Mailpit in dev.

Why:

1. **It is the only option that meets the hard requirement with zero extra infrastructure.** In-app Notifications are rows in the same SQLite file the seed, DevUI and Vitest already use. DevUI user switching just works because the recipient is `users.id`, with no identity sync, signed tokens, or provider subscriber creation.
2. **It is the best SSR fit.** The unread count and inbox render in loaders. Every vendor SDK checked (Knock, Courier, Novu, MagicBell) is a client-side island that authenticates from the browser.
3. **The vendors' main extras are things Cadence still has to decide anyway.** Unsubscribe links are manual on Novu, and on Courier outside SendGrid. Digests and grouping, and time-based nudges (no job runner), are open questions on the map either way.
4. **Cost:** Resend's free 3,000/mo (100/day) covers transactional email at Cadence's size. There is no workflow or message cap on in-app Notifications.

Trade-off: we build the inbox UI, live delivery (SSE resource route or polling), preferences, and retention ourselves.

**Runner-up: Novu (self-hosted Community edition for dev, Cloud free tier or self-host for prod).** It is the only vendor that can run without its cloud: MIT core, Docker Compose. It also ships a ready Inbox, preferences, digest and WebSocket delivery. Against it:

- The local stack is six services (Mongo, Redis, API, worker, WS, dashboard) and about 8 GB RAM.
- The Cloud free tier allows only 5 workflows.
- It has no automatic unsubscribe link.
- The Community edition allows one team member.

Knock has the most polished developer experience and a generous free tier (10,000 messages/mo). If the hard requirement is ever relaxed to "fake the provider behind an adapter in dev and tests", Knock is the cloud option to revisit.

## Open questions this research did not settle

- Whether Novu's Inbox works with React Router SSR without a client-only wrapper (no docs found). It would need a prototype.
- Whether Cadence runs as more than one server instance in production. If it does, SSE fan-out needs pub/sub beyond an in-process emitter.
- The real volumes of Notifications and emails per month, which decide whether any free tier matters.
