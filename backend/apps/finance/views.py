from datetime import timedelta

from django.db import transaction as db_transaction
from django.db.models import F
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .filters import TransactionFilter
from .models import Budget, Category, Debt, Goal, Recurring, Transaction, Transfer, Wallet
from .recurring import run_one
from .serializers import (
    BudgetSerializer,
    CategorySerializer,
    DebtPaymentSerializer,
    DebtSerializer,
    GoalContributionSerializer,
    GoalSerializer,
    RecurringSerializer,
    TransactionSerializer,
    TransferSerializer,
    WalletSerializer,
)
from .services import wallet_balances


class OwnedViewSet(viewsets.ModelViewSet):
    """Scopes every query to the requesting user and stamps new rows with them."""

    def get_queryset(self):
        return self.queryset.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ArchiveOnDeleteMixin:
    """Rows that history depends on are archived instead of deleted once used."""

    usage_relations: tuple[str, ...] = ()

    def perform_destroy(self, instance):
        if any(getattr(instance, rel).exists() for rel in self.usage_relations):
            instance.is_archived = True
            instance.save(update_fields=["is_archived"])
        else:
            instance.delete()


class WalletViewSet(ArchiveOnDeleteMixin, OwnedViewSet):
    queryset = Wallet.objects.all()
    serializer_class = WalletSerializer
    pagination_class = None
    usage_relations = ("transactions", "transfers_out", "transfers_in", "recurring")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["balances"] = wallet_balances(self.request.user)
        return context


class CategoryViewSet(ArchiveOnDeleteMixin, OwnedViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    pagination_class = None
    filterset_fields = ["kind", "is_archived"]
    usage_relations = ("transactions", "recurring")


class TransactionViewSet(OwnedViewSet):
    queryset = Transaction.objects.select_related("wallet", "category")
    serializer_class = TransactionSerializer
    filterset_class = TransactionFilter
    search_fields = ["note"]
    ordering_fields = ["date", "amount", "created_at"]


class TransferViewSet(OwnedViewSet):
    queryset = Transfer.objects.select_related("from_wallet", "to_wallet")
    serializer_class = TransferSerializer


class BudgetViewSet(OwnedViewSet):
    queryset = Budget.objects.select_related("category")
    serializer_class = BudgetSerializer
    pagination_class = None


class GoalViewSet(OwnedViewSet):
    queryset = Goal.objects.all()
    serializer_class = GoalSerializer
    pagination_class = None

    @action(detail=True, methods=["post"])
    def contribute(self, request, pk=None):
        goal = self.get_object()
        payload = GoalContributionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        amount = payload.validated_data["amount"]
        if goal.saved_amount + amount < 0:
            return Response({"amount": ["Cannot withdraw more than saved."]}, status=status.HTTP_400_BAD_REQUEST)
        with db_transaction.atomic():
            Goal.objects.filter(pk=goal.pk).update(saved_amount=F("saved_amount") + amount)
            goal.refresh_from_db()
            completed = goal.saved_amount >= goal.target_amount
            if goal.is_completed != completed:
                goal.is_completed = completed
                goal.save(update_fields=["is_completed"])
        return Response(GoalSerializer(goal).data)


class DebtViewSet(OwnedViewSet):
    queryset = Debt.objects.prefetch_related("payments")
    serializer_class = DebtSerializer
    pagination_class = None
    filterset_fields = ["direction", "is_settled"]

    @action(detail=True, methods=["post"])
    def repay(self, request, pk=None):
        """Record a partial (or full) repayment; the debt is settled once nothing remains."""
        debt = self.get_object()
        payload = DebtPaymentSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        amount = payload.validated_data["amount"]
        if amount > debt.remaining:
            return Response({"amount": ["More than what is left to pay."]}, status=status.HTTP_400_BAD_REQUEST)
        with db_transaction.atomic():
            payload.save(debt=debt, date=payload.validated_data.get("date") or timezone.localdate())
            debt = self.get_queryset().get(pk=debt.pk)
            if debt.remaining == 0 and not debt.is_settled:
                debt.is_settled = True
                debt.save(update_fields=["is_settled"])
        return Response(DebtSerializer(debt).data)

    @action(detail=True, methods=["delete"], url_path=r"payments/(?P<payment_id>\d+)")
    def remove_payment(self, request, pk=None, payment_id=None):
        debt = self.get_object()
        deleted, _ = debt.payments.filter(pk=payment_id).delete()
        if not deleted:
            return Response(status=status.HTTP_404_NOT_FOUND)
        debt = self.get_queryset().get(pk=debt.pk)
        if debt.is_settled and debt.remaining > 0:
            debt.is_settled = False
            debt.save(update_fields=["is_settled"])
        return Response(DebtSerializer(debt).data)


class RecurringViewSet(OwnedViewSet):
    queryset = Recurring.objects.select_related("wallet", "category")
    serializer_class = RecurringSerializer
    pagination_class = None

    def perform_create(self, serializer):
        # A schedule starting today (or earlier) creates its first transaction right away.
        run_one(serializer.save(user=self.request.user), timezone.localdate())

    def perform_update(self, serializer):
        today = timezone.localdate()
        was_active = serializer.instance.is_active
        rec = serializer.save()
        if rec.is_active and not was_active:
            # Resuming skips the paused period instead of back-filling it.
            yesterday = today - timedelta(days=1)
            if rec.last_run_date is None or rec.last_run_date < yesterday:
                rec.last_run_date = yesterday
                rec.save(update_fields=["last_run_date"])
        run_one(rec, today)
