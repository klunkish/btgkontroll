
(function(){
  'use strict';

  const TABLE_KEY='btg_temperature_tables_v1';
  const SENSOR_KEY='btg_temperature_sensors_v1';
  const ASSIGN_KEY='btg_temperature_assignments_v1';
  const READ_KEY='btg_temperature_readings_v1';

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid=()=> (crypto?.randomUUID ? crypto.randomUUID() : 'id_'+Date.now()+'_'+Math.random().toString(16).slice(2));
  const nowISO=()=>new Date().toISOString();
  const load=(k)=>{ try{return JSON.parse(localStorage.getItem(k)||'[]')}catch(_){return [];} };
  const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v||[]));
  const n=v=>Number.isFinite(Number(v))?Number(v):0;

  function currentFactoryId(){
    return String(window.BTG_ACCESS_STATE?.factory_id || window.ACTIVE_FACTORY_ID || window.currentFactoryId || window.selectedFactoryId || 'local_factory');
  }

  function tableList(){ return load(TABLE_KEY).filter(x=>String(x.factoryId||'local_factory')===currentFactoryId()); }
  function sensorList(){ return load(SENSOR_KEY).filter(x=>String(x.factoryId||'local_factory')===currentFactoryId()); }
  function assignmentList(){ return load(ASSIGN_KEY).filter(x=>String(x.factoryId||'local_factory')===currentFactoryId()); }
  function readingList(){ return load(READ_KEY).filter(x=>String(x.factoryId||'local_factory')===currentFactoryId()); }

  function allSensors(){ return sensorList(); }
  function activeSensors(){ return sensorList().filter(s=>s.active!==false); }

  function ensureRoot(){
    let root=$('#tab-temperature-tables');
    if(root) return root;
    root=document.createElement('section');
    root.id='tab-temperature-tables';
    root.className='page-section btg-temperature-page';
    root.style.display='none';
    root.hidden=true;
    root.setAttribute('aria-hidden','true');
    const main=$('main') || $('.app-main') || $('#app') || document.body;
    main.appendChild(root);
    return root;
  }

  function hideOtherSections(root){
    $$('.page-section,[id^="tab-"]').forEach(sec=>{
      if(sec!==root && !sec.closest('dialog')){
        sec.classList.remove('active');
        sec.style.display='none';
        sec.hidden=true;
        sec.setAttribute('aria-hidden','true');
      }
    });
  }

  function forceHideTemperaturePage(){
    const root=document.querySelector('#tab-temperature-tables');
    if(root){
      root.classList.remove('active');
      root.style.display='none';
      root.hidden=true;
      root.setAttribute('aria-hidden','true');
    }
  }

  function open(){
    const root=ensureRoot();
    hideOtherSections(root);
    root.hidden=false;
    root.style.display='';
    root.classList.add('active');
    root.setAttribute('aria-hidden','false');
    render();
  }

  function latestReading(sensorId){
    return readingList().filter(r=>String(r.sensorId)===String(sensorId)).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))[0] || null;
  }

  function readingsForSensor(sensorId, limit=80){
    return readingList().filter(r=>String(r.sensorId)===String(sensorId)).sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt))).slice(-limit);
  }

  function tableById(id){ return tableList().find(t=>String(t.id)===String(id)); }
  function sensorById(id){ return sensorList().find(s=>String(s.id)===String(id)); }
  function activeAssignmentForSensor(sensorId){ return assignmentList().find(a=>a.active!==false && String(a.sensorId)===String(sensorId)); }
  function tableNameForSensor(sensor){
    const active=activeAssignmentForSensor(sensor.id);
    if(active?.tableName) return active.tableName;
    const t=tableById(sensor.tableId);
    return t?.name || sensor.tableName || 'Ej valt bord/form';
  }


  function sensorStatus(sensor){
    const lr=latestReading(sensor.id);
    const activeAssignment=activeAssignmentForSensor(sensor.id);
    if(activeAssignment || sensor.live) return {key:'live',label:'Live',lamp:'green',reading:lr,assignment:activeAssignment};
    if(lr){
      const age=Date.now()-new Date(lr.createdAt).getTime();
      if(age < 10*60*1000) return {key:'waiting',label:'Väntar',lamp:'yellow',reading:lr,assignment:null};
      return {key:'offline',label:'Offline',lamp:'red',reading:lr,assignment:null};
    }
    return {key:'idle',label:'Ej aktiverad',lamp:'gray',reading:null,assignment:null};
  }

  function updateSensor(id, patch){
    const all=load(SENSOR_KEY).map(s=>String(s.id)===String(id)?{...s,...patch,updatedAt:nowISO()}:s);
    save(SENSOR_KEY,all);
  }

  function render(){
    const root=ensureRoot();
    const tables=tableList();
    const sensors=sensorList();
    const assignments=assignmentList().filter(a=>a.active!==false);
    const rows=tables.map(t=>{
      const ts=sensors.filter(s=>String(s.tableId)===String(t.id));
      const active=assignments.find(a=>String(a.tableId)===String(t.id));
      const temp=ts.map(s=>latestReading(s.id)).filter(Boolean).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))[0];
      return `<div class="btg-temp-table-card" data-open-table="${esc(t.id)}">
        <div class="btg-temp-card-head">
          <div><h4>${esc(t.name)}</h4><span>${esc(t.description||'Bord/form')}</span></div>
          <b>${temp?Number(temp.temperatureC).toFixed(1)+' °C':'—'}</b>
        </div>
        <div class="btg-temp-meta">
          <span>${ts.length} sensor${ts.length===1?'':'er'}</span>
          <span>${active?'Aktiv: '+esc(active.label||active.prefabId||'Prefab'):'Ingen aktiv prefab'}</span>
        </div>
        <div class="btg-temp-mini-bars">${ts.map(s=>{
          const lr=latestReading(s.id);
          const pct=lr?Math.max(0,Math.min(100,(n(lr.temperatureC)-5)*2)):0;
          return `<i title="${esc(s.name)} ${lr?Number(lr.temperatureC).toFixed(1)+' °C':'ingen data'}"><em style="height:${pct}%"></em></i>`;
        }).join('')}</div>
      </div>`;
    }).join('');

    root.innerHTML=`<div class="btg-temp-shell">
      <div class="btg-temp-hero">
        <div>
          <h2>Bord & Temperatur</h2>
          <p>Skapa bord och sensorer, kör simulerad data och koppla prefabproduktion till sensor när du markerar klar.</p>
        </div>
        <div class="btg-temp-actions">
          <button class="btn" id="btgTempAddTable">Lägg till bord</button>
          <button class="btn secondary" id="btgTempAddSensor">Lägg till sensor</button>
          <button class="btn secondary" id="btgTempSimulate">Skapa simulerad data</button>
          <button class="btn secondary" id="btgTempLiveView">Live-vy</button>
          <button class="btn secondary" id="btgTempOverview">Systemöversikt</button>
        </div>
      </div>
      <div class="btg-temp-grid">${rows || '<div class="btg-temp-empty">Inga fasta bord skapade. Du kan ändå lägga till sensor direkt och välja bord/form i beställningen.</div>'}</div>
      <div class="btg-temp-section">
        <h3>Sensorer</h3>
        <div class="btg-temp-sensor-list">${sensors.map(s=>{
          const t=tableById(s.tableId);
          const st=sensorStatus(s);
          const lr=st.reading;
          return `<button type="button" class="btg-temp-sensor-row clickable" data-open-sensor="${esc(s.id)}">
            <div class="btg-temp-sensor-main">
              <span class="btg-temp-lamp ${esc(st.lamp)}"></span>
              <div><b>${esc(s.displayName || s.name || s.code)}</b><span>${esc(tableNameForSensor(s))} • ${esc(s.code||'Ingen kod')} • ${esc(st.label)}</span></div>
            </div>
            <strong>${lr?Number(lr.temperatureC).toFixed(1)+' °C':'Ingen data'}</strong>
          </button>`;
        }).join('') || '<div class="btg-temp-empty">Inga sensorer skapade.</div>'}</div>
      </div>
    </div>`;

    $('#btgTempAddTable',root)?.addEventListener('click',()=>openTableDialog());
    $('#btgTempAddSensor',root)?.addEventListener('click',()=>openSensorDialog());
    $('#btgTempSimulate',root)?.addEventListener('click',()=>simulateAll());
    $('#btgTempLiveView',root)?.addEventListener('click',()=>openLiveView());
    $('#btgTempOverview',root)?.addEventListener('click',()=>openSystemOverview());
    $$('[data-open-table]',root).forEach(el=>el.addEventListener('click',e=>{ if(e.target.closest('button')) return; openTableDetail(el.dataset.openTable); }));
    $$('[data-open-sensor]',root).forEach(b=>b.addEventListener('click',()=>openSensorMenu(b.dataset.openSensor)));
    refreshOrderSensorSelects();
  }

  function openTableDialog(){
    const d=document.createElement('dialog');
    d.className='btg-temp-dialog';
    d.innerHTML=`<form method="dialog" class="container">
      <h3>Lägg till bord</h3>
      <label>Namn</label><input id="btgTempTableName" placeholder="t.ex. Bord 8">
      <label>Beskrivning</label><input id="btgTempTableDesc" placeholder="t.ex. Långbord / prefab">
      <div class="row" style="justify-content:flex-end;margin-top:.8rem">
        <button class="btn secondary" value="cancel">Avbryt</button>
        <button class="btn" id="btgTempSaveTable" type="button">Spara</button>
      </div>
    </form>`;
    document.body.appendChild(d);
    $('#btgTempSaveTable',d).addEventListener('click',()=>{
      const name=$('#btgTempTableName',d).value.trim();
      if(!name){ alert('Ange namn på bord.'); return; }
      const all=load(TABLE_KEY);
      all.push({id:uid(),factoryId:currentFactoryId(),name,description:$('#btgTempTableDesc',d).value.trim(),createdAt:nowISO(),active:true});
      save(TABLE_KEY,all); d.close(); d.remove(); render();
    });
    d.addEventListener('close',()=>d.remove(),{once:true});
    d.showModal();
  }

  function openSensorDialog(){
    const d=document.createElement('dialog');
    d.className='btg-temp-dialog';
    d.innerHTML=`<form method="dialog" class="container">
      <h3>Lägg till sensor via kod</h3>
      <label>Sensorkod</label>
      <input id="btgTempSensorCode" placeholder="t.ex. BTG-TEMP-0008 eller ESP32-BORD-8" autocomplete="off">
      <label>Visningsnamn</label>
      <input id="btgTempSensorName" placeholder="t.ex. Sensor 1">
      <label>Sensortyp</label><select id="btgTempSensorType">
        <option>Termoelement typ J</option>
        <option>Termoelement typ K</option>
        <option>Simulerad sensor</option>
        <option>ESP32 temperaturmodul</option>
      </select>
      <small class="muted">Bord/form väljs sedan på beställningen och följer med till Prefabkö och Live-vy.</small>
      <div class="row" style="justify-content:flex-end;margin-top:.8rem">
        <button class="btn secondary" value="cancel">Avbryt</button>
        <button class="btn" id="btgTempSaveSensor" type="button">Spara sensor</button>
      </div>
    </form>`;
    document.body.appendChild(d);
    $('#btgTempSaveSensor',d).addEventListener('click',()=>{
      const code=$('#btgTempSensorCode',d).value.trim();
      const name=($('#btgTempSensorName',d).value.trim() || code);
      if(!code){ alert('Ange sensorkod.'); return; }
      const all=load(SENSOR_KEY);
      const duplicate=all.find(s=>String(s.factoryId||'local_factory')===currentFactoryId() && String(s.code||'').toLowerCase()===code.toLowerCase());
      if(duplicate){ alert('Det finns redan en sensor med den koden.'); return; }
      all.push({id:uid(),factoryId:currentFactoryId(),code,name,displayName:name,tableId:'',type:$('#btgTempSensorType',d).value,createdAt:nowISO(),lastSeen:null,active:true,live:false});
      save(SENSOR_KEY,all); d.close(); d.remove(); render();
    });
    d.addEventListener('close',()=>d.remove(),{once:true});
    d.showModal();
  }

  function openTableDetail(tableId){
    const t=tableById(tableId); if(!t) return;
    const sensors=sensorList().filter(s=>String(s.tableId)===String(tableId));
    const primary=sensors[0];
    const readings=primary?readingsForSensor(primary.id,80):[];
    const maxTemp=readings.length?Math.max(...readings.map(r=>n(r.temperatureC))):0;
    const minTemp=readings.length?Math.min(...readings.map(r=>n(r.temperatureC))):0;
    const points=readings.map(r=>{
      const pct=maxTemp>minTemp ? ((n(r.temperatureC)-minTemp)/(maxTemp-minTemp))*100 : 50;
      return `<i style="height:${Math.max(4,pct)}%" title="${new Date(r.createdAt).toLocaleString()} ${Number(r.temperatureC).toFixed(1)} °C"></i>`;
    }).join('');
    const d=document.createElement('dialog');
    d.className='btg-temp-dialog wide';
    d.innerHTML=`<form method="dialog" class="container">
      <div class="row" style="justify-content:space-between;align-items:center">
        <h3>${esc(t.name)}</h3>
        <button class="btn secondary" value="cancel">Stäng</button>
      </div>
      <p class="muted">${esc(t.description||'Bord')}</p>
      <div class="btg-temp-detail-metrics">
        <div><span>Sensorer</span><b>${sensors.length}</b></div>
        <div><span>Min</span><b>${readings.length?minTemp.toFixed(1)+' °C':'—'}</b></div>
        <div><span>Max</span><b>${readings.length?maxTemp.toFixed(1)+' °C':'—'}</b></div>
      </div>
      <div class="btg-temp-chart">${points || '<div class="btg-temp-empty">Ingen temperaturdata ännu.</div>'}</div>
      <h4>Sensorer</h4>
      <div class="btg-temp-sensor-list">${sensors.map(s=>{
        const lr=latestReading(s.id);
        return `<div class="btg-temp-sensor-row"><div><b>${esc(s.name)}</b><span>${esc(s.type)}</span></div><strong>${lr?Number(lr.temperatureC).toFixed(1)+' °C':'—'}</strong></div>`;
      }).join('') || '<div class="btg-temp-empty">Inga sensorer kopplade.</div>'}</div>
    </form>`;
    document.body.appendChild(d);
    d.addEventListener('close',()=>d.remove(),{once:true});
    d.showModal();
  }


  function openSensorMenu(sensorId){
    const s=sensorById(sensorId); if(!s) return;
    const tables=tableList();
    const t=tableById(s.tableId);
    const st=sensorStatus(s);
    const lr=st.reading;
    const d=document.createElement('dialog');
    d.className='btg-temp-dialog wide';
    d.innerHTML=`<form method="dialog" class="container">
      <div class="row" style="justify-content:space-between;align-items:flex-start;gap:12px">
        <div>
          <div class="btg-temp-sensor-title"><span class="btg-temp-lamp ${esc(st.lamp)}"></span><h3>${esc(s.displayName || s.name || s.code)}</h3></div>
          <p class="muted">${esc(s.code||'Ingen sensorkod')} • ${esc(st.label)}${lr?' • '+Number(lr.temperatureC).toFixed(1)+' °C':''}</p>
        </div>
        <button class="btn secondary" value="cancel">Stäng</button>
      </div>

      <div class="btg-temp-detail-metrics">
        <div><span>Status</span><b>${esc(st.label)}</b></div>
        <div><span>Senast aktiv</span><b>${lr?new Date(lr.createdAt).toLocaleTimeString('sv-SE'):'—'}</b></div>
        <div><span>Bord/form</span><b>${esc(tableNameForSensor(s))}</b></div>
      </div>

      <label>Visningsnamn</label>
      <input id="btgTempEditSensorName" value="${esc(s.displayName || s.name || s.code)}">

      <label>Fast kopplat bord/form, valfritt</label>
      <select id="btgTempEditSensorTable">
        <option value="">— inget fast bord, används från beställning —</option>
        ${tables.map(tb=>`<option value="${esc(tb.id)}" ${String(tb.id)===String(s.tableId)?'selected':''}>${esc(tb.name)}</option>`).join('')}
      </select>

      <label>Sensortyp</label>
      <select id="btgTempEditSensorType">
        ${['Termoelement typ J','Termoelement typ K','Simulerad sensor','ESP32 temperaturmodul'].map(type=>`<option ${String(type)===String(s.type)?'selected':''}>${esc(type)}</option>`).join('')}
      </select>

      <div class="btg-temp-sensor-info-box">
        <b>Sensorinformation</b>
        <span>Kod: ${esc(s.code||'—')}</span>
        <span>Skapad: ${s.createdAt ? esc(new Date(s.createdAt).toLocaleString('sv-SE')) : '—'}</span>
        <span>Aktiv prefab/order: ${st.assignment ? esc(st.assignment.label||st.assignment.prefabId||'Aktiv') : 'Ingen'}</span>
      </div>

      <div class="row" style="justify-content:flex-end;margin-top:1rem;gap:8px;flex-wrap:wrap">
        <button class="btn secondary" type="button" id="btgTempSensorSim">Testa/simulera data</button>
        <button class="btn secondary" type="button" id="btgTempSensorToggle">${s.active===false?'Aktivera':'Inaktivera'}</button>
        <button class="btn danger" type="button" id="btgTempSensorDelete">Ta bort</button>
        <button class="btn" type="button" id="btgTempSensorSave">Spara</button>
      </div>
    </form>`;
    document.body.appendChild(d);

    $('#btgTempSensorSave',d).addEventListener('click',()=>{
      updateSensor(sensorId,{
        displayName:$('#btgTempEditSensorName',d).value.trim() || s.code,
        name:$('#btgTempEditSensorName',d).value.trim() || s.code,
        tableId:$('#btgTempEditSensorTable',d).value,
        type:$('#btgTempEditSensorType',d).value
      });
      d.close(); d.remove(); render();
    });
    $('#btgTempSensorSim',d).addEventListener('click',()=>{ simulateSensor(sensorId,24); updateSensor(sensorId,{lastSeen:nowISO(),live:true}); d.close(); d.remove(); render(); });
    $('#btgTempSensorToggle',d).addEventListener('click',()=>{ updateSensor(sensorId,{active:!(s.active!==false)}); d.close(); d.remove(); render(); });
    $('#btgTempSensorDelete',d).addEventListener('click',()=>{ d.close(); d.remove(); deleteSensor(sensorId); });
    d.addEventListener('close',()=>{ if(document.body.contains(d)) d.remove(); },{once:true});
    d.showModal();
  }

  function deleteSensor(id){
    if(!confirm('Ta bort sensorn? Historiska simulerade mätvärden ligger kvar.')) return;
    save(SENSOR_KEY, load(SENSOR_KEY).filter(s=>String(s.id)!==String(id)));
    render();
  }

  function simulateSensor(sensorId,count=24,assignmentId=''){
    const sensor=sensorById(sensorId); if(!sensor) return;
    const readings=load(READ_KEY);
    const base=22+Math.random()*4;
    const start=Date.now()-(count*30*60*1000);
    for(let i=0;i<count;i++){
      const curve=Math.sin(i/(count-1)*Math.PI)*14;
      const noise=(Math.random()-.5)*1.6;
      readings.push({
        id:uid(),
        factoryId:currentFactoryId(),
        tableId:sensor.tableId,
        sensorId:sensor.id,
        assignmentId,
        temperatureC:Math.round((base+curve+noise)*10)/10,
        ambientTemperatureC:Math.round((base-3+Math.sin(i/8)*1.2+noise*.25)*10)/10,
        createdAt:new Date(start+i*30*60*1000).toISOString(),
        simulated:true
      });
    }
    save(READ_KEY,readings.slice(-5000));
    updateSensor(sensorId,{live:true,lastSeen:nowISO()});
  }

  function simulateAll(){
    const sensors=sensorList();
    if(!sensors.length){ alert('Skapa minst en sensor först.'); return; }
    sensors.forEach(s=>simulateSensor(s.id,48));
    render();
  }

  function activateSensorForPrefab(payload){
    const sensorId=payload?.sensorId;
    const sensor=sensorById(sensorId);
    if(!sensor) return null;
    const table=tableById(sensor.tableId);
    const assignments=load(ASSIGN_KEY).map(a=>{
      if(String(a.sensorId)===String(sensorId) && a.active!==false) return {...a,active:false,endedAt:nowISO()};
      return a;
    });
    const assignment={
      id:uid(),
      factoryId:currentFactoryId(),
      tableId:sensor.tableId || '',
      tableName:payload?.tableName || payload?.formTableName || sensor.tableName || '',
      sensorId,
      prefabId:payload?.prefabId || '',
      orderId:payload?.orderId || '',
      batchId:payload?.batchId || '',
      label:payload?.label || payload?.batchId || 'Prefab',
      startedAt:nowISO(),
      active:true
    };
    assignments.push(assignment);
    save(ASSIGN_KEY,assignments);
    updateSensor(sensorId,{live:true,lastSeen:nowISO()});
    simulateSensor(sensorId,24,assignment.id);
    window.dispatchEvent(new CustomEvent('btg:temperature-assignment-created',{detail:{assignment,sensor,table}}));
    return assignment;
  }

  function sensorOptionsHtml(selected=''){
    const sensors=activeSensors();
    if(!sensors.length) return '<option value="">Inga sensorer skapade</option>';
    return '<option value="">— välj sensor/bord —</option>'+sensors.map(s=>{
      const t=tableById(s.tableId);
      const st=sensorStatus(s);
      const lr=st.reading;
      const label=`${s.displayName || s.name || s.code} – ${s.code||'utan kod'} – ${st.label}${lr?' – Betong '+Number(lr.temperatureC).toFixed(1)+' °C':''}`;
      return `<option value="${esc(s.id)}" ${String(selected)===String(s.id)?'selected':''}>${esc(label)}</option>`;
    }).join('');
  }



  function sensorLabelById(sensorId){
    const s=sensorById(sensorId);
    if(!s) return '';
    const t=tableById(s.tableId);
    return `${s.displayName || s.name || s.code}${s.code ? ' ('+s.code+')' : ''}`;
  }

  function refreshOrderSensorSelects(){
    const html=sensorOptionsHtml();
    document.querySelectorAll('#orderTemperatureSensor,#prefabTemperatureSensor').forEach(sel=>{
      const current=sel.value;
      sel.innerHTML=html.replace('<option value="">— välj sensor/bord —</option>','<option value="">— ingen sensor vald —</option>');
      if(current) sel.value=current;
    });
  }

  function pushLiveReading(sensorId){
    const sensor=sensorById(sensorId);
    if(!sensor) return;
    const readings=load(READ_KEY);
    const latest=latestReading(sensorId);
    const lastTemp=latest?n(latest.temperatureC):(22+Math.random()*4);
    const drift=(Math.random()-.46)*.8;
    const target=31+Math.sin(Date.now()/420000)*7;
    const temp=Math.round((lastTemp*.86+target*.14+drift)*10)/10;
    readings.push({
      id:uid(),
      factoryId:currentFactoryId(),
      tableId:sensor.tableId,
      sensorId:sensor.id,
      temperatureC:temp,
      ambientTemperatureC:Math.round((18+Math.sin(Date.now()/900000)*2+(Math.random()-.5)*.6)*10)/10,
      createdAt:nowISO(),
      simulated:true,
      live:true
    });
    save(READ_KEY,readings.slice(-5000));
    updateSensor(sensorId,{live:true,lastSeen:nowISO()});
  }

  let liveTimer=null;
  let liveClockTimer=null;

  function openLiveView(){
    const old=document.querySelector('#btgTempLiveOverlay');
    if(old) old.remove();

    const overlay=document.createElement('div');
    overlay.id='btgTempLiveOverlay';
    overlay.className='btg-temp-live-overlay';
    overlay.innerHTML=`<div class="btg-temp-live-panel">
      <div class="btg-temp-live-top">
        <div>
          <div class="btg-temp-live-badge"><i></i> LIVE</div>
          <h2>Livevy Bord & Temperatur</h2>
          <p>Fabriksskärm för aktiva bord/formar och sensorer</p>
        </div>
        <div class="btg-temp-live-actions">
          <div id="btgTempLiveClock" class="btg-temp-live-clock">--:--:--</div>
          <button class="btn secondary" id="btgTempLiveFullscreen">Fullskärm</button>
          <button class="btn danger" id="btgTempLiveClose">Stäng</button>
        </div>
      </div>
      <div id="btgTempLiveGrid" class="btg-temp-live-grid"></div>
    </div>`;
    document.body.appendChild(overlay);

    const tick=()=>{
      const clock=document.querySelector('#btgTempLiveClock');
      if(clock) clock.textContent=new Date().toLocaleTimeString('sv-SE');
    };
    const renderLive=()=>{
      activeSensors().forEach(s=>pushLiveReading(s.id));
      const grid=document.querySelector('#btgTempLiveGrid');
      if(!grid) return;
      const sensors=activeSensors();
      grid.innerHTML=sensors.length?sensors.map(s=>{
        const t=tableById(s.tableId);
        const readings=readingsForSensor(s.id,64);
        const lr=readings[readings.length-1];
        const min=readings.length?Math.min(...readings.map(r=>n(r.temperatureC))):0;
        const max=readings.length?Math.max(...readings.map(r=>n(r.temperatureC))):0;
        const bars=readings.map(r=>{
          const pct=max>min?((n(r.temperatureC)-min)/(max-min))*100:50;
          return `<i style="height:${Math.max(5,pct)}%" title="${new Date(r.createdAt).toLocaleTimeString('sv-SE')} ${Number(r.temperatureC).toFixed(1)} °C"></i>`;
        }).join('');
        const active=assignmentList().find(a=>a.active!==false && String(a.sensorId)===String(s.id));
        return `<div class="btg-temp-live-card">
          <div class="btg-temp-live-card-head">
            <div><h3>${esc(active?.tableName || t?.name || s.tableName || 'Bord/form ej valt')}</h3><span>${esc(s.displayName || s.name || s.code)} • ${esc(s.type||'Sensor')}</span></div>
            <strong>${lr?Number(lr.temperatureC).toFixed(1):'--'}<small>°C</small><em>${lr?.ambientTemperatureC!=null ? 'Omgivning '+Number(lr.ambientTemperatureC).toFixed(1)+' °C' : 'Omgivning -- °C'}</em></strong>
          </div>
          <div class="btg-temp-live-order">${active ? 'AKTIV PRODUKTION: '+esc(active.label||active.prefabId||'Prefab') : 'Ingen aktiv prefab/order'}</div>
          <div class="btg-temp-live-chart">${bars}</div>
          <div class="btg-temp-live-foot">
            <span>Min ${readings.length?min.toFixed(1):'--'} °C</span>
            <span>Max ${readings.length?max.toFixed(1):'--'} °C</span>
            <span>Senast ${lr?new Date(lr.createdAt).toLocaleTimeString('sv-SE'):'--'}</span>
          </div>
        </div>`;
      }).join(''):`<div class="btg-temp-live-empty">Inga sensorer skapade. Skapa bord och sensor först.</div>`;
      window.BTG_TABLE_TEMPERATURE?.render?.();
    };

    const close=()=>{
      clearInterval(liveTimer);
      clearInterval(liveClockTimer);
      liveTimer=null;
      liveClockTimer=null;
      document.removeEventListener('keydown',escClose);
      overlay.remove();
    };
    const escClose=e=>{ if(e.key==='Escape') close(); };

    document.querySelector('#btgTempLiveClose')?.addEventListener('click',close);
    document.querySelector('#btgTempLiveFullscreen')?.addEventListener('click',()=>{
      const panel=document.querySelector('#btgTempLiveOverlay');
      if(!document.fullscreenElement) panel?.requestFullscreen?.();
      else document.exitFullscreen?.();
    });
    document.addEventListener('keydown',escClose);

    tick();
    renderLive();
    liveClockTimer=setInterval(tick,1000);
    liveTimer=setInterval(renderLive,5000);
  }


  function openSystemOverview(){
    const old=document.querySelector('#btgTempOverviewDialog');
    if(old) old.remove();
    const d=document.createElement('dialog');
    d.id='btgTempOverviewDialog';
    d.className='btg-temp-dialog wide';
    d.innerHTML=`<form method="dialog" class="container btg-temp-overview-dialog">
      <div class="row" style="justify-content:space-between;align-items:flex-start;gap:12px">
        <div>
          <h3>Så fungerar systemet i fabriken</h3>
          <p class="muted">Illustration över hur sensorer, ESP32-enhet, databas och visualisering pratar med varandra.</p>
        </div>
        <button class="btn secondary" value="cancel">Stäng</button>
      </div>
      <img src="assets/temperature-system-overview.png" alt="Systemöversikt för trådlös betongtemperaturövervakning i prefabfabrik" class="btg-temp-overview-image">
      <div class="btg-temp-overview-points">
        <div><b>1. Sensor registreras via kod</b><span>Sensorn läggs in i Bord & Temperatur och kan sedan väljas i prefabflödet.</span></div>
        <div><b>2. Sensor väljs i Prefabkö</b><span>Bord/form och vald sensor följer med beställningen.</span></div>
        <div><b>3. Aktiveras när produktionen markeras klar</b><span>Vid Klar startar uppföljningen och sensorn blir live.</span></div>
        <div><b>4. Data visas i app och på fabriksskärm</b><span>Både betongtemperatur och omgivningstemperatur kan visas.</span></div>
      </div>
    </form>`;
    document.body.appendChild(d);
    d.addEventListener('close',()=>d.remove(),{once:true});
    d.showModal();
  }

  function dashboardSnapshot(){
    const sensors=activeSensors();
    return sensors.slice(0,6).map(s=>{
      const t=tableById(s.tableId);
      const lr=latestReading(s.id);
      return {sensor:s,table:t,reading:lr};
    });
  }

  window.dispatchEvent(new CustomEvent('btg:temperature-ready'));

  window.BTG_TABLE_TEMPERATURE={
    open,
    render,
    allSensors,
    sensorOptionsHtml,
    activateSensorForPrefab,
    dashboardSnapshot,
    sensorLabelById,
    refreshOrderSensorSelects,
    openLiveView,
    simulateAll,
    latestReading
  };

  window.addEventListener('DOMContentLoaded',()=>{
    refreshOrderSensorSelects();
    setTimeout(()=>window.BTG_NAVIGATION_REGISTRY?.rebuild?.(),150);
  });
  window.addEventListener('btg:menu-ready',()=>setTimeout(()=>window.BTG_NAVIGATION_REGISTRY?.rebuild?.(),150));
})();
