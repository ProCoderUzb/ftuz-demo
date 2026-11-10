import django_filters

from .models import Transaction
from .utils import month_bounds


class TransactionFilter(django_filters.FilterSet):
    month = django_filters.CharFilter(method="filter_month", help_text="YYYY-MM")
    date_from = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="date", lookup_expr="lte")

    class Meta:
        model = Transaction
        fields = ["kind", "wallet", "category"]

    def filter_month(self, queryset, name, value):
        bounds = month_bounds(value)
        if not bounds:
            return queryset.none()
        return queryset.filter(date__range=bounds)
