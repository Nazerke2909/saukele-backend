# Saukele – Wedding Gift Management System

A comprehensive web application for managing wedding gifts with a **family tree system**, **escrow-based pool funding**, **currency rate locking**, **logistics tracking** (fragile-aware), and **multi-level privacy controls**. Built with **Node.js (Express) + PostgreSQL + Redis + Prisma**.

---

## Tech Stack

- **Backend:** Node.js, Express 4, ES Modules
- **Database:** PostgreSQL 15 + Prisma ORM (with connection pooling)
- **Cache/Async Ops:** Redis (ioredis) with graceful fallback
- **Queue System:** BullMQ (backed by Redis) for email, webhooks, and cron jobs
- **Frontend:** Vanilla JS SPA (plain HTML/CSS/JS, served statically)
- **Validation:** Joi (request validation) + Zod (environment config)
- **Authentication:** JWT (access + refresh tokens with rotation) + bcrypt
- **Email:** Nodemailer via Mailgun SMTP (with Ethereal fallback for dev)
- **API Documentation:** Swagger (swagger-jsdoc + swagger-ui-express)
- **Queue Monitoring:** Bull Board UI
- **Tests:** Jest + Supertest (unit & integration)
- **Containerization:** Multi-stage Docker build (Node 18 Alpine)

---

## Features

### 🎯 Core
- User registration with email verification (code or link)
- JWT authentication with access/refresh token rotation
- Role-based access control (5 roles)
- Cursor-based pagination across all list endpoints
- Full audit logging for all mutations
- Rate limiting (Redis-backed)

### 💍 Weddings & Gift Pools
- CRUD weddings with couple association
- Escrow-style gift pools with state machine:
  `PENDING → FUNDING → FUNDED → PURCHASED → DELIVERED`
- Multi-currency contributions with **exchange rate snapshots** (locked at contribution time)
- Idempotency key support for safe retries
- **Privacy levels per pool:** `PUBLIC`, `FAMILY_ONLY`, `PRIVATE`
- **Fragile item flagging** (`isFragile`) with special carrier notifications

### 👨‍👩‍👧‍👦 Family Tree
- Recursive family tree hierarchy with **kinship rank calculation**
- Kinship ranks: `ATA_ANA` (direct ancestors), `ZHIEN_ZHARAP` (close relatives), `SHAKYRT` (distant)
- Gift obligation tracking per family member
- Bulk obligation reminder emails

### 📦 Logistics Tracking (🆕)
Full delivery lifecycle with state machine:
`PREPARING → HANDED_TO_CARRIER → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED / FAILED`

- Automatic pool status update to `DELIVERED` on delivery confirmation
- **Fragile-aware handling:**
  - Special carrier notes on fragile items
  - Automated `⚠️ FRAGILE` email notifications to carriers
  - Extra warnings on last-mile delivery
- Carrier assignment with tracking numbers
- Estimated delivery dates
- Audit trail for all logistics transitions

### 📧 Email Notifications (Bilingual: EN / KZ / RU)
- Email verification (code + link)
- Password reset
- Contribution received (to couple)
- Pool fully funded alerts
- Gift obligation reminders (with progress)
- **Fragile carrier notifications** (with handling instructions)
- Logistics status updates (delivery tracking)
- **Registry invitations** (with Kazakh design)
- **Gentle payment reminders** (with Kazakh headings)
- Delivery confirmation to donors

### ⏰ Queue System (BullMQ + Redis)
3 isolated queues:
| Queue | Purpose | Max Retries |
|-------|---------|-------------|
| `email` | All email notifications | 3 (exponential backoff) |
| `webhooks` | External webhook retries | 5 (exponential backoff) |
| `cron` | Periodic scheduled tasks | 1 (no retry) |

### Cron Schedule
| Job | Schedule | Description |
|-----|----------|-------------|
| `deadStockDecay` | Daily 03:00 | Scans inactive pools — FUNDING with 30d no activity → PENDING; PURCHASED >90d → alert |
| `rateUpdate` | Hourly | Simulates ±5% variation on USD→KZT, EUR→KZT exchange rates |
| `dailyObligationReminders` | Daily 09:00 | Sends gift obligation reminders to family members |
| `abandonedCartRecovery` | Hourly | Finds PENDING contributions >24h, sends recovery reminders |

### 🖥️ Admin & Moderation
- **SUPER_ADMIN:** Full user management, exchange rate control, audit log, queue monitoring (Bull Board + REST API)
- **MODERATOR:** Flagged contribution review, user block/unblock, own audit log
- Queue statistics API with job-level inspection, retry, and removal

---

## Quick Start

### Prerequisites
- Node.js 18+
- Docker (for PostgreSQL + Redis)

### 1. Clone
```bash
git clone https://github.com/Nazerke2909/saukele-backend.git
cd saukele-backend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Environment setup
```bash
cp .env.example .env
```

Required `.env` variables:

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/saukele` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `SECRET_KEY` | JWT secret (min 16 chars) | `your-secret-key-...` |
| `PORT` | Server port | `3000` |
| `CORS_ORIGIN` | Allowed origins | `http://localhost:3000` |
| `FRONTEND_URL` | Frontend URL for email links | `http://localhost:3000` |
| `APP_URL` | App base URL | `http://localhost:3000` |
| `MAILGUN_API_KEY` | Mailgun API key (optional, console fallback) | `key-...` |
| `MAILGUN_DOMAIN` | Mailgun domain | `mg.yourdomain.com` |

### 4. Start Docker services (PostgreSQL + Redis)
```bash
docker compose up -d postgres redis
```

### 5. Run migrations and generate Prisma Client
```bash
npx prisma migrate dev
npx prisma generate
```

### 6. (Optional) Seed the database
```bash
npm run db:seed
```

### 7. Start the server
```bash
# Normal start
npm start

# Development mode (auto-reload)
npm run dev

# Start app + queue worker
npm run start:all
```

Open **[http://localhost:3000](http://localhost:3000)** — frontend SPA.
API docs: **[http://localhost:3000/docs](http://localhost:3000/docs)**
Queue monitor: **[http://localhost:3000/admin/queues](http://localhost:3000/admin/queues)**

---

## Docker (Full Stack)

```bash
# Start everything (PostgreSQL + Redis + App + Worker + Cron)
docker compose up -d

# Build and run with latest code
docker compose up -d --build

# Stop all
docker compose down
```

---

## API Endpoints

### Authentication (`/auth`)
| Method | Path | Description | Access |
|---|---|---|---|
| `POST` | `/auth/register` | Register new user | All |
| `POST` | `/auth/login` | Login, receive JWT tokens | All |
| `POST` | `/auth/logout` | Logout (revoke tokens) | Authenticated |
| `POST` | `/auth/refresh` | Refresh tokens (rotation) | All |
| `POST` | `/auth/verify-email` | Verify email with code | All |
| `POST` | `/auth/resend-verification` | Resend verification code | All |
| `POST` | `/auth/forgot-password` | Request password reset | All |
| `POST` | `/auth/reset-password` | Reset password | All |
| `GET` | `/auth/me` | Get current user | Authenticated |
| `PATCH` | `/auth/profile` | Update profile | Authenticated |

### Weddings (`/weddings`)
| Method | Path | Description | Access |
|---|---|---|---|
| `POST` | `/weddings` | Create wedding | COUPLE, SUPER_ADMIN |
| `GET` | `/weddings` | List weddings (cursor pagination) | Authenticated |
| `GET` | `/weddings/:id` | Get wedding details | Authenticated |
| `PUT` | `/weddings/:id` | Update wedding | COUPLE, SUPER_ADMIN |
| `DELETE` | `/weddings/:id` | Delete wedding | COUPLE, SUPER_ADMIN |

### Gift Pools (`/pools`)
| Method | Path | Description | Access |
|---|---|---|---|
| `POST` | `/pools` | Create gift pool | COUPLE, SUPER_ADMIN |
| `GET` | `/pools` | List pools (filter by `?weddingId=`) | Authenticated |
| `GET` | `/pools/:id` | Get pool details | Authenticated |
| `PUT` | `/pools/:id` | Update pool (name, target, privacy, fragile flag) | COUPLE, SUPER_ADMIN |
| `DELETE` | `/pools/:id` | Delete pool | SUPER_ADMIN |
| `PATCH` | `/pools/:id/purchase` | Mark as purchased (FUNDED → PURCHASED) | COUPLE, SUPER_ADMIN |
| `PATCH` | `/pools/:id/deliver` | Mark as delivered (PURCHASED → DELIVERED) | COUPLE, SUPER_ADMIN |
| `PATCH` | `/pools/:id/status` | Manual status change | COUPLE, SUPER_ADMIN |

### Logistics (`/pools/:id/logistics`)
| Method | Path | Description | Access |
|---|---|---|---|
| `POST` | `/pools/:id/logistics` | Initialize logistics tracking (pool must be PURCHASED) | COUPLE, SUPER_ADMIN |
| `POST` | `/pools/:id/logistics/carrier` | Assign carrier + tracking number (fragile-aware notification) | COUPLE, SUPER_ADMIN |
| `PATCH` | `/pools/:id/logistics/status` | Update delivery status (state machine enforced) | COUPLE, SUPER_ADMIN |
| `GET` | `/pools/:id/logistics` | Get logistics tracking info | Authenticated |

### Contributions (`/contributions`)
| Method | Path | Description | Access |
|---|---|---|---|
| `POST` | `/contributions` | Create contribution (locks exchange rate, idempotent) | Authenticated |
| `GET` | `/contributions/my` | My contributions (cursor pagination) | Authenticated |
| `GET` | `/contributions/pool/:poolId` | Pool contributions (cursor pagination) | Authenticated |
| `DELETE` | `/contributions/:id` | Delete/refund contribution | SUPER_ADMIN |

### Family Tree (`/family`)
| Method | Path | Description | Access |
|---|---|---|---|
| `GET` | `/family/:weddingId/tree` | Get family tree hierarchy | Authenticated |
| `GET` | `/family/:weddingId/obligations` | Get gift obligations with progress | Authenticated |
| `POST` | `/family/:weddingId/member` | Add family member | COUPLE, SUPER_ADMIN |
| `DELETE` | `/family/:weddingId/member/:memberId` | Remove family member | COUPLE, SUPER_ADMIN |
| `POST` | `/family/:weddingId/remind` | Send obligation reminders | COUPLE, SUPER_ADMIN |

### Admin (`/admin`)
| Method | Path | Description | Access |
|---|---|---|---|
| `GET` | `/admin/users` | List all users (filter by role/isBlocked) | SUPER_ADMIN |
| `DELETE` | `/admin/users/:id` | Delete user (anonymizes contributions) | SUPER_ADMIN |
| `PUT` | `/admin/exchange-rates` | Set new exchange rate (audit logged) | SUPER_ADMIN |
| `GET` | `/admin/audit-log` | Full audit log (filter by action/entity/user) | SUPER_ADMIN |
| `PATCH` | `/admin/moderators/:id/promote` | Toggle moderator role | SUPER_ADMIN |
| `GET` | `/admin/queue-stats` | Queue statistics overview | SUPER_ADMIN |

### Queue Management (`/admin/queue-stats/:queueName`)
| Method | Path | Description | Access |
|---|---|---|---|
| `GET` | `/admin/queue-stats/:name` | Queue detail + last 50 jobs | SUPER_ADMIN |
| `GET` | `/admin/queue-stats/:name/jobs/:jobId` | Full job detail | SUPER_ADMIN |
| `POST` | `/admin/queue-stats/:name/jobs/:jobId/retry` | Retry failed job | SUPER_ADMIN |
| `DELETE` | `/admin/queue-stats/:name/jobs/:jobId` | Remove job from queue | SUPER_ADMIN |

### Moderator (`/moderator`)
| Method | Path | Description | Access |
|---|---|---|---|
| `GET` | `/moderator/contributions/flagged` | Flagged contributions (FAILED/PENDING) | MODERATOR, SUPER_ADMIN |
| `PATCH` | `/moderator/users/:id/block` | Toggle user block/unblock | MODERATOR, SUPER_ADMIN |
| `GET` | `/moderator/audit-log` | Own moderator audit log | MODERATOR, SUPER_ADMIN |

### Health
| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check (`{ status: "ok", timestamp: "..." }`) |

---

## State Machines

### Pool status flow
```
PENDING → FUNDING → FUNDED → PURCHASED → DELIVERED
              ↑           ↑
         Contributions   Target reached,
         allowed         contributions closed
```

### Contribution status flow
```
PENDING → COMPLETED
    ↓            ↓
  FAILED      REFUNDED
```

### Delivery status flow
```
PREPARING → HANDED_TO_CARRIER → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED
                                                                    ↓
                                                      (pool auto-updated)
                                                                   
                                                               FAILED → PREPARING (retry)
```

---

## User Roles

| Role | Description | Key Permissions |
|---|---|---|
| `GUEST` | Regular guest | View public pools, contribute |
| `FAMILY_MEMBER` | Family member | View family-only pools |
| `COUPLE` | Newlyweds | Create weddings/pools, manage family tree, logistics |
| `MODERATOR` | Moderator | Block users, view flagged content, own audit log |
| `SUPER_ADMIN` | Administrator | Full access, exchange rates, audit log, queue management |

---

## Project Structure

```
saukele-backend/
├── frontend/                   # SPA client (vanilla JS)
│   ├── index.html              # Main page
│   ├── css/style.css           # Styles
│   └── js/
│       ├── api.js              # API client (all endpoints)
│       └── app.js              # Frontend logic
├── src/
│   ├── app.js                  # Express entry point
│   ├── config/
│   │   ├── env.js              # Environment validation (Zod)
│   │   ├── database.js         # Prisma connection (pooled)
│   │   └── redis.js            # Redis connection (graceful fallback)
│   ├── controller/             # Request handlers
│   ├── middleware/
│   │   ├── auth.js             # JWT authentication
│   │   ├── errorHandler.js     # AppError + global error handling
│   │   ├── rateLimiter.js      # Rate limiting (Redis-backed)
│   │   ├── roleCheck.js        # Role authorization
│   │   └── validation.js       # Joi request validation
│   ├── routes/                 # API route definitions
│   ├── service/
│   │   ├── auditService.js     # Full audit logging
│   │   ├── emailService.js     # Bilingual email templates (Mailgun)
│   │   ├── exchangeService.js  # Exchange rates + snapshots + caching
│   │   ├── kinshipService.js   # Kinship rank computation
│   │   ├── logisticsService.js # Fragile-aware delivery tracking
│   │   └── paymentService.js   # Mock payment with idempotency
│   ├── queue/
│   │   ├── producer.js         # BullMQ producers (email, webhooks, cron)
│   │   ├── worker.js           # BullMQ workers
│   │   ├── queue.js            # Queue configuration
│   │   ├── cron.js             # Periodic scheduled jobs
│   │   └── monitor.js          # Bull Board UI
│   └── utils/
│       ├── asyncHandler.js     # Express async error wrapper
│       ├── constants.js        # App constants
│       └── culturalTiming.js   # Cultural timing helpers
├── prisma/
│   ├── schema.prisma           # Database schema
│   ├── seed.js                 # Seed data
│   └── migrations/             # SQL migrations
├── tests/
│   ├── unit/                   # Unit tests (Jest)
│   └── integration/            # Integration tests (Jest + Supertest)
├── docker-compose.yml          # PostgreSQL + Redis + App + Worker + Cron
├── Dockerfile                  # Multi-stage build (builder → test → runner)
├── openapi.yaml                # OpenAPI 3.0 spec (alternative to Swagger)
├── QUEUE_MONITORING.md         # Queue observability docs
└── package.json
```

---

## Scripts

| Command | Description |
|---|---|
| `npm start` | Start server |
| `npm run dev` | Development mode with auto-reload |
| `npm run start:all` | Start server + queue worker |
| `npm run worker` | Start queue worker only |
| `npm test` | Run all tests |
| `npm run test:unit` | Run unit tests only |
| `npm run test:integration` | Run integration tests only |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:push` | Push schema to DB (no migration) |
| `npm run db:seed` | Seed database |
| `npm run db:studio` | Open Prisma Studio |
| `npm run prisma:generate` | Generate Prisma Client |

---

## Testing

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only (requires DB)
npm run test:integration
```

The project uses **Jest** with **Supertest** for HTTP integration tests. Tests use `--experimental-vm-modules` for ES module support.

---

## Development

```bash
# Auto-reload on file changes
npm run dev

# Visual database browser
npx prisma studio

# Reset database
npx prisma migrate reset
```

---

## Queue Monitoring

Bull Board UI is available at: **`http://localhost:3000/admin/queues`**

Detailed queue documentation: [QUEUE_MONITORING.md](QUEUE_MONITORING.md)

Features:
- Visual queue inspection (email, webhooks, cron)
- Job retry/removal
- Per-job details (data, stacktrace, attempts)
- REST API for programmatic queue management

---

## Email System

The system uses **Nodemailer** via **Mailgun SMTP** with **bilingual templates** (English, Kazakh, Russian):

| Email Type | Description |
|---|---|
| Verification | Email verification code + link |
| Password Reset | Secure reset link |
| Contribution Received | Notification to couple |
| Pool Funded | Congratulatory email |
| Gift Obligation Reminder | Progress toward obligation |
| Registry Invitation | Bilingual KZ/RU with traditional design |
| Fragile Carrier Notification | ⚠️ Special handling instructions |
| Delivery Status Update | Full delivery tracking |
| Delivery Confirmation | Confirmation to donor |
| Gentle Payment Reminder | Polite reminder with cultural context |
| Pool Progress | Visual progress bar with stats |

For development without a real SMTP, emails are logged to console.

---

## Database Schema

Key models: `User`, `Wedding`, `GiftPool`, `Contribution`, `FamilyTree`, `LogisticsTracking`, `ExchangeRate`, `ExchangeRateSnapshot`, `AuditLog`

### Enums
- **Role:** `SUPER_ADMIN`, `COUPLE`, `FAMILY_MEMBER`, `GUEST`, `MODERATOR`
- **KinshipRank:** `ATA_ANA`, `ZHIEN_ZHARAP`, `SHAKYRT`
- **PoolStatus:** `PENDING`, `FUNDING`, `FUNDED`, `PURCHASED`, `DELIVERED`
- **ContributionStatus:** `PENDING`, `COMPLETED`, `FAILED`, `REFUNDED`
- **DeliveryStatus:** `PREPARING`, `HANDED_TO_CARRIER`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`, `FAILED`
- **PrivacyLevel:** `PUBLIC`, `FAMILY_ONLY`, `PRIVATE`

---

## License

MIT
