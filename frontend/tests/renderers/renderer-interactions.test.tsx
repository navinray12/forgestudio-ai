// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Targeted interaction tests for renderers whose behaviour the generic probe cannot reach with neutral
 * fixtures: NavMenu navigation semantics (preview vs editor, internal/external/unsafe/orphaned links,
 * submenus) and FormWidgetRenderer submission (request contract, success/failure, validation, editor
 * mode), plus document-level listener cleanup for menus and the off-canvas panel.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FormWidgetRenderer, MegaMenuWidgetRenderer, NavMenuWidgetRenderer, OffCanvasWidgetRenderer } from "../../src/pages/editor/widgets/renderers";

const PAGES = [
  { id: "home", name: "Home", slug: "/", isHome: true },
  { id: "about", name: "About Us", slug: "/about" },
];

const NAV_ITEMS = [
  { id: "n-about", label: "About", url: "/about", linkType: "page", pageId: "about" },
  { id: "n-docs", label: "Docs", url: "https://docs.example.com" },
  { id: "n-bad", label: "Bad", url: "javascript:alert(1)" },
  { id: "n-gone", label: "Gone", linkType: "page", pageId: "deleted-page" },
  { id: "n-more", label: "More", url: "#", submenu: [{ id: "sub-1", label: "Sub One", url: "/about" }] },
];

const navEl = { id: "nav", type: "nav-menu", content: "", styles: {}, navMenuItems: NAV_ITEMS };
const link = (label: string) => screen.getAllByText(label)[0].closest("a") as HTMLAnchorElement;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("NavMenuWidgetRenderer navigation", () => {
  const renderNav = (isPreview: boolean) => {
    const onNavigatePage = vi.fn();
    render(<NavMenuWidgetRenderer el={navEl as any} isPreview={isPreview} mergedStyles={{}} pages={PAGES as any} homePageId="home" onNavigatePage={onNavigatePage} />);
    return onNavigatePage;
  };

  it("preview: an internal page link navigates via onNavigatePage and prevents the browser default", () => {
    const onNavigatePage = renderNav(true);
    const notPrevented = fireEvent.click(link("About"));
    expect(onNavigatePage.mock.calls).toEqual([["about"]]);
    expect(notPrevented).toBe(false);
  });

  it("preview: an external link is left to the browser", () => {
    const onNavigatePage = renderNav(true);
    const a = link("Docs");
    expect(a.getAttribute("href")).toBe("https://docs.example.com");
    expect(fireEvent.click(a)).toBe(true);
    expect(onNavigatePage).not.toHaveBeenCalled();
  });

  it("an unsafe javascript: link is neutralised", () => {
    renderNav(true);
    expect(link("Bad").getAttribute("href")).not.toMatch(/javascript:/i);
  });

  it("a link to a deleted page is labelled unavailable", () => {
    renderNav(true);
    expect(screen.getAllByText(/Gone \(Unavailable\)/).length).toBeGreaterThan(0);
  });

  it("editor mode: clicks never navigate and are always prevented", () => {
    const onNavigatePage = renderNav(false);
    for (const label of ["About", "Docs"]) expect(fireEvent.click(link(label))).toBe(false);
    expect(onNavigatePage).not.toHaveBeenCalled();
  });

  it("editor mode: clicking an item with a submenu toggles it open", () => {
    renderNav(false);
    expect(screen.queryAllByText("Sub One")).toHaveLength(0);
    fireEvent.click(link("More"));
    expect(screen.getAllByText("Sub One").length).toBeGreaterThan(0);
  });
});

describe("FormWidgetRenderer submission", () => {
  const FIELDS = [
    { id: "name", type: "text", label: "Name", required: true, placeholder: "Your name" },
    { id: "email", type: "email", label: "Email", required: true, placeholder: "you@example.com" },
  ];
  const formEl = { id: "contact-form", type: "form", content: "", styles: {}, formTitle: "Contact", formFields: FIELDS };

  const fill = () => {
    fireEvent.change(screen.getByPlaceholderText("Your name"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), { target: { value: "ada@example.com" } });
  };
  const submit = async () => {
    await act(async () => {
      fireEvent.submit(document.querySelector("form")!);
      for (let i = 0; i < 5; i++) await Promise.resolve();
    });
  };

  it("preview: posts the form with an idempotency key and shows the submitted state", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) }));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<FormWidgetRenderer el={formEl as any} isPreview mergedStyles={{}} websiteId="site-1" />);
    const before = container.innerHTML;
    fill();
    await submit();
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/forms\/submit$/);
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(typeof headers["Idempotency-Key"]).toBe("string");
    expect(headers["Idempotency-Key"].length).toBeGreaterThan(0);
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ websiteId: "site-1", formId: "contact-form", formName: "Contact" });
    expect(JSON.stringify(body.fields)).toContain("Ada");
    expect(JSON.stringify(body.fields)).toContain("ada@example.com");
    expect(body.data).toEqual(body.fields);
    expect(container.innerHTML).not.toBe(before);
    expect(screen.queryByPlaceholderText("Your name")).toBeNull();
  });

  it("preview: a rejected submission shows the server message and keeps the form", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({ message: "Rate limited" }) })));
    render(<FormWidgetRenderer el={formEl as any} isPreview mergedStyles={{}} websiteId="site-1" />);
    fill();
    await submit();
    expect(screen.getAllByText(/Rate limited/).length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText("Your name")).toBeTruthy();
  });

  it("required fields block submission without a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<FormWidgetRenderer el={formEl as any} isPreview mergedStyles={{}} websiteId="site-1" />);
    await submit();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText("Your name")).toBeTruthy();
  });

  it("editor mode: submitting never sends a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<FormWidgetRenderer el={formEl as any} isPreview={false} mergedStyles={{}} websiteId="site-1" />);
    fill();
    await submit();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("document-level listener cleanup", () => {
  const track = () => {
    const balance = new Map<string, number>();
    const realAdd = document.addEventListener.bind(document);
    const realRemove = document.removeEventListener.bind(document);
    vi.spyOn(document, "addEventListener").mockImplementation(((t: string, l: any, o?: any) => { balance.set(t, (balance.get(t) ?? 0) + 1); realAdd(t, l, o); }) as typeof document.addEventListener);
    vi.spyOn(document, "removeEventListener").mockImplementation(((t: string, l: any, o?: any) => { balance.set(t, (balance.get(t) ?? 0) - 1); realRemove(t, l, o); }) as typeof document.removeEventListener);
    return () => [...balance].filter(([, n]) => n !== 0);
  };

  it.each([
    ["NavMenu (preview)", () => <NavMenuWidgetRenderer el={navEl as any} isPreview mergedStyles={{}} pages={PAGES as any} homePageId="home" />],
    ["NavMenu (editor)", () => <NavMenuWidgetRenderer el={navEl as any} isPreview={false} mergedStyles={{}} pages={PAGES as any} homePageId="home" />],
    ["MegaMenu", () => <MegaMenuWidgetRenderer el={{ id: "mega", type: "mega-menu", content: "", styles: {} } as any} isPreview mergedStyles={{}} pages={PAGES as any} />],
    ["OffCanvas", () => <OffCanvasWidgetRenderer el={{ id: "oc", type: "off-canvas", content: "", styles: {} } as any} _isPreview mergedStyles={{}} renderChildren={() => null} />],
  ])("%s removes every document listener it added", (_label, make) => {
    const unbalanced = track();
    const view = render(make());
    view.unmount();
    expect(unbalanced()).toEqual([]);
  });
});
