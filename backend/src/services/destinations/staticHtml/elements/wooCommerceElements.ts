import type { StaticElementContext } from "../elementContext.js";
import { escapeHtml } from "../htmlSafety.js";

// WooCommerce elements (wc-*), including the builders that render their children recursively.
// Each function is one case of renderElementToHtml (staticHtml/renderElement.ts), moved verbatim from
// staticCompiler.ts.

// case "wc-product-title"
export function renderWcProductTitleElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  return `<h2 class="fs-wc-title"${idAttr}${classAttr}${styleAttr}>${escapeHtml(el.content || el.productTitle || "Product Title")}</h2>`;
}

// case "wc-product-price"
export function renderWcProductPriceElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  return `<div class="fs-wc-price"${idAttr}${classAttr}${styleAttr}><span class="fs-price">${escapeHtml(el.content || el.productPrice || "$99.00")}</span></div>`;
}

// case "wc-product-images"
export function renderWcProductImagesElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  return `<div class="fs-wc-images"${idAttr}${classAttr}${styleAttr}><img src="${escapeHtml(el.src || el.productImage || "/placeholder.jpg")}" alt="Product" /></div>`;
}

// case "wc-add-to-cart"
export function renderWcAddToCartElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  return `<div class="fs-wc-add-to-cart"${idAttr}${classAttr}${styleAttr}><button type="button" class="btn btn-cart btn-add-to-cart" data-product-id="${escapeHtml(el.productId || "default")}">${escapeHtml(el.content || el.buttonText || "Add to Cart")}</button></div>`;
}

// case "wc-product-rating"
export function renderWcProductRatingElement({ styleAttr, classAttr, idAttr }: StaticElementContext): string {
  return `<div class="fs-wc-rating"${idAttr}${classAttr}${styleAttr}><span class="fs-stars">★★★★★</span></div>`;
}

// case "wc-builder", "wc-product"
export function renderWcBuilderElement({ el, allPages, websiteId, styleAttr, classAttr, idAttr, renderElementToHtml }: StaticElementContext): string {
  const childMarkup = Array.isArray(el.children)
    ? el.children.map((c: any) => renderElementToHtml(c, allPages, websiteId)).join("\n")
    : "";
  return `<div class="fs-wc-product-builder"${idAttr}${classAttr}${styleAttr}>${childMarkup}</div>`;
}

// case "wc-product-stock"
export function renderWcProductStockElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const threshold = el.stockThreshold ?? 5;
  const inStockLabel = el.inStockLabel || "In Stock (Ready to Ship)";
  const inStockColor = el.inStockColor || "#10b981";
  return `<div class="fs-wc-stock"${idAttr}${classAttr}${styleAttr}><span class="fs-stock-badge" style="color: ${escapeHtml(inStockColor)};">✓ ${escapeHtml(inStockLabel)}</span></div>`;
}

// case "wc-product-meta"
export function renderWcProductMetaElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const showSku = el.metaShowSku !== false;
  const showCat = el.metaShowCategory !== false;
  const showTags = el.metaShowTags !== false;
  const sep = el.metaSeparator || " | ";
  const parts: string[] = [];
  if (showSku) parts.push(`<span><strong>SKU:</strong> FS-9000</span>`);
  if (showCat) parts.push(`<span><strong>Category:</strong> Electronics</span>`);
  if (showTags) parts.push(`<span><strong>Tags:</strong> Audio, Pro</span>`);
  return `<div class="fs-wc-meta"${idAttr}${classAttr}${styleAttr}>${parts.join(`<span class="sep">${escapeHtml(sep)}</span>`)}</div>`;
}

// case "wc-product-content"
export function renderWcProductContentElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const content = el.productDescriptionOverride || el.content || "Detailed product description explaining features, craftsmanship, technical specifications, and manufacturer highlights.";
  return `<div class="fs-wc-content"${idAttr}${classAttr}${styleAttr}><p>${escapeHtml(content)}</p></div>`;
}

// case "wc-short-description"
export function renderWcShortDescriptionElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const shortDesc = el.productDescriptionOverride || el.content || "Premium flagship edition crafted with precision engineering and high-fidelity acoustics.";
  return `<div class="fs-wc-short-desc"${idAttr}${classAttr}${styleAttr}><p>${escapeHtml(shortDesc)}</p></div>`;
}

// case "wc-product-data-tabs"
export function renderWcProductDataTabsElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const tabs = Array.isArray(el.tabsData) && el.tabsData.length > 0 ? el.tabsData : [
    { id: "desc", title: "Description", content: "Comprehensive specifications and user guide." },
    { id: "info", title: "Additional Information", content: "Weight: 250g | Dimensions: 18x16x8cm" },
    { id: "reviews", title: "Reviews (24)", content: "Customer satisfaction rating 4.9/5 stars." },
  ];
  return `<div class="fs-wc-tabs"${idAttr}${classAttr}${styleAttr}>
        <div class="fs-tabs-nav">${tabs.map((t: any, i: number) => `<button class="tab-btn${i === 0 ? " active" : ""}">${escapeHtml(t.title)}</button>`).join("")}</div>
        <div class="fs-tabs-body"><div class="tab-pane">${escapeHtml(tabs[0]?.content || "")}</div></div>
      </div>`;
}

// case "wc-additional-info"
export function renderWcAdditionalInfoElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const attrs = Array.isArray(el.additionalInfoAttributes) && el.additionalInfoAttributes.length > 0 ? el.additionalInfoAttributes : [
    { key: "Weight", value: "250g" },
    { key: "Dimensions", value: "18 x 16 x 8 cm" },
    { key: "Warranty", value: "2 Years Limited" },
    { key: "Material", value: "Aviation Aluminum & Leather" },
  ];
  return `<table class="fs-wc-attributes"${idAttr}${classAttr}${styleAttr}>
        <tbody>${attrs.map((a: any) => `<tr><th>${escapeHtml(a.key)}</th><td>${escapeHtml(a.value)}</td></tr>`).join("")}</tbody>
      </table>`;
}

// case "wc-related-products", "wc-upsells"
export function renderWcRelatedProductsElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const isUpsell = el.type === "wc-upsells";
  const heading = isUpsell ? "Complete the Experience" : "Related Products";
  const limit = el.relatedLimit || el.upsellsLimit || 4;
  const cols = el.relatedColumns || el.upsellsColumns || 4;
  const dummyProducts = [
    { title: "Wireless Noise-Cancelling Earbuds", price: "$149.00", img: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500" },
    { title: "Hi-Fi DAC Headphone Amp", price: "$199.00", img: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=500" },
    { title: "Braided Silver Audio Cable", price: "$39.00", img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500" },
    { title: "Studio Aluminum Headphone Stand", price: "$49.00", img: "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=500" },
  ].slice(0, limit);
  return `<section class="fs-wc-grid-section fs-wc-${isUpsell ? "upsells" : "related"}"${idAttr}${classAttr}${styleAttr}>
        <h3 class="fs-wc-section-title">${escapeHtml(heading)}</h3>
        <div class="fs-wc-grid" style="display: grid; grid-template-columns: repeat(${cols}, 1fr); gap: 20px;">
          ${dummyProducts.map((p) => `<div class="fs-wc-card"><img src="${escapeHtml(p.img)}" alt="${escapeHtml(p.title)}" loading="lazy" /><h4 class="title">${escapeHtml(p.title)}</h4><div class="price">${escapeHtml(p.price)}</div></div>`).join("")}
        </div>
      </section>`;
}

// case "wc-products", "wc-product-archive", "wc-shop-layouts"
export function renderWcProductsElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const cols = el.shopLayoutColumns || 3;
  const gap = el.shopLayoutGap ?? 24;
  const count = el.productsPerPage || 6;
  const items = Array.from({ length: Math.min(count, 8) }).map((_, i) => ({
    id: `prod-${i + 1}`,
    title: `Store Product #${i + 1}`,
    price: `$${(49 + i * 20).toFixed(2)}`,
    img: `https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500`,
  }));
  return `<div class="fs-wc-catalog"${idAttr}${classAttr}${styleAttr}>
        <div class="fs-wc-catalog-grid" style="display: grid; grid-template-columns: repeat(${cols}, 1fr); gap: ${gap}px;">
          ${items.map((it) => `<div class="fs-wc-product-card" data-product-id="${it.id}">
            <img src="${escapeHtml(it.img)}" alt="${escapeHtml(it.title)}" loading="lazy" />
            <h3>${escapeHtml(it.title)}</h3>
            <div class="price">${escapeHtml(it.price)}</div>
            <button type="button" class="btn btn-cart btn-add-to-cart" data-product-id="${it.id}">Add to Cart</button>
          </div>`).join("")}
        </div>
      </div>`;
}

// case "wc-custom-add-to-cart"
export function renderWcCustomAddToCartElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const pid = el.customAddToCartProductId || "custom-product";
  const label = el.content || el.buttonText || "Buy Now";
  return `<div class="fs-wc-custom-btn"${idAttr}${classAttr}${styleAttr}>
        <button type="button" class="btn btn-primary btn-add-to-cart" data-product-id="${escapeHtml(pid)}">${escapeHtml(label)}</button>
      </div>`;
}

// case "wc-product-categories"
export function renderWcProductCategoriesElement({ styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const cats = ["Headphones (12)", "Amplifiers & DACs (6)", "Accessories & Cables (18)", "Audio Interfaces (4)"];
  return `<div class="fs-wc-categories"${idAttr}${classAttr}${styleAttr}>
        <h4>Product Categories</h4>
        <ul>${cats.map((c) => `<li><a href="#">${escapeHtml(c)}</a></li>`).join("")}</ul>
      </div>`;
}

// case "wc-menu-cart"
export function renderWcMenuCartElement({ styleAttr, classAttr, idAttr }: StaticElementContext): string {
  return `<div class="fs-wc-menu-cart"${idAttr}${classAttr}${styleAttr}>
        <a href="cart.html" class="fs-menu-cart-link">
          <span class="icon">🛒</span>
          <span class="fs-cart-count">0</span>
        </a>
      </div>`;
}

// case "wc-cart"
export function renderWcCartElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const btnLabel = el.cartButtonLabel || "Proceed to Checkout";
  const accent = el.cartAccentColor || "#2563eb";
  return `<div class="fs-wc-cart-view"${idAttr}${classAttr}${styleAttr}>
        <div class="fs-cart-table-wrapper">
          <table class="fs-cart-table">
            <thead><tr><th>Product</th><th>Price</th><th>Quantity</th><th>Total</th><th></th></tr></thead>
            <tbody id="fs-cart-tbody">
              <tr><td colspan="5" style="text-align: center; padding: 24px;">Your cart is currently empty.</td></tr>
            </tbody>
          </table>
        </div>
        <div class="fs-cart-summary">
          <div class="subtotal-row"><strong>Subtotal:</strong> <span id="fs-cart-subtotal">$0.00</span></div>
          <a href="checkout.html" class="btn btn-checkout" style="background-color: ${escapeHtml(accent)}; color: #fff;">${escapeHtml(btnLabel)}</a>
        </div>
      </div>`;
}

// case "wc-checkout"
export function renderWcCheckoutElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const btnLabel = el.checkoutButtonLabel || "Place Order";
  const accent = el.checkoutAccentColor || "#2563eb";
  return `<div class="fs-wc-checkout-view"${idAttr}${classAttr}${styleAttr}>
        <form id="fs-checkout-form" class="fs-checkout-form">
          <div class="form-cols" style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
            <div class="billing-col">
              <h3>Billing Information</h3>
              <input type="text" name="customerName" placeholder="Full Name" required />
              <input type="email" name="customerEmail" placeholder="Email Address" required />
              <input type="text" name="address" placeholder="Street Address" required />
              <input type="text" name="city" placeholder="City" required />
            </div>
            <div class="order-col">
              <h3>Your Order</h3>
              <div id="fs-checkout-items">Items from cart will appear here</div>
              <button type="submit" class="btn btn-order" style="background-color: ${escapeHtml(accent)}; color: #fff; width: 100%; margin-top: 16px;">${escapeHtml(btnLabel)}</button>
            </div>
          </div>
        </form>
      </div>`;
}

// case "wc-my-account"
export function renderWcMyAccountElement({ styleAttr, classAttr, idAttr }: StaticElementContext): string {
  return `<div class="fs-wc-account"${idAttr}${classAttr}${styleAttr}>
        <h3>My Account</h3>
        <p>Login or register to view recent orders, manage shipping and billing addresses, and edit account details.</p>
      </div>`;
}

// case "wc-purchase-summary"
export function renderWcPurchaseSummaryElement({ styleAttr, classAttr, idAttr }: StaticElementContext): string {
  return `<div class="fs-wc-order-summary"${idAttr}${classAttr}${styleAttr}>
        <div class="fs-alert fs-alert-success">Thank you. Your order has been received.</div>
      </div>`;
}

// case "wc-notices"
export function renderWcNoticesElement({ styleAttr, classAttr, idAttr }: StaticElementContext): string {
  return `<div class="fs-wc-notices"${idAttr}${classAttr}${styleAttr} id="fs-store-notices"></div>`;
}

// case "wc-product-page-templates", "wc-product-archive-templates"
export function renderWcProductPageTemplatesElement({ el, allPages, websiteId, styleAttr, classAttr, idAttr, renderElementToHtml }: StaticElementContext): string {
  const childMarkup = Array.isArray(el.children)
    ? el.children.map((c: any) => renderElementToHtml(c, allPages, websiteId)).join("\n")
    : "";
  return `<div class="fs-wc-template-wrapper"${idAttr}${classAttr}${styleAttr}>${childMarkup}</div>`;
}

// case "wc-product-addons"
export function renderWcProductAddonsElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const addons = Array.isArray(el.productAddons) && el.productAddons.length > 0 ? el.productAddons : [
    { id: "addon-gift", label: "Luxury Gift Wrapping & Ribbon", type: "checkbox", priceAdjustment: 4.99 },
    { id: "addon-warranty", label: "2-Year Extended Hardware Protection", type: "checkbox", priceAdjustment: 19.99 },
    { id: "addon-engrave", label: "Custom Laser Name Engraving", type: "text", priceAdjustment: 9.99 },
    { id: "addon-cable", label: "Audio Cable Upgrade", type: "select", priceAdjustment: 14.99, options: ["Braided Silver 3.5mm (+$14.99)", "Balanced 4.4mm (+$24.99)"] },
  ];
  return `<div class="fs-wc-addons-card"${idAttr}${classAttr}${styleAttr}>
        <h4 class="fs-addons-title">Customizable Product Options & Add-Ons</h4>
        <div class="fs-addons-list">
          ${addons.map((a: any) => {
        const adj = Number(a.priceAdjustment || 0);
        const adjStr = adj > 0 ? ` (+₹/${adj.toFixed(2)})` : "";
        if (a.type === "checkbox") {
          return `<label class="fs-addon-field"><input type="checkbox" name="fs_addon_${escapeHtml(a.id)}" data-price="${adj}" /> ${escapeHtml(a.label)}${escapeHtml(adjStr)}</label>`;
        }
        if (a.type === "select") {
          const opts = Array.isArray(a.options) ? a.options : ["Standard (+$0.00)"];
          return `<div class="fs-addon-field"><label>${escapeHtml(a.label)}${escapeHtml(adjStr)}</label><select name="fs_addon_${escapeHtml(a.id)}">${opts.map((o: string) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("")}</select></div>`;
        }
        return `<div class="fs-addon-field"><label>${escapeHtml(a.label)}${escapeHtml(adjStr)}</label><input type="text" name="fs_addon_${escapeHtml(a.id)}" placeholder="Enter custom detail..." /></div>`;
      }).join("")}
        </div>
      </div>`;
}
