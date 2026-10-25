import { AppError } from "../../../utils/app-error.js";
import { canUserAccessResource } from "../../permission.service.js";
import { cancelJob, enqueueJob, getJobById, listJobs, processNextJob, retryJob } from "../../jobs/jobRunner.js";
import { getConnectionByWebsiteId } from "./connection.js";

// Background publish jobs: create, status, list, cancel, retry.
// Moved verbatim from connector.service.ts (now a compatibility entry point that re-exports the public API).

/**
 * F-498: Create an asynchronous WordPress publishing job with concurrency guard.
 */
export async function createWordPressPublishJob(
  websiteId: string,
  forgePageId: string,
  userId: string,
  options: {
    targetWpPostId?: number;
    slug?: string;
    status?: string;
    title?: string;
    format?: string;
    mode?: string;
  } = {}
) {
  // 1. Check capability
  const canPublish = await canUserAccessResource(userId, websiteId, "*", "PUBLISH");
  if (!canPublish) {
    throw new AppError("Forbidden: Insufficient permissions to manage publish jobs.", 403, "FORBIDDEN");
  }

  // 2. Check WordPress Connection
  const connection = await getConnectionByWebsiteId(websiteId);
  if (!connection || connection.status !== "CONNECTED") {
    throw new AppError(
      "WordPress connection is not active or verified",
      400,
      "WORDPRESS_NOT_CONNECTED"
    );
  }

  // 3. Concurrency / Idempotency Check: Guard against duplicate QUEUED/RUNNING jobs for same site & page
  const existingJobs = await listJobs({ type: "WORDPRESS_PUBLISH", limit: 50 });
  const activeJob = existingJobs.find(
    (j: any) =>
      j.payload?.websiteId === websiteId &&
      j.payload?.pageId === forgePageId &&
      (j.status === "QUEUED" || j.status === "RUNNING")
  );

  if (activeJob) {
    return {
      success: true,
      alreadyQueued: true,
      job: activeJob,
      message: "A publish job for this page is already active.",
    };
  }

  // 4. Enqueue Job
  const payload = {
    websiteId,
    pageId: forgePageId,
    userId,
    targetWpPostId: options.targetWpPostId,
    slug: options.slug,
    status: options.status,
    title: options.title,
    createdAt: new Date().toISOString(),
  };

  const job = await enqueueJob("WORDPRESS_PUBLISH", payload, { maxAttempts: 3 });

  // Trigger immediate async processing tick
  processNextJob({ id: job.id }).catch(() => {});

  return {
    success: true,
    alreadyQueued: false,
    job,
    message: "WordPress publishing job queued successfully.",
  };
}

/**
 * F-498: Get detailed status and step progress of a WordPress publishing job.
 */
export async function getWordPressPublishJobStatus(
  websiteId: string,
  jobId: string,
  userId: string
) {
  const canPublish = await canUserAccessResource(userId, websiteId, "*", "PUBLISH");
  if (!canPublish) {
    throw new AppError("Forbidden: Insufficient permissions to view job status.", 403, "FORBIDDEN");
  }

  const job = await getJobById(jobId);
  if (!job) {
    throw new AppError(`Publishing job ${jobId} not found`, 404, "JOB_NOT_FOUND");
  }

  if (job.payload?.websiteId !== websiteId) {
    throw new AppError("Access denied to job for specified website", 403, "FORBIDDEN");
  }

  let step = "QUEUED";
  let progressPercent = 10;
  if (job.status === "RUNNING") {
    step = "EXECUTING_PUBLISH_PIPELINE";
    progressPercent = 50;
  } else if (job.status === "COMPLETED") {
    step = "PUBLISHED_VERIFIED";
    progressPercent = 100;
  } else if (job.status === "FAILED") {
    step = "FAILED";
    progressPercent = 0;
  } else if (job.status === "CANCELLED") {
    step = "CANCELLED";
    progressPercent = 0;
  }

  return {
    success: true,
    job: {
      id: job.id,
      type: job.type,
      status: job.status,
      step,
      progressPercent,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      lastError: job.lastError,
      payload: job.payload,
      runAt: job.runAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    },
  };
}

/**
 * F-498: List all WordPress publishing jobs for a website and optional page.
 */
export async function listWordPressPublishJobs(
  websiteId: string,
  userId: string,
  filters: { pageId?: string; status?: string; limit?: number } = {}
) {
  const canPublish = await canUserAccessResource(userId, websiteId, "*", "PUBLISH");
  if (!canPublish) {
    throw new AppError("Forbidden: Insufficient permissions to list publish jobs.", 403, "FORBIDDEN");
  }

  const allJobs = await listJobs({ type: "WORDPRESS_PUBLISH", limit: filters.limit || 50 });

  const siteJobs = allJobs.filter((j: any) => {
    if (j.payload?.websiteId !== websiteId) return false;
    if (filters.pageId && j.payload?.pageId !== filters.pageId) return false;
    if (filters.status && j.status !== filters.status) return false;
    return true;
  });

  return {
    success: true,
    jobs: siteJobs,
    total: siteJobs.length,
  };
}

/**
 * F-498: Cancel an active or queued WordPress publishing job.
 */
export async function cancelWordPressPublishJob(
  websiteId: string,
  jobId: string,
  userId: string,
  reason?: string
) {
  const canPublish = await canUserAccessResource(userId, websiteId, "*", "PUBLISH");
  if (!canPublish) {
    throw new AppError("Forbidden: Insufficient permissions to cancel publish jobs.", 403, "FORBIDDEN");
  }

  const job = await getJobById(jobId);
  if (!job) {
    throw new AppError(`Job ${jobId} not found`, 404, "JOB_NOT_FOUND");
  }

  if (job.payload?.websiteId !== websiteId) {
    throw new AppError("Access denied to job for specified website", 403, "FORBIDDEN");
  }

  const cancelResult = await cancelJob(jobId, reason);
  return {
    success: true,
    alreadyCancelled: cancelResult.alreadyCancelled || false,
    job: cancelResult.job,
    message: "Publishing job cancelled successfully",
  };
}

/**
 * F-498: Retry a failed or cancelled WordPress publishing job.
 */
export async function retryWordPressPublishJob(
  websiteId: string,
  jobId: string,
  userId: string
) {
  const canPublish = await canUserAccessResource(userId, websiteId, "*", "PUBLISH");
  if (!canPublish) {
    throw new AppError("Forbidden: Insufficient permissions to retry publish jobs.", 403, "FORBIDDEN");
  }

  const job = await getJobById(jobId);
  if (!job) {
    throw new AppError(`Job ${jobId} not found`, 404, "JOB_NOT_FOUND");
  }

  if (job.payload?.websiteId !== websiteId) {
    throw new AppError("Access denied to job for specified website", 403, "FORBIDDEN");
  }

  const retried = await retryJob(jobId);
  processNextJob({ id: jobId }).catch(() => {});

  return {
    success: true,
    job: retried,
    message: "Publishing job requeued for retry",
  };
}
