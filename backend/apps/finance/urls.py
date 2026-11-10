from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("wallets", views.WalletViewSet, basename="wallet")
router.register("categories", views.CategoryViewSet, basename="category")
router.register("transactions", views.TransactionViewSet, basename="transaction")
router.register("transfers", views.TransferViewSet, basename="transfer")
router.register("budgets", views.BudgetViewSet, basename="budget")
router.register("goals", views.GoalViewSet, basename="goal")
router.register("debts", views.DebtViewSet, basename="debt")
router.register("recurring", views.RecurringViewSet, basename="recurring")

urlpatterns = router.urls
