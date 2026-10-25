import test from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "./load-typescript.mjs";

test("price-table factory retains classic default and exposes advanced preset", async () => {
  const source = await loadTypeScript("frontend/src/pages/editor/defaults/index.ts", {
    "../utils": { generateId: () => "price_1" },
    "../navigation/navigationDefaults": { getNavigationDefaultElement: () => null },
  });
  const classic = source.createDefaultElement("price-table");
  const advanced = source.createDefaultElement("price-table", { priceTablePreset: "advanced" });
  const directAdvanced = source.createAdvancedPriceTableDefault("price_2");

  assert.equal(classic.type, "price-table");
  assert.equal(advanced.type, "price-table");
  assert.equal(directAdvanced.type, "price-table");
  assert.equal(classic.id, "price_1");
  assert.equal(advanced.id, "price_1");
  assert.equal(directAdvanced.id, "price_2");
  assert.equal(classic.pricingPlans.length, 3);
  assert.equal(advanced.pricingPlans.length, 3);
  assert.ok(advanced.pricingBtnHoverBg, "advanced preset must preserve hover styling");
  assert.ok(advanced.pricingPlans.some((plan) => plan.isRecommended), "advanced recommendation badges retained");
  assert.notEqual(classic.pricingPlans[0].id, advanced.pricingPlans[0].id);
});
