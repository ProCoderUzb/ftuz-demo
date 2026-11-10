from decimal import Decimal

from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.finance.models import Goal, Transaction, Wallet
from apps.finance.serializers import DebtSerializer, GoalSerializer, TransactionSerializer, WalletSerializer
from apps.finance.recurring import run_recurring
from apps.finance.services import debt_summary, get_usd_rate, to_uzs, wallet_balances
from apps.finance.utils import month_bounds

from .reports import money, monthly_summary, top_expenses, trend
from .tips import tips_for

MONTH_PARAM = OpenApiParameter("month", str, description="YYYY-MM, defaults to the current month")


def parse_month(request):
    value = request.query_params.get("month")
    if not value:
        today = timezone.localdate()
        return today.year, today.month
    bounds = month_bounds(value)
    if not bounds:
        raise ValidationError({"month": "Use the YYYY-MM format."})
    return bounds[0].year, bounds[0].month


def public(summary):
    return {k: v for k, v in summary.items() if not k.startswith("_")}


def build_summary(user, year, month, rate):
    summary = monthly_summary(user, year, month, rate)
    summary["days_in_month"] = len(summary["daily"])
    return summary


class DashboardView(APIView):
    @extend_schema(parameters=[MONTH_PARAM], responses=dict)
    def get(self, request):
        user = request.user
        year, month = parse_month(request)
        # Catch up repeating payments even where no scheduler runs `run_recurring` (idempotent).
        run_recurring(user=user)
        rate = get_usd_rate()
        balances = wallet_balances(user)
        wallets = Wallet.objects.filter(user=user, is_archived=False)
        total = sum((to_uzs(balances[w.id], w.currency, rate) for w in wallets), Decimal("0"))
        summary = build_summary(user, year, month, rate)
        recent = Transaction.objects.filter(user=user).select_related("wallet", "category")[:6]
        goals = Goal.objects.filter(user=user, is_completed=False)[:4]
        context = {"request": request, "balances": balances}
        debts = debt_summary(user, rate)
        next_due = debts["next_due"]
        return Response({
            "usd_rate": money(rate),
            "total_balance": money(total),
            "wallets": WalletSerializer(wallets, many=True, context=context).data,
            "summary": public(summary),
            "recent": TransactionSerializer(recent, many=True, context=context).data,
            "goals": GoalSerializer(goals, many=True).data,
            "debts": {
                "owed_to_me": money(debts["owed_to_me"]),
                "i_owe": money(debts["i_owe"]),
                "owed_to_me_count": debts["owed_to_me_count"],
                "i_owe_count": debts["i_owe_count"],
                "next_due": DebtSerializer(next_due).data if next_due else None,
            },
            "tips": tips_for(user, year, month, summary, limit=4),
        })


class MonthlyReportView(APIView):
    @extend_schema(parameters=[MONTH_PARAM], responses=dict)
    def get(self, request):
        user = request.user
        year, month = parse_month(request)
        rate = get_usd_rate()
        summary = build_summary(user, year, month, rate)
        return Response({
            "usd_rate": money(rate),
            **public(summary),
            "trend": trend(user, year, month, rate),
            "top_expenses": top_expenses(user, year, month, rate),
            "tips": tips_for(user, year, month, summary),
        })


class RateView(APIView):
    @extend_schema(responses=dict)
    def get(self, request):
        return Response({"USD": money(get_usd_rate()), "date": timezone.localdate().isoformat()})
