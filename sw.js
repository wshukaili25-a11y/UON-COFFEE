self.addEventListener('install',event=>{self.skipWaiting();});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    try{for(const key of await caches.keys())await caches.delete(key);}catch(e){}
    try{await self.registration.unregister();}catch(e){}
    try{const clientsList=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const client of clientsList)client.navigate(client.url);}catch(e){}
  })());
});
