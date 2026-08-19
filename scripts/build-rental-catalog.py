#!/usr/bin/env python3
"""Generate a structured rental catalog from individual property knowledge files."""

from __future__ import annotations

import json
import re
from pathlib import Path


SOURCE_DIRECTORY = Path("knowledge/initial/properties/rent")
OUTPUT = Path("knowledge/initial/rental_catalog.json")

OFFICIAL_PAGE = "\u516c\u5f0f\u30da\u30fc\u30b8"
RENT_LABELS = ("\u8cc3\u6599", "\u5bb6\u8cc3")
TRANSPORT = "\u4ea4\u901a"
TRANSPORT_END_LABELS = (
    "\u793c\u91d1", "\u6577\u91d1", "\u4fdd\u8a3c\u91d1", "\u5171\u76ca\u8cbb", "\u7ba1\u7406\u8cbb",
    "\u6c34\u9053\u4ee3", "\u5c02\u6709\u9762\u7a4d", "\u571f\u5730\u9762\u7a4d", "\u30bf\u30a4\u30d7",
    "\u9593\u53d6", "\u69cb\u9020", "\u7bc9\u5e74\u6708", "\u8cc3\u8cb8\u72b6\u6cc1", "\u53d6\u5f15\u614b\u69d8",
)
YEN = "\u5186"
WALK = "\u5f92\u6b69"
MINUTES = "\u5206"
PROPERTY_NUMBER = "\u7269\u4ef6\u756a\u53f7"
PROPERTY_TYPE = "\u7269\u4ef6\u7a2e\u5225"
COMMON_FEE_LABELS = ("\u5171\u76ca\u8cbb", "\u7ba1\u7406\u8cbb")
ADDRESS = "\u6240\u5728\u5730"
LAYOUT_LABELS = ("\u30bf\u30a4\u30d7", "\u9593\u53d6", "\u9593\u53d6\u308a")
STATUS_LABELS = ("\u8cc3\u8cb8\u72b6\u6cc1", "\u73fe\u6cc1")
PHP_DIAGNOSTIC_RE = re.compile(
    r"^(?:PHP\s+)?(?:Warning|Notice|Deprecated|Strict Standards|Fatal error|Parse error):"
    r"\s.*(?:wp-content|\.php\b).*\bon line\s+\d+\s*$",
    re.I,
)
FIELD_LABELS = {
    PROPERTY_NUMBER, PROPERTY_TYPE, *RENT_LABELS, *COMMON_FEE_LABELS, ADDRESS,
    TRANSPORT, *TRANSPORT_END_LABELS, *LAYOUT_LABELS, *STATUS_LABELS,
}


def normalize_address(value: str) -> str:
    normalized = re.sub(r"\s+", " ", value).strip()
    boundaries = [match.end() for match in re.finditer(r"[市区町村]", normalized)]
    candidates: list[tuple[int, int, str]] = []
    for start in range(len(normalized)):
        for end in boundaries:
            if end <= start:
                continue
            candidate = normalized[start:end]
            if len(candidate) >= 2 and normalized.startswith(candidate, end):
                candidates.append((len(candidate), start, candidate))
    if not candidates:
        return normalized
    _, start, candidate = max(candidates, key=lambda item: (item[0], -item[1]))
    end = start + len(candidate)
    return normalized[:start] + candidate + normalized[end + len(candidate):]


def field(section: str, *labels: str) -> str | None:
    lines = section.splitlines()
    for label in labels:
        for index, line in enumerate(lines):
            if line.strip() != label:
                continue
            for candidate in lines[index + 1:]:
                candidate = candidate.strip()
                if PHP_DIAGNOSTIC_RE.match(candidate):
                    continue
                if not candidate or candidate.startswith("#"):
                    continue
                if candidate.startswith(f"{OFFICIAL_PAGE}:") or candidate.startswith("更新日:"):
                    continue
                if candidate in FIELD_LABELS:
                    return None
                return candidate
    return None


def transport_lines(section: str) -> list[str]:
    end_labels = "|".join(re.escape(label) for label in TRANSPORT_END_LABELS)
    match = re.search(
        rf"(?ms)^{re.escape(TRANSPORT)}\n(.+?)(?=\n(?:{end_labels})\n)",
        section,
    )
    if not match:
        return []
    return [line.strip() for line in match.group(1).splitlines() if line.strip()]


def yen(value: str | None) -> int | None:
    if not value:
        return None
    match = re.search(rf"([\d,]+)\s*{re.escape(YEN)}", value)
    return int(match.group(1).replace(",", "")) if match else None


def main() -> None:
    source_files = sorted(SOURCE_DIRECTORY.glob("*.md"))
    if not source_files:
        raise RuntimeError(f"No individual rental knowledge files found: {SOURCE_DIRECTORY}")

    properties: list[dict[str, object]] = []
    seen_urls: set[str] = set()
    for source in source_files:
        text = source.read_text(encoding="utf-8")
        for section in re.split(r"(?m)^## ", text)[1:]:
            title, _, body = section.partition("\n")
            url_match = re.search(rf"(?m)^{re.escape(OFFICIAL_PAGE)}:\s*(https://[^\s]+)", body)
            rent = yen(field(body, *RENT_LABELS))
            if not url_match or rent is None or url_match.group(1) in seen_urls:
                continue
            url = url_match.group(1)
            seen_urls.add(url)
            transports = transport_lines(body)
            walk_times = [
                int(value)
                for line in transports
                for value in re.findall(rf"{re.escape(WALK)}\s*(\d+){re.escape(MINUTES)}", line)
            ]
            properties.append({
                "id": field(body, PROPERTY_NUMBER) or url.rstrip("/").rsplit("-", 1)[-1].replace(".html", ""),
                "title": re.sub("\uff08\u7d9a\u304d\\s*\\d+\uff09$", "", title).strip(),
                "url": url,
                "property_type": field(body, PROPERTY_TYPE) or "",
                "rent_yen": rent,
                "common_fee": field(body, *COMMON_FEE_LABELS) or "",
                "address": normalize_address(field(body, ADDRESS) or ""),
                "transport": transports,
                "layout": field(body, *LAYOUT_LABELS) or "",
                "walk_minutes": min(walk_times) if walk_times else None,
                "status": field(body, *STATUS_LABELS) or "",
            })

    OUTPUT.write_text(
        json.dumps({"version": 2, "source": SOURCE_DIRECTORY.as_posix(), "properties": properties}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    print(f"Generated {len(properties)} rental properties: {OUTPUT}")


if __name__ == "__main__":
    main()
