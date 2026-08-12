#!/usr/bin/env python3
"""Generate compact inventory indexes for the button-only property search flow."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


RENTAL_CATALOG = Path("knowledge/initial/rental_catalog.json")
SALE_CATALOG = Path("knowledge/initial/sale_catalog.json")
OUTPUT = Path("knowledge/initial/guided_search_options.json")

AREAS = ("大阪市", "堺市", "高槻市", "岸和田市", "茨木市", "泉佐野市")
RESIDENTIAL_RENTAL = re.compile(r"マンション|アパート|貸家|一戸建|テラスハウス")
GUIDED_LAYOUTS = {"1R", "1K", "1LDK", "2LDK", "3LDK", "4LDK"}


def load_properties(path: Path) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    return payload.get("properties", [])


def location(property_data: dict[str, Any]) -> str:
    return "\n".join(
        [
            str(property_data.get("title", "")),
            str(property_data.get("address", "")),
            *[str(line) for line in property_data.get("transport", [])],
        ]
    )


def update_min(index: dict[str, int], key: str, amount: int) -> None:
    current = index.get(key)
    if current is None or amount < current:
        index[key] = amount


def canonical_sale_type(property_type: str) -> str | None:
    if re.search(r"新築.*(?:一戸建て|戸建)", property_type):
        return "新築戸建て"
    if re.search(r"中古.*(?:一戸建て|戸建)", property_type):
        return "中古戸建て"
    if "マンション" in property_type and "新築" not in property_type:
        return "中古マンション"
    if "土地" in property_type:
        return "土地"
    return None


def guided_layout(layout: str) -> str | None:
    normalized = layout.upper().replace("ワンルーム", "1R")
    match = re.search(r"(?:1R|1K|1LDK|2LDK|3LDK|4LDK)", normalized)
    if not match or match.group(0) not in GUIDED_LAYOUTS:
        return None
    return match.group(0)


def build_rental_index(properties: list[dict[str, Any]]) -> dict[str, Any]:
    index: dict[str, Any] = {}
    for area in AREAS:
        area_properties = [
            property_data
            for property_data in properties
            if area in location(property_data)
            and RESIDENTIAL_RENTAL.search(str(property_data.get("property_type", "")))
            and str(property_data.get("url", "")).startswith("https://orijyu.com/rent/")
        ]
        if not area_properties:
            continue

        layout_minimums: dict[str, int] = {}
        for property_data in area_properties:
            rent = int(property_data["rent_yen"])
            layout = guided_layout(str(property_data.get("layout", "")))
            if layout:
                update_min(layout_minimums, layout, rent)
        index[area] = {
            "min_rent_yen": min(int(item["rent_yen"]) for item in area_properties),
            "layout_min_rent_yen": layout_minimums,
        }
    return index


def build_sale_index(properties: list[dict[str, Any]]) -> dict[str, Any]:
    index: dict[str, Any] = {}
    for area in AREAS:
        area_properties = [
            property_data
            for property_data in properties
            if area in location(property_data)
            and str(property_data.get("url", "")).startswith("https://orijyu.com/buy/")
        ]
        if not area_properties:
            continue

        type_minimums: dict[str, int] = {}
        layout_minimums: dict[str, int] = {}
        layout_minimums_by_type: dict[str, dict[str, int]] = {}
        for property_data in area_properties:
            price = int(property_data["price_yen"])
            property_type = canonical_sale_type(str(property_data.get("property_type", "")))
            layout = guided_layout(str(property_data.get("layout", "")))
            if property_type:
                update_min(type_minimums, property_type, price)
            if layout:
                update_min(layout_minimums, layout, price)
            if property_type and layout:
                update_min(layout_minimums_by_type.setdefault(property_type, {}), layout, price)

        index[area] = {
            "min_price_yen": min(int(item["price_yen"]) for item in area_properties),
            "type_min_price_yen": type_minimums,
            "layout_min_price_yen": layout_minimums,
            "layout_min_price_yen_by_type": layout_minimums_by_type,
        }
    return index


def main() -> None:
    rental = load_properties(RENTAL_CATALOG)
    sale = load_properties(SALE_CATALOG)
    payload = {
        "version": 1,
        "source": [RENTAL_CATALOG.as_posix(), SALE_CATALOG.as_posix()],
        "rental": build_rental_index(rental),
        "sale": build_sale_index(sale),
    }
    OUTPUT.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    print(f"Generated guided search options: {OUTPUT}")


if __name__ == "__main__":
    main()
