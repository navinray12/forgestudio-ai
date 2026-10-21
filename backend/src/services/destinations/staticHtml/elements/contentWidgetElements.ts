import type { StaticElementContext } from "../elementContext.js";
import { escapeHtml } from "../htmlSafety.js";
import { resolveStaticHtmlHref } from "../links.js";

// Content widgets: slides, pricing tables, price lists, galleries, flip boxes, calls to action,
// countdowns, reviews, carousels, social / share icons, counters and progress bars.
// Each function is one case of renderElementToHtml (staticHtml/renderElement.ts), moved verbatim from
// staticCompiler.ts.

// case "slides"
export function renderSlidesElement({ el, allPages, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const slides = Array.isArray(el.slides) ? el.slides : [];
  const slidesHtml = slides.map((s: any) => {
    const bgStyle = s.bgImage || s.image ? ` style="background-image: url('${escapeHtml(s.bgImage || s.image)}'); background-size: cover; background-position: center;"` : "";
    const title = s.title ? `<h3 class="fs-slide-title">${escapeHtml(s.title)}</h3>` : "";
    const desc = s.description || s.subtitle ? `<p class="fs-slide-desc">${escapeHtml(s.description || s.subtitle)}</p>` : "";
    const btn = s.buttonText ? `<a href="${escapeHtml(resolveStaticHtmlHref(s.buttonUrl || s.buttonLink, allPages))}" class="btn fs-slide-btn">${escapeHtml(s.buttonText)}</a>` : "";
    return `<div class="fs-slide"${bgStyle}>${title}${desc}${btn}</div>`;
  }).join("\n");
  return `<div class="fs-slider"${idAttr}${classAttr}${styleAttr}>\n<div class="fs-slides-wrapper">\n${slidesHtml}\n</div>\n</div>`;
}

// case "price-table", "pricing"
export function renderPriceTableElement({ el, allPages, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const plans = Array.isArray(el.pricingPlans) ? el.pricingPlans : (Array.isArray(el.pricePlans) ? el.pricePlans : (Array.isArray(el.items) ? el.items : []));
  const plansHtml = plans.map((p: any) => {
    const badge = p.badge || p.ribbon ? `<span class="fs-price-badge">${escapeHtml(p.badge || p.ribbon)}</span>` : "";
    const features = Array.isArray(p.features) ? p.features.map((f: any) => {
      const isInc = f.included !== false;
      const text = typeof f === "string" ? f : f.text;
      return `<li class="${isInc ? "fs-included" : "fs-excluded"}">${isInc ? "✓" : "✕"} ${escapeHtml(text || "")}</li>`;
    }).join("\n") : "";
    const btn = p.buttonText ? `<a href="${escapeHtml(resolveStaticHtmlHref(p.buttonUrl || p.buttonHref || "#", allPages))}" class="btn fs-plan-btn">${escapeHtml(p.buttonText)}</a>` : "";
    return `<div class="fs-price-card${p.isPopular || p.isFeatured ? " fs-featured" : ""}">
          ${badge}
          <h3 class="fs-plan-name">${escapeHtml(p.name || p.title || "Plan")}</h3>
          <div class="fs-price-val">
            <span class="fs-currency">${escapeHtml(p.currency || "$")}</span>
            <span class="fs-amount">${escapeHtml(p.price || "0")}</span>
            <span class="fs-period">${escapeHtml(p.period || "/mo")}</span>
          </div>
          ${p.description ? `<p class="fs-plan-desc">${escapeHtml(p.description)}</p>` : ""}
          <ul class="fs-plan-features">${features}</ul>
          ${btn}
        </div>`;
  }).join("\n");
  return `<div class="fs-pricing-table"${idAttr}${classAttr}${styleAttr}>\n${plansHtml}\n</div>`;
}

// case "price-list"
export function renderPriceListElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const items = Array.isArray(el.priceListItems) ? el.priceListItems : (Array.isArray(el.items) ? el.items : []);
  const itemsHtml = items.map((it: any) => `
        <div class="fs-price-list-item">
          ${it.image ? `<img src="${escapeHtml(it.image)}" alt="${escapeHtml(it.title || "")}" class="fs-pli-img" />` : ""}
          <div class="fs-pli-content">
            <div class="fs-pli-header">
              <span class="fs-pli-title">${escapeHtml(it.title || "")}</span>
              <span class="fs-pli-dots"></span>
              <span class="fs-pli-price">${escapeHtml(it.price || "")}</span>
            </div>
            ${it.description ? `<p class="fs-pli-desc">${escapeHtml(it.description)}</p>` : ""}
          </div>
        </div>
      `).join("\n");
  return `<div class="fs-price-list"${idAttr}${classAttr}${styleAttr}>\n${itemsHtml}\n</div>`;
}

// case "gallery", "basic-gallery"
export function renderGalleryElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const images = Array.isArray(el.galleryImages) ? el.galleryImages : (Array.isArray(el.basicGalleryImages) ? el.basicGalleryImages : (Array.isArray(el.images) ? el.images : []));
  const cols = el.basicGalleryColumns || 3;
  const imagesHtml = images.map((img: any) => `
        <figure class="fs-gallery-item">
          <img src="${escapeHtml(img.url || img.src || "")}" alt="${escapeHtml(img.alt || img.caption || "")}" loading="lazy" />
          ${img.caption ? `<figcaption>${escapeHtml(img.caption)}</figcaption>` : ""}
        </figure>
      `).join("\n");
  return `<div class="fs-gallery fs-cols-${cols}"${idAttr}${classAttr}${styleAttr}>\n${imagesHtml}\n</div>`;
}

// case "flip-box"
export function renderFlipBoxElement({ el, allPages, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const frontTitle = el.flipFrontTitle || el.title || "Front Title";
  const frontDesc = el.flipFrontDesc || el.content || "";
  const backTitle = el.flipBackTitle || "Back Title";
  const backDesc = el.flipBackDesc || "";
  const btn = el.flipButtonText ? `<a href="${escapeHtml(resolveStaticHtmlHref(el.flipButtonUrl, allPages))}" class="btn fs-flip-btn">${escapeHtml(el.flipButtonText)}</a>` : "";
  return `<div class="fs-flip-box"${idAttr}${classAttr}${styleAttr}>
        <div class="fs-flip-box-inner">
          <div class="fs-flip-front">
            ${el.iconName ? `<span class="fs-flip-icon">${escapeHtml(el.iconName)}</span>` : ""}
            <h4 class="fs-flip-title">${escapeHtml(frontTitle)}</h4>
            <p class="fs-flip-desc">${escapeHtml(frontDesc)}</p>
          </div>
          <div class="fs-flip-back">
            <h4 class="fs-flip-title">${escapeHtml(backTitle)}</h4>
            <p class="fs-flip-desc">${escapeHtml(backDesc)}</p>
            ${btn}
          </div>
        </div>
      </div>`;
}

// case "call-to-action", "cta"
export function renderCallToActionElement({ el, allPages, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const heading = el.title || el.heading || "Ready to build?";
  const desc = el.ctaDesc || el.content || "";
  const btn = el.buttonText ? `<a href="${escapeHtml(resolveStaticHtmlHref(el.buttonUrl || el.href, allPages))}" class="btn fs-cta-btn">${escapeHtml(el.buttonText)}</a>` : "";
  const img = el.image || el.src ? `<img src="${escapeHtml(el.image || el.src)}" alt="${escapeHtml(heading)}" class="fs-cta-img" />` : "";
  return `<div class="fs-cta"${idAttr}${classAttr}${styleAttr}>
        <div class="fs-cta-body">
          <h3 class="fs-cta-title">${escapeHtml(heading)}</h3>
          ${desc ? `<p class="fs-cta-desc">${escapeHtml(desc)}</p>` : ""}
          ${btn}
        </div>
        ${img}
      </div>`;
}

// case "countdown"
export function renderCountdownElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const targetDate = el.countdownTargetDate || el.targetDate || "";
  return `<div class="fs-countdown"${idAttr}${classAttr}${styleAttr} data-target="${escapeHtml(targetDate)}">
        <div class="fs-countdown-box"><span class="fs-countdown-num">00</span><span class="fs-countdown-lbl">${escapeHtml(el.countdownDaysLabel || "Days")}</span></div>
        <div class="fs-countdown-box"><span class="fs-countdown-num">00</span><span class="fs-countdown-lbl">${escapeHtml(el.countdownHoursLabel || "Hours")}</span></div>
        <div class="fs-countdown-box"><span class="fs-countdown-num">00</span><span class="fs-countdown-lbl">${escapeHtml(el.countdownMinutesLabel || "Mins")}</span></div>
        <div class="fs-countdown-box"><span class="fs-countdown-num">00</span><span class="fs-countdown-lbl">${escapeHtml(el.countdownSecondsLabel || "Secs")}</span></div>
      </div>`;
}

// case "reviews"
export function renderReviewsElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const reviews = Array.isArray(el.reviewItems) ? el.reviewItems : (Array.isArray(el.reviews) ? el.reviews : []);
  const reviewsHtml = reviews.map((r: any) => {
    const rating = Math.min(Math.max(r.rating || 5, 1), 5);
    return `<div class="fs-review-card">
          <div class="fs-review-header">
            ${r.avatar || r.image ? `<img src="${escapeHtml(r.avatar || r.image)}" alt="${escapeHtml(r.author || r.name || "")}" class="fs-review-avatar" />` : ""}
            <div>
              <div class="fs-review-author">${escapeHtml(r.author || r.name || "Customer")}</div>
              <div class="fs-review-stars">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</div>
            </div>
          </div>
          <p class="fs-review-text">${escapeHtml(r.text || r.content || r.review || "")}</p>
        </div>`;
  }).join("\n");
  return `<div class="fs-reviews-grid"${idAttr}${classAttr}${styleAttr}>\n${reviewsHtml}\n</div>`;
}

// case "media-carousel", "testimonial-carousel", "nested-carousel", "loop-carousel", "image-carousel"
export function renderMediaCarouselElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const items = Array.isArray(el.mediaCarouselItems) ? el.mediaCarouselItems :
    (Array.isArray(el.testimonialCarouselItems) ? el.testimonialCarouselItems :
    (Array.isArray(el.imageCarouselItems) ? el.imageCarouselItems :
    (Array.isArray(el.items) ? el.items : [])));
  const itemsHtml = items.map((it: any) => `
        <div class="fs-carousel-slide">
          ${it.image || it.url ? `<img src="${escapeHtml(it.image || it.url)}" alt="${escapeHtml(it.title || it.name || "")}" />` : ""}
          ${it.quote || it.content ? `<blockquote class="fs-carousel-quote">${escapeHtml(it.quote || it.content)}</blockquote>` : ""}
          ${it.author || it.name ? `<cite class="fs-carousel-author">${escapeHtml(it.author || it.name)}</cite>` : ""}
        </div>
      `).join("\n");
  return `<div class="fs-carousel"${idAttr}${classAttr}${styleAttr}>\n<div class="fs-carousel-track">\n${itemsHtml}\n</div>\n</div>`;
}

// case "social-icons", "share-buttons"
export function renderSocialIconsElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const networks = Array.isArray(el.shareNetworks) ? el.shareNetworks : (Array.isArray(el.networks) ? el.networks : (Array.isArray(el.items) ? el.items : []));
  const iconsHtml = networks.map((net: any) => `
        <a href="${escapeHtml(net.url || "#")}" target="_blank" rel="noopener noreferrer" class="fs-social-btn fs-${escapeHtml(net.network || net.type || "link")}">
          <span>${escapeHtml(net.network || net.label || "Share")}</span>
        </a>
      `).join("\n");
  return `<div class="fs-social-icons"${idAttr}${classAttr}${styleAttr}>\n${iconsHtml}\n</div>`;
}

// case "counter", "animated-counter"
export function renderCounterElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const prefix = el.counterPrefix || "";
  const val = el.counterEndNumber ?? el.content ?? 100;
  const suffix = el.counterSuffix || "+";
  const title = el.counterTitle || el.title || "";
  return `<div class="fs-counter"${idAttr}${classAttr}${styleAttr}>
        <div class="fs-counter-num">${escapeHtml(prefix)}<span class="fs-counter-val">${escapeHtml(String(val))}</span>${escapeHtml(suffix)}</div>
        ${title ? `<div class="fs-counter-title">${escapeHtml(title)}</div>` : ""}
      </div>`;
}

// case "progress-bar"
export function renderProgressBarElement({ el, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const pct = Math.min(Math.max(el.percentage || 80, 0), 100);
  const title = el.title || el.content || "";
  return `<div class="fs-progress-wrapper"${idAttr}${classAttr}${styleAttr}>
        ${title ? `<div class="fs-progress-header"><span>${escapeHtml(title)}</span><span>${pct}%</span></div>` : ""}
        <div class="fs-progress-track">
          <div class="fs-progress-fill" style="width: ${pct}%;"></div>
        </div>
      </div>`;
}
