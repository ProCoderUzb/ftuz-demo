from django.contrib import admin

from .models import (
    Budget, Category, Debt, DebtPayment, ExchangeRate, Goal, Recurring, Transaction, Transfer, Wallet,
)


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ["date", "user", "kind", "amount", "wallet", "category", "note"]
    list_filter = ["kind", "date"]
    search_fields = ["note", "user__username"]


for model in (Wallet, Category, Transfer, Budget, Goal, ExchangeRate, Debt, DebtPayment, Recurring):
    admin.site.register(model)
