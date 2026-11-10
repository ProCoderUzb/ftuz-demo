import logging
from decimal import Decimal

import requests
from django.conf import settings
from django.db.models import Sum
from django.utils import timezone

from .models import Currency, Debt, ExchangeRate, Kind, Recurring, Transaction, Transfer, Wallet

log = logging.getLogger(__name__)

CBU_URL = "https://cbu.uz/uz/arkhiv-kursov-valyut/json/{ccy}/"
ZERO = Decimal("0")


def get_usd_rate() -> Decimal:
    """Today's USD->UZS rate: cached row, else the Central Bank API, else last known, else fallback."""
    today = timezone.localdate()
    cached = ExchangeRate.objects.filter(currency="USD", date=today).first()
    if cached:
        return cached.rate
    try:
        resp = requests.get(CBU_URL.format(ccy="USD"), timeout=5)
        resp.raise_for_status()
        rate = Decimal(resp.json()[0]["Rate"])
        ExchangeRate.objects.update_or_create(currency="USD", date=today, defaults={"rate": rate})
        return rate
    except (requests.RequestException, KeyError, IndexError, ValueError, ArithmeticError) as exc:
        log.warning("CBU rate fetch failed: %s", exc)
    last = ExchangeRate.objects.filter(currency="USD").first()
    return last.rate if last else Decimal(settings.FALLBACK_USD_RATE)


def to_uzs(amount: Decimal, currency: str, usd_rate: Decimal) -> Decimal:
    return amount * usd_rate if currency == Currency.USD else amount


def _sum_by(qs, field, value_field):
    return {row[field]: row["total"] or ZERO for row in qs.values(field).annotate(total=Sum(value_field))}


def wallet_balances(user) -> dict[int, Decimal]:
    """Current balance of every wallet of `user`, in the wallet's own currency."""
    tx = Transaction.objects.filter(user=user)
    income = _sum_by(tx.filter(kind=Kind.INCOME), "wallet_id", "amount")
    expense = _sum_by(tx.filter(kind=Kind.EXPENSE), "wallet_id", "amount")
    transfers = Transfer.objects.filter(user=user)
    out = _sum_by(transfers, "from_wallet_id", "amount")
    into = _sum_by(transfers, "to_wallet_id", "to_amount")
    balances = {}
    for wallet in Wallet.objects.filter(user=user):
        w = wallet.id
        balances[w] = (
            wallet.initial_balance
            + income.get(w, ZERO)
            - expense.get(w, ZERO)
            - out.get(w, ZERO)
            + into.get(w, ZERO)
        )
    return balances


def debt_summary(user, rate: Decimal) -> dict:
    """Open debts in UZS: what others owe the user and what the user owes."""
    totals = {Debt.Direction.LENT: ZERO, Debt.Direction.BORROWED: ZERO}
    counts = {Debt.Direction.LENT: 0, Debt.Direction.BORROWED: 0}
    next_due = None
    for debt in Debt.objects.filter(user=user, is_settled=False).prefetch_related("payments"):
        remaining = debt.remaining
        if remaining <= 0:
            continue
        totals[debt.direction] += to_uzs(remaining, debt.currency, rate)
        counts[debt.direction] += 1
        if debt.due_date and (next_due is None or debt.due_date < next_due.due_date):
            next_due = debt
    return {
        "owed_to_me": totals[Debt.Direction.LENT],
        "i_owe": totals[Debt.Direction.BORROWED],
        "owed_to_me_count": counts[Debt.Direction.LENT],
        "i_owe_count": counts[Debt.Direction.BORROWED],
        "next_due": next_due,
    }


def delete_user(user):
    """Delete a user and all their data. Wallets/categories are PROTECTed, so remove dependents first."""
    for model in (Transfer, Transaction, Recurring):
        model.objects.filter(user=user).delete()
    user.delete()
