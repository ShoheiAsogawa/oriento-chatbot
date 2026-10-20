#!/usr/bin/env python3
"""Render docs/ai-chat-privacy-policy.md into the public PDF."""

from __future__ import annotations

import re
from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    ListFlowable,
    ListItem,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "ai-chat-privacy-policy.md"
OUTPUT = ROOT / "output" / "pdf" / "orient-ai-chat-privacy-policy.pdf"
JP_FONT_CANDIDATES = [
    Path("/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf"),
]
LATIN_FONT = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")

ORANGE = HexColor("#ff680b")
INK = HexColor("#29293a")
MUTED = HexColor("#74757f")
LINE = HexColor("#e8e9ee")
SOFT = HexColor("#fff6ef")


def parse_front_matter(text: str) -> tuple[dict[str, str], str]:
    if not text.startswith("---\n"):
        return {}, text
    _, rest = text.split("---\n", 1)
    raw, body = rest.split("\n---\n", 1)
    meta: dict[str, str] = {}
    for line in raw.splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        meta[key.strip()] = value.strip()
    return meta, body.lstrip("\n")


def wrap_latin(text: str) -> str:
    parts: list[str] = []
    for token in re.split(r"(<[^>]+>)", text):
        if token.startswith("<"):
            parts.append(token)
            continue
        parts.append(re.sub(
            r"[A-Za-z0-9][A-Za-z0-9:/._?=&%#@+\\-]*",
            lambda match: f'<font name="Latin">{match.group(0)}</font>',
            token,
        ))
    return "".join(parts)


def inline(text: str) -> str:
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    text = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)", r"\1（\2）", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)
    return wrap_latin(text)


def blocks(body: str) -> list[tuple[str, str]]:
    items: list[tuple[str, str]] = []
    paragraph: list[str] = []

    def flush() -> None:
        if paragraph:
            items.append(("p", " ".join(paragraph)))
            paragraph.clear()

    for raw in body.splitlines():
        line = raw.rstrip()
        if not line:
            flush()
            continue
        if line.startswith("# "):
            flush()
            items.append(("h1", line[2:].strip()))
        elif line.startswith("- "):
            flush()
            items.append(("li", line[2:].strip()))
        else:
            paragraph.append(line.strip())
    flush()
    return items


def group_lists(items: list[tuple[str, str]]) -> list[tuple[str, object]]:
    grouped: list[tuple[str, object]] = []
    bullets: list[str] = []

    def flush() -> None:
        if bullets:
            grouped.append(("ul", list(bullets)))
            bullets.clear()

    for kind, value in items:
        if kind == "li":
            bullets.append(value)
        else:
            flush()
            grouped.append((kind, value))
    flush()
    return grouped


def format_date(value: str) -> str:
    year, month, day = value.split("-")
    return f"{int(year)}年{int(month)}月{int(day)}日"


def register_font() -> None:
    jp = next((path for path in JP_FONT_CANDIDATES if path.exists()), None)
    if jp is None or not LATIN_FONT.exists():
        raise FileNotFoundError("PDF用フォント（日本語と欧文）が見つかりません。")
    pdfmetrics.registerFont(TTFont("JP", str(jp)))
    pdfmetrics.registerFont(TTFont("Latin", str(LATIN_FONT)))


def build_styles() -> dict[str, ParagraphStyle]:
    register_font()
    return {
        "kicker": ParagraphStyle(
            "kicker", fontName="Latin", fontSize=8, leading=11, textColor=ORANGE,
        ),
        "title": ParagraphStyle(
            "title", fontName="JP", fontSize=18, leading=26, textColor=INK,
        ),
        "lede": ParagraphStyle(
            "lede", fontName="JP", fontSize=9.5, leading=16, textColor=INK, alignment=TA_JUSTIFY, wordWrap="CJK",
        ),
        "h1": ParagraphStyle(
            "h1", fontName="JP", fontSize=12, leading=18, textColor=INK, spaceBefore=10, spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "body", fontName="JP", fontSize=9.2, leading=15.4, textColor=INK, alignment=TA_JUSTIFY, wordWrap="CJK",
        ),
        "bullet": ParagraphStyle(
            "bullet", fontName="JP", fontSize=9.2, leading=15.2, textColor=INK, alignment=TA_LEFT, wordWrap="CJK",
        ),
        "meta_label": ParagraphStyle(
            "meta_label", fontName="JP", fontSize=8, leading=11, textColor=MUTED,
        ),
        "meta_value": ParagraphStyle(
            "meta_value", fontName="JP", fontSize=9, leading=13, textColor=INK,
        ),
        "callout": ParagraphStyle(
            "callout", fontName="JP", fontSize=9.2, leading=15.2, textColor=INK, wordWrap="CJK",
        ),
        "footer": ParagraphStyle(
            "footer", fontName="JP", fontSize=7.5, leading=10, textColor=MUTED,
        ),
    }


def header_footer(canvas, doc) -> None:
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(INK)
    canvas.rect(0, height - 14 * mm, width, 14 * mm, fill=1, stroke=0)
    canvas.setFillColor(ORANGE)
    canvas.rect(0, height - 14 * mm, 4 * mm, 14 * mm, fill=1, stroke=0)
    canvas.setFillColor(white)
    canvas.setFont("Latin", 8)
    canvas.drawString(12 * mm, height - 8.4 * mm, "ORIENT  |  AI CHAT POLICY")
    canvas.setFont("JP", 8)
    canvas.drawRightString(width - 12 * mm, height - 8.4 * mm, "株式会社オリエントホールディングス")
    canvas.setFillColor(LINE)
    canvas.rect(0, 0, width, 10 * mm, fill=1, stroke=0)
    canvas.setFillColor(MUTED)
    canvas.setFont("JP", 7.5)
    canvas.drawString(12 * mm, 4.2 * mm, "オリにゃんに相談 ／ プライバシーポリシー・免責事項")
    canvas.setFont("Latin", 7.5)
    canvas.drawRightString(width - 12 * mm, 4.2 * mm, str(doc.page))
    canvas.restoreState()


def main() -> None:
    meta, body = parse_front_matter(SOURCE.read_text(encoding="utf-8"))
    styles = build_styles()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=20 * mm,
        bottomMargin=16 * mm,
        title=meta["title"],
        author=meta["company"],
        subject="AIチャットボットにおける個人情報の取扱いおよび免責事項",
        creator="oriento-chatbot",
    )

    story = [
        Paragraph("AI CHATBOT", styles["kicker"]),
        Spacer(1, 2 * mm),
        Paragraph(inline(meta["title"]), styles["title"]),
        Spacer(1, 2 * mm),
        Paragraph(f"対象サービス：{inline(meta['service'])}", styles["meta_value"]),
        Spacer(1, 4 * mm),
    ]

    meta_table = Table(
        [
            [
                Paragraph("事業者", styles["meta_label"]),
                Paragraph(inline(meta["company"]), styles["meta_value"]),
                Paragraph("版", styles["meta_label"]),
                Paragraph(inline(f"Version {meta['version']}"), styles["meta_value"]),
            ],
            [
                Paragraph("制定日", styles["meta_label"]),
                Paragraph(inline(format_date(meta["enacted"])), styles["meta_value"]),
                Paragraph("改定日", styles["meta_label"]),
                Paragraph(inline(format_date(meta["revised"])), styles["meta_value"]),
            ],
        ],
        colWidths=[22 * mm, 68 * mm, 18 * mm, 55 * mm],
    )
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SOFT),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("BOX", (0, 0), (-1, -1), 0.4, HexColor("#ffd2b0")),
    ]))
    story.extend([meta_table, Spacer(1, 6 * mm)])

    grouped = group_lists(blocks(body))
    callout_items: list[str] = []
    callout_started = False
    i = 0
    while i < len(grouped):
        kind, value = grouped[i]
        if kind == "p" and "ご利用前に必ずご確認ください" in str(value):
            callout_started = True
            i += 1
            continue
        if callout_started and kind == "ul":
            callout_items = [inline(item) for item in value]  # type: ignore[union-attr]
            callout_started = False
            notice = [
                Paragraph("ご利用前に必ずご確認ください", styles["h1"]),
                ListFlowable(
                    [ListItem(Paragraph(item, styles["callout"]), leftIndent=2, bulletColor=ORANGE) for item in callout_items],
                    bulletType="bullet",
                    start="•",
                    leftIndent=12,
                    bulletFontName="JP",
                    bulletFontSize=9,
                    spaceBefore=0,
                    spaceAfter=2,
                ),
            ]
            story.append(KeepTogether(notice))
            story.append(Spacer(1, 3 * mm))
            story.append(HRFlowable(width="100%", thickness=0.4, color=LINE, spaceAfter=6))
            i += 1
            continue
        if kind == "h1":
            story.append(Paragraph(inline(str(value)), styles["h1"]))
        elif kind == "p":
            story.append(Paragraph(inline(str(value)), styles["lede" if i < 3 else "body"]))
            story.append(Spacer(1, 2.2 * mm))
        elif kind == "ul":
            story.append(ListFlowable(
                [ListItem(Paragraph(inline(item), styles["bullet"]), leftIndent=2, bulletColor=ORANGE) for item in value],
                bulletType="bullet",
                start="•",
                leftIndent=12,
                bulletFontName="JP",
                bulletFontSize=9,
                spaceBefore=0,
                spaceAfter=3,
            ))
        i += 1

    story.append(Spacer(1, 6 * mm))
    story.append(HRFlowable(width="100%", thickness=0.4, color=LINE, spaceAfter=4))
    story.append(Paragraph("以上", styles["footer"]))
    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
