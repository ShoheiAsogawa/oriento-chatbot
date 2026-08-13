export type SearchChunk = AiSearchSearchResponse['chunks'][number];

export interface AuditInput {
  eventType: string;
  actorType: 'visitor' | 'admin' | 'system';
  actorId?: string;
  subjectType?: string;
  subjectId?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

export interface AuditArchiveEvent extends AuditInput {
  id: string;
  ledgerId: string;
  ledgerSequence: number;
  previousHash: string;
  eventHash: string;
  createdAt: string;
}

export interface AdminIdentity {
  loginId: string;
  subject: string;
}
