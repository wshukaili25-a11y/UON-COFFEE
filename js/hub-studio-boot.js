/* Set the preview palette before page modules paint their shell. */
(()=>{
 const root=document.documentElement;root.dataset.hubStudio='1';
 let theme='light';
 try{
  theme=localStorage.getItem('uon_theme')||localStorage.getItem('uonhub_theme')||'light';
  if(!['light','dark'].includes(theme))theme='light';
  localStorage.setItem('uon_theme',theme);localStorage.setItem('uonhub_theme',theme);
  root.dataset.hubMotion=localStorage.getItem('uon_hub_motion')==='off'?'off':'on';
 }catch{}
 root.dataset.theme=theme;root.style.colorScheme=theme;
})();
