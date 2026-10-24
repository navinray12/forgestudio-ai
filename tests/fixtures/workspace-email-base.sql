-- Minimal legacy fixture for a newly initialized disposable PostgreSQL cluster.
CREATE TABLE users (id uuid PRIMARY KEY, email text UNIQUE, "emailVerified" boolean NOT NULL DEFAULT false, status text NOT NULL DEFAULT 'ACTIVE');
CREATE TABLE organizations (id uuid PRIMARY KEY, name varchar(255) NOT NULL, slug varchar(255) UNIQUE NOT NULL,
  "ownerId" uuid NOT NULL REFERENCES users(id), settings jsonb DEFAULT '{}', "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now());
CREATE TABLE organization_members (id uuid PRIMARY KEY, "organizationId" uuid REFERENCES organizations(id), "userId" uuid REFERENCES users(id),
  role varchar(50) DEFAULT 'MEMBER', "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(), UNIQUE("organizationId","userId"));
CREATE TABLE workspaces (id uuid PRIMARY KEY, "organizationId" uuid REFERENCES organizations(id), "ownerId" uuid REFERENCES users(id),
  name varchar(255) NOT NULL, slug varchar(255) UNIQUE NOT NULL, settings jsonb DEFAULT '{}', "isDefault" boolean DEFAULT false,
  "isArchived" boolean DEFAULT false, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now());
CREATE TABLE workspace_members (id uuid PRIMARY KEY, "workspaceId" uuid REFERENCES workspaces(id), "userId" uuid REFERENCES users(id),
  role varchar(50) DEFAULT 'MEMBER', "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(), UNIQUE("workspaceId","userId"));
CREATE TABLE websites (id uuid PRIMARY KEY, "workspaceId" uuid REFERENCES workspaces(id), "organizationId" uuid REFERENCES organizations(id), "userId" uuid REFERENCES users(id));
CREATE TABLE audit_logs (id uuid PRIMARY KEY, "userId" uuid REFERENCES users(id), action text NOT NULL, "targetResource" text NOT NULL,
  details jsonb, "ipAddress" text, "createdAt" timestamp DEFAULT now());
