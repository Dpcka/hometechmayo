// Keep previously shared calculator URLs useful after moving to the wizard.
function followLegacyCalculatorLink() {
  if (location.hash === '#quote-calculator') location.replace('quote.html');
}
followLegacyCalculatorLink();
window.addEventListener('hashchange', followLegacyCalculatorLink);
