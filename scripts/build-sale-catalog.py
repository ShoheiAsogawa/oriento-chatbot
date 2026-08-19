#!/usr/bin/env python3
"""Generate a compact sale-property catalog from individual knowledge files."""

from __future__ import annotations

import json
import re
from pathlib import Path


SOURCE_DIRECTORY = Path("knowledge/initial/properties/sale")
OUTPUT = Path("knowledge/initial/sale_catalog.json")
PHP_DIAGNOSTIC_RE = re.compile(
    r"^(?:PHP\s+)?(?:Warning|Notice|Deprecated|Strict Standards|Fatal error|Parse error):"
    r"\s.*(?:wp-content|\.php\b).*\bon line\s+\d+\s*$",
    re.I,
)
FIELD_LABELS = {
    "物件種別", "物件番号", "販売価格", "価格", "所在地", "交通", "土地面積",
    "建物面積", "専有面積", "販売戸数", "総戸数", "構造", "間取", "間取り",
    "用途地域", "都市計画", "地目", "建ぺい率", "容積率", "国土法届出",
    "権利", "取引態様", "現況", "販売状況", "備考1", "備考2", "備考3", "お問い合わせ",
}


def normalize_address(value: str) -> str:
    """Remove an accidentally repeated municipality prefix from an address.

    Scraped detail pages occasionally contain e.g. ``大阪市天王寺区大阪市天王寺区小橋町``.
    Do this generically by looking for the longest leading segment ending at a
    Japanese municipality boundary that is repeated immediately afterwards.
    The prefix before the municipality (usually a prefecture) is preserved.
    """
    normalized = re.sub(r"\s+", " ", value).strip()
    boundaries = [match.end() for match in re.finditer(r"[市区町村]", normalized)]
    candidates: list[tuple[int, int, str]] = []
    for start in range(len(normalized)):
        for end in boundaries:
            if end <= start:
                continue
            candidate = normalized[start:end]
            if len(candidate) < 2 or not normalized.startswith(candidate, end):
                continue
            candidates.append((len(candidate), start, candidate))
    if not candidates:
        return normalized
    _, start, candidate = max(candidates, key=lambda item: (item[0], -item[1]))
    end = start + len(candidate)
    return normalized[:start] + candidate + normalized[end + len(candidate):]


def field(text: str, *labels: str) -> str | None:
    lines = text.splitlines()
    for label in labels:
        for index, line in enumerate(lines):
            if line.strip() != label:
                continue
            for candidate in lines[index + 1:]:
                candidate = candidate.strip()
                if PHP_DIAGNOSTIC_RE.match(candidate):
                    continue
                # Long listing pages can be split into continuation chunks
                # exactly between a field label and its value. Skip only the
                # generated chunk metadata, but stop at the next real field so
                # an empty value is never borrowed from a different field.
                if not candidate or candidate.startswith("#"):
                    continue
                if candidate.startswith("公式ページ:") or candidate.startswith("更新日:"):
                    continue
                if candidate in FIELD_LABELS:
                    return None
                return candidate
    return None


def transport_lines(text: str) -> list[str]:
    match = re.search(
        r"(?ms)^交通\n(.+?)(?=\n(?:土地面積|建物面積|専有面積|販売戸数|総戸数|構造|間取|間取り|用途地域)\n)",
        text,
    )
    if not match:
        return []
    return [line.strip() for line in match.group(1).splitlines() if line.strip()]


def price_yen(value: str | None) -> int | None:
    if not value:
        return None
    ten_thousands = re.search(r"([\d,]+(?:\.\d+)?)\s*万円", value)
    if ten_thousands:
        return round(float(ten_thousands.group(1).replace(",", "")) * 10_000)
    yen = re.search(r"([\d,]+)\s*円", value)
    return int(yen.group(1).replace(",", "")) if yen else None


def main() -> None:
    source_files = sorted(SOURCE_DIRECTORY.glob("*.md"))
    if not source_files:
        raise RuntimeError(f"No individual sale knowledge files found: {SOURCE_DIRECTORY}")

    properties: list[dict[str, object]] = []
    seen_urls: set[str] = set()
    for source in source_files:
        text = source.read_text(encoding="utf-8")
        title = re.search(r"(?m)^#\s+(.+)$", text)
        url_match = re.search(r"(?m)^Source URL:\s*(https://[^\s]+)", text)
        price = price_yen(field(text, "販売価格", "価格"))
        if not title or not url_match or price is None:
            continue
        url = url_match.group(1)
        if url in seen_urls:
            continue
        seen_urls.add(url)
        transports = transport_lines(text)
        walk_times = [
            int(value)
            for line in transports
            for value in re.findall(r"徒歩\s*(\d+)分", line)
        ]
        properties.append({
            "id": field(text, "物件番号") or source.stem.replace("sale-", ""),
            "title": title.group(1).strip(),
            "url": url,
            "property_type": field(text, "物件種別") or "",
            "price_yen": price,
            "address": normalize_address(field(text, "所在地") or ""),
            "transport": transports,
            "layout": field(text, "間取", "間取り") or "",
            "walk_minutes": min(walk_times) if walk_times else None,
            "status": field(text, "現況", "販売状況") or "",
        })

    OUTPUT.write_text(
        json.dumps(
            {"version": 1, "source": SOURCE_DIRECTORY.as_posix(), "properties": properties},
            ensure_ascii=False,
            indent=2,
        ) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    print(f"Generated {len(properties)} sale properties: {OUTPUT}")


if __name__ == "__main__":
    main()
