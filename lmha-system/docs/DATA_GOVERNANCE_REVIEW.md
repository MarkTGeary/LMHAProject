# Data Governance Review

## LMHA Case Management System

Status: **Draft — action and organisational approval required**  
Review date: 6 September 2026  
Related document: [DPIA](./DPIA.md)

## Executive conclusion

The application has a credible technical foundation for controlled internal use,
including authenticated access, validation, anonymisation and audit logging. It is
not yet governance-ready for live service-user information because several decisions
cannot be made in code: lawful bases, retention, supplier/transfer approval, ownership,
rights handling, backup recovery and incident responsibility.

Recommended gate: do not enter real service-user information until all Priority 0
items below have a named owner, evidence and written approval.

## Governance register

| Area | Current position | Required decision/evidence | Priority | Status |
|---|---|---|---|---|
| Accountability | Controller/project/DPIA owners not recorded | Name legal controller and accountable roles | P0 | Open |
| Processing inventory | Data fields and system flows mapped in the DPIA | Add system to LMHA Article 30 record of processing | P0 | Open |
| Lawful processing | Cannot be determined from source code | Approve Article 6 basis and Article 9 condition per purpose | P0 | Open |
| Transparency | Intake acknowledgements exist; full privacy notice not evidenced | Approve notice and delivery method before collection | P0 | Open |
| Retention | No approved category-specific schedule evidenced | Set periods/triggers for cases, contacts, metrics, audit logs and backups | P0 | Open |
| Individual rights | Admin anonymisation exists | Approve end-to-end access/correction/restriction/erasure workflow | P0 | Open |
| Supplier governance | Vercel, Render, Turso and Google are used | Record roles, terms, Article 28 contracts, regions, subprocessors and transfers | P0 | Open |
| Identity/access | Google allowlist; admin/worker roles | Transfer ownership, MFA, quarterly reviews, leaver SLA and location-access decision | P0 | Open |
| Backup/recovery | No tested runbook evidenced | Define RPO/RTO, automated backups and pass a restore test | P0 | Open |
| Incident response | Technical errors/logs exist | Approve breach plan, contacts, assessment/notification and exercise | P0 | Open |
| Auditability | Append-only application audit log implemented | Set retention, review cadence and escalation criteria | P1 | Partially complete |
| Data minimisation | Structured fields and bounded responses; broad free text remains | Approve field-by-field need and staff free-text guidance | P1 | Open |
| Accuracy | Staff can edit records; old bookings are restricted | Set correction/quality-review procedure | P1 | Open |
| Reporting | Aggregate metrics are sent to Sheets | Verify no identifiers, restrict sharing and set small-cell rules | P0 | Open |
| Device/physical security | Browser app designed for tablets | Require encryption, screen lock, supported OS, no shared login, clear-screen/print rules | P1 | Open |
| Training | Not evidenced | Train users before access and refresh annually | P0 | Open |
| Change management | Repository and automated tests exist | Approve release, rollback, review and DPIA change triggers | P1 | Open |
| Business continuity | Hosted services create dependencies | Approve safe downtime workflow and reconciliation process | P1 | Open |

## Recommended policies and records

The handover pack should contain or reference:

1. privacy notice for service users and relevant third parties;
2. record of processing activities;
3. retention and secure-disposal schedule;
4. subject-rights request procedure and request log;
5. personal-data breach plan and breach register;
6. staff access, joiner/mover/leaver and quarterly-review procedure;
7. acceptable-use, confidentiality and secure-tablet rules;
8. supplier register, processor agreements and international-transfer record;
9. backup, restore and business-continuity runbook;
10. audit-log review procedure;
11. change/release management and rollback procedure; and
12. staff training record.

## Proposed retention decision table

The periods below are intentionally blank. LMHA must base them on service needs,
contracts/funder rules, limitation periods, safeguarding obligations and professional
advice—not on what is technically convenient.

| Record | Retention trigger | Approved period | End-of-period action | Owner |
|---|---|---|---|---|
| Service-user identity/contact | Last meaningful service contact | **TBD** | Delete or anonymise after holds/exceptions review | **TBD** |
| Booking and case activity | Case closure/last contact | **TBD** | Anonymise or delete as approved | **TBD** |
| Intake/outcome information | Case closure/last contact | **TBD** | Delete/anonymise with linked case | **TBD** |
| Aggregate metrics | Reporting-period close | **TBD** | Retain only where non-identifying and needed | **TBD** |
| Audit events | Event date | **TBD** | Controlled deletion after security/legal hold review | **TBD** |
| Staff access records | Access removal/employment end | **TBD** | Delete after accountability period | **TBD** |
| Backups | Backup creation | **TBD** | Automatic expiry; document restoration handling for erased data | **TBD** |

## Operational control schedule

| Frequency | Control | Evidence |
|---|---|---|
| Each access change | Named approval; least privilege; remove leavers immediately | Access request/removal record |
| Monthly | Review failed logins, anonymisation and unusual audit activity | Signed audit review |
| Quarterly | Reconcile application, Google, hosting and database access | Access-review report |
| Quarterly | Restore a representative backup in a safe test environment | Restore-test record |
| Annually | Review DPIA, suppliers, retention, privacy notice and training | Approved annual review |
| After material change/breach | Reassess risks and controls before release/resumption | Change-specific DPIA/risk decision |

## Incident minimum procedure

1. Protect people and contain the incident without destroying evidence.
2. Notify the named privacy/security contacts immediately.
3. Record discovery time, systems/data/people affected and actions taken.
4. Preserve relevant application audit and provider logs with restricted access.
5. Assess likelihood and severity of risk to individuals and document the decision.
6. Where required, notify the DPC within the applicable GDPR timeframe and notify
   affected people where the legal threshold is met.
7. Recover safely, verify integrity, review root cause and track corrective actions.

**TBD:** named contacts, out-of-hours channel, decision authority, provider escalation
details, approved templates and exercise date.

## Acceptance record

| Decision | Name | Date | Signature/reference |
|---|---|---|---|
| P0 actions complete | **TBD** | **TBD** | **TBD** |
| Residual risks accepted | **TBD controller representative** | **TBD** | **TBD** |
| System authorised for live personal data | **TBD** | **TBD** | **TBD** |

