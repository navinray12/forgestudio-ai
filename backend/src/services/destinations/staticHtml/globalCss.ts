import {
  compileDesignSystemCss,
  validateVariables,
  validateClasses,
} from "../../tokens/designToken.service.js";

// styles.css for the static bundle (global styles and design tokens). Moved verbatim from staticCompiler.ts.

export function generateGlobalCss(websiteData: any): string {
  const safeData = websiteData || {};
  const globalStyles = safeData.globalStyles || safeData.editorData?.globalStyles || {};
  const colors = globalStyles.colors || {};
  const typography = globalStyles.typography || {};

  const globalVars = validateVariables(safeData.globalVariables || safeData.editorData?.globalVariables || []);
  const globalClasses = validateClasses(safeData.globalClasses || safeData.editorData?.globalClasses || []);
  const designSystemCss = compileDesignSystemCss(globalVars, globalClasses);

  return `${designSystemCss ? designSystemCss + "\n\n" : ""}/* ForgeStudio Generated CSS */
:root {
  --primary-color: ${colors.primary || "#3b82f6"};
  --secondary-color: ${colors.secondary || "#10b981"};
  --background-color: ${colors.background || "#ffffff"};
  --text-color: ${colors.text || "#1f2937"};
  --font-family: ${typography.fontFamily || "system-ui, -apple-system, sans-serif"};
  --font-size-base: ${typography.fontSize || "16px"};
  --line-height-base: ${typography.lineHeight || "1.5"};
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-family);
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
  color: var(--text-color);
  background-color: var(--background-color);
}

a {
  color: var(--primary-color);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

img {
  max-width: 100%;
  height: auto;
  display: block;
}

.page-content {
  min-height: calc(100vh - 120px);
}

.site-header, .site-footer {
  width: 100%;
  padding: 1rem 2rem;
}

.btn {
  display: inline-block;
  padding: 0.625rem 1.25rem;
  background-color: var(--primary-color);
  color: #ffffff;
  border-radius: 6px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  text-decoration: none;
}

/* Pricing Table Widget */
.fs-pricing-table {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.5rem;
  margin: 2rem 0;
}
.fs-price-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 2rem;
  background: #ffffff;
  position: relative;
}
.fs-price-card.fs-featured {
  border-color: var(--primary-color);
  box-shadow: 0 10px 25px -5px rgba(59, 130, 246, 0.15);
}
.fs-price-badge {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: var(--primary-color);
  color: #fff;
  font-size: 0.75rem;
  padding: 0.25rem 0.6rem;
  border-radius: 20px;
  font-weight: bold;
}
.fs-plan-name { font-size: 1.25rem; font-weight: bold; margin-bottom: 0.5rem; }
.fs-price-val { font-size: 2rem; font-weight: 800; margin: 1rem 0; color: #0f172a; }
.fs-plan-features { list-style: none; margin: 1.5rem 0; }
.fs-plan-features li { padding: 0.4rem 0; font-size: 0.9rem; }
.fs-plan-features li.fs-excluded { color: #94a3b8; text-decoration: line-through; }

/* Flip Box Widget */
.fs-flip-box { perspective: 1000px; min-height: 250px; margin: 1rem 0; }
.fs-flip-box-inner { position: relative; width: 100%; height: 100%; transition: transform 0.6s; transform-style: preserve-3d; border-radius: 12px; border: 1px solid #e2e8f0; min-height: 250px; }
.fs-flip-box:hover .fs-flip-box-inner { transform: rotateY(180deg); }
.fs-flip-front, .fs-flip-back { position: absolute; width: 100%; height: 100%; backface-visibility: hidden; padding: 2rem; border-radius: 12px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
.fs-flip-back { background: var(--primary-color); color: #fff; transform: rotateY(180deg); }

/* Gallery Widget */
.fs-gallery { display: grid; gap: 1rem; margin: 2rem 0; }
.fs-cols-2 { grid-template-columns: repeat(2, 1fr); }
.fs-cols-3 { grid-template-columns: repeat(3, 1fr); }
.fs-cols-4 { grid-template-columns: repeat(4, 1fr); }
.fs-gallery-item img { width: 100%; border-radius: 8px; object-fit: cover; }

/* Call To Action */
.fs-cta { display: flex; align-items: center; justify-content: space-between; gap: 2rem; padding: 3rem; background: #f8fafc; border-radius: 16px; border: 1px solid #e2e8f0; margin: 2rem 0; }
.fs-cta-img { max-width: 300px; border-radius: 12px; }

/* Countdown */
.fs-countdown { display: flex; gap: 1rem; margin: 1.5rem 0; }
.fs-countdown-box { display: flex; flex-direction: column; align-items: center; padding: 1rem; background: #f1f5f9; border-radius: 8px; min-width: 70px; }
.fs-countdown-num { font-size: 1.75rem; font-weight: bold; color: #0f172a; }
.fs-countdown-lbl { font-size: 0.75rem; text-transform: uppercase; color: #64748b; }

/* Reviews */
.fs-reviews-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin: 2rem 0; }
.fs-review-card { padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; }
.fs-review-header { display: flex; gap: 0.75rem; align-items: center; margin-bottom: 1rem; }
.fs-review-avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; }
.fs-review-stars { color: #f59e0b; }

/* Social Icons */
.fs-social-icons { display: flex; gap: 0.75rem; flex-wrap: wrap; margin: 1rem 0; }
.fs-social-btn { display: inline-flex; align-items: center; padding: 0.5rem 1rem; border-radius: 6px; background: #f1f5f9; color: #334155; font-size: 0.85rem; font-weight: 600; text-decoration: none; }

/* Breadcrumbs */
.fs-breadcrumbs ol { display: flex; list-style: none; gap: 0.5rem; font-size: 0.85rem; color: #64748b; }

/* Progress Bar */
.fs-progress-wrapper { margin: 1.5rem 0; }
.fs-progress-header { display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: bold; margin-bottom: 0.5rem; }
.fs-progress-track { width: 100%; height: 10px; background: #e2e8f0; border-radius: 5px; overflow: hidden; }
.fs-progress-fill { height: 100%; background: var(--primary-color); border-radius: 5px; }

/* Alert */
.fs-alert { display: flex; gap: 0.75rem; padding: 1rem 1.25rem; border-radius: 8px; margin: 1rem 0; font-size: 0.9rem; }
.fs-alert-info { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; }
.fs-alert-success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
.fs-alert-warning { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
.fs-alert-danger { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }

/* Counter */
.fs-counter { text-align: center; padding: 1.5rem; }
.fs-counter-num { font-size: 2.5rem; font-weight: 800; color: var(--primary-color); }
.fs-counter-title { font-size: 0.9rem; color: #64748b; margin-top: 0.5rem; }

/* Navigation & Search (Module 10) */
.fs-mega-menu { display: flex; justify-content: space-between; align-items: flex-start; padding: 1rem 0; position: relative; }
.fs-mega-categories { display: flex; gap: 2rem; }
.fs-mega-category { position: relative; }
.fs-mega-category-title { font-weight: 600; cursor: pointer; display: inline-block; padding: 0.5rem 0; }
.fs-mega-dropdown { display: flex; gap: 2rem; padding: 1.5rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); margin-top: 0.5rem; }
.fs-mega-col { min-width: 140px; }
.fs-mega-col-title { font-size: 0.85rem; text-transform: uppercase; color: #64748b; margin-bottom: 0.75rem; letter-spacing: 0.05em; }
.fs-mega-links { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.fs-mega-links li a { color: var(--text-color); font-size: 0.95rem; text-decoration: none; }
.fs-mega-links li a:hover { color: var(--primary-color); }
.fs-mega-badge { display: inline-block; padding: 0.15rem 0.4rem; font-size: 0.7rem; background: #e0e7ff; color: #4338ca; border-radius: 4px; font-weight: 600; margin-left: 0.25rem; }
.fs-mega-desc { display: block; font-size: 0.8rem; color: #64748b; margin-top: 0.2rem; }
.fs-mega-promo { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.25rem; max-width: 260px; }
.fs-mega-promo h4 { margin-bottom: 0.5rem; }
.fs-mega-promo p { font-size: 0.85rem; color: #64748b; margin-bottom: 0.75rem; }
.fs-mega-promo-btn { display: inline-block; padding: 0.4rem 0.8rem; font-size: 0.85rem; }

.fs-menu-anchor { display: block; height: 0; visibility: hidden; }

.fs-search-form { display: flex; gap: 0.5rem; align-items: center; max-width: 480px; width: 100%; }
.fs-search-input { flex: 1; padding: 0.5rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.95rem; outline: none; }
.fs-search-input:focus { border-color: var(--primary-color); box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2); }
.fs-search-btn { padding: 0.5rem 1rem; background: var(--primary-color); color: #fff; border: none; border-radius: 6px; font-weight: 500; cursor: pointer; font-size: 0.95rem; }
.fs-search-btn:hover { opacity: 0.9; }

.fs-taxonomy-filter { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 1rem 0; }
.fs-tax-btn { padding: 0.35rem 0.75rem; border: 1px solid #cbd5e1; background: #fff; border-radius: 9999px; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; }
.fs-tax-btn:hover, .fs-tax-btn.active { background: var(--primary-color); color: #fff; border-color: var(--primary-color); }

.fs-post-navigation { display: flex; justify-content: space-between; align-items: center; padding: 1.5rem 0; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; margin: 2rem 0; }
.fs-post-prev a, .fs-post-next a { font-weight: 500; color: var(--primary-color); text-decoration: none; }
.fs-post-prev a:hover, .fs-post-next a:hover { text-decoration: underline; }

/* Custom Page Styles */
${safeData.pageCss || safeData.editorData?.pageCss || ""}
`;
}
