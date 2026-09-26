# Ecom

[![CI](https://github.com/thaihadefi/Ecom/actions/workflows/ci.yml/badge.svg)](https://github.com/thaihadefi/Ecom/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express%205-000000?style=flat-square&logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

A customizable e-commerce baseline: one codebase, configured per client instead of forked.

Every store gets a storefront, an admin panel and a JSON API. For a new client you switch modules on or off, set the look, currency and page content in the admin panel, and plug in payment gateways or shipping carriers through small interfaces. [Customizing for a client](#customizing-for-a-client) shows where each kind of request goes.

The baseline also includes live support chat with an AI assistant, product recommendations, suspicious-order detection and stock forecasting; each of them can be switched off.

## Contents

- [Getting started](#getting-started)
- [Customizing for a client](#customizing-for-a-client)
- [Features](#features)
- [Business rules](#business-rules)
- [Architecture](#architecture)
- [Payments in development](#payments-in-development)
- [API documentation](#api-documentation)
- [Deployment and security notes](#deployment-and-security-notes)
- [Contributing](#contributing)
- [License](#license)

## Getting started

### Prerequisites

- Node.js 22.12+ and Yarn (to run locally), or Docker
- A MongoDB database (MongoDB Atlas, or a local MongoDB)

### 1. Configure

```bash
git clone https://github.com/thaihadefi/Ecom.git
cd Ecom
cp Web/.env.example Web/.env
cp FileManager/.env.example FileManager/.env
```

Fill in at least these values (the app refuses to start without the first three, see [env.config.ts](Web/configs/env.config.ts)); the other variables are optional and explained in the two `.env.example` files.

| File | Variable | Purpose |
|---|---|---|
| `Web/.env` | `DATABASE` | MongoDB connection string |
| `Web/.env` | `JWT_SECRET` | Signs login tokens |
| `Web/.env` and `FileManager/.env` | `FILE_MANAGER_SECRET` | Shared secret between Web and FileManager; must be the same in both files |
| `Web/.env` | `GROQ_API_KEY` | Optional; enables the AI chat assistant |

Search uses the Atlas Search index named by `ATLAS_SEARCH_INDEX` when it exists, and a regex match otherwise.

Optional modules are switched with feature flags; see [Feature flags](#feature-flags).

### 2a. Run locally

```bash
# Terminal 1
cd FileManager && yarn install && yarn dev

# Terminal 2
cd Web && yarn install && yarn dev
```

The store runs at `http://localhost:3000` and the admin panel at `http://localhost:3000/admin`. `yarn dev` restarts on changes; `yarn debug` also opens the Node inspector.

### 2b. Or run with Docker

```bash
docker compose up -d --build
```

nginx serves the site at `http://localhost` (also on port 3000). The database is not part of the stack; `DATABASE` points at your MongoDB.

### 3. Initialize the database

```bash
cd Web && yarn db:seed
```

On an empty database this creates a **Super Admin** role and the first admin account, `admin@ecom.local` / `Admin@123` (change the password right after the first login, or choose the credentials up front with `SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... yarn db:seed`). It also writes the default settings.

The seed is safe to run again, including on a store that is already live: it never creates the default admin when an admin account exists, and it only adds the settings fields a store is missing, without changing any value already saved. Run it after updating the code so new settings get their defaults.

Sign in to the admin panel with that account; other staff accounts and their role permissions are managed there.

### 4. Configure the store

Everything else is set in **Admin → Settings**; each page explains its fields. The rules the pages do not spell out:

- **General Settings**: the store phone, address and warehouse location are also the GoShip sender, so checkout cannot ship until they are set.
- **App API Password**: a Gmail account with an [app password](https://support.google.com/accounts/answer/185833) sends the OTP and order emails.
- **Payment Gateway API**: a method is offered only when it is ticked and its keys are filled in.
- **Social Login API**: a login button appears only once its keys are saved.
- **Page Content**: an empty page keeps its default text.

## Customizing for a client

Where each kind of client request goes; most need no code.

| The client wants to... | Where | Code change |
|---|---|---|
| Drop a module (blog, wishlist, compare, reviews, coupons, loyalty points, chat, AI, recommendations, fraud scoring, stock forecast, Google Translate) | `FEATURE_*` in `Web/.env` | None |
| Change colors and fonts | Admin → Settings → Storefront | None |
| Set the currency, number and date format, time zone, page language | Admin → Settings → Storefront | None |
| Show prices in other currencies for reference | Admin → Settings → Storefront → Display currencies | None |
| Change the loyalty point rates | Admin → Settings → Storefront | None |
| Edit About, FAQ and policy pages | Admin → Settings → Page Content | None |
| Set the logo, contact details, footer text and social links | Admin → Settings → General Settings | None |
| Rearrange the homepage | Admin → Block Management and Template Management | None |
| Choose which payment methods checkout offers | Admin → Settings → Payment Gateway API | None |
| Offer Google or Facebook login | Admin → Settings → Social Login API (buttons appear once keys are saved) | None |
| Move the admin panel to another URL | `ADMIN_PATH` in `Web/.env` | None |
| Add a payment gateway | One entry in [payment-methods.config.ts](Web/configs/payment-methods.config.ts), its start function in [payment-gateway.service.ts](Web/services/payment/payment-gateway.service.ts), its callback in [order.route.ts](Web/routes/client/order.route.ts) | Small |
| Add a shipping carrier | One `ShippingProvider` file like [goship.provider.ts](Web/services/shipping/goship.provider.ts), listed in [shipping.service.ts](Web/services/shipping/shipping.service.ts) | Small |
| Add a module of their own | Routes behind `requireFeature(...)` ([feature.middleware.ts](Web/middlewares/feature.middleware.ts)), a flag in [features.config.ts](Web/configs/features.config.ts) | Yes |
| Replace the storefront design | Pug views in `Web/views/client`, keeping the CSS variables and the element attributes that `main.js` hooks into; a fully separate frontend can use the [JSON API](#api-documentation) instead | Yes |

### Feature flags

All flags default to on. A module that is off hides its UI, answers 404 on its pages and APIs, and skips its scheduled jobs.

| Variable | Module |
|---|---|
| `FEATURE_CHAT=false` | Live chat (storefront widget, admin inbox, Socket.IO, chat cleanup job) |
| `FEATURE_AI=false` | Groq AI helpers in the admin chat; also off when chat is off or `GROQ_API_KEY` is empty |
| `FEATURE_ML_FRAUD=false` | Suspicious-order scoring, the flagged-order queue and its retraining job |
| `FEATURE_RECOMMENDATIONS=false` | "Frequently bought together" from order history; product pages fall back to related products |
| `FEATURE_STOCK_FORECAST=false` | The inventory forecast report |
| `FEATURE_BLOG=false` | Articles: storefront blog, admin editor, homepage blog block, search results and sitemap entries |
| `FEATURE_WISHLIST=false` | Wishlist page, header icon and product buttons |
| `FEATURE_COMPARE=false` | Product comparison page, header icon and product buttons |
| `FEATURE_REVIEWS=false` | Product reviews, ratings, review reports and the admin review queue |
| `FEATURE_COUPONS=false` | Coupon codes at checkout and the admin coupon pages; checkout refuses a coupon |
| `FEATURE_LOYALTY=false` | Loyalty points: none are earned or spent |
| `FEATURE_TRANSLATE=false` | The Google Translate widget |

### Currency

The **store currency** (VND by default) is what prices are entered in and what every order is charged in. Pick it when the store is set up: changing it later does not convert existing prices. **Display currencies** only let shoppers view converted prices with live exchange rates; the cart then notes that the charge is in the store currency. Payment methods that cannot charge the store currency are hidden (VNPay and ZaloPay only take VND).

### Limitations

- UI and email text is in English in the code (Pug views, [mail.helper.ts](Web/helpers/mail.helper.ts)); Google Translate covers other languages on the storefront.
- Shipping uses GoShip, so stores ship within Vietnam and phone numbers must be Vietnamese.

### Setting up a new client store

1. Follow [Getting started](#getting-started), setting the `FEATURE_*` flags for the modules the client wants.
2. Fill in the Settings pages ([Configure the store](#4-configure-the-store)), then build the homepage from blocks.
3. After any code change, run the checks in [Contributing](#contributing).

## Features

Modules marked *(optional)* can be switched off with a feature flag.

**Customers**
- Sign up, log in (email/password, plus Google and Facebook once configured) and reset the password with an email OTP.
- Browse, filter, sort and search products (with live suggestions). For products with variants such as size and color, the picker updates price, stock and images and preselects a variant that is in stock.
- Cart (kept in the browser), wishlist *(optional)* and product comparison *(optional)*.
- Checkout with coupons *(optional)*, loyalty points *(optional)*, a map address picker and GoShip rates from several carriers, cheapest first (weight per product, with a store default).
- Pay by cash on delivery, VNPay or ZaloPay (only the methods the store has set up are offered), with a retry button when an online payment did not finish.
- Order emails and order tracking; reviews on purchased products and reports on abusive reviews *(optional)*.
- Live chat with the store: typing and online status, attachments, and a rating at the end *(optional)*.
- Blog *(optional)*, editable About/FAQ/policy pages, flash sales, contact form, prices viewable in other currencies, Google Translate *(optional)* and an installable PWA.

**Store staff**
- Manage products (rich-text editor, variants, shipping weight), categories, attributes (color, dropdown or text), coupons, orders, articles, customers and staff accounts.
- Moderate reviews, answer contact messages, and reply to or lock customer chats.
- Role-based permissions, an audit log, and a trash bin to restore deleted records.
- Dashboards for revenue over time, top-selling products, orders and customer growth in the store time zone; CSV import/export; SEO fields with OpenGraph tags and a sitemap; homepage blocks and page templates; store settings.
- A file manager; renaming or deleting a file updates the products and articles that use it.

**AI assistant** *(optional)*
- Staff can ask an LLM (through the Groq API) to summarize a chat, suggest or polish a reply, and read the customer's sentiment. When a model is retired, rate-limited or failing, the request moves on to another available Groq model ([ai.helper.ts](Web/helpers/ai.helper.ts)).

**Machine learning** *(each optional)*
- **Recommendations** ("frequently bought together"): item-based collaborative filtering where recent orders weigh more, results are mixed across categories, and new products fall back to popular items of the same category ([recommendation.helper.ts](Web/helpers/recommendation.helper.ts)).
- **Suspicious-order detection**: each order gets an Isolation Forest score from order speed, coupon use, discount ratio and account age, combined with simple rules; flagged orders go to a review queue ([isolation-forest.helper.ts](Web/helpers/isolation-forest.helper.ts)).
- **Stock forecasting**: Holt's linear trend method with sales spikes (such as flash sales) capped, giving each product a reorder point and safety stock ([forecast.helper.ts](Web/helpers/forecast.helper.ts)).

Recommendations and the fraud model are recomputed every night and can also be run on demand from the admin panel.

## Business rules

- The cart lives in the browser, so the server re-checks every price, variant and stock level when the order is placed.
- Stock is reserved when an order is placed. Cancelling or returning an order gives back the stock, the coupon use and the spent points. These changes run inside a MongoDB transaction.
- Points can pay part of an order, up to the customer's balance and the amount due.
- Loyalty points are earned only once an order is paid, never for cancelled or returned orders. How much order value earns a point, and what a point is worth, are set in Settings → Storefront.
- Completed, cancelled and returned orders can no longer change status; only cancelled or returned orders can be deleted.
- An order placed with an online gateway (VNPay, ZaloPay) and never paid is cancelled after a timeout ([order.job.ts](Web/jobs/order.job.ts)). Idle chat rooms are deleted with their files ([chat.job.ts](Web/jobs/chat.job.ts)).
- A product can be reviewed only after its order is completed, once per purchased item.
- A new chat goes to the online staff member who can reply to chats and has the fewest open conversations; if nobody is online, to any staff member with that permission. When the assigned staff member loses the permission, the chat moves to someone else the next time the customer connects ([chat.socket.service.ts](Web/services/socket/chat.socket.service.ts)).
- Coupons are a percentage or a fixed amount, with an optional minimum order, maximum discount, usage limit, validity dates, and public or private visibility.
- Reports, order dates, coupon days and the nightly jobs follow the store time zone (Settings → Storefront, default `Asia/Ho_Chi_Minh`). VNPay and ZaloPay timestamps are always sent in Vietnam time, as those gateways require.
- A scheduled job never starts again while its previous run is still going.
- An account registered with an email that was never verified loses its password the first time the real owner links Google or Facebook; they can then use the social login or "Forgot password".

## Architecture

```text
Browser ──> nginx ──> Web ──> MongoDB Atlas
                       │
                       ├──> FileManager (stores files on disk, not public)
                       └──> Groq, GoShip, Gmail, VNPay, ZaloPay

VNPay / ZaloPay ──(payment callbacks through the public domain)──> nginx ──> Web
```

- **Web** serves the storefront, the admin panel (at `/admin`, configurable with `ADMIN_PATH`), the JSON API (`/api`, `/admin/api`) and Socket.IO chat. Code is layered: routes → controllers → services → models.
- **FileManager** keeps uploaded files. Only Web talks to it; browsers load media through Web at `/media`.
- **nginx** is the public entry point in Docker and upgrades `/socket.io/` to WebSocket.

### Where to look

| Looking for | Start at |
|---|---|
| The Express app and its startup | [Web/app.ts](Web/app.ts) builds the app; [Web/index.ts](Web/index.ts) connects the database, starts jobs and Socket.IO, and shuts down |
| A request's path through the code | `Web/routes` → `Web/controllers` → `Web/services` → `Web/models`, split into `admin/` and `client/` |
| Store settings and feature flags | [Web/configs](Web/configs) |
| Payment gateways | [payment-methods.config.ts](Web/configs/payment-methods.config.ts) and [Web/services/payment](Web/services/payment) |
| Shipping carriers | [Web/services/shipping](Web/services/shipping) |
| Scheduled jobs | [Web/jobs](Web/jobs) |
| Storefront and admin pages | `Web/views` (Pug) and `Web/public` (CSS, JS, service worker) |
| Tests | [Web/test](Web/test) |
| Uploaded files | [FileManager](FileManager) |
| The Docker stack | [docker-compose.yml](docker-compose.yml) and [nginx](nginx) |

## Payments in development

VNPay and ZaloPay confirm payments by calling the app from their own servers, which cannot reach `localhost`. Expose nginx with a tunnel and use that URL as the store domain:

```bash
ngrok http --url=<your-ngrok-domain> 80
```

Then set **Settings → General Settings → Website Domain** to the ngrok URL. Payment return pages, the ZaloPay callback, canonical links and the sitemap are all built from this domain. Without the tunnel, ZaloPay orders are never marked as paid, and VNPay orders only when the customer's browser comes back to the store.

Once the site is hosted, register the VNPay IPN (`/order/payment-vnpay-ipn`) and ZaloPay callback (`/order/payment-zalopay-callback`) URLs in the merchant portals.

## API documentation

- Swagger UI: [ecom-api-docs.vercel.app](https://ecom-api-docs.vercel.app), or `http://localhost:3000/api-docs/` while the app is running (use this one to try requests, since it can send the login cookies).
- JSON endpoints live under `/api` (customers) and `/admin/api` (staff). They accept the login cookies or `Authorization: Bearer <accessToken>` from the login endpoints. Errors return `{ "code": "error", "message": "..." }` with the matching HTTP status.
- FileManager accepts `Authorization: Bearer <FILE_MANAGER_SECRET>`.
- The spec lives in [thaihadefi/ecom-api-docs](https://github.com/thaihadefi/ecom-api-docs), whose `yarn sync-web` refreshes the copy in `Web/public/api-docs`.

## Deployment and security notes

- **Keep FileManager private.** Only Web needs to reach it. If you must publish it, use HTTPS, a long random secret (`openssl rand -hex 32`) and `FILE_MANAGER_CORS_ORIGINS`; a client that keeps sending wrong secrets is blocked with HTTP 429 ([auth-failure-limit.middleware.ts](FileManager/middlewares/auth-failure-limit.middleware.ts)).
- **Set `TRUST_PROXY`** to the real number of proxies in front of the app; a wrong value lets clients fake their IP and bypass the login rate limits.
- **Cookies and tokens:** login cookies are `HttpOnly`, and marked `Secure` automatically over HTTPS. Refresh tokens rotate on every use, and reusing an old one logs that account out everywhere.
- **File paths:** FileManager resolves every path inside its media folder and rejects anything that would leave it.
- **Uploads** are checked by type and size; avatars and review photos must be real images. The limits live in [upload.helper.ts](Web/helpers/upload.helper.ts) and [FileManager/config](FileManager/config).
- **Redeploys:** the web app shuts down gracefully on `SIGTERM` ([Web/index.ts](Web/index.ts)), and Compose gives it time to finish (`stop_grace_period`).
- **nginx config** is mounted as a directory; after editing `nginx/nginx.conf`, run `docker compose exec nginx nginx -s reload`.

## Contributing

Each service defines its scripts in its own `package.json`; run them with `yarn <script>` inside `Web` or `FileManager`. Before pushing:

- `yarn typecheck`, `yarn lint:any` (no `any` types) and, in `Web`, `yarn test`. The tests run against a throwaway in-memory MongoDB, never the shared database; the first run downloads a MongoDB binary. [CI](.github/workflows/ci.yml) runs the same checks on every push and pull request.
- When a route, method or payload changes, update the [API spec](#api-documentation) and run `yarn verify` in its repository; it compares the spec with this code.
- When a setting gains a field, give it a default in [seed.ts](Web/seed.ts) so `yarn db:seed` fills it on existing stores.

Questions and bugs go to [GitHub Issues](https://github.com/thaihadefi/Ecom/issues). Maintained by [@thaihadefi](https://github.com/thaihadefi).

## License

[MIT](LICENSE) © Ecom Team
