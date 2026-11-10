# FTuz — Financial Tracker uz

A personal income and expense tracker for everyone, from students to pensioners.
Users record income and expenses by hand, sort them into categories, see monthly charts and a
monthly report, set budgets and savings goals, and get simple savings tips.

- **Languages:** Oʻzbekcha (Latin), Русский, English
- **Currencies:** UZS and USD, with the daily Central Bank of Uzbekistan (cbu.uz) rate
- **Design:** Bento grid layout, glass surfaces, soft-UI controls, light and dark themes,
  adjustable text size and a *Simple mode* with bigger buttons

## Stack

| Part | Tech |
|---|---|
| API | Django 5.2, Django REST Framework, SimpleJWT, drf-spectacular (OpenAPI) |
| Web | Vite, React 19, TypeScript, TanStack Query, React Router, i18next, Recharts, Lucide icons |
| DB | SQLite in development; PostgreSQL in production via `DATABASE_URL` |

The API is versioned (`/api/v1/`) and documented with OpenAPI, so a future mobile app (React Native) can use it as is.

## Run it locally

You need Python 3.12+ and Node 20+.

**1. API** (terminal 1)

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_demo
.venv/bin/python manage.py runserver 127.0.0.1:8000
```

**2. Web app** (terminal 2)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The Vite dev server forwards `/api` to Django on port 8000.

### Demo account

`seed_demo` creates a user with six months of realistic data (salary + avans, groceries, café,
transport, utilities, a USD savings wallet, budgets and two goals):

- username: `demo`
- password: `ftuz-demo-2026`

In development the login page also has a **Try the demo account** button. Running `seed_demo`
again resets the demo data.

## Useful URLs

- API docs (Swagger): http://127.0.0.1:8000/api/docs/
- OpenAPI schema: http://127.0.0.1:8000/api/schema/
- Django admin: http://127.0.0.1:8000/admin/ (create a user with `manage.py createsuperuser`)

## Tests

```bash
cd backend && .venv/bin/python manage.py test apps
cd frontend && npx tsc -b && npm run build
```

## Project layout

```
backend/
  config/            settings, root URLs
  apps/accounts/     custom user (name, username, language, theme, text size, simple mode), auth endpoints
  apps/finance/      wallets, categories, transactions, transfers, budgets, goals, debts, repeating payments,
                     exchange rates, seed_demo, run_recurring
  apps/insights/     dashboard, monthly report, rule-based savings tips
frontend/src/
  api/               axios client (JWT + refresh), React Query hooks, types
  i18n/locales/      en.ts (reference), uz.ts, ru.ts
  styles/            tokens.css (colors, glass, soft shadows, dark mode), app.css
  components/        UI kit, charts, transaction form, layout
  pages/             one file per screen
```

## Design notes

- Money is stored as `Decimal` and sent as strings ("125000.00"), never as floats.
- Totals across wallets are converted to UZS at today's Central Bank rate. If cbu.uz is
  unreachable, the last saved rate is used, then `FALLBACK_USD_RATE`.
- Categories and wallets that already have transactions are archived instead of deleted, so history stays intact.
- Default categories have a `key` and are translated on the client, so they follow the user's language.
- Savings tips come from the API as `{code, level, params}` and are worded on the client in the user's language.
  `apps/insights/tips.py` has a `TipProvider` class; an AI helper can replace the rule-based provider later
  by pointing `settings.TIP_PROVIDER` at a new class that returns the same format.
- Debts (`/api/v1/debts/`) are a reminder ledger kept apart from wallet balances. Partial repayments go
  through `POST /debts/{id}/repay/`; a debt is settled automatically when nothing is left.
- Repeating payments (`/api/v1/recurring/`) are turned into transactions by
  `manage.py run_recurring` (the `scheduler` service runs it hourly). It is idempotent: each schedule stores
  `last_run_date`, and there can be only one transaction per schedule and date. The dashboard also
  catches up the current user's schedules, so development works without cron. Monthly schedules on
  day 29–31 fall on the last day of shorter months; resuming a paused schedule skips the paused dates.
- Income and expense colors (teal / rose) were checked for color-blind separation, and amounts always
  also show a +/− sign and an arrow.

## Deploying

The repository ships a Docker Compose stack for a single server (any VPS with Docker, e.g. in Tashkent
or a cloud provider):

| Service | What it does |
|---|---|
| `db` | PostgreSQL 17, data in the `pgdata` volume |
| `api` | Django on gunicorn; runs migrations on start; WhiteNoise serves admin static files |
| `scheduler` | runs `manage.py run_recurring` every hour (idempotent) |
| `web` | Caddy: automatic HTTPS (Let's Encrypt), serves the built React app, forwards `/api`, `/admin`, `/static` |

1. Point your domain's DNS (A record) at the server and open ports 80 and 443.
2. `cp .env.example .env` and fill in `DOMAIN`, `DJANGO_SECRET_KEY` and `POSTGRES_PASSWORD`.
3. `docker compose up -d --build`
4. Create an admin user: `docker compose exec api python manage.py createsuperuser`

Updating: pull the new code and run `docker compose up -d --build` again (migrations run automatically).
Back up the database with `docker compose exec db pg_dump -U ftuz ftuz > backup.sql`.

To try the stack locally, set `DOMAIN=localhost`; Caddy then uses a self-signed certificate.

### Security settings

With `DJANGO_DEBUG=false` Django redirects HTTP to HTTPS, uses secure cookies, trusts the proxy's
`X-Forwarded-Proto` header and sends HSTS (`DJANGO_HSTS_SECONDS`, default one hour — raise it to
`31536000` once HTTPS works everywhere). HSTS for subdomains and preload are opt-in
(`DJANGO_HSTS_INCLUDE_SUBDOMAINS`, `DJANGO_HSTS_PRELOAD`). `manage.py check --deploy` passes.

### Without Docker

For a lighter setup with nginx, gunicorn and systemd (no Docker), follow
[deploy/README.md](deploy/README.md); the config files are in `deploy/`. It serves the web app on
`ft.educationpro.uz` and the API on `ftapi.educationpro.uz`. In short:

- Set `DJANGO_DEBUG=false`, a long random `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS` and
  `DATABASE_URL` (PostgreSQL). Settings are read from environment variables.
- Run `migrate`, `collectstatic`, then `gunicorn config.wsgi:application` behind an HTTPS proxy that
  sets `X-Forwarded-Proto` and forwards `/api`, `/admin` and `/static` to it.
- `npm run build` and serve `frontend/dist` on the same domain (or set `VITE_API_URL` and `CORS_ALLOWED_ORIGINS`).
- Add `run_recurring` to cron, e.g. `0 * * * * cd /srv/ftuz/backend && .venv/bin/python manage.py run_recurring`.

## Continuous integration

`.github/workflows/ci.yml` runs on pushes to `main` and on pull requests: backend tests on PostgreSQL, a
missing-migrations check and `check --deploy`, plus frontend lint and production build.
