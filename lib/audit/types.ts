// ============================================================================
// Shared audit types. No 'use server' so both server actions and client
// components can import these.
// ============================================================================

/** Broad action groups the UI filters/badges by. */
export type AuditActionGroup = 'created' | 'updated' | 'deleted' | 'session' | 'user' | 'other'

export interface AuditEntry {
  id:          number
  occurredAt:  string
  actorId:     string | null
  actorEmail:  string | null
  /** raw action code: insert | update | delete | login | logout | user.create | ... */
  action:      string
  entityType:  string
  entityId:    string | null
  summary:     string | null
  before:      Record<string, unknown> | null
  after:       Record<string, unknown> | null
  source:      string
  // enriched server-side from the usuarios table:
  actorName:      string | null
  actorPhotoUrl:  string | null
}

export interface AuditFilters {
  actorId?:    string | null
  from?:       string | null    // ISO date (inclusive)
  to?:         string | null    // ISO date (inclusive)
  group?:      AuditActionGroup | null
  entityType?: string | null
  query?:      string | null
  page?:       number
  pageSize?:   number
}

export interface AuditActor {
  id:    string
  name:  string
  email: string
}

/** One category/time slice for the dashboard charts. */
export interface AuditBucket { label: string; value: number }

/** Aggregated view of the audit log for the Panel (charts) view. */
export interface AuditAnalytics {
  total:             number
  capped:            boolean   // true when the row cap was hit (total is a floor)
  created:           number
  updated:           number
  deleted:           number
  session:           number
  distinctActors:    number
  distinctContracts: number
  lastActivity:      string | null   // ISO
  timeBuckets:       AuditBucket[]
  bucketUnit:        'day' | 'month'
  byEntity:          AuditBucket[]
  byActor:           AuditBucket[]
  byContract:        AuditBucket[]
}
