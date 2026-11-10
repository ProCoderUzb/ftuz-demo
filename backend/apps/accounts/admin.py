from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ["username", "name", "language", "date_joined", "is_staff"]
    fieldsets = BaseUserAdmin.fieldsets + (
        ("FTuz", {"fields": ("name", "language", "theme", "text_size", "simple_mode")}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (("FTuz", {"fields": ("name",)}),)
