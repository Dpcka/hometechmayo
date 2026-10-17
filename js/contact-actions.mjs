// Contact actions supplement semantic links; they never pretend to send email.
const contactValues={email:'info@hometechmayo.ie',phone:'083 349 8496'};
const status=document.querySelector('#contact-copy-status');
async function copyText(value) {
  try {if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);return true;}} catch { /* Try a local selection fallback. */ }
  const previous=document.activeElement;
  const input=document.createElement('textarea');input.value=value;input.readOnly=true;
  input.style.cssText='position:fixed;left:-9999px;top:0;width:1px;height:1px;';
  document.body.append(input);input.select();let copied=false;
  try {copied=document.execCommand('copy');} catch { /* Report unavailable instead of false success. */ }
  input.remove();previous?.focus({preventScroll:true});return copied;
}
for(const button of document.querySelectorAll('[data-copy-contact]')) {
  const kind=button.dataset.copyContact,value=contactValues[kind];if(!value)continue;
  button.hidden=false;
  button.addEventListener('click',async()=>{
    button.disabled=true;
    try {const copied=await copyText(value);status.textContent=copied ? `${kind==='email'?'Email':'Phone number'} copied: ${value}` : `Automatic copy is unavailable. Please select and copy: ${value}`;}
    finally {button.disabled=false;}
  });
}
