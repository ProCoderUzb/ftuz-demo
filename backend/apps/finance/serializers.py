from datetime import date

from django.utils import timezone
from rest_framework import serializers

from .models import Budget, Category, Debt, DebtPayment, Goal, Recurring, Transaction, Transfer, Wallet
from .recurring import next_occurrence


class OwnedPrimaryKeyField(serializers.PrimaryKeyRelatedField):
    """A foreign key limited to the requesting user's own objects."""

    def get_queryset(self):
        return super().get_queryset().filter(user=self.context["request"].user)


class WalletSerializer(serializers.ModelSerializer):
    balance = serializers.SerializerMethodField()

    class Meta:
        model = Wallet
        fields = ["id", "name", "type", "currency", "initial_balance", "color", "is_archived", "balance"]

    def get_balance(self, obj) -> str:
        balances = self.context.get("balances", {})
        return str(balances.get(obj.id, obj.initial_balance))

    def validate_currency(self, value):
        if self.instance and self.instance.currency != value and self.instance.transactions.exists():
            raise serializers.ValidationError("Currency cannot change once the wallet has transactions.")
        return value


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "key", "name", "kind", "icon", "color", "is_archived"]
        read_only_fields = ["key"]

    def validate(self, attrs):
        has_key = self.instance and self.instance.key
        if not has_key and not (attrs.get("name") or (self.instance and self.instance.name)):
            raise serializers.ValidationError({"name": "Name is required."})
        if self.instance and "kind" in attrs and attrs["kind"] != self.instance.kind:
            if self.instance.transactions.exists():
                raise serializers.ValidationError({"kind": "Type cannot change once the category is used."})
        return attrs


class TransactionSerializer(serializers.ModelSerializer):
    wallet = OwnedPrimaryKeyField(queryset=Wallet.objects.all())
    category = OwnedPrimaryKeyField(queryset=Category.objects.all())
    currency = serializers.CharField(source="wallet.currency", read_only=True)

    class Meta:
        model = Transaction
        fields = ["id", "kind", "wallet", "category", "amount", "currency", "date", "note", "recurring", "created_at"]
        read_only_fields = ["recurring"]

    def validate(self, attrs):
        return validate_category_kind(self.instance, attrs)


def validate_category_kind(instance, attrs):
    kind = attrs.get("kind", getattr(instance, "kind", None))
    category = attrs.get("category", getattr(instance, "category", None))
    if category and category.kind != kind:
        raise serializers.ValidationError({"category": "Category type does not match the transaction type."})
    return attrs


class TransferSerializer(serializers.ModelSerializer):
    from_wallet = OwnedPrimaryKeyField(queryset=Wallet.objects.all())
    to_wallet = OwnedPrimaryKeyField(queryset=Wallet.objects.all())
    to_amount = serializers.DecimalField(max_digits=18, decimal_places=2, required=False)

    class Meta:
        model = Transfer
        fields = ["id", "from_wallet", "to_wallet", "amount", "to_amount", "date", "note", "created_at"]

    def validate(self, attrs):
        src, dst = attrs["from_wallet"], attrs["to_wallet"]
        if src == dst:
            raise serializers.ValidationError({"to_wallet": "Choose a different wallet."})
        if src.currency == dst.currency:
            attrs["to_amount"] = attrs["amount"]
        elif not attrs.get("to_amount"):
            raise serializers.ValidationError({"to_amount": "Enter the amount received."})
        return attrs


class BudgetSerializer(serializers.ModelSerializer):
    category = OwnedPrimaryKeyField(queryset=Category.objects.filter(kind="expense"))

    class Meta:
        model = Budget
        fields = ["id", "category", "amount"]

    def validate_category(self, value):
        qs = Budget.objects.filter(user=self.context["request"].user, category=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("This category already has a budget.")
        return value


class GoalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Goal
        fields = [
            "id", "name", "icon", "color", "currency", "target_amount",
            "saved_amount", "deadline", "is_completed",
        ]


class GoalContributionSerializer(serializers.Serializer):
    # Negative values withdraw money from the goal.
    amount = serializers.DecimalField(max_digits=18, decimal_places=2)


class DebtPaymentSerializer(serializers.ModelSerializer):
    date = serializers.DateField(required=False)

    class Meta:
        model = DebtPayment
        fields = ["id", "amount", "date", "note"]


class DebtSerializer(serializers.ModelSerializer):
    paid = serializers.SerializerMethodField()
    remaining = serializers.SerializerMethodField()
    payments = DebtPaymentSerializer(many=True, read_only=True)

    class Meta:
        model = Debt
        fields = [
            "id", "person", "direction", "amount", "currency", "date", "due_date", "note",
            "is_settled", "paid", "remaining", "payments",
        ]

    def get_paid(self, obj) -> str:
        return str(obj.paid)

    def get_remaining(self, obj) -> str:
        return str(obj.remaining)

    def validate(self, attrs):
        start = attrs.get("date", getattr(self.instance, "date", None))
        due = attrs.get("due_date", getattr(self.instance, "due_date", None))
        if start and due and due < start:
            raise serializers.ValidationError({"due_date": "Due date cannot be before the debt date."})
        if self.instance and "currency" in attrs and attrs["currency"] != self.instance.currency:
            if self.instance.payments.exists():
                raise serializers.ValidationError({"currency": "Currency cannot change once payments are recorded."})
        return attrs


class RecurringSerializer(serializers.ModelSerializer):
    wallet = OwnedPrimaryKeyField(queryset=Wallet.objects.all())
    category = OwnedPrimaryKeyField(queryset=Category.objects.all())
    currency = serializers.CharField(source="wallet.currency", read_only=True)
    next_date = serializers.SerializerMethodField()
    day_of_month = serializers.IntegerField(min_value=1, max_value=31, required=False, allow_null=True)
    weekday = serializers.IntegerField(min_value=0, max_value=6, required=False, allow_null=True)

    class Meta:
        model = Recurring
        fields = [
            "id", "kind", "wallet", "category", "amount", "currency", "note", "frequency",
            "day_of_month", "weekday", "start_date", "last_run_date", "next_date", "is_active",
        ]
        read_only_fields = ["last_run_date"]

    def get_next_date(self, obj) -> date | None:
        return next_occurrence(obj, timezone.localdate())

    def validate(self, attrs):
        validate_category_kind(self.instance, attrs)
        frequency = attrs.get("frequency", getattr(self.instance, "frequency", Recurring.Frequency.MONTHLY))
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        if frequency == Recurring.Frequency.MONTHLY:
            day = attrs.get("day_of_month", getattr(self.instance, "day_of_month", None)) or (start and start.day)
            if not day:
                raise serializers.ValidationError({"day_of_month": "Choose a day of the month."})
            attrs["day_of_month"] = day
        else:
            weekday = attrs.get("weekday", getattr(self.instance, "weekday", None))
            if weekday is None:
                weekday = start.weekday() if start else None
            if weekday is None:
                raise serializers.ValidationError({"weekday": "Choose a day of the week."})
            attrs["weekday"] = weekday
        return attrs
