#!/usr/bin/env bash
# Pull the latest code and redeploy. Run as root from anywhere: sudo /srv/ftuz/deploy/update.sh
set -euo pipefail
cd /srv/ftuz

sudo -u ftuz git pull --ff-only
sudo -u ftuz backend/.venv/bin/pip install --quiet -r backend/requirements.txt

cd backend
sudo -u ftuz bash -c 'set -a; . /etc/ftuz.env; set +a;
  .venv/bin/python manage.py migrate --noinput &&
  .venv/bin/python manage.py collectstatic --noinput -v0'

cd ../frontend
sudo -u ftuz npm ci --no-audit --no-fund --loglevel=error
# VITE_API_URL from /etc/ftuz.env is baked into the build.
sudo -u ftuz bash -c 'set -a; . /etc/ftuz.env; set +a; npm run build'

systemctl restart ftuz
echo "FTuz updated: $(sudo -u ftuz git -C /srv/ftuz log -1 --format='%h %s')"
