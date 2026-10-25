/**
 * Inputs for codeImporter.characterization.test.ts. Each case reaches a different branch of the importer:
 * every data-driven component, the standard tags, containers / layout, unknown tags, fragments, scope and
 * props-destructuring defaults, expression evaluation, existing-element merging, the vanilla-DOM fallbacks,
 * syntax errors and the internal-exception path.
 */
export const FIXED_NOW = Date.UTC(2026, 0, 15, 12, 0, 0);

const existing = {
  id: "existing-1",
  type: "container",
  content: "Existing content",
  customId: "existing-custom",
  styles: { color: "red", padding: "4px" },
  layout: { direction: "row", gap: 8 },
  href: "/existing",
  src: "/existing.png",
  alt: "existing alt",
  posts: [{ title: "Existing post" }],
};

export type ImportCase = { code: string; options?: Record<string, unknown> };

export const IMPORT_CASES: Record<string, ImportCase> = {
  empty: { code: "" },
  whitespace: { code: "   \n\t " },
  syntaxError: { code: "export default function A() { return (<div><span>broken</div>); }" },
  noJsx: { code: "const value = 1;\nexport default value;" },
  vanillaPosts: { code: 'const posts = [{"title":"A","excerpt":"B"}];\nconst el = document.createElement("div");' },
  vanillaBadPosts: { code: "const posts = [{title: 'A'}];\nconst el = document.createElement('div');" },
  vanillaGeneric: { code: "const el = document.createElement('section');\nel.textContent = 'x';" },
  vanillaGenericExisting: { code: "const el = document.createElement('section');", options: { existingElement: existing } },
  headingH1: { code: 'export default () => <h1 className="title big" id="hero-title" style={{ fontSize: 32, color: "#111", padding: 10, marginTop: 4 }}>Hello World</h1>;' },
  sectionHeadingLevel: { code: "const C = () => <SectionHeading level=\"H3\">Section</SectionHeading>;" },
  headingNoText: { code: "const C = () => <h4 />;" },
  paragraphExpressions: { code: 'const name = "Ada";\nconst C = () => <p>Hi {"there"} {42} {name} {`tpl`}</p>;' },
  span: { code: "const C = () => <span class=\"note\">Note</span>;" },
  link: { code: 'const C = () => <a href="/pricing" className="btn">Go</a>;' },
  buttonDisabled: { code: "const C = () => <button disabled>Send</button>;" },
  actionButtonTo: { code: 'const C = () => <ActionButton to="/next" />;' },
  image: { code: 'const C = () => <img src="/a.png" alt="An image" style={{ width: 200, height: "50%" }} />;' },
  responsiveImage: { code: "const C = () => <ResponsiveImage />;" },
  video: { code: 'const C = () => <video src="/v.mp4" />;' },
  videoPlayer: { code: "const C = () => <VideoPlayer src={'/p.mp4'} />;" },
  hr: { code: "const C = () => <hr style={{ borderColor: 'gray' }} />;" },
  divider: { code: "const C = () => <Divider />;" },
  nestedContainer: {
    code: `export default function Page() {
  return (
    <section className="hero" style={{ display: "flex", flexDirection: "row", justifyContent: "center", alignItems: "stretch", gap: "12px", flexWrap: "wrap", backgroundColor: "#fff", minHeight: 400 }}>
      <div><h2>Title</h2><p>Body</p></div>
      <main>Only text here</main>
      <article></article>
      <header><nav><a href="/">Home</a></nav></header>
      <footer style={{ gap: 20, direction: "column" }}><aside><span>Side</span></aside></footer>
      <Container><SectionContainer><img src="/x.png" /></SectionContainer></Container>
    </section>
  );
}` },
  textOnlyDiv: { code: "const C = () => <div className=\"wrap\">  Just text  </div>;" },
  emptyDiv: { code: "const C = () => <div />;" },
  unknownTag: { code: "const C = () => <Widget foo=\"bar\"><p>Inside</p>Loose text<Thing /></Widget>;" },
  unknownSelfClosing: { code: "const C = () => <Gizmo />;" },
  fragmentRoot: { code: "const C = () => (<><h3>In fragment</h3><p>after</p></>);" },
  mapChildren: { code: "const items = ['a','b'];\nconst C = () => <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul>;" },
  blogPostsScope: {
    code: `const posts = [{ title: "First", excerpt: "One", image: "/1.png", author: "A", date: "2026-01-01" }, { title: "Second" }];
export default function Blog() { return <BlogPosts columns={2} />; }` },
  postsProps: {
    code: `export default function Blog(props) {
  const { posts = [{ title: "Default post", category: "News" }], columns = 3 } = props;
  return <div className="grid">{posts.map((p) => <article>{p.title}</article>)}</div>;
}` },
  postsAttribute: { code: 'const C = () => <Posts posts={[{ title: "Attr post" }]} />;' },
  pricingTable: { code: 'const C = () => <PricingTable plans={[{ name: "Basic", price: "$9", features: ["a", "b"], isRecommended: true }, { title: "Pro", price: 19 }]} />;' },
  pricingScope: { code: 'const pricingPlans = [{ name: "Scoped", price: "$1" }];\nconst C = () => <div />;' },
  animatedHeadline: { code: 'const C = () => <AnimatedHeadline words={["fast", "simple"]} prefix="We are" />;' },
  animatedScope: { code: 'const words = ["one"];\nconst C = () => <animated-headline />;' },
  flipBox: { code: 'const C = () => <FlipBox frontTitle="Front" backTitle="Back" frontDescription="fd" backDescription="bd" />;' },
  flipAttr: { code: 'const C = () => <div flipFrontTitle="F" />;' },
  countdown: { code: 'const C = () => <CountdownTimer targetDate="2026-12-31T00:00:00Z" />;' },
  countdownNoDate: { code: "const C = () => <Countdown />;" },
  portfolio: { code: 'const C = () => <PortfolioGrid items={[{ title: "Work", image: "/w.png", category: "Web" }, { name: "Other" }]} />;' },
  portfolioScope: { code: 'const portfolioItems = [{ title: "Scoped work" }];\nconst C = () => <Portfolio />;' },
  heroSlides: { code: 'const C = () => <HeroSlides slides={[{ title: "Slide 1", description: "d", image: "/s.png", buttonText: "Go" }, { heading: "Slide 2" }]} />;' },
  slidesScope: { code: 'const slidesItems = [{ title: "S" }];\nconst C = () => <Slideshow />;' },
  gallery: { code: 'const C = () => <PhotoGallery images={["/a.png", { src: "/b.png", alt: "B", caption: "cap" }]} />;' },
  galleryLower: { code: "const C = () => <basic-gallery />;" },
  testimonials: { code: 'const C = () => <TestimonialsSlider testimonials={[{ name: "Ann", text: "Great", role: "CEO", avatar: "/a.png", rating: 5 }, { author: "Bob", quote: "Nice" }]} />;' },
  mediaCarousel: { code: 'const C = () => <MediaCarousel mediaCarouselItems={[{ src: "/m.png", caption: "M" }]} />;' },
  imageCarouselLower: { code: "const C = () => <image-carousel />;" },
  reviews: { code: 'const C = () => <CustomerReviews reviews={[{ name: "R", rating: 4, text: "ok" }, { author: "Q" }]} />;' },
  priceList: { code: 'const C = () => <PriceList priceListItems={[{ title: "Item", price: "$5", description: "d" }]} />;' },
  contactForm: { code: 'const C = () => <ContactForm fields={[{ label: "Name", type: "text", required: true }, { name: "email", type: "email" }]} />;' },
  formLower: { code: "const C = () => <form><input /></form>;" },
  navMenu: { code: 'const C = () => <NavMenu navMenuItems={[{ label: "Home", url: "/" }, { title: "About", href: "/about", children: [{ label: "Team" }] }]} />;' },
  megaMenuLower: { code: "const C = () => <mega-menu />;" },
  callToAction: { code: 'const C = () => <CallToAction heading="Ready?" description="Join" buttonText="Start" buttonUrl="/start" />;' },
  ctaScope: { code: 'const heading = "Scoped heading";\nconst C = () => <call-to-action />;' },
  blockquote: { code: 'const C = () => <Blockquote quote="To be" author="Will" citation="Hamlet" />;' },
  blockquoteLower: { code: "const C = () => <blockquote>Quoted</blockquote>;" },
  expressions: {
    code: "const n = -5;\nconst flag = !true;\nconst t = `a${n}b${flag}c${missing}`;\nconst obj = { k: 1, 'q': [1, 2, (3)], n };\nconst C = () => <h2 data-t={t} data-obj={obj} data-null={null} data-und={undefinedThing}>{'Value'}</h2>;" },
  styleEdgeCases: { code: "const C = () => <div style={{ padding: 0, margin: null, gap: 'abc', width: 10, borderWidth: 2, fontSize: 14, lineHeight: 1.5, flexDirection: 'column' }}><p>x</p></div>;" },
  styleNotObject: { code: 'const C = () => <div style="color: red"><p>x</p></div>;' },
  headingExisting: { code: '<h2 className="c">New title</h2>', options: { existingElement: existing } },
  containerExisting: { code: "<div><p>child</p></div>", options: { existingElement: existing, language: "jsx" } },
  imageExisting: { code: "<img />", options: { existingElement: existing } },
  buttonExisting: { code: "<button />", options: { existingElement: existing } },
  postsExisting: { code: "<BlogPosts />", options: { existingElement: existing } },
  ctaExisting: { code: "<CallToAction />", options: { existingElement: { ...existing, ctaHeading: "Old", ctaButtonText: "Old btn" } } },
  languageTs: { code: "const C = (): JSX.Element => <p>typed</p>;", options: { language: "ts" } },
  internalException: { code: "<p>boom</p>", options: { existingElement: { get id() { throw new Error("existing element exploded"); } } } },
};

export const VALIDATION_CASES: Record<string, string> = {
  empty: "",
  whitespace: "  \n ",
  valid: "export default function A() { return <div>ok</div>; }",
  validPlainTs: "const x: number = 1;",
  unclosed: "const C = () => <div><span></div>;",
  badToken: "const = ;",
  multiError: "function ( { return <a></b>",
};
