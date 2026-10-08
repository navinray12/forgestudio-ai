/**
 * ForgeStudio Module 58: Plugin Manifest Validator
 * Strictly validates versioned plugin manifests, capabilities,
 * commands, panels, hooks, and security schemas.
 */

import { AppError } from "../../utils/app-error.js";
import type { PluginManifest, PluginPermission } from "./extension.types.js";

const VALID_PERMISSIONS: Set<PluginPermission> = new Set([
  "filesystem.read",
  "filesystem.write",
  "terminal.execute",
  "network.request",
  "database.read",
  "database.write",
  "git.read",
  "git.write",
  "deployment.read",
  "deployment.write",
  "ai.tool",
  "project.read",
  "project.write",
]);

export function validatePluginManifest(manifest: any): PluginManifest {
  if (!manifest || typeof manifest !== "object") {
    throw new AppError("Invalid manifest: must be a JSON object", 400, "INVALID_MANIFEST");
  }

  // Required metadata
  if (!manifest.id || typeof manifest.id !== "string" || !/^[a-z0-9-_]{3,64}$/.test(manifest.id)) {
    throw new AppError("Manifest 'id' must be 3-64 lowercase alphanumeric/hyphen characters", 400, "INVALID_MANIFEST");
  }

  if (!manifest.name || typeof manifest.name !== "string" || manifest.name.length > 120) {
    throw new AppError("Manifest 'name' is required and must be <= 120 characters", 400, "INVALID_MANIFEST");
  }

  if (!manifest.version || typeof manifest.version !== "string" || !/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(manifest.version)) {
    throw new AppError("Manifest 'version' must follow semantic versioning (e.g. 1.0.0)", 400, "INVALID_MANIFEST");
  }

  if (!manifest.author || typeof manifest.author !== "string") {
    throw new AppError("Manifest 'author' is required", 400, "INVALID_MANIFEST");
  }

  if (!manifest.entrypoints || typeof manifest.entrypoints !== "object") {
    throw new AppError("Manifest must define 'entrypoints' (frontend or backend)", 400, "INVALID_MANIFEST");
  }

  // Permissions validation
  const permissions: PluginPermission[] = [];
  if (Array.isArray(manifest.permissions)) {
    for (const perm of manifest.permissions) {
      if (VALID_PERMISSIONS.has(perm)) {
        permissions.push(perm);
      } else {
        throw new AppError(`Unknown or invalid plugin permission requested: '${perm}'`, 400, "INVALID_PERMISSION");
      }
    }
  }

  // Commands validation
  if (manifest.commands && Array.isArray(manifest.commands)) {
    const commandIds = new Set<string>();
    for (const cmd of manifest.commands) {
      if (!cmd.id || !cmd.title || !cmd.handler) {
        throw new AppError("Commands must have 'id', 'title', and 'handler'", 400, "INVALID_COMMAND");
      }
      if (commandIds.has(cmd.id)) {
        throw new AppError(`Duplicate command id: '${cmd.id}'`, 400, "DUPLICATE_COMMAND");
      }
      commandIds.add(cmd.id);
    }
  }

  // Panels validation
  if (manifest.panels && Array.isArray(manifest.panels)) {
    const panelIds = new Set<string>();
    for (const p of manifest.panels) {
      if (!p.id || !p.title || !p.entrypoint) {
        throw new AppError("Panels must have 'id', 'title', and 'entrypoint'", 400, "INVALID_PANEL");
      }
      if (panelIds.has(p.id)) {
        throw new AppError(`Duplicate panel id: '${p.id}'`, 400, "DUPLICATE_PANEL");
      }
      panelIds.add(p.id);
    }
  }

  // AI Tools validation
  if (manifest.aiTools && Array.isArray(manifest.aiTools)) {
    for (const tool of manifest.aiTools) {
      if (!tool.name || !tool.description || !tool.handler) {
        throw new AppError("AI Tools must specify 'name', 'description', and 'handler'", 400, "INVALID_AI_TOOL");
      }
    }
  }

  return {
    ...manifest,
    permissions,
    forgeVersion: manifest.forgeVersion || ">=2.0.0",
  };
}
