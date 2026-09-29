import { randomUUID } from "crypto";
import { withTenantTransaction, requireOrganizationManagerSql } from "../../platform/tenancy/context.js";
import { AppError } from "../../utils/app-error.js";

function provider(value:unknown):string {
  if(typeof value!=="string"||!/^[a-z0-9][a-z0-9._-]{1,79}$/i.test(value)) throw new AppError("Invalid integration provider",400,"INVALID_PROVIDER");
  return value.toLowerCase();
}
function connectionKey(value:unknown):string {
  if(typeof value!=="string"||!/^[a-z0-9][a-z0-9._:-]{1,159}$/i.test(value)) throw new AppError("Invalid connection key",400,"INVALID_CONNECTION_KEY");
  return value;
}
function secretRef(value:unknown):string {
  if(typeof value!=="string"||value.length<3||value.length>500||/\s/.test(value)) throw new AppError("Invalid secret reference",400,"INVALID_SECRET_REFERENCE");
  if(!/^(aws-secretsmanager|vault|secret):/i.test(value)) throw new AppError("Secret values are not accepted; provide a secret-store reference",400,"SECRET_REFERENCE_REQUIRED");
  return value;
}
export async function upsertIntegrationSecretReference(input:{
  organizationId:string;workspaceId?:string;actorId:string;provider:unknown;connectionKey:unknown;secretRef:unknown;scopes?:unknown;
}) {
  const p=provider(input.provider), key=connectionKey(input.connectionKey), ref=secretRef(input.secretRef);
  const scopes=Array.isArray(input.scopes)?input.scopes.filter(v=>typeof v==="string").slice(0,50):[];
  return withTenantTransaction({organizationId:input.organizationId,workspaceId:input.workspaceId,actorId:input.actorId},async client=>{
    await requireOrganizationManagerSql(client,input.organizationId,input.actorId);
    if(input.workspaceId){
      const workspace=await client.query(`SELECT 1 FROM workspaces WHERE id=$1::uuid AND "organizationId"=$2::uuid`,[input.workspaceId,input.organizationId]);
      if(!workspace.rowCount) throw new AppError("Workspace not found in organization",404,"NOT_FOUND");
    }
    const result=await client.query(`INSERT INTO integration_secret_refs
      (id,"organizationId","workspaceId",provider,"connectionKey","secretRef",scopes,status)
      VALUES($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7::jsonb,'ACTIVE')
      ON CONFLICT("organizationId",provider,"connectionKey") DO UPDATE SET
        "workspaceId"=excluded."workspaceId","secretRef"=excluded."secretRef",scopes=excluded.scopes,
        status='ACTIVE',version=integration_secret_refs.version+1,"updatedAt"=now()
      RETURNING id,"organizationId","workspaceId",provider,"connectionKey","secretRef",scopes,status,version,"updatedAt"`,
      [randomUUID(),input.organizationId,input.workspaceId??null,p,key,ref,JSON.stringify(scopes)]);
    await client.query(`INSERT INTO durable_outbox("organizationId","eventType","aggregateType","aggregateId",payload)
      VALUES($1::uuid,'integration.credentials.changed','integration',$2,$3::jsonb)`,
      [input.organizationId,result.rows[0].id,JSON.stringify({provider:p,connectionKey:key})]);
    return result.rows[0];
  });
}
export async function listIntegrationSecretReferences(organizationId:string,actorId:string) {
  return withTenantTransaction({organizationId,actorId},async client=>{
    await requireOrganizationManagerSql(client,organizationId,actorId);
    const result=await client.query(`SELECT id,"workspaceId",provider,"connectionKey","secretRef",scopes,status,version,"updatedAt"
      FROM integration_secret_refs WHERE "organizationId"=$1::uuid ORDER BY provider,"connectionKey"`,[organizationId]);
    return result.rows;
  });
}
export async function revokeIntegrationSecretReference(organizationId:string,actorId:string,id:string) {
  return withTenantTransaction({organizationId,actorId},async client=>{
    await requireOrganizationManagerSql(client,organizationId,actorId);
    const result=await client.query(`UPDATE integration_secret_refs SET status='REVOKED',version=version+1,"updatedAt"=now()
      WHERE id=$1::uuid AND "organizationId"=$2::uuid RETURNING id,provider,"connectionKey",status,version`,[id,organizationId]);
    if(!result.rows[0]) throw new AppError("Secret reference not found",404,"NOT_FOUND");
    return result.rows[0];
  });
}
