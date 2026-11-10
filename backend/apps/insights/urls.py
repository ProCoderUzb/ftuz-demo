from django.urls import path

from . import views

urlpatterns = [
    path("dashboard/", views.DashboardView.as_view(), name="dashboard"),
    path("reports/monthly/", views.MonthlyReportView.as_view(), name="monthly-report"),
    path("rates/", views.RateView.as_view(), name="rates"),
]
