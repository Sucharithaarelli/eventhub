# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
EventHub is a full-stack event ticket booking platform built for QA training. Users can browse events, book tickets, manage bookings, and create events. Each user operates in an isolated sandbox.

## Tech Stack
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, React Query v5
- **Backend**: Express.js, Prisma ORM, MySQL 8+
- **Auth**: JWT (7-day expiry), bcryptjs
- **Testing**: Playwright E2E (Chromium only)

## Commands to Run
```bash
npm run dev          # Start frontend (port 3000) + backend (port 3001) concurrently
npm run seed         # Upsert 3 static events + 2 test users (idempotent)
npm run test         # Run all Playwright tests (against production URL)
npm run test:ui      # Playwright with UI mode
npx playwright test tests/<file>.spec.js --reporter=line  # Run single test file
```

## Architecture Pattern
Backend follows layered architecture: Routes → Controllers → Services → Repositories → Database

```
eventhub/
├── frontend/          # Next.js 14 app (port 3000)
│   ├── app/           # Pages (App Router): login, register, events, bookings, admin
│   ├── components/    # React components
│   ├── lib/           # API clients, hooks, providers
│   └── types/         # TypeScript interfaces
├── backend/           # Express API (port 3001)
│   ├── src/
│   │   ├── routes/        # HTTP endpoints
│   │   ├── controllers/   # Request handlers
│   │   ├── services/      # Business logic
│   │   ├── repositories/  # Data access (Prisma)
│   │   ├── validators/    # Input validation
│   │   └── middleware/    # Auth, error handling
│   └── prisma/            # Schema + seed
├── tests/             # Playwright E2E tests
└── playwright.config.ts
```

## REST API Endpoints
All endpoints except `/api/auth/*` require `Authorization: Bearer <token>`.

```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me

GET    /api/events              ?category, city, search, page, limit
GET    /api/events/:id
POST   /api/events
PUT    /api/events/:id
DELETE /api/events/:id

GET    /api/bookings            ?eventId, status, page, limit
GET    /api/bookings/ref/:ref
GET    /api/bookings/:id
POST   /api/bookings
DELETE /api/bookings            (clear all for current user)
DELETE /api/bookings/:id        (cancel single booking)
```

Swagger docs (when backend is running): `http://localhost:3001/api-docs`

## Key Architectural Decisions

**Per-user seat isolation**: `availableSeats` in the DB is never decremented on booking or restored on cancellation. Instead, `eventService.getEvents()` and `getEventById()` compute a per-user view: `DB availableSeats − user's own booked quantity`. This is what creates the sandbox — each user sees seats as if they're the only one booking.

**FIFO pruning**: When a user hits limits, the oldest record is silently deleted before the new one is created — no error is raised. Events cap at 6 user-created; bookings cap at 9. The pruning prefers to delete a booking from a *different* event; same-event fallback permanently burns a seat from the DB.

**Static events**: The 3 seeded events (`isStatic: true`, `userId: null`) are visible to all users and cannot be edited or deleted. Seat counts on static events never change in the DB.

## Key Business Rules
- Max 6 user-created events (FIFO pruning on overflow)
- Max 9 bookings per user (FIFO pruning on overflow)
- Booking ref format: `<EventTitle[0].toUpperCase()>-<6 alphanumeric chars>` (e.g. `W-A1B2C3`)
- Refund eligibility: quantity = 1 → eligible; quantity > 1 → not eligible (client-side check only)
- Cross-user booking access returns 403 "Access Denied"
- Static events are immutable (cannot be updated/deleted even by their implicit owner)

## Testing Conventions
- Test files: `tests/<feature-name>.spec.js`
- Tests run against `https://eventhub.rahulshettyacademy.com` (production) — **not localhost**
- Tests must be self-contained: login → clear state → action → assert
- Locator priority: `data-testid` > role > label/placeholder > `#id` > CSS class
- No `page.waitForTimeout()` — use `expect().toBeVisible()`
- Test accounts:
  - `rahulshetty1@gmail.com` / `Magiclife1!`
  - `rahulshetty1@yahoo.com` / `Magiclife1!` (second user for cross-user tests)

## Custom Slash Commands (Agents)
- `/generate-tests <feature>` — AI Test Automation Engineer: generates Playwright tests
- `/review-tests <file>` — AI Code Reviewer: reviews test code quality
- `/create-scenarios <area>` — AI Functional Tester: creates test scenario documents
- `/test-strategy <scenarios>` — AI Test Architect: assigns tests to optimal pyramid layers

## Skill Documents
- `.claude/docs/playwright-best-practices.md` — Playwright testing standards
- `.claude/docs/eventhub-domain.md` — Domain knowledge and business rules

## Code Style
- Backend: JavaScript with JSDoc, Express patterns
- Frontend: TypeScript, React hooks, Tailwind utility classes
- Tests: JavaScript with Playwright test runner
