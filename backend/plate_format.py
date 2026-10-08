"""Indian registration-plate normalisation for OCR output."""

import re

STATE_CODES = frozenset(
    "AN AP AR AS BR CH CG DD DL DN GA GJ HR HP JK JH KA KL LA LD MP MH MN ML MZ NL OD PB PY RJ SK TN TS TR UP UK WB".split()
)

OCR_TO_DIGIT = str.maketrans({"O": "0", "Q": "0", "D": "0", "I": "1", "L": "1", "Z": "2", "S": "5", "B": "8", "G": "6", "T": "7"})
OCR_TO_LETTER = str.maketrans({"0": "O", "1": "I", "2": "Z", "5": "S", "6": "G", "8": "B"})


def _clean(raw: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", raw.upper())


def _state(raw: str, repairs: list[str]) -> str:
    if raw in STATE_CODES:
        return raw
    candidate = raw.translate(str.maketrans({"0": "O", "1": "I", "5": "S", "8": "B", "O": "D"}))
    if candidate in STATE_CODES:
        repairs.append(f"{raw}->{candidate}")
        return candidate
    return raw


def normalize_plate(raw: str) -> dict[str, object]:
    """Return a canonical Indian plate plus auditable OCR repairs."""
    value = _clean(raw)
    repairs: list[str] = []
    if not value:
        return {"plate_norm": "", "format_valid": False, "repairs": repairs}

    # Bharat series: YYBH####XX. It intentionally has no state code.
    if len(value) == 10 and value[2:4] == "BH":
        year = value[:2]
        number = value[4:8].translate(OCR_TO_DIGIT)
        series = value[8:].translate(OCR_TO_LETTER)
        candidate = f"{year}BH{number}{series}"
        valid = bool(re.fullmatch(r"\d{2}BH\d{4}[A-Z]{2}", candidate))
        if candidate != value:
            repairs.append(f"{value}->{candidate}")
        return {"plate_norm": candidate if valid else value, "format_valid": valid, "repairs": repairs}

    if len(value) < 8:
        return {"plate_norm": value, "format_valid": False, "repairs": repairs}

    state = _state(value[:2], repairs)
    district = value[2:4].translate(OCR_TO_DIGIT)
    if not re.fullmatch(r"\d{2}", district):
        return {"plate_norm": value, "format_valid": False, "repairs": repairs}
    rest = value[4:]
    for number_len in range(min(4, len(rest) - 1), 0, -1):
        series_raw, number_raw = rest[:-number_len], rest[-number_len:]
        series = series_raw.translate(OCR_TO_LETTER)
        number = number_raw.translate(OCR_TO_DIGIT)
        candidate = f"{state}{district}{series}{number}"
        if len(series) <= 3 and re.fullmatch(r"[A-Z]{1,3}", series) and re.fullmatch(r"\d{1,4}", number):
            if candidate != value:
                repairs.append(f"{value}->{candidate}")
            valid = state in STATE_CODES
            return {"plate_norm": candidate if valid else value, "format_valid": valid, "repairs": repairs}

    return {"plate_norm": value, "format_valid": False, "repairs": repairs}


if __name__ == "__main__":
    assert normalize_plate("KL 07 AB 1234")["plate_norm"] == "KL07AB1234"
    assert normalize_plate("OL08AF5030")["plate_norm"] == "DL08AF5030"
    assert normalize_plate("24 BH 1234 AA")["plate_norm"] == "24BH1234AA"
