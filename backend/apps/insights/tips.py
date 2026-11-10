"""Savings tips.

Tips are returned as `{code, level, params}`; the client turns the code into a sentence
in the user's language. `TipProvider` is the seam where an AI helper can plug in later:
point settings.TIP_PROVIDER at another class that returns the same shape.
"""

from dataclasses import asdict, dataclass, field
from datetime import date, timedelta
from decimal import Decimal

from django.conf import settings
from django.utils import timezone
from django.utils.module_loading import import_string

from apps.finance.models import Category, Debt, Goal, Kind, Transaction

from .reports import category_ref, money

LEVEL_ORDER = {"danger": 0, "warning": 1, "info": 2, "success": 3}
SPIKE_MIN_UZS = Decimal("100000")  # ignore spikes in categories smaller than this
SAVINGS_TARGET = Decimal("0.20")  # the "20" in the 50/30/20 rule
DEBT_DUE_DAYS = 7


@dataclass
class Tip:
    code: str
    level: str
    params: dict = field(default_factory=dict)


@dataclass
class TipContext:
    user: object
    year: int
    month: int
    summary: dict
    today: date


class TipProvider:
    def tips(self, ctx: TipContext) -> list[Tip]:
        raise NotImplementedError


def debt_tips(user, today) -> list[Tip]:
    """Open debts due within a week (or already overdue), soonest first."""
    out = []
    due_soon = Debt.objects.filter(
        user=user, is_settled=False, due_date__lte=today + timedelta(days=DEBT_DUE_DAYS),
    ).prefetch_related("payments").order_by("due_date")
    for debt in due_soon:
        remaining = debt.remaining
        if remaining <= 0:
            continue
        overdue = debt.due_date < today
        out.append(Tip(
            f"debt_{'overdue' if overdue else 'due'}_{debt.direction}",
            "danger" if overdue else "warning",
            {"person": debt.person, "amount": money(remaining), "currency": debt.currency,
             "due": debt.due_date.isoformat()},
        ))
    return out


class RuleBasedTipProvider(TipProvider):
    def tips(self, ctx):
        if not Transaction.objects.filter(user=ctx.user).exists():
            return debt_tips(ctx.user, ctx.today) or [Tip("start_tracking", "info")]

        totals = ctx.summary["_totals"]
        previous = ctx.summary["_previous_totals"]
        is_current = (ctx.year, ctx.month) == (ctx.today.year, ctx.today.month)
        out: list[Tip] = []

        # Income vs spending
        if totals.income == 0 and totals.expense > 0:
            out.append(Tip("no_income_recorded", "info"))
        elif totals.expense > totals.income > 0:
            out.append(Tip("overspending", "danger", {"amount": money(totals.expense - totals.income)}))
        elif totals.income > 0 and not is_current:
            # A month in progress has income in but most spending still ahead, so only judge closed months.
            rate = totals.savings_rate
            if rate >= 20:
                out.append(Tip("great_savings", "success", {"rate": rate}))
            elif rate < 10:
                out.append(Tip("low_savings", "warning", {
                    "rate": rate, "target": money(totals.income * SAVINGS_TARGET),
                }))

        # Safe amount to spend per day for the rest of the month, keeping 20% aside
        if is_current and totals.income > 0:
            days_left = ctx.summary["days_in_month"] - ctx.today.day + 1
            room = totals.income * (1 - SAVINGS_TARGET) - totals.expense
            if room > 0:
                out.append(Tip("daily_allowance", "info", {"amount": money(room / days_left), "days": days_left}))

        # Budgets
        for budget in ctx.summary["budgets"]:
            if budget["percent"] >= 100:
                out.append(Tip("budget_exceeded", "danger", {
                    "category": budget["category"], "amount": money(-Decimal(budget["left"])),
                }))
            elif budget["percent"] >= 80:
                out.append(Tip("budget_near", "warning", {
                    "category": budget["category"], "percent": budget["percent"], "left": budget["left"],
                }))

        # Category changes vs the previous month
        expense_cats = {c.id: c for c in Category.objects.filter(user=ctx.user, kind=Kind.EXPENSE)}
        spikes, drops = [], []
        for cat_id, cat in expense_cats.items():
            now, before = totals.by_category.get(cat_id, 0), previous.by_category.get(cat_id, 0)
            if before >= SPIKE_MIN_UZS and now > before * Decimal("1.25"):
                spikes.append((now - before, cat, now, before))
            elif before >= SPIKE_MIN_UZS and not is_current and now < before * Decimal("0.8"):
                drops.append((before - now, cat, now, before))
        for diff, cat, now, before in sorted(spikes, key=lambda s: -s[0])[:2]:
            out.append(Tip("category_up", "warning", {
                "category": category_ref(cat),
                "percent": round(float((now - before) / before * 100)),
                "amount": money(diff),
            }))
        if drops:
            diff, cat, _, before = max(drops, key=lambda d: d[0])
            out.append(Tip("category_down", "success", {
                "category": category_ref(cat),
                "percent": round(float(diff / before * 100)),
                "amount": money(diff),
            }))

        # One category eats most of the spending
        if totals.expense > 0 and expense_cats:
            cat_id, amount = max(
                ((cid, amt) for cid, amt in totals.by_category.items() if cid in expense_cats),
                key=lambda pair: pair[1],
                default=(None, 0),
            )
            share = amount / totals.expense * 100 if cat_id else 0
            if share >= 40 and len([a for c, a in totals.by_category.items() if c in expense_cats]) > 2:
                out.append(Tip("top_category", "info", {
                    "category": category_ref(expense_cats[cat_id]), "percent": round(float(share)),
                }))

        # Many small purchases add up
        for cat_id, count in totals.count_by_category.items():
            cat = expense_cats.get(cat_id)
            if cat and cat.key in ("cafe", "entertainment") and count >= 8:
                out.append(Tip("small_purchases", "info", {
                    "category": category_ref(cat), "count": count, "amount": money(totals.by_category[cat_id]),
                }))

        # Goals with a deadline: how much to put aside each month
        for goal in Goal.objects.filter(user=ctx.user, is_completed=False, deadline__isnull=False):
            remaining = goal.target_amount - goal.saved_amount
            months_left = max(1, (goal.deadline.year - ctx.today.year) * 12 + goal.deadline.month - ctx.today.month)
            if remaining > 0:
                out.append(Tip("goal_monthly", "info", {
                    "goal": goal.name, "amount": money(remaining / months_left),
                    "currency": goal.currency, "months": months_left,
                }))

        out.extend(debt_tips(ctx.user, ctx.today))

        return sorted(out, key=lambda tip: LEVEL_ORDER[tip.level])


def get_tip_provider() -> TipProvider:
    path = getattr(settings, "TIP_PROVIDER", "apps.insights.tips.RuleBasedTipProvider")
    return import_string(path)()


def tips_for(user, year, month, summary, limit=6):
    ctx = TipContext(user=user, year=year, month=month, summary=summary, today=timezone.localdate())
    return [asdict(tip) for tip in get_tip_provider().tips(ctx)[:limit]]
