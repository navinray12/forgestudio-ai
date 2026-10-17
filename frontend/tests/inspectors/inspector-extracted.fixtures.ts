/**
 * Inputs for the extracted-inspector characterization (inspector-extracted.golden.json). Each case is
 * [case name, exported component name, element]. Changing anything here invalidates the golden file.
 * Group A and B are the 20 inspectors with no dependencies on other code in DynamicWidgetInspectors.tsx.
 */
const el = (id: string, type: string, extra: Record<string, unknown> = {}) => ({ id, type, content: "", styles: {}, ...extra });

export const EXTRACTED_GROUP_A: Array<[string, string, Record<string, unknown>]> = [
  ["countdown", "CountdownWidgetInspector", el("x-countdown", "countdown")],
  ["lottie", "LottieWidgetInspector", el("x-lottie", "lottie")],
  ["code-highlight", "CodeHighlightWidgetInspector", el("x-code", "code-highlight", { content: "const a = 1;" })],
  ["animated-text", "AnimatedTextWidgetInspector", el("x-anim", "animated-headline")],
  ["blockquote", "BlockquoteWidgetInspector", el("x-quote", "blockquote", { content: "Quote" })],
  ["counter", "CounterWidgetInspector", el("x-counter", "counter")],
  ["progress-bar", "ProgressBarWidgetInspector", el("x-progress", "progress-bar")],
  ["rating", "RatingWidgetInspector", el("x-rating", "rating")],
  ["alert", "AlertWidgetInspector", el("x-alert", "alert", { content: "Heads up" })],
  ["spacer", "SpacerWidgetInspector", el("x-spacer", "spacer")],
];

export const EXTRACTED_GROUP_B: Array<[string, string, Record<string, unknown>]> = [
  ["divider", "DividerWidgetInspector", el("x-divider", "divider")],
  ["custom-svg", "CustomSVGWidgetInspector", el("x-svg", "custom-svg")],
  ["google-maps", "GoogleMapsWidgetInspector", el("x-maps", "google-maps")],
  ["icon-box", "IconBoxWidgetInspector", el("x-iconbox", "icon-box")],
  ["payment", "PaymentWidgetInspector", el("x-pay", "payment")],
  ["login", "LoginWidgetInspector", el("x-login", "login")],
  ["toc", "TOCWidgetInspector", el("x-toc", "table-of-contents")],
  ["scroll-snap", "ScrollSnapInspector", el("x-snap", "container")],
  ["masonry", "MasonryLayoutInspector", el("x-masonry", "container")],
  ["wp-legacy", "WpLegacyWidgetInspector", el("x-wp", "wp-legacy")],
];
