#!/usr/bin/env python3
"""Build categorized initial knowledge files from official Orient Group websites.

The crawler uses only the Python standard library, honors robots.txt sitemap
declarations, and limits crawling to the official hosts linked from orijyu.com.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable


USER_AGENT = "OrientKnowledgeBot/1.0 (+https://orijyu.com/)"
MAX_FILE_BYTES = 2_500_000
MAX_RESPONSE_BYTES = 12_000_000
REQUEST_TIMEOUT = 30
OFFICIAL_ROOTS = (
    "https://orijyu.com/",
    "https://orichin.com/",
    "https://origumi.jp/",
    "https://oriho.com/",
    "https://cn.orijyu.com/",
)
OFFICIAL_HOSTS = {urllib.parse.urlparse(url).hostname for url in OFFICIAL_ROOTS}
ASSET_SUFFIXES = {
    ".7z", ".avi", ".css", ".doc", ".docx", ".eot", ".gif", ".gz", ".ico",
    ".jpeg", ".jpg", ".js", ".json", ".map", ".mov", ".mp3", ".mp4", ".pdf",
    ".png", ".rar", ".svg", ".tar", ".tif", ".tiff", ".ttf", ".wav", ".webm",
    ".webp", ".woff", ".woff2", ".xls", ".xlsx", ".xml", ".zip",
}
BLOCK_TAGS = {
    "address", "article", "aside", "blockquote", "br", "dd", "div", "dl", "dt",
    "figcaption", "figure", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "li",
    "main", "ol", "p", "pre", "section", "table", "tbody", "tfoot", "thead", "tr", "ul",
}
SKIP_TAGS = {"canvas", "footer", "head", "header", "nav", "noscript", "script", "style", "svg", "template"}
VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
SKIP_HINTS = re.compile(
    r"(?:breadcrumb|cookie|drawer|footer|global-nav|hamburger|header|menu|modal|navigation|pagination|share|sidebar|social)",
    re.I,
)
SPACE_RE = re.compile(r"[\t\f\v ]+")
BLANK_RE = re.compile(r"\n{3,}")


@dataclass(frozen=True)
class Page:
    url: str
    title: str
    text: str
    category: str
    modified: str | None = None


class ContentParser(HTMLParser):
    def __init__(self, base_url: str):
        super().__init__(convert_charrefs=True)
        self.base_url = base_url
        self.in_body = False
        self.skip_depth = 0
        self.parts: list[str] = []
        self.links: set[str] = set()
        self.title_parts: list[str] = []
        self.in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        attributes = {key.lower(): value or "" for key, value in attrs}
        if tag == "title":
            self.in_title = True
        if tag == "body":
            self.in_body = True
        href = attributes.get("href")
        if href:
            self.links.add(urllib.parse.urljoin(self.base_url, href))
        if self.skip_depth:
            if tag not in VOID_TAGS:
                self.skip_depth += 1
            return
        hint = f"{attributes.get('id', '')} {attributes.get('class', '')}"
        if tag in SKIP_TAGS or SKIP_HINTS.search(hint):
            if tag not in VOID_TAGS:
                self.skip_depth = 1
            return
        if not self.in_body:
            return
        if tag in BLOCK_TAGS:
            self.parts.append("\n")
        elif tag in {"td", "th"}:
            self.parts.append(" | ")
        if tag == "img":
            alt = attributes.get("alt", "").strip()
            if len(alt) > 2:
                self.parts.append(f" {alt} ")

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        if self.skip_depth:
            self.skip_depth -= 1

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if self.skip_depth:
            self.skip_depth -= 1
        elif self.in_body and tag in BLOCK_TAGS:
            self.parts.append("\n")
        if tag == "body":
            self.in_body = False
        if tag == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title_parts.append(data)
        if self.in_body and not self.skip_depth:
            self.parts.append(data)


def fetch(url: str, retries: int = 2) -> tuple[str, str]:
    error: Exception | None = None
    for attempt in range(retries + 1):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xml,text/plain"})
            with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
                data = response.read(MAX_RESPONSE_BYTES + 1)
                if len(data) > MAX_RESPONSE_BYTES:
                    raise ValueError(f"response exceeds {MAX_RESPONSE_BYTES} bytes")
                charset = response.headers.get_content_charset() or "utf-8"
                try:
                    text = data.decode(charset, "replace")
                except LookupError:
                    text = data.decode("utf-8", "replace")
                return response.geturl(), text
        except (urllib.error.URLError, TimeoutError, ValueError) as exc:
            error = exc
            if attempt < retries:
                time.sleep(0.5 * (attempt + 1))
    raise RuntimeError(f"failed to fetch {url}: {error}")


def normalize_url(url: str) -> str | None:
    try:
        parsed = urllib.parse.urlsplit(url)
    except ValueError:
        return None
    host = (parsed.hostname or "").lower()
    if parsed.scheme not in {"http", "https"} or host not in OFFICIAL_HOSTS:
        return None
    if parsed.port not in {None, 80, 443}:
        return None
    path = re.sub(r"/{2,}", "/", parsed.path or "/")
    if any(path.lower().endswith(suffix) for suffix in ASSET_SUFFIXES):
        return None
    if re.search(r"/(?:feed|wp-admin|wp-json|wp-login|xmlrpc)(?:/|$)", path, re.I):
        return None
    if re.search(r"/(?:author|category|tag)/", path, re.I):
        return None
    scheme = "https"
    return urllib.parse.urlunsplit((scheme, host, path, "", ""))


def parse_sitemap(url: str, seen: set[str] | None = None) -> dict[str, str | None]:
    seen = seen or set()
    if url in seen:
        return {}
    seen.add(url)
    _, xml_text = fetch(url)
    root = ET.fromstring(xml_text)
    kind = root.tag.rsplit("}", 1)[-1]
    namespace = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    if kind == "sitemapindex":
        collected: dict[str, str | None] = {}
        for sitemap in root.findall("s:sitemap", namespace):
            location = sitemap.findtext("s:loc", default="", namespaces=namespace).strip()
            if not location or re.search(r"(?:taxonomies|users)-", location):
                continue
            collected.update(parse_sitemap(location, seen))
        return collected
    collected = {}
    for entry in root.findall("s:url", namespace):
        location = entry.findtext("s:loc", default="", namespaces=namespace).strip()
        normalized = normalize_url(location)
        if normalized:
            collected[normalized] = entry.findtext("s:lastmod", default="", namespaces=namespace).strip() or None
    return collected


def discover_from_robots(root_url: str) -> dict[str, str | None]:
    robots_url = urllib.parse.urljoin(root_url, "/robots.txt")
    try:
        _, robots = fetch(robots_url)
    except RuntimeError:
        return {}
    sitemaps = [line.split(":", 1)[1].strip() for line in robots.splitlines() if line.lower().startswith("sitemap:")]
    discovered: dict[str, str | None] = {}
    for sitemap in sitemaps:
        try:
            discovered.update(parse_sitemap(sitemap))
        except (RuntimeError, ET.ParseError):
            continue
    return discovered


def clean_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", html.unescape(value)).replace("\u200b", "")
    lines: list[str] = []
    previous = ""
    for raw in value.replace("\r", "\n").split("\n"):
        line = SPACE_RE.sub(" ", raw).strip(" |\t")
        if not line or line == previous:
            continue
        if re.fullmatch(r"[|・●▶▷>\-–—_]+", line):
            continue
        lines.append(line)
        previous = line
    return BLANK_RE.sub("\n\n", "\n".join(lines)).strip()


def parse_html(url: str, source: str) -> tuple[str, str, set[str]]:
    parser = ContentParser(url)
    parser.feed(source)
    title = clean_text(" ".join(parser.title_parts))
    title = re.sub(r"\s*[-|｜]\s*大阪・堺.*$", "", title).strip() or urllib.parse.urlparse(url).path.rsplit("/", 1)[-1] or url
    return title, clean_text("".join(parser.parts)), parser.links


def classify(url: str, title: str, text: str) -> str:
    parsed = urllib.parse.urlparse(url)
    host = parsed.hostname or ""
    path = parsed.path.lower()
    route = f"{path} {title}".lower()
    if host == "orichin.com":
        return "orichin_real_estate"
    if host == "origumi.jp":
        return "origumi_construction"
    if host == "oriho.com":
        return "oriho_homebuilding"
    if host == "cn.orijyu.com":
        return "international_chinese"
    if path.startswith("/buy/"):
        return "properties_for_sale"
    if path.startswith("/rent/"):
        return "properties_for_rent"
    if path.startswith("/land/"):
        return "land_properties"
    if re.search(r"(?:company|corporate|profile|group|greeting|policy|privacy|outline|会社概要|個人情報保護)", route):
        return "corporate_and_policies"
    if re.search(r"(?:branch|reception|contact|inquiry|shop|store|access|店舗紹介|お問合せ総合窓口)", route):
        return "stores_and_contacts"
    if re.search(r"(?:recruit|career|job|採用|求人)", route):
        return "recruitment"
    if re.search(r"(?:reform|renovation|science|structure|construction|warranty|住宅設備|家づくり|リフォーム)", route):
        return "homebuilding_and_renovation"
    if re.search(r"(?:faq|lend|sell|purchase|loan|insurance|lease|management|pri2|査定|売却|貸したい|ローン|保険|相続)", route):
        return "services_and_guides"
    if re.search(r"(?:list-|land-|recent|openhouse|inaka|wakihama|property|物件|戸建|マンション|土地)", route):
        return "property_search_guides"
    return "news_and_general"


def crawl_without_sitemap(root_url: str, max_pages: int = 250) -> dict[str, str | None]:
    root = normalize_url(root_url)
    if not root:
        return {}
    queue = deque([root])
    seen: set[str] = set()
    discovered: dict[str, str | None] = {}
    while queue and len(seen) < max_pages:
        url = queue.popleft()
        if url in seen:
            continue
        seen.add(url)
        try:
            final_url, source = fetch(url)
        except RuntimeError:
            continue
        normalized_final = normalize_url(final_url)
        if not normalized_final:
            continue
        discovered[normalized_final] = None
        _, _, links = parse_html(normalized_final, source)
        for link in sorted(links):
            normalized = normalize_url(link)
            if normalized and urllib.parse.urlparse(normalized).hostname == urllib.parse.urlparse(root).hostname and normalized not in seen:
                queue.append(normalized)
    return discovered


def fetch_page(url: str, modified: str | None) -> Page | None:
    final_url, source = fetch(url)
    normalized = normalize_url(final_url)
    if not normalized:
        return None
    title, text, _ = parse_html(normalized, source)
    if len(text) < 40:
        return None
    return Page(normalized, title, text, classify(normalized, title, text), modified)


def render_page(page: Page) -> str:
    modified = f"\n更新日: {page.modified}" if page.modified else ""
    return f"## {page.title}\nURL: {page.url}{modified}\n\n{page.text}\n"


def chunk_pages(pages: Iterable[Page]) -> list[str]:
    chunks: list[str] = []
    current: list[str] = []
    current_size = 0
    for page in pages:
        rendered = render_page(page)
        size = len(rendered.encode("utf-8"))
        if current and current_size + size > MAX_FILE_BYTES:
            chunks.append("\n".join(current))
            current = []
            current_size = 0
        current.append(rendered)
        current_size += size
    if current:
        chunks.append("\n".join(current))
    return chunks


def write_outputs(output_dir: Path, pages: list[Page], failures: list[dict[str, str]], started_at: str) -> dict[str, object]:
    output_dir.mkdir(parents=True, exist_ok=True)
    for existing in output_dir.glob("*.md"):
        existing.unlink()
    grouped: dict[str, list[Page]] = defaultdict(list)
    for page in pages:
        grouped[page.category].append(page)
    files: list[dict[str, object]] = []
    category_order = [
        "corporate_and_policies", "stores_and_contacts", "services_and_guides", "homebuilding_and_renovation",
        "property_search_guides", "properties_for_sale", "properties_for_rent", "land_properties", "recruitment",
        "orichin_real_estate", "origumi_construction", "oriho_homebuilding", "international_chinese", "news_and_general",
    ]
    for category in category_order:
        category_pages = sorted(grouped.get(category, []), key=lambda item: (item.url, item.title))
        chunks = chunk_pages(category_pages)
        for index, body in enumerate(chunks, 1):
            suffix = f"-part-{index:02d}" if len(chunks) > 1 else ""
            filename = f"{category}{suffix}.md"
            header = (
                f"# Orient Group Initial Knowledge: {category}\n\n"
                f"生成日時(UTC): {datetime.now(timezone.utc).isoformat()}\n"
                f"収録ページ数: {sum(1 for page in category_pages if render_page(page) in body)}\n"
                "出典: 各節のURLに記載されたオリエントグループ公式公開ページ\n\n"
            )
            content = header + body
            path = output_dir / filename
            path.write_text(content, encoding="utf-8", newline="\n")
            raw = content.encode("utf-8")
            files.append({
                "file": filename,
                "category": category,
                "bytes": len(raw),
                "sha256": hashlib.sha256(raw).hexdigest(),
            })
    finished_at = datetime.now(timezone.utc).isoformat()
    manifest: dict[str, object] = {
        "version": 1,
        "started_at": started_at,
        "finished_at": finished_at,
        "source_roots": list(OFFICIAL_ROOTS),
        "page_count": len(pages),
        "category_counts": {key: len(value) for key, value in sorted(grouped.items())},
        "files": files,
        "failures": failures,
    }
    (output_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="knowledge/initial", help="Output directory")
    parser.add_argument("--workers", type=int, default=6, help="Concurrent requests")
    args = parser.parse_args()
    started_at = datetime.now(timezone.utc).isoformat()
    discovered: dict[str, str | None] = {}
    for root in OFFICIAL_ROOTS:
        from_sitemap = discover_from_robots(root)
        if from_sitemap:
            discovered.update(from_sitemap)
        else:
            discovered.update(crawl_without_sitemap(root))
        normalized_root = normalize_url(root)
        if normalized_root:
            discovered.setdefault(normalized_root, None)
    print(f"Discovered {len(discovered)} official pages", flush=True)
    pages: list[Page] = []
    failures: list[dict[str, str]] = []
    with ThreadPoolExecutor(max_workers=max(1, min(args.workers, 12))) as executor:
        futures = {executor.submit(fetch_page, url, modified): url for url, modified in sorted(discovered.items())}
        completed = 0
        for future in as_completed(futures):
            url = futures[future]
            completed += 1
            try:
                page = future.result()
                if page:
                    pages.append(page)
            except Exception as exc:  # noqa: BLE001 - failures are recorded in the manifest.
                failures.append({"url": url, "error": str(exc)})
            if completed % 100 == 0 or completed == len(futures):
                print(f"Fetched {completed}/{len(futures)} pages ({len(failures)} failures)", flush=True)
    manifest = write_outputs(Path(args.output), pages, failures, started_at)
    print(json.dumps({
        "page_count": manifest["page_count"],
        "file_count": len(manifest["files"]),
        "failure_count": len(failures),
        "output": str(Path(args.output).resolve()),
    }, ensure_ascii=False), flush=True)
    return 0 if not failures else 2


if __name__ == "__main__":
    sys.exit(main())
