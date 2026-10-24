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

async function main() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  console.log('Launching Chrome via playwright-core...');
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
      console.log('PAGE ERROR LOG:', msg.text());
    }
  });

  page.on('pageerror', err => {
    console.error('UNCAUGHT PAGE ERROR:', err.message);
  });

  console.log('Navigating to editor URL:', URL);
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });

  console.log('Current URL after navigation:', page.url());
  console.log('Page Title:', await page.title());

  await page.waitForTimeout(3000);

  const screenshotPath = path.join(SCREENSHOT_DIR, '01_editor_initial.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log('Initial screenshot saved to:', screenshotPath);

  // Check key elements in DOM
  const topHeaderExists = await page.locator('header').count();
  console.log('Header count:', topHeaderExists);

  const leftRailExists = await page.locator('aside').count();
  console.log('Aside/Rail count:', leftRailExists);

  // Take mobile view screenshot
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(1000);
  const mobileScreenshotPath = path.join(SCREENSHOT_DIR, '02_editor_mobile.png');
  await page.screenshot({ path: mobileScreenshotPath, fullPage: false });
  console.log('Mobile screenshot saved to:', mobileScreenshotPath);

  await browser.close();
  console.log('Browser test run completed successfully.');
}

main().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
