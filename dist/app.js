const STORAGE = { alarms: 'ab.alarms.v1', current: 'ab.current.v1', responses: 'ab.responses.v1', delivery: 'ab.delivery.v1', logs: 'ab.logs.v1' };
const channel = 'BroadcastChannel' in window ? new BroadcastChannel('alarmberedskab') : null;
const crew = [
  ['MA','Maja Andersen','Røgdykker','accepted'],['JL','Jonas Lund','Holdleder','wait'],['SK','Sara Kjær','Chauffør','accepted'],['MN','Mikkel Nielsen','Røgdykker','accepted'],
  ['EF','Emil Friis','Brandmand','accepted'],['LH','Line Holm','Brandmand','wait'],['TB','Thomas Bruun','Brandmand','accepted'],['AP','Anna Poulsen','Brandmand','rejected']
];
const seedAlarm = {id:'demo-001',type:'Bygningsbrand',priority:'critical',location:'Havnevej 14, 4600 Køge',message:'Røg fra tagkonstruktion. Personer meldes ude. Indsatsleder på vej.',units:['Hold 1','Tankvogn'],createdAt:new Date(Date.now()-240000).toISOString()};
let deferredPrompt;

function read(key, fallback){ try{return JSON.parse(localStorage.getItem(key)) ?? fallback}catch{return fallback} }
function write(key,value){localStorage.setItem(key,JSON.stringify(value))}
function esc(value=''){return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function currentAlarm(){return read(STORAGE.current,seedAlarm)}
function currentResponses(){return read(STORAGE.responses,Object.fromEntries(crew.map(x=>[x[1],x[3]])))}
function time(value){return new Intl.DateTimeFormat('da-DK',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(value))}
function dateTime(value){return new Intl.DateTimeFormat('da-DK',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(value))}
function showToast(message,error=false){const el=document.querySelector('#toast');el.textContent=message;el.className='toast show'+(error?' error':'');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>el.className='toast',3200)}

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
  const counts={accepted:0,rejected:0,wait:0};Object.values(responses).forEach(x=>counts[x]=(counts[x]||0)+1);
  Object.entries(counts).forEach(([k,v])=>{const el=document.querySelector('#response-'+k);if(el)el.textContent=v});
  const total=Math.max(1,Object.keys(responses).length); document.querySelector('#response-progress').style.width=`${Math.min(100,((total-counts.wait)/total)*100)}%`;
  const labels={accepted:'Accepteret',rejected:'Ej accepteret',wait:'Afventer'};
  document.querySelector('#crew-list').innerHTML=crew.map(([initials,name,role])=>`<div class="crew-member"><span class="crew-avatar">${initials}</span><div><b>${esc(name)}</b><small>${esc(role)}</small></div><span class="response-pill ${responses[name]||'wait'}">${labels[responses[name]||'wait']}</span></div>`).join('');
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
  const title=`ALARM · ${alarm.type}`; const options={body:`${alarm.location}\n${alarm.message}`,icon:'icon.svg',badge:'icon.svg',tag:alarm.id,renotify:true,data:{url:location.origin+location.pathname+'#responder'}};
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

function sendAlarm(event){
  event.preventDefault();
  const units=[...document.querySelectorAll('.unit-picker input:checked')].map(x=>x.value);
  if(!units.length){showToast('Vælg mindst én enhed.',true);return}
  const alarm={id:crypto.randomUUID?.()||String(Date.now()),type:document.querySelector('#alarm-type').value,priority:document.querySelector('#alarm-priority').value,location:document.querySelector('#alarm-location').value.trim(),message:document.querySelector('#alarm-message').value.trim(),units,createdAt:new Date().toISOString()};
  const now=new Date().toISOString();const alarms=read(STORAGE.alarms,[]);alarms.unshift(alarm);write(STORAGE.alarms,alarms.slice(0,30));write(STORAGE.delivery,{alarmId:alarm.id,createdAt:alarm.createdAt,pushSentAt:now,appReceivedAt:null,notificationShownAt:null});write(STORAGE.current,alarm);write(STORAGE.responses,Object.fromEntries(crew.map(x=>[x[1],'wait'])));
  addLog(`Alarm udsendt: ${alarm.type} til ${units.join(', ')}.`);channel?.postMessage({type:'alarm',alarm});renderAlarm();showToast(`Alarm udsendt til ${document.querySelector('#recipient-count').textContent} modtagere.`)
}

function respond(status){
  const labels={accepted:'Accepteret',rejected:'Ej accepteret'};const responses=currentResponses();responses['Maja Andersen']=status;write(STORAGE.responses,responses);addLog(`Maja Andersen svarede: ${labels[status]}.`);channel?.postMessage({type:'response',status,name:'Maja Andersen'});renderAlarm();const box=document.querySelector('#response-confirmation');box.hidden=false;box.textContent=`Svar registreret · ${labels[status]}`;showToast('Din kvittering er sendt til kontrolcentralen.')
}

function navigate(){
  const name=(location.hash||'#control').slice(1); const view=['control','responder','roadmap'].includes(name)?name:'control';
  document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.dataset.view===view));
  document.querySelectorAll('[data-view-link]').forEach(x=>x.classList.toggle('active',x.dataset.viewLink===view));
  document.querySelector('#page-title').textContent={control:'Kontrolcentral',responder:'Mandskabsapp',roadmap:'Projektmapping'}[view];document.querySelector('.sidebar').classList.remove('open');
}

async function enableNotifications(){
  if(!('Notification'in window)){showToast('Denne browser understøtter ikke notifikationer.',true);return}
  const permission=await Notification.requestPermission();
  if(permission==='granted'){showToast('Pushnotifikationer er aktiveret.');document.querySelector('#notification-button').textContent='Pushnotifikationer aktiveret';notify(currentAlarm())}
  else showToast('Notifikationer blev ikke tilladt.',true)
}

function updateRecipients(){const values=[...document.querySelectorAll('.unit-picker input:checked')].map(x=>x.value);let count=values.includes('Alle')?16:values.reduce((n,v)=>n+(v==='Hold 1'?6:v==='Tankvogn'?2:1),0);document.querySelector('#recipient-count').textContent=count}

ensureSeed();renderAlarm();renderLog();navigate();
window.addEventListener('hashchange',navigate);
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
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter'&&location.hash!=='#responder')document.querySelector('#alarm-form').requestSubmit()});
setInterval(()=>document.querySelector('#clock').textContent=new Intl.DateTimeFormat('da-DK',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date()),1000);
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;document.querySelector('#install-button').hidden=false});
document.querySelector('#install-button').addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;document.querySelector('#install-button').hidden=true});
if('serviceWorker'in navigator)navigator.serviceWorker.register('service-worker.js').catch(()=>{});
