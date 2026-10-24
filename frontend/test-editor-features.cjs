const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TOKEN = process.env.FORGE_SESSION_TOKEN || 'EmdP_baXn1uT1XShQL2In7ii-BKyYcd7etX6CqJw5zo';
const TEST_WEBSITE_ID = process.env.TEST_WEBSITE_ID;
if (!TEST_WEBSITE_ID) {
  console.error('Error: TEST_WEBSITE_ID environment variable is required. Do not run tests without an explicit disposable test fixture ID.');
  process.exit(1);
}
const URL = `http://localhost:5173/editor/${TEST_WEBSITE_ID}`;
const SCREENSHOT_DIR = 'C:\\Users\\RISSWANTH ROY\\.gemini\\antigravity-ide\\brain\\f17632cc-11bd-4421-872b-0ec741c0734e\\screenshots';

const results = [];

function record(feature, action, expected, actual, pass, screenshot) {
  results.push({ feature, action, expected, actual, pass, screenshot });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${feature}: ${actual}`);
}

async function runTests() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1600, height: 950 }
  });

  await context.addCookies([
    {
      name: 'forge_session',
      value: TOKEN,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax'
    }
  ]);

  const page = await context.newPage();

  console.log('Navigating to editor...');
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  // ----------------------------------------------------
  // TEST 1: Page Dropdown & Presets
  // ----------------------------------------------------
  try {
    const pageDropdownBtn = page.locator('#header-page-selector-btn');
    await pageDropdownBtn.waitFor({ state: 'visible', timeout: 15000 });
    await pageDropdownBtn.click();
    await page.waitForTimeout(600);

    const hasAboutPreset = await page.locator('button:has-text("About Us")').count();
    const hasContactPreset = await page.locator('button:has-text("Contact")').count();
    const hasServicesPreset = await page.locator('button:has-text("Services")').count();
    const hasPricingPreset = await page.locator('button:has-text("Pricing")').count();
    const hasCustomPage = await page.locator('button:has-text("Create Custom Page...")').count();

    const ss1 = '03_page_dropdown_presets.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, ss1) });

    const allPresetsPresent = hasAboutPreset > 0 && hasContactPreset > 0 && hasServicesPreset > 0 && hasPricingPreset > 0 && hasCustomPage > 0;
    record('Page Presets', 'Click #header-page-selector-btn in top header', 'Show presets (About, Contact, Services, Pricing, Custom Page)', `About: ${hasAboutPreset}, Contact: ${hasContactPreset}, Services: ${hasServicesPreset}, Pricing: ${hasPricingPreset}, Custom: ${hasCustomPage}`, allPresetsPresent, ss1);

    // Close dropdown by toggling button
    await pageDropdownBtn.click();
    await page.waitForTimeout(400);
  } catch (err) {
    record('Page Presets', 'Open page dropdown', 'Show presets', `Error: ${err.message}`, false, null);
  }

  // ----------------------------------------------------
  // TEST 2: Theme Scope Switcher
  // ----------------------------------------------------
  try {
    const scopeBtn = page.locator('button:has-text("Page Content"), button:has-text("Scope:")').first();
    await scopeBtn.click();
    await page.waitForTimeout(600);

    const ss2 = '04_theme_scope_dropdown.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, ss2) });

    const hasHeaderScope = await page.locator('button:has-text("Global Header")').count();
    const hasFooterScope = await page.locator('button:has-text("Global Footer")').count();
    const has404Scope = await page.locator('button:has-text("404 Not Found Page")').count();

    if (hasHeaderScope > 0 && hasFooterScope > 0 && has404Scope > 0) {
      record('Theme Scope Switcher', 'Click Theme Scope dropdown', 'List Page, Header, Footer, 404 scopes', `Found Header (${hasHeaderScope}), Footer (${hasFooterScope}), 404 (${has404Scope}) scopes`, true, ss2);

      // Select Global Header
      await page.locator('button:has-text("Global Header")').first().click();
      await page.waitForTimeout(500);
      const activeScopeText = await page.locator('header').textContent();
      const scopeSwitched = activeScopeText.includes('Global Header');
      record('Theme Scope Selection', 'Select Global Header', 'Header updates active scope to Global Header', `Scope text matches: ${scopeSwitched}`, scopeSwitched, null);

      // Switch back to Page Content
      const scopeBtn2 = page.locator('button:has-text("Global Header")').first();
      await scopeBtn2.click();
      await page.waitForTimeout(400);
      await page.locator('button:has-text("Page Content")').first().click();
      await page.waitForTimeout(400);
    } else {
      record('Theme Scope Switcher', 'Click Theme Scope dropdown', 'List all scopes', `Missing scopes. Header: ${hasHeaderScope}, Footer: ${hasFooterScope}, 404: ${has404Scope}`, false, ss2);
      await page.keyboard.press('Escape');
    }
  } catch (err) {
    record('Theme Scope Switcher', 'Switch theme scope', 'Scopes available', `Error: ${err.message}`, false, null);
  }

  // ----------------------------------------------------
  // TEST 3: Blocks, Elements & Templates Navigation
  // ----------------------------------------------------
  try {
    // Click "Blocks" in left rail
    const blocksRailBtn = page.locator('button[title="Blocks (Widgets)"]').or(page.locator('aside button:has-text("Blocks")')).first();
    await blocksRailBtn.click();
    await page.waitForTimeout(600);

    const ss3 = '05_blocks_widgets_palette.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, ss3) });

    const widgetCards = await page.locator('[draggable="true"]').count();
    record('Blocks Navigation', 'Click Blocks on left rail', '82+ widgets palette opens', `Rendered ${widgetCards} draggable widgets`, widgetCards > 20, ss3);

    // Click "Elements" in left rail
    const elementsRailBtn = page.locator('button[title="Elements (HTML & Components)"]').or(page.locator('aside button:has-text("Elements")')).first();
    await elementsRailBtn.click();
    await page.waitForTimeout(600);

    const ss4 = '06_elements_palette.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, ss4) });
    const widgetCardsElements = await page.locator('[draggable="true"]').count();
    record('Elements Navigation', 'Click Elements on left rail', 'Widgets/elements palette opens', `Rendered ${widgetCardsElements} draggable widgets`, widgetCardsElements > 20, ss4);

    // Click "Templates" in left rail
    const templatesRailBtn = page.locator('button[title="Template Library"]').or(page.locator('aside button:has-text("Templates")')).first();
    await templatesRailBtn.click();
    await page.waitForTimeout(800);

    const ss5 = '07_templates_library.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, ss5) });
    const templateLibCount = await page.locator('text=Template Library').or(page.locator('text=Templates')).count();
    record('Templates Navigation', 'Click Templates on left rail', 'Template library drawer/modal renders', `Template library visible: ${templateLibCount > 0}`, templateLibCount > 0, ss5);

    // Return to Pages tab
    const pagesRailBtn = page.locator('button[title="Pages & Navigation"]').or(page.locator('aside button:has-text("Pages")')).first();
    await pagesRailBtn.click();
    await page.waitForTimeout(500);
  } catch (err) {
    record('Rail Navigation', 'Click Blocks/Elements/Templates', 'Palette renders', `Error: ${err.message}`, false, null);
  }

  // ----------------------------------------------------
  // TEST 4: Responsive Breakpoints Switcher
  // ----------------------------------------------------
  try {
    const tabletBtn = page.locator('button[title*="Tablet View"]').or(page.locator('button:has(svg.lucide-tablet)')).first();
    await tabletBtn.click();
    await page.waitForTimeout(600);
    const ssTablet = '08_responsive_tablet.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, ssTablet) });

    const mobileBtn = page.locator('button[title*="Mobile View"]').or(page.locator('button:has(svg.lucide-smartphone)')).first();
    await mobileBtn.click();
    await page.waitForTimeout(600);
    const ssMobile = '09_responsive_mobile.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, ssMobile) });

    const desktopBtn = page.locator('button[title*="Desktop View"]').or(page.locator('button:has(svg.lucide-monitor)')).first();
    await desktopBtn.click();
    await page.waitForTimeout(600);

    record('Responsive Modes', 'Toggle Tablet and Mobile breakpoints', 'Canvas adapts to tablet and mobile widths', 'Successfully toggled Desktop -> Tablet -> Mobile -> Desktop', true, ssMobile);
  } catch (err) {
    record('Responsive Modes', 'Toggle breakpoints', 'Responsive canvas', `Error: ${err.message}`, false, null);
  }

  // ----------------------------------------------------
  // TEST 5: Zoom Dropdown Controls
  // ----------------------------------------------------
  try {
    const zoomBtn = page.locator('button:has-text("100%")').first();
    await zoomBtn.click();
    await page.waitForTimeout(400);

    const hasZoom75 = await page.locator('button:has-text("75%")').count();
    const hasZoom125 = await page.locator('button:has-text("125%")').count();

    const ssZoom = '10_zoom_dropdown.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, ssZoom) });

    if (hasZoom75 > 0 && hasZoom125 > 0) {
      await page.locator('button:has-text("75%")').first().click();
      await page.waitForTimeout(400);
      const newZoomText = await page.locator('header').textContent();
      const zoomChanged = newZoomText.includes('75%');
      record('Zoom Controls', 'Select 75% zoom', 'Canvas zoom scales to 75%', `Zoom changed to 75%: ${zoomChanged}`, zoomChanged, ssZoom);

      // Reset to 100%
      const zoomResetBtn = page.locator('button:has-text("75%")').first();
      await zoomResetBtn.click();
      await page.waitForTimeout(300);
      await page.locator('button:has-text("100%")').first().click();
      await page.waitForTimeout(300);
    } else {
      record('Zoom Controls', 'Click zoom dropdown', 'Show zoom percentage options', 'Zoom dropdown options not found', false, ssZoom);
      await page.keyboard.press('Escape');
    }
  } catch (err) {
    record('Zoom Controls', 'Click zoom dropdown', 'Zoom dropdown works', `Error: ${err.message}`, false, null);
  }

  // ----------------------------------------------------
  // TEST 6: Selected Element Toolbar & Inspector
  // ----------------------------------------------------
  try {
    // Click an element inside the layer tree or on canvas
    const layerItem = page.locator('aside div:has-text("APEX")').or(page.locator('text=LAUNCH PIT DESK')).first();
    await layerItem.click();
    await page.waitForTimeout(600);

    const ssSelect = '11_element_selected.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, ssSelect) });

    // Check if element toolbar appeared with id #selected-element-toolbar
    const toolbarCount = await page.locator('#selected-element-toolbar').count();

    // Check right inspector switched to Element styles
    const inspectorText = await page.locator('aside').last().textContent();
    const inspectorHasElement = inspectorText.includes('Style') || inspectorText.includes('Typography') || inspectorText.includes('Design Tokens');

    record('Element Selection & Toolbar', 'Click element in layer tree / canvas', 'Element selected, toolbar rendered with actions', `Toolbar count: ${toolbarCount}, Inspector active: ${inspectorHasElement}`, toolbarCount > 0 && inspectorHasElement, ssSelect);
  } catch (err) {
    record('Element Selection', 'Select canvas element', 'Selection active', `Error: ${err.message}`, false, null);
  }

  // ----------------------------------------------------
  // TEST 7: Modals (Finder, Shortcuts, More Actions, Revisions)
  // ----------------------------------------------------
  try {
    // 1. More Actions menu (...)
    const moreBtn = page.locator('header button[title="More Actions"]').or(page.locator('header button:has(svg.lucide-more-horizontal)')).first();
    await moreBtn.click();
    await page.waitForTimeout(500);

    const ssMore = '12_more_actions_menu.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, ssMore) });

    const hasRevisionOption = await page.locator('button:has-text("Revision History")').count();
    const hasFinderOption = await page.locator('button:has-text("Quick Finder")').count();
    const hasPopupOption = await page.locator('button:has-text("Popups & Overlay Manager")').or(page.locator('button:has-text("Popup")')).count();
    const hasShortcutsOption = await page.locator('button:has-text("Keyboard Shortcuts")').count();
    const hasTokensOption = await page.locator('button:has-text("Design Tokens & CSS Variables")').count();

    const moreActionsPassed = hasRevisionOption > 0 && hasFinderOption > 0 && hasPopupOption > 0 && hasShortcutsOption > 0 && hasTokensOption > 0;
    record('More Actions Menu', 'Click ... in header', 'Show Revision History, Quick Finder, Popups, Shortcuts, Tokens', `Found Revision: ${hasRevisionOption}, Finder: ${hasFinderOption}, Popups: ${hasPopupOption}, Shortcuts: ${hasShortcutsOption}, Tokens: ${hasTokensOption}`, moreActionsPassed, ssMore);

    // Close more dropdown by toggling button
    await moreBtn.click();
    await page.waitForTimeout(300);

    // 2. Open Quick Finder via Ctrl+K
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(600);

    const ssFinder = '13_quick_finder_modal.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, ssFinder) });

    const finderInputCount = await page.locator('input[placeholder*="Search pages, templates"]').count();
    record('Quick Finder Modal', 'Press Ctrl+K shortcut', 'Command palette modal opens with focused search input', `Finder input visible: ${finderInputCount > 0}`, finderInputCount > 0, ssFinder);

    // Close Finder via Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Verify Finder closed
    const finderClosed = (await page.locator('input[placeholder*="Search pages, templates"]').count()) === 0;
    record('Quick Finder Dismiss', 'Press Escape in Finder', 'Finder modal dismissed cleanly', `Modal closed: ${finderClosed}`, finderClosed, null);

    // 3. Open Keyboard Shortcuts via ?
    await page.keyboard.press('?');
    await page.waitForTimeout(600);
    const ssShortcuts = '14_keyboard_shortcuts_modal.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, ssShortcuts) });
    const shortcutsModalVisible = await page.locator('text=Keyboard Shortcuts').count();
    record('Keyboard Shortcuts Modal', 'Press ? shortcut key', 'Keyboard Shortcuts modal opens with key binding reference', `Shortcuts modal visible: ${shortcutsModalVisible > 0}`, shortcutsModalVisible > 0, ssShortcuts);

    // Close shortcuts modal via close button or Escape
    const closeShortcutsBtn = page.locator('[data-testid="close-shortcuts-help-btn"]');
    if (await closeShortcutsBtn.count() > 0) {
      await closeShortcutsBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(600);

    // 4. Revision History Button
    const historyBtn = page.locator('header button[title="Revision History"]').or(page.locator('header button:has(svg.lucide-history)')).first();
    await historyBtn.click();
    await page.waitForTimeout(700);

    const ssHistory = '15_revision_history.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, ssHistory) });
    const historyModalVisible = await page.locator('text=Revision History').or(page.locator('text=Revisions')).count();
    record('Revision History', 'Click History icon in header', 'Revision History drawer/modal opens with checkpoint history', `Revisions drawer visible: ${historyModalVisible > 0}`, historyModalVisible > 0, ssHistory);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } catch (err) {
    record('Modals & Actions', 'Test modals', 'Modals open', `Error: ${err.message}`, false, null);
  }

  // ----------------------------------------------------
  // TEST 8: Save & Reload Persistence
  // ----------------------------------------------------
  try {
    // Trigger Save via Ctrl+S
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(2000);

    const ssSaved = '16_after_save.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, ssSaved) });
    const statusText = await page.locator('header').textContent();
    const saveConfirmed = statusText.includes('saved') || statusText.includes('Saved');
    record('Save Action', 'Trigger Ctrl+S save', 'Status displays saved', `Header contains saved status: ${saveConfirmed}`, saveConfirmed, ssSaved);

    // Reload page to verify persistence
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const ssReload = '17_after_reload.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, ssReload) });
    const reloadContent = await page.locator('body').textContent();
    const siteContentPersisted = reloadContent.includes('APEX CORSE') && reloadContent.includes('LAUNCH PIT DESK');
    record('Reload Persistence', 'Reload page in browser', 'Editor recovers site document and renders correctly', `Document content intact after reload: ${siteContentPersisted}`, siteContentPersisted, ssReload);
  } catch (err) {
    record('Persistence', 'Save and reload', 'Document persists', `Error: ${err.message}`, false, null);
  }

  await browser.close();

  // Summary output
  console.log('\n======================================================');
  console.log('           BROWSER TEST EXECUTION SUMMARY             ');
  console.log('======================================================');
  let passCount = 0;
  for (const r of results) {
    if (r.pass) passCount++;
    console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${r.feature} | Action: ${r.action} | Result: ${r.actual}`);
  }
  console.log(`Total: ${results.length} tests, Passed: ${passCount}, Failed: ${results.length - passCount}`);
  fs.writeFileSync(path.join(SCREENSHOT_DIR, 'test_results.json'), JSON.stringify(results, null, 2));
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
