import prisma from '../config/database.js';

export async function createAuditLog({ userId, action, entityType, entityId, oldValue, newValue, ipAddress }) {
  return prisma.auditLog.create({
    data: {
      userId,
      action,
      entityType,
      entityId,
      oldValue: oldValue ?? undefined,
      newValue: newValue ?? undefined,
      ipAddress,
    },
  });
}

export default createAuditLog;
