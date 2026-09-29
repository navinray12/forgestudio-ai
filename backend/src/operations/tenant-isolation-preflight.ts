import { pgPool } from "../config/prisma.js";

const forcedTables=[
  "organization_billing_accounts","organization_subscriptions_v2","organization_seat_assignments",
  "billing_checkout_intents","organization_invoices","usage_reservations","file_objects","connector_credentials",
  "platform_outbox","platform_jobs","platform_dead_letters","workspace_command_journal","workspace_outbox",
] as const;

const legacyTenantRoots=["workspaces","websites","media_assets"] as const;

export async function tenantIsolationPreflight(){
  const [role,conflicts,nullRoots,rls]=await Promise.all([
    pgPool.query<{rolname:string;rolsuper:boolean;rolbypassrls:boolean}>(`SELECT rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user`),
    pgPool.query<{resourceType:string;count:number}>(`SELECT "resourceType",count(*)::int AS count FROM tenant_backfill_conflicts GROUP BY "resourceType" ORDER BY "resourceType"`),
    Promise.all(legacyTenantRoots.map(async table=>{
      const column=table==="media_assets"?"organizationId":"organizationId";
      const result=await pgPool.query<{count:number}>(`SELECT count(*)::int AS count FROM "${table}" WHERE "${column}" IS NULL`);
      return {table,count:result.rows[0]?.count||0};
    })),
    pgPool.query<{table_name:string;enabled:boolean;forced:boolean}>(`
      SELECT c.relname AS table_name,c.relrowsecurity AS enabled,c.relforcerowsecurity AS forced
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relname=ANY($1::text[])
       ORDER BY c.relname`,[forcedTables]),
  ]);
  const runtime=role.rows[0]||{rolname:"unknown",rolsuper:true,rolbypassrls:true};
  const missingRls=forcedTables.filter(t=>!rls.rows.some(r=>r.table_name===t&&r.enabled&&r.forced));
  const unresolved=conflicts.rows.reduce((sum,row)=>sum+Number(row.count),0)+nullRoots.reduce((sum,row)=>sum+row.count,0);
  const roleSafe=!runtime.rolsuper&&!runtime.rolbypassrls;
  return {
    readyForLegacyRlsCutover: unresolved===0&&missingRls.length===0&&roleSafe,
    runtimeRole:{name:runtime.rolname,superuser:runtime.rolsuper,bypassRls:runtime.rolbypassrls,safeForProductionRls:roleSafe},
    unresolvedBackfill:conflicts.rows,
    nullTenantRoots:nullRoots,
    forcedRlsTables:rls.rows,
    missingForcedRls:missingRls,
    note:"Legacy workspaces/websites/media and website-child tables must move to same-connection tenant UnitOfWork before their final FORCE RLS cutover. This preflight blocks that cutover rather than enabling unsafe partial policies.",
  };
}
