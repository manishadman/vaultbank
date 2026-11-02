import { prisma } from '../lib/prisma.js';

export async function writeAudit(db, { actorId, action, targetType, targetId, metadata }) {
  await db.auditLog.create({
    data: {
      actorId: actorId ?? null,
      action,
      targetType,
      targetId: targetId ?? null,
      metadata: metadata ?? undefined,
    },
  });
}

export async function notify(db, { userId, title, body }) {
  if (!userId) return;
  await db.notification.create({ data: { userId, title, body } });
}

export { prisma };
