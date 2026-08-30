export const DEFAULT_AVOID_SELECTOR = '#click_to_call_bar, .ctc_bar, [data-orient-chat-avoid]';
export const AUTO_OFFSET_GAP = 8;

export function autoBottomOffset(measured: number, extraGap = AUTO_OFFSET_GAP): number {
  return measured > 0 ? measured + extraGap : 0;
}

export function parseOffsetBottom(value: string | null | undefined): number | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function obstacleBottomReserve(
  rect: { top: number; bottom: number; height: number; width: number },
  viewportHeight: number,
  style: { display: string; visibility: string; opacity: string; position: string },
): number {
  if (style.display === 'none' || style.visibility === 'hidden') return 0;
  if (Number.parseFloat(style.opacity || '1') === 0) return 0;
  if (style.position !== 'fixed' && style.position !== 'sticky') return 0;
  if (rect.height < 8 || rect.width < 40) return 0;
  if (viewportHeight - rect.bottom > 32) return 0;
  if (rect.top >= viewportHeight - 4) return 0;
  return Math.ceil(rect.height + Math.max(0, viewportHeight - rect.bottom));
}

export function measureAvoidedBottomOffset(
  elements: Iterable<Element>,
  viewportHeight: number,
  computedStyle: (element: Element) => CSSStyleDeclaration | { display: string; visibility: string; opacity: string; position: string },
): number {
  let reserve = 0;
  for (const element of elements) {
    if (!(element instanceof Element)) continue;
    const rect = element.getBoundingClientRect();
    reserve = Math.max(reserve, obstacleBottomReserve(rect, viewportHeight, computedStyle(element)));
  }
  return reserve;
}
