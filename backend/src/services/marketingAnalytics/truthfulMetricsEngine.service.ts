export interface MetricDefinition<T = number> {
  metricId: string;
  name: string;
  grain: string;
  numeratorDescription: string;
  denominatorDescription?: string;
  value: T;
  cohortWindow?: string;
  exclusions: string[];
  calculatedAt: string;
}

export interface GrowthMetricsSummary {
  binarySessionConversionRate: MetricDefinition<number>; // Can never exceed 100%
  leadsPerSessionDensity: MetricDefinition<number>;       // Can exceed 100%
  authoritativeBusinessLeadCount: MetricDefinition<number>; // Total leads from Record 5
  cohortQualificationRate: MetricDefinition<number>;      // Matured cohort rate
}

/**
 * Computes growth metrics adhering strictly to blueprint definitions.
 */
export function calculateTruthfulGrowthMetrics(params: {
  eligibleMeasuredSessions: number;
  sessionsWithAtLeastOneLead: number;
  totalEligibleAcceptedLeads: number;
  totalAuthoritativeBusinessLeads: number;
  maturedCohortTotalLeads: number;
  maturedCohortQualifiedLeads: number;
  cohortWindow?: string;
}): GrowthMetricsSummary {
  const {
    eligibleMeasuredSessions,
    sessionsWithAtLeastOneLead,
    totalEligibleAcceptedLeads,
    totalAuthoritativeBusinessLeads,
    maturedCohortTotalLeads,
    maturedCohortQualifiedLeads,
    cohortWindow = "30d",
  } = params;

  const now = new Date().toISOString();

  // 1. Binary Conversion Rate (sessions with >= 1 lead / eligible sessions)
  const binaryRate = eligibleMeasuredSessions > 0
    ? (sessionsWithAtLeastOneLead / eligibleMeasuredSessions) * 100
    : 0;

  // 2. Leads Per Session Density (total leads / eligible sessions, can exceed 100%)
  const density = eligibleMeasuredSessions > 0
    ? (totalEligibleAcceptedLeads / eligibleMeasuredSessions) * 100
    : 0;

  // 3. Matured Cohort Qualification Rate
  const qualRate = maturedCohortTotalLeads > 0
    ? (maturedCohortQualifiedLeads / maturedCohortTotalLeads) * 100
    : 0;

  return {
    binarySessionConversionRate: {
      metricId: "metric:conversion:binary_session",
      name: "Binary Measured-Session Conversion Rate",
      grain: "Session",
      numeratorDescription: "Measured sessions with at least one eligible accepted lead",
      denominatorDescription: "Eligible measured sessions",
      value: Math.min(100, Math.round(binaryRate * 100) / 100),
      exclusions: ["Speculative prefetches", "Bots and crawlers", "Analytics-refused visits"],
      calculatedAt: now,
    },
    leadsPerSessionDensity: {
      metricId: "metric:conversion:leads_per_session_density",
      name: "Leads Per Measured Session (Density)",
      grain: "Lead / Session",
      numeratorDescription: "Total eligible accepted leads",
      denominatorDescription: "Eligible measured sessions",
      value: Math.round(density * 100) / 100,
      exclusions: ["Abandoned form keystrokes", "Bot honeypot drops"],
      calculatedAt: now,
    },
    authoritativeBusinessLeadCount: {
      metricId: "metric:leads:authoritative_count",
      name: "Total Authoritative Business Leads",
      grain: "Lead Record",
      numeratorDescription: "All accepted leads committed to Record 5 database ledgers",
      value: totalAuthoritativeBusinessLeads,
      exclusions: ["Spam submissions", "Dropped bots"],
      calculatedAt: now,
    },
    cohortQualificationRate: {
      metricId: "metric:leads:cohort_qualification_rate",
      name: "Cohort-Matured Qualification Rate",
      grain: "Matured Lead Cohort",
      numeratorDescription: "Qualified leads in mature cohort",
      denominatorDescription: "Total leads in mature cohort",
      value: Math.round(qualRate * 100) / 100,
      cohortWindow,
      exclusions: ["Unmatured active leads within SLA window"],
      calculatedAt: now,
    },
  };
}
