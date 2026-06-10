# PawGo Backend API

Pet Care Ecosystem Platform — Phase 0 Foundation

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22 LTS |
| Framework | NestJS 10 |
| Language | TypeScript 5 (strict) |
| Database | PostgreSQL 16 |
| ORM | Prisma 5 |
| Cache | Redis 7 |
| Auth | JWT (access + refresh) |
| Docs | Swagger / OpenAPI |
| Queue | BullMQ (Phase 2+) |
| Containers | Docker + Docker Compose |

---

## Project Structure

```
src/
├── main.ts                        # Bootstrap (Helmet, CORS, Swagger, ValidationPipe)
├── app.module.ts                  # Root module
├── config/                        # Typed config factories
│   ├── app.config.ts
│   ├── database.config.ts
│   ├── jwt.config.ts
│   ├── redis.config.ts
│   └── swagger.config.ts
├── database/
│   ├── prisma.module.ts           # Global Prisma module
│   └── prisma.service.ts          # PrismaClient wrapper with lifecycle hooks
├── shared/
│   ├── redis/                     # Global RedisService (get/set/delete/JSON helpers)
│   └── logger/                    # AppLogger (verbose in dev, clean in prod)
├── common/
│   ├── constants/                 # App-wide constants
│   ├── decorators/                # @CurrentUser, @Public, @Roles
│   ├── dto/                       # PaginationDto, ApiResponseDto, PaginatedResponseDto
│   ├── enums/                     # UserRole, UserStatus
│   ├── exceptions/                # BusinessException, ResourceNotFoundException, ...
│   ├── filters/                   # GlobalExceptionFilter
│   ├── guards/                    # JwtAuthGuard, RolesGuard, RefreshTokenGuard
│   ├── interceptors/              # ResponseInterceptor (wraps all responses)
│   ├── middleware/                # LoggerMiddleware (request/response timing)
│   └── utils/                     # pagination, date, string, response helpers
└── modules/
    ├── health/                    # GET /api/health
    ├── auth/                      # Phase 1 — login, register, refresh, logout
    └── users/                     # Phase 1 — CRUD, profile, role management
```

---

## Prerequisites

- Node.js 22+
- Docker & Docker Compose
- npm 10+

---

## Quick Start (Development)

### 1. Clone and install

```bash
git clone <repo-url>
cd pawGoBackend
npm install
```

### 2. Start infrastructure

```bash
docker-compose -f docker-compose.dev.yml up -d
```

This starts PostgreSQL on `5432` and Redis on `6379`.

### 3. Configure environment

The `.env.development` file is pre-configured for local Docker defaults. No changes needed for local dev.

### 4. Generate Prisma client & run migrations

```bash
npm run prisma:generate
npm run prisma:migrate:dev
```

### 5. Start the dev server

```bash
npm run start:dev
```

The API will be live at `http://localhost:3000`.

---

## API Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/health` | GET | Public | Health check |
| `/api/docs` | GET | Public | Swagger UI |

---

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `NODE_ENV` | Runtime environment | `development` |
| `PORT` | HTTP port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
| `JWT_ACCESS_SECRET` | Secret for access tokens (min 32 chars) | — |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens (min 32 chars) | — |
| `JWT_ACCESS_EXPIRES` | Access token TTL | `15m` |
| `JWT_REFRESH_EXPIRES` | Refresh token TTL | `7d` |
| `REDIS_HOST` | Redis hostname | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis password (optional) | — |
| `FRONTEND_URL` | Allowed CORS origin in production | `https://pawgo.app` |
| `THROTTLE_TTL` | Rate limit window (ms) | `60000` |
| `THROTTLE_LIMIT` | Max requests per window | `100` |

---

## API Response Format

**Success**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {},
  "errors": null
}
```

**Error**
```json
{
  "success": false,
  "message": "Validation failed",
  "data": null,
  "errors": { "validation": ["field must not be empty"] }
}
```

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run start:dev` | Development server with hot-reload |
| `npm run build` | Compile TypeScript |
| `npm run start:prod` | Production server |
| `npm run lint` | Run ESLint with auto-fix |
| `npm run format` | Run Prettier |
| `npm run test` | Unit tests |
| `npm run test:e2e` | End-to-end tests |
| `npm run prisma:migrate:dev` | Apply migrations in dev |
| `npm run prisma:migrate:deploy` | Apply migrations in production |
| `npm run prisma:studio` | Open Prisma Studio |

---

## Docker (Production)

```bash
# Build & start all services (api + postgres + redis)
docker-compose up -d --build

# View logs
docker-compose logs -f api

# Stop
docker-compose down
```

---

## Swagger

Available at `http://localhost:3000/api/docs` in development and staging.

Disabled automatically in production.

Click **Authorize** → enter `Bearer <your-jwt-token>` to test protected endpoints.

---

## Security Measures

- **Helmet** — HTTP security headers
- **CORS** — restricted to `FRONTEND_URL` in production
- **Rate Limiting** — 100 req/min per IP (configurable)
- **Compression** — gzip on all responses
- **Validation** — strict DTO validation with class-validator (`whitelist`, `forbidNonWhitelisted`)
- **Prisma** — parameterised queries (no raw SQL injection risk)
- **Non-root Docker user** — container runs as `nestjs` (uid 1001)

---

## Roadmap

| Phase | Scope |
|---|---|
| **0** ✅ | Foundation — project structure, Prisma, Redis, Swagger, global error handling |
| **1** | Auth — register, login, JWT refresh, email verification, role-based access |
| **2** | Users — profiles, pets, addresses |
| **3** | Clinics — owner portal, appointments, services |
| **4** | Shop — products, orders, inventory |
| **5** | Delivery — partner portal, tracking |
| **6** | Admin — dashboards, moderation, analytics |
| **7** | Notifications — push, email, SMS via BullMQ |
