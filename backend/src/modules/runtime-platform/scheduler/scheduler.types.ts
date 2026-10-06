/**
 * Module 48: Scheduler / Cron Engine Types
 */

export interface CronScheduleConfig {
  id: string;
  projectId: string;
  name: string;
  cronExpression: string;
  timezone: string;
  targetType: "FUNCTION" | "QUEUE_JOB" | "EVENT" | "WEBHOOK";
  targetPayload: any;
  targetDestination: string;
  isActive: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCronScheduleDto {
  name: string;
  cronExpression: string;
  timezone?: string;
  targetType: "FUNCTION" | "QUEUE_JOB" | "EVENT" | "WEBHOOK";
  targetPayload?: any;
  targetDestination: string;
}

export interface CronExecutionRecord {
  id: string;
  scheduleId: string;
  projectId: string;
  status: "SUCCESS" | "FAILED" | "MISSED";
  durationMs: number;
  output?: any;
  errorMessage?: string;
  executedAt: string;
}
