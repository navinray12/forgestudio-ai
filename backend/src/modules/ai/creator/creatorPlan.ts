/**
 * ForgeStudio Module 20: AI Creator Plan & Schema Definitions
 * Defines architecture plans, route structures, component hierarchies, and API specs.
 */

export interface CreatorArchitecturePlan {
  projectName: string;
  projectType: "REACT" | "NEXTJS";
  framework: "react" | "nextjs";
  theme: {
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    fontFamily: string;
  };
  routes: Array<{
    path: string;
    name: string;
    description: string;
  }>;
  components: Array<{
    name: string;
    filePath: string;
    description: string;
    dependencies: string[];
  }>;
  apis: Array<{
    endpoint: string;
    method: "GET" | "POST" | "PUT" | "DELETE";
    description: string;
  }>;
  dependencies: Record<string, string>;
}
