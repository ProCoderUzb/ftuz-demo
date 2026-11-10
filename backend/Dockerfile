FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
# Admin static files are collected at build time and served by WhiteNoise.
RUN DJANGO_DEBUG=false DJANGO_SECRET_KEY=build-only-not-secret python manage.py collectstatic --noinput

RUN useradd --system --no-create-home app
USER app

EXPOSE 8000
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--access-logfile", "-"]
