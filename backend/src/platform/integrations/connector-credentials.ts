import { randomUUID } from "node:crypto";
import { AppError } from "../../utils/app-error.js";
import { withTenantTransaction, requireOrganizationMembership, requireWorkspaceMembership } from "../tenancy/tenant-unit-of-work.js";
import { resolveSafeDestination } from "./safe-egress.js";

function secretReference(value:unknown){
  if(typeof value!=="string"||value.length<8||value.length>500||!/^([A-Za-z0-9._:/-]+)$/.test(value)) throw new AppError("A secret-manager reference is required",400,"INVALID_SECRET_REFERENCE");
  if(value.includes(" ")||value.includes("=")) throw new AppError("Credential values must not be stored as secret references",400,"INVALID_SECRET_REFERENCE");
  return value;
}

export async function registerConnectorCredential(input:{organizationId:string;workspaceId?:string|null;websiteId?:string|null;actorId:string;provider:string;secretRef:string;scopes?:string[];endpoint?:string|null}){
  const provider=String(input.provider||"").trim().toLowerCase();
  if(!/^[a-z0-9][a-z0-9._-]{1,79}$/.test(provider)) throw new AppError("Connector provider is invalid",400,"INVALID_PROVIDER");
  const ref=secretReference(input.secretRef);
  if(input.endpoint) await resolveSafeDestination(input.endpoint,{allowedPorts:[443]});
  return withTenantTransaction({organizationId:input.organizationId,workspaceId:input.workspaceId,actorId:input.actorId},async(client)=>{
    await requireOrganizationMembership(client,input.organizationId,input.actorId,["OWNER","ADMIN"]);
    if(input.workspaceId) await requireWorkspaceMembership(client,input.organizationId,input.workspaceId,input.actorId,["OWNER","ADMIN"]);
    if(input.websiteId){
      const website=await client.query(`SELECT id FROM websites WHERE id=$1::uuid AND "organizationId"=$2::uuid AND ($3::uuid IS NULL OR "workspaceId"=$3::uuid)`,[input.websiteId,input.organizationId,input.workspaceId||null]);
      if(!website.rows[0]) throw new AppError("Website not found or access denied",404,"NOT_FOUND");
    }
    const id=randomUUID();
    await client.query(`INSERT INTO connector_credentials (id,"organizationId","workspaceId","websiteId",provider,"secretRef",scopes,status)
      VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7::jsonb,'ACTIVE')`,
      [id,input.organizationId,input.workspaceId||null,input.websiteId||null,provider,ref,JSON.stringify(input.scopes||[])]);
    return {id,provider,status:"ACTIVE",scopes:input.scopes||[]};
  });
}

export async function revokeConnectorCredential(input:{organizationId:string;actorId:string;credentialId:string}){
  return withTenantTransaction({organizationId:input.organizationId,actorId:input.actorId},async(client)=>{
    await requireOrganizationMembership(client,input.organizationId,input.actorId,["OWNER","ADMIN"]);
    const row=await client.query(`UPDATE connector_credentials SET status='REVOKED',"revokedAt"=NOW(),version=version+1,"updatedAt"=NOW()
      WHERE id=$1::uuid AND "organizationId"=$2::uuid AND status<>'REVOKED' RETURNING id,provider,status,version`,[input.credentialId,input.organizationId]);
    if(!row.rows[0]) throw new AppError("Connector credential not found or already revoked",404,"NOT_FOUND");
    return row.rows[0];
  });
}
