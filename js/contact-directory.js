function hidePublicContactDirectory(){
 const roots=[...document.querySelectorAll('[data-contact-directory]')];
 roots.forEach(root=>{
  root.innerHTML='';
  root.hidden=true;
  root.removeAttribute('aria-busy');
 });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hidePublicContactDirectory,{once:true});else hidePublicContactDirectory();
