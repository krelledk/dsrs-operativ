const CACHE='dsrs-operativ-v9';
const APP_SHELL=['./','index.html','styles.css?v=9','app.js?v=9','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png'];

self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting())
));

self.addEventListener('activate',event=>event.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())
));

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(response=>{
      if(response.ok)caches.open(CACHE).then(cache=>cache.put('index.html',response.clone()));
      return response;
    }).catch(()=>caches.match('index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    if(response.ok)caches.open(CACHE).then(cache=>cache.put(event.request,response.clone()));
    return response;
  })));
});

self.addEventListener('push',event=>{
  let payload={title:'DSRS SAR-alarm',body:'Ny alarm fra DSRS',url:'./#responder'};
  try{payload={...payload,...event.data.json()}}catch{if(event.data)payload.body=event.data.text()}
  event.waitUntil((async()=>{
    const receipt=stage=>payload.deliveryToken?fetch('api/index.php?action=receipt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deliveryToken:payload.deliveryToken,stage})}).catch(()=>null):Promise.resolve();
    await receipt('received');
    await self.registration.showNotification(payload.title,{body:payload.body,icon:'icon-192.png',badge:'icon-192.png',tag:payload.tag||'dsrs-sar-alarm',renotify:true,requireInteraction:true,data:{url:payload.url||'./#responder'}});
    await receipt('shown');
    const windows=await clients.matchAll({type:'window',includeUncontrolled:true});for(const client of windows)client.postMessage({type:'push-alarm',payload});
  })());
});

self.addEventListener('message',event=>{
  if(event.data?.type==='SHOW_ALARM')event.waitUntil(self.registration.showNotification(event.data.title,event.data.options));
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=event.notification.data?.url||'./#responder';
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const client of list){if('focus'in client){client.navigate(target);return client.focus()}}
    return clients.openWindow(target);
  }));
});
