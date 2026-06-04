
/* BTG QC v19.5.51 – Rebuilt navigation from a single page registry */
(function(){
  'use strict';

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  document.documentElement.classList.add('btg-menu-rebuild-started');
  document.documentElement.classList.remove('btg-menu-rebuilt','btg-menu-ready');

  const PAGES=[
    {key:'dashboard', label:'Dashboard', old:['btnDashboard'], match:[/dashboard|översikt|hem/], always:true},
    {key:'production', label:'Tillverkningsdata', match:[/tillverk|produktion|journal/], always:true},
    {key:'prefab', label:'Prefabkö', old:['btnPrefab','btnPrefabQueue'], match:[/prefab|prefabkö|prefabko/], module:true,
      exists:()=>true,
      open:()=> {
        if(window.BTG_PREFAB_QUEUE?.open){ window.BTG_PREFAB_QUEUE.open(); return true; }
        const sec=$('#tab-prefab');
        if(sec){
          activateSection(sec);
          sec.style.display='grid';
          sec.hidden=false;
          try{ window.loadPrefabModule?.(); }catch(_){}
          return true;
        }
        const old=findOldButton({match:[/prefab|prefabkö|prefabko/]});
        if(old){ old.click(); setTimeout(hideOldMenu,40); setTimeout(hideOldMenu,250); return true; }
        alert('Prefabkö kunde inte öppnas. Kontrollera att js/features/prefab/18-8-prefab-queue.js laddas.');
        return false;
      }
    },
    {key:'orders', label:'Beställningar', match:[/beställ|order|kund/], always:true},
    {key:'cubes', label:'Provningar', match:[/provning|provkub|kuber/], always:true},
    {key:'demoulding', label:'Avformningskuber', old:['btnDemoulding','btnAvformningskuber'], match:[/avform|avformningskuber|demould|demold/], module:true,
      exists:()=>true,
      open:()=> {
        if(window.BTG_DEMOULDING?.open){ window.BTG_DEMOULDING.open(); return true; }
        if(window.setTab){
          try{
            window.setTab('avformningskuber');
            setTimeout(hideOldMenu,40); setTimeout(hideOldMenu,250);
            return true;
          }catch(_){}
        }
        const old=findOldButton({match:[/avform|avformningskuber|demould|demold/]});
        if(old){ old.click(); setTimeout(hideOldMenu,40); setTimeout(hideOldMenu,250); return true; }
        const sec=$('#tab-avformningskuber');
        if(sec){
          activateSection(sec);
          sec.style.display='grid';
          sec.hidden=false;
          try{ window.refreshDemouldingModule?.(); }catch(_){}
          return true;
        }
        alert('Avformningskuber kunde inte öppnas. Kontrollera att js/features/demoulding/19-3-1-demoulding-cubes.js laddas.');
        return false;
      }
    },
    {key:'evaluation', label:'Utvärdering', match:[/utvärder|utvarder/], always:true},
    {key:'control', label:'Kontroll', match:[/kontroll/], always:true},
    {key:'materials', label:'Material', match:[/material/], always:true},
    {key:'temperature_tables', label:'Bord & Temperatur', match:[/bord.*temperatur|temperatur|sensor|termo|termokoppling/], always:true,
      exists:()=>true,
      open:()=> {
        if(window.BTG_TABLE_TEMPERATURE?.open){ window.BTG_TABLE_TEMPERATURE.open(); return true; }
        let sec=document.querySelector('#tab-temperature-tables');
        if(!sec && window.BTG_TABLE_TEMPERATURE?.render){ try{ window.BTG_TABLE_TEMPERATURE.render(); sec=document.querySelector('#tab-temperature-tables'); }catch(_e){} }
        if(sec){ activateSection(sec); return true; }
        alert('Bord & Temperatur-modulen kunde inte laddas. Kontrollera att js/features/temperature/table-temperature.js finns.');
        return false;
      }
    },
    {key:'diary', label:'Dagbok', match:[/dagbok/], always:true},

    {key:'cement_silos', label:'Material & Silor', match:[/cement|silo|silor/], module:true,
      exists:()=>!!window.BTG_CEMENT_SILOS || !!$('script[src*="cement-silos"]') || !!$('#tab-cement_silos'),
      open:()=> {
        if(window.BTG_CEMENT_SILOS?.open){ window.BTG_CEMENT_SILOS.open(); return true; }
        const sec=$('#tab-cement_silos');
        if(sec){ activateSection(sec); return true; }
        return false;
      }
    },
    {key:'quality_trends', label:'Kvalitetstrender', match:[/kvalitet|trend/], module:true,
      exists:()=>!!$('script[src*="quality"],script[src*="trend"]') || !!$('#tab-quality_trends')},
    {key:'economy', label:'Ekonomi & Kalkyl', match:[/ekonomi|kalkyl/], module:true,
      exists:()=>!!$('script[src*="economy"]') || !!$('#tab-economy')},
    {key:'documents', label:'Offert / Faktura', match:[/offert|faktura|dokument/], module:true,
      exists:()=>!!window.BTG_CUSTOMER_ORDER_DOCUMENTS || !!$('script[src*="customer-order-documents"],script[src*="system-documents"]')},
    {key:'environment', label:'Miljö', match:[/miljö|miljo|klimat|epd|miljövarudeklaration/], module:true,
      exists:()=>!!window.BTG_ENVIRONMENT_PAGE,
      open:()=> {
        if(window.BTG_ENVIRONMENT_PAGE?.open){ window.BTG_ENVIRONMENT_PAGE.open(); return true; }
        const sec=$('#tab-environment');
        if(sec){ activateSection(sec); return true; }
        return false;
      }
    },
    {key:'reports', label:'Rapporter', match:[/rapport/], module:true},
    {key:'factory_admin', label:'Fabriksadmin', match:[/fabriksadmin|access|behörighet/], module:true},
    {key:'system_center', label:'Systemcenter', old:['btnSystemCenter','btgNav_system_center'], match:[/systemcenter|system center/], superadmin:true,
      exists:()=> true}
  ];

  let readyPromise=null;
  let readyState=false;
  let lastMenuAccessSig='';
  let permsCache=null;

  function nav(){
    return $('.main-nav') || $('nav[aria-label="Huvudmeny"]') || $('nav.toolbar') || $('nav') || $('.tabs');
  }

  function btnText(b){
    return String((b.textContent||'')+' '+(b.dataset?.tab||'')+' '+(b.dataset?.nav||'')+' '+(b.id||'')).toLowerCase();
  }

  function oldButtons(){
    return $$('.tab-btn,button[data-tab],.main-nav button,nav button,.tabs button').filter(b=>!b.closest('dialog') && !b.closest('#btgRebuiltNav'));
  }

  function findOldButton(page){
    for(const id of page.old||[]){
      const b=$('#'+id);
      if(b) return b;
    }
    return oldButtons().find(b=>(page.match||[]).some(rx=>rx.test(btnText(b))));
  }

  function db(){
    try{return window.sb || window.supabaseClient || sb || null;}catch(_){return window.sb||window.supabaseClient||null;}
  }

  function profile(){
    return window.BTG_ACCESS_STATE?.profile || window.CURRENT_PROFILE || {};
  }

  function currentFactoryId(){
    return String(localStorage.getItem('btg_selected_factory_id') || window.BTG_ACTIVE_FACTORY_ID || window.BTG_CURRENT_FACTORY_ID || window.BTG_FACTORY_ADMIN_STATE?.activeFactoryId || window.BTG_ACCESS_STATE?.factory_id || profile().factory_id || '');
  }

  function currentUserId(){
    return String(window.CURRENT_USER?.id || window.BTG_CURRENT_USER?.id || window.BTG_ACCESS_STATE?.user?.id || window.BTG_ACCESS_STATE?.user_id || profile().user_id || '');
  }

  function role(){
    return String(profile().role || window.BTG_ACCESS_STATE?.role || '').toLowerCase();
  }

  function isSuperadmin(){
    const email=String(window.CURRENT_USER?.email||window.BTG_CURRENT_USER?.email||'').toLowerCase();
    const rc=String(profile().role_code||profile().role||window.BTG_ACCESS_STATE?.role||'').toLowerCase();
    return email==='j.ottosson53@gmail.com' || rc.includes('superadmin') || rc.includes('system_admin') || role().includes('superadmin') || !!window.BTG_IS_SUPERADMIN || !!window.BTG_ACCESS_STATE?.permissions?.superadmin;
  }

  async function waitForAppContext(maxMs=2500){
    const start=Date.now();
    while(Date.now()-start<maxMs){
      if(db() && (isSuperadmin() || currentFactoryId() || profile().factory_id || window.BTG_ACCESS_STATE)) return;
      await sleep(80);
    }
  }

  async function loadPerms(force=false){
    if(!force && permsCache) return permsCache;
    if(isSuperadmin()){
      permsCache={factory:{},user:{}};
      return permsCache;
    }
    const s=db();
    const factory=currentFactoryId();
    const user=currentUserId();
    if(!s || !factory){
      permsCache={factory:{},user:{}};
      return permsCache;
    }
    try{
      const {data,error}=await s.rpc('btg_get_effective_page_permissions',{p_factory_id:factory,p_user_id:user||null});
      if(error) throw error;
      permsCache=data || {factory:{},user:{}};
      return permsCache;
    }catch(err){
      console.warn('BTG rebuilt menu: behörigheter kunde inte läsas, visar standardmeny', err);
      permsCache={factory:{},user:{}};
      return permsCache;
    }
  }

  function pageKeyAliases(pageKey){
    const map={
      production:['production','tillverkning','manufacturing','manufacturing_journal','batches','tillverkningsdata','tillverkningsjournal'],
      cubes:['cubes','provningar','provkuber','cube_tests','testing'],
      orders:['orders','bestallningar','customers_orders','customer_orders','beställningar'],
      materials:['materials','material'],
      recipes:['recipes','recept'],
      evaluation:['evaluation','utvardering','utvärdering'],
      control:['control','kontroll'],
      diary:['diary','dagbok'],
      reports:['reports','rapport'],
      documents:['documents','customer_order_documents','offert_faktura','offert','faktura'],
      cement_silos:['cement_silos','material_silos','cement','silos'],
      temperature_tables:['temperature_tables','bord_temperatur','bord_och_temperatur','temperature','sensors'],
      environment:['environment','miljo','miljö','epd','climate'],
      demoulding:['demoulding','avformningskuber','avformning'],
      prefab:['prefab','prefab_queue','prefabkö','prefabko'],
      factory_admin:['factory_admin','fabriksadmin'],
      system_center:['system_center','systemcenter']
    };
    return map[pageKey] || [pageKey];
  }

  function allowedPagesFromAccessProfile(){
    try{
      const p = window.BTG_ACCESS_STATE?.profile || window.CURRENT_PROFILE || null;
      const perms = p?.permissions || {};
      const allowed = perms.allowed_pages || perms.allowedPages || perms.pages_allow || null;
      if(Array.isArray(allowed)) return allowed.map(String);
      if(allowed && typeof allowed === 'object') return Object.keys(allowed).filter(k=>allowed[k] !== false);
      return null;
    }catch(_){ return null; }
  }

  function modeFor(pageKey,perms){
    if(isSuperadmin()) return 'visible';
    const allowedPages = allowedPagesFromAccessProfile();
    if(Array.isArray(allowedPages)){
      const aliases = pageKeyAliases(pageKey);
      return aliases.some(k=>allowedPages.includes(k)) ? 'visible' : 'hidden';
    }
    const aliases=pageKeyAliases(pageKey);
    for(const key of aliases){
      const userMode=perms?.user?.[key];
      if(userMode && userMode!=='inherit') return userMode;
    }
    for(const key of aliases){
      const factoryMode=perms?.factory?.[key];
      if(factoryMode) return factoryMode;
    }
    return 'visible';
  }

  function hideTemperaturePage(){
    try{
      const tempSec=document.querySelector('#tab-temperature-tables');
      if(tempSec){
        tempSec.classList.remove('active');
        tempSec.style.display='none';
        tempSec.hidden=true;
        tempSec.setAttribute('aria-hidden','true');
      }
    }catch(_){}
  }

  function activateSection(sec){
    try{
      $$('.tab-content,.page,main section[id^="tab-"],#tab-temperature-tables').forEach(el=>{
        el.classList.remove('active');
        if(el.id && el.id!=='tab-dashboard'){
          el.style.display='none';
          el.hidden=true;
          el.setAttribute('aria-hidden','true');
        }
      });
      sec.hidden=false;
      sec.style.display='';
      sec.classList.add('active');
      window.scrollTo({top:0,behavior:'smooth'});
    }catch(_){}
  }

  function coreTabForPage(pageKey){
    const map={
      dashboard:'dashboard',
      production:'tillverkning',
      orders:'bestallningar',
      cubes:'provningar',
      evaluation:'utvardering',
      control:'kontroll',
      materials:'material',
      diary:'dagbok'
    };
    return map[pageKey] || null;
  }

  function openCorePage(pageKey){
    const tabName=coreTabForPage(pageKey);
    if(!tabName) return false;

    // Bästa vägen: använd appens ursprungliga setTab så render-funktioner körs.
    try{
      if(typeof window.BTG_DIRECT_CORE_OPEN==='function'){
        window.BTG_DIRECT_CORE_OPEN(tabName);
        return true;
      }
      if(typeof window.BTG_OPEN_CORE_TAB==='function'){
        window.BTG_OPEN_CORE_TAB(tabName);
        return true;
      }
      if(typeof window.setTab==='function'){
        window.setTab(tabName);
        return true;
      }
    }catch(err){ console.warn('Kunde inte öppna kärnsida via setTab:', err); }

    // Fallback: klicka på gamla flikknappen.
    const btn=document.querySelector(`button[data-tab="${tabName}"]`);
    if(btn){
      btn.click();
      return true;
    }

    // Sista fallback: visa rätt sektion direkt.
    const sec=document.getElementById(`tab-${tabName}`);
    if(sec){
      activateSection(sec);
      sec.style.display='grid';
      sec.hidden=false;
      return true;
    }
    return false;
  }

  function openPage(page){
    if(page?.key!=='temperature_tables') hideTemperaturePage();
    if(page.key==='system_center'){
      if(window.BTG_SYSTEM_CENTER?.open){ window.BTG_SYSTEM_CENTER.open(); return; }
      if(window.openSystemCenter){ window.openSystemCenter(); return; }
    }
    if(openCorePage(page.key)) return;
    if(page.open && page.open()) return;

    const old=findOldButton(page);
    if(old){
      // Viktigt: visa ALDRIG den gamla knappen igen.
      // Vi använder bara dess gamla click-handler internt.
      old.click();
      setTimeout(hideOldMenu,40);
      setTimeout(hideOldMenu,250);
      return;
    }

    const aliases=pageKeyAliases(page.key);
    for(const key of aliases){
      const section=$(`#tab-${key}`) || $(`#${key}`) || $(`[data-tab-content="${key}"]`) || $(`[data-tab="${key}"]`);
      if(section){
        if(section.tagName==='BUTTON'){ section.click(); return; }
        activateSection(section);
        return;
      }
    }

    const fallback=findOldButton({match:page.match||[], old:page.old||[]});
    if(fallback){ fallback.click(); setTimeout(hideOldMenu,40); setTimeout(hideOldMenu,250); return; }

    alert(page.label+' kunde inte öppnas. Kontrollera att modulen är laddad.');
  }

  function pageExists(page){
    const allManaged=new Set(PAGES.map(p=>p.key));
    if(page.always || allManaged.has(page.key)) return true;
    if(page.key==='system_center') return true;
    if(page.superadmin && !isSuperadmin()) return false;
    if(page.superadmin && isSuperadmin()) return true;
    if(typeof page.exists==='function') return page.exists();
    return !!findOldButton(page);
  }

  function hideOldMenu(){
    oldButtons().forEach(b=>{
      if(b.closest('#btgRebuiltNav')) return;
      b.dataset.btgOldMenuButton='1';
      b.style.setProperty('display','none','important');
      b.hidden=true;
      b.setAttribute('aria-hidden','true');
      b.classList.remove('active');
      b.setAttribute('aria-selected','false');
    });
  }

  function createOrGetNav(){
    const n=nav();
    if(!n) return null;

    let rebuilt=$('#btgRebuiltNav');
    if(!rebuilt){
      rebuilt=document.createElement('div');
      rebuilt.id='btgRebuiltNav';
      rebuilt.className='btg-rebuilt-nav';
      n.appendChild(rebuilt);
    }
    return rebuilt;
  }


  function setActivePage(key){
    $$('#btgRebuiltNav .btg-rebuilt-menu-btn').forEach(b=>{
      const active=b.dataset.btgPageKey===key;
      b.classList.toggle('active',active);
      b.setAttribute('aria-selected',active?'true':'false');
    });
    try{ localStorage.setItem('btg_active_page_key', key); }catch(_){}
  }

  function renderMenu(perms){
    const rebuilt=createOrGetNav();
    if(!rebuilt) return;

    hideOldMenu();
    rebuilt.innerHTML='';

    const storedActive=localStorage.getItem('btg_active_page_key') || 'dashboard';

    PAGES.forEach(page=>{
      if(!pageExists(page)) return;
      if(page.key==='system_center' && !isSuperadmin()){
        const hasProfile=!!(window.BTG_ACCESS_STATE?.profile || window.CURRENT_PROFILE);
        const hadOld=!!findOldButton(page) || !!$('script[src*="system-center"]');
        if(hasProfile && !hadOld) return;
      }
      const mode=modeFor(page.key,perms);
      if(mode==='hidden') return;

      const btn=document.createElement('button');
      btn.type='button';
      btn.className='tab-btn btg-rebuilt-menu-btn';
      btn.textContent=page.label;
      btn.dataset.btgPageKey=page.key;
      btn.dataset.btgPermissionMode=mode;
      btn.dataset.btgLocked=mode==='locked' ? '1' : '0';

      if(mode==='locked'){
        btn.classList.add('btg-nav-locked','sc-page-locked');
        btn.title='Låst för denna fabrik eller användare';
      }

      btn.addEventListener('click',ev=>{
        ev.preventDefault();
        ev.stopPropagation();
        if(btn.dataset.btgLocked==='1'){
          alert('Den här sidan är låst för din fabrik eller användare.');
          return;
        }
        if(page.key!=='temperature_tables') hideTemperaturePage();
        setActivePage(page.key);
        openPage(page);
        setTimeout(hideOldMenu,40);
        setTimeout(hideOldMenu,250);
      });

      rebuilt.appendChild(btn);
    });

    const activeExists=$(`#btgRebuiltNav [data-btg-page-key="${storedActive}"]`);
    setActivePage(activeExists ? storedActive : 'dashboard');
    hideOldMenu();
  }

  async function rebuild(force=false){
    await waitForAppContext();
    const perms=await loadPerms(force);
    renderMenu(perms);

    readyState=true;
    document.documentElement.classList.remove('btg-menu-rebuild-started','btg-menu-booting');
    document.documentElement.classList.add('btg-menu-rebuilt','btg-menu-ready');

    document.dispatchEvent(new CustomEvent('btg:menu-ready',{
      detail:{permissions:perms,pages:PAGES}
    }));

    return {permissions:perms,pages:PAGES};
  }

  function ready(){
    if(!readyPromise) readyPromise=rebuild(false);
    return readyPromise;
  }

  function forceRebuild(){
    permsCache=null;
    readyPromise=rebuild(true);
    return readyPromise;
  }
  function accessSig(){
    try{
      const st=window.BTG_ACCESS_STATE||{};
      return JSON.stringify({uid:st.user_id||'',fid:st.factory_id||'',role:st.role||'',pages:st.profile?.permissions?.allowed_pages||[]});
    }catch(_){ return String(Date.now()); }
  }
  function rebuildIfAccessChanged(){
    const sig=accessSig();
    if(sig===lastMenuAccessSig) return readyPromise || Promise.resolve();
    lastMenuAccessSig=sig;
    return forceRebuild();
  }

  function boot(){
    ready();
    window.addEventListener('btg:access-ready',()=>setTimeout(rebuildIfAccessChanged,250));
    window.addEventListener('btg:factory-changed',()=>setTimeout(forceRebuild,250));
    setTimeout(()=>rebuild(false),1500);
  }

  window.BTG_MENU_REGISTRY={
    ready,
    rebuild:forceRebuild,
    isReady:()=>readyState,
    pages:PAGES,
    modules:PAGES,
    getPerms:()=>loadPerms(false),
    isPageVisible:(key)=>{
      const btn=$(`#btgRebuiltNav [data-btg-page-key="${key}"]`);
      return !!btn && !btn.hidden && btn.style.display!=='none';
    }
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();
