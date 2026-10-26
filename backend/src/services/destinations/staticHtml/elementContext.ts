// What every element renderer receives: the element, the site's pages, the website id, the values the
// dispatcher computes once per element (styles / class / id attributes) and the dispatcher itself for
// rendering children (passed in rather than imported, so the renderers do not import the dispatcher).
export interface StaticElementContext {
  el: any;
  allPages: any[];
  websiteId?: string;
  styleObj: any;
  inlineCss: string;
  styleAttr: string;
  classAttr: string;
  idAttr: string;
  renderElementToHtml: (el: any, allPages: any[], websiteId?: string) => string;
}
