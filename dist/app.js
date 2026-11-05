const STORAGE = { alarms: 'dsrs.alarms.v2', current: 'dsrs.current.v2', responses: 'dsrs.responses.v2', delivery: 'dsrs.delivery.v2', logs: 'dsrs.logs.v2' };
const API = 'api/index.php';
const DEVICE = { token: 'dsrs.deviceToken.v1', id: 'dsrs.deviceId.v1', name: 'dsrs.crewName.v1', station: 'dsrs.stationId.v1', stationName: 'dsrs.stationName.v1', repair: 'dsrs.deviceRepair.v1' };
const channel = 'BroadcastChannel' in window ? new BroadcastChannel('alarmberedskab') : null;
const crew = [
  ['MA','Maja Andersen','Skipper','accepted'],['JL','Jonas Lund','Navigatør','wait'],['SK','Sara Kjær','Bådfører','accepted'],['MN','Mikkel Nielsen','Søredder','accepted'],
  ['EF','Emil Friis','Søredder','accepted'],['LH','Line Holm','Maskinansvarlig','wait'],['TB','Thomas Bruun','Søredder','accepted'],['AP','Anna Poulsen','Søredder','rejected']
];
const fallbackStations = [
  {id:'station-helsingoer',name:'DSRS Helsingør',shortName:'Helsingør',vessels:[]},{id:'station-bregnoer',name:'DSRS Bregnør',shortName:'Bregnør',vessels:[]},{id:'station-lynaes',name:'DSRS Lynæs',shortName:'Lynæs',vessels:[]},{id:'station-rudkoebing',name:'DSRS Rudkøbing',shortName:'Rudkøbing',vessels:[]},{id:'station-juelsminde',name:'DSRS Juelsminde',shortName:'Juelsminde',vessels:[]},{id:'station-koebenhavn',name:'DSRS København',shortName:'København',vessels:[]},{id:'station-loegstoer',name:'DSRS Løgstør',shortName:'Løgstør',vessels:[]},{id:'station-vordingborg',name:'DSRS Vordingborg',shortName:'Vordingborg',vessels:[]},
  {id:'station-koege',name:'DSRS Køge',shortName:'Køge',vessels:[{id:'vessel-rs-koege',name:'RS Køge',type:'Redningsfartøj',crewRequired:4},{id:'vessel-rhib-01',name:'RHIB 01',type:'RHIB',crewRequired:2}]},{id:'station-kerteminde',name:'DSRS Kerteminde',shortName:'Kerteminde',vessels:[]},{id:'station-assens-lillebaelt',name:'DSRS Assens-Lillebælt',shortName:'Assens-Lillebælt',vessels:[]},{id:'station-faaborg',name:'DSRS Faaborg',shortName:'Faaborg',vessels:[]},{id:'station-struer',name:'DSRS Struer',shortName:'Struer',vessels:[]},{id:'station-faxe-ladeplads',name:'DSRS Faxe Ladeplads',shortName:'Faxe Ladeplads',vessels:[]}
];
const seedAlarm = {id:'demo-001',stationId:'station-koege',stationName:'DSRS Køge',vesselIds:['vessel-rs-koege','vessel-rhib-01'],type:'Fartøj i nød',priority:'high',location:"55°27.90'N · 12°12.45'E · Køge Bugt",message:'Sejlbåd med motorstop og drivende mod sydøst. 3 personer ombord, alle bærer redningsvest. Vind 8 m/s V.',units:['RS Køge','RHIB 01'],createdAt:new Date(Date.now()-240000).toISOString()};
let deferredPrompt;
let backendConfig=null;
let backendOnline=false;
let csrfToken=null;
let remoteDeliveries=null;
let remoteActiveCount=null;
let pendingDispatch=null;
let pendingCompletion=false;
let serviceWorkerRegistrationPromise=null;
let deviceRenewalPromise=null;
let alarmAudioContext=null;
let alarmOscillator=null;
let alarmGain=null;
let alarmSoundTimer=null;
let alarmAudioElement=null;
let alarmAudioUrl=null;

function withTimeout(promise,milliseconds,message){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error(message)),milliseconds);Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value)},error=>{clearTimeout(timer);reject(error)})})}
function setDeviceStatus(message,state=''){const status=document.querySelector('#device-status');if(!status)return;status.textContent=message;status.className=`device-status${state?' '+state:''}`}
function setNotificationButtonLabel(label){document.querySelectorAll('[data-notification-action]').forEach(button=>button.textContent=label)}
function updateMobilePairing(){const card=document.querySelector('#mobile-pairing-card');const title=document.querySelector('#mobile-pairing-title');const status=document.querySelector('#mobile-pairing-status');if(!card||!title||!status)return;const token=localStorage.getItem(DEVICE.token);const repair=localStorage.getItem(DEVICE.repair)==='1';const permission='Notification'in window?Notification.permission:'unsupported';const stationName=localStorage.getItem(DEVICE.stationName)||stationById(localStorage.getItem(DEVICE.station)||'station-koege')?.name||'DSRS Køge';card.classList.toggle('connected',Boolean(token)&&!repair&&permission==='granted');card.classList.toggle('repair',repair);if(repair){title.textContent='Pushforbindelsen skal genaktiveres';status.textContent=`Tryk Genaktivér for at forbinde mobilen til ${stationName} igen.`;setNotificationButtonLabel('Genaktivér push')}else if(token&&permission==='granted'){title.textContent='Mobilen er parret';status.textContent=`Push og kvitteringer er aktive for ${stationName}.`;setNotificationButtonLabel('Pushnotifikationer aktiveret')}else if(token){title.textContent='Tillad notifikationer';status.textContent='Telefonen er kendt, men notifikationer skal tillades på denne enhed.';setNotificationButtonLabel('Tillad notifikationer')}else{title.textContent='Mobilen er ikke parret';status.textContent='Par mobilen for at modtage SAR-alarmer og sende kvitteringer.';setNotificationButtonLabel('Par denne mobil')}}
function openDeviceDialog(){const savedName=localStorage.getItem(DEVICE.name);const savedStation=localStorage.getItem(DEVICE.station);if(savedName)document.querySelector('#crew-name').value=savedName;if(savedStation)document.querySelector('#device-station').value=savedStation;document.querySelector('#device-dialog').showModal()}
function ensureServiceWorker(){if(!('serviceWorker'in navigator))return Promise.reject(new Error('Denne browser understøtter ikke appens push-service.'));if(!serviceWorkerRegistrationPromise)serviceWorkerRegistrationPromise=navigator.serviceWorker.register('service-worker.js',{scope:'./'}).then(registration=>{if(registration.waiting)registration.waiting.postMessage({type:'SKIP_WAITING'});return navigator.serviceWorker.ready});return withTimeout(serviceWorkerRegistrationPromise,15000,'Appens push-service svarede ikke. Luk appen helt, åbn den igen, og prøv på ny.')}
function requestNotificationPermission(){if(Notification.permission!=='default')return Promise.resolve(Notification.permission);return withTimeout(new Promise((resolve,reject)=>{let settled=false;const finish=value=>{if(settled)return;settled=true;resolve(value||Notification.permission)};try{const result=Notification.requestPermission(finish);if(result&&typeof result.then==='function')result.then(finish,reject)}catch(error){reject(error)}}),45000,'Telefonens spørgsmål om notifikationer blev ikke besvaret. Prøv igen, og vælg Tillad i telefonens dialog.')}
function soundStatus(message,ready=false){const status=document.querySelector('#sound-status');if(status)status.textContent=message;const button=document.querySelector('#sound-test-button');if(button)button.classList.toggle('testing',ready)}
function audioContext(){const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return null;if(!alarmAudioContext)alarmAudioContext=new Context();return alarmAudioContext}
function createAlarmWav(){const sampleRate=12000;const seconds=4.8;const samples=Math.floor(sampleRate*seconds);const buffer=new ArrayBuffer(44+samples*2);const view=new DataView(buffer);const text=(offset,value)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i))};text(0,'RIFF');view.setUint32(4,36+samples*2,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,samples*2,true);for(let i=0;i<samples;i++){const t=i/sampleRate;const pulse=t%.48;const frequency=Math.floor(t/.48)%2===0?720:940;const attack=Math.min(1,pulse/.045);const release=Math.min(1,Math.max(0,(.44-pulse)/.08));const envelope=pulse<.44?Math.min(attack,release):0;const sample=Math.sin(2*Math.PI*frequency*t)*envelope*.48;view.setInt16(44+i*2,Math.max(-1,Math.min(1,sample))*32767,true)}return new Blob([buffer],{type:'audio/wav'})}
function alarmAudio(){if(alarmAudioElement)return alarmAudioElement;alarmAudioUrl=URL.createObjectURL(createAlarmWav());alarmAudioElement=new Audio(alarmAudioUrl);alarmAudioElement.preload='auto';alarmAudioElement.loop=true;alarmAudioElement.playsInline=true;return alarmAudioElement}
async function primeAlarmSound(){let htmlReady=false;try{const audio=alarmAudio();audio.muted=true;audio.currentTime=0;await audio.play();audio.pause();audio.currentTime=0;audio.muted=false;audio.volume=1;htmlReady=true}catch{}const context=audioContext();let webReady=false;try{if(context?.state==='suspended')await context.resume();webReady=context?.state==='running'}catch{}const ready=htmlReady||webReady;soundStatus(ready?'Alarmlyd er klar · Telefonens lydløs/Fokus kan overstyre baggrundslyd.':'Telefonen blokerede lyd. Tryk Test lyd og kontrollér medielyd.',ready);return ready}
function stopAlarmSound(){clearTimeout(alarmSoundTimer);alarmSoundTimer=null;if(alarmAudioElement){alarmAudioElement.pause();try{alarmAudioElement.currentTime=0}catch{}}if(alarmOscillator){try{alarmOscillator.stop()}catch{}alarmOscillator.disconnect();alarmOscillator=null}if(alarmGain){alarmGain.disconnect();alarmGain=null}navigator.vibrate?.(0)}
function startWebAudioFallback(duration){const context=audioContext();if(!context||context.state!=='running')return false;const start=context.currentTime+.03;const oscillator=context.createOscillator();const gain=context.createGain();oscillator.type='sine';oscillator.connect(gain);gain.connect(context.destination);gain.gain.setValueAtTime(.0001,start);for(let offset=0;offset<duration;offset+=.48){oscillator.frequency.setValueAtTime((Math.floor(offset/.48)%2===0)?720:940,start+offset);gain.gain.setValueAtTime(.0001,start+offset);gain.gain.exponentialRampToValueAtTime(.24,start+offset+.06);gain.gain.setValueAtTime(.24,start+offset+.30);gain.gain.exponentialRampToValueAtTime(.0001,start+offset+.44)}oscillator.start(start);oscillator.stop(start+duration);alarmOscillator=oscillator;alarmGain=gain;return true}
async function startAlarmSound(test=false){stopAlarmSound();const duration=test?4.8:24;let started=false;try{const audio=alarmAudio();audio.muted=false;audio.volume=1;audio.currentTime=0;await audio.play();started=!audio.paused}catch{}if(!started){await primeAlarmSound();started=startWebAudioFallback(duration)}if(!started){soundStatus('Ingen lyd kunne afspilles. Skru op for medielyd, slå lydløs/Fokus fra og tryk Test lyd igen.');showToast('Telefonen blokerer alarmlyden.',true);return false}navigator.vibrate?.(test?[350,150,350]:[700,220,700,220,1100,300,700]);alarmSoundTimer=setTimeout(()=>{stopAlarmSound();soundStatus('Alarmlyd er klar · Telefonens lydløs/Fokus kan overstyre baggrundslyd.',true)},duration*1000+200);soundStatus(test?'Alarmlyden afspilles nu — kan du ikke høre den, så skru op for medielyd.':'SAR-alarmlyd aktiv.',true);return true}
function startAlarmSoundOnce(alarm){if(!alarm?.id||sessionStorage.getItem('dsrs.lastSoundAlarm.v1')===alarm.id)return;sessionStorage.setItem('dsrs.lastSoundAlarm.v1',alarm.id);startAlarmSound(false)}
function clearAppBadge(){const result=navigator.clearAppBadge?.();result?.catch?.(()=>null)}

function read(key, fallback){ try{return JSON.parse(localStorage.getItem(key)) ?? fallback}catch{return fallback} }
function write(key,value){localStorage.setItem(key,JSON.stringify(value))}
function esc(value=''){return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function currentAlarm(){const raw=localStorage.getItem(STORAGE.current);if(raw===null)return seedAlarm;try{return JSON.parse(raw)}catch{return seedAlarm}}
function currentResponses(){return read(STORAGE.responses,Object.fromEntries(crew.map(x=>[x[1],x[3]])))}
function time(value){return new Intl.DateTimeFormat('da-DK',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(value))}
function dateTime(value){return new Intl.DateTimeFormat('da-DK',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(value))}
function showToast(message,error=false){const el=document.querySelector('#toast');el.textContent=message;el.className='toast show'+(error?' error':'');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>el.className='toast',3200)}
async function api(action,{method='GET',body,token,csrf,query={}}={}){const headers={Accept:'application/json'};if(body!==undefined)headers['Content-Type']='application/json';if(token)headers.Authorization=`Bearer ${token}`;if(csrf)headers['X-CSRF-Token']=csrf;const parameters=new URLSearchParams({action,...query});const response=await fetch(`${API}?${parameters}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body),credentials:'same-origin'});const data=await response.json().catch(()=>({ok:false,error:'Ugyldigt svar fra serveren.'}));if(!response.ok)throw new Error(data.error||`Serverfejl ${response.status}`);return data}

function stations(){return Array.isArray(backendConfig?.stations)&&backendConfig.stations.length?backendConfig.stations:fallbackStations}
function stationById(id){return stations().find(station=>station.id===id)||stations().find(station=>station.id==='station-koege')||stations()[0]}
function selectedControlStation(){return stationById(document.querySelector('#dispatch-station')?.value||'station-koege')}
function optionMarkup(items,selected){return items.map(item=>`<option value="${esc(item.id)}"${item.id===selected?' selected':''}>${esc(item.name)}</option>`).join('')}
function renderVessels(){const station=selectedControlStation();const picker=document.querySelector('#unit-picker');if(!picker||!station)return;const vessels=station.vessels||[];const vesselLabels=vessels.map((vessel,index)=>`<label><input type="checkbox" value="${esc(vessel.name)}" data-vessel-id="${esc(vessel.id)}"${index<2?' checked':''}><span><b>${esc(vessel.type==='RHIB'?'RH':vessel.name.split(/\s+/).map(word=>word[0]).join('').slice(0,2).toUpperCase())}</b><em>${esc(vessel.name)}</em><small>${Number(vessel.crewRequired)||1} personer</small></span></label>`).join('');picker.innerHTML=vesselLabels+`<label><input type="checkbox" value="Hele stationen"><span><b>∞</b><em>Hele stationen</em><small>Alle registrerede</small></span></label>`+(vessels.length?'':'<p class="empty-fleet">Ingen fartøjer er oprettet på stationen endnu. Hele stationen kan stadig alarmeres.</p>');picker.querySelectorAll('input').forEach(input=>input.addEventListener('change',updateRecipients));updateRecipients();updateStationLabels(station)}
function populateStations(){const control=document.querySelector('#dispatch-station');const device=document.querySelector('#device-station');const controlSelection=control?.value||'station-koege';const deviceSelection=localStorage.getItem(DEVICE.station)||device?.value||'station-koege';if(control){control.innerHTML=optionMarkup(stations(),controlSelection);if(!control.value)control.value='station-koege'}if(device){device.innerHTML=optionMarkup(stations(),deviceSelection);if(!device.value)device.value='station-koege'}renderVessels();updateMobileIdentity()}
function updateStationLabels(station=selectedControlStation()){const label=document.querySelector('#station-chip-label');if(label&&station)label.textContent=`STATION ${station.shortName||station.name.replace(/^DSRS\s+/,'')}`}

function ensureSeed(){
  if(!localStorage.getItem(STORAGE.current)){const now=new Date().toISOString();write(STORAGE.current,seedAlarm);write(STORAGE.alarms,[seedAlarm]);write(STORAGE.responses,Object.fromEntries(crew.map(x=>[x[1],x[3]])));write(STORAGE.delivery,{alarmId:seedAlarm.id,createdAt:seedAlarm.createdAt,pushSentAt:seedAlarm.createdAt,appReceivedAt:now,notificationShownAt:now});write(STORAGE.logs,[{at:now,text:'Demoalarm indlæst i kontrolcentralen.'}])}
}

function addLog(text){const logs=read(STORAGE.logs,[]);logs.unshift({at:new Date().toISOString(),text});write(STORAGE.logs,logs.slice(0,12));renderLog()}
function renderLog(){const logs=read(STORAGE.logs,[]);document.querySelector('#event-log').innerHTML=logs.length?logs.slice(0,6).map(x=>`<div class="log-item"><span class="log-time">${time(x.at)}</span><p>${esc(x.text)}</p></div>`).join(''):'<p class="muted">Ingen hændelser endnu.</p>'}

function renderAlarm(){
  const alarm=currentAlarm(); const responses=currentResponses();
  const summary=document.querySelector('#latest-alarm-summary');
  const mobile=document.querySelector('#mobile-alarm');
  const responseButtons=[...document.querySelectorAll('[data-response]')];
  const completeButton=document.querySelector('#complete-alarm-button');
  const alarms=read(STORAGE.alarms,[]);
  document.querySelector('#mobile-history').innerHTML=alarms.length?alarms.slice(0,3).map(a=>`<div class="history-row"><b>${esc(a.type)}</b><span>${dateTime(a.createdAt)}</span></div>`).join(''):'<p class="muted">Ingen tidligere hændelser.</p>';
  document.querySelector('#metric-active').textContent=String(remoteActiveCount??(alarm?1:0));
  responseButtons.forEach(button=>button.disabled=!alarm);if(completeButton)completeButton.disabled=!alarm;
  if(!alarm){
    summary.classList.add('empty');summary.innerHTML='<b>Ingen aktiv SAR-alarm</b><time>Klar</time><p>Kontrolcentralen afventer en ny hændelse.</p>';
    const stationName=localStorage.getItem(DEVICE.stationName)||selectedControlStation()?.name||'DSRS Køge';mobile.classList.add('empty');mobile.innerHTML=`<div class="alarm-kicker"><span>KLAR</span><time>BEREDSKAB</time></div><h3>Ingen aktiv alarm</h3><p class="location">◉ ${esc(stationName)}</p><p class="message">Du er i beredskab. En ny SAR-alarm vises automatisk her.</p>`;
    ['accepted','rejected','wait'].forEach(key=>{const el=document.querySelector('#response-'+key);if(el)el.textContent='0'});document.querySelector('#response-progress').style.width='0%';document.querySelector('#crew-list').innerHTML='<p class="muted">Ingen aktiv alarm at kvittere på.</p>';document.querySelector('#response-confirmation').hidden=true;renderDelivery();return;
  }
  summary.classList.remove('empty');mobile.classList.remove('empty');
  summary.innerHTML=`<b>${esc(alarm.type)}</b><time>${time(alarm.createdAt)}</time><p>${esc(alarm.stationName||'DSRS Køge')} · ⌖ ${esc(alarm.location)} · ${esc(alarm.units.join(' + '))}</p>`;
  mobile.innerHTML=`<div class="alarm-kicker"><span>${esc(alarm.priority==='test'?'TESTALARM':'ALARM · '+alarm.priority.toUpperCase())}</span><time>${time(alarm.createdAt)}</time></div><h3>${esc(alarm.type)}</h3><p class="location">⌖ ${esc(alarm.location)}</p><p class="message">${esc(alarm.message || 'Ingen supplerende melding.')}</p><div class="units">${alarm.units.map(u=>`<span>${esc(u)}</span>`).join('')}</div>`;
  const counts={accepted:0,rejected:0,wait:0};if(remoteDeliveries)remoteDeliveries.forEach(item=>counts[item.response||'wait']++);else Object.values(responses).forEach(x=>counts[x]=(counts[x]||0)+1);
  Object.entries(counts).forEach(([k,v])=>{const el=document.querySelector('#response-'+k);if(el)el.textContent=v});
  const total=Math.max(1,Object.keys(responses).length); document.querySelector('#response-progress').style.width=`${Math.min(100,((total-counts.wait)/total)*100)}%`;
  const labels={accepted:'Accepteret',rejected:'Ej accepteret',wait:'Afventer'};
  document.querySelector('#crew-list').innerHTML=remoteDeliveries?remoteDeliveries.map(item=>{const initials=item.crew_name.split(/\s+/).map(part=>part[0]).join('').slice(0,2).toUpperCase();const stage=item.notification_shown_at?'Notifikation vist':item.app_received_at?'App modtaget':item.push_sent_at?'Push sendt':'Afventer push';const status=item.response||'wait';return `<div class="crew-member"><span class="crew-avatar">${esc(initials)}</span><div><b>${esc(item.crew_name)}</b><small>${esc(stage)}</small></div><span class="response-pill ${status}">${labels[status]}</span></div>`}).join(''):crew.map(([initials,name,role])=>`<div class="crew-member"><span class="crew-avatar">${initials}</span><div><b>${esc(name)}</b><small>${esc(role)}</small></div><span class="response-pill ${responses[name]||'wait'}">${labels[responses[name]||'wait']}</span></div>`).join('');
  renderDelivery();
}

function renderDelivery(){
  const alarm=currentAlarm();const delivery=alarm?read(STORAGE.delivery,{}):{};const steps=[['Oprettet',delivery.createdAt],['Sendt til push',delivery.pushSentAt],['Modtaget af app',delivery.appReceivedAt],['Notifikation vist',delivery.notificationShownAt]];
  document.querySelector('#delivery-track').innerHTML=steps.map(([label,at])=>`<div class="delivery-step ${at?'done':''}"><span>${at?'✓':'·'}</span><b>${label}</b><small>${at?time(at):alarm?'Afventer':'Ingen aktiv'}</small></div>`).join('');
}

function notify(alarm){
  if(!('Notification'in window)||Notification.permission!=='granted')return false;
  const title=`DSRS SAR-ALARM · ${alarm.type}`; const options={body:`${alarm.location}\n${alarm.message}`,icon:'icon-192.png',badge:'icon-192.png',tag:alarm.id,renotify:true,requireInteraction:true,silent:false,vibrate:[700,220,700,220,1100],timestamp:Date.now(),data:{url:location.origin+location.pathname+'#responder?alert=1'}};
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
  renderAlarm();startAlarmSoundOnce(alarm);showToast(`Ny alarm modtaget: ${alarm.type}`)
}

function collectAlarm(){const selected=[...document.querySelectorAll('.unit-picker input:checked')];const units=selected.map(input=>input.value);const vesselIds=selected.map(input=>input.dataset.vesselId).filter(Boolean);if(!units.length)throw new Error('Vælg mindst ét fartøj eller hele stationen.');return {stationId:selectedControlStation().id,vesselIds,type:document.querySelector('#alarm-type').value,priority:document.querySelector('#alarm-priority').value,location:document.querySelector('#alarm-location').value.trim(),message:document.querySelector('#alarm-message').value.trim(),units}}
async function dispatchRemote(alarm){try{const result=await api('dispatch',{method:'POST',body:alarm,csrf:csrfToken});const pushed=result.alarm;write(STORAGE.current,pushed);const alarms=read(STORAGE.alarms,[]);alarms.unshift(pushed);write(STORAGE.alarms,alarms.slice(0,30));write(STORAGE.delivery,{alarmId:pushed.id,createdAt:pushed.createdAt,pushSentAt:result.delivery.sent?new Date().toISOString():null,appReceivedAt:null,notificationShownAt:null});remoteDeliveries=[];addLog(`Alarm udsendt via Web Push: ${pushed.type} til ${result.delivery.sent}/${result.delivery.recipients} enheder.`);renderAlarm();showToast(`SAR-alarm sendt til ${result.delivery.sent} enheder.`);pollRemoteStatus()}catch(error){if(/login/i.test(error.message)){csrfToken=null;pendingDispatch=alarm;document.querySelector('#admin-dialog').showModal()}else showToast(error.message,true)}}

function clearActiveAlarm(message='Alarmen er afsluttet.',broadcast=true){const alarm=currentAlarm();write(STORAGE.current,null);write(STORAGE.delivery,{});remoteDeliveries=[];stopAlarmSound();clearAppBadge();navigator.serviceWorker?.controller?.postMessage({type:'CLEAR_ALARM',tag:alarm?.id||null});sessionStorage.removeItem('dsrs.lastSoundAlarm.v1');renderAlarm();if(message){addLog(alarm?.id?`${message} (${alarm.type})`:message);showToast(message)}if(broadcast)channel?.postMessage({type:'completed',alarmId:alarm?.id||null})}
async function completeRemoteAlarm(confirmed=false){const alarm=currentAlarm();if(!alarm){showToast('Der er ingen aktiv alarm at afslutte.');return}if(!confirmed&&!confirm(`Afslut den aktive alarm "${alarm.type}"? Alarmen fjernes fra alle registrerede apps.`))return;if(backendOnline){if(!csrfToken){pendingCompletion=true;document.querySelector('#admin-dialog').showModal();return}try{await api('complete',{method:'POST',body:{alarmId:alarm.id,stationId:alarm.stationId||selectedControlStation().id},csrf:csrfToken});clearActiveAlarm('SAR-alarmen er afsluttet.');return}catch(error){if(/login/i.test(error.message)){csrfToken=null;pendingCompletion=true;document.querySelector('#admin-dialog').showModal();return}if(/ingen aktiv alarm/i.test(error.message)){clearActiveAlarm('Der er ingen aktiv SAR-alarm.');return}showToast(error.message,true);return}}clearActiveAlarm('Den lokale demoalarm er afsluttet.')}

async function sendAlarm(event){
  event.preventDefault();
  let data;try{data=collectAlarm()}catch(error){showToast(error.message,true);return}
  if(backendOnline){if(!csrfToken){pendingDispatch=data;document.querySelector('#admin-dialog').showModal();return}await dispatchRemote(data);return}
  const alarm={id:crypto.randomUUID?.()||String(Date.now()),stationName:selectedControlStation().name,...data,createdAt:new Date().toISOString()};
  const now=new Date().toISOString();const alarms=read(STORAGE.alarms,[]);alarms.unshift(alarm);write(STORAGE.alarms,alarms.slice(0,30));write(STORAGE.delivery,{alarmId:alarm.id,createdAt:alarm.createdAt,pushSentAt:now,appReceivedAt:null,notificationShownAt:null});write(STORAGE.current,alarm);write(STORAGE.responses,Object.fromEntries(crew.map(x=>[x[1],'wait'])));
  addLog(`Alarm udsendt: ${alarm.type} til ${data.units.join(', ')}.`);channel?.postMessage({type:'alarm',alarm});renderAlarm();showToast(`Alarm udsendt til ${document.querySelector('#recipient-count').textContent} modtagere.`)
}

async function respond(status){
  const alarm=currentAlarm();if(!alarm){showToast('Alarmen er allerede afsluttet.');return}
  stopAlarmSound();soundStatus('Alarmlyd er klar · Telefonens lydløs/Fokus kan overstyre baggrundslyd.',true);clearAppBadge();
  const labels={accepted:'Accepteret',rejected:'Ej accepteret'};const responses=currentResponses();responses['Maja Andersen']=status;write(STORAGE.responses,responses);addLog(`Maja Andersen svarede: ${labels[status]}.`);channel?.postMessage({type:'response',status,name:'Maja Andersen'});renderAlarm();const box=document.querySelector('#response-confirmation');box.hidden=false;box.textContent=`Svar registreret · ${labels[status]}`;showToast('Din kvittering er sendt til kontrolcentralen.')
  if(alarm.deliveryToken)try{await api('receipt',{method:'POST',body:{deliveryToken:alarm.deliveryToken,stage:'response',response:status}})}catch(error){showToast(`Svaret kunne ikke sendes: ${error.message}`,true)}
}

function isResponderApp(){return isStandalone()||new URLSearchParams(location.search).has('app-preview')}
function updateViewportMetrics(){const viewport=window.visualViewport;const width=Math.round(viewport?.width||window.innerWidth);const height=Math.round(viewport?.height||window.innerHeight);const wideResponderViewport=isResponderApp()&&width>480;const logicalWidth=390;const scale=wideResponderViewport?width/logicalWidth:1;document.documentElement.style.setProperty('--app-width',`${width}px`);document.documentElement.style.setProperty('--app-height',`${height}px`);document.documentElement.style.setProperty('--app-scale',String(scale));document.documentElement.style.setProperty('--logical-app-height',`${Math.round(height/scale)}px`);document.body.classList.toggle('wide-android-viewport',wideResponderViewport)}
function updateMobileIdentity(){const name=localStorage.getItem(DEVICE.name)||'Maja Andersen';const stationId=localStorage.getItem(DEVICE.station)||'station-koege';const stationName=localStorage.getItem(DEVICE.stationName)||stationById(stationId)?.name||'DSRS Køge';const initials=name.split(/\s+/).filter(Boolean).map(part=>part[0]).join('').slice(0,2).toUpperCase()||'DS';const avatar=document.querySelector('#mobile-avatar');avatar.textContent=initials;avatar.setAttribute('aria-label',`Registreret som ${name}`);avatar.title=name;const state=document.querySelector('#mobile-station-status');if(state)state.innerHTML=`<span class="status-dot online"></span> ${esc(stationName)} · Du er i beredskab`;updateMobilePairing()}
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
  if(!localStorage.getItem(DEVICE.token)){openDeviceDialog();return}
  if(localStorage.getItem(DEVICE.repair)==='1'){
    try{await renewDeviceRegistration();write(STORAGE.current,null);await loadCurrentAlarm(true,false);showToast('Telefonens pushforbindelse er genoprettet.');return}catch(error){showToast(error.message||'Pushforbindelsen kunne ikke genoprettes. Registrér telefonen igen.',true);openDeviceDialog();return}
  }
  const permission=await Notification.requestPermission();
  if(permission==='granted'){await loadCurrentAlarm(true);updateMobilePairing();showToast('Pushnotifikationer er aktiveret.')}else{updateMobilePairing();showToast('Notifikationer blev ikke tilladt.',true)}
}

function base64Key(value){const padding='='.repeat((4-value.length%4)%4);const raw=atob((value+padding).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...raw].map(char=>char.charCodeAt(0)))}
async function freshPushSubscription(forceRefresh=false){
  const registration=await ensureServiceWorker();
  let subscription=await withTimeout(registration.pushManager.getSubscription(),10000,'Telefonens push-service svarede ikke. Luk appen helt, og prøv igen.');
  if(forceRefresh&&subscription){
    const removed=await withTimeout(subscription.unsubscribe(),10000,'Den udløbne pushforbindelse kunne ikke fjernes. Luk appen helt, og prøv igen.');
    if(!removed)throw new Error('Den udløbne pushforbindelse kunne ikke nulstilles. Luk appen helt, åbn den igen, og tryk Aktivér pushnotifikationer.');
    subscription=null;
  }
  if(!subscription){
    setDeviceStatus('Opretter den krypterede pushforbindelse …','working');
    try{subscription=await withTimeout(registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:base64Key(backendConfig.vapidPublicKey)}),20000,'Telefonens push-tjeneste brugte for lang tid. Kontrollér internetforbindelsen, og prøv igen.')}catch(error){if(error?.name==='NotAllowedError')throw new Error('Telefonen afviste pushnotifikationer. Tillad notifikationer i telefonens indstillinger.');throw error}
  }
  return subscription;
}
async function renewDeviceRegistration(){
  if(deviceRenewalPromise)return deviceRenewalPromise;
  deviceRenewalPromise=(async()=>{
    const previousToken=localStorage.getItem(DEVICE.token);const deviceId=localStorage.getItem(DEVICE.id);const crewName=localStorage.getItem(DEVICE.name);const stationId=localStorage.getItem(DEVICE.station);
    if(!previousToken||!deviceId||!crewName||!stationId)throw new Error('Telefonen mangler registreringsoplysninger og skal registreres igen.');
    if(Notification.permission!=='granted')throw new Error('Tillad notifikationer for DSRS SAR i telefonens indstillinger.');
    setDeviceStatus('Genopretter telefonens pushforbindelse …','working');
    const subscription=await freshPushSubscription(true);
    const result=await withTimeout(api('subscribe',{method:'POST',body:{stationCode:'',stationId,crewName,deviceId,deviceToken:previousToken,subscription:subscription.toJSON()}}),15000,'DSRS-serveren svarede ikke under genregistrering.');
    localStorage.setItem(DEVICE.token,result.deviceToken);localStorage.setItem(DEVICE.name,result.crewName);localStorage.setItem(DEVICE.station,result.station.id);localStorage.setItem(DEVICE.stationName,result.station.name);localStorage.removeItem(DEVICE.repair);updateMobileIdentity();setDeviceStatus(`Pushforbindelsen til ${result.station.name} er genoprettet.`,'success');return result;
  })().finally(()=>{deviceRenewalPromise=null});
  return deviceRenewalPromise;
}
async function registerDevice(crewName,stationCode,stationId){
  if(!window.isSecureContext)throw new Error('Web Push kræver en sikker HTTPS-forbindelse.');
  if(isIOS()&&!isStandalone())throw new Error('På iPhone skal DSRS SAR først føjes til hjemmeskærmen og åbnes derfra.');
  if(!backendOnline||!backendConfig?.vapidPublicKey)throw new Error('Pilotbackenden er ikke tilgængelig. Kontrollér forbindelsen, og prøv igen.');
  setDeviceStatus('Venter på telefonens tilladelse til notifikationer …','working');
  const permission=await requestNotificationPermission();
  if(permission==='denied')throw new Error('Notifikationer er blokeret. Tillad dem for DSRS SAR i telefonens indstillinger, og prøv igen.');
  if(permission!=='granted')throw new Error('Notifikationer blev ikke tilladt. Tryk igen, og vælg Tillad.');
  setDeviceStatus('Starter telefonens sikre push-service …','working');
  const previousToken=localStorage.getItem(DEVICE.token);const subscription=await freshPushSubscription(localStorage.getItem(DEVICE.repair)==='1');
  setDeviceStatus('Registrerer telefonen hos DSRS SAR …','working');
  let deviceId=localStorage.getItem(DEVICE.id);if(!deviceId){deviceId=crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`;localStorage.setItem(DEVICE.id,deviceId)}
  const result=await withTimeout(api('subscribe',{method:'POST',body:{stationCode,stationId,crewName,deviceId,deviceToken:previousToken||undefined,subscription:subscription.toJSON()}}),15000,'DSRS-serveren svarede ikke. Kontrollér internetforbindelsen, og prøv igen.');
  localStorage.setItem(DEVICE.token,result.deviceToken);localStorage.setItem(DEVICE.name,result.crewName);localStorage.setItem(DEVICE.station,result.station.id);localStorage.setItem(DEVICE.stationName,result.station.name);localStorage.removeItem(DEVICE.repair);updateMobileIdentity();setDeviceStatus(`Telefonen er registreret til ${result.station.name}, og pushnotifikationer er aktiveret.`,'success');showToast(`Denne telefon er registreret til ${result.station.name}.`);write(STORAGE.current,null);await loadCurrentAlarm(true,false)
}
async function loadCurrentAlarm(soundOnNew=false,allowRenew=true){const token=localStorage.getItem(DEVICE.token);if(!token||!backendOnline)return;const previousId=currentAlarm()?.id;try{const result=await api('current',{token});if(result.alarm){const isNew=previousId!==result.alarm.id;write(STORAGE.current,result.alarm);write(STORAGE.delivery,{alarmId:result.alarm.id,createdAt:result.alarm.createdAt,pushSentAt:result.delivery?.pushSentAt,appReceivedAt:result.delivery?.appReceivedAt,notificationShownAt:result.delivery?.notificationShownAt});renderAlarm();if(isNew&&soundOnNew){api('receipt',{method:'POST',body:{deliveryToken:result.alarm.deliveryToken,stage:'received'}}).catch(()=>null);if(notify(result.alarm))api('receipt',{method:'POST',body:{deliveryToken:result.alarm.deliveryToken,stage:'shown'}}).catch(()=>null)}if((isNew&&soundOnNew)||/(?:\?|&)alert=1(?:&|$)/.test(location.hash))startAlarmSoundOnce(result.alarm)}else if(previousId){clearActiveAlarm('Alarmen er afsluttet af kontrolcentralen.')}updateMobilePairing()}catch(error){if(/token/i.test(error.message)){localStorage.setItem(DEVICE.repair,'1');updateMobilePairing();if(allowRenew){try{await renewDeviceRegistration();write(STORAGE.current,null);return loadCurrentAlarm(true,false)}catch(renewalError){setDeviceStatus(renewalError.message||'Pushforbindelsen skal genaktiveres.','error');showToast('Mobilens pushforbindelse skal genaktiveres.',true)}}}}}
async function pollRemoteStatus(){if(!backendOnline||!csrfToken)return;const station=selectedControlStation();try{const result=await api('status',{query:{stationId:station.id}});remoteActiveCount=result.activeCount??(result.alarm?1:0);if(result.alarm){write(STORAGE.current,result.alarm);remoteDeliveries=result.deliveries;const first=key=>result.deliveries.map(item=>item[key]).filter(Boolean).sort()[0]||null;write(STORAGE.delivery,{alarmId:result.alarm.id,createdAt:result.alarm.createdAt,pushSentAt:first('push_sent_at'),appReceivedAt:first('app_received_at'),notificationShownAt:first('notification_shown_at')});renderAlarm()}else if(currentAlarm()){clearActiveAlarm(`Der er ingen aktiv SAR-alarm på ${station.name}.`,false)}else renderAlarm()}catch(error){if(/login/i.test(error.message))csrfToken=null}}
async function initialiseBackend(){try{backendConfig=await api('config');backendOnline=true;populateStations();const session=await api('session');csrfToken=session.authenticated?session.csrfToken:null;if(localStorage.getItem(DEVICE.token))loadCurrentAlarm();else if(isResponderApp()){write(STORAGE.current,null);write(STORAGE.delivery,{});renderAlarm()}updateMobilePairing();if(csrfToken)pollRemoteStatus()}catch{backendOnline=false;populateStations();updateMobilePairing()}}

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

function updateRecipients(){const selected=[...document.querySelectorAll('.unit-picker input:checked')];const station=selectedControlStation();let count=selected.some(input=>input.value==='Hele stationen')?8:selected.reduce((total,input)=>{const vessel=(station?.vessels||[]).find(item=>item.id===input.dataset.vesselId);return total+(Number(vessel?.crewRequired)||0)},0);document.querySelector('#recipient-count').textContent=count}

updateViewportMetrics();ensureSeed();populateStations();renderAlarm();renderLog();navigate();
window.addEventListener('hashchange',navigate);
window.addEventListener('resize',updateViewportMetrics,{passive:true});
window.addEventListener('orientationchange',updateViewportMetrics,{passive:true});
window.visualViewport?.addEventListener('resize',updateViewportMetrics,{passive:true});
window.addEventListener('storage',e=>{if(Object.values(STORAGE).includes(e.key)){renderAlarm();renderLog();if(e.key===STORAGE.current&&currentAlarm())receiveAlarm(currentAlarm())}});
channel?.addEventListener('message',e=>{if(e.data.type==='alarm')receiveAlarm(e.data.alarm);if(e.data.type==='response'){renderAlarm();renderLog();showToast(`${e.data.name} har kvitteret.`)}if(e.data.type==='delivery'){renderAlarm();renderLog()}if(e.data.type==='completed')clearActiveAlarm('Alarmen er afsluttet af kontrolcentralen.',false)});
document.querySelector('#alarm-form').addEventListener('submit',sendAlarm);
document.querySelectorAll('.unit-picker input').forEach(x=>x.addEventListener('change',updateRecipients));
document.querySelector('#dispatch-station').addEventListener('change',()=>{renderVessels();if(csrfToken)pollRemoteStatus()});
document.querySelectorAll('[data-response]').forEach(x=>x.addEventListener('click',()=>respond(x.dataset.response)));
document.querySelector('#complete-alarm-button').addEventListener('click',()=>completeRemoteAlarm());
document.querySelectorAll('[data-notification-action]').forEach(button=>button.addEventListener('click',enableNotifications));
document.querySelector('#sound-test-button').addEventListener('click',()=>startAlarmSound(true));
document.querySelector('#new-tab-button').addEventListener('click',()=>window.open(location.origin+location.pathname+'#responder','alarmberedskab-app'));
document.querySelector('#open-app-button').addEventListener('click',()=>location.hash='responder');
document.querySelector('.menu-button').addEventListener('click',()=>document.querySelector('.sidebar').classList.toggle('open'));
document.querySelector('#clear-demo').addEventListener('click',()=>{Object.values(STORAGE).forEach(k=>localStorage.removeItem(k));ensureSeed();renderAlarm();renderLog();showToast('Demoen er nulstillet.')});
document.querySelector('#admin-form').addEventListener('submit',async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;try{const result=await api('login',{method:'POST',body:{code:document.querySelector('#admin-code').value}});csrfToken=result.csrfToken;document.querySelector('#admin-code').value='';document.querySelector('#admin-dialog').close();showToast('Kontrolcentralen er logget ind.');if(pendingDispatch){const alarm=pendingDispatch;pendingDispatch=null;await dispatchRemote(alarm)}else if(pendingCompletion){pendingCompletion=false;await completeRemoteAlarm(true)}else pollRemoteStatus()}catch(error){showToast(error.message,true)}finally{button.disabled=false}});
document.querySelector('#device-form').addEventListener('submit',async event=>{event.preventDefault();primeAlarmSound();const button=event.submitter||event.currentTarget.querySelector('[type="submit"]');const originalLabel=button.textContent;button.disabled=true;button.textContent='Aktiverer push …';try{await registerDevice(document.querySelector('#crew-name').value.trim(),document.querySelector('#station-code').value,document.querySelector('#device-station').value);document.querySelector('#station-code').value='';setTimeout(()=>document.querySelector('#device-dialog').close(),900)}catch(error){const message=error?.message||'Telefonen kunne ikke registreres.';setDeviceStatus(message,'error');showToast(message,true)}finally{button.disabled=false;button.textContent=originalLabel}});
document.querySelector('#device-dialog-close').addEventListener('click',()=>document.querySelector('#device-dialog').close());
document.addEventListener('pointerdown',event=>{if(!event.target.closest('#sound-test-button'))primeAlarmSound()},{once:true,capture:true});
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter'&&location.hash!=='#responder')document.querySelector('#alarm-form').requestSubmit()});
function updateClocks(){const now=new Date();document.querySelector('#clock').textContent=new Intl.DateTimeFormat('da-DK',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(now)}
updateClocks();setInterval(updateClocks,1000);
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;updateInstallUI()});
window.addEventListener('appinstalled',()=>{deferredPrompt=null;updateInstallUI();showToast('DSRS SAR er installeret.')});
document.querySelector('#install-button').addEventListener('click',installApp);
updateInstallUI();
if('serviceWorker'in navigator)ensureServiceWorker().catch(()=>showToast('Appens offline-funktion kunne ikke startes.',true));
navigator.serviceWorker?.addEventListener('message',event=>{if(event.data?.type==='push-alarm'&&event.data.payload?.alarm){const alarm={...event.data.payload.alarm,deliveryToken:event.data.payload.deliveryToken};write(STORAGE.current,alarm);write(STORAGE.delivery,{alarmId:alarm.id,createdAt:alarm.createdAt,pushSentAt:new Date().toISOString(),appReceivedAt:new Date().toISOString(),notificationShownAt:new Date().toISOString()});renderAlarm();startAlarmSoundOnce(alarm);showToast(`Ny SAR-alarm: ${alarm.type}`)}});
initialiseBackend();
setInterval(()=>{if((location.hash||'#control').startsWith('#control'))pollRemoteStatus()},3000);
setInterval(()=>{if((location.hash||'').startsWith('#responder'))loadCurrentAlarm(true)},15000);
