/**
 * Module 51: Cache / KV Layer Types
 */

export interface KvNamespaceConfig {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  isEncrypted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KvEntryRecord {
  id: string;
  namespaceId: string;
  projectId: string;
  key: string;
  value: any;
  tags: string[];
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SetKvDto {
  key: string;
  value: any;
  ttlSeconds?: number;
  tags?: string[];
}
