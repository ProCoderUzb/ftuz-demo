# Deploying without Docker (nginx + gunicorn + systemd)

A lighter alternative to `docker-compose.yml` for a single Ubuntu/Debian server (1 GB RAM is enough).

| Piece | Runs as |
|---|---|
| PostgreSQL | system package |
| Django API | gunicorn on `127.0.0.1:8000`, systemd service `ftuz` |
| Repeating payments | systemd timer `ftuz-recurring` (hourly `manage.py run_recurring`) |
| Web app, admin static files, HTTPS | nginx + Let's Encrypt (certbot) |

Two domains:

- **ft.educationpro.uz**: the web app (static files served by nginx)
- **ftapi.educationpro.uz**: the API (`/api/v1/`) and the Django admin (`/admin/`); the mobile app will use it too

Before step 7, create a DNS **A record for each name** pointing at the server's IP. Commands below run
as root (`sudo -i`).

## 1. Packages

```bash
apt update && apt install -y git python3-venv postgresql nginx certbot python3-certbot-nginx
```

The frontend build needs Node.js 20.19 or newer (Ubuntu's own `nodejs` package is older):

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs
```

(Or build on your own computer with `npm run build` and copy `frontend/dist/` to the server.)

## 2. App user and code

```bash
adduser --system --group --home /srv/ftuz ftuz
sudo -u ftuz git clone https://github.com/ProCoderUzb/ftuz-demo.git /srv/ftuz
```

For a private repository, add a read-only deploy key (`ssh-keygen -t ed25519` as the `ftuz` user,
then GitHub → Settings → Deploy keys) and clone with the SSH URL.

## 3. Database

```bash
sudo -u postgres createuser ftuz
sudo -u postgres createdb -O ftuz ftuz
sudo -u postgres psql -c "ALTER USER ftuz PASSWORD 'choose-a-long-password';"
```

## 4. Settings

```bash
cp /srv/ftuz/deploy/ftuz.env.example /etc/ftuz.env
chown root:ftuz /etc/ftuz.env && chmod 640 /etc/ftuz.env
nano /etc/ftuz.env
```

Fill in `DJANGO_SECRET_KEY` (`python3 -c "import secrets; print(secrets.token_urlsafe(50))"`) and the
database password in `DATABASE_URL`. The domain settings are already filled in:
`DJANGO_ALLOWED_HOSTS` (API domain), `CORS_ALLOWED_ORIGINS` (lets the web app call the API) and
`VITE_API_URL` (built into the web app). If a domain ever changes, edit them and run `update.sh`.

## 5. Build

```bash
cd /srv/ftuz/backend
sudo -u ftuz python3 -m venv .venv
sudo -u ftuz .venv/bin/pip install -r requirements.txt
```

`update.sh` (step 8) installs the rest, runs migrations and `collectstatic`, and builds the web app
with the API address from `/etc/ftuz.env`. Run it once now:

```bash
/srv/ftuz/deploy/update.sh
```

It restarts the `ftuz` service at the end, which fails until step 6 is done — that is fine the first time.

## 6. Services

```bash
cp /srv/ftuz/deploy/ftuz.service /srv/ftuz/deploy/ftuz-recurring.service /srv/ftuz/deploy/ftuz-recurring.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now ftuz ftuz-recurring.timer
systemctl status ftuz
```

## 7. nginx and HTTPS

```bash
cp /srv/ftuz/deploy/nginx-ftuz.conf /etc/nginx/sites-available/ftuz
ln -s /etc/nginx/sites-available/ftuz /etc/nginx/sites-enabled/ftuz
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
certbot --nginx -d ft.educationpro.uz -d ftapi.educationpro.uz --redirect
```

nginx needs to read `/srv/ftuz/frontend/dist` and `/srv/ftuz/backend/staticfiles`. If pages return
403, run `chmod 755 /srv/ftuz`.

Open https://ft.educationpro.uz to use the app; the admin is at https://ftapi.educationpro.uz/admin/.
Create your admin account:

```bash
cd /srv/ftuz/backend && sudo -u ftuz bash -c 'set -a; . /etc/ftuz.env; .venv/bin/python manage.py createsuperuser'
```

`/etc/ftuz.env` holds the secrets: only root can change it and only the `ftuz` group can read it.

## 8. Updating

```bash
/srv/ftuz/deploy/update.sh
```

Pulls the code, installs requirements, migrates, collects static files, rebuilds the frontend and
restarts gunicorn.

## Logs and backups

```bash
journalctl -u ftuz -f
```

```bash
systemctl list-timers ftuz-recurring
```

```bash
sudo -u postgres pg_dump ftuz > /root/ftuz-$(date +%F).sql
```
