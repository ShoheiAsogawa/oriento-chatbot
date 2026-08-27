const SQLITE_UTC = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.\d+)?$/u;

/**
 * D1 CURRENT_TIMESTAMP is UTC without a timezone suffix, e.g. "2026-08-27 02:48:48".
 * Browsers parse that space-separated form as local time, so Tokyo would show
 * 02:48 instead of 11:48. Treat naive datetimes as UTC, then display Japan time.
 */
export function parseStoredUtc(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const sqlite = SQLITE_UTC.exec(trimmed);
  const date = sqlite
    ? new Date(`${sqlite[1]}T${sqlite[2]}Z`)
    : new Date(trimmed);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

export function formatJapanDateTime(value: string) {
  const date = parseStoredUtc(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}
