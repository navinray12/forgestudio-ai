/**
 * Application model contract (blueprint §33, §39, §45): validation of untrusted model output,
 * stable identities, and the static checks applied to emitted source. No database or provider.
 */
import { describe, it, expect } from "vitest";
import { APPROVED_TEMPLATES, toApplicationSpec, validateAppModel, writableFields } from "../services/appGeneration/appModel.js";
import { emitApplicationSource, validateEmittedSource, GENERATED_DEPENDENCIES } from "../services/appGeneration/appSourceEmitter.js";
import { ApplicationSpecService } from "../services/authoritative/applicationSpec.service.js";

const tracker = APPROVED_TEMPLATES["task-tracker"];
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const errorsOf = (mutate: (model: any) => void) => {
  const model = clone(tracker);
  mutate(model);
  return validateAppModel(model).errors.join(" | ");
};

describe("application model validation", () => {
  it("accepts the approved templates and older output without references/lifecycle", () => {
    for (const template of Object.values(APPROVED_TEMPLATES)) expect(validateAppModel(clone(template)).valid).toBe(true);
    const legacy = { applicationName: "Clinic", entities: [{ name: "Visit", description: "", fields: [{ name: "notes", type: "text", required: false, description: "" }] }] };
    const result = validateAppModel(legacy);
    expect(result.valid).toBe(true);
    expect(result.model!.entities[0]).toMatchObject({ lifecycle: null, fields: [{ references: "" }] });
  });

  it("rejects platform-owned fields, unknown properties and dangling references", () => {
    expect(errorsOf((m) => m.entities[1].fields.push({ name: "tenantId", type: "string", required: true, description: "", references: "" }))).toContain("platform-owned");
    expect(errorsOf((m) => m.entities[1].fields.push({ name: "revision", type: "integer", required: true, description: "", references: "" }))).toContain("platform-owned");
    expect(errorsOf((m) => { m.entities[0].isAdmin = true; })).toContain('unknown property "isAdmin"');
    expect(errorsOf((m) => { m.entities[1].fields[1].references = "Workspace"; })).toContain("is not a declared entity");
    expect(errorsOf((m) => { m.entities[1].fields[0].references = "Project"; })).toContain("only allowed on reference fields");
  });

  it("rejects lifecycles that could bypass their own rules", () => {
    expect(errorsOf((m) => { m.entities[1].lifecycle.field = "title"; })).toContain("duplicates a declared field");
    expect(errorsOf((m) => { m.entities[1].lifecycle.initial = "ARCHIVED"; })).toContain("not a declared state");
    expect(errorsOf((m) => { m.entities[1].lifecycle.commands[0].to = "SHIPPED"; })).toContain("not a declared state");
    expect(errorsOf((m) => { m.entities[1].lifecycle.commands[0].to = "OPEN"; })).toContain("to itself");
    expect(errorsOf((m) => { m.entities[1].lifecycle.commands[1].requiredEvidence = ["title"]; })).toContain("must be an optional field");
    expect(errorsOf((m) => { m.entities[1].lifecycle.commands[1].requiredEvidence = ["missing"]; })).toContain("is not a field of this entity");
    expect(errorsOf((m) => { m.entities[1].lifecycle.commands[0].name = "update"; })).toContain("reserved");
  });

  it("keeps command evidence out of generic create/update input", () => {
    expect(writableFields(tracker.entities[1]).map((f) => f.name)).toEqual(["title", "projectId", "dueAt"]);
  });
});

describe("ApplicationSpec projection", () => {
  it("produces identical stable IDs for the same project and a valid spec", () => {
    const first = toApplicationSpec(tracker, "project-1", "tenant-1");
    const second = toApplicationSpec(clone(tracker), "project-1", "tenant-1");
    const ids = (spec: typeof first) => ({
      entities: spec.entities.map((e) => [e.id, ...e.fields.map((f) => f.id)]),
      operations: spec.operations.map((o) => o.id),
      relationships: spec.relationships.map((r) => r.id),
    });
    expect(ids(second)).toEqual(ids(first));
    expect(toApplicationSpec(tracker, "project-2", "tenant-1").entities[0].id).not.toBe(first.entities[0].id);
    expect(ApplicationSpecService.validateApplicationSpec(first)).toMatchObject({ valid: true, errors: [] });
  });

  it("records references as restricted relationships and commands as audited operations", () => {
    const spec = toApplicationSpec(tracker, "project-1", "tenant-1");
    expect(spec.relationships).toHaveLength(1);
    expect(spec.relationships[0]).toMatchObject({ name: "Task.projectId", foreignKeyField: "projectId", cascadeRule: "RESTRICT_NO_ACTION" });
    const complete = spec.operations.find((o) => o.name === "completeTask")!;
    expect(complete).toMatchObject({ method: "POST", transactionBoundary: "ATOMIC_TRANSACTION" });
    expect(complete.declaredSideEffects).toEqual(["audit:Task.complete", "outbox:Task.complete"]);
    const status = spec.entities[1].fields.find((f) => f.name === "status")!;
    expect(status).toMatchObject({ visibility: "READ_ONLY", lifecycleOwnership: "SYSTEM", enumOptions: ["OPEN", "IN_PROGRESS", "DONE"] });
  });
});

describe("emitted source checks", () => {
  const files = () => emitApplicationSource(tracker, toApplicationSpec(tracker, "project-1", "tenant-1"), "run-1", "APPROVED_TEMPLATE");

  it("passes for both templates and pins exact dependency versions", () => {
    expect(validateEmittedSource(files())).toMatchObject({ ok: true, errors: [] });
    const lead = APPROVED_TEMPLATES["lead-inbox"];
    expect(validateEmittedSource(emitApplicationSource(lead, toApplicationSpec(lead, "p", "t"), "run-2", "APPROVED_TEMPLATE")).ok).toBe(true);
    const manifest = JSON.parse(files().find((f) => f.path === "forge-app/package.json")!.content);
    expect(manifest.dependencies).toEqual(GENERATED_DEPENDENCIES);
    for (const version of Object.values({ ...manifest.dependencies, ...manifest.devDependencies })) expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("fails on an undeclared package, a missing module and a syntax error", () => {
    const withExtra = (path: string, content: string) => [...files(), { path, content, role: "SERVER" as const }];
    expect(validateEmittedSource(withExtra("forge-app/server/x.ts", 'import axios from "axios";\nexport const a = axios;\n')).errors.join())
      .toContain('import "axios" is not a declared dependency');
    expect(validateEmittedSource(withExtra("forge-app/server/y.ts", 'import { z } from "./missing.js";\nexport const y = z;\n')).errors.join())
      .toContain("does not resolve within the generated source");
    expect(validateEmittedSource(withExtra("forge-app/server/z.ts", "export const = ;\n")).ok).toBe(false);
    expect(validateEmittedSource(files().filter((f) => !f.path.endsWith("package.json"))).errors.join()).toContain("package.json is missing");
  });

  it("never embeds model text as code: names with quotes or markup stay data", () => {
    const hostile = clone(tracker);
    hostile.applicationName = `Tasks"; process.exit(1); //</title><script>alert(1)</script>`;
    hostile.entities[0].description = "`${process.env.SECRET}`";
    const emitted = emitApplicationSource(hostile, toApplicationSpec(hostile, "p", "t"), "run-3", "APPROVED_TEMPLATE");
    expect(validateEmittedSource(emitted).ok).toBe(true);
    expect(emitted.find((f) => f.path.endsWith("web/index.html"))!.content).not.toContain("<script>alert(1)</script>");
    expect(emitted.find((f) => f.path.endsWith("web/model.ts"))!.content).toContain(JSON.stringify(hostile.applicationName));
  });
});
