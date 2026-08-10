#!/usr/bin/env python3
"""Generate a structured Japanese rental catalog from the scraped knowledge file."""

from __future__ import annotations

import json
import re
from pathlib import Path


SOURCE = Path("knowledge/initial/properties_for_rent.md")
OUTPUT = Path("knowledge/initial/rental_catalog.json")


def field(section: str, *labels: str) -> str | None:
    for label in labels:
        match = re.search(rf"(?m)^{re.escape(label)}\n([^\n]+)", section)
        if match:
            return match.group(1).strip()
    return None


def transport_lines(section: str) -> list[str]:
    match = re.search(
        r"(?ms)^交通\n(.+?)(?=\n(?:礼金|敷金|保証金|共益費|管理費|水道代|専有面積|土地面積|タイプ|間取|構造|築年月|賃貸状況|取引態様)\n)",
        section,
    )
    if not match:
        return []
    return [line.strip() for line in match.group(1).splitlines() if line.strip()]


def yen(value: str | None) -> int | None:
    if not value:
        return None
    match = re.search(r"([\d,]+)\s*円", value)
    return int(match.group(1).replace(",", "")) if match else None


def main() -> None:
    text = SOURCE.read_text(encoding="utf-8")
    properties: list[dict[str, object]] = []
    for section in re.split(r"(?m)^## ", text)[1:]:
        title, _, body = section.partition("\n")
        url_match = re.search(r"(?m)^公式ページ:\s*(https://[^\s]+)", body)
        rent = yen(field(body, "賃料", "家賃"))
        if not url_match or rent is None:
            continue
        transports = transport_lines(body)
        walk_times = [int(value) for line in transports for value in re.findall(r"徒歩\s*(\d+)分", line)]
        properties.append({
            "id": field(body, "物件番号") or url_match.group(1).rstrip("/").rsplit("-", 1)[-1].replace(".html", ""),
            "title": re.sub(r"（続き\s*\d+）$", "", title).strip(),
            "url": url_match.group(1),
            "property_type": field(body, "物件種別") or "",
            "rent_yen": rent,
            "common_fee": field(body, "共益費", "管理費") or "",
            "address": field(body, "所在地") or "",
            "transport": transports,
            "layout": field(body, "タイプ", "間取", "間取り") or "",
            "walk_minutes": min(walk_times) if walk_times else None,
            "status": field(body, "賃貸状況", "現況") or "",
        })
    OUTPUT.write_text(
        json.dumps({"version": 1, "source": SOURCE.name, "properties": properties}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    print(f"Generated {len(properties)} rental properties: {OUTPUT}")


if __name__ == "__main__":
    main()
