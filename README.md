# Ecom - Full-Stack E-Commerce & Management Platform

[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Backend-Express%205-339933?style=flat-square&logo=express)](https://expressjs.com/)
[![Socket.io](https://img.shields.io/badge/Real--time-Socket.io-000000?style=flat-square&logo=socket.io)](https://socket.io/)
[![Pug](https://img.shields.io/badge/Template-Pug-A86454?style=flat-square&logo=pug)](https://pugjs.org/)
[![CSS3](https://img.shields.io/badge/Styling-CSS3-1572B6?style=flat-square&logo=css3)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB-47A248?style=flat-square&logo=mongodb)](https://www.mongodb.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Ecom is a comprehensive e-commerce ecosystem and multi-role web platform built for retail customers and store administrators. The platform seamlessly bridges consumer shopping experiences with enterprise administration through dynamic product discovery, product comparison, AI-assisted customer support, real-time chat, automated order lifecycle tracking, role-based access control (RBAC), an automated SEO & OpenGraph engine, cascading media synchronization, and a dedicated media storage microservice.

---

## Key Features

### Customer Shopping Workflow
- **Account & OAuth2 Authentication:** Secure registration and credential login alongside OTP email verification and one-click Google & Facebook OAuth2 integration.
- **Product Catalog & Atlas Search:** Keyword search powered by MongoDB `Atlas Search` with multi-field regex fallback, dynamic slugification, attribute-based filtering (color, size), category tree navigation, and product comparison.
- **Cart & Dynamic Checkout:** Interactive shopping cart persisted client-side (`localStorage`) with server-side stock/quantity revalidation, coupon application, shipping address management, and order placement.
- **Real-Time Support Chat & Rate Feedback:** Live customer-to-admin instant messaging powered by WebSockets (`Socket.io`) with online/active status tracking, open/locked conversation control, unread indicators, and a 5-star conversation rating widget (`chat.pug`) reviewable by admins (`chat-rate.pug`).
- **Order Lifecycle & History:** Customer dashboard tracking purchase history and real-time status transitions (`Pending`, `Confirmed`, `Shipping`, `Completed`, `Cancelled`, `Returned`).
- **Product Reviews, Recommendations & Flash Sales:** 5-star rating system with order-verified review submission, wishlist bookmarking, reward points tracking, flash sales (`flash-sale.pug`), and frequently bought together recommendations (`bought-together-products.pug`).

### Store Manager Workflow
- **Catalog & Rich Editor:** Rich-text product editor (TinyMCE) supporting image uploads, variant/attribute management, stock caps, bulk product import via CSV upload (`papaparse`), and soft-delete trash recovery across all entities.
- **AI-Powered Support Assistant:** LLM-driven semantic analysis of support conversations (smart reply suggestions, draft response refinement, conversation summarization, and customer sentiment/emotion detection), powered by Groq API (`LLaMA 3.1 8B Instant`), separate from the real-time chat transport itself.
- **SEO & Social OpenGraph Engine:** Custom SEO metadata management (`title`, `description`, `keywords`, `robots index/follow`), OpenGraph social sharing tags (`og:image`), canonical URL middleware (`canonical`), and Google Search Console sitemap indexing helper.
- **Inventory & Order Processing:** Searchable order management inbox with direct status updates (`Pending`, `Confirmed`, `Shipping`, `Completed`, `Cancelled`, `Returned`), shipping carrier integration (GoShip), and customer dispatch emails.
- **Sales Analytics & CSV Export Reporting:** Advanced analytics dashboards for time-series revenue (`dashboard-revenue-by-time.pug`), top-selling products, order metrics, customer growth statistics, and one-click CSV data export (`json2csv`).

### Admin Moderation
- **Role-Based Access Control (RBAC):** Permission-matrix administration protecting core management routes across staff roles.
- **Account & Content Moderation:** User account status management, product review moderation, and administrative audit logs (`admin-log.model.ts`).
- **System & Store Configuration Settings:** Centralized in-app administration for store info & brand identity (website name, domain, logo/favicon, warehouse coordinates, sender contact), Payment Gateways (ZaloPay, VNPay), Shipping Providers (GoShip API), Social Auth Keys, and App Passwords.
- **Token Rotation & Theft Detection:** Refresh Token Rotation with a 15-second grace period for concurrent requests and instant global token revocation upon token reuse attempt (`token-rotation.helper.ts`).
- **Media Microservice & Cascading Sync:** Standalone media storage service (`FileManager`) with streamed multi-file batch upload, temp staging, UTF-8 sanitization, and automated cross-collection media rename/delete propagation (`media-propagate.helper.ts`).

---

## Technology Stack

- **Frontend:** Server-Side Rendering with Pug Templates, CSS3, JavaScript ES6+, Socket.IO Client, OpenLayers Map Picker with OpenStreetMap/Nominatim Geocoding.
- **Backend:** Node.js, Express 5, TypeScript (Strict Mode, Fully Typed), Socket.IO Server, Groq API (LLaMA 3.1), Passport.js (OAuth2), Nodemailer, Bcryptjs, Joi, Axios, gzip response compression, CSV import/export (`papaparse` / `json2csv`), OpenMap.vn Reverse Geocoding (GoShip address resolution).
- **Database & Storage:** MongoDB Atlas (Mongoose ORM with Type Generics & Embedded Sub-Schemas), Atlas Search Engine with Regex Fallback, NodeCache (In-Memory Chat & Settings Cache), Dynamic SEO Sub-Schema (`SeoSchema`), Standalone FileManager Microservice.
- **Infrastructure & Design Patterns:** 3-Tier Layered Architecture (Routes → Controllers → Services → Models), DTO-Driven Domain Services, Shared Helper Layer (admin CRUD/trash lifecycle, paginated list queries, SEO payload builder, order resource rollback, FileManager client), Payment Gateway Services, Admin Audit Trail Logging, Token Theft Detection & Refresh Token Rotation, Cascading Media Propagation, Path Traversal Protection, HttpOnly Cookies, Multer Disk Staging, OS Graceful Shutdown.

---

## Project Structure

```text
Ecom/
├── FileManager/                      # Standalone Media & Asset Storage Microservice (Port 4000)
│   ├── controllers/                  # HTTP route handlers (request parsing & response mapping)
│   ├── media/                        # Physical disk storage (temp staging & user assets)
│   │   ├── temp/                     # Staging directory for partial / stream uploads
│   │   └── users/                    # Sanitized user uploaded media storage
│   ├── middlewares/                  # Auth token verification & storage error handling
│   ├── routes/                       # Express routes for media & file-manager APIs
│   ├── services/                     # Business & filesystem logic (upload, streaming, folder management)
│   ├── index.ts                      # Storage server entry point & Multer upload limits
│   └── package.json                  # Microservice dependencies & scripts
│
└── Web/                              # Main E-Commerce Web Application (Port 3000)
    ├── configs/                      # Database connection, OAuth strategies, & env validation
    ├── controllers/                  # HTTP request delegates (admin/, client/)
    │   ├── admin/                    # Admin controllers delegating to admin services
    │   └── client/                   # Storefront controllers delegating to client services
    ├── helpers/                      # Shared utility + domain helpers (slugify, mailer, AI assistant, Atlas search, admin CRUD/trash, list-query pagination, SEO payload builder, order resource rollback, FileManager client)
    ├── interfaces/                   # Strict TypeScript domain interfaces & Input DTOs
    │   ├── models/                   # Type declarations for Mongoose models & input DTO schemas
    │   └── socket-events.interface.ts # Typed DTOs for all Socket.IO event payloads (client & server events)
    ├── jobs/                         # Background cron jobs (stale chat cleanup, unpaid order cancellation)
    ├── middlewares/                  # Security guards, RBAC matrices, & request logger (admin/, client/)
    │   ├── admin/                    # Admin authentication & permission guards
    │   └── client/                   # Customer auth & session verification
    ├── models/                       # Mongoose data models with TypeScript generics & sub-schemas
    │   └── schemas/                  # Embedded sub-documents & reusable schema definitions
    ├── public/                       # Client & Admin static web assets (CSS, JS, images)
    │   ├── admin/                    # Admin panel custom scripts, styles, & plugins
    │   └── client/                   # Storefront styles, JS scripts, & icons
    ├── routes/                       # Express routing modules (admin/, client/)
    │   ├── admin/                    # Admin management routes & RBAC endpoints
    │   └── client/                   # Customer-facing shopping & account routes
    ├── services/                     # Core Business Logic & Database Transactions
    │   ├── admin/                    # Store administration services (catalog, orders, RBAC, audit logs)
    │   ├── client/                   # Storefront services (cart, checkout, Atlas search, live chat, orders)
    │   ├── payment/                  # Payment gateway services (ZaloPay, VNPay: URL creation, callback/mac verification)
    │   └── socket/                   # Socket service layer (chat room init, message persistence, CDN file cleanup)
    ├── sockets/                      # Socket.IO bootstrap, handshake JWT auth, and presence tracking; chat event handlers delegate persistence to the socket service layer
    ├── validates/                    # Joi request payload validation schemas (admin/, client/)
    ├── views/                        # Server-rendered Pug templates (admin/, client/)
    │   ├── admin/                    # Admin dashboard layouts, pages, & partials
    │   └── client/                   # Storefront layouts, product detail, checkout, & chat views
    ├── index.ts                      # App server entry point & OS Graceful Shutdown handler
    └── package.json                  # Web application dependencies & scripts
```

---

## Getting Started

### Prerequisites
- Node.js (v20.19+, required by Mongoose 9)
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

---

## License

This project is licensed under the [MIT License](LICENSE).
