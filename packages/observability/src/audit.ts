export interface AuditLogPayload {
  action: string;
  actorId: string;
  actorType: string;
  resourceId?: string;
  resourceType: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface IAuditService {
  log(payload: AuditLogPayload): Promise<void>;
}

export class NoOpAuditService implements IAuditService {
  public async log(payload: AuditLogPayload): Promise<void> {
    // No-op fallback implementation
  }
}
