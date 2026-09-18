import { AuditRecord } from '../../domain/enterprise';
import { EnterpriseStorage } from './enterpriseStorage';

export interface IAuditService {
  record(entry: Omit<AuditRecord, 'id' | 'timestamp'>): AuditRecord;
  getAuditTrail(limit?: number): AuditRecord[];
  getAuditForTarget(targetType: string, targetId: string): AuditRecord[];
}

export const AuditService: IAuditService = {
  record: (entry) => {
    const current = EnterpriseStorage.getAuditTrail();
    const id = `AUD-${new Date().getFullYear()}-${String(current.length + 1).padStart(4, '0')}`;
    const newRecord: AuditRecord = {
      ...entry,
      id,
      timestamp: new Date().toISOString(),
    };
    EnterpriseStorage.setAuditTrail([newRecord, ...current]);
    return newRecord;
  },

  getAuditTrail: (limit = 100) => {
    return EnterpriseStorage.getAuditTrail().slice(0, limit);
  },

  getAuditForTarget: (targetType, targetId) => {
    return EnterpriseStorage.getAuditTrail().filter(
      (a) => a.targetType === targetType && a.targetId === targetId
    );
  },
};
