"""Starter data every new user gets. Category names are translated on the client by `key`."""

from .models import Category, Kind, Wallet

DEFAULT_CATEGORIES = [
    # key, kind, lucide icon, color
    ("food", Kind.EXPENSE, "shopping-basket", "#F97316"),
    ("cafe", Kind.EXPENSE, "utensils", "#EC4899"),
    ("transport", Kind.EXPENSE, "bus", "#3B82F6"),
    ("utilities", Kind.EXPENSE, "zap", "#EAB308"),
    ("home", Kind.EXPENSE, "house", "#8B5CF6"),
    ("phone_internet", Kind.EXPENSE, "wifi", "#06B6D4"),
    ("health", Kind.EXPENSE, "heart-pulse", "#F43F5E"),
    ("education", Kind.EXPENSE, "graduation-cap", "#6366F1"),
    ("clothing", Kind.EXPENSE, "shirt", "#A855F7"),
    ("entertainment", Kind.EXPENSE, "film", "#0EA5E9"),
    ("family_gifts", Kind.EXPENSE, "gift", "#14B8A6"),
    ("loans", Kind.EXPENSE, "credit-card", "#64748B"),
    ("other_expense", Kind.EXPENSE, "circle-ellipsis", "#78716C"),
    ("salary", Kind.INCOME, "briefcase", "#059669"),
    ("advance", Kind.INCOME, "hand-coins", "#10B981"),
    ("business", Kind.INCOME, "store", "#0EA5E9"),
    ("freelance", Kind.INCOME, "laptop", "#6366F1"),
    ("scholarship", Kind.INCOME, "graduation-cap", "#8B5CF6"),
    ("pension", Kind.INCOME, "landmark", "#CA8A04"),
    ("gifts_income", Kind.INCOME, "gift", "#EC4899"),
    ("other_income", Kind.INCOME, "circle-ellipsis", "#78716C"),
]

CASH_WALLET_NAME = {"uz": "Naqd pul", "ru": "Наличные", "en": "Cash"}


def create_defaults_for(user):
    Category.objects.bulk_create(
        Category(user=user, key=key, kind=kind, icon=icon, color=color)
        for key, kind, icon, color in DEFAULT_CATEGORIES
    )
    Wallet.objects.create(
        user=user,
        name=CASH_WALLET_NAME.get(user.language, "Cash"),
        type=Wallet.Type.CASH,
        color="#059669",
    )
