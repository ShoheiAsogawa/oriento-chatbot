#!/usr/bin/env python3
"""Validate the generated Japanese Orient property knowledge catalog."""

from __future__ import annotations

import hashlib
import json
import re
import sys
import urllib.parse
from collections import Counter
from pathlib import Path
from typing import Any


ROOT = Path("knowledge/initial")
MANIFEST = ROOT / "manifest.json"
PROPERTY_CATEGORIES = {"properties_for_sale", "properties_for_rent"}
PROPERTY_ROUTE = re.compile(
    r"^/(?:buy|rent)(?:/[^/]+)*/post-\d+(?:-\d+)?\.html$|^/pri2/post-\d+(?:-\d+)?\.html$",
    re.I,
)
PHP_DIAGNOSTIC = re.compile(
    r"(?m)^(?:PHP\s+)?(?:Warning|Notice|Deprecated|Strict Standards|Fatal error|Parse error):"
)
CHINESE_SOURCE_MARKER = re.compile(
    r"cn\.orijyu\.com|/(?:zh|cn)(?:/|\b)|簡体中文|繁體中文|中国語版",
    re.I,
)


def official_property_url(value: str, category: str) -> bool:
    try:
        parsed = urllib.parse.urlsplit(value)
    except ValueError:
        return False
    if parsed.scheme != "https" or (parsed.hostname or "").lower() != "orijyu.com":
        return False
    if parsed.query or parsed.fragment or not PROPERTY_ROUTE.fullmatch(parsed.path):
        return False
    if category == "properties_for_rent":
        return parsed.path.startswith("/rent/")
    return parsed.path.startswith("/buy/") or parsed.path.startswith("/pri2/")


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    errors: list[str] = []
    manifest = load_json(MANIFEST)
    entries = manifest.get("files", [])
    property_entries = [entry for entry in entries if entry.get("category") in PROPERTY_CATEGORIES]
    sale_entries = [entry for entry in property_entries if entry.get("category") == "properties_for_sale"]
    rent_entries = [entry for entry in property_entries if entry.get("category") == "properties_for_rent"]

    files = [str(entry.get("file", "")) for entry in property_entries]
    urls = [str(entry.get("source_url", "")) for entry in property_entries]
    titles = [str(entry.get("title", "")).strip() for entry in property_entries]
    duplicate_files = sorted(name for name, count in Counter(files).items() if count > 1)
    duplicate_urls = sorted(url for url, count in Counter(urls).items() if count > 1)
    duplicate_title_groups = sum(1 for count in Counter(titles).values() if count > 1)
    if duplicate_files:
        errors.append(f"duplicate manifest files: {duplicate_files[:10]}")
    if duplicate_urls:
        errors.append(f"duplicate official source URLs: {duplicate_urls[:10]}")

    expected_files = {
        path.relative_to(ROOT).as_posix()
        for kind in ("sale", "rent")
        for path in (ROOT / "properties" / kind).glob("*.md")
    }
    manifest_files = set(files)
    if expected_files != manifest_files:
        errors.append(
            f"property file/manifest mismatch: missing={sorted(manifest_files - expected_files)[:10]}, "
            f"orphaned={sorted(expected_files - manifest_files)[:10]}"
        )

    for entry in property_entries:
        relative = str(entry.get("file", ""))
        category = str(entry.get("category", ""))
        source_url = str(entry.get("source_url", ""))
        if not official_property_url(source_url, category):
            errors.append(f"non-official or invalid property URL: {source_url}")
            continue
        expected_prefix = "properties/rent/" if category == "properties_for_rent" else "properties/sale/"
        if not relative.startswith(expected_prefix):
            errors.append(f"category/path mismatch: {relative} ({category})")
            continue
        path = ROOT / relative
        if not path.is_file():
            errors.append(f"missing property file: {relative}")
            continue
        raw = path.read_bytes()
        text = raw.decode("utf-8")
        if len(raw) != int(entry.get("bytes", -1)):
            errors.append(f"byte count mismatch: {relative}")
        if hashlib.sha256(raw).hexdigest() != entry.get("sha256"):
            errors.append(f"sha256 mismatch: {relative}")
        if f"Source URL: {source_url}" not in text:
            errors.append(f"source URL missing from item: {relative}")
        if PHP_DIAGNOSTIC.search(text):
            errors.append(f"PHP diagnostic leaked into item: {relative}")
        if CHINESE_SOURCE_MARKER.search(text):
            errors.append(f"Chinese source marker found: {relative}")

    declared_property_count = int(manifest.get("property_item_count", -1))
    if declared_property_count != len(property_entries):
        errors.append(
            f"property_item_count mismatch: manifest={declared_property_count}, actual={len(property_entries)}"
        )
    counts = manifest.get("category_counts", {})
    if int(counts.get("properties_for_sale", -1)) != len(sale_entries):
        errors.append("properties_for_sale category count mismatch")
    if int(counts.get("properties_for_rent", -1)) != len(rent_entries):
        errors.append("properties_for_rent category count mismatch")
    if manifest.get("failures"):
        errors.append(f"manifest contains crawl failures: {len(manifest['failures'])}")

    manifest_urls_by_category = {
        category: {entry["source_url"] for entry in property_entries if entry["category"] == category}
        for category in PROPERTY_CATEGORIES
    }
    catalog_counts: dict[str, int] = {}
    for filename, category in (
        ("sale_catalog.json", "properties_for_sale"),
        ("rental_catalog.json", "properties_for_rent"),
    ):
        properties = load_json(ROOT / filename).get("properties", [])
        catalog_urls = [str(item.get("url", "")) for item in properties]
        catalog_counts[filename] = len(properties)
        duplicates = sorted(url for url, count in Counter(catalog_urls).items() if count > 1)
        if duplicates:
            errors.append(f"duplicate URLs in {filename}: {duplicates[:10]}")
        unknown = sorted(set(catalog_urls) - manifest_urls_by_category[category])
        if unknown:
            errors.append(f"catalog URLs missing from manifest ({filename}): {unknown[:10]}")
        invalid = sorted(url for url in catalog_urls if not official_property_url(url, category))
        if invalid:
            errors.append(f"invalid catalog URLs ({filename}): {invalid[:10]}")

    summary = {
        "ok": not errors,
        "property_items": len(property_entries),
        "sale_items": len(sale_entries),
        "rent_items": len(rent_entries),
        "unique_source_urls": len(set(urls)),
        "duplicate_title_groups_with_distinct_urls": duplicate_title_groups,
        "sale_catalog_items": catalog_counts.get("sale_catalog.json", 0),
        "rental_catalog_items": catalog_counts.get("rental_catalog.json", 0),
        "property_refreshed_at": manifest.get("property_refreshed_at"),
        "errors": errors,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
