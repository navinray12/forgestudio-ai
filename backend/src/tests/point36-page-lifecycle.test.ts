import { describe, it, expect } from "vitest";
import {
  isRecognizedPageEntry,
  buildPageRegistry,
  createPageLifecycle,
  renameOrMovePage,
  retirePageReversible,
  restorePageDraft,
  reconcilePersistedCheckpoint,
  detectRouteCollisions,
  RegisteredPage,
} from "../services/compiler/pageRegistry.js";

describe("Point 36: Canonical Page Registry and File Lifecycle", () => {
  describe("4.2 Framework-Specific Route Recognition", () => {
    describe("Next.js App Router Recognition", () => {
      it("recognizes standard App router page", () => {
        const result = isRecognizedPageEntry("app/about/page.tsx", "nextjs");
        expect(result.isPage).toBe(true);
        if (result.isPage) {
          expect(result.routePath).toBe("/about");
          expect(result.routerProfile).toBe("nextjs-app-router");
        }
      });

      it("handles route groups by omitting them from URL pathname", () => {
        const result = isRecognizedPageEntry("src/app/(marketing)/about/page.tsx", "nextjs");
        expect(result.isPage).toBe(true);
        if (result.isPage) {
          expect(result.routePath).toBe("/about");
          expect(result.routeGroups).toContain("marketing");
        }
      });

      it("identifies dynamic parameter routes [projectId]", () => {
        const result = isRecognizedPageEntry("app/projects/[projectId]/page.tsx", "nextjs");
        expect(result.isPage).toBe(true);
        if (result.isPage) {
          expect(result.routeTemplate).toBe("/projects/[projectId]");
          const dynParam = result.routeParameters?.find((p) => p.name === "projectId");
          expect(dynParam?.type).toBe("dynamic");
        }
      });

      it("identifies catch-all [...slug] and optional catch-all [[...slug]] routes", () => {
        const catchAll = isRecognizedPageEntry("app/docs/[...slug]/page.tsx", "nextjs");
        expect(catchAll.isPage).toBe(true);
        if (catchAll.isPage) {
          expect(catchAll.routeParameters?.some((p) => p.type === "catch-all")).toBe(true);
        }

        const optionalCatchAll = isRecognizedPageEntry("app/shop/[[...filter]]/page.tsx", "nextjs");
        expect(optionalCatchAll.isPage).toBe(true);
        if (optionalCatchAll.isPage) {
          expect(optionalCatchAll.routeParameters?.some((p) => p.type === "optional-catch-all")).toBe(true);
        }
      });

      it("excludes private folders starting with underscore (_components)", () => {
        const privateFolder = isRecognizedPageEntry("app/_components/page.tsx", "nextjs");
        expect(privateFolder.isPage).toBe(false);
      });

      it("excludes parallel routes (@modal) and layout/error infrastructure", () => {
        const parallel = isRecognizedPageEntry("app/@modal/page.tsx", "nextjs");
        expect(parallel.isPage).toBe(false);

        const layout = isRecognizedPageEntry("app/layout.tsx", "nextjs");
        expect(layout.isPage).toBe(false);

        const error = isRecognizedPageEntry("app/error.tsx", "nextjs");
        expect(error.isPage).toBe(false);
      });
    });

    describe("Next.js Pages Router Recognition", () => {
      it("normalizes index to root route", () => {
        const result = isRecognizedPageEntry("pages/index.tsx", "nextjs");
        expect(result.isPage).toBe(true);
        if (result.isPage) {
          expect(result.routePath).toBe("/");
          expect(result.routerProfile).toBe("nextjs-pages-router");
        }
      });

      it("excludes API routes, _app.tsx and _document.tsx", () => {
        expect(isRecognizedPageEntry("pages/api/users.ts", "nextjs").isPage).toBe(false);
        expect(isRecognizedPageEntry("pages/_app.tsx", "nextjs").isPage).toBe(false);
        expect(isRecognizedPageEntry("pages/_document.tsx", "nextjs").isPage).toBe(false);
      });
    });

    describe("React/Vite Route Recognition", () => {
      it("recognizes pages in src/pages/*", () => {
        const result = isRecognizedPageEntry("src/pages/AboutPage.tsx", "react");
        expect(result.isPage).toBe(true);
        if (result.isPage) {
          expect(result.routePath).toBe("/about");
          expect(result.routerProfile).toBe("react-vite");
        }
      });

      it("excludes tests, stories, and generic helper components", () => {
        expect(isRecognizedPageEntry("src/pages/AboutPage.test.tsx", "react").isPage).toBe(false);
        expect(isRecognizedPageEntry("src/pages/AboutPage.stories.tsx", "react").isPage).toBe(false);
        expect(isRecognizedPageEntry("src/components/Button.tsx", "react").isPage).toBe(false);
      });
    });
  });

  describe("4.3 Page Lifecycle Operations", () => {
    const existingPages: RegisteredPage[] = [
      {
        key: "page_home_key",
        pageId: "page_home_key",
        stablePageId: "page_home_stable",
        fileId: "file_home",
        name: "Home",
        title: "Home",
        routePath: "/",
        filePath: "src/pages/HomePage.tsx",
        componentName: "HomePage",
        isHome: true,
        routerProfile: "react-vite",
      },
    ];

    it("creates a page, checks route collision, and generates initial source", () => {
      const created = createPageLifecycle({
        projectId: "proj_life_1",
        pageName: "Contact Us",
        routePath: "/contact",
        framework: "react",
        existingPages,
      });

      expect(created.newPage.stablePageId).toBeDefined();
      expect(created.newPage.fileId).toBeDefined();
      expect(created.newPage.routePath).toBe("/contact");
      expect(created.initialSourceCode).toContain("ContactUsPage");
      expect(created.updatedPages.length).toBe(2);
    });

    it("rejects creating a page claiming an existing route path", () => {
      expect(() => {
        createPageLifecycle({
          projectId: "proj_life_1",
          pageName: "Home Duplicate",
          routePath: "/", // already claimed
          framework: "react",
          existingPages,
        });
      }).toThrow("Route collision");
    });

    it("renames or moves page while strictly preserving stable pageId and fileId", () => {
      const moved = renameOrMovePage({
        pages: existingPages,
        pageKey: "page_home_key",
        newRoutePath: "/",
        newFilePath: "src/pages/HomeRenamed.tsx",
        newName: "Main Landing",
      });

      const updated = moved.updatedPages.find((p) => p.key === "page_home_key");
      expect(updated?.name).toBe("Main Landing");
      expect(updated?.filePath).toBe("src/pages/HomeRenamed.tsx");
      // Stable identity invariant
      expect(updated?.stablePageId).toBe("page_home_stable");
      expect(updated?.fileId).toBe("file_home");
    });

    it("handles Windows case-only rename without throwing false collision", () => {
      const moved = renameOrMovePage({
        pages: existingPages,
        pageKey: "page_home_key",
        newFilePath: "src/pages/homepage.tsx", // case change only
      });

      expect(moved.updatedPages[0].filePath).toBe("src/pages/homepage.tsx");
    });

    it("reversibly retires a page without purging history, CMS, or media", () => {
      const retired = retirePageReversible(existingPages, "page_home_key", "User archived page");
      const target = retired.find((p) => p.key === "page_home_key");
      expect(target?.isRetired).toBe(true);
      expect(target?.syncStatus).toBe("RETIRED");
      expect(target?.retirementReason).toBe("User archived page");
      expect(target?.retiredAt).toBeDefined();
    });

    it("restores a retired page back into draft state", () => {
      const retired = retirePageReversible(existingPages, "page_home_key");
      const restored = restorePageDraft(retired, "page_home_key");
      const target = restored.find((p) => p.key === "page_home_key");
      expect(target?.isRetired).toBe(false);
      expect(target?.syncStatus).toBe("SYNCHRONIZED");
      expect(target?.retirementReason).toBeUndefined();
    });

    it("reconciles persisted checkpoint and ignores atomic editor .tmp save files", () => {
      const fsFiles = [
        "src/pages/HomePage.tsx",
        "src/pages/HomePage.tsx.tmp", // atomic write temp file
        "src/pages/.tmp.swap",
      ];

      const reconciliation = reconcilePersistedCheckpoint(existingPages, fsFiles);
      expect(reconciliation.missingFiles.length).toBe(0);
      expect(reconciliation.reconciledPages[0].syncStatus).toBe("SYNCHRONIZED");
    });

    it("marks a page pending while its file is missing, recovers it when the file returns, and never clears a conflict", () => {
      const missing = reconcilePersistedCheckpoint(existingPages, ["src/pages/HomePage.tsx.tmp"]);
      expect(missing.missingFiles).toEqual(["src/pages/HomePage.tsx"]);
      expect(missing.reconciledPages[0].syncStatus).toBe("PENDING_SYNC");

      const recovered = reconcilePersistedCheckpoint(missing.reconciledPages, ["src/pages/HomePage.tsx"]);
      expect(recovered.reconciledPages[0].syncStatus).toBe("SYNCHRONIZED");

      const conflicted = reconcilePersistedCheckpoint(
        [{ ...existingPages[0], syncStatus: "CONFLICT" }],
        ["src/pages/HomePage.tsx"]
      );
      expect(conflicted.reconciledPages[0].syncStatus).toBe("CONFLICT");
    });
  });
});
