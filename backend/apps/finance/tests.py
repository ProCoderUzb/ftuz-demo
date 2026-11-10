from datetime import date, timedelta
from decimal import Decimal
from io import StringIO
from unittest import mock

import requests

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.finance.models import Category, Debt, Recurring, Transaction, Wallet
from apps.finance.recurring import run_recurring


@mock.patch("apps.finance.services.requests.get", side_effect=requests.ConnectionError)
class FinanceApiTests(TestCase):
    def register(self, username):
        client = APIClient()
        resp = client.post("/api/v1/auth/register/", {
            "name": "Test User", "username": username, "password": "S3cure-pass-77", "language": "en",
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")
        return client, User.objects.get(username=username)

    def test_register_creates_defaults(self, _):
        _, user = self.register("alice")
        self.assertEqual(Wallet.objects.filter(user=user).count(), 1)
        self.assertEqual(Wallet.objects.get(user=user).name, "Cash")
        self.assertGreater(Category.objects.filter(user=user, kind="expense").count(), 5)

    def test_weak_password_returns_codes(self, _):
        resp = APIClient().post("/api/v1/auth/register/", {
            "name": "X", "username": "bob", "password": "12345678",
        }, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("password_too_common", resp.data["password"])

    def test_balance_and_report(self, _):
        client, user = self.register("carol")
        wallet = Wallet.objects.get(user=user)
        food = Category.objects.get(user=user, key="food")
        salary = Category.objects.get(user=user, key="salary")
        today = date.today().isoformat()
        for kind, cat, amount in (("income", salary, "1000000"), ("expense", food, "250000")):
            resp = client.post("/api/v1/transactions/", {
                "kind": kind, "wallet": wallet.id, "category": cat.id, "amount": amount, "date": today,
            }, format="json")
            self.assertEqual(resp.status_code, 201, resp.data)

        wallets = client.get("/api/v1/wallets/").data
        self.assertEqual(Decimal(wallets[0]["balance"]), Decimal("750000"))

        report = client.get("/api/v1/reports/monthly/").data
        self.assertEqual(Decimal(report["income"]), Decimal("1000000"))
        self.assertEqual(Decimal(report["expense"]), Decimal("250000"))

    def test_category_kind_must_match(self, _):
        client, user = self.register("dave")
        resp = client.post("/api/v1/transactions/", {
            "kind": "income", "wallet": Wallet.objects.get(user=user).id,
            "category": Category.objects.get(user=user, key="food").id,
            "amount": "10", "date": "2026-01-01",
        }, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_users_cannot_touch_each_others_data(self, _):
        client_a, _user_a = self.register("erin")
        _client_b, user_b = self.register("frank")
        foreign_wallet = Wallet.objects.get(user=user_b)
        self.assertEqual(client_a.get(f"/api/v1/wallets/{foreign_wallet.id}/").status_code, 404)
        resp = client_a.post("/api/v1/transactions/", {
            "kind": "expense", "wallet": foreign_wallet.id,
            "category": Category.objects.get(user=user_b, key="food").id,
            "amount": "10", "date": "2026-01-01",
        }, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_used_category_is_archived_not_deleted(self, _):
        client, user = self.register("gina")
        food = Category.objects.get(user=user, key="food")
        client.post("/api/v1/transactions/", {
            "kind": "expense", "wallet": Wallet.objects.get(user=user).id, "category": food.id,
            "amount": "10", "date": "2026-01-01",
        }, format="json")
        self.assertEqual(client.delete(f"/api/v1/categories/{food.id}/").status_code, 204)
        food.refresh_from_db()
        self.assertTrue(food.is_archived)

    def test_delete_account(self, _):
        client, user = self.register("hank")
        client.post("/api/v1/transactions/", {
            "kind": "expense", "wallet": Wallet.objects.get(user=user).id,
            "category": Category.objects.get(user=user, key="food").id,
            "amount": "10", "date": "2026-01-01",
        }, format="json")
        self.assertEqual(client.delete("/api/v1/auth/me/").status_code, 204)
        self.assertFalse(User.objects.filter(username="hank").exists())


@mock.patch("apps.finance.services.requests.get", side_effect=requests.ConnectionError)
class DebtApiTests(TestCase):
    register = FinanceApiTests.register

    def create_debt(self, client, **extra):
        body = {"person": "Aziz", "direction": "lent", "amount": "500000", "date": "2026-11-01", **extra}
        resp = client.post("/api/v1/debts/", body, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        return resp.data

    def test_partial_repayments_settle_the_debt(self, _):
        client, _user = self.register("ivan")
        debt = self.create_debt(client)
        resp = client.post(f"/api/v1/debts/{debt['id']}/repay/", {"amount": "200000"}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(Decimal(resp.data["remaining"]), Decimal("300000"))
        self.assertFalse(resp.data["is_settled"])

        too_much = client.post(f"/api/v1/debts/{debt['id']}/repay/", {"amount": "300001"}, format="json")
        self.assertEqual(too_much.status_code, 400)

        resp = client.post(f"/api/v1/debts/{debt['id']}/repay/", {"amount": "300000"}, format="json")
        self.assertTrue(resp.data["is_settled"])
        self.assertEqual(len(resp.data["payments"]), 2)

        # Undoing a payment reopens the debt.
        payment_id = resp.data["payments"][0]["id"]
        resp = client.delete(f"/api/v1/debts/{debt['id']}/payments/{payment_id}/")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertFalse(resp.data["is_settled"])

    def test_debts_are_private(self, _):
        client_a, _ = self.register("judy")
        client_b, _ = self.register("karl")
        debt = self.create_debt(client_b)
        self.assertEqual(client_a.get("/api/v1/debts/").data, [])
        self.assertEqual(client_a.get(f"/api/v1/debts/{debt['id']}/").status_code, 404)
        self.assertEqual(client_a.patch(f"/api/v1/debts/{debt['id']}/", {"person": "X"}, format="json").status_code, 404)
        self.assertEqual(client_a.post(f"/api/v1/debts/{debt['id']}/repay/", {"amount": "1"}, format="json").status_code, 404)
        self.assertEqual(client_a.delete(f"/api/v1/debts/{debt['id']}/").status_code, 404)
        self.assertTrue(Debt.objects.filter(pk=debt["id"], person="Aziz").exists())

    def test_due_soon_tip_and_dashboard_summary(self, _):
        client, _user = self.register("lena")
        today = timezone.localdate()
        self.create_debt(client, due_date=(today + timedelta(days=3)).isoformat(), date=today.isoformat())
        self.create_debt(client, direction="borrowed", amount="100", currency="USD", date=today.isoformat(),
                         due_date=(today + timedelta(days=30)).isoformat())
        dashboard = client.get("/api/v1/dashboard/").data
        self.assertEqual(Decimal(dashboard["debts"]["owed_to_me"]), Decimal("500000"))
        self.assertGreater(Decimal(dashboard["debts"]["i_owe"]), 0)
        report = client.get("/api/v1/reports/monthly/").data
        due = [tip for tip in report["tips"] if tip["code"] == "debt_due_lent"]
        self.assertEqual(len(due), 1)
        self.assertEqual(due[0]["params"]["due"], (today + timedelta(days=3)).isoformat())
        self.assertFalse(any(tip["code"] == "debt_due_borrowed" for tip in report["tips"]))


@mock.patch("apps.finance.services.requests.get", side_effect=requests.ConnectionError)
class RecurringTests(TestCase):
    register = FinanceApiTests.register

    def make(self, client, user, **extra):
        body = {
            "kind": "expense", "wallet": Wallet.objects.get(user=user).id,
            "category": Category.objects.get(user=user, key="utilities").id,
            "amount": "300000", "note": "Rent", "frequency": "monthly", "day_of_month": 31,
            "start_date": "2026-01-31", **extra,
        }
        resp = client.post("/api/v1/recurring/", body, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        return Recurring.objects.get(pk=resp.data["id"])

    def test_monthly_runs_are_idempotent_and_clamp_short_months(self, _):
        client, user = self.register("mike")
        rec = self.make(client, user, start_date="2099-01-31")  # future: nothing created on save
        self.assertEqual(Transaction.objects.filter(recurring=rec).count(), 0)

        self.assertEqual(run_recurring(today=date(2099, 4, 15)), 3)
        dates = sorted(Transaction.objects.filter(recurring=rec).values_list("date", flat=True))
        self.assertEqual(dates, [date(2099, 1, 31), date(2099, 2, 28), date(2099, 3, 31)])

        # Running again for the same day, or an earlier one, creates nothing new.
        self.assertEqual(run_recurring(today=date(2099, 4, 15)), 0)
        self.assertEqual(run_recurring(today=date(2099, 3, 31)), 0)
        rec.refresh_from_db()
        self.assertEqual(rec.last_run_date, date(2099, 4, 15))

        # Even if last_run_date is lost, the unique (recurring, date) constraint prevents duplicates.
        Recurring.objects.filter(pk=rec.pk).update(last_run_date=None)
        call_command("run_recurring", "--date", "2099-04-30", stdout=StringIO())
        self.assertEqual(Transaction.objects.filter(recurring=rec).count(), 4)

    def test_weekly_and_create_runs_first_occurrence(self, _):
        client, user = self.register("nina")
        today = timezone.localdate()
        rec = self.make(client, user, frequency="weekly", weekday=today.weekday(), day_of_month=None,
                        start_date=today.isoformat())
        self.assertEqual(Transaction.objects.filter(recurring=rec, date=today).count(), 1)
        self.assertEqual(run_recurring(today=today + timedelta(days=14)), 2)
        self.assertEqual(run_recurring(today=today + timedelta(days=14)), 0)

    def test_paused_schedules_do_not_run_and_resume_without_backfill(self, _):
        client, user = self.register("omar")
        today = timezone.localdate()
        rec = self.make(client, user, start_date=today.isoformat(), day_of_month=today.day)
        self.assertEqual(Transaction.objects.filter(recurring=rec).count(), 1)
        client.patch(f"/api/v1/recurring/{rec.id}/", {"is_active": False}, format="json")
        Recurring.objects.filter(pk=rec.pk).update(last_run_date=today - timedelta(days=90))
        self.assertEqual(run_recurring(today=today), 0)
        client.patch(f"/api/v1/recurring/{rec.id}/", {"is_active": True}, format="json")
        self.assertEqual(Transaction.objects.filter(recurring=rec).count(), 1)

    def test_recurring_is_private(self, _):
        client_a, user_a = self.register("pete")
        client_b, user_b = self.register("quinn")
        rec = self.make(client_b, user_b, start_date="2099-01-01")
        self.assertEqual(client_a.get("/api/v1/recurring/").data, [])
        self.assertEqual(client_a.get(f"/api/v1/recurring/{rec.id}/").status_code, 404)
        self.assertEqual(client_a.delete(f"/api/v1/recurring/{rec.id}/").status_code, 404)
        # Cannot point a schedule at someone else's wallet.
        resp = client_a.post("/api/v1/recurring/", {
            "kind": "expense", "wallet": Wallet.objects.get(user=user_b).id,
            "category": Category.objects.get(user=user_a, key="food").id,
            "amount": "10", "frequency": "monthly", "day_of_month": 1, "start_date": "2099-01-01",
        }, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("wallet", resp.data)

    def test_used_wallet_is_archived_and_user_can_be_deleted(self, _):
        client, user = self.register("rosa")
        rec = self.make(client, user, start_date="2099-01-01")
        self.assertEqual(client.delete(f"/api/v1/wallets/{rec.wallet_id}/").status_code, 204)
        self.assertTrue(Wallet.objects.get(pk=rec.wallet_id).is_archived)
        self.assertEqual(client.delete("/api/v1/auth/me/").status_code, 204)
