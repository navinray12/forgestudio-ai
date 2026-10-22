// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach, beforeEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Phase 7B: Developer Workspace screen behaviour (src/features/developer-workspace/pages/DeveloperWorkspace.tsx),
 * mounted through its real route (/workspace/:projectId) with deterministic mocks:
 *  - forgeProjectService: the methods the screen calls on load and save are scripted; any other method
 *    resolves {} (panels that load extra data on mount);
 *  - @monaco-editor/react: a textarea with the same value / onChange contract;
 *  - the workspace sync WebSocket client: inert;
 *  - fetch: answers {} (panels that call the API directly).
 *
 * The request contracts of forgeProjectService itself are pinned by tests/services (277 goldens). This
 * file checks the screen: loading, failure, project header, file tree, default file, editing, saving
 * (including the optimistic-concurrency conflict) and the mode switcher. It does not use a backend or
 * database, so persistence is NOT verified here.
 */
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const service = vi.hoisted(() => ({ impl: {} as Record<string, (...a: any[]) => any>, calls: [] as Array<[string, unknown[]]> }));

vi.mock("../../src/features/developer-workspace/services/forgeProjectService", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const forgeProjectService = new Proxy({}, {
    get: (_t, key: string) => (...args: unknown[]) => {
      service.calls.push([key, args]);
      const fn = service.impl[key];
      return fn ? fn(...args) : Promise.resolve({});
    },
  });
  return { ...actual, forgeProjectService };
});

vi.mock("@monaco-editor/react", () => {
  const Editor = ({ value, onChange, path }: { value?: string; onChange?: (v: string) => void; path?: string }) =>
    React.createElement("textarea", { "aria-label": `code editor ${path}`, value: value ?? "", onChange: (e: any) => onChange?.(e.target.value) });
  return { default: Editor, Editor, DiffEditor: () => null, loader: { config: () => {} } };
});

vi.mock("../../src/features/developer-workspace/services/workspaceSyncClient", () => ({
  connectWorkspaceSync: () => ({ close: () => {}, send: () => {}, submitOperation: () => {} }),
  workspaceSyncUrl: () => "ws://localhost/ws/workspace-sync",
}));

import { DeveloperWorkspace } from "../../src/features/developer-workspace/pages/DeveloperWorkspace";

const PROJECT = {
  id: "proj-1", slug: "acme", name: "Acme Site", projectType: "website", lifecycleStatus: "ACTIVE", websiteId: "site-1",
  framework: "react", frameworkVersion: "18", runtime: "node", runtimeVersion: "20", packageManager: "npm",
};
const node = (path: string, extra: Record<string, unknown> = {}) => ({
  id: path, path, name: path.split("/").pop()!, extension: path.includes(".") ? `.${path.split(".").pop()}` : "", isDirectory: false,
  sizeBytes: 10, version: 1, isGenerated: false, isProtected: false, ...extra,
});
const TREE = [
  { ...node("src", { isDirectory: true, extension: "" }), children: [
    { ...node("src/pages", { isDirectory: true, extension: "" }), children: [node("src/pages/Home.tsx"), node("src/pages/About.tsx")] },
  ] },
];
const PAGES = [
  { key: "home", pageId: "home", name: "Home", title: "Home", routePath: "/", filePath: "src/pages/Home.tsx", componentName: "Home", isHome: true },
  { key: "about", pageId: "about", name: "About", title: "About", routePath: "/about", filePath: "src/pages/About.tsx", componentName: "About", isHome: false },
];
const fileOf = (path: string, content: string, version = 1) => ({ ...node(path), content, version });

function scriptHappyPath() {
  service.impl = {
    getProject: async (id: string) => ({ project: { ...PROJECT, id } }),
    getFileTree: async () => ({ tree: TREE }),
    getManifest: async () => ({ manifest: null }),
    listPages: async () => ({ pages: PAGES }),
    readFile: async (_id: string, path: string) => ({ file: fileOf(path, `// ${path}\nexport default function X() {}\n`) }),
    listSnapshots: async () => ({ snapshots: [] }),
  };
}

function mountWorkspace(path = "/workspace/proj-1") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/workspace/:projectId" element={<DeveloperWorkspace />} />
        <Route path="/workspace/website/:websiteId" element={<DeveloperWorkspace />} />
        <Route path="/editor/:websiteId" element={<div>visual editor route</div>} />
      </Routes>
    </MemoryRouter>,
  );
}
const editorFor = (path: string) => screen.findByLabelText(`code editor ${path}`) as Promise<HTMLTextAreaElement>;
const callsOf = (name: string) => service.calls.filter(([k]) => k === name).map(([, a]) => a);

beforeEach(() => {
  service.calls = [];
  scriptHappyPath();
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } })));
  (globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView ??= function () {};
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Developer Workspace screen", () => {
  it("shows the boot screen, then the project header, file tree and the home page file", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const base = service.impl.getProject;
    service.impl.getProject = async (id: string) => { await gate; return base(id); };
    mountWorkspace();
    expect(screen.getByText("Booting Forge Developer Workspace...")).toBeTruthy();
    await act(async () => { release(); });

    const editor = await editorFor("src/pages/Home.tsx");
    expect(editor.value).toBe("// src/pages/Home.tsx\nexport default function X() {}\n");
    const header = document.querySelector("header")!;
    expect(within(header).getByText("Acme Site")).toBeTruthy();
    expect(within(header).getByText("react")).toBeTruthy();
    expect(within(header).getByText("ACTIVE")).toBeTruthy();
    expect(screen.getAllByText("Home.tsx").length).toBeGreaterThan(0);
    expect(callsOf("getProject")).toEqual([["proj-1"]]);
    expect(callsOf("getFileTree")).toEqual([["proj-1"]]);
    expect(callsOf("readFile")[0]).toEqual(["proj-1", "src/pages/Home.tsx"]);
  });

  it("opens through /workspace/website/:websiteId with getProjectByWebsite", async () => {
    service.impl.getProjectByWebsite = async () => ({ project: PROJECT });
    mountWorkspace("/workspace/website/site-1");
    await editorFor("src/pages/Home.tsx");
    expect(callsOf("getProjectByWebsite")).toEqual([["site-1"]]);
    expect(callsOf("getProject")).toEqual([]);
  });

  it("an initialization failure shows the error screen with the message", async () => {
    service.impl.getProject = async () => { throw new Error("Project not found"); };
    mountWorkspace();
    await screen.findByText("Workspace Initialization Failed");
    expect(screen.getByText("Project not found")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Return to Previous Page" })).toBeTruthy();
  });

  it("editing marks the tab dirty; Save writes the content with the file's version and shows Saved", async () => {
    const writes: unknown[][] = [];
    service.impl.writeFile = async (...args: unknown[]) => { writes.push(args); return { file: fileOf("src/pages/Home.tsx", "// edited\n", 2) }; };
    mountWorkspace();
    const editor = await editorFor("src/pages/Home.tsx");
    const save = () => screen.getByTitle("Save File (Ctrl+S)");
    fireEvent.change(editor, { target: { value: "// edited\n" } });
    await waitFor(() => expect(save().className).toContain("bg-blue-600"));
    fireEvent.click(save());
    await waitFor(() => expect(within(save()).queryByText("Saved")).not.toBeNull());
    expect(writes).toEqual([["proj-1", "src/pages/Home.tsx", { content: "// edited\n", expectedVersion: 1 }]]);
  });

  it("a concurrency conflict keeps the edit unsaved and reports it", async () => {
    service.impl.writeFile = async () => { throw new Error("Optimistic concurrency conflict: file version changed"); };
    mountWorkspace();
    const editor = await editorFor("src/pages/Home.tsx");
    fireEvent.change(editor, { target: { value: "// mine\n" } });
    const save = () => screen.getByTitle("Save File (Ctrl+S)");
    await waitFor(() => expect(save().className).toContain("bg-blue-600"));
    fireEvent.click(save());
    await waitFor(() => expect(callsOf("writeFile")).toHaveLength(1));
    await waitFor(() => expect(document.body.textContent!.replace(/\s+/g, " ")).toContain("src/pages/Home.tsx was regenerated or edited elsewhere after you opened it. Your edits were not saved; copy anything you need before reloading."));
    expect(screen.getByRole("button", { name: "Reload file" })).toBeTruthy();
    expect(within(save()).queryByText("Saved")).toBeNull();
    expect((await editorFor("src/pages/Home.tsx")).value).toBe("// mine\n");
  });

  it("the mode switcher shows split and full preview, and back to code", async () => {
    mountWorkspace();
    await editorFor("src/pages/Home.tsx");
    fireEvent.click(screen.getByRole("button", { name: /Split Preview/ }));
    await waitFor(() => expect(document.getElementById("workspace-split-container")).not.toBeNull());
    expect(screen.getByLabelText("code editor src/pages/Home.tsx")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Full Preview/ }));
    await waitFor(() => expect(document.getElementById("workspace-split-container")).toBeNull());
    expect(screen.queryByLabelText("code editor src/pages/Home.tsx")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Code Only/ }));
    await editorFor("src/pages/Home.tsx");
  });

  it("Visual Editor returns to /editor/:websiteId", async () => {
    mountWorkspace();
    await editorFor("src/pages/Home.tsx");
    fireEvent.click(screen.getByTitle("Return to Visual Builder"));
    await screen.findByText("visual editor route");
  });
});
