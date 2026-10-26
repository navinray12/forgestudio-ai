/**
 * Deterministic inputs for the shared inspector control tests (shared-controls.golden.json).
 * Shared by the tests and by the one-off capture. Changing anything here invalidates the golden file.
 */
export interface Item { id: string; label: string }

export const ITEMS: Item[] = [
  { id: "a", label: "Alpha" },
  { id: "b", label: "Bravo" },
  { id: "c", label: "Charlie" },
];

/** Props for UniversalItemManager; onUpdate is supplied by the caller. */
export const itemManagerProps = (items: Item[] | undefined) => ({
  title: "Things",
  items,
  createDefaultItem: () => ({ id: "new-item", label: "New" }),
  getItemHeaderLabel: (item: Item, idx: number) => `${idx + 1}. ${item.label}`,
  renderItemFields: (item: Item, _idx: number, updateItem: (u: Partial<Item>) => void) => (
    <input aria-label={`label-${item.id}`} value={item.label} onChange={(e) => updateItem({ label: e.target.value })} />
  ),
});

export const ICON_ELEMENT = { id: "x-icon", type: "button", content: "Go", iconName: "Star", iconSize: 20, iconColor: "#ff0000", iconPosition: "left", styles: {} };
