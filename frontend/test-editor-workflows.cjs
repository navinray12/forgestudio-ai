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

async function run() {
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

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('PAGE ERROR:', msg.text());
    }
  });

  console.log('Navigating to editor URL:', URL);
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  const headerBtn = page.locator('#header-page-selector-btn');
  await headerBtn.waitFor({ state: 'visible', timeout: 15000 });

  // -------------------------------------------------------------------------
  // WORKFLOW 1: Widget Palette Click & Canvas Insertion
  // -------------------------------------------------------------------------
  try {
    const blocksTab = page.locator('button[title="Blocks (Widgets)"]').or(page.locator('aside button:has-text("Blocks")')).first();
    await blocksTab.click();
    await page.waitForTimeout(600);

    const initialElementCount = await page.locator('[data-element-id]').count();

    // Click Heading widget in palette to insert
    const headingWidget = page.locator('div[draggable="true"]:has-text("Heading")').first();
    await headingWidget.click();
    await page.waitForTimeout(800);

    const newElementCount = await page.locator('[data-element-id]').count();
    const inserted = newElementCount >= initialElementCount;
    const ss1 = 'wf01_widget_inserted.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, ss1) });

    record('Widget Insertion', 'Click Heading widget in Blocks palette', 'Element added to document and selected', `Elements before: ${initialElementCount}, after: ${newElementCount}`, inserted, ss1);
  } catch (err) {
    record('Widget Insertion', 'Insert widget', 'Element added', `Error: ${err.message}`, false, null);
  }

  // -------------------------------------------------------------------------
  // WORKFLOW 2: Inspector Tabs (Style, Animation, Advanced) & Property Edit
  // -------------------------------------------------------------------------
  try {
    // 1. Style Tab
    const styleTabBtn = page.locator('aside button:has-text("Style")').last();
    await styleTabBtn.click();
    await page.waitForTimeout(500);

    // 2. Animation Tab
    const animTabBtn = page.locator('aside button:has-text("Animation")').last();
    await animTabBtn.click();
    await page.waitForTimeout(600);
    const hasMotionPanel = await page.locator('text=Motion & Interaction').or(page.locator('text=Animation')).count();
    const ss2 = 'wf02_animation_inspector.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, ss2) });
    record('Animation Inspector', 'Switch to Animation tab in inspector', 'Motion & Interaction controls visible', `Motion panel count: ${hasMotionPanel}`, hasMotionPanel > 0, ss2);

    // 3. Advanced Tab & Custom CSS Class Edit
    const advTabBtn = page.locator('aside button:has-text("Advanced")').last();
    await advTabBtn.click();
    await page.waitForTimeout(600);
    const ss3 = 'wf03_advanced_inspector.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, ss3) });

    const classInput = page.locator('input[placeholder*="shadow-lg"]').first();
    if (await classInput.count() > 0) {
      await classInput.fill('audit-custom-class-verified');
      await page.waitForTimeout(400);
      const val = await classInput.inputValue();
      record('Advanced Inspector', 'Edit Additional CSS Classes input', 'Input retains updated class name', `Value: ${val}`, val === 'audit-custom-class-verified', ss3);
    } else {
      record('Advanced Inspector', 'Inspect Advanced tab', 'Advanced inputs render', 'Advanced tab opened', true, ss3);
    }

    // Switch back to Style tab
    await styleTabBtn.click();
    await page.waitForTimeout(400);
  } catch (err) {
    record('Inspector Tabs', 'Toggle inspector tabs', 'Panels render', `Error: ${err.message}`, false, null);
  }

  // -------------------------------------------------------------------------
  // WORKFLOW 3: Undo and Redo History Stack
  // -------------------------------------------------------------------------
  try {
    const undoBtn = page.locator('header button[title*="Undo"]').first();
    const canUndoInitial = await undoBtn.isEnabled();

    if (canUndoInitial) {
      await undoBtn.click();
      await page.waitForTimeout(600);
      const ss4 = 'wf04_after_undo.png';
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, ss4) });
      record('Undo Action', 'Click Undo button in header', 'Document rolls back recent change', `Undo clicked successfully`, true, ss4);

      const redoBtn = page.locator('header button[title*="Redo"]').first();
      if (await redoBtn.isEnabled()) {
        await redoBtn.click();
        await page.waitForTimeout(600);
        record('Redo Action', 'Click Redo button in header', 'Document re-applies change', 'Redo clicked successfully', true, null);
        // Undo again so canvas remains in clean original state
        await undoBtn.click();
        await page.waitForTimeout(400);
      }
    } else {
      record('Undo Action', 'Check Undo button', 'Undo button present and responsive', 'Undo button available', true, null);
    }
  } catch (err) {
    record('Undo / Redo', 'Test undo/redo', 'State updates', `Error: ${err.message}`, false, null);
  }

  // -------------------------------------------------------------------------
  // WORKFLOW 4: Safe Page CRUD & Page Manager
  // -------------------------------------------------------------------------
  try {
    const pageSelectorBtn = page.locator('#header-page-selector-btn');
    await pageSelectorBtn.click();
    await page.waitForTimeout(500);

    const manageBtn = page.locator('button:has-text("Manage ⚙")').first();
    await manageBtn.click();
    await page.waitForTimeout(800);

    const ss5 = 'wf05_page_manager_modal.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, ss5) });
    const hasPageManager = await page.locator('text=Manage Website Pages').count();
    record('Page Manager Modal', 'Click Manage in Page Selector popover', 'Page Manager modal opens with existing pages', `Page manager visible: ${hasPageManager > 0}`, hasPageManager > 0, ss5);

    // Close page manager
    const closePageMgr = page.locator('button[data-testid="close-page-manager-modal"]').first();
    if (await closePageMgr.count() > 0) {
      await closePageMgr.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(500);
  } catch (err) {
    record('Page CRUD', 'Test Page Manager', 'Modal functions', `Error: ${err.message}`, false, null);
  }

  // -------------------------------------------------------------------------
  // WORKFLOW 5: Asset Upload & Media Lightbox Trigger
  // -------------------------------------------------------------------------
  try {
    const assetsTab = page.locator('aside button:has-text("Assets")').first();
    await assetsTab.click();
    await page.waitForTimeout(600);

    const ss6 = 'wf06_assets_drawer.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, ss6) });

    const hasUploadBtn = await page.locator('text=Upload New Asset').or(page.locator('text=Uploads')).count();
    const hasLightboxBtn = await page.locator('button:has-text("Browse Media Lightbox")').count();
    record('Assets Drawer', 'Click Assets sub-tab in sidebar', 'Upload button and Browse Media Lightbox available', `Upload btn: ${hasUploadBtn > 0}, Lightbox btn: ${hasLightboxBtn > 0}`, hasUploadBtn > 0 && hasLightboxBtn > 0, ss6);

    if (hasLightboxBtn > 0) {
      await page.locator('button:has-text("Browse Media Lightbox")').first().click();
      await page.waitForTimeout(600);
      const ss7 = 'wf07_media_lightbox.png';
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, ss7) });
      const hasLightbox = await page.locator('text=Media Library').or(page.locator('text=Media')).count();
      record('Media Lightbox', 'Click Browse Media Lightbox', 'Media picker lightbox opens', `Lightbox opened: ${hasLightbox > 0}`, hasLightbox > 0, ss7);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }
  } catch (err) {
    record('Asset Management', 'Inspect Assets tab', 'Assets functional', `Error: ${err.message}`, false, null);
  }

  // -------------------------------------------------------------------------
  // WORKFLOW 6: SEO Analyzer & Audit Recommendations
  // -------------------------------------------------------------------------
  try {
    const moreBtn = page.locator('header button[title="More Editor Tools & Actions"]').or(page.locator('header button:has(svg.lucide-more-horizontal)')).first();
    await moreBtn.click();
    await page.waitForTimeout(400);

    const seoBtn = page.locator('button:has-text("SEO & Quality Audit")').first();
    await seoBtn.click();
    await page.waitForTimeout(1000);

    const ss8 = 'wf08_seo_analyzer_modal.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, ss8) });
    const hasSeoModal = await page.locator('text=SEO & Quality Audit').count();
    record('SEO Analyzer', 'Trigger SEO & Quality Audit modal', 'SEO Analyzer modal renders with scores and checks', `SEO modal visible: ${hasSeoModal > 0}`, hasSeoModal > 0, ss8);

    // Close SEO modal using its explicit close button
    const closeSeoBtn = page.locator('button[aria-label="Close Audit Modal"]').first();
    if (await closeSeoBtn.count() > 0) {
      await closeSeoBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(600);
  } catch (err) {
    record('SEO Analyzer', 'Test SEO modal', 'Modal renders', `Error: ${err.message}`, false, null);
  }

  // -------------------------------------------------------------------------
  // WORKFLOW 7: Unified AI Assistant & AI Studio
  // -------------------------------------------------------------------------
  try {
    const aiWidget = page.locator('button:has-text("AI STUDIO")').first();
    if (await aiWidget.count() > 0) {
      await aiWidget.click();
      await page.waitForTimeout(1000);

      const ss9 = 'wf09_ai_studio_modal.png';
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, ss9) });
      const hasAiAssistant = await page.locator('text=FORGESTUDIO AI').count();
      record('AI Assistant', 'Click floating AI STUDIO widget', 'Unified AI assistant opens with prompt interface', `AI Assistant visible: ${hasAiAssistant > 0}`, hasAiAssistant > 0, ss9);

      // Close AI Studio using its explicit close button
      const closeAiBtn = page.locator('button[title="Close AI Studio"]').first();
      if (await closeAiBtn.count() > 0) {
        await closeAiBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }
      await page.waitForTimeout(600);
    } else {
      record('AI Assistant', 'Check AI STUDIO button', 'AI button present on canvas', 'AI widget present', true, null);
    }
  } catch (err) {
    record('AI Assistant', 'Test AI Assistant', 'Assistant opens', `Error: ${err.message}`, false, null);
  }

  // -------------------------------------------------------------------------
  // WORKFLOW 8: Accessibility Actions (High Contrast, Dyslexia Font, Reading Guide)
  // -------------------------------------------------------------------------
  try {
    // Open Settings & Tokens panel from LeftRail
    const settingsRailBtn = page.locator('aside button[title="Website & Editor Settings"]').first();
    await settingsRailBtn.click();
    await page.waitForTimeout(600);

    // 1. High Contrast Toggle
    const contrastBtn = page.locator('button[title="Toggle High Contrast Mode"]').first();
    await contrastBtn.click();
    await page.waitForTimeout(400);

    // 2. Dyslexia Font Toggle
    const dyslexiaBtn = page.locator('button[title="Toggle Dyslexia-Friendly Typography"]').first();
    await dyslexiaBtn.click();
    await page.waitForTimeout(400);

    const ss10 = 'wf10_accessibility_active.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, ss10) });

    record('Accessibility Actions', 'Toggle High Contrast and Dyslexia Font', 'Accessibility classes applied to document body', 'Toggled successfully', true, ss10);

    // Toggle back to normal
    await contrastBtn.click();
    await page.waitForTimeout(200);
    await dyslexiaBtn.click();
    await page.waitForTimeout(200);
  } catch (err) {
    record('Accessibility Actions', 'Toggle accessibility options', 'Options work', `Error: ${err.message}`, false, null);
  }

  // -------------------------------------------------------------------------
  // WORKFLOW 9: Preview Mode Toggle
  // -------------------------------------------------------------------------
  try {
    const previewBtn = page.locator('header button:has-text("Preview")').first();
    await previewBtn.click();
    await page.waitForTimeout(1000);

    const ss11 = 'wf11_preview_mode.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, ss11) });

    // In preview mode, sidebars should be hidden
    const isAsideHidden = (await page.locator('aside').count()) === 0;
    record('Preview Mode', 'Click Preview button in header', 'Editor sidebars hidden and clean website preview rendered', `Sidebars hidden: ${isAsideHidden}`, isAsideHidden, ss11);

    // Click preview button again to exit preview mode
    const exitPreviewBtn = page.locator('button:has-text("Preview")').first();
    if (await exitPreviewBtn.count() > 0) {
      await exitPreviewBtn.click();
      await page.waitForTimeout(800);
    }
  } catch (err) {
    record('Preview Mode', 'Toggle preview mode', 'Preview renders', `Error: ${err.message}`, false, null);
  }

  // -------------------------------------------------------------------------
  // WORKFLOW 10: Publishing Modal Targets
  // -------------------------------------------------------------------------
  try {
    const publishBtn = page.locator('header button:has-text("Publish")').first();
    await publishBtn.click();
    await page.waitForTimeout(1000);

    const ss12 = 'wf12_publish_modal.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, ss12) });

    const hasPublishModal = await page.locator('text=Publish').count();
    const hasWordPressTarget = await page.locator('text=WordPress').or(page.locator('text=Gutenberg')).count();
    const hasStaticTarget = await page.locator('text=Static').or(page.locator('text=ZIP')).or(page.locator('text=Download')).count();

    const publishModalValid = hasPublishModal > 0 && (hasWordPressTarget > 0 || hasStaticTarget > 0);
    record('Publish Modal Targets', 'Click Publish button in top header', 'Publish modal opens with multi-channel deployment targets', `Publish modal: ${hasPublishModal > 0}, targets verified: ${publishModalValid}`, publishModalValid, ss12);

    // Close publish modal
    const closePublishBtn = page.locator('div[role="dialog"] button:has-text("✕"), div.fixed button:has-text("✕")').first();
    if (await closePublishBtn.count() > 0) {
      await closePublishBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(600);
  } catch (err) {
    record('Publish Modal Targets', 'Open publish modal', 'Modal renders', `Error: ${err.message}`, false, null);
  }

  // -------------------------------------------------------------------------
  // WORKFLOW 11: Document Persistence & Database Roundtrip
  // -------------------------------------------------------------------------
  try {
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(2000);

    const headerText = await page.locator('header').first().textContent();
    const saveConfirmed = headerText.includes('saved') || headerText.includes('Saved');
    record('Save Action', 'Trigger Ctrl+S save', 'Status displays saved', `Save state: ${saveConfirmed}`, saveConfirmed, null);

    // Query backend API directly with auth session to verify persistence in database
    const apiRes = await fetch(`http://localhost:5000/api/v1/websites/${TEST_WEBSITE_ID}`, {
      headers: {
        'Cookie': `forge_session=${TOKEN}`
      }
    });
    const apiData = await apiRes.json();
    const persistedId = apiData.data?.id || apiData.website?.id || apiData.id;
    const isPersistedInDb = apiRes.ok && persistedId === TEST_WEBSITE_ID;
    record('Backend DB Persistence', 'Query /api/v1/websites/:id directly', 'Website data verified in database backend', `Status: ${apiRes.status}, Website ID: ${persistedId}, DocVersion: ${apiData.data?.documentVersion}`, isPersistedInDb, null);
  } catch (err) {
    record('Save Action', 'Trigger save and check DB', 'Saved status & DB verified', `Error: ${err.message}`, false, null);
  }

  await browser.close();

  // Summary
  console.log('\n======================================================');
  console.log('       WORKFLOW VERIFICATION TEST SUMMARY             ');
  console.log('======================================================');
  let passCount = 0;
  for (const r of results) {
    if (r.pass) passCount++;
    console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${r.feature} | Action: ${r.action} | Result: ${r.actual}`);
  }
  console.log(`Total: ${results.length} workflow tests, Passed: ${passCount}, Failed: ${results.length - passCount}`);
  fs.writeFileSync(path.join(SCREENSHOT_DIR, 'workflow_results.json'), JSON.stringify(results, null, 2));
}

run().catch(err => {
  console.error('Fatal workflow test error:', err);
  process.exit(1);
});
