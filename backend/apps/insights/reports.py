"""Monthly aggregates. All totals are converted to UZS at today's Central Bank rate."""

import calendar
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Count, Sum

from apps.finance.models import Budget, Category, Kind, Transaction
from apps.finance.services import ZERO, to_uzs
from apps.finance.utils import shift_month

CENT = Decimal("0.01")


def money(value: Decimal) -> str:
    return str(value.quantize(CENT, rounding=ROUND_HALF_UP))


def pct_change(current: Decimal, previous: Decimal):
    if previous == 0:
        return None
    return float(((current - previous) / previous * 100).quantize(Decimal("0.1")))


@dataclass
class MonthTotals:
    income: Decimal = ZERO
    expense: Decimal = ZERO
    by_category: dict = field(default_factory=lambda: defaultdict(lambda: ZERO))
    count_by_category: dict = field(default_factory=lambda: defaultdict(int))

    @property
    def net(self):
        return self.income - self.expense

    @property
    def savings_rate(self):
        if self.income <= 0:
            return None
        return float((self.net / self.income * 100).quantize(Decimal("0.1")))


def month_range(year, month):
    return date(year, month, 1), date(year, month, calendar.monthrange(year, month)[1])


def month_totals(user, year, month, rate) -> MonthTotals:
    totals = MonthTotals()
    rows = (
        Transaction.objects.filter(user=user, date__range=month_range(year, month))
        .values("kind", "category_id", "wallet__currency")
        .annotate(total=Sum("amount"), n=Count("id"))
    )
    for row in rows:
        amount = to_uzs(row["total"], row["wallet__currency"], rate)
        if row["kind"] == Kind.INCOME:
            totals.income += amount
        else:
            totals.expense += amount
        totals.by_category[row["category_id"]] += amount
        totals.count_by_category[row["category_id"]] += row["n"]
    return totals


def category_ref(category: Category):
    return {"id": category.id, "key": category.key, "name": category.name, "icon": category.icon, "color": category.color}


def daily_series(user, year, month, rate):
    start, end = month_range(year, month)
    days = {d: {"income": ZERO, "expense": ZERO} for d in range(1, end.day + 1)}
    rows = (
        Transaction.objects.filter(user=user, date__range=(start, end))
        .values("date", "kind", "wallet__currency")
        .annotate(total=Sum("amount"))
    )
    for row in rows:
        days[row["date"].day][row["kind"]] += to_uzs(row["total"], row["wallet__currency"], rate)
    return [
        {"day": d, "income": money(v["income"]), "expense": money(v["expense"])}
        for d, v in days.items()
    ]


def budget_progress(user, totals: MonthTotals):
    result = []
    for budget in Budget.objects.filter(user=user).select_related("category"):
        spent = totals.by_category.get(budget.category_id, ZERO)
        pct = float((spent / budget.amount * 100).quantize(Decimal("0.1")))
        result.append({
            "id": budget.id,
            "category": category_ref(budget.category),
            "limit": money(budget.amount),
            "spent": money(spent),
            "left": money(budget.amount - spent),
            "percent": pct,
        })
    return sorted(result, key=lambda b: -b["percent"])


def monthly_summary(user, year, month, rate):
    """Everything the dashboard and monthly report need for one month."""
    current = month_totals(user, year, month, rate)
    prev_year, prev_month = shift_month(year, month, -1)
    previous = month_totals(user, prev_year, prev_month, rate)

    categories = Category.objects.filter(user=user, id__in=set(current.by_category) | set(previous.by_category))
    breakdown = []
    for category in categories:
        amount = current.by_category.get(category.id, ZERO)
        prev_amount = previous.by_category.get(category.id, ZERO)
        kind_total = current.income if category.kind == Kind.INCOME else current.expense
        breakdown.append({
            "category": category_ref(category),
            "kind": category.kind,
            "amount": money(amount),
            "count": current.count_by_category.get(category.id, 0),
            "share": float((amount / kind_total * 100).quantize(Decimal("0.1"))) if kind_total else 0.0,
            "previous": money(prev_amount),
            "change": pct_change(amount, prev_amount),
        })
    breakdown.sort(key=lambda c: -Decimal(c["amount"]))

    return {
        "month": f"{year:04d}-{month:02d}",
        "income": money(current.income),
        "expense": money(current.expense),
        "net": money(current.net),
        "savings_rate": current.savings_rate,
        "previous": {
            "income": money(previous.income),
            "expense": money(previous.expense),
            "net": money(previous.net),
        },
        "change": {
            "income": pct_change(current.income, previous.income),
            "expense": pct_change(current.expense, previous.expense),
        },
        "categories": breakdown,
        "daily": daily_series(user, year, month, rate),
        "budgets": budget_progress(user, current),
        "_totals": current,
        "_previous_totals": previous,
    }


def trend(user, year, month, rate, months=6):
    series = []
    for offset in range(months - 1, -1, -1):
        y, m = shift_month(year, month, -offset)
        totals = month_totals(user, y, m, rate)
        series.append({"month": f"{y:04d}-{m:02d}", "income": money(totals.income), "expense": money(totals.expense)})
    return series


def top_expenses(user, year, month, rate, limit=5):
    rows = Transaction.objects.filter(
        user=user, kind=Kind.EXPENSE, date__range=month_range(year, month)
    ).select_related("category", "wallet")
    ranked = sorted(rows, key=lambda t: -to_uzs(t.amount, t.wallet.currency, rate))[:limit]
    return [
        {
            "id": t.id,
            "date": t.date.isoformat(),
            "amount": money(t.amount),
            "currency": t.wallet.currency,
            "note": t.note,
            "category": category_ref(t.category),
        }
        for t in ranked
    ]
