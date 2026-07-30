// V30 uses one authenticated administration surface at /admin.html.
// Remove the older page-local password panels so they cannot imply that a
// client-side flag grants administrative access.
const legacyAdminSelectors=[
 '.admin-fab',
 '.admin-nav-btn',
 '.admin-login-btn',
 '#adminPanel',
 '#adminOverlay',
 '#adminBadge',
 '#ap',
 '#apOverlay'
];

for(const selector of legacyAdminSelectors){
 document.querySelectorAll(selector).forEach(element=>element.remove());
}

for(const key of [
 'uon_feat_admin',
 'uon_market_admin',
 'uon_q_admin',
 'uon_wa_admin',
 'uon_is_admin',
 'isAdmin',
 'adminLoggedIn',
 'apLoggedIn'
]){
 sessionStorage.removeItem(key);
 localStorage.removeItem(key);
}

const openSecureAdmin=()=>location.assign('admin.html');
const noLegacyAdmin=()=>false;
const noLegacyLogin=async()=>null;

document.body.classList.remove('admin-mode');

for(const name of ['openAP','openAdminPanel']){
 Object.defineProperty(window,name,{
  configurable:false,
  writable:false,
  value:openSecureAdmin
 });
}

for(const name of [
 'closeAP',
 'closeAdminPanel',
 'apLogout',
 'apSwitch',
 'loginSuccess',
 'updateAdminUI',
 'updatePendingBadge',
 'renderPending',
 'renderApprovedAdmin',
 'clearAllConf',
 'deleteConf',
 'deleteRest',
 'clearExpired',
 'deleteItem',
 'deleteQ',
 'clearAll',
 'approveGroup',
 'rejectGroup',
 'deleteGroup'
]){
 Object.defineProperty(window,name,{
  configurable:false,
  writable:false,
  value:noLegacyAdmin
 });
}

for(const name of ['apLogin','checkPass','checkPassword']){
 Object.defineProperty(window,name,{
  configurable:false,
  writable:false,
  value:noLegacyLogin
 });
}
