/**
 * Module 44: API Testing Studio Types
 */

export interface ApiTestAssertion {
  id: string;
  type: "STATUS_CODE" | "RESPONSE_TIME" | "HEADER_EXISTS" | "BODY_CONTAINS" | "JSON_PATH_EQUALS";
  target?: string;
  expected: any;
}

export interface ApiTestRequestConfig {
  id: string;
  collectionId: string;
  projectId: string;
  name: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  params: Record<string, string>;
  body: any;
  auth: {
    type?: "NONE" | "BEARER" | "BASIC" | "API_KEY";
    token?: string;
    username?: string;
    password?: string;
    apiKey?: string;
    headerName?: string;
  };
  assertions: ApiTestAssertion[];
  preRequestScript?: string;
  testScript?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiCollectionConfig {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  variables: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface SingleApiExecutionResult {
  requestId: string;
  name: string;
  method: string;
  url: string;
  statusCode: number;
  durationMs: number;
  sizeBytes: number;
  responseHeaders: Record<string, string>;
  responseBody: any;
  assertionResults: Array<{
    type: string;
    passed: boolean;
    expected: any;
    actual: any;
    error?: string;
  }>;
  status: "PASSED" | "FAILED";
}

export interface ApiCollectionRunRecord {
  id: string;
  collectionId: string;
  projectId: string;
  status: "PASSED" | "FAILED" | "ERROR";
  totalRequests: number;
  passedAssertions: number;
  failedAssertions: number;
  durationMs: number;
  results: SingleApiExecutionResult[];
  createdAt: string;
}
