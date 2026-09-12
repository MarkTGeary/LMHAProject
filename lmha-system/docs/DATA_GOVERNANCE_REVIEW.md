# Data Governance Review

## LMHA Case Management System

Status: **Draft — action and organisational approval required**  
Review date: 12 September 2026
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
| Accountability | Limerick Mental Health Association identified; postcode V94 E6HD supplied; legal status, full address and named owners unknown | Confirm legal entity, full address and accountable roles | P0 | Partially complete |
| Processing inventory | Data fields and system flows mapped in the DPIA | Add system to LMHA Article 30 record of processing | P0 | Open |
| Lawful processing | LMHA reports relying on consent; effect of refusal/withdrawal is unknown; HSE-funded service reports metrics to HSE | Validate consent and approve Article 6 basis and Article 9 condition per purpose | P0 | Open |
| Transparency | Intake acknowledgements exist; third-party contacts are not currently informed; full privacy notice not evidenced | Approve notices and delivery method for service users and relevant third parties | P0 | Open |
| Retention | Current practice is indefinite retention | Set defensible periods/triggers for cases, contacts, metrics, audit logs, downloads and backups | P0 | Open |
| Individual rights | Admin anonymisation exists | Approve end-to-end access/correction/restriction/erasure workflow | P0 | Open |
| Supplier governance | Reported regions: Turso Ireland and hosting EU West; not contractually verified | Record roles, terms, Article 28 contracts, actual regions, subprocessors and transfers | P0 | Open |
| Identity/access | All workers need both locations and all records; same-day leaver removal intended; any worker was suggested for admin | Restrict admin to named authorised personnel; document broad worker access necessity; transfer ownership, MFA and quarterly reviews | P0 | Open |
| Backup/recovery | No backups confirmed; RPO/RTO unknown | Define RPO/RTO, enable automated backups and pass a restore test | P0 | Open |
| Incident response | Technical errors/logs exist | Approve breach plan, contacts, assessment/notification and exercise | P0 | Open |
| Auditability | Append-only application audit log implemented | Set retention, review cadence and escalation criteria | P1 | Partially complete |
| Data minimisation | Structured fields and bounded responses; broad free text remains | Approve field-by-field need and staff free-text guidance | P1 | Open |
| Accuracy | Staff can edit records; old bookings are restricted | Set correction/quality-review procedure | P1 | Open |
| Reporting | LMHA-owned Sheets receive totals; reports are downloaded rather than printed | Verify no identifiers, define authorised viewers and secure download storage/deletion | P0 | Partially complete |
| Device/physical security | Charity-owned devices may be shared; encryption and auto-lock are assumed, not verified; remote use is not expected | Verify encryption/screen lock, supported OS, individual login, remote-access and downloaded-file rules | P1 | Open |
| Training | Not evidenced | Train users before access and refresh annually | P0 | Open |
| Change management | Repository and automated tests exist | Approve release, rollback, review and DPIA change triggers | P1 | Open |
| Business continuity | Paper alternative proposed during outages | Approve secure paper handling, reconciliation, disposal and recovery process | P1 | Partially complete |

## Confirmed operational profile

- Service: mental-health conversations and crisis help across healthcare, social
  care, peer support, crisis support and community support.
- Funding/reporting: HSE funded; aggregate metrics reported to the HSE.
- Scope: Limerick only; no under-18s.
- Scale: approximately 20–60 current service users, likely hundreds of new records
  annually, and approximately 10 system users.
- Access: workers are intended to access both locations and all service-user records;
  leaver access should be removed the same day.
- Devices: charity owned and potentially shared; security configuration unverified.
- Ownership: GitHub, Vercel, Render, Turso and Google Cloud are currently controlled
  by Mark Geary using a personal email and are intended to be transferable to LMHA.
- Hosting: reported as Turso in Ireland and other hosting in EU West, pending evidence.
- Recovery: no backups confirmed; paper is the proposed outage fallback.
- Reporting: association-owned Google Sheets receive totals; reports may be downloaded.

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
