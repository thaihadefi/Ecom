# Ecom - Full-Stack E-Commerce & Management Platform

[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Backend-Express%205-339933?style=flat-square&logo=express)](https://expressjs.com/)
[![Socket.io](https://img.shields.io/badge/Real--time-Socket.io-000000?style=flat-square&logo=socket.io)](https://socket.io/)
[![Pug](https://img.shields.io/badge/Template-Pug-A86454?style=flat-square&logo=pug)](https://pugjs.org/)
[![Bootstrap](https://img.shields.io/badge/UI-Bootstrap%205-7952B3?style=flat-square&logo=bootstrap)](https://getbootstrap.com/)
[![CSS3](https://img.shields.io/badge/Styling-CSS3-1572B6?style=flat-square&logo=css3)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB-47A248?style=flat-square&logo=mongodb)](https://www.mongodb.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Ecom is a comprehensive e-commerce ecosystem and multi-role web platform built for retail customers and store administrators. The platform seamlessly bridges consumer shopping experiences with enterprise administration through dynamic product discovery, product comparison, AI-assisted customer support, real-time chat, automated order lifecycle tracking, role-based access control (RBAC), an automated SEO & OpenGraph engine, cascading media synchronization, a dedicated media storage microservice, and from-scratch machine learning models for product recommendations, demand forecasting, and bot/fraud order detection.

---

## Key Features

### Customer Shopping Workflow
- **Account & OAuth2 Authentication:** Secure registration and credential login alongside OTP email verification (`Web/models/verify-otp.model.ts`) and one-click Google & Facebook OAuth2 integration.
- **Product Catalog, Atlas Search & Multi-Tier Caching:** Keyword search powered by MongoDB `Atlas Search` with multi-field regex fallback, real-time query suggestions (`/api/product-suggestions`), dynamic slugification, multi-attribute conjunction filtering (`$and` queries across color, size, and custom specifications), on-sale status filtering, multi-tier sorting (price, position, high-precision discount ranking), category tree navigation (`Web/models/category-product.model.ts`), zero N+1 queries via batch `$in` resolution, product comparison, and multi-tier in-memory caching (`metadataCache` via `Web/helpers/metadata-cache.helper.ts`) for instant catalog rendering.
- **Product Variants & Interactive Selection:** Comprehensive multi-attribute product variants (`Web/models/product.model.ts`) with first in-stock variant auto-selection on detail view, real-time price and stock updates, gallery image synchronization, out-of-stock and inactive variant safeguards, option-aware cart/wishlist/compare additions with "Select Options" redirections, and dedicated variant image rendering.
- **Cart & Dynamic Checkout:** Interactive shopping cart persisted client-side (`localStorage`) with server-side variant stock/quantity revalidation, coupon application, loyalty points redemption with automatic deduction caps, GoShip real-time carrier rate selection, shipping address management with GPS coordinates (`Web/models/user-address.model.ts`), and multi-gateway checkout (COD, VNPay, ZaloPay).
- **Real-Time Support Chat & Rate Feedback:** Live customer-to-admin instant messaging powered by WebSockets (`Socket.io`) with online/active status tracking (`Web/helpers/presence.helper.ts`), two-tier chat caching (`Web/helpers/chat-cache.helper.ts`), live typing indicators, multi-file media attachments, open/locked conversation control, unread indicators, automated 10-day stale chat purge with microservice media cleanup (`Web/jobs/chat.job.ts`), and a 5-star conversation rating widget (`Web/views/client/partials/chat.pug`) reviewable by admins (`Web/views/admin/pages/chat-rate.pug`).
- **Order Lifecycle & History:** Customer dashboard tracking purchase history with line-item variant details, payment status, a Retry Payment action on the order result page when an online payment is incomplete (`Web/views/client/pages/order-success.pug`), automated cancellation of unpaid online-payment (VNPay, ZaloPay) orders after 30 minutes, checked every 15 minutes, with atomic inventory release (`Web/jobs/order.job.ts`), and real-time status transitions (`Pending`, `Confirmed`, `Shipping`, `Completed`, `Cancelled`, `Returned`).
- **Product Reviews, Recommendations & Flash Sales:** 5-star rating system with order-verified review submission, community review violation reporting (`Web/models/review.model.ts`), wishlist bookmarking, reward points earn-on-purchase lifecycle, flash sales (`Web/views/client/blocks/flash-sale.pug`), and "frequently bought together" recommendations (`Web/views/client/partials/bought-together-products.pug`) powered by an item-based Collaborative Filtering engine built from scratch (`Web/helpers/recommendation.helper.ts`) with recency-weighted co-occurrence scoring, category diversity re-ranking, and same-category most-viewed fallback for cold-start products, recomputed nightly (`Web/jobs/recommendation.job.ts`) with an admin-triggered manual recompute using async polling status.
- **Editorial Blog & Information Pages:** Rich-content blog hub (`/article`) with category filtering, cookie-guarded view count deduplication, publication lifecycle (`draft`, `published`, `archived`), sticky sidebar navigation, customer inquiry submission (`/contact`), and dedicated static pages (`/about`, `/faq`, store policies with tab-safe external links).
- **Multi-Currency & Internationalization:** Client-side dynamic currency conversion supporting 6 major currencies (`VND`, `USD`, `EUR`, `JPY`, `GBP`, `CNY`) with live exchange rate fetching (`exchangerate.host` primary, `open.er-api.com` fallback), localized decimal precision, `localStorage` caching with 6-hour TTL, and integrated GTranslate multilingual support.
- **Progressive Web App (PWA):** Installable storefront with a dynamically generated `Web App Manifest` (`/manifest.webmanifest`) reflecting live admin store settings (name, short name, favicon-derived icons), a Service Worker (`Web/public/sw.js`) implementing cache-first static assets and network-first HTML pages, and a dedicated offline fallback page (`Web/public/offline.html`) served when navigation requests fail without network connectivity.

### Store Manager Workflow
- **Catalog & Rich Editor:** Rich-text product editor (TinyMCE) supporting image uploads, dynamic multi-attribute specifications (`Web/models/attribute-product.model.ts`: color swatches, dropdown selects, text attributes), variant matrix management with normalized pricing and stock aggregation, bulk product import via CSV upload (`papaparse`), and soft-delete trash recovery for products, categories, attributes, articles, coupons, orders, roles, accounts and contact inquiries.
- **CMS Layout & Block Builder:** Modular homepage layout engine featuring configurable dynamic blocks (`Web/models/block.model.ts`) and reusable page templates (`Web/models/template.model.ts`).
- **Articles & Inquiry Management:** Full editorial publishing workflow for articles and blog categories (`Web/models/blog.model.ts`, `Web/models/category-blog.model.ts`) with dedicated SEO schemas, alongside a customer contact inquiry inbox (`Web/models/contact-inquiry.model.ts`).
- **Coupons & Promotional Campaigns:** Campaign discount management (`Web/models/coupon.model.ts`) supporting percentage vs. fixed discounts, minimum qualifying order values, maximum discount caps, total usage limits, start/end validity scheduling, and public vs. private voucher visibility.
- **AI-Powered Support Assistant:** LLM-driven semantic analysis of support conversations (smart reply suggestions, draft response refinement, conversation summarization, and customer sentiment/emotion detection), powered by the Groq API with dynamic model discovery and automatic failover (the live `GET /models` catalog is re-read once a day and right after a model is retired; the preferred and default models go first, then any active text model with tool support and a large context window; it moves on after a quota, retired-model, server or timeout error, at most 3 attempts within 45 seconds; `Web/helpers/ai.helper.ts`, `Web/configs/ai.config.ts`).
- **SEO & Social OpenGraph Engine:** Custom SEO metadata management (`title`, `description`, `keywords`, `robots index/follow`), OpenGraph social sharing tags (`og:image`), canonical URL middleware (`canonical`), and a dynamically generated `/sitemap.xml`.
- **Inventory & Order Processing:** Searchable order management inbox (`Web/models/order.model.ts`) with direct status updates (`Pending`, `Confirmed`, `Shipping`, `Completed`, `Cancelled`, `Returned`), shipping carrier integration (GoShip), customer order confirmation & dispatch status emails with line-item variant breakdowns, atomic double-deduction and restoration of both product-level and variant-level stock within MongoDB transactions, automated cancellation of unpaid VNPay and ZaloPay orders after 30 minutes with inventory release (`Web/jobs/order.job.ts`), loyalty points awarded once an order is paid (never for cancelled or returned orders), and points and coupon usage restored when an order is cancelled or returned.
- **Sales Analytics & Aggregation Engine:** Advanced analytics dashboards powered by MongoDB Aggregation Pipelines (multi-branch `$facet` metrics, hourly/daily/monthly revenue grouping with `+07:00` timezone normalization, and `$unwind` product rankings) for time-series revenue (`Web/views/admin/pages/dashboard-revenue-by-time.pug`), top-selling products, order metrics, customer growth statistics, and one-click CSV data export (`json2csv`).
- **Demand Forecasting & Reorder Planning:** Per-product inventory forecasting dashboard (`Web/views/admin/pages/dashboard-inventory-forecast.pug`) using Holt's linear trend smoothing over daily sales history with outlier winsorization (flash-sale spikes excluded from the trend baseline) and a reorder-point/safety-stock model (`Web/helpers/forecast.helper.ts`) to flag understocked products and suggest reorder quantities.

### Admin Moderation
- **Role-Based Access Control (RBAC):** Permission-matrix administration (`Web/models/role.model.ts`) and SuperAdmin privileges protecting core management routes across staff roles (`Web/models/account-admin.model.ts`).
- **Account & Content Moderation:** User account status management (`Web/models/account-user.model.ts`), product review moderation & community report handling (`Web/models/review.model.ts`), and administrative audit logs (`Web/models/admin-log.model.ts`).
- **System Settings & Active Cache Invalidation:** Centralized in-app administration for store info & brand identity (website name, domain, logo/favicon, warehouse coordinates, sender contact), Payment Gateways (ZaloPay, VNPay), Shipping Providers (GoShip API), Social Auth Keys, and App Passwords (`Web/models/setting.model.ts`), backed by synchronized multi-tier cache invalidation across mutations, webhooks, and media propagation: catalog metadata (`metadataCache` via `Web/helpers/metadata-cache.helper.ts`), system settings (`settingCache` via `Web/configs/setting.config.ts`), live support chat (`hotCache` & `warmCache` via `Web/helpers/chat-cache.helper.ts`), and online presence (`presenceCache` via `Web/helpers/presence.helper.ts`).
- **Token Rotation & Theft Detection:** Refresh Token Rotation with a 15-second grace period for concurrent requests and instant global token revocation upon token reuse attempt (`Web/helpers/token-rotation.helper.ts`, `Web/models/refresh-token.model.ts`).
- **Bot & Fraud Order Detection:** Unsupervised anomaly scoring on every order via a from-scratch Isolation Forest implementation (`Web/helpers/isolation-forest.helper.ts`) trained on order velocity, coupon usage, discount ratio, and account-age features, combined with hard-coded velocity/coupon-stampede rules into a hybrid detector; flagged orders surface in a dedicated review queue (`Web/views/admin/pages/order-flagged-list.pug`, `Web/services/admin/anomaly-detection.service.ts`) with dismiss/audit-trail support, nightly retraining, and an admin-triggered manual retrain with async polling status.
- **Media Microservice & Cascading Sync:** Standalone media storage service (`FileManager`) with streamed multi-file batch upload, temp staging, UTF-8 sanitization, and automated cross-collection media rename/delete propagation (`Web/helpers/media-propagate.helper.ts`, `Web/models/media.model.ts`).

---

## Technology Stack

- **Frontend:** Server-Side Rendering with Pug Templates, Bootstrap 5, CSS3, JavaScript ES6+, Socket.IO Client, OpenLayers Map Picker with OpenStreetMap/Nominatim Geocoding, Progressive Web App (Service Worker, dynamic Web App Manifest, offline fallback page).
- **Backend:** Node.js, Express 5, TypeScript (Strict Mode, Fully Typed), Socket.IO Server, Groq API, Passport.js (OAuth2), Nodemailer, Bcryptjs, Joi, Axios, gzip response compression, CSV import/export (`papaparse` / `json2csv`), OpenMap.vn Reverse Geocoding (GoShip address resolution).
- **Database & Storage:** MongoDB Atlas (Mongoose ORM with Type Generics, Embedded Sub-Schemas, & Partial Filter Indexes), Aggregation Pipeline Engine (Multi-Facet Metrics, Timezone Time-Series, & Unwind Operations), Atlas Search Engine with Regex Fallback, NodeCache (In-Memory Multi-Tier Caching: Metadata, Settings, Realtime Chat & Presence), Dynamic SEO Sub-Schema (`SeoSchema`), Standalone FileManager Microservice.
- **Infrastructure & Design Patterns:** 3-Tier Layered Architecture (Routes → Controllers → Services → Models), DTO-Driven Domain Services, Shared Helper Layer (metadata cache invalidation, admin CRUD/trash lifecycle, paginated list queries, SEO payload builder, order resource rollback, FileManager client, media propagation), Zero N+1 Batch Query Resolution, Event-Driven Active Cache Invalidation, Payment Gateway Services, Admin Audit Trail Logging, Token Theft Detection & Refresh Token Rotation, Cascading Media Propagation, Path Traversal Protection, HttpOnly Cookies, Multer Disk Staging, OS Graceful Shutdown.
- **Machine Learning & Forecasting (From-Scratch, No ML Libraries):** Item-based Collaborative Filtering (`Web/helpers/recommendation.helper.ts`), Isolation Forest unsupervised anomaly detection (`Web/helpers/isolation-forest.helper.ts`), and Holt's Linear Trend demand forecasting with reorder-point/safety-stock inventory planning (`Web/helpers/forecast.helper.ts`).

---

## API Documentation

- **Interactive docs:** [Swagger UI on GitHub Pages](https://thaihadefi.github.io/ecom-api-docs/) and the OpenAPI 3.0 file [openapi.yaml](https://thaihadefi.github.io/ecom-api-docs/openapi.yaml).
- **Try it out:** with the Web app running, open `http://localhost:3000/api-docs/`. It is served from the API's own origin, so the HTTP-only auth cookies are sent; the GitHub Pages copy cannot send them.
- **Base URLs:** Web `http://localhost:3000`, FileManager `http://localhost:4000` (production URL: TBD).
- **Errors:** a failed request answers with the matching HTTP status (400 invalid request, 401 not logged in, 403 not allowed, 404 not found, 409 conflict with the current state, 429 too many attempts, 500 unexpected error, 502 a dependent service failed) and the body `{ "code": "error", "message": "..." }`; success is HTTP 200 with `{ "code": "success" }`. The helpers are in `Web/helpers/http-response.helper.ts`.
- **Authentication:** The JSON endpoints of Web (`/api`, `/admin/api`) accept the `tokenUser` / `tokenAdmin` cookies set by the login endpoints (used by the browser pages) or `Authorization: Bearer <accessToken>` with the `accessToken` the login endpoints return (for API clients); they answer 401 and 403 as JSON and never redirect. FileManager uses `Authorization: Bearer <FILE_MANAGER_SECRET>` (enter it under "Authorize"); browser calls to it are cross-origin, so in production its origin must be listed in `FILE_MANAGER_CORS_ORIGINS`.
- **Maintenance:** the specification lives in [thaihadefi/ecom-api-docs](https://github.com/thaihadefi/ecom-api-docs). After a route, payload or status code changes, run `yarn verify` there: it compares the specification with this source and lists every difference (`yarn sync-statuses` adds missing error statuses). Then edit `openapi.yaml` and run `yarn sync-web`, which validates the spec and refreshes `Web/public/api-docs`.

---

## Project Structure

```text
Ecom/
├── FileManager/                      # Standalone Media & Asset Storage Microservice (Port 4000)
│   ├── config/                       # Allowed upload file extensions & security settings (secret strength, CORS allowlist, trust proxy)
│   ├── controllers/                  # HTTP route handlers (request parsing & response mapping)
│   ├── media/                        # Physical disk storage (temp staging & user assets)
│   │   ├── temp/                     # Staging directory for partial / stream uploads
│   │   └── users/                    # Sanitized user uploaded media storage
│   ├── middlewares/                  # Timing-safe Bearer secret guard, failed-attempt limiter & CORS allowlist
│   ├── routes/                       # Express routes for media & file-manager APIs
│   ├── services/                     # Business & filesystem logic (upload, streaming, folder management)
│   ├── index.ts                      # Storage server entry point (listens on 0.0.0.0:4000) & upload error handler
│   └── package.json                  # Microservice dependencies & scripts
│
└── Web/                              # Main E-Commerce Web Application (Port 3000)
    ├── configs/                      # Database connection, OAuth strategies & cookie-based OAuth state, system settings cache, ML/forecasting tuning constants, & env validation
    ├── controllers/                  # HTTP request delegates (admin/, client/)
    │   ├── admin/                    # Admin controllers delegating to admin services
    │   └── client/                   # Storefront controllers delegating to client services
    ├── helpers/                      # Shared utility + domain helpers (metadata cache invalidation, chat cache & presence, token rotation, rate limiting (MongoDB-backed), upload validation, HTML/URL sanitizing, OTP, media propagation, slugify, mailer, AI assistant, Atlas search, admin CRUD/trash, list-query pagination, SEO payload builder, order resource rollback, FileManager client, collaborative filtering, isolation forest, demand forecasting, statistics)
    ├── interfaces/                   # Strict TypeScript domain interfaces & Input DTOs
    │   ├── models/                   # Type declarations for Mongoose models & input DTO schemas
    │   ├── request.interface.ts      # Extended Express Request interface (admin session & audit context)
    │   └── socket-events.interface.ts # Typed DTOs for all Socket.IO event payloads (client & server events)
    ├── jobs/                         # Background cron jobs (stale chat cleanup, unpaid order cancellation, CF recommendation recompute, anomaly model retraining & scoring backfill)
    ├── middlewares/                  # Security guards, RBAC matrices, & request logger
    │   ├── admin/                    # Admin authentication, permission guards & RBAC privilege-escalation guards
    │   ├── client/                   # Customer auth, settings & SEO middleware
    │   ├── rate-limit.middleware.ts  # Per-route rate limits for form posts
    │   └── request-logger.middleware.ts # Structured HTTP access & slow-request logger with query redaction
    ├── models/                       # Mongoose data models with TypeScript generics & sub-schemas
    │   └── schemas/                  # Embedded sub-documents & reusable schema definitions
    ├── public/                       # Client & Admin static web assets (CSS, JS, images) and the Swagger UI copy at api-docs/
    │   ├── admin/                    # Admin panel custom scripts, styles, & plugins
    │   ├── client/                   # Storefront styles, JS scripts, & icons
    │   ├── offline.html              # PWA offline fallback page
    │   └── sw.js                     # PWA Service Worker (cache-first assets, network-first HTML)
    ├── routes/                       # Express routing modules (admin/, client/)
    │   ├── admin/                    # Admin management routes & RBAC endpoints
    │   └── client/                   # Customer-facing shopping & account routes
    ├── services/                     # Core Business Logic & Database Transactions
    │   ├── admin/                    # Store administration services (catalog, orders, RBAC, audit logs, CF recommendation recompute, anomaly detection & retraining)
    │   ├── client/                   # Storefront services (cart, checkout, Atlas search, live chat, orders, OAuth account linking)
    │   ├── payment/                  # Payment gateway services (ZaloPay, VNPay: URL creation, return/IPN/callback signature verification, shared paid-order helper)
    │   └── socket/                   # Socket service layer (chat room init, message persistence, CDN file cleanup)
    ├── sockets/                      # Socket.IO bootstrap, handshake JWT auth, and presence tracking; chat event handlers delegate persistence to the socket service layer
    ├── validates/                    # Joi request payload validation schemas
    │   ├── admin/                    # Admin request payload validation schemas
    │   └── client/                   # Storefront request validation schemas
    ├── views/                        # Server-rendered Pug templates (admin/, client/)
    │   ├── admin/                    # Admin dashboard layouts, pages, partials, & mixins
    │   └── client/                   # Storefront layouts, pages, partials, mixins, & dynamic blocks
    ├── index.ts                      # App server entry point & OS Graceful Shutdown handler
    └── package.json                  # Web application dependencies & scripts
```

---

## Getting Started

### Prerequisites
- Node.js (v22.12+, required by `sanitize-html`; Mongoose 9 alone needs v20.19+)
- Yarn or npm
- MongoDB Atlas or Local MongoDB instance

### Quick Start

```bash
# Clone the repository
git clone https://github.com/thaihadefi/Ecom.git
cd Ecom
```

1. **Start the Media Storage Microservice (`FileManager` - Port 4000):**

```bash
cd FileManager

# Install dependencies
yarn install

# Configure Environment Variables (.env)
cp .env.example .env

# Run development server
yarn dev
```

2. **In a new terminal window, start the Main Web Application (`Web` - Port 3000):**

```bash
cd Web

# Install dependencies
yarn install

# Configure Environment Variables (.env)
cp .env.example .env

# Run development server
yarn dev
```

### Environment variables

`Web/.env` (copy from `Web/.env.example`):

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE` | yes | MongoDB connection string |
| `JWT_SECRET` | yes | Signs access tokens |
| `FILE_MANAGER_SECRET` | yes | Bearer secret shared with FileManager |
| `PORT`, `NODE_ENV` | no | Web port (default 3000) and environment |
| `GROQ_API_KEY` | no | Admin AI assistant key (enables smart reply, summarization, emotion analysis) |
| `GROQ_MODEL` | no | Preferred model tried first (default `openai/gpt-oss-20b`); if it is retired or fails, other live models are used automatically |
| `OPENMAP_API_KEY` | no | OpenMap.vn reverse geocoding |
| `ATLAS_SEARCH_INDEX` | no | Atlas Search index name (default `default`) |
| `FILE_MANAGER_URL` | no | FileManager address (default `http://localhost:4000`) |
| `CDN_DOMAIN` | no | Only when a CDN fronts the media in production |
| `TRUST_PROXY` | no | Number of reverse proxies in front of the app |
| `SLOW_REQUEST_MS`, `LOG_EVERY_REQUEST` | no | Request logger tuning |

`FileManager/.env` (copy from `FileManager/.env.example`):

| Variable | Required | Purpose |
|---|---|---|
| `FILE_MANAGER_SECRET` | yes | Same value as in `Web/.env`; at least 32 characters in production |
| `FILE_MANAGER_CORS_ORIGINS` | no | Comma-separated browser origins allowed to call FileManager (unset: `*` in development, none in production) |
| `TRUST_PROXY` | no | Number of reverse proxies in front of FileManager (default 1 in production, 0 otherwise) |

### Deployment and security notes

- **Reverse proxy:** set `TRUST_PROXY` in `Web/.env` to the number of proxies in front of the app (default `1` in production, `0` otherwise). A wrong value lets clients fake their IP and bypass the login and OTP rate limits.
- **FileManager exposure:** it listens on `0.0.0.0:4000` and only the Web app has to reach it, so keep port 4000 closed to the public with a firewall or private network; browsers read media through the Web app at `/media`. If you publish it anyway (for example for the API documentation), put it behind HTTPS, use a `FILE_MANAGER_SECRET` of at least 32 random characters (`openssl rand -hex 32`), list the exact browser origins in `FILE_MANAGER_CORS_ORIGINS`, and set `TRUST_PROXY`. Wrong secrets are counted per client IP and answered with HTTP 429 after 20 failures in 15 minutes.
- **Uploads:** only image, video, audio, PDF, text, Office and zip files are accepted, up to 10 MB each. Customer avatars and review photos must be real JPG, PNG, GIF or WEBP images.
- **VNPay and ZaloPay without a public domain:** `localhost` works, because the VNPay browser return (`/order/payment-vnpay-result`) already records the payment. The server-to-server notifications (VNPay IPN `/order/payment-vnpay-ipn`, ZaloPay callback `/order/payment-zalopay-callback`) need a public HTTPS address, so they only work once the site is hosted or exposed with a tunnel such as ngrok. After hosting, register those URLs in the merchant portals so a payment is recorded even when the customer closes the browser before returning.
- **Social login:** an account registered with a password that never proved its email loses that password the first time the real owner links Google or Facebook (they can sign in with the social account or use "Forgot password").

---

## License

This project is licensed under the [MIT License](LICENSE).
