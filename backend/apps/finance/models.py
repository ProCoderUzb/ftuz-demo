from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

# Money is stored as Decimal (exact), never float.
MONEY = dict(max_digits=18, decimal_places=2)
POSITIVE = [MinValueValidator(Decimal("0.01"))]


class Currency(models.TextChoices):
    UZS = "UZS", "Oʻzbek soʻmi"
    USD = "USD", "US Dollar"


class Kind(models.TextChoices):
    INCOME = "income", "Income"
    EXPENSE = "expense", "Expense"


class OwnedModel(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True


class Wallet(OwnedModel):
    class Type(models.TextChoices):
        CASH = "cash", "Cash"
        CARD = "card", "Card"
        BANK = "bank", "Bank account"
        SAVINGS = "savings", "Savings"

    name = models.CharField(max_length=60)
    type = models.CharField(max_length=10, choices=Type.choices, default=Type.CASH)
    currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.UZS)
    initial_balance = models.DecimalField(**MONEY, default=Decimal("0"))
    color = models.CharField(max_length=9, default="#059669")
    is_archived = models.BooleanField(default=False)

    class Meta:
        ordering = ["is_archived", "created_at"]

    def __str__(self):
        return f"{self.name} ({self.currency})"


class Category(OwnedModel):
    # Default categories carry a `key` the frontend translates; custom ones use `name`.
    key = models.CharField(max_length=40, blank=True)
    name = models.CharField(max_length=60, blank=True)
    kind = models.CharField(max_length=7, choices=Kind.choices)
    icon = models.CharField(max_length=40, default="circle")
    color = models.CharField(max_length=9, default="#64748B")
    is_archived = models.BooleanField(default=False)

    class Meta:
        ordering = ["kind", "id"]
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name or self.key


class Transaction(OwnedModel):
    kind = models.CharField(max_length=7, choices=Kind.choices)
    wallet = models.ForeignKey(Wallet, on_delete=models.PROTECT, related_name="transactions")
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="transactions")
    amount = models.DecimalField(**MONEY, validators=POSITIVE)
    date = models.DateField()
    note = models.CharField(max_length=200, blank=True)
    # Set when the row was created by a repeating payment; one row per schedule and date.
    recurring = models.ForeignKey(
        "Recurring", on_delete=models.SET_NULL, null=True, blank=True, related_name="transactions"
    )

    class Meta:
        ordering = ["-date", "-id"]
        indexes = [models.Index(fields=["user", "date"])]
        constraints = [
            models.UniqueConstraint(
                fields=["recurring", "date"], condition=models.Q(recurring__isnull=False),
                name="one_transaction_per_recurring_date",
            )
        ]

    def __str__(self):
        return f"{self.kind} {self.amount} {self.wallet.currency}"


class Transfer(OwnedModel):
    from_wallet = models.ForeignKey(Wallet, on_delete=models.PROTECT, related_name="transfers_out")
    to_wallet = models.ForeignKey(Wallet, on_delete=models.PROTECT, related_name="transfers_in")
    amount = models.DecimalField(**MONEY, validators=POSITIVE)
    # Differs from `amount` when the wallets use different currencies.
    to_amount = models.DecimalField(**MONEY, validators=POSITIVE)
    date = models.DateField()
    note = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["-date", "-id"]


class Budget(OwnedModel):
    """A monthly spending limit for one expense category, in UZS."""

    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="budgets")
    amount = models.DecimalField(**MONEY, validators=POSITIVE)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "category"], name="one_budget_per_category")]


class Goal(OwnedModel):
    name = models.CharField(max_length=80)
    icon = models.CharField(max_length=40, default="target")
    color = models.CharField(max_length=9, default="#CA8A04")
    currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.UZS)
    target_amount = models.DecimalField(**MONEY, validators=POSITIVE)
    saved_amount = models.DecimalField(**MONEY, default=Decimal("0"))
    deadline = models.DateField(null=True, blank=True)
    is_completed = models.BooleanField(default=False)

    class Meta:
        ordering = ["is_completed", "deadline", "id"]

    def __str__(self):
        return self.name


class Debt(OwnedModel):
    """Money lent to or borrowed from a person. Kept apart from wallets: it is a reminder ledger."""

    class Direction(models.TextChoices):
        LENT = "lent", "Lent (they owe me)"
        BORROWED = "borrowed", "Borrowed (I owe)"

    person = models.CharField(max_length=80)
    direction = models.CharField(max_length=8, choices=Direction.choices)
    amount = models.DecimalField(**MONEY, validators=POSITIVE)
    currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.UZS)
    date = models.DateField()
    due_date = models.DateField(null=True, blank=True)
    note = models.CharField(max_length=200, blank=True)
    is_settled = models.BooleanField(default=False)

    class Meta:
        ordering = ["is_settled", models.F("due_date").asc(nulls_last=True), "-date", "-id"]

    def __str__(self):
        return f"{self.direction} {self.amount} {self.currency} ({self.person})"

    @property
    def paid(self) -> Decimal:
        # Uses the prefetched payments when the queryset has them.
        return sum((p.amount for p in self.payments.all()), Decimal("0"))

    @property
    def remaining(self) -> Decimal:
        return max(self.amount - self.paid, Decimal("0"))


class DebtPayment(models.Model):
    debt = models.ForeignKey(Debt, on_delete=models.CASCADE, related_name="payments")
    amount = models.DecimalField(**MONEY, validators=POSITIVE)
    date = models.DateField()
    note = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-id"]


class Recurring(OwnedModel):
    """A transaction template that `run_recurring` turns into real transactions when due."""

    class Frequency(models.TextChoices):
        MONTHLY = "monthly", "Monthly"
        WEEKLY = "weekly", "Weekly"

    kind = models.CharField(max_length=7, choices=Kind.choices)
    wallet = models.ForeignKey(Wallet, on_delete=models.PROTECT, related_name="recurring")
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="recurring")
    amount = models.DecimalField(**MONEY, validators=POSITIVE)
    note = models.CharField(max_length=200, blank=True)
    frequency = models.CharField(max_length=7, choices=Frequency.choices, default=Frequency.MONTHLY)
    # Monthly: day 1-31, clamped to the month's last day. Weekly: 0 = Monday ... 6 = Sunday.
    day_of_month = models.PositiveSmallIntegerField(null=True, blank=True)
    weekday = models.PositiveSmallIntegerField(null=True, blank=True)
    start_date = models.DateField()
    # The last date transactions were generated up to (inclusive).
    last_run_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-is_active", "id"]
        verbose_name_plural = "recurring"

    def __str__(self):
        return f"{self.frequency} {self.kind} {self.amount}"


class ExchangeRate(models.Model):
    """Daily Central Bank of Uzbekistan rate: 1 unit of `currency` in UZS."""

    currency = models.CharField(max_length=3)
    date = models.DateField()
    rate = models.DecimalField(max_digits=14, decimal_places=4)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["currency", "date"], name="one_rate_per_day")]
        ordering = ["-date"]
