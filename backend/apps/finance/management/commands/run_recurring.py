"""Create the transactions of repeating payments that are due: `python manage.py run_recurring`.

Safe to run as often as you like (e.g. hourly from cron): each schedule remembers the last
date it ran up to, and the database allows only one transaction per schedule and date.
"""

from datetime import date

from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import User
from apps.finance.recurring import run_recurring


class Command(BaseCommand):
    help = "Create due transactions for repeating payments (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument("--date", dest="as_of", help="Run as if today were YYYY-MM-DD (default: today).")
        parser.add_argument("--user", help="Only this username.")

    def handle(self, *args, as_of=None, user=None, **options):
        today = None
        if as_of:
            try:
                today = date.fromisoformat(as_of)
            except ValueError as exc:
                raise CommandError("Use the YYYY-MM-DD format for --date.") from exc
        owner = None
        if user:
            owner = User.objects.filter(username=user).first()
            if not owner:
                raise CommandError(f"No user named {user!r}.")
        created = run_recurring(today=today, user=owner)
        self.stdout.write(self.style.SUCCESS(f"Created {created} transaction(s)."))
