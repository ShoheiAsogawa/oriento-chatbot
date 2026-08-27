const PHONE_DASHES = /[ー－−‐‑—–]/gu;
const CONTACT_LINK_OR_URL = /(?:https?:\/\/|www\.|line\.me)/iu;

function convertInternationalPrefix(normalized: string, digits: string) {
  if (normalized.startsWith('+81') || normalized.startsWith('0081') || /^81[1-9]/u.test(digits)) {
    return `0${digits.slice(digits.startsWith('0081') ? 4 : 2)}`;
  }
  return digits;
}

/**
 * Normalize a visitor-entered phone number for lead storage.
 * Japanese +81 / 0xx forms become a 0-prefixed digit string. Other digit
 * sequences are kept as-is so staff can still call back unusual formats.
 */
export function normalizePhoneNumber(value: string, options: { lenient?: boolean } = {}) {
  const normalized = value.normalize('NFKC').trim().replace(PHONE_DASHES, '-');
  if (!normalized || CONTACT_LINK_OR_URL.test(normalized)) return undefined;
  const digits = normalized.replace(/\D/gu, '');
  if (!digits) return undefined;
  const japanese = convertInternationalPrefix(normalized, digits);
  if (japanese.length >= 8 && japanese.length <= 15) return japanese;
  if (digits.length >= 8 && digits.length <= 15) return digits;
  if (options.lenient && digits.length >= 3 && digits.length <= 20) return digits;
  return undefined;
}
