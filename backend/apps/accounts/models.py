from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Language(models.TextChoices):
        UZ = "uz", "Oʻzbekcha"
        RU = "ru", "Русский"
        EN = "en", "English"

    class Theme(models.TextChoices):
        SYSTEM = "system", "System"
        LIGHT = "light", "Light"
        DARK = "dark", "Dark"

    class TextSize(models.TextChoices):
        S = "s", "Small"
        M = "m", "Medium"
        L = "l", "Large"
        XL = "xl", "Extra large"

    name = models.CharField(max_length=120)
    language = models.CharField(max_length=2, choices=Language.choices, default=Language.UZ)
    theme = models.CharField(max_length=6, choices=Theme.choices, default=Theme.SYSTEM)
    text_size = models.CharField(max_length=2, choices=TextSize.choices, default=TextSize.M)
    simple_mode = models.BooleanField(default=False)

    REQUIRED_FIELDS = ["name"]

    def __str__(self):
        return self.username
