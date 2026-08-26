import type { ConversationContextMessage } from './conversation-context';
import {
  evaluatePropertyInquiry,
  extractPropertyInquiryContact,
  type PropertyInquiryContact,
} from './property-inquiry';
import { redactPII } from './security';

export type PropertyInquiryContactTurn = {
  redacted: string;
  contact: PropertyInquiryContact;
};

/**
 * Contact details for property inquiries are extracted only while the flow is
 * asking for them, then replaced with markers before the turn is stored.
 */
export function redactPropertyInquiryTurn(
  history: ConversationContextMessage[],
  rawMessage: string,
): PropertyInquiryContactTurn {
  const prior = evaluatePropertyInquiry(history, '');
  const expectingContact = prior.active && (
    prior.step === 'contact_name'
    || prior.step === 'contact_phone'
    || prior.step === 'contact_address'
  );
  const redacted = redactPII(rawMessage);
  if (!expectingContact) return { redacted, contact: {} };

  const contact = extractPropertyInquiryContact(history, rawMessage);
  if (!contact.name && !contact.phone && !contact.address) return { redacted, contact };
  const markers = [
    contact.name ? '[お名前]' : '',
    contact.address ? '[住所]' : '',
    contact.phone ? '[電話番号]' : '',
  ].filter(Boolean);
  return { redacted: markers.join(' '), contact };
}
