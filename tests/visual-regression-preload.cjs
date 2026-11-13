// Isolate layout/gallery checks from external fonts and the absent local Reviews
// service binding. Reviews behavior is tested by scripts/test-reviews-browser.mjs.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const launch=chromium.launch.bind(chromium);
chromium.launch=async(...args)=>{
 const browser=await launch(...args);
 const newContext=browser.newContext.bind(browser),newPage=browser.newPage.bind(browser);
 async function isolate(context){
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.hostname!=='127.0.0.1') return route.abort();
   if(url.pathname==='/api/reviews' && route.request().method()==='GET') return route.fulfill({json:{reviews:[]}});
   return route.continue();
  });
  return context;
 }
 browser.newContext=async(...options)=>isolate(await newContext(...options));
 browser.newPage=async(...options)=>{const page=await newPage(...options);await isolate(page.context());return page;};
 return browser;
};
