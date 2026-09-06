const db = require('../db');

const ACTIONS = new Set([
  'LOGIN', 'LOGOUT', 'VIEW', 'SEARCH', 'CREATE', 'UPDATE',
  'ANONYMISE', 'EXPORT', 'ACCESS_CHANGE',
]);

const ENTITY_TYPES = new Set([
  'session', 'service_user', 'booking', 'intake_form', 'metrics',
  'limitation', 'staff_account', 'audit_log',
]);

function cleanId(value) {
  if (value === undefined || value === null || value === '') return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function cleanFields(fields) {
  if (!Array.isArray(fields)) return [];
  return [...new Set(fields)]
    .filter(field => typeof field === 'string' && /^[a-z0-9_]{1,64}$/i.test(field))
    .sort();
}

function auditStatement(req, event) {
  const action = String(event.action || '').toUpperCase();
  const entityType = String(event.entityType || '').toLowerCase();
  if (!ACTIONS.has(action)) throw new Error(`Unsupported audit action: ${action}`);
  if (!ENTITY_TYPES.has(entityType)) throw new Error(`Unsupported audit entity: ${entityType}`);

  const actor = (req.user?.email || event.actorEmail || '').trim().toLowerCase();
  if (!actor) throw new Error('Audit event requires an authenticated actor');

  return {
    sql: `INSERT INTO audit_events (
            actor_email, actor_role, action, outcome, entity_type, entity_id,
            service_user_id, location, changed_fields, request_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      actor,
      req.user?.role || event.actorRole || 'worker',
      action,
      event.outcome === 'FAILURE' ? 'FAILURE' : 'SUCCESS',
      entityType,
      cleanId(event.entityId),
      cleanId(event.serviceUserId),
      event.location || req.location || null,
      JSON.stringify(cleanFields(event.changedFields)),
      req.requestId || null,
    ],
  };
}

async function recordAudit(req, event) {
  await db.execute(auditStatement(req, event));
}

module.exports = { ACTIONS, ENTITY_TYPES, auditStatement, cleanFields, recordAudit };
