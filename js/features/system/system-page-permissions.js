
/* BTG QC v19.5.35 – Systemcenter sidbehörigheter */
(function(){
  'use strict';
  const PAGE_DEFS=[
    {key:'dashboard',label:'Dashboard',hint:'Översikt, statuskort och startsida',match:['dashboard','hem','översikt']},
    {key:'materials',label:'Material',hint:'Materiallista, cement, ballast och tillsatsmedel',match:['material']},
    {key:'recipes',label:'Recept',hint:'Recept och receptkalkyler',match:['recept']},
    {key:'production',label:'Tillverkningsjournal',hint:'Satser, produktion och journal',match:['tillverk','produktion','journal']},
    {key:'orders',label:'Kunder & beställningar',hint:'Kunder, order och beställningar',match:['kund','beställ','order']},
    {key:'cubes',label:'Provkuber',hint:'Provtagningar, kuber och hållfasthetsresultat',match:['provkub','provning','kuber']},
    {key:'demoulding',label:'Avformningskuber',hint:'Avformning och tidiga hållfastheter',match:['avform']},
    {key:'diary',label:'Dagbok',hint:'Dagbok, leveranser och händelser',match:['dagbok']},
    {key:'reports',label:'Rapporter',hint:'Vecko-, månads- och utskriftsrapporter',match:['rapport']},
    {key:'quality_trends',label:'Kvalitetstrender',hint:'Trendrapport för provningar och avformningar',match:['kvalitetstrender','trender']},
    {key:'cement_silos',label:'Cement & Silor',hint:'Silonivåer, cementlager och förbrukning',match:['cement','silor','silo']},
    {key:'economy',label:'Ekonomi & Kalkyl',hint:'Materialpriser, utpris och täckningsbidrag',match:['ekonomi','kalkyl']},
    {key:'factory_admin',label:'Fabriksadmin',hint:'Fabriksinställningar, roller och access',match:['fabriksadmin','access','behörighet']},
    {key:'system_center',label:'Systemcenter',hint:'Systemägare och centralt management',match:['systemcenter']}
  ];
  const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const db=()=>window.sb||window.supabaseClient||null;
  const currentUser=()=>window.CURRENT_USER||null;
  const currentFactoryId=()=>String(window.BTG_ACTIVE_FACTORY_ID||window.BTG_CURRENT_FACTORY_ID||window.BTG_FACTORY_ADMIN_STATE?.activeFactoryId||window.BTG_ACCESS_STATE?.factory_id||window.BTG_ACCESS_STATE?.profile?.factory_id||'');
  const currentUserId=()=>String(currentUser()?.id||window.BTG_ACCESS_STATE?.profile?.user_id||window.BTG_ACCESS_STATE?.user_id||'');
  const state={factories:[],users:[],selectedFactory:'',selectedUser:'',factoryPerms:{},userPerms:{},loading:false};

  function isSuperadmin(){
    const e=String(currentUser()?.email||window.BTG_SYSTEM_CENTER?.state?.authEmail||'').toLowerCase();
    return !!(window.BTG_SYSTEM_CENTER?.state?.canAccess || e==='j.ottosson53@gmail.com' || String(window.BTG_ACCESS_STATE?.profile?.role||window.BTG_ACTIVE_ROLE||'').toUpperCase().includes('SUPER'));
  }

  async function rpc(name,args){
    const client=db(); if(!client) throw new Error('Supabase-klient saknas');
    const {data,error}=await client.rpc(name,args||{});
    if(error) throw error;
    return data;
  }

  async function loadFactoriesUsers(){
    try{
      const data=await rpc('btg_systemcenter_get_permissions_meta',{});
      state.factories=Array.isArray(data?.factories)?data.factories:[];
      state.users=Array.isArray(data?.users)?data.users:[];
    }catch(err){
      // fallback from existing Systemcenter state
      state.factories=window.BTG_SYSTEM_CENTER?.state?.factories||[];
      state.users=window.BTG_SYSTEM_CENTER?.state?.users||[];
      if(!state.factories.length && !state.users.length) console.warn('Kunde inte läsa meta för sidbehörigheter',err);
    }
  }

  async function loadPermissions(){
    const f=state.selectedFactory; const u=state.selectedUser;
    if(!f){ state.factoryPerms={}; state.userPerms={}; return; }
    const data=await rpc('btg_systemcenter_get_page_permissions',{p_factory_id:String(f),p_user_id:u?String(u):null});
    state.factoryPerms=data?.factory||{};
    state.userPerms=data?.user||{};
  }

  async function savePermissions(){
    const f=state.selectedFactory; const u=state.selectedUser;
    if(!f) return alert('Välj fabrik först.');
    const payload={factory:state.factoryPerms,user:u?state.userPerms:{}};
    await rpc('btg_systemcenter_set_page_permissions',{p_factory_id:String(f),p_user_id:u?String(u):null,p_permissions:payload});
    alert('Behörigheter sparade.');
    await applyCurrentPermissions();
  }

  function ensureDialog(){
    let dlg=$('#scPagePermissionsDialog');
    if(dlg) return dlg;
    dlg=document.createElement('dialog');
    dlg.id='scPagePermissionsDialog'; dlg.className='sc-perm-modal';
    dlg.innerHTML=`<div class="sc-perm-inner">
      <div class="sc-perm-head">
        <div><h3>Sidbehörigheter</h3><p class="sc-perm-sub">Styr vilka sidor en fabrik får använda, och gör undantag per användare i den fabriken.</p></div>
        <button class="btn secondary" type="button" data-sc-perm-close>Stäng</button>
      </div>
      <div class="sc-perm-note">
        Fabriksnivå gäller för alla användare i fabriken. Användarnivå kan <b>ärva</b>, <b>visa</b>, <b>dölja</b> eller <b>låsa</b> en specifik sida.
      </div>
      <div class="sc-perm-target">
        <label>Fabrik<select id="scPermFactory"></select></label>
        <label>Användare i vald fabrik<select id="scPermUser"></select></label>
      </div>
      <div id="scPermGrid" class="sc-perm-grid"></div>
      <div class="sc-perm-actions">
        <button class="btn secondary" type="button" id="scPermReload">Ladda om</button>
        <button class="btn" type="button" id="scPermSave">Spara behörigheter</button>
      </div>
    </div>`;
    document.body.appendChild(dlg);
    dlg.addEventListener('click',e=>{ if(e.target.matches('[data-sc-perm-close]')) dlg.close(); });
    $('#scPermReload',dlg)?.addEventListener('click',async()=>{await refreshDialog();});
    $('#scPermSave',dlg)?.addEventListener('click',async()=>{try{await savePermissions();}catch(err){alert('Kunde inte spara: '+(err.message||err));}});
    $('#scPermFactory',dlg)?.addEventListener('change',async e=>{state.selectedFactory=e.target.value; state.selectedUser=''; await refreshDialog(false);});
    $('#scPermUser',dlg)?.addEventListener('change',async e=>{state.selectedUser=e.target.value; await refreshDialog(false);});
    return dlg;
  }

  function factoryName(f){return f.name||f.factory_name||f.display_name||f.id||f.factory_id||'Fabrik'}
  function factoryId(f){return String(f.id||f.factory_id||f.factoryId||'')}
  function userFactoryId(u){return String(u.factory_id||u.factoryId||u.factory||'')}
  function userId(u){return String(u.user_id||u.id||u.profile_id||'')}
  function userLabel(u){return u.email||u.user_email||u.name||u.full_name||userId(u)||'Användare'}

  function renderSelectors(){
    const fsel=$('#scPermFactory'), usel=$('#scPermUser'); if(!fsel||!usel) return;
    fsel.innerHTML=`<option value="">Välj fabrik…</option>`+state.factories.map(f=>`<option value="${esc(factoryId(f))}" ${factoryId(f)===state.selectedFactory?'selected':''}>${esc(factoryName(f))}</option>`).join('');
    const users=state.users.filter(u=>!state.selectedFactory || userFactoryId(u)===state.selectedFactory);
    usel.innerHTML=`<option value="">Ingen användare – bara fabriksnivå</option>`+users.map(u=>`<option value="${esc(userId(u))}" ${userId(u)===state.selectedUser?'selected':''}>${esc(userLabel(u))}</option>`).join('');
  }

  function setFactoryMode(key,mode){state.factoryPerms[key]=mode;}
  function setUserMode(key,mode){state.userPerms[key]=mode;}
  function badge(mode){return `<span class="sc-perm-badge ${esc(mode||'visible')}">${esc(({visible:'Visad',hidden:'Dold',locked:'Låst',inherit:'Ärv'}[mode]||mode||'Visad'))}</span>`}

  function renderGrid(){
    const grid=$('#scPermGrid'); if(!grid) return;
    grid.innerHTML=PAGE_DEFS.map(p=>{
      const fm=state.factoryPerms[p.key]||'visible';
      const um=state.selectedUser?(state.userPerms[p.key]||'inherit'):'';
      return `<div class="sc-perm-card">
        <h4>${esc(p.label)} ${badge(fm)}</h4>
        <p>${esc(p.hint)}</p>
        <div class="sc-perm-modes" data-scope="factory" data-key="${esc(p.key)}">
          ${['visible:Visa','hidden:Dölj','locked:Lås'].map(x=>{const [m,l]=x.split(':');return `<label class="sc-perm-mode"><input type="radio" name="f_${esc(p.key)}" value="${m}" ${fm===m?'checked':''}> ${l}</label>`}).join('')}
        </div>
        ${state.selectedUser?`<div style="height:8px"></div><div class="sc-perm-modes" data-scope="user" data-key="${esc(p.key)}">
          ${['inherit:Ärv','visible:Visa','hidden:Dölj','locked:Lås'].map(x=>{const [m,l]=x.split(':');return `<label class="sc-perm-mode"><input type="radio" name="u_${esc(p.key)}" value="${m}" ${um===m?'checked':''}> ${l}</label>`}).join('')}
        </div>`:''}
      </div>`;
    }).join('');
    $$('input[type=radio]',grid).forEach(inp=>inp.addEventListener('change',e=>{
      const wrap=e.target.closest('.sc-perm-modes'); if(!wrap) return;
      if(wrap.dataset.scope==='factory') setFactoryMode(wrap.dataset.key,e.target.value);
      else setUserMode(wrap.dataset.key,e.target.value);
    }));
  }

  async function refreshDialog(loadMeta=true){
    if(loadMeta) await loadFactoriesUsers();
    if(!state.selectedFactory && state.factories[0]) state.selectedFactory=factoryId(state.factories[0]);
    renderSelectors();
    try{ await loadPermissions(); }catch(err){ console.warn(err); }
    renderSelectors(); renderGrid();
  }

  async function openPermissions(factoryIdArg,userIdArg){
    if(!isSuperadmin()) return alert('Endast superadmin kan ändra sidbehörigheter.');
    const dlg=ensureDialog();
    if(factoryIdArg) state.selectedFactory=String(factoryIdArg);
    if(userIdArg) state.selectedUser=String(userIdArg);
    await refreshDialog(true);
    if(typeof dlg.showModal==='function') dlg.showModal(); else dlg.setAttribute('open','open');
  }

  function injectSystemcenterButtons(){
    const root=$('#systemCenterRoot'); if(!root) return;
    const create=$('#scCreateFactoryBtn',root);
    if(create && !$('#scPagePermGlobalBtn',root)){
      const b=document.createElement('button');
      b.id='scPagePermGlobalBtn'; b.className='btn secondary sc-perm-open-btn'; b.type='button'; b.textContent='Sidbehörigheter';
      b.addEventListener('click',()=>openPermissions());
      create.parentElement?.insertBefore(b,create);
    }
    // add buttons to factory rows when possible
    $$('table tbody tr',root).forEach(tr=>{
      const text=tr.textContent||'';
      if(tr.querySelector('[data-sc-perm-factory]')) return;
      const cells=$$('td',tr); if(cells.length<2) return;
      const factory=state.factories.find(f=> text.includes(factoryName(f)) || text.includes(factoryId(f)));
      if(factory && cells[cells.length-1]){
        const b=document.createElement('button'); b.className='btn secondary sc-perm-open-btn'; b.type='button'; b.textContent='Sidor';
        b.dataset.scPermFactory=factoryId(factory); b.addEventListener('click',e=>{e.stopPropagation();openPermissions(factoryId(factory));});
        cells[cells.length-1].appendChild(document.createTextNode(' ')); cells[cells.length-1].appendChild(b);
      }
      const usr=state.users.find(u=> text.includes(userLabel(u)) || text.includes(userId(u)));
      if(usr && cells[cells.length-1]){
        const b=document.createElement('button'); b.className='btn secondary sc-perm-open-btn'; b.type='button'; b.textContent='Sidor';
        b.dataset.scPermUser=userId(usr); b.addEventListener('click',e=>{e.stopPropagation();openPermissions(userFactoryId(usr),userId(usr));});
        cells[cells.length-1].appendChild(document.createTextNode(' ')); cells[cells.length-1].appendChild(b);
      }
    });
  }

  function modeForPage(key,perms){
    const um=perms?.user?.[key];
    if(um && um!=='inherit') return um;
    return perms?.factory?.[key] || 'visible';
  }

  async function getCurrentPermissions(){
    const f=currentFactoryId(); const u=currentUserId();
    if(!f) return null;
    try{return await rpc('btg_get_effective_page_permissions',{p_factory_id:String(f),p_user_id:u?String(u):null});}
    catch(err){console.warn('Kunde inte läsa aktiva sidbehörigheter',err);return null;}
  }

  function btnMatchesPage(btn,page){
    const txt=String(btn.textContent||btn.title||btn.getAttribute('data-tab')||btn.id||'').toLowerCase();
    if(page.key==='dashboard' && /dashboard|översikt|hem/.test(txt)) return true;
    return page.match.some(m=>txt.includes(String(m).toLowerCase()));
  }

  async function applyCurrentPermissions(){
    const perms=await getCurrentPermissions();
    if(!perms) return;
    const buttons=$$('.tab-btn,button[data-tab],.main-nav button,nav button').filter(b=>b.id!=='btnSystemCenter');
    buttons.forEach(btn=>{
      btn.style.display='';
      btn.classList.remove('sc-page-locked');
      btn.disabled=false;
      const p=PAGE_DEFS.find(pg=>btnMatchesPage(btn,pg));
      if(!p) return;
      const m=modeForPage(p.key,perms);
      if(m==='hidden') btn.style.display='none';
      if(m==='locked'){
        btn.classList.add('sc-page-locked');
        btn.addEventListener('click',lockedClick,true);
      } else {
        btn.removeEventListener('click',lockedClick,true);
      }
    });
  }
  function lockedClick(e){
    e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation();
    alert('Den här sidan är låst för din fabrik eller användare.');
    return false;
  }

  function init(){
    document.addEventListener('click',e=>{ if(e.target?.closest?.('#btnSystemCenter')) setTimeout(injectSystemcenterButtons,450); },true);
    const obs=new MutationObserver(()=>{ if($('#systemCenterRoot')) injectSystemcenterButtons(); });
    obs.observe(document.body,{childList:true,subtree:true});
    [600,1600,3000].forEach(ms=>setTimeout(()=>{injectSystemcenterButtons();applyCurrentPermissions();},ms));
    try{window.sb?.auth?.onAuthStateChange?.(()=>setTimeout(applyCurrentPermissions,800));}catch(_){}
  }
  window.BTG_PAGE_PERMISSIONS={open:openPermissions,apply:applyCurrentPermissions,state,PAGE_DEFS};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
