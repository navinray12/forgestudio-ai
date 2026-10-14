/**
 * ForgeStudio Execution Blueprint v2.1 — Points 31 & 32
 * Regression Test Suite: Stable Page & Router Registration
 */

import { describe, it, expect } from "vitest";
import {
  isRecognizedPageEntry,
  detectRouteCollisions,
  generateReactRouterCode,
  retirePage,
  RegisteredPage,
} from "../services/compiler/pageRegistry.js";

describe("Point 31 — Page Registry & Framework Routing Conventions", () => {
  it("discovers Next.js App Router root page in both app/ and src/app/", () => {
    const rootPage = isRecognizedPageEntry("app/page.tsx", "nextjs");
    expect(rootPage.isPage).toBe(true);
    if (rootPage.isPage) {
      expect(rootPage.routePath).toBe("/");
      expect(rootPage.componentName).toBe("HomePage");
    }

    const srcAppPage = isRecognizedPageEntry("src/app/page.tsx", "nextjs");
    expect(srcAppPage.isPage).toBe(true);
    if (srcAppPage.isPage) {
      expect(srcAppPage.routePath).toBe("/");
      expect(srcAppPage.componentName).toBe("HomePage");
    }
  });

  it("handles Next.js route groups correctly by omitting parenthesized group segments from routePath", () => {
    // (marketing) group must not appear in the URL route path
    const marketingAbout = isRecognizedPageEntry("app/(marketing)/about/page.tsx", "nextjs");
    expect(marketingAbout.isPage).toBe(true);
    if (marketingAbout.isPage) {
      expect(marketingAbout.routePath).toBe("/about");
      expect(marketingAbout.pageName).toBe("About");
    }

    const authLogin = isRecognizedPageEntry("src/app/(auth)/login/page.tsx", "nextjs");
    expect(authLogin.isPage).toBe(true);
    if (authLogin.isPage) {
      expect(authLogin.routePath).toBe("/login");
      expect(authLogin.pageName).toBe("Login");
    }
  });

  it("excludes Next.js infrastructure files from page registration", () => {
    const layout = isRecognizedPageEntry("app/layout.tsx", "nextjs");
    expect(layout.isPage).toBe(false);

    const loading = isRecognizedPageEntry("src/app/loading.tsx", "nextjs");
    expect(loading.isPage).toBe(false);

    const errorPage = isRecognizedPageEntry("app/error.tsx", "nextjs");
    expect(errorPage.isPage).toBe(false);

    const notFound = isRecognizedPageEntry("src/app/not-found.tsx", "nextjs");
    expect(notFound.isPage).toBe(false);

    const apiRoute = isRecognizedPageEntry("app/api/users/route.ts", "nextjs");
    expect(apiRoute.isPage).toBe(false);

    const middleware = isRecognizedPageEntry("src/middleware.ts", "nextjs");
    expect(middleware.isPage).toBe(false);
  });

  it("discovers React/Vite pages and normalizes route slugs", () => {
    const contactPage = isRecognizedPageEntry("src/pages/ContactUsPage.tsx", "react");
    expect(contactPage.isPage).toBe(true);
    if (contactPage.isPage) {
      expect(contactPage.routePath).toBe("/contact-us");
      expect(contactPage.componentName).toBe("ContactUsPage");
    }
  });

  it("detects route collisions when multiple pages claim the same routePath", () => {
    const pages: RegisteredPage[] = [
      {
        key: "p1",
        pageId: "1",
        stablePageId: "page_1",
        fileId: "file_1",
        name: "About Us",
        title: "About Us",
        routePath: "/about",
        filePath: "src/pages/AboutPage.tsx",
        componentName: "AboutPage",
        isHome: false,
      },
      {
        key: "p2",
        pageId: "2",
        stablePageId: "page_2",
        fileId: "file_2",
        name: "About Company",
        title: "About Company",
        routePath: "/about", // Duplicate routePath!
        filePath: "app/about/page.tsx",
        componentName: "AboutCompanyPage",
        isHome: false,
      },
    ];

    const collisions = detectRouteCollisions(pages);
    expect(collisions.length).toBe(1);
    expect(collisions[0].routePath).toBe("/about");
    expect(collisions[0].collidingPages.length).toBe(2);
  });

  it("generates clean React Router v6 configuration code", () => {
    const pages: RegisteredPage[] = [
      {
        key: "p1",
        pageId: "1",
        stablePageId: "page_home",
        fileId: "file_home",
        name: "Home",
        title: "Home",
        routePath: "/",
        filePath: "src/pages/HomePage.tsx",
        componentName: "HomePage",
        isHome: true,
      },
      {
        key: "p2",
        pageId: "2",
        stablePageId: "page_pricing",
        fileId: "file_pricing",
        name: "Pricing",
        title: "Pricing",
        routePath: "/pricing",
        filePath: "src/pages/PricingPage.tsx",
        componentName: "PricingPage",
        isHome: false,
      },
    ];

    const routerCode = generateReactRouterCode(pages);
    expect(routerCode).toContain('import HomePage from "./pages/HomePage.js";');
    expect(routerCode).toContain('import PricingPage from "./pages/PricingPage.js";');
    expect(routerCode).toContain('<Route path="/" element={<HomePage />} />');
    expect(routerCode).toContain('<Route path="pricing" element={<PricingPage />} />');
  });

  it("retires a page without deleting historical records or media", () => {
    const pages: RegisteredPage[] = [
      {
        key: "p1",
        pageId: "1",
        stablePageId: "page_1",
        fileId: "file_1",
        name: "Old Campaign",
        title: "Old Campaign",
        routePath: "/promo",
        filePath: "src/pages/PromoPage.tsx",
        componentName: "PromoPage",
        isHome: false,
        isRetired: false,
      },
    ];

    const updated = retirePage(pages, "p1");
    expect(updated[0].isRetired).toBe(true);
    // Underlying file and stable ID remain preserved!
    expect(updated[0].stablePageId).toBe("page_1");
  });
});
