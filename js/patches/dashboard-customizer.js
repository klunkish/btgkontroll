
/* BTG QC v19.5.52 – Dashboard builder: Bygg din dashboard + fullbredd + valbar höjd */
(function(){
  'use strict';

  document.documentElement.classList.add('btg-dashboard-booting');

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const n=v=>Number(v||0)||0;
  const db=()=>window.sb||window.supabaseClient||null;
  const fmtKg=v=>`${Math.round(n(v)).toLocaleString('sv-SE')} kg`;

  const CREATED_KEY='btg_dashboard_v52_created';
  const CONFIG_KEY='btg_dashboard_v52_config';

  const WIDGETS=[
    {key:'factory_status',label:'Aktiv fabrik',hint:'Fabrik, inloggad användare, roll, anslutning och menybehörigheter',page:'dashboard',default:true},
    {key:'overview',label:'Översikt',hint:'Sammanfattning från dashboard/app',page:'dashboard',default:true},
    {key:'checklist',label:'Kom igång',hint:'Kort checklista',page:'dashboard',default:false},
    {key:'testing',label:'Provningar',hint:'Satser där kub/provtagning ska tas och om det är gjort',page:'cubes',default:true},
    {key:'demoulding',label:'Avformningskuber',hint:'Genväg till avformning och historik',page:'demoulding',default:false},
    {key:'temperature_tables',label:'Bord & Temperatur',hint:'Sensorer, bord och temperaturkurvor',page:'temperature_tables',default:false},
    {key:'prefab',label:'Prefabkö',hint:'Genväg till interna prefab-beställningar',page:'prefab',default:false},
    {key:'cement_silos',label:'Material & Silor',hint:'Silonivåer synkade med Material & Silor-fliken',page:'cement_silos',default:true},
    {key:'quality_trends',label:'Kvalitetstrender',hint:'Genväg och sammanfattning',page:'quality_trends',default:false},
    {key:'economy',label:'Ekonomi & Kalkyl',hint:'Genväg till ekonomi',page:'economy',default:false},
    {key:'orders',label:'Kunder & Beställningar',hint:'Genväg till kunder och beställningar',page:'orders',default:false},
    {key:'documents',label:'Offert / Faktura',hint:'Genväg till dokument',page:'documents',default:false},
    {key:'reports',label:'Rapporter',hint:'Genväg till rapporter',page:'reports',default:false},
    {key:'materials',label:'Material',hint:'Genväg till material',page:'materials',default:false},
    {key:'recipes',label:'Recept',hint:'Genväg till recept',page:'recipes',default:false},
    {key:'system_center',label:'Systemcenter',hint:'Systemstyrning för superadmin',page:'system_center',default:false}
  ];

  function profile(){return window.BTG_ACCESS_STATE?.profile || window.CURRENT_PROFILE || {};}
  function user(){return window.CURRENT_USER || window.BTG_CURRENT_USER || window.BTG_ACCESS_STATE?.user || {};}
  function email(){return user().email || profile().email || window.BTG_ACCESS_STATE?.authEmail || '';}
  function role(){return profile().role || window.BTG_ACCESS_STATE?.role || user().role || 'Användare';}
  function factoryId(){return window.BTG_ACTIVE_FACTORY_ID || window.BTG_CURRENT_FACTORY_ID || window.BTG_FACTORY_ADMIN_STATE?.activeFactoryId || window.BTG_ACCESS_STATE?.factory_id || profile().factory_id || 'aktiv-fabrik';}
  function factoryName(){return window.BTG_ACTIVE_FACTORY_NAME || window.BTG_CURRENT_FACTORY_NAME || window.BTG_FACTORY_ADMIN_STATE?.activeFactoryName || window.BTG_ACCESS_STATE?.factory_name || profile().factory_name || 'Aktiv fabrik';}

  function findDashboard(){return $('#tab-dashboard') || $('#dashboard') || $('[data-tab-content="dashboard"]');}
  function navButtons(){return $$('#btgRebuiltNav button,[data-btg-page-key],.tab-btn,button[data-tab],.main-nav button,nav button').filter(b=>!b.closest('dialog'));}
  function pageVisible(page){
    if(page==='dashboard') return true;
    const btn=$(`#btgRebuiltNav [data-btg-page-key="${page}"]`) || navButtons().find(b=>b.dataset.btgPageKey===page);
    if(btn) return !btn.hidden && btn.style.display!=='none' && btn.dataset.btgPermissionMode!=='hidden';
    if(page==='cement_silos') return !!window.BTG_CEMENT_SILOS || !!document.querySelector('script[src*="cement-silos"],#tab-cement_silos');
    return false;
  }
  function availableWidgets(){return WIDGETS.filter(w=>pageVisible(w.page));}

  function defaultConfig(){
    const cfg={};
    availableWidgets().forEach(w=>{
      if(w.default) cfg[w.key]={enabled:true,height:w.key==='factory_status'?'normal':'compact'};
    });
    if(!cfg.factory_status) cfg.factory_status={enabled:true,height:'normal'};
    return cfg;
  }

  function isCreated(){return localStorage.getItem(CREATED_KEY)==='1';}
  function setCreated(v){v?localStorage.setItem(CREATED_KEY,'1'):localStorage.removeItem(CREATED_KEY);}
  function getConfig(){
    try{
      const v=JSON.parse(localStorage.getItem(CONFIG_KEY)||'null');
      if(v && typeof v==='object') return v;
    }catch(_){}
    return defaultConfig();
  }
  function setConfig(cfg){localStorage.setItem(CONFIG_KEY,JSON.stringify(cfg));}

  async function waitMenu(){
    try{
      if(window.BTG_MENU_REGISTRY?.ready) await window.BTG_MENU_REGISTRY.ready();
    }catch(err){console.warn('Dashboard kunde inte vänta på meny',err);}
  }

  function isDashboardActive(){
    const dash=findDashboard();
    if(!dash) return false;

    const rebuiltActive=$('#btgRebuiltNav [data-btg-page-key="dashboard"].active, #btgRebuiltNav [data-btg-page-key="dashboard"][aria-selected="true"]');
    if(rebuiltActive) return true;

    const anyRebuiltActive=$('#btgRebuiltNav .btg-rebuilt-menu-btn.active, #btgRebuiltNav .btg-rebuilt-menu-btn[aria-selected="true"]');
    if(anyRebuiltActive && anyRebuiltActive.dataset.btgPageKey!=='dashboard') return false;

    if(dash.classList.contains('active')) return true;
    if(dash.getAttribute('aria-hidden')==='false') return true;

    const stored=localStorage.getItem('btg_active_page_key');
    if(stored && stored!=='dashboard') return false;

    return !anyRebuiltActive;
  }

  async function mountShell(){
    await waitMenu();
    const dash=findDashboard();
    if(!dash || !isDashboardActive()) return;
    dash.classList.add('btg-dashboard-clean');
    let root=$('#btgDashboardCreateRoot',dash);
    if(!root){
      root=document.createElement('div');
      root.id='btgDashboardCreateRoot';
      dash.prepend(root);
    }
    document.documentElement.classList.remove('btg-dashboard-booting');
    await renderRoot(root);
  }

  async function renderRoot(root){
    if(!isCreated()){
      root.innerHTML=`<div class="btg-safe-dashboard-hero btg-dashboard-build-first">
        <div class="inner">
          <h2>Bygg din dashboard</h2>
          <p>Välj vilka widgets du vill ha, och justera höjden på varje kort. Du kan bara välja sidor som din användare har tillgång till.</p>
          <div class="btg-safe-dashboard-actions" style="justify-content:center">
            <button class="btn" id="btgBuildDashboardBtn" type="button">Bygg din dashboard</button>
          </div>
        </div>
      </div>`;
      $('#btgBuildDashboardBtn',root)?.addEventListener('click',openBuilder);
      return;
    }

    const cfg=getConfig();
    const widgets=availableWidgets().filter(w=>cfg[w.key]?.enabled);
    const silos=widgets.some(w=>w.key==='cement_silos') ? await loadSilos() : [];
    const testing=widgets.some(w=>w.key==='testing') ? await loadTestingTasks() : [];
    const metrics=collectOldDashboardValues();

    root.innerHTML=`<div class="btg-safe-dashboard-hero">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start">
        <div>
          <h2>Min dashboard</h2>
          <p>${esc(factoryName())}</p>
        </div>
        <div class="btg-safe-dashboard-actions">
          <button class="btn secondary" id="btgEditDashboardBtn" type="button">Ändra dashboard</button>
          <button class="btn secondary" id="btgResetDashboardBtn" type="button">Bygg om från början</button>
        </div>
      </div>
      <div class="btg-safe-dashboard-grid">
        ${widgets.length ? widgets.map(w=>renderWidget(w.key,{silos,testing,metrics,height:cfg[w.key]?.height||'normal'})).join('') : `<div class="btg-safe-widget full height-normal"><div class="btg-safe-empty">Inga widgets valda ännu.<br><button class="btn" id="btgBuildDashboardEmptyBtn" type="button">Bygg din dashboard</button></div></div>`}
      </div>
    </div>`;

    $('#btgEditDashboardBtn',root)?.addEventListener('click',openBuilder);
    $('#btgResetDashboardBtn',root)?.addEventListener('click',()=>{
      if(confirm('Vill du bygga om dashboarden från början?')){
        setCreated(false);
        localStorage.removeItem(CONFIG_KEY);
        renderRoot(root);
      }
    });
    $('#btgBuildDashboardEmptyBtn',root)?.addEventListener('click',openBuilder);
    root.querySelectorAll('[data-open-widget]').forEach(b=>b.addEventListener('click',()=>openWidget(b.dataset.openWidget)));
  }

  function widgetClass(height){return `btg-safe-widget full height-${height||'normal'}`;}

  function connectionStatus(){
    const hasDb=!!db();
    const hasUser=!!(email() || user().id || profile().user_id);
    const hasFactory=!!factoryId();
    if(hasDb && hasUser && hasFactory) return {label:'Ansluten',cls:'',note:'Supabase, användare och fabrik hittades'};
    if(hasDb) return {label:'Delvis ansluten',cls:'warn',note:'Supabase hittades men all profilinfo är inte laddad'};
    return {label:'Ej ansluten',cls:'bad',note:'Supabase-klient saknas'};
  }

  function permissionChips(){
    return navButtons()
      .filter(b=>b.closest('#btgRebuiltNav') && !b.hidden && b.style.display!=='none')
      .map(b=>(b.textContent||'').trim())
      .filter(Boolean)
      .slice(0,16);
  }

  function renderWidget(key,data){
    const height=data.height||'normal';
    if(key==='factory_status'){
      const st=connectionStatus();
      const chips=permissionChips();
      return `<div class="${widgetClass(height)} btg-factory-widget">
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start">
          <div>
            <h4>Aktiv fabrik</h4>
            <div class="btg-safe-metric">${esc(factoryName())}</div>
            <div class="muted"><span class="btg-status-dot ${esc(st.cls)}"></span>${esc(st.label)} – ${esc(st.note)}</div>
          </div>
        </div>
        <div class="btg-factory-info-grid">
          <div class="btg-factory-info-item"><span>Fabrik-ID</span><b>${esc(factoryId())}</b></div>
          <div class="btg-factory-info-item"><span>Inloggad</span><b>${esc(email()||user().id||profile().user_id||'Okänd')}</b></div>
          <div class="btg-factory-info-item"><span>Roll</span><b>${esc(role())}</b></div>
          <div class="btg-factory-info-item"><span>Supabase</span><b>${db()?'Klient aktiv':'Saknas'}</b></div>
        </div>
        <div class="btg-permission-chips">
          ${chips.length ? chips.map(p=>`<span class="btg-permission-chip">${esc(p)}</span>`).join('') : `<span class="btg-permission-chip">Inga menybehörigheter hittades</span>`}
        </div>
      </div>`;
    }

    if(key==='overview'){
      return `<div class="${widgetClass(height)}"><h4>Översikt</h4>
        ${data.metrics.length ? data.metrics.map(m=>`<div class="btg-safe-row"><span>${esc(m.label)}</span><b>${esc(m.value)}</b></div>`).join('') : `<div class="muted">Inga dashboardvärden hittades ännu.</div>`}
      </div>`;
    }

    if(key==='checklist'){
      return `<div class="${widgetClass(height)}"><h4>Kom igång</h4>
        <div class="btg-safe-metric">Checklista</div>
        <div class="btg-safe-row"><span>Material</span><b>Kontrollera</b></div>
        <div class="btg-safe-row"><span>Recept</span><b>Kontrollera</b></div>
        <div class="btg-safe-row"><span>Silor</span><b>Kontrollera</b></div>
      </div>`;
    }

    if(key==='testing'){
      return `<div class="${widgetClass(height)}">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
          <div><h4>Provningar</h4><div class="muted">Satser där kub/provtagning ska tas och status gjord/ej gjord</div></div>
          <button class="btn secondary" data-open-widget="cubes" type="button">Öppna</button>
        </div>
        ${renderTestingTasks(data.testing || [])}
      </div>`;
    }

    if(key==='cement_silos'){
      return `<div class="${widgetClass(height)}">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
          <div><h4>Material & Silor</h4><div class="muted">Synkad nivå från Material & Silor-fliken</div></div>
          <button class="btn secondary" data-open-widget="cement_silos" type="button">Öppna</button>
        </div>
        ${renderSilos(data.silos)}
      </div>`;
    }

    if(key==='temperature_tables'){
      const rows=window.BTG_TABLE_TEMPERATURE?.dashboardSnapshot ? window.BTG_TABLE_TEMPERATURE.dashboardSnapshot() : [];
      return `<div class="${widgetClass(height)}">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
          <div><h4>Bord & Temperatur</h4><div class="muted">Live/simulerad temperatur per bord och sensor</div></div>
          <button class="btn secondary" data-open-widget="temperature_tables" type="button">Öppna</button>
        </div>
        <div class="btg-temp-widget-list">
          ${rows.length ? rows.map(x=>`<div class="btg-temp-widget-row">
            <div><b>${esc(x.table?.name || 'Bord')}</b><span>${esc(x.sensor?.name || 'Sensor')}</span></div>
            <strong>${x.reading ? Number(x.reading.temperatureC).toFixed(1)+' °C' : '—'}</strong>
          </div>`).join('') : '<div class="btg-safe-empty">Inga sensorer skapade ännu.</div>'}
        </div>
      </div>`;
    }

    const info={
      quality_trends:['Kvalitetstrender','Trender','quality_trends'],
      economy:['Ekonomi & Kalkyl','Kalkyl','economy'],
      orders:['Kunder & Beställningar','Order','orders'],
      documents:['Offert / Faktura','Dokument','documents'],
      reports:['Rapporter','PDF','reports'],
      materials:['Material','Material','materials'],
      recipes:['Recept','Recept','recipes'],
      system_center:['Systemcenter','Admin','system_center'],
      prefab:['Prefabkö','Kö','prefab'],
      demoulding:['Avformningskuber','Avformning','demoulding'],
      temperature_tables:['Bord & Temperatur','Sensorer','temperature_tables']
    }[key];

    if(!info) return '';
    return `<div class="${widgetClass(height)}">
      <h4>${esc(info[0])}</h4>
      <div class="btg-safe-metric">${esc(info[1])}</div>
      <div class="muted">Genväg till funktionen.</div>
      <button class="btn secondary" data-open-widget="${esc(info[2])}" type="button">Öppna</button>
    </div>`;
  }

  function collectOldDashboardValues(){
    const dash=findDashboard();
    if(!dash) return [];
    const values=[];
    Array.from(dash.children).filter(el=>el.id!=='btgDashboardCreateRoot').forEach(el=>{
      const cards=el.matches?.('.card,.stat-card,.kpi-card,.dashboard-card') ? [el] : Array.from(el.querySelectorAll?.('.card,.stat-card,.kpi-card,.dashboard-card')||[]);
      cards.forEach(card=>{
        const text=(card.innerText||'').trim();
        if(!text || /bygg din dashboard|min dashboard|skapa dashboard/i.test(text)) return;
        const lines=text.split('\n').map(x=>x.trim()).filter(Boolean);
        if(!lines.length) return;
        const value=lines.find(x=>/[0-9]/.test(x)) || lines[1] || '';
        const label=lines.find(x=>x!==value) || lines[0];
        values.push({label:label.slice(0,30),value:value.slice(0,24)});
      });
    });
    return values.slice(0,6);
  }

  async function loadTestingTasks(){
    const client=db();
    const fid=factoryId();

    const sf = getSamplingFrequencySettings();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
    const today = now.toISOString().slice(0,10);

    const batches = await loadProductionJournalBatches(monthStart, today);
    const cubes = await loadRegisteredCubes(monthStart, today);

    const planned = planSamplingBatches(batches, cubes, sf);
    return {
      settings: sf,
      label: samplingFrequencyLabel(sf),
      from: monthStart,
      to: today,
      batchesCount: batches.length,
      batchesM3: batches.reduce((s,b)=>s+n(b.amount),0),
      required: planned.length,
      done: planned.filter(x=>x.done).length,
      missing: planned.filter(x=>!x.done).length,
      items: planned.slice(0,12)
    };
  }

  function safeGlobalArray(name){
    try{
      const v = Function(`try{return ${name}}catch(e){return undefined}`)();
      return Array.isArray(v) ? v : [];
    }catch(_){ return []; }
  }

  function getSamplingFrequencySettings(){
    const defaults={enabled:true,mode:'workdays',every:5,volumeM3:150,batchCount:50,scope:'strength'};
    try{
      const sf = window.SETTINGS?.en206?.samplingFrequency || Function('try{return SETTINGS && SETTINGS.en206 && SETTINGS.en206.samplingFrequency}catch(e){return null}')();
      return {...defaults,...(sf||{})};
    }catch(_){ return defaults; }
  }

  function samplingFrequencyLabel(sf){
    if(!sf || sf.enabled===false) return 'Provfrekvens avstängd';
    const scope = (sf.scope||'strength')==='strength' ? ' per hållfasthetsklass' : '';
    if(sf.mode==='workdays') return `1 prov per ${sf.every||5} arbetsdag(ar)${scope}`;
    if(sf.mode==='productionDay') return `1 prov per ${sf.every||1} produktionsdag(ar)${scope}`;
    if(sf.mode==='weekly') return `1 prov per ${sf.every||1} produktionsvecka/veckor${scope}`;
    if(sf.mode==='monthly') return `1 prov per ${sf.every||1} produktionsmånad(er)${scope}`;
    if(sf.mode==='volume') return `1 prov per ${sf.volumeM3||150} m³${scope}`;
    if(sf.mode==='batches') return `1 prov per ${sf.batchCount||50} sats(er)${scope}`;
    if(sf.mode==='manual') return 'Manuell provfrekvensbedömning';
    return 'Provfrekvens';
  }

  function currentUserIdSafe(){
    return String(window.CURRENT_USER?.id || window.BTG_CURRENT_USER?.id || window.BTG_ACCESS_STATE?.user?.id || window.BTG_ACCESS_STATE?.user_id || window.BTG_ACCESS_STATE?.profile?.user_id || '');
  }

  function normalizeBatchForSampling(r){
    const app=r?.app_data || r || {};
    const id = r?.id || app.id || app.cloudId || app.batchId || app.batch_id || '';
    const dateTime = app.dateTime || app.datetime || r?.datetime || r?.date || r?.created_at || app.createdAt || new Date().toISOString();
    return {
      raw:r,
      id:String(id || `${dateTime}-${app.recipeName||app.recipe_name||''}-${app.amount||r?.amount_m3||''}`),
      cloudId:String(r?.id || app.cloudId || ''),
      batchNo: app.batchNo || app.batch_no || r?.batch_no || r?.batch_number || id || '',
      date:String(dateTime).slice(0,10),
      dateTime,
      recipeName: app.recipeName || app.recipe_name || r?.recipe_name || '',
      recipeId: app.recipeId || r?.recipe_id || '',
      strength: app.strength || app.strengthClass || r?.strength || r?.strength_class || '',
      customer: app.customerName || r?.customer_name || '',
      amount:n(app.amount ?? r?.amount_m3 ?? r?.amount ?? 0)
    };
  }

  function normalizeCubeForSampling(r){
    const app=r?.app_data || r || {};
    const castDate = app.castDate || r?.cast_date || r?.created_at || '';
    return {
      raw:r,
      id:String(r?.id || app.id || app.cloudId || ''),
      batchId:String(app.batchId || app.batch_id || r?.batch_id || ''),
      recipeId:String(app.recipeId || r?.recipe_id || ''),
      recipeName:app.recipeName || r?.recipe_name || '',
      strength:app.strengthClass || app.strength || r?.strength_class || '',
      castDate:String(castDate).slice(0,10),
      excludeFromEval:!!app.excludeFromEval
    };
  }

  async function loadProductionJournalBatches(from,to){
    const rows=[];
    [
      ...safeGlobalArray('LAST_BATCHES_VIEW'),
      ...safeGlobalArray('BATCHES'),
      ...safeGlobalArray('window.BTG_PRODUCTION_ROWS'),
      ...safeGlobalArray('window.BTG_BATCHES'),
      ...safeGlobalArray('window.productionRows'),
      ...safeGlobalArray('window.batches')
    ].forEach(x=>rows.push(x));

    const client=db();
    if(client){
      const uid=currentUserIdSafe();
      const selects=[
        'id,recipe_id,datetime,amount_m3,gwp,app_data,created_at,user_id',
        'id,app_data,created_at,user_id'
      ];
      for(const select of selects){
        try{
          let q=client.from('batches').select(select).order('created_at',{ascending:false}).limit(250);
          if(uid) q=q.eq('user_id',uid);
          const {data,error}=await q;
          if(!error && Array.isArray(data)){ rows.push(...data); break; }
        }catch(_){}
      }
    }

    const seen=new Set();
    return rows.map(normalizeBatchForSampling)
      .filter(b=>b.date && (!from || b.date>=from) && (!to || b.date<=to))
      .filter(b=>{
        const k=b.id || `${b.date}-${b.recipeName}-${b.amount}`;
        if(seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a,b)=>String(a.dateTime).localeCompare(String(b.dateTime)));
  }

  async function loadRegisteredCubes(from,to){
    const rows=[];
    [...safeGlobalArray('CUBES'), ...safeGlobalArray('window.CUBES'), ...safeGlobalArray('window.BTG_CUBES')].forEach(x=>rows.push(x));

    const client=db();
    if(client){
      const uid=currentUserIdSafe();
      const selects=[
        'id,recipe_id,cast_date,due_date,batch_id,note,app_data,created_at,user_id',
        'id,cast_date,batch_id,app_data,created_at,user_id'
      ];
      for(const select of selects){
        try{
          let q=client.from('cubes').select(select).order('cast_date',{ascending:false}).limit(250);
          if(uid) q=q.eq('user_id',uid);
          const {data,error}=await q;
          if(!error && Array.isArray(data)){ rows.push(...data); break; }
        }catch(_){}
      }
    }

    const seen=new Set();
    return rows.map(normalizeCubeForSampling)
      .filter(c=>!c.excludeFromEval)
      .filter(c=>!c.castDate || ((!from || c.castDate>=from) && (!to || c.castDate<=to)))
      .filter(c=>{
        const k=c.id || `${c.batchId}-${c.castDate}-${c.recipeId}`;
        if(seen.has(k)) return false;
        seen.add(k);
        return true;
      });
  }

  function cubeMatchesBatch(c,b){
    if(!c || !b) return false;
    if(c.batchId && (c.batchId===b.id || c.batchId===b.cloudId || c.batchId===b.batchNo)) return true;
    if(c.recipeId && b.recipeId && c.recipeId===String(b.recipeId) && c.castDate===b.date) return true;
    if(c.recipeName && b.recipeName && String(c.recipeName).toLowerCase()===String(b.recipeName).toLowerCase() && c.castDate===b.date) return true;
    return false;
  }

  function groupBatchesForSampling(batches,sf){
    if((sf.scope||'strength')!=='strength') return [['all',batches]];
    const m=new Map();
    batches.forEach(b=>{
      const key=b.strength || 'Okänd hållfasthet';
      if(!m.has(key)) m.set(key,[]);
      m.get(key).push(b);
    });
    return Array.from(m.entries());
  }

  function planSamplingBatches(batches,cubes,sf){
    if(!sf || sf.enabled===false || sf.mode==='manual') return [];
    const planned=[];
    const groups=groupBatchesForSampling(batches,sf);
    for(const [group,items] of groups){
      const sorted=[...items].sort((a,b)=>String(a.dateTime).localeCompare(String(b.dateTime)));
      const chosen=chooseBatchesByFrequency(sorted,sf);
      chosen.forEach(b=>{
        const done=cubes.some(c=>cubeMatchesBatch(c,b));
        planned.push({
          id:b.id,
          batch:b.batchNo || b.id,
          date:b.date,
          recipe:b.recipeName,
          strength:b.strength || group,
          amount:b.amount,
          group,
          done
        });
      });
    }
    return planned.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  }

  function chooseBatchesByFrequency(batches,sf){
    const mode=sf.mode||'workdays';
    const out=[];
    if(!batches.length) return out;

    if(mode==='batches'){
      const step=Math.max(1,parseInt(sf.batchCount||50,10)||50);
      for(let i=step-1;i<batches.length;i+=step) out.push(batches[i]);
      if(!out.length && batches.length) out.push(batches[batches.length-1]);
      return out;
    }

    if(mode==='volume'){
      const limit=Math.max(0.001,parseFloat(sf.volumeM3||150)||150);
      let acc=0;
      for(const b of batches){
        acc+=n(b.amount);
        if(acc>=limit){ out.push(b); acc=0; }
      }
      if(!out.length && batches.reduce((s,b)=>s+n(b.amount),0)>0) out.push(batches[batches.length-1]);
      return out;
    }

    const every=Math.max(1,parseInt(sf.every||1,10)||1);
    const keyFn = mode==='weekly'
      ? b=>isoWeekKey(b.date)
      : mode==='monthly'
        ? b=>String(b.date).slice(0,7)
        : b=>b.date; // workdays och productionDay per dag

    const periodFirst=[];
    const seen=new Set();
    batches.forEach(b=>{
      if(mode==='workdays'){
        const day=new Date(b.date+'T12:00:00').getDay();
        if(day===0 || day===6) return;
      }
      const k=keyFn(b);
      if(!k || seen.has(k)) return;
      seen.add(k);
      periodFirst.push(b);
    });

    for(let i=every-1;i<periodFirst.length;i+=every) out.push(periodFirst[i]);
    if(!out.length && periodFirst.length) out.push(periodFirst[periodFirst.length-1]);
    return out;
  }

  function isoWeekKey(dateISO){
    try{
      const d=new Date(dateISO+'T12:00:00');
      const day=d.getDay()||7;
      d.setDate(d.getDate()+4-day);
      const y0=new Date(d.getFullYear(),0,1);
      const week=Math.ceil((((d-y0)/86400000)+1)/7);
      return d.getFullYear()+'-W'+String(week).padStart(2,'0');
    }catch(_){ return dateISO || ''; }
  }

  function renderTestingTasks(result){
    const items=Array.isArray(result) ? result : (result?.items || []);
    const label=Array.isArray(result) ? 'Provfrekvens' : result.label;
    const done=Array.isArray(result) ? items.filter(x=>x.done).length : (result.done||0);
    const missing=Array.isArray(result) ? items.filter(x=>!x.done).length : (result.missing||0);
    const required=Array.isArray(result) ? items.length : (result.required||0);
    const batchesCount=Array.isArray(result) ? 0 : (result.batchesCount||0);
    const batchesM3=Array.isArray(result) ? 0 : (result.batchesM3||0);

    if(!items.length){
      return `<div class="btg-testing-summary">
        <div><span>Tillverkningsjournal</span><b>${batchesCount}</b></div>
        <div><span>Provfrekvens</span><b>0</b></div>
        <div><span>Saknas</span><b>0</b></div>
      </div>
      <div class="btg-safe-empty">Inga provtagningskrav hittades för aktuell månad. Kontrollera att Tillverkningsjournalen har satser och att Provfrekvens är aktiverad.</div>
      <div class="muted" style="margin-top:8px">${esc(label||'Provfrekvens')}</div>`;
    }

    return `<div class="btg-testing-summary">
      <div><span>Tillverkningsjournal</span><b>${batchesCount}</b></div>
      <div><span>Krav / gjorda</span><b>${required} / ${done}</b></div>
      <div><span>Saknas</span><b>${missing}</b></div>
    </div>
    <div class="muted" style="margin:0 0 10px">${esc(label)} • ${batchesM3.toFixed(2)} m³ denna månad</div>
    <div class="btg-testing-list">
      ${items.map(x=>`<div class="btg-testing-row ${x.done?'done':'todo'}">
        <div>
          <b>${esc([x.strength || 'Okänd hållfasthet', x.date].filter(Boolean).join(' • '))}</b>
          <span>${esc([x.recipe, x.amount?x.amount+' m³':''].filter(Boolean).join(' • ') || 'Tillverkningsjournal')}</span>
        </div>
        <strong>${x.done?'Kub tagen':'Kub saknas'}</strong>
      </div>`).join('')}
    </div>`;
  }


  async function loadSilos(){
    const c=window.BTG_CEMENT_SILOS;
    try{
      if(c?.getDashboardData){
        const data=c.getDashboardData();
        if(Array.isArray(data) && data.length) return data.map(x=>Object.assign({__fromCementAnalysis:true},x));
      }
      if(c?.refresh){
        await c.refresh();
        const data=c.getDashboardData?.();
        if(Array.isArray(data) && data.length) return data.map(x=>Object.assign({__fromCementAnalysis:true},x));
      }
    }catch(err){console.warn('Dashboard kunde inte synka silodata',err);}
    const state=c?.state;
    if(Array.isArray(state?.analysis) && state.analysis.length){
      return state.analysis.map(x=>({__fromCementAnalysis:true,name:x.silo?.name,maxCapacityKg:n(x.silo?.maxCapacityKg),currentKg:n(x.currentKg),pct:n(x.pct),status:x.status}));
    }
    if(Array.isArray(state?.silos) && state.silos.length) return state.silos;
    return [];
  }

  function renderSilos(silos){
    if(!silos.length) return `<div class="btg-safe-empty">Inga silor hittades för aktiv fabrik.</div>`;

    const cur=s=>n(s.currentKg ?? s.current_level_kg ?? s.current_kg ?? s.current_level ?? s.balance_kg ?? s.start_level_kg ?? s.content_kg);
    const max=s=>n(s.maxCapacityKg ?? s.max_capacity_kg ?? s.capacity_kg ?? s.max_capacity ?? s.capacity ?? s.max);
    const pct=s=>s.__fromCementAnalysis ? Math.max(0,Math.min(100,n(s.pct))) : (max(s)?Math.max(0,Math.min(100,cur(s)/max(s)*100)):0);
    const siloName=s=>s.name || s.silo_name || s.title || 'Silo';
    const materialName=s=>s.materialName || s.material_name || s.cementName || s.cement_name || s.material?.name || s.cement?.name || 'Ej kopplat material';
    const short=v=>{
      const t=String(v||'').trim();
      return t.length>22 ? t.slice(0,21)+'…' : t;
    };
    const statusText=(s,p)=>{
      if(s.status==='crit' || p<15) return 'Kritisk nivå';
      if(s.status==='warn' || p<30) return 'Låg nivå';
      return 'OK nivå';
    };

    const total=silos.reduce((a,s)=>a+cur(s),0);
    const totalCapacity=silos.reduce((a,s)=>a+max(s),0);
    const totalPct=totalCapacity?Math.round(total/totalCapacity*100):0;

    return `<div class="btg-cement-dashboard-summary">
      <div><span>Totalt innehåll</span><b>${fmtKg(total)}</b></div>
      <div><span>Total kapacitet</span><b>${fmtKg(totalCapacity)}</b></div>
      <div><span>Fyllnadsgrad</span><b>${totalPct}%</b></div>
    </div>
    <div class="btg-cement-dashboard-silos">${silos.slice(0,8).map(s=>{
      const current=cur(s);
      const capacity=max(s);
      const p=pct(s);
      const cls=(s.status==='crit'||p<15)?'bad':(s.status==='warn'||p<30)?'warn':'';
      const name=siloName(s);
      const material=materialName(s);
      return `<div class="btg-cement-dashboard-silo-card ${cls}">
        <div class="btg-cement-dashboard-silo-top">
          <b title="${esc(name)}">${esc(short(name))}</b>
          <span>${Math.round(p)}%</span>
        </div>
        <div class="btg-cement-dashboard-silo-visual">
          <div class="btg-safe-silo ${cls}">
            <div class="btg-safe-silo-fill" style="height:${p}%"></div>
          </div>
        </div>
        <div class="btg-cement-dashboard-silo-name" title="${esc(name)}">${esc(short(name))}</div>
        <div class="btg-cement-dashboard-silo-material" title="${esc(material)}">${esc(short(material))}</div>
        <div class="btg-cement-dashboard-silo-values">
          <div><span>Aktuellt</span><b>${fmtKg(current)}</b></div>
          <div><span>Max</span><b>${fmtKg(capacity)}</b></div>
        </div>
        <div class="btg-cement-dashboard-silo-status">${esc(statusText(s,p))}</div>
      </div>`;
    }).join('')}</div>
    <div class="muted" style="margin-top:8px">${silos.length} silo${silos.length===1?'':'r'} • synkad med Material & Silor-fliken</div>`;
  }

  function openWidget(page){
    const btn=$(`#btgRebuiltNav [data-btg-page-key="${page}"]`);
    if(btn){btn.click(); return;}
    if(page==='cubes'){ const b=document.querySelector('#btgRebuiltNav [data-btg-page-key="cubes"]'); if(b){b.click(); return;} }
    if(page==='prefab'){ const b=document.querySelector('#btgRebuiltNav [data-btg-page-key="prefab"]'); if(b){b.click(); return;} }
    if(page==='demoulding'){ const b=document.querySelector('#btgRebuiltNav [data-btg-page-key="demoulding"]'); if(b){b.click(); return;} }
    if(page==='temperature_tables'){ const b=document.querySelector('#btgRebuiltNav [data-btg-page-key="temperature_tables"]'); if(b){b.click(); return;} if(window.BTG_TABLE_TEMPERATURE?.open){window.BTG_TABLE_TEMPERATURE.open(); return;} }
    if(page==='cement_silos' && window.BTG_CEMENT_SILOS?.open){window.BTG_CEMENT_SILOS.open(); return;}
    alert('Kunde inte öppna modulen.');
  }

  function ensureBuilder(){
    let d=$('#btgDashboardBuilderDialog');
    if(d) return d;
    d=document.createElement('dialog');
    d.id='btgDashboardBuilderDialog';
    d.className='btg-safe-builder';
    d.innerHTML=`<div class="btg-safe-builder-inner">
      <div class="btg-safe-builder-head">
        <div><h3>Bygg din dashboard</h3><p>Välj widgets och höjd per kort. Alla kort är full sidbredd.</p></div>
        <button class="btn secondary" data-close-dashboard-builder type="button">Stäng</button>
      </div>
      <div id="btgDashboardWidgetList" class="btg-safe-widget-list"></div>
      <div class="btg-safe-builder-actions">
        <button class="btn secondary" id="btgDashboardDefaultBtn" type="button">Välj standard</button>
        <button class="btn" id="btgDashboardSaveBtn" type="button">Spara dashboard</button>
      </div>
    </div>`;
    document.body.appendChild(d);
    d.addEventListener('click',e=>{if(e.target.matches('[data-close-dashboard-builder]')) d.close();});
    $('#btgDashboardDefaultBtn',d)?.addEventListener('click',()=>renderBuilder(defaultConfig()));
    $('#btgDashboardSaveBtn',d)?.addEventListener('click',()=>{
      const cfg={};
      $$('[data-dashboard-widget]',d).forEach(input=>{
        const key=input.value;
        const sel=d.querySelector(`[data-widget-height="${CSS.escape(key)}"]`);
        cfg[key]={enabled:input.checked,height:sel?.value||'normal'};
      });
      setConfig(cfg);
      setCreated(true);
      d.close();
      const root=$('#btgDashboardCreateRoot');
      if(root) renderRoot(root);
    });
    return d;
  }

  function renderBuilder(config){
    const d=ensureBuilder();
    const cfg=config || getConfig();
    const widgets=availableWidgets();
    $('#btgDashboardWidgetList',d).innerHTML = widgets.length ? widgets.map(w=>{
      const item=cfg[w.key] || {};
      return `<label class="btg-safe-widget-option">
        <input type="checkbox" data-dashboard-widget value="${esc(w.key)}" ${item.enabled?'checked':''}>
        <div><b>${esc(w.label)}</b><span>${esc(w.hint)}</span></div>
        <select class="btg-widget-height-select" data-widget-height="${esc(w.key)}">
          <option value="compact" ${item.height==='compact'?'selected':''}>Kompakt höjd</option>
          <option value="normal" ${!item.height || item.height==='normal'?'selected':''}>Normal höjd</option>
          <option value="large" ${item.height==='large'?'selected':''}>Stor höjd</option>
          <option value="xlarge" ${item.height==='xlarge'?'selected':''}>Extra stor höjd</option>
        </select>
      </label>`;
    }).join('') : `<div class="btg-safe-empty">Inga tillgängliga widgets hittades.</div>`;
  }

  function openBuilder(){
    const d=ensureBuilder();
    renderBuilder();
    if(d.showModal) d.showModal(); else d.setAttribute('open','open');
  }

  function boot(){
    const start=()=>setTimeout(()=>mountShell().catch(err=>console.warn('dashboard mount failed',err)),120);
    if(window.BTG_MENU_REGISTRY?.ready) window.BTG_MENU_REGISTRY.ready().then(start).catch(start);
    else {
      document.addEventListener('btg:menu-ready',start,{once:true});
      setTimeout(start,1600);
    }
    document.addEventListener('btg:menu-ready',start);
    document.addEventListener('btg:cement-silos-updated',start);
    document.addEventListener('click',e=>{
      if(e.target.closest?.('#btgRebuiltNav button,.tab-btn,button[data-tab],nav button')) setTimeout(start,80);
    },true);
  }

  window.BTG_DASHBOARD_CUSTOMIZER={openBuilder,mountShell,openWidget};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();
