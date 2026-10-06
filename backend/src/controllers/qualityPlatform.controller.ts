/**
 * Modules 43–45: Quality, API Testing & Browser DevTools Controller
 */

import { Request, Response } from "express";
import { forgeTestRunnerService } from "../modules/quality-platform/testing/forgeTestRunner.service.js";
import { apiTestingStudioService } from "../modules/quality-platform/api-testing/apiTestingStudio.service.js";
import { browserDevToolsService } from "../modules/quality-platform/browser-devtools/browserDevTools.service.js";

export class QualityPlatformController {
  // ------------------------------------------------------------
  // MODULE 43: Automated Testing Platform
  // ------------------------------------------------------------
  public static async listTestSuites(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      let suites = await forgeTestRunnerService.listTestSuites(projectId);
      if (suites.length === 0) {
        suites = await forgeTestRunnerService.discoverTestSuites(projectId);
      }
      res.json({ suites });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async discoverTestSuites(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const suites = await forgeTestRunnerService.discoverTestSuites(projectId);
      res.json({ suites });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async runTests(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const testRun = await forgeTestRunnerService.runTests(projectId, req.body);
      res.json({ testRun });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async listTestRuns(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const limit = Number(req.query.limit || 20);
      const runs = await forgeTestRunnerService.listTestRuns(projectId, limit);
      res.json({ runs });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  // ------------------------------------------------------------
  // MODULE 44: API Testing Studio
  // ------------------------------------------------------------
  public static async listCollections(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const collections = await apiTestingStudioService.listCollections(projectId);
      res.json({ collections });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async createCollection(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const collection = await apiTestingStudioService.createCollection(
        projectId,
        req.body.name,
        req.body.description,
        req.body.variables
      );
      res.status(201).json({ collection });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async listRequests(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const collectionId = req.params.collId as string;
      const requests = await apiTestingStudioService.listRequests(projectId, collectionId);
      res.json({ requests });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async createRequest(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const collectionId = req.params.collId as string;
      const request = await apiTestingStudioService.createRequest(projectId, collectionId, req.body);
      res.status(201).json({ request });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async executeRequest(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const requestId = req.params.reqId as string;
      const result = await apiTestingStudioService.executeRequest(projectId, requestId, req.body.variables);
      res.json({ result });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async runCollection(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const collectionId = req.params.collId as string;
      const runRecord = await apiTestingStudioService.runCollection(projectId, collectionId, req.body.variables);
      res.json({ runRecord });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async importOpenApi(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const collection = await apiTestingStudioService.importFromOpenApi(projectId, req.body.spec, req.body.name);
      res.status(201).json({ collection });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  // ------------------------------------------------------------
  // MODULE 45: Browser DevTools & Runtime Inspector
  // ------------------------------------------------------------
  public static async getDevToolsState(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const state = browserDevToolsService.getRuntimeState(projectId);
      res.json({ state });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async ingestConsoleLog(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const event = browserDevToolsService.recordConsoleLog(projectId, req.body);
      res.status(201).json({ event });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async ingestNetworkTrace(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const event = browserDevToolsService.recordNetworkTrace(projectId, req.body);
      res.status(201).json({ event });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async updateDomTree(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      browserDevToolsService.updateDomTree(projectId, req.body.domTree);
      res.json({ success: true });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async updateWebVitals(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const vitals = browserDevToolsService.updateWebVitals(projectId, req.body.vitals);
      res.json({ vitals });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async updateStorage(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      browserDevToolsService.updateStorageState(projectId, req.body.storage);
      res.json({ success: true });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async captureSnapshot(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const snapshot = await browserDevToolsService.captureSnapshot(projectId, req.body.url);
      res.status(201).json({ snapshot });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async listSnapshots(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const limit = Number(req.query.limit || 20);
      const snapshots = await browserDevToolsService.listSnapshots(projectId, limit);
      res.json({ snapshots });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  public static async analyzeErrorWithAi(req: Request, res: Response): Promise<void> {
    try {
      const projectId = req.params.id as string;
      const analysis = await browserDevToolsService.analyzeRuntimeErrorWithAi(projectId, req.body.errorLogId);
      res.json({ analysis });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }
}
