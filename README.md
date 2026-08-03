# Collective Enfranchisement Valuation Tool

A full-stack Next.js application for UK leasehold collective enfranchisement calculations.

## Features
- Building management with eligibility assessment (2/3 qualifying tenant rule)
- Flat/leaseholder CRUD with participation tracking
- Nominee purchaser entity management
- Element C calculation (Severance & Injurious Affection)
- Cost apportionment across participationg leaseholders
- Notice state machine (Draft > s.13 Served > s.21 Counter-Notice > Terms Agreed > Completion)
- Full RICS-compliant valuation workflow

## Tech Stack
- **Frontend**: Next.js 15, React, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes (catch-all pattern)
- **Database**: MongoDB
- **Deployment**: Standalone Next.js build

## API Endpoints
- `POST/GET /api/buildings` - Building CRUD
- `GET/PUT/DELETE /api/buildings/{id}` - Single building
- `POST/GET /api/buildings/{id}/flats` - Flat management
- `GET/PUT/DELETE /api/flats/{id}` - Single flat
- `POST/GET /api/buildings/{id}/nominee` - Nominee purchaser (upsert)
- `GET /api/buildings/{id}/eligibility` - Eligibility check
- `GET /api/buildings/{id}/element-c` - Element C calculation
- `GET /api/buildings/{id}/apportionment` - Cost apportionment
- `POST/GET /api/buildings/{id}/notices` - Notice maanagement
- `GET/PUT/DELETE /api/notices/{id}` - Single notice
- `PUT /api/notices/{id}/transition` - Staty transitions

## Environment Variables
- `MONGODB_URI` - MongoDB connection string
- `CORS_ORIGINS` - Comma-separated allowed origins (or * for all)

## Development
```bash
npm install
npm run dev
```

## Test Coverage
54/54 regression tests passing (buildings, flats, nominee, eligibility, element-c, apportionment, notices).
