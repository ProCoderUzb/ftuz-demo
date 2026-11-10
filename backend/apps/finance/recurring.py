"""Repeating payments: work out due dates and create their transactions exactly once."""

import calendar
from datetime import date, timedelta

from django.db import transaction as db_transaction
from django.utils import timezone

from .models import Recurring, Transaction
from .utils import shift_month


def _monthly(day_of_month: int, start: date, until: date):
    y, m = start.year, start.month
    while True:
        d = date(y, m, min(day_of_month, calendar.monthrange(y, m)[1]))
        if d > until:
            return
        if d >= start:
            yield d
        y, m = shift_month(y, m, 1)


def _weekly(weekday: int, start: date, until: date):
    d = start + timedelta(days=(weekday - start.weekday()) % 7)
    while d <= until:
        yield d
        d += timedelta(days=7)


def occurrences(rec: Recurring, until: date):
    """Due dates not generated yet, up to and including `until`."""
    start = rec.start_date
    if rec.last_run_date and rec.last_run_date >= start:
        start = rec.last_run_date + timedelta(days=1)
    if start > until:
        return []
    if rec.frequency == Recurring.Frequency.WEEKLY:
        return list(_weekly(rec.weekday, start, until))
    return list(_monthly(rec.day_of_month, start, until))


def next_occurrence(rec: Recurring, today: date | None = None):
    """The next date this schedule will create a transaction (today counts if not run yet)."""
    if not rec.is_active:
        return None
    today = today or timezone.localdate()
    start = rec.start_date
    if rec.last_run_date and rec.last_run_date >= start:
        start = rec.last_run_date + timedelta(days=1)
    horizon = max(start, today) + timedelta(days=62)
    gen = _weekly(rec.weekday, start, horizon) if rec.frequency == Recurring.Frequency.WEEKLY \
        else _monthly(rec.day_of_month, start, horizon)
    return next(gen, None)


def run_one(rec: Recurring, today: date) -> int:
    """Create due transactions for one schedule. Safe to run any number of times."""
    created = 0
    with db_transaction.atomic():
        rec = Recurring.objects.select_for_update().select_related("wallet", "category").get(pk=rec.pk)
        if not rec.is_active or rec.wallet.is_archived or rec.category.is_archived:
            return 0
        for due in occurrences(rec, today):
            _, made = Transaction.objects.get_or_create(
                recurring=rec, date=due,
                defaults=dict(
                    user_id=rec.user_id, kind=rec.kind, wallet_id=rec.wallet_id,
                    category_id=rec.category_id, amount=rec.amount, note=rec.note,
                ),
            )
            created += made
        if rec.last_run_date is None or rec.last_run_date < today:
            rec.last_run_date = today
            rec.save(update_fields=["last_run_date"])
    return created


def run_recurring(today: date | None = None, user=None) -> int:
    today = today or timezone.localdate()
    qs = Recurring.objects.filter(is_active=True, start_date__lte=today)
    if user is not None:
        qs = qs.filter(user=user)
    return sum(run_one(rec, today) for rec in qs)
