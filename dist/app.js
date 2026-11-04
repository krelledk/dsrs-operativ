const STORAGE = { alarms: 'dsrs.alarms.v2', current: 'dsrs.current.v2', responses: 'dsrs.responses.v2', delivery: 'dsrs.delivery.v2', logs: 'dsrs.logs.v2' };
const API = 'api/index.php';
const DEVICE = { token: 'dsrs.deviceToken.v1', id: 'dsrs.deviceId.v1', name: 'dsrs.crewName.v1' };
const channel = 'BroadcastChannel' in window ? new BroadcastChannel('alarmberedskab') : null;
const crew = [
  ['MA','Maja Andersen','Skipper','accepted'],['JL','Jonas Lund','Navigatør','wait'],['SK','Sara Kjær','Bådfører','accepted'],['MN','Mikkel Nielsen','Søredder','accepted'],
  ['EF','Emil Friis','Søredder','accepted'],['LH','Line Holm','Maskinansvarlig','wait'],['TB','Thomas Bruun','Søredder','accepted'],['AP','Anna Poulsen','Søredder','rejected']
];
const seedAlarm = {id:'demo-001',type:'Fartøj i nød',priority:'high',location:"55°27.90'N · 12°12.45'E · Køge Bugt",message:'Sejlbåd med motorstop og drivende mod sydøst. 3 personer ombord, alle bærer redningsvest. Vind 8 m/s V.',units:['RS Køge','RHIB 01'],createdAt:new Date(Date.now()-240000).toISOString()};
let deferredPrompt;
let backendConfig=null;
let backendOnline=false;
let csrfToken=null;
let remoteDeliveries=null;
let pendingDispatch=null;
let serviceWorkerRegistrationPromise=null;

function withTimeout(promise,milliseconds,message){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error(message)),milliseconds);Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value)},error=>{clearTimeout(timer);reject(error)})})}
function setDeviceStatus(message,state=''){const status=document.querySelector('#device-status');if(!status)return;status.textContent=message;status.className=`device-status${state?' '+state:''}`}
function ensureServiceWorker(){if(!('serviceWorker'in navigator))return Promise.reject(new Error('Denne browser understøtter ikke appens push-service.'));if(!serviceWorkerRegistrationPromise)serviceWorkerRegistrationPromise=navigator.serviceWorker.register('service-worker.js',{scope:'./'}).then(registration=>{if(registration.waiting)registration.waiting.postMessage({type:'SKIP_WAITING'});return navigator.serviceWorker.ready});return withTimeout(serviceWorkerRegistrationPromise,15000,'Appens push-service svarede ikke. Luk appen helt, åbn den igen, og prøv på ny.')}
function requestNotificationPermission(){if(Notification.permission!=='default')return Promise.resolve(Notification.permission);return withTimeout(new Promise((resolve,reject)=>{let settled=false;const finish=value=>{if(settled)return;settled=true;resolve(value||Notification.permission)};try{const result=Notification.requestPermission(finish);if(result&&typeof result.then==='function')result.then(finish,reject)}catch(error){reject(error)}}),45000,'Telefonens spørgsmål om notifikationer blev ikke besvaret. Prøv igen, og vælg Tillad i telefonens dialog.')}

function read(key, fallback){ try{return JSON.parse(localStorage.getItem(key)) ?? fallback}catch{return fallback} }
function write(key,value){localStorage.setItem(key,JSON.stringify(value))}
function esc(value=''){return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function currentAlarm(){return read(STORAGE.current,seedAlarm)}
function currentResponses(){return read(STORAGE.responses,Object.fromEntries(crew.map(x=>[x[1],x[3]])))}
function time(value){return new Intl.DateTimeFormat('da-DK',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(value))}
function dateTime(value){return new Intl.DateTimeFormat('da-DK',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(value))}
function showToast(message,error=false){const el=document.querySelector('#toast');el.textContent=message;el.className='toast show'+(error?' error':'');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>el.className='toast',3200)}
async function api(action,{method='GET',body,token,csrf}={}){const headers={Accept:'application/json'};if(body!==undefined)headers['Content-Type']='application/json';if(token)headers.Authorization=`Bearer ${token}`;if(csrf)headers['X-CSRF-Token']=csrf;const response=await fetch(`${API}?action=${encodeURIComponent(action)}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body),credentials:'same-origin'});const data=await response.json().catch(()=>({ok:false,error:'Ugyldigt svar fra serveren.'}));if(!response.ok)throw new Error(data.error||`Serverfejl ${response.status}`);return data}

function ensureSeed(){
  if(!localStorage.getItem(STORAGE.current)){const now=new Date().toISOString();write(STORAGE.current,seedAlarm);write(STORAGE.alarms,[seedAlarm]);write(STORAGE.responses,Object.fromEntries(crew.map(x=>[x[1],x[3]])));write(STORAGE.delivery,{alarmId:seedAlarm.id,createdAt:seedAlarm.createdAt,pushSentAt:seedAlarm.createdAt,appReceivedAt:now,notificationShownAt:now});write(STORAGE.logs,[{at:now,text:'Demoalarm indlæst i kontrolcentralen.'}])}
}

function addLog(text){const logs=read(STORAGE.logs,[]);logs.unshift({at:new Date().toISOString(),text});write(STORAGE.logs,logs.slice(0,12));renderLog()}
function renderLog(){const logs=read(STORAGE.logs,[]);document.querySelector('#event-log').innerHTML=logs.length?logs.slice(0,6).map(x=>`<div class="log-item"><span class="log-time">${time(x.at)}</span><p>${esc(x.text)}</p></div>`).join(''):'<p class="muted">Ingen hændelser endnu.</p>'}

function renderAlarm(){
  const alarm=currentAlarm(); const responses=currentResponses();
  const summary=document.querySelector('#latest-alarm-summary');
  summary.innerHTML=`<b>${esc(alarm.type)}</b><time>${time(alarm.createdAt)}</time><p>⌖ ${esc(alarm.location)} · ${esc(alarm.units.join(' + '))}</p>`;
  const mobile=document.querySelector('#mobile-alarm');
  mobile.innerHTML=`<div class="alarm-kicker"><span>${esc(alarm.priority==='test'?'TESTALARM':'ALARM · '+alarm.priority.toUpperCase())}</span><time>${time(alarm.createdAt)}</time></div><h3>${esc(alarm.type)}</h3><p class="location">⌖ ${esc(alarm.location)}</p><p class="message">${esc(alarm.message || 'Ingen supplerende melding.')}</p><div class="units">${alarm.units.map(u=>`<span>${esc(u)}</span>`).join('')}</div>`;
  const counts={accepted:0,rejected:0,wait:0};if(remoteDeliveries)remoteDeliveries.forEach(item=>counts[item.response||'wait']++);else Object.values(responses).forEach(x=>counts[x]=(counts[x]||0)+1);
  Object.entries(counts).forEach(([k,v])=>{const el=document.querySelector('#response-'+k);if(el)el.textContent=v});
  const total=Math.max(1,Object.keys(responses).length); document.querySelector('#response-progress').style.width=`${Math.min(100,((total-counts.wait)/total)*100)}%`;
  const labels={accepted:'Accepteret',rejected:'Ej accepteret',wait:'Afventer'};
  document.querySelector('#crew-list').innerHTML=remoteDeliveries?remoteDeliveries.map(item=>{const initials=item.crew_name.split(/\s+/).map(part=>part[0]).join('').slice(0,2).toUpperCase();const stage=item.notification_shown_at?'Notifikation vist':item.app_received_at?'App modtaget':item.push_sent_at?'Push sendt':'Afventer push';const status=item.response||'wait';return `<div class="crew-member"><span class="crew-avatar">${esc(initials)}</span><div><b>${esc(item.crew_name)}</b><small>${esc(stage)}</small></div><span class="response-pill ${status}">${labels[status]}</span></div>`}).join(''):crew.map(([initials,name,role])=>`<div class="crew-member"><span class="crew-avatar">${initials}</span><div><b>${esc(name)}</b><small>${esc(role)}</small></div><span class="response-pill ${responses[name]||'wait'}">${labels[responses[name]||'wait']}</span></div>`).join('');
  const alarms=read(STORAGE.alarms,[alarm]);document.querySelector('#mobile-history').innerHTML=alarms.slice(0,3).map(a=>`<div class="history-row"><b>${esc(a.type)}</b><span>${dateTime(a.createdAt)}</span></div>`).join('');
  document.querySelector('#metric-active').textContent=alarm?'1':'0';
  renderDelivery();
}

function renderDelivery(){
  const delivery=read(STORAGE.delivery,{});const steps=[['Oprettet',delivery.createdAt],['Sendt til push',delivery.pushSentAt],['Modtaget af app',delivery.appReceivedAt],['Notifikation vist',delivery.notificationShownAt]];
  document.querySelector('#delivery-track').innerHTML=steps.map(([label,at])=>`<div class="delivery-step ${at?'done':''}"><span>${at?'✓':'·'}</span><b>${label}</b><small>${at?time(at):'Afventer'}</small></div>`).join('');
}

function notify(alarm){
  if(!('Notification'in window)||Notification.permission!=='granted')return false;
  const title=`DSRS SAR-ALARM · ${alarm.type}`; const options={body:`${alarm.location}\n${alarm.message}`,icon:'icon-192.png',badge:'icon-192.png',tag:alarm.id,renotify:true,data:{url:location.origin+location.pathname+'#responder'}};
  if(navigator.serviceWorker?.controller)navigator.serviceWorker.controller.postMessage({type:'SHOW_ALARM',title,options});
  else new Notification(title,options);
  return true;
}

function receiveAlarm(alarm){
  const delivery=read(STORAGE.delivery,{alarmId:alarm.id});
  if(location.hash==='#responder'){
    if(!delivery.appReceivedAt){delivery.appReceivedAt=new Date().toISOString();addLog('Mandskabsappen kvitterede for modtagelse af alarmen.')}
    if(!delivery.notificationShownAt&&notify(alarm)){delivery.notificationShownAt=new Date().toISOString();addLog('Mandskabsappen kvitterede for afsendt/vis notifikation.')}
    write(STORAGE.delivery,delivery);channel?.postMessage({type:'delivery',delivery});
  }
  renderAlarm();showToast(`Ny alarm modtaget: ${alarm.type}`)
}

function collectAlarm(){const units=[...document.querySelectorAll('.unit-picker input:checked')].map(x=>x.value);if(!units.length)throw new Error('Vælg mindst én enhed.');return {type:document.querySelector('#alarm-type').value,priority:document.querySelector('#alarm-priority').value,location:document.querySelector('#alarm-location').value.trim(),message:document.querySelector('#alarm-message').value.trim(),units}}
async function dispatchRemote(alarm){try{const result=await api('dispatch',{method:'POST',body:alarm,csrf:csrfToken});const pushed=result.alarm;write(STORAGE.current,pushed);const alarms=read(STORAGE.alarms,[]);alarms.unshift(pushed);write(STORAGE.alarms,alarms.slice(0,30));write(STORAGE.delivery,{alarmId:pushed.id,createdAt:pushed.createdAt,pushSentAt:result.delivery.sent?new Date().toISOString():null,appReceivedAt:null,notificationShownAt:null});remoteDeliveries=[];addLog(`Alarm udsendt via Web Push: ${pushed.type} til ${result.delivery.sent}/${result.delivery.recipients} enheder.`);renderAlarm();showToast(`SAR-alarm sendt til ${result.delivery.sent} enheder.`);pollRemoteStatus()}catch(error){if(/login/i.test(error.message)){csrfToken=null;pendingDispatch=alarm;document.querySelector('#admin-dialog').showModal()}else showToast(error.message,true)}}

async function sendAlarm(event){
  event.preventDefault();
  let data;try{data=collectAlarm()}catch(error){showToast(error.message,true);return}
  if(backendOnline){if(!csrfToken){pendingDispatch=data;document.querySelector('#admin-dialog').showModal();return}await dispatchRemote(data);return}
  const alarm={id:crypto.randomUUID?.()||String(Date.now()),...data,createdAt:new Date().toISOString()};
  const now=new Date().toISOString();const alarms=read(STORAGE.alarms,[]);alarms.unshift(alarm);write(STORAGE.alarms,alarms.slice(0,30));write(STORAGE.delivery,{alarmId:alarm.id,createdAt:alarm.createdAt,pushSentAt:now,appReceivedAt:null,notificationShownAt:null});write(STORAGE.current,alarm);write(STORAGE.responses,Object.fromEntries(crew.map(x=>[x[1],'wait'])));
  addLog(`Alarm udsendt: ${alarm.type} til ${units.join(', ')}.`);channel?.postMessage({type:'alarm',alarm});renderAlarm();showToast(`Alarm udsendt til ${document.querySelector('#recipient-count').textContent} modtagere.`)
}

async function respond(status){
  const labels={accepted:'Accepteret',rejected:'Ej accepteret'};const responses=currentResponses();responses['Maja Andersen']=status;write(STORAGE.responses,responses);addLog(`Maja Andersen svarede: ${labels[status]}.`);channel?.postMessage({type:'response',status,name:'Maja Andersen'});renderAlarm();const box=document.querySelector('#response-confirmation');box.hidden=false;box.textContent=`Svar registreret · ${labels[status]}`;showToast('Din kvittering er sendt til kontrolcentralen.')
  const alarm=currentAlarm();if(alarm.deliveryToken)try{await api('receipt',{method:'POST',body:{deliveryToken:alarm.deliveryToken,stage:'response',response:status}})}catch(error){showToast(`Svaret kunne ikke sendes: ${error.message}`,true)}
}

function isResponderApp(){return isStandalone()||new URLSearchParams(location.search).has('app-preview')}
function updateViewportMetrics(){const viewport=window.visualViewport;const width=Math.round(viewport?.width||window.innerWidth);const height=Math.round(viewport?.height||window.innerHeight);document.documentElement.style.setProperty('--app-width',`${width}px`);document.documentElement.style.setProperty('--app-height',`${height}px`)}
function updateMobileIdentity(){const name=localStorage.getItem(DEVICE.name)||'Maja Andersen';const initials=name.split(/\s+/).filter(Boolean).map(part=>part[0]).join('').slice(0,2).toUpperCase()||'DS';const avatar=document.querySelector('#mobile-avatar');avatar.textContent=initials;avatar.setAttribute('aria-label',`Registreret som ${name}`);avatar.title=name}
function navigate(){
  const name=(location.hash.split('?')[0]||'#control').slice(1); const requested=['control','responder','roadmap'].includes(name)?name:'control';const view=isResponderApp()?'responder':requested;
  document.body.classList.toggle('responder-app-mode',isResponderApp()&&view==='responder');
  document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.dataset.view===view));
  document.querySelectorAll('[data-view-link]').forEach(x=>x.classList.toggle('active',x.dataset.viewLink===view));
  document.querySelector('#page-title').textContent={control:'SAR kontrolcentral',responder:'Besætningsapp',roadmap:'Udviklingsplan'}[view];document.querySelector('.sidebar').classList.remove('open');updateMobileIdentity();
}

async function enableNotifications(){
  if(!('Notification'in window)||!('serviceWorker'in navigator)||!('PushManager'in window)){showToast('Denne browser understøtter ikke Web Push.',true);return}
  if(!backendOnline||!backendConfig){showToast('Pilotbackenden er ikke tilgængelig endnu.',true);return}
  if(!localStorage.getItem(DEVICE.token)){document.querySelector('#device-dialog').showModal();return}
  const permission=await Notification.requestPermission();
  if(permission==='granted'){showToast('Pushnotifikationer er aktiveret.');document.querySelector('#notification-button').textContent='Pushnotifikationer aktiveret'}else showToast('Notifikationer blev ikke tilladt.',true)
}

function base64Key(value){const padding='='.repeat((4-value.length%4)%4);const raw=atob((value+padding).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...raw].map(char=>char.charCodeAt(0)))}
async function registerDevice(crewName,stationCode){
  if(!window.isSecureContext)throw new Error('Web Push kræver en sikker HTTPS-forbindelse.');
  if(isIOS()&&!isStandalone())throw new Error('På iPhone skal DSRS SAR først føjes til hjemmeskærmen og åbnes derfra.');
  if(!backendOnline||!backendConfig?.vapidPublicKey)throw new Error('Pilotbackenden er ikke tilgængelig. Kontrollér forbindelsen, og prøv igen.');
  setDeviceStatus('Venter på telefonens tilladelse til notifikationer …','working');
  const permission=await requestNotificationPermission();
  if(permission==='denied')throw new Error('Notifikationer er blokeret. Tillad dem for DSRS SAR i telefonens indstillinger, og prøv igen.');
  if(permission!=='granted')throw new Error('Notifikationer blev ikke tilladt. Tryk igen, og vælg Tillad.');
  setDeviceStatus('Starter telefonens sikre push-service …','working');
  const registration=await ensureServiceWorker();
  let subscription=await withTimeout(registration.pushManager.getSubscription(),10000,'Telefonens push-service svarede ikke. Luk appen helt, og prøv igen.');
  if(!subscription){
    setDeviceStatus('Opretter den krypterede pushforbindelse …','working');
    try{subscription=await withTimeout(registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:base64Key(backendConfig.vapidPublicKey)}),20000,'Telefonens push-tjeneste brugte for lang tid. Kontrollér internetforbindelsen, og prøv igen.')}catch(error){if(error?.name==='NotAllowedError')throw new Error('Telefonen afviste pushnotifikationer. Tillad notifikationer i telefonens indstillinger.');throw error}
  }
  setDeviceStatus('Registrerer telefonen hos DSRS SAR …','working');
  let deviceId=localStorage.getItem(DEVICE.id);if(!deviceId){deviceId=crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`;localStorage.setItem(DEVICE.id,deviceId)}
  const result=await withTimeout(api('subscribe',{method:'POST',body:{stationCode,crewName,deviceId,subscription:subscription.toJSON()}}),15000,'DSRS-serveren svarede ikke. Kontrollér internetforbindelsen, og prøv igen.');
  localStorage.setItem(DEVICE.token,result.deviceToken);localStorage.setItem(DEVICE.name,result.crewName);updateMobileIdentity();document.querySelector('#notification-button').textContent='Pushnotifikationer aktiveret';setDeviceStatus('Telefonen er registreret, og pushnotifikationer er aktiveret.','success');showToast('Denne telefon er registreret til DSRS SAR.');await loadCurrentAlarm()
}
async function loadCurrentAlarm(){const token=localStorage.getItem(DEVICE.token);if(!token||!backendOnline)return;try{const result=await api('current',{token});if(result.alarm){write(STORAGE.current,result.alarm);write(STORAGE.delivery,{alarmId:result.alarm.id,createdAt:result.alarm.createdAt,pushSentAt:result.delivery?.pushSentAt,appReceivedAt:result.delivery?.appReceivedAt,notificationShownAt:result.delivery?.notificationShownAt});renderAlarm()}}catch(error){if(/token/i.test(error.message)){localStorage.removeItem(DEVICE.token);document.querySelector('#notification-button').textContent='Aktivér pushnotifikationer'}}}
async function pollRemoteStatus(){if(!backendOnline||!csrfToken)return;try{const result=await api('status');if(result.alarm){write(STORAGE.current,result.alarm);remoteDeliveries=result.deliveries;const first=key=>result.deliveries.map(item=>item[key]).filter(Boolean).sort()[0]||null;write(STORAGE.delivery,{alarmId:result.alarm.id,createdAt:result.alarm.createdAt,pushSentAt:first('push_sent_at'),appReceivedAt:first('app_received_at'),notificationShownAt:first('notification_shown_at')});renderAlarm()}}catch(error){if(/login/i.test(error.message))csrfToken=null}}
async function initialiseBackend(){try{backendConfig=await api('config');backendOnline=true;const session=await api('session');csrfToken=session.authenticated?session.csrfToken:null;if(localStorage.getItem(DEVICE.token)){document.querySelector('#notification-button').textContent='Pushnotifikationer aktiveret';loadCurrentAlarm()}if(csrfToken)pollRemoteStatus()}catch{backendOnline=false}}

function isStandalone(){return window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true}
function isIOS(){return /iphone|ipad|ipod/i.test(navigator.userAgent)}

function updateInstallUI(){
  const button=document.querySelector('#install-button');
  const status=document.querySelector('#install-status');
  if(isStandalone()){
    button.hidden=true;
    status.textContent='✓ DSRS SAR er installeret på denne enhed.';
    status.classList.add('installed');
    return;
  }
  button.hidden=false;
  status.classList.remove('installed');
  status.textContent=isIOS()?'iPhone/iPad: Installer via Del-menuen.':'Installer appen for hurtig adgang fra hjemmeskærmen.';
}

function showInstallInstructions(){
  const dialog=document.querySelector('#install-dialog');
  const instructions=document.querySelector('#install-instructions');
  if(isIOS())instructions.innerHTML='<ol><li>Åbn siden i <b>Safari</b>.</li><li>Tryk på <b>Del</b>-ikonet.</li><li>Vælg <b>Føj til hjemmeskærm</b>.</li><li>Åbn derefter DSRS SAR fra hjemmeskærmen.</li></ol>';
  else instructions.innerHTML='<ol><li>Åbn browserens menu.</li><li>Vælg <b>Installer app</b> eller <b>Føj til startskærm</b>.</li><li>Bekræft installationen.</li></ol>';
  if(typeof dialog.showModal==='function')dialog.showModal();
  else showToast(instructions.textContent);
}

async function installApp(){
  if(!window.isSecureContext){showToast('Installation kræver en sikker HTTPS-forbindelse.',true);return}
  if(deferredPrompt){
    deferredPrompt.prompt();
    const {outcome}=await deferredPrompt.userChoice;
    deferredPrompt=null;
    if(outcome==='accepted')showToast('DSRS SAR installeres nu.');
    updateInstallUI();
    return;
  }
  showInstallInstructions();
}

function updateRecipients(){const values=[...document.querySelectorAll('.unit-picker input:checked')].map(x=>x.value);let count=values.includes('Hele stationen')?8:values.reduce((n,v)=>n+(v==='RS Køge'?4:v==='RHIB 01'?2:1),0);document.querySelector('#recipient-count').textContent=count}

updateViewportMetrics();ensureSeed();renderAlarm();renderLog();navigate();
window.addEventListener('hashchange',navigate);
window.addEventListener('resize',updateViewportMetrics,{passive:true});
window.addEventListener('orientationchange',updateViewportMetrics,{passive:true});
window.visualViewport?.addEventListener('resize',updateViewportMetrics,{passive:true});
window.addEventListener('storage',e=>{if(Object.values(STORAGE).includes(e.key)){renderAlarm();renderLog();if(e.key===STORAGE.current)receiveAlarm(currentAlarm())}});
channel?.addEventListener('message',e=>{if(e.data.type==='alarm')receiveAlarm(e.data.alarm);if(e.data.type==='response'){renderAlarm();renderLog();showToast(`${e.data.name} har kvitteret.`)}if(e.data.type==='delivery'){renderAlarm();renderLog()}});
document.querySelector('#alarm-form').addEventListener('submit',sendAlarm);
document.querySelectorAll('.unit-picker input').forEach(x=>x.addEventListener('change',updateRecipients));
document.querySelectorAll('[data-response]').forEach(x=>x.addEventListener('click',()=>respond(x.dataset.response)));
document.querySelector('#notification-button').addEventListener('click',enableNotifications);
document.querySelector('#new-tab-button').addEventListener('click',()=>window.open(location.origin+location.pathname+'#responder','alarmberedskab-app'));
document.querySelector('#open-app-button').addEventListener('click',()=>location.hash='responder');
document.querySelector('.menu-button').addEventListener('click',()=>document.querySelector('.sidebar').classList.toggle('open'));
document.querySelector('#clear-demo').addEventListener('click',()=>{Object.values(STORAGE).forEach(k=>localStorage.removeItem(k));ensureSeed();renderAlarm();renderLog();showToast('Demoen er nulstillet.')});
document.querySelector('#admin-form').addEventListener('submit',async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;try{const result=await api('login',{method:'POST',body:{code:document.querySelector('#admin-code').value}});csrfToken=result.csrfToken;document.querySelector('#admin-code').value='';document.querySelector('#admin-dialog').close();showToast('Kontrolcentralen er logget ind.');if(pendingDispatch){const alarm=pendingDispatch;pendingDispatch=null;await dispatchRemote(alarm)}else pollRemoteStatus()}catch(error){showToast(error.message,true)}finally{button.disabled=false}});
document.querySelector('#device-form').addEventListener('submit',async event=>{event.preventDefault();const button=event.submitter||event.currentTarget.querySelector('[type="submit"]');const originalLabel=button.textContent;button.disabled=true;button.textContent='Aktiverer push …';try{await registerDevice(document.querySelector('#crew-name').value.trim(),document.querySelector('#station-code').value);document.querySelector('#station-code').value='';setTimeout(()=>document.querySelector('#device-dialog').close(),900)}catch(error){const message=error?.message||'Telefonen kunne ikke registreres.';setDeviceStatus(message,'error');showToast(message,true)}finally{button.disabled=false;button.textContent=originalLabel}});
document.querySelector('#device-dialog-close').addEventListener('click',()=>document.querySelector('#device-dialog').close());
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter'&&location.hash!=='#responder')document.querySelector('#alarm-form').requestSubmit()});
function updateClocks(){const now=new Date();document.querySelector('#clock').textContent=new Intl.DateTimeFormat('da-DK',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(now);document.querySelector('#mobile-clock').textContent=new Intl.DateTimeFormat('da-DK',{hour:'2-digit',minute:'2-digit'}).format(now)}
updateClocks();setInterval(updateClocks,1000);
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;updateInstallUI()});
window.addEventListener('appinstalled',()=>{deferredPrompt=null;updateInstallUI();showToast('DSRS SAR er installeret.')});
document.querySelector('#install-button').addEventListener('click',installApp);
updateInstallUI();
if('serviceWorker'in navigator)ensureServiceWorker().catch(()=>showToast('Appens offline-funktion kunne ikke startes.',true));
navigator.serviceWorker?.addEventListener('message',event=>{if(event.data?.type==='push-alarm'&&event.data.payload?.alarm){const alarm={...event.data.payload.alarm,deliveryToken:event.data.payload.deliveryToken};write(STORAGE.current,alarm);write(STORAGE.delivery,{alarmId:alarm.id,createdAt:alarm.createdAt,pushSentAt:new Date().toISOString(),appReceivedAt:new Date().toISOString(),notificationShownAt:new Date().toISOString()});renderAlarm();showToast(`Ny SAR-alarm: ${alarm.type}`)}});
initialiseBackend();
setInterval(()=>{if((location.hash||'#control').startsWith('#control'))pollRemoteStatus()},3000);
