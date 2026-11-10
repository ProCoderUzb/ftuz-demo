from django.contrib.auth import password_validation
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers

from apps.finance.defaults import create_defaults_for

from .models import User


def validate_password_codes(password, user, field=None):
    """Run Django's password validators but report error codes, which the client translates."""
    try:
        password_validation.validate_password(password, user)
    except DjangoValidationError as exc:
        codes = [error.code or "invalid" for error in exc.error_list]
        raise serializers.ValidationError({field: codes} if field else codes)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "name", "language", "theme", "text_size", "simple_mode", "date_joined"]
        read_only_fields = ["id", "username", "date_joined"]


class RegisterSerializer(serializers.ModelSerializer):
    username = serializers.CharField(
        min_length=3, max_length=30, validators=[UnicodeUsernameValidator()]
    )
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    class Meta:
        model = User
        fields = ["name", "username", "password", "language"]

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("username_taken")
        return value

    def validate(self, attrs):
        candidate = User(username=attrs["username"], name=attrs["name"])
        validate_password_codes(attrs["password"], candidate, field="password")
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        create_defaults_for(user)
        return user


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate_current_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("wrong_password")
        return value

    def validate_new_password(self, value):
        validate_password_codes(value, self.context["request"].user)
        return value
