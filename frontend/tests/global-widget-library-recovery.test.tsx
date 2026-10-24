// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  retry: vi.fn(),
}));

vi.mock("../src/features/global-widget/hooks/useGlobalWidgets", () => ({
  useGlobalWidgets: () => ({
    globalWidgets: [],
    filteredWidgets: [],
    isLoading: false,
    error: "The server could not load your widgets.",
    searchQuery: "",
    setSearchQuery: vi.fn(),
    previewWidget: null,
    setPreviewWidget: vi.fn(),
    removeWidget: vi.fn(),
    refetchGlobalWidgets: mocks.retry,
  }),
}));

import { GlobalWidgetLibrary } from "../src/features/global-widget/components/GlobalWidgetLibrary";

afterEach(() => {
  cleanup();
  mocks.retry.mockReset();
});

describe("Global Widget Library error recovery", () => {
  it("exposes the real loading failure instead of showing an empty-library success", () => {
    render(<GlobalWidgetLibrary apiUrl="/api" onInsertWidget={vi.fn()} />);
    expect(screen.getByRole("alert").textContent)
      .toContain("The server could not load your widgets.");
    expect(screen.queryByText("No Global Widgets yet.")).toBeNull();
  });

  it("lets the user retry a failed server request", () => {
    render(<GlobalWidgetLibrary apiUrl="/api" onInsertWidget={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Retry loading widgets" }));
    expect(mocks.retry).toHaveBeenCalledOnce();
  });
});
