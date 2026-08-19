import type { ConversationContextMessage } from './conversation-context';
import {
  evaluateCustomHomeConsultation,
  extractCustomHomeContact,
  type CustomHomeConsultationState,
} from './custom-home-consultation';
import type { CustomHomeLeadIntake } from './custom-home-leads';
import { redactPII } from './security';

export type CustomHomeContactTurn = {
  redacted: string;
  contact: { name?: string; phone?: string };
  expectedStep?: 'contact_name' | 'contact_phone';
};

export function customHomeIntakeFromState(state: CustomHomeConsultationState): CustomHomeLeadIntake {
  return {
    ...(state.landOwnership ? { landOwnership: state.landOwnership } : {}),
    ...(state.landLocation ? { landLocation: state.landLocation } : {}),
    ...(state.landSizeSqm != null ? { landSizeSqm: state.landSizeSqm } : {}),
    ...(state.desiredArea ? { desiredArea: state.desiredArea } : {}),
    ...(state.householdSize != null ? { householdSize: state.householdSize } : {}),
    ...(state.householdDescription ? { householdDescription: state.householdDescription } : {}),
    ...(state.layout ? { layout: state.layout } : {}),
    ...(state.budgetYen != null ? { budgetYen: state.budgetYen } : {}),
    ...(state.timing ? { timing: state.timing } : {}),
    ...(state.priorities ? { priorities: state.priorities } : {}),
  };
}

/**
 * Names are not covered by generic PII redaction. Only when the custom-home
 * flow explicitly asks for contact details do we extract them for encrypted
 * lead storage and replace the chat turn with markers before it can reach D1,
 * AI Search, an audit event, or an error log.
 */
export function redactCustomHomeContactTurn(
  history: ConversationContextMessage[],
  rawMessage: string,
): CustomHomeContactTurn {
  const priorDecision = evaluateCustomHomeConsultation(history, '');
  const expectedStep = priorDecision.active
    && (priorDecision.step === 'contact_name' || priorDecision.step === 'contact_phone')
    ? priorDecision.step
    : undefined;
  const redacted = redactPII(rawMessage);
  if (!expectedStep) return { redacted, contact: {} };

  const contact = extractCustomHomeContact(rawMessage, { expectingName: true });
  if (!contact.name && !contact.phone) return { redacted, contact: {}, expectedStep };
  const markers = [contact.name ? '[お名前]' : '', contact.phone ? '[電話番号]' : ''].filter(Boolean);
  return { redacted: markers.join(' '), contact, expectedStep };
}
