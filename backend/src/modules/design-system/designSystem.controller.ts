/**
 * ForgeStudio Features 34, 33, 32: Design System, Registry & Templates Controller
 */

import { Request, Response, NextFunction } from "express";
import { designSystemService } from "./designSystem.service.js";
import { componentRegistryService } from "./componentRegistry.service.js";
import { projectTemplateService } from "./projectTemplate.service.js";
import { getForgeProjectById } from "../../services/project/forgeProject.service.js";
import { AppError } from "../../utils/app-error.js";

function getAuthUser(res: Response, req: Request) {
  const user = res.locals.user || (req as any).user;
  if (!user) {
    throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  }
  return user;
}

function resolveProjectId(req: Request): string {
  const projectId =
    (req.params.id as string) ||
    (req.params.projectId as string) ||
    (req.query.projectId as string) ||
    (req.body?.projectId as string);

  if (!projectId || typeof projectId !== "string") {
    throw new AppError("Project ID is required", 400, "MISSING_PROJECT_ID");
  }

  return projectId;
}

export class DesignSystemPlatformController {
  // ------------------------------------------------------------
  // Feature 34: Design System Engine
  // ------------------------------------------------------------

  static async getTokens(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(res, req);
      const projectId = resolveProjectId(req);
      await getForgeProjectById(projectId, user);

      const tokens = await designSystemService.getTokens(projectId);
      res.json({ success: true, tokens, count: tokens.length });
    } catch (err) {
      next(err);
    }
  }

  static async setToken(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(res, req);
      const projectId = resolveProjectId(req);
      await getForgeProjectById(projectId, user);

      const token = await designSystemService.setToken(projectId, req.body);
      res.status(200).json({ success: true, token });
    } catch (err) {
      next(err);
    }
  }

  static async deleteToken(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(res, req);
      const projectId = resolveProjectId(req);
      await getForgeProjectById(projectId, user);

      const category = req.params.category as any;
      const name = req.params.name as string;
      const theme = (req.query.theme as string) || "default";

      const deleted = await designSystemService.deleteToken(projectId, category, name, theme);
      res.json({ success: true, deleted });
    } catch (err) {
      next(err);
    }
  }

  static async compileTokens(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(res, req);
      const projectId = resolveProjectId(req);
      await getForgeProjectById(projectId, user);

      const compiled = await designSystemService.compileTokens(projectId);
      res.json({ success: true, compiled });
    } catch (err) {
      next(err);
    }
  }

  static async applyTokens(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(res, req);
      const projectId = resolveProjectId(req);
      await getForgeProjectById(projectId, user);

      const result = await designSystemService.applyTokensToProject(projectId, user.id);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  // ------------------------------------------------------------
  // Feature 33: Component Registry
  // ------------------------------------------------------------

  static async discoverComponents(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(res, req);
      const projectId = resolveProjectId(req);
      await getForgeProjectById(projectId, user);

      const discovered = await componentRegistryService.discoverComponents(projectId);
      res.json({ success: true, components: discovered, count: discovered.length });
    } catch (err) {
      next(err);
    }
  }

  static async listComponents(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(res, req);
      const projectId = resolveProjectId(req);
      await getForgeProjectById(projectId, user);

      const query = (req.query.q as string) || (req.query.query as string);
      const tag = req.query.tag as string;

      const components = await componentRegistryService.listComponents(projectId, { query, tag });
      res.json({ success: true, components, count: components.length });
    } catch (err) {
      next(err);
    }
  }

  static async getComponent(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(res, req);
      const projectId = resolveProjectId(req);
      await getForgeProjectById(projectId, user);

      const componentId = req.params.componentId as string;
      const component = await componentRegistryService.getComponent(projectId, componentId);
      res.json({ success: true, component });
    } catch (err) {
      next(err);
    }
  }

  static async exportComponent(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(res, req);
      const projectId = resolveProjectId(req);
      await getForgeProjectById(projectId, user);

      const componentId = req.params.componentId as string;
      const exported = await componentRegistryService.exportComponent(projectId, componentId);
      res.json({ success: true, exported });
    } catch (err) {
      next(err);
    }
  }

  // ------------------------------------------------------------
  // Feature 32: Project Template Engine
  // ------------------------------------------------------------

  static async listTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const templates = await projectTemplateService.listTemplates();
      res.json({ success: true, templates, count: templates.length });
    } catch (err) {
      next(err);
    }
  }

  static async scaffoldTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(res, req);
      const projectId = resolveProjectId(req);
      await getForgeProjectById(projectId, user);

      const templateId = req.params.templateId || req.body?.templateId;
      const overwrite = Boolean(req.body?.overwrite);
      const customVariables = req.body?.customVariables;

      const result = await projectTemplateService.scaffoldTemplate(projectId, templateId, {
        userId: user.id,
        overwrite,
        customVariables,
      });

      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
}
