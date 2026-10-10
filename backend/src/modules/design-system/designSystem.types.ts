/**
 * ForgeStudio Features 34, 33, 32: Design System, Component Registry & Project Templates
 */

export type TokenCategory =
  | "color"
  | "typography"
  | "spacing"
  | "radius"
  | "shadow"
  | "breakpoint"
  | "semantic";

export interface DesignTokenEntity {
  id: string;
  projectId: string;
  category: TokenCategory;
  name: string;
  value: any;
  resolvedValue?: any;
  theme: "default" | "light" | "dark";
  description?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComponentRegistryItem {
  id: string;
  projectId: string;
  name: string;
  filePath: string;
  version: string;
  description?: string;
  propsSchema: Record<string, any>;
  variants: Array<{ name: string; props: Record<string, any> }>;
  dependencies: string[];
  tags: string[];
  previewSnippet?: string;
  isExported: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectTemplateFile {
  path: string;
  content: string;
  isTemplate?: boolean;
}

export interface ProjectTemplateDefinition {
  templateId: string;
  name: string;
  description: string;
  framework: "react" | "nextjs" | "node" | "fullstack";
  category: string;
  version: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  files: ProjectTemplateFile[];
  defaultConfig?: Record<string, any>;
}
