import calendar
from datetime import date


def month_bounds(value: str):
    """'2026-11' -> (date(2026, 11, 1), date(2026, 11, 30)); None if malformed."""
    try:
        year, month = (int(part) for part in value.split("-"))
        last = calendar.monthrange(year, month)[1]
        return date(year, month, 1), date(year, month, last)
    except (ValueError, TypeError, calendar.IllegalMonthError):
        return None


def shift_month(year: int, month: int, delta: int):
    index = year * 12 + (month - 1) + delta
    return index // 12, index % 12 + 1
