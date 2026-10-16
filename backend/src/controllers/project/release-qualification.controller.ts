/**
 * Project controller: Blueprint Point 44: End-to-End Application/Database Release Qualification.
 * Moved verbatim from project.controller.ts, which re-exports every handler for compatibility.
 */
import { Request, Response, NextFunction } from "express";
import { getForgeProjectById } from "../../services/project/forgeProject.service.js";
import { applicationReleaseQualificationService } from "../../services/qualification/applicationReleaseQualification.service.js";
import { getAuthUser } from "./shared.js";

// ---------------------------------------------------------------------------
// Blueprint Point 44: End-to-End Application/Database Release Qualification
// ---------------------------------------------------------------------------

export async function runReleaseQualificationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const {
      applicationSpecRevision = 1,
      applicationSpecDigest = "spec_digest_default",
      sourceCheckpointId = "chk_default",
      sourceTreeHash = "src_hash_default",
      apiContractDigest = "contract_digest_default",
      schemaVersionDigest = "schema_digest_default",
      migrationSetHash = "mig_hash_default",
      environmentBindingId = `bind_${projectId}_dev`,
      credentialReferenceVersion = 1,
      environmentClass = "DEVELOPMENT",
      syntheticMarker = "SYNTH_QUAL_TEST",
    } = req.body;

    const qualification = applicationReleaseQualificationService.runQualification({
      applicationId: `app_${projectId}`,
      projectId,
      applicationSpecRevision: Number(applicationSpecRevision),
      applicationSpecDigest,
      sourceCheckpointId,
      sourceTreeHash,
      apiContractDigest,
      schemaVersionDigest,
      migrationSetHash,
      environmentBindingId,
      credentialReferenceVersion: Number(credentialReferenceVersion),
      verifierIdentity: user.id,
      environmentClass,
      syntheticMarker,
    });

    res.status(200).json({ success: true, qualification });
  } catch (err) {
    next(err);
  }
}

export async function getReleaseQualificationRecordHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(res, req);
    const projectId = String(req.params.id);
    await getForgeProjectById(projectId, user);

    const runId = String(req.params.runId);
    const record = applicationReleaseQualificationService.getQualificationRecord(runId);
    if (!record) {
      return res.status(404).json({ success: false, error: "Qualification run record not found" });
    }

    res.status(200).json({ success: true, qualification: record });
  } catch (err) {
    next(err);
  }
}
