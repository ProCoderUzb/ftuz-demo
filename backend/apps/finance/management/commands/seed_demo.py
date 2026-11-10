"""Create a demo account with ~4 months of realistic data: `python manage.py seed_demo`."""

import random
from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.finance.defaults import create_defaults_for
from apps.finance.models import (
    Budget, Category, Debt, DebtPayment, Goal, Kind, Recurring, Transaction, Transfer, Wallet,
)
from apps.finance.services import delete_user
from apps.finance.utils import shift_month

DEMO_USERNAME = "demo"
DEMO_PASSWORD = "ftuz-demo-2026"


def rounded(low, high, step=1000):
    return Decimal(random.randrange(low // step, high // step + 1) * step)


class Command(BaseCommand):
    help = "Create (or recreate) the demo user with sample transactions."

    def add_arguments(self, parser):
        parser.add_argument("--months", type=int, default=6)

    @transaction.atomic
    def handle(self, *args, months, **options):
        random.seed(2026)
        for old in User.objects.filter(username=DEMO_USERNAME):
            delete_user(old)
        user = User.objects.create_user(
            username=DEMO_USERNAME, password=DEMO_PASSWORD, name="Aziza Karimova", language="uz"
        )
        create_defaults_for(user)
        cats = {c.key: c for c in Category.objects.filter(user=user)}

        cash = Wallet.objects.get(user=user)
        cash.initial_balance = Decimal("450000")
        cash.save()
        card = Wallet.objects.create(user=user, name="Uzcard", type="card", initial_balance=Decimal("1200000"), color="#2563EB")
        usd = Wallet.objects.create(
            user=user, name="Dollar jamgʻarma", type="savings", currency="USD",
            initial_balance=Decimal("800"), color="#CA8A04",
        )

        today = timezone.localdate()
        txs = []

        def add(kind, key, wallet, amount, day, note=""):
            if day <= today:
                txs.append(Transaction(user=user, kind=kind, category=cats[key], wallet=wallet,
                                       amount=amount, date=day, note=note))

        for offset in range(months - 1, -1, -1):
            y, m = shift_month(today.year, today.month, -offset)
            is_current = offset == 0
            add(Kind.INCOME, "salary", card, Decimal("5200000"), date(y, m, 5), "Oylik")
            add(Kind.INCOME, "advance", card, Decimal("3300000"), date(y, m, 20), "Avans")
            if offset in (1, 3):
                add(Kind.INCOME, "freelance", usd, Decimal(random.choice([120, 150, 180])), date(y, m, 12), "Upwork")

            add(Kind.EXPENSE, "utilities", card, rounded(280000, 420000), date(y, m, 8), "Elektr, gaz, suv")
            add(Kind.EXPENSE, "phone_internet", card, Decimal("115000"), date(y, m, 3), "Uzmobile + uy interneti")
            add(Kind.EXPENSE, "education", card, Decimal("650000"), date(y, m, 2), "Ingliz tili kursi")
            add(Kind.EXPENSE, "loans", card, Decimal("900000"), date(y, m, 15), "Kredit toʻlovi")

            for week_day in (1, 7, 14, 21, 28):
                add(Kind.EXPENSE, "food", random.choice([card, cash]), rounded(260000, 480000), date(y, m, week_day), "Bozor / Korzinka")
            cafe_visits = 9 if is_current else random.randint(4, 7)
            last_day = today.day if is_current else 28
            for _ in range(cafe_visits):
                add(Kind.EXPENSE, "cafe", random.choice([card, cash]), rounded(45000, 140000), date(y, m, random.randint(1, last_day)))
            for day in range(1, 29, 2):
                add(Kind.EXPENSE, "transport", cash, rounded(4000, 25000, 500), date(y, m, day))
            if random.random() < 0.7:
                add(Kind.EXPENSE, "clothing", card, rounded(250000, 900000), date(y, m, random.randint(1, 28)))
            add(Kind.EXPENSE, "health", cash, rounded(60000, 280000), date(y, m, random.randint(1, 28)), "Dorixona")
            add(Kind.EXPENSE, "entertainment", card, rounded(80000, 220000), date(y, m, random.randint(1, 28)), "Kino")
            if offset == 2:
                add(Kind.EXPENSE, "family_gifts", card, Decimal("1500000"), date(y, m, 18), "Toʻyga sovgʻa")

            for atm_day in (5, 20):
                if date(y, m, atm_day) <= today:
                    Transfer.objects.create(
                        user=user, from_wallet=card, to_wallet=cash, amount=Decimal("1000000"),
                        to_amount=Decimal("1000000"), date=date(y, m, atm_day), note="Bankomat",
                    )
            transfer_day = date(y, m, 6)
            if transfer_day <= today:
                Transfer.objects.create(
                    user=user, from_wallet=card, to_wallet=usd, amount=Decimal("1200000"),
                    to_amount=Decimal("100"), date=transfer_day, note="Dollarga jamgʻarish",
                )

        Transaction.objects.bulk_create(txs)

        for key, limit in (("food", 2000000), ("cafe", 600000), ("transport", 350000), ("entertainment", 300000)):
            Budget.objects.create(user=user, category=cats[key], amount=Decimal(limit))

        Goal.objects.create(user=user, name="Yangi noutbuk", icon="laptop", color="#6366F1",
                            target_amount=Decimal("9000000"), saved_amount=Decimal("3400000"),
                            deadline=today + timedelta(days=120))
        Goal.objects.create(user=user, name="Avtomobil", icon="car", color="#CA8A04", currency="USD",
                            target_amount=Decimal("9000"), saved_amount=Decimal("2650"),
                            deadline=date(today.year + 2, 6, 1))

        # Debts: one due within the week (shows a tip), one partly repaid, one settled.
        Debt.objects.create(user=user, person="Jasur aka", direction=Debt.Direction.LENT, amount=Decimal("1500000"),
                            date=today - timedelta(days=24), due_date=today + timedelta(days=3), note="Ijara uchun")
        sardor = Debt.objects.create(user=user, person="Sardor", direction=Debt.Direction.BORROWED, currency="USD",
                                     amount=Decimal("300"), date=today - timedelta(days=50),
                                     due_date=today + timedelta(days=40), note="Telefon uchun")
        DebtPayment.objects.create(debt=sardor, amount=Decimal("100"), date=today - timedelta(days=20))
        Debt.objects.create(user=user, person="Dilnoza opa", direction=Debt.Direction.LENT, amount=Decimal("400000"),
                            date=today - timedelta(days=70), is_settled=True)

        # Repeating payments; past months were already seeded above, so they continue from today.
        # The internet bill (day 3) and course fee (day 2) are already in this month's data.
        Recurring.objects.create(user=user, kind=Kind.EXPENSE, wallet=card, category=cats["phone_internet"],
                                 amount=Decimal("115000"), note="Uzmobile + uy interneti", day_of_month=3,
                                 start_date=today, last_run_date=today)
        Recurring.objects.create(user=user, kind=Kind.EXPENSE, wallet=card, category=cats["education"],
                                 amount=Decimal("650000"), note="Ingliz tili kursi", day_of_month=2,
                                 start_date=today, last_run_date=today)
        Recurring.objects.create(user=user, kind=Kind.EXPENSE, wallet=cash, category=cats["food"],
                                 amount=Decimal("150000"), note="Non va sut", frequency=Recurring.Frequency.WEEKLY,
                                 weekday=5, start_date=today + timedelta(days=1))

        self.stdout.write(self.style.SUCCESS(
            f"Demo user ready: {DEMO_USERNAME} / {DEMO_PASSWORD} ({len(txs)} transactions)"
        ))
