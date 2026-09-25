# Ecom

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express%205-000000?style=flat-square&logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

An online store with a storefront for customers and an admin panel for store staff. It also includes live support chat with an AI assistant, product recommendations, suspicious-order detection and stock forecasting.

## Contents

- [Features](#features)
- [Business rules](#business-rules)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Payments in development](#payments-in-development)
- [Scripts](#scripts)
- [API documentation](#api-documentation)
- [Deployment and security notes](#deployment-and-security-notes)
- [License](#license)

## Features

**Customers**
- Sign up, log in (email/password, Google, Facebook) and reset the password with an email OTP.
- Browse, filter, sort and search products (with live suggestions), including products with variants such as size and color.
- Cart (kept in the browser), wishlist and product comparison.
- Checkout with coupons, loyalty points, a map address picker and GoShip shipping rates.
- Pay by cash on delivery, VNPay or ZaloPay, with a retry button when an online payment did not finish.
- Order emails and order tracking; reviews on purchased products and reports on abusive reviews.
- Live chat with the store: typing and online status, attachments, and a rating at the end.
- Blog, About/FAQ/policy pages, flash sales, contact form, multi-currency prices, Google Translate and an installable PWA.

**Store staff**
- Manage products (rich-text editor, variants), categories, attributes, coupons, orders, articles, customers and staff accounts.
- Moderate reviews, answer contact messages and reply to customer chats.
- Role-based permissions, an audit log, and a trash bin to restore deleted records.
- Sales dashboard, CSV import/export, SEO fields with OpenGraph tags, a sitemap, homepage blocks and store settings.
- A file manager; renaming or deleting a file updates the products and articles that use it.

**AI assistant**
- Staff can ask an LLM (through the Groq API) to summarize a chat, suggest or polish a reply, and read the customer's sentiment.

**Machine learning**
- **Recommendations** ("frequently bought together"): item-based collaborative filtering where recent orders weigh more, results are mixed across categories, and new products fall back to popular items of the same category ([recommendation.helper.ts](Web/helpers/recommendation.helper.ts)).
- **Suspicious-order detection**: each order gets an Isolation Forest score from order speed, coupon use, discount ratio and account age, combined with simple rules; flagged orders go to a review queue ([isolation-forest.helper.ts](Web/helpers/isolation-forest.helper.ts)).
- **Stock forecasting**: Holt's linear trend method with sales spikes (such as flash sales) capped, giving each product a reorder point and safety stock ([forecast.helper.ts](Web/helpers/forecast.helper.ts)).

Recommendations and the fraud model are recomputed every night and can also be run on demand from the admin panel.

## Business rules

- Stock is reserved when an order is placed. Cancelling or returning an order gives back the stock, the coupon use and the spent points.
- Loyalty points are earned only once an order is paid, never for cancelled or returned orders.
- Completed, cancelled and returned orders can no longer change status; only cancelled or returned orders can be deleted.
- Unpaid VNPay/ZaloPay orders are cancelled automatically after a timeout ([order.job.ts](Web/jobs/order.job.ts)); idle chat rooms are deleted with their files ([chat.job.ts](Web/jobs/chat.job.ts)).
- A product can be reviewed only after its order is completed, once per purchased item.
- A new chat goes to the online staff member who can reply to chats and has the fewest open conversations; if nobody is online, to any staff member with that permission. When the assigned staff member loses the permission, the chat moves to someone else the next time the customer connects ([chat.socket.service.ts](Web/services/socket/chat.socket.service.ts)).
- Coupons are a percentage or a fixed amount, with an optional minimum order, maximum discount, usage limit, validity dates, and public or private visibility.
- Sales reports group revenue in Vietnam time (UTC+7).
- An account registered with an email that was never verified loses its password the first time the real owner links Google or Facebook; they can then use the social login or "Forgot password".

## Architecture

```text
Browser ──> nginx ──> Web ──> MongoDB Atlas
                       │
                       ├──> FileManager (stores files on disk, not public)
                       └──> Groq, GoShip, Gmail, VNPay, ZaloPay

VNPay / ZaloPay ──(payment callbacks through the public domain)──> nginx ──> Web
```

- **Web** serves the storefront, the admin panel (`/admin`), the JSON API (`/api`, `/admin/api`) and Socket.IO chat. Code is layered: routes → controllers → services → models.
- **FileManager** keeps uploaded files. Only Web talks to it; browsers load media through Web at `/media`.
- **nginx** is the public entry point in Docker and upgrades `/socket.io/` to WebSocket.

```text
Ecom/
├── Web/                        # Main app: storefront, admin panel, JSON API, live chat (port 3000)
│   ├── configs/                # Database, OAuth, cached store settings, tuning constants, env validation
│   ├── routes/                 # URL -> controller
│   │   ├── admin/              #   /admin pages and /admin/api
│   │   └── client/             #   storefront pages and /api
│   ├── controllers/            # Read the request, call a service, send the response
│   │   ├── admin/
│   │   └── client/
│   ├── services/               # Business logic and database access
│   │   ├── admin/
│   │   ├── client/
│   │   ├── payment/            #   VNPay and ZaloPay
│   │   └── socket/             #   chat rooms and messages
│   ├── models/                 # Mongoose schemas
│   │   └── schemas/            #   shared sub-schemas (SEO)
│   ├── validates/              # Joi request validation
│   │   ├── admin/
│   │   └── client/
│   ├── middlewares/            # Auth, permissions, rate limits, request logging, secure cookies
│   │   ├── admin/
│   │   └── client/
│   ├── helpers/                # Shared utilities and the ML algorithms
│   ├── interfaces/             # TypeScript types for models, requests and socket events
│   ├── sockets/                # Socket.IO setup, socket login and chat events
│   ├── jobs/                   # Scheduled tasks (cancel unpaid orders, retrain models, clean up chats)
│   ├── views/                  # Pug templates
│   │   ├── admin/
│   │   └── client/
│   ├── public/                 # Static files, including the PWA service worker
│   │   ├── admin/, client/     #   CSS, JS and fonts
│   │   └── api-docs/           #   Swagger UI and the OpenAPI spec
│   └── index.ts                # App entry point
├── FileManager/                # Media service: stores uploaded files (port 4000, internal only)
│   ├── config/                 # Allowed file types and security settings
│   ├── routes/                 # /files, /folders (need the shared secret) and /media (public reads)
│   ├── controllers/            # Read the request, call a service, send the response
│   ├── services/               # File and folder operations on disk
│   ├── middlewares/            # Secret check, failed-attempt limit, CORS
│   ├── media/                  # Stored files: sample product images, users/, temp/,
│   │                           #   and chats/ (created at runtime); mounted as a volume in Docker
│   └── index.ts                # Service entry point
├── nginx/                      # Reverse proxy config (mounted as a directory in Docker)
└── docker-compose.yml          # nginx -> Web -> FileManager
```

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

Fill in at least these values; the other variables are optional and explained in the two `.env.example` files.

| File | Variable | Purpose |
|---|---|---|
| `Web/.env` | `DATABASE` | MongoDB connection string |
| `Web/.env` | `JWT_SECRET` | Signs login tokens |
| `Web/.env` and `FileManager/.env` | `FILE_MANAGER_SECRET` | Shared secret between Web and FileManager; must be the same in both files |
| `Web/.env` | `GROQ_API_KEY` | Optional; enables the AI chat assistant |

Search uses the Atlas Search index named by `ATLAS_SEARCH_INDEX` when it exists, and a regex match otherwise.

### 2a. Run locally

```bash
# Terminal 1
cd FileManager && yarn install && yarn dev

# Terminal 2
cd Web && yarn install && yarn dev
```

The store runs at `http://localhost:3000` and the admin panel at `http://localhost:3000/admin`.

### 2b. Or run with Docker

```bash
docker compose up -d --build
```

nginx serves the site at `http://localhost` (also on port 3000). The database is not part of the stack; `DATABASE` points at your MongoDB.

### 3. Create the first admin account

There is no sign-up page for staff, so create the first super admin directly in the database. Hash a password from the `Web` folder:

```bash
node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 10))" 'YourStrongPassword'
```

Then insert a document into the `accounts-admin` collection (with `mongosh` or the Atlas Data Explorer) that has your `fullName`, a lowercase `email`, the hash as `password`, `status: "active"`, `isSuperAdmin: true` and `deleted: false`. The last field must be written explicitly: a direct insert skips the schema defaults, and login only looks for accounts where `deleted` is `false`. The full schema is in [account-admin.model.ts](Web/models/account-admin.model.ts).

Log in at `/admin` and add the other staff accounts and roles from the admin panel.

### 4. Configure the store

In **Admin → Settings**:

- **General**: store name, domain, logo, and the warehouse address used for shipping.
- **App password**: the Gmail account and app password used to send emails (OTP, order emails).
- **Payment**: VNPay and ZaloPay merchant keys.
- **Shipping**: GoShip token.
- **Social login**: Google and Facebook OAuth keys.

## Payments in development

VNPay and ZaloPay confirm payments by calling the app from their own servers, which cannot reach `localhost`. Expose nginx with a tunnel and use that URL as the store domain:

```bash
ngrok http --url=<your-ngrok-domain> 80
```

Then set **Settings → General → Domain** to the ngrok URL. Payment return pages, the ZaloPay callback, canonical links and the sitemap are all built from this domain. Without the tunnel, ZaloPay orders are never marked as paid, and VNPay orders only when the customer's browser comes back to the store.

Once the site is hosted, register the VNPay IPN (`/order/payment-vnpay-ipn`) and ZaloPay callback (`/order/payment-zalopay-callback`) URLs in the merchant portals.

## Scripts

`Web` and `FileManager` each define their development, build, start and type-check scripts in their own `package.json`.

## API documentation

- Swagger UI: [ecom-api-docs.vercel.app](https://ecom-api-docs.vercel.app), or `http://localhost:3000/api-docs/` while the app is running (use this one to try requests, since it can send the login cookies).
- JSON endpoints live under `/api` (customers) and `/admin/api` (staff). They accept the login cookies or `Authorization: Bearer <accessToken>` from the login endpoints. Errors return `{ "code": "error", "message": "..." }` with the matching HTTP status.
- FileManager accepts `Authorization: Bearer <FILE_MANAGER_SECRET>`.
- The spec is maintained in [thaihadefi/ecom-api-docs](https://github.com/thaihadefi/ecom-api-docs): after changing a route, `yarn verify` there compares the spec with this code and `yarn sync-web` refreshes `Web/public/api-docs`.

## Deployment and security notes

- **Keep FileManager private.** Only Web needs to reach it. If you must publish it, use HTTPS, a long random secret (`openssl rand -hex 32`) and `FILE_MANAGER_CORS_ORIGINS`; a client that keeps sending wrong secrets is blocked with HTTP 429 ([auth-failure-limit.middleware.ts](FileManager/middlewares/auth-failure-limit.middleware.ts)).
- **Set `TRUST_PROXY`** to the real number of proxies in front of the app; a wrong value lets clients fake their IP and bypass the login rate limits.
- **Cookies and tokens:** login cookies are marked `Secure` automatically over HTTPS. Refresh tokens rotate on every use, and reusing an old one logs that account out everywhere.
- **Uploads** are checked by type and size; avatars and review photos must be real images. The limits live in [upload.helper.ts](Web/helpers/upload.helper.ts) and [FileManager/config](FileManager/config).
- **Redeploys:** the web app shuts down gracefully on `SIGTERM` ([Web/index.ts](Web/index.ts)), and Compose gives it time to finish (`stop_grace_period`).
- **nginx config** is mounted as a directory; after editing `nginx/nginx.conf`, run `docker compose exec nginx nginx -s reload`.

## License

[MIT](LICENSE)
