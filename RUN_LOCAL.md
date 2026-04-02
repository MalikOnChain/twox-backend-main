# Run backend locally (Windows)

## Prereqs
- **Node.js 20.x** installed (this project declares Node `^20.18.1`).
- **Docker Desktop** (recommended) for MongoDB.

## 1) Start MongoDB

```bash
docker compose up -d
```

Optional UI: Mongo Express at `http://localhost:8081`.

## 2) Configure environment

- Copy `.env.example` → `.env` (a local-dev `.env` is already created for you).
- If you change ports/URLs, keep these valid URLs:
  - `BACKEND_URL`
  - `FRONTEND_URL`
  - `ADMIN_PANEL_FRONTEND_URL`

## 3) Install and run

```bash
npm install
npm run dev
```

Backend defaults to `http://localhost:5000`.

