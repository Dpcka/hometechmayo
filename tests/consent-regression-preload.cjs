// Isolate existing calculator regressions from the newly introduced consent UI.
// Explicitly reject analytics; keep the original tests and customer UI unchanged.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
function rejectedConsent() {
  try {
    localStorage.setItem('htss_cookie_consent', JSON.stringify({version:1,analytics:false,savedAt:Date.now()}));
  } catch { /* about:blank/no-JS/privacy-restricted contexts */ }
}
const launch = chromium.launch.bind(chromium);
chromium.launch = async (...args) => {
  const browser = await launch(...args);
  const newPage = browser.newPage.bind(browser), newContext = browser.newContext.bind(browser);
  browser.newPage = async (...options) => {const page = await newPage(...options);await page.addInitScript(rejectedConsent);return page;};
  browser.newContext = async (...options) => {const context = await newContext(...options);await context.addInitScript(rejectedConsent);return context;};
  return browser;
};
