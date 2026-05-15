# Saukele – Wedding Gift Management System

A web application for managing wedding gifts with a family tree system, escrow-based pool funding, and currency rate locking. Built with **Node.js (Express) + PostgreSQL + Redis + Prisma**.

---

## Tech Stack

- **Backend:** Node.js, Express 4, ES Modules
- **Database:** PostgreSQL 15 + Prisma ORM
- **Cache/Sessions:** Redis (ioredis)
- **Queues:** BullMQ (backed by Redis)
- **Frontend:** Vanilla JS (SPA with plain HTML/CSS/JS)
- **Validation:** Joi + Zod
- **Authentication:** JWT (access + refresh tokens) + bcrypt
- **API Documentation:** Swagger (swagger-jsdoc + swagger-ui-express)
- **Queue Monitoring:** Bull Board UI
- **Tests:** Jest + Supertest

---

## Quick Start

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
Create a `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

Required `.env` variables:
| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/saukele` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `SECRET_KEY` | JWT secret key (min 16 chars) | `your-secret-key-here...` |
| `PORT` | Server port | `3000` |
| `CORS_ORIGIN` | Allowed CORS origins | `http://localhost:3000` |
| `EMAIL_HOST` | SMTP server for emails | `smtp.ethereal.email` |

### 4. Start Docker services (PostgreSQL + Redis)
```bash
docker compose up -d
```

### 5. Run migrations and generate Prisma Client
```bash
npx prisma migrate dev
npx prisma generate
```

### 6. Start the server
```bash
# Normal start
npm start

# Development mode (with auto-reload)
npm run dev

# Start with queue worker
npm run start:all
```

Open **[http://localhost:3000](http://localhost:3000)** — frontend demo.
API docs: **[http://localhost:3000/docs](http://localhost:3000/docs)**

---

## API Endpoints

### Authentication (`/auth`)
| Method | Path | Description | Access |
|---|---|---|---|
| `POST` | `/auth/register` | Register a new user | All |
| `POST` | `/auth/login` | Login, receive JWT tokens | All |
| `POST` | `/auth/logout` | Logout (revoke tokens) | Authenticated |
| `POST` | `/auth/refresh` | Refresh tokens (rotation) | All |
| `POST` | `/auth/verify-email` | Verify email with code | All |
| `GET` | `/auth/verify/:token` | Verify email via link | All |
| `POST` | `/auth/resend-verification` | Resend verification code | All |
| `POST` | `/auth/forgot-password` | Request password reset | All |
| `POST` | `/auth/reset-password` | Reset password | All |
| `GET` | `/auth/me` | Get current user | Authenticated |
| `PATCH` | `/auth/profile` | Update profile | Authenticated |

### Weddings (`/weddings`)
| Method | Path | Description | Access |
|---|---|---|---|
| `POST` | `/weddings` | Create a wedding | COUPLE, MODERATOR, SUPER_ADMIN |
| `GET` | `/weddings` | List weddings | Authenticated |
| `GET` | `/weddings/:id` | Get wedding details | Authenticated |
| `PATCH` | `/weddings/:id` | Update wedding | COUPLE, SUPER_ADMIN |
| `DELETE` | `/weddings/:id` | Delete wedding | COUPLE, SUPER_ADMIN |

### Gift Pools (`/pools`)
| Method | Path | Description | Access |
|---|---|---|---|
| `POST` | `/pools` | Create a gift pool | COUPLE, SUPER_ADMIN |
| `GET` | `/pools` | List pools (requires `?weddingId=`) | Authenticated |
| `GET` | `/pools/:id` | Get pool details | Authenticated |
| `PUT` | `/pools/:id` | Update pool | COUPLE, SUPER_ADMIN |
| `DELETE` | `/pools/:id` | Delete pool | SUPER_ADMIN |
| `PATCH` | `/pools/:id/purchase` | Mark as purchased | COUPLE, SUPER_ADMIN |
| `PATCH` | `/pools/:id/deliver` | Mark as delivered | COUPLE, SUPER_ADMIN |
| `PATCH` | `/pools/:id/status` | Change status manually | COUPLE, SUPER_ADMIN |

### Contributions (`/contributions`)
| Method | Path | Description | Access |
|---|---|---|---|
| `POST` | `/contributions` | Create a contribution | Authenticated |
| `GET` | `/contributions/my` | My contributions | Authenticated |
| `GET` | `/contributions/pool/:poolId` | Pool contributions | Authenticated |

### Family Tree (`/family`)
| Method | Path | Description | Access |
|---|---|---|---|
| `GET` | `/family/:weddingId/tree` | Get family tree | Authenticated |
| `GET` | `/family/:weddingId/obligations` | Get gift obligations | Authenticated |
| `POST` | `/family/:weddingId/member` | Add family member | COUPLE, SUPER_ADMIN |
| `DELETE` | `/family/:weddingId/member/:memberId` | Remove family member | COUPLE, SUPER_ADMIN |
| `POST` | `/family/:weddingId/remind` | Send obligation reminders | COUPLE, SUPER_ADMIN |

### Admin (`/admin`)
| Method | Path | Description | Access |
|---|---|---|---|
| `GET` | `/admin/users` | List all users | SUPER_ADMIN |
| `DELETE` | `/admin/users/:id` | Delete user | SUPER_ADMIN |
| `PUT` | `/admin/exchange-rates` | Update exchange rate | SUPER_ADMIN |
| `GET` | `/admin/audit-log` | View audit log | SUPER_ADMIN |
| `PATCH` | `/admin/moderators/:id/promote` | Promote to moderator | SUPER_ADMIN |
| `GET` | `/admin/queue-stats` | Queue statistics | SUPER_ADMIN |

### Moderator (`/moderator`)
| Method | Path | Description | Access |
|---|---|---|---|
| `GET` | `/moderator/contributions/flagged` | Flagged contributions | MODERATOR, SUPER_ADMIN |
| `PATCH` | `/moderator/users/:id/block` | Block/unblock user | MODERATOR, SUPER_ADMIN |
| `GET` | `/moderator/audit-log` | Own audit log | MODERATOR, SUPER_ADMIN |

### Health (`/health`)
| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Server health check |

---

## State Machine

### Pool status flow
```
PENDING -> FUNDING -> FUNDED -> PURCHASED -> DELIVERED
              ^           ^
              |           |
         Contributions   Target reached,
         allowed         contributions closed
```

### Contribution status flow
```
PENDING -> COMPLETED
    |            |
    v            v
  FAILED      REFUNDED
```

---

## User Roles

| Role | Description | Permissions |
|---|---|---|
| `GUEST` | Regular guest | View, contribute to public pools |
| `FAMILY_MEMBER` | Family member | Same as GUEST + view family-only pools |
| `COUPLE` | Newlyweds | Create wedding/pools, manage family tree |
| `MODERATOR` | Moderator | Block users, view flagged content |
| `SUPER_ADMIN` | Administrator | Full access, exchange rates, audit |

---

## Project Structure

```
saukele-backend/
├── frontend/               # SPA client (vanilla JS)
│   ├── index.html          # Main page
│   ├── app.js              # Frontend logic
│   └── style.css           # Styles
├── src/
│   ├── app.js              # Express entry point
│   ├── config/
│   │   ├── env.js          # Environment validation (Zod)
│   │   ├── database.js     # Prisma connection
│   │   └── redis.js        # Redis connection
│   ├── controller/         # Request handlers
│   ├── middleware/
│   │   ├── auth.js         # JWT authentication
│   │   ├── errorHandler.js # Error handling
│   │   ├── rateLimiter.js  # Rate limiting
│   │   ├── roleCheck.js    # Role authorization
│   │   └── validation.js   # Request validation (Joi)
│   ├── routes/             # API route definitions
│   ├── service/            # Business logic
│   │   ├── auditService.js # Action audit logging
│   │   ├── emailService.js # Email sending
│   │   ├── exchangeService.js # Exchange rates
│   │   ├── kinshipService.js  # Kinship calculations
│   │   └── paymentService.js  # Payment processing
│   ├── queue/              # BullMQ queue system
│   │   ├── producer.js     # Queue producer
│   │   ├── worker.js       # Queue worker
│   │   ├── queue.js        # Queue configuration
│   │   ├── cron.js         # Scheduled tasks
│   │   └── monitor.js      # Bull Board UI
│   └── utils/              # Utility functions
├── prisma/
│   ├── schema.prisma       # Database schema
│   ├── seed.js             # Seed data
│   └── migrations/         # SQL migrations
├── tests/                  # Test suites (Jest)
├── docker-compose.yml      # PostgreSQL + Redis services
├── Dockerfile              # Application image
└── package.json
```

---

## Docker

```bash
# Start all services (PostgreSQL + Redis + App)
docker compose up -d

# Start only database and Redis (without the app)
docker compose up -d postgres redis
```

---

## Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration
```

---

## Development

```bash
# Start with auto-reload
npm run dev

# Prisma Studio (visual database browser)
npx prisma studio

# Apply database migrations
npm run db:migrate

# Seed the database
npm run db:seed
```

---

## Queue Monitoring

Bull Board UI is available at:
[http://localhost:3000/admin/queues](http://localhost:3000/admin/queues)

Details in [QUEUE_MONITORING.md](QUEUE_MONITORING.md)

---

## Email

The system uses **Nodemailer** for sending emails:
- Email verification (code or link)
- Contribution notifications
- Password reset
- Gift obligation reminders

For development, use [Ethereal Email](https://ethereal.email) (test SMTP service).

---

## License

MIT
