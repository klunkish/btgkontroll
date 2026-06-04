/* BTG QC v19.5.33 – Systemcenter / Owner Console */
(function(){
  'use strict';
  const TAB='system_center';
  const SUPERADMIN_EMAILS=['j.ottosson53@gmail.com'];
  const state={loading:false,tab:'overview',overview:null,factories:[],users:[],usage:[],logs:[],filter:'',accessChecked:false,accessChecking:false,canAccess:null,authEmail:''};
  const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const num=v=>Number(v||0)||0; const fmtN=v=>new Intl.NumberFormat('sv-SE').format(num(v));
  const fmtDate=v=>{ if(!v) return '—'; try{return new Date(v).toLocaleString('sv-SE',{dateStyle:'short',timeStyle:'short'});}catch{return String(v)} };
  const db=()=>window.sb||window.supabaseClient||null; const user=()=>window.CURRENT_USER||null;
  function email(){return String(user()?.email||state.authEmail||'').toLowerCase();}
  function role(){return String(window.BTG_ACCESS_STATE?.profile?.role_code||window.BTG_ACCESS_STATE?.profile?.role||window.BTG_ROLE_STATE?.role||window.BTG_ACTIVE_ROLE||'').toUpperCase();}
  function isSuperadmin(){
    const e=email();
    return state.canAccess===true || SUPERADMIN_EMAILS.includes(e) || role()==='SUPERADMIN' || document.body.classList.contains('btg-v195-superadmin') || !!window.BTG_FACTORY_ADMIN_STATE?.isSuperadmin;
  }
  async function refreshAccess(){
    if(state.accessChecking) return;
    const s=db();
    if(!s || !s.auth) return;
    state.accessChecking=true;
    try{
      const gu=await s.auth.getUser();
      const u=gu?.data?.user;
      if(u?.email) state.authEmail=String(u.email).toLowerCase();
      try{
        const r=await s.rpc('btg_systemcenter_is_superadmin');
        if(!r.error) state.canAccess=!!r.data;
      }catch(_){}
      state.accessChecked=true;
    }catch(_){}
    state.accessChecking=false;
    ensureUI();
  }
  function activeFactory(){const st=window.BTG_FACTORY_ADMIN_STATE||{}; const id=st.selectedFactoryId||window.BTG_ACCESS_STATE?.profile?.factory_id||window.BTG_ACCESS_STATE?.factory?.id; return (st.factories||[]).find(f=>String(f.factory_id)===String(id))||window.BTG_ACCESS_STATE?.factory||null;}
  async function rpc(name,args){const s=db(); if(!s) throw new Error('Supabase saknas.'); const {data,error}=await s.rpc(name,args||{}); if(error) throw error; return data;}
  async function safeRpc(name,args,fb){try{return await rpc(name,args)}catch(e){console.warn('Systemcenter RPC misslyckades',name,e); toast(e.message||String(e),'warn'); return fb;}}
  function toast(msg,type){let el=$('#scToast'); if(!el){el=document.createElement('div');el.id='scToast';el.style.cssText='position:fixed;right:16px;bottom:16px;z-index:10000;max-width:420px;border-radius:14px;padding:.8rem 1rem;box-shadow:0 16px 50px rgba(0,0,0,.2);font-weight:800';document.body.appendChild(el);} el.textContent=msg; el.style.background=type==='warn'?'#fffbeb':'#ecfeff'; el.style.color=type==='warn'?'#92400e':'#155e75'; setTimeout(()=>{try{el.remove()}catch{}},4200);}
  function ensureUI(){
    // Skapa alltid knappen stabilt utan data-tab. data-tab triggar appens gamla flikskydd
    // och kan göra att menyn blinkar eller att Systemcenter rensas bort.
    const nav=$('header .main-nav')||$('.main-nav')||$('nav.toolbar');
    if(nav&&!$('#btnSystemCenter')){
      const btn=document.createElement('button');
      btn.id='btnSystemCenter';
      btn.type='button';
      btn.className='tab-btn secondary system-center-nav-btn';
      btn.textContent='🧭 Systemcenter';
      btn.title='Systemcenter för superadmin';
      btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openTab();});
      const before=$('#btnSettings');
      if(before&&before.parentElement===nav) nav.insertBefore(btn,before.nextSibling); else nav.appendChild(btn);
    }
    const staticBtn=$('#btnSystemCenter');
    if(staticBtn && !staticBtn.__btgScBound){
      staticBtn.__btgScBound=true;
      staticBtn.removeAttribute('data-tab');
      staticBtn.removeAttribute('data-nav');
      staticBtn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openTab();},true);
    }
    const main=$('main.container')||$('main')||document.body;
    if(!$('#tab-'+TAB)){
      const sec=document.createElement('section');
      sec.id='tab-'+TAB;
      sec.className='tab-content';
      sec.style.display='none';
      sec.innerHTML='<div class="system-center-page" id="systemCenterRoot"></div>';
      main.appendChild(sec);
    }
    if(isSuperadmin()) render();
  }
  function hideOtherAppViews(){
    const main=$('main.container')||$('main')||document.body;
    Array.from(main.children||[]).forEach(el=>{
      if(el.id && el.id.startsWith('tab-') && el.id!=='tab-'+TAB){
        el.style.display='none';
        el.classList.remove('active');
        el.setAttribute('aria-hidden','true');
      }
    });
    $$('.tab-content').forEach(x=>{
      if(x.id!=='tab-'+TAB){
        x.style.display='none';
        x.classList.remove('active');
        x.setAttribute('aria-hidden','true');
      }
    });
  }
  function closeSystemCenterView(){
    const sec=$('#tab-'+TAB);
    if(sec){sec.style.display='none';sec.classList.remove('active');sec.setAttribute('aria-hidden','true');}
    const btn=$('#btnSystemCenter');
    if(btn){btn.classList.remove('active');btn.setAttribute('aria-current','false');}
  }
  async function openTab(){
    ensureUI();
    const sec=$('#tab-'+TAB);
    const root=$('#systemCenterRoot');
    hideOtherAppViews();
    $$('.tab-btn').forEach(x=>{x.classList.remove('active'); x.setAttribute('aria-current','false');});
    if(sec){sec.style.display='block';sec.classList.add('active');sec.removeAttribute('aria-hidden');}
    const btn=$('#btnSystemCenter');
    if(btn){btn.classList.add('active'); btn.setAttribute('aria-current','page');}
    try{window.scrollTo({top:0,behavior:'smooth'});}catch(_){window.scrollTo(0,0);}
    if(root) root.innerHTML='<div class="sc-card"><h3>Systemcenter</h3><p class="sc-muted">Kontrollerar superadmin-behörighet…</p></div>';
    try{ await refreshAccess(); }catch(_){ }
    if(!isSuperadmin()){
      if(root) root.innerHTML='<div class="sc-danger"><b>Systemcenter är endast tillgängligt för superadmin.</b><br>Om du är superadmin: kontrollera att SQL-funktionen <code>btg_systemcenter_is_superadmin()</code> finns och att din e-post/roll är registrerad som SUPERADMIN.</div>';
      return;
    }
    render();
    loadAll();
  }
  function setScTab(t){state.tab=t; render(); if(t==='logs'&&!state.logs.length) loadLogs();}
  function render(){const root=$('#systemCenterRoot'); if(!root) return; if(!isSuperadmin()){root.innerHTML='<div class="sc-danger"><b>Systemcenter är endast tillgängligt för superadmin.</b></div>';return;} const ov=state.overview||{}; root.innerHTML=`
    <div class="system-center-hero"><div><div class="system-center-badge">🧭 Systemägare</div><h2>Systemcenter</h2><p>Central översikt för fabriker, användare, användning och tillfälliga låsningar. Byggt som separat modul så det senare kan lyftas ut till egen adminapp.</p></div><div class="sc-actions"><button class="btn" id="scRefreshBtn">Uppdatera</button><button class="btn secondary" id="scCreateFactoryBtn">Lägg till fabrik</button></div></div>
    <div class="sc-tabs">${['overview:Översikt','factories:Fabriker','users:Användare','usage:Användning','logs:Systemlogg'].map(x=>{const [id,l]=x.split(':');return `<button class="sc-tab ${state.tab===id?'active':''}" data-sc-tab="${id}">${l}</button>`}).join('')}</div>
    <div class="sc-panel ${state.tab==='overview'?'active':''}">${renderOverview(ov)}</div>
    <div class="sc-panel ${state.tab==='factories'?'active':''}">${renderFactories()}</div>
    <div class="sc-panel ${state.tab==='users'?'active':''}">${renderUsers()}</div>
    <div class="sc-panel ${state.tab==='usage'?'active':''}">${renderUsage()}</div>
    <div class="sc-panel ${state.tab==='logs'?'active':''}">${renderLogs()}</div>`;
    $$('.sc-tab',root).forEach(b=>b.addEventListener('click',()=>setScTab(b.dataset.scTab)));
    $('#scRefreshBtn')?.addEventListener('click',loadAll); $('#scCreateFactoryBtn')?.addEventListener('click',openCreateFactoryDialog);
    bindTables();
  }
  function renderOverview(ov){return `<div class="sc-grid">
    ${card('Fabriker totalt',ov.factories_total,'Aktiva, låsta och arkiverade')}${card('Aktiva fabriker',ov.factories_active,'Kan användas normalt')}${card('Låsta fabriker',ov.factories_locked,'Tillfälligt stoppade')}${card('Användare',ov.users_total,'Anslutna profiler')}
    ${card('Satser 30 dagar',ov.batches_30d,'Registrerad produktion')}${card('Provkuber 30 dagar',ov.cubes_30d,'Provningsunderlag')}${card('Avformningar 30 dagar',ov.demoulding_30d,'Tidiga hållfastheter')}${card('Silo-transaktioner 30 dagar',ov.silo_tx_30d,'Cementlager')}
  </div><div class="sc-card"><h3>Snabböversikt</h3><p class="sc-muted">Använd flikarna för att skapa, låsa, låsa upp och följa upp fabriker. Alla viktiga åtgärder loggas i Systemlogg.</p>${state.loading?'<p>Laddar…</p>':''}</div>`}
  function card(label,value,hint){return `<div class="sc-card"><div class="label">${esc(label)}</div><div class="value">${fmtN(value)}</div><div class="hint">${esc(hint)}</div></div>`}
  function filterRows(rows,fields){const f=state.filter.toLowerCase(); if(!f)return rows; return rows.filter(r=>fields.some(k=>String(r[k]??'').toLowerCase().includes(f)));}
  function renderFactories(){const rows=filterRows(state.factories,['factory_name','status','plan','contact_email']); return `<div class="sc-toolbar"><div class="left"><input class="sc-search" id="scSearch" placeholder="Sök fabrik…" value="${esc(state.filter)}"></div><div class="right"><button class="btn secondary" id="scReloadFactories">Ladda fabriker</button></div></div><div class="sc-table-wrap"><table class="sc-table"><thead><tr><th>Fabrik</th><th>Status</th><th>Användare</th><th>Användning 30d</th><th>Plan</th><th>Senaste aktivitet</th><th>Åtgärder</th></tr></thead><tbody>${rows.map(f=>`<tr><td><b>${esc(f.factory_name)}</b><br><small class="sc-muted">${esc(f.factory_id)}</small></td><td>${status(f.status)}${f.locked_reason?`<br><small>${esc(f.locked_reason)}</small>`:''}</td><td>${fmtN(f.users_count)}</td><td>Satser ${fmtN(f.batches_30d)}<br>Prov ${fmtN(f.cubes_30d)}<br>Avform. ${fmtN(f.demoulding_30d)}</td><td>${esc(f.plan||'—')}<br><small>Max användare: ${esc(f.max_users||'—')}</small></td><td>${fmtDate(f.last_activity_at)}</td><td><div class="sc-actions"><button class="btn secondary" data-sc-edit="${esc(f.factory_id)}">Redigera</button>${String(f.status||'active')==='locked'?`<button class="btn" data-sc-unlock="${esc(f.factory_id)}">Lås upp</button>`:`<button class="btn danger" data-sc-lock="${esc(f.factory_id)}">Lås</button>`}<button class="btn secondary" data-sc-select="${esc(f.factory_id)}">Välj</button></div></td></tr>`).join('')||'<tr><td colspan="7">Inga fabriker hittades.</td></tr>'}</tbody></table></div>`}
  function status(s){s=String(s||'active').toLowerCase(); return `<span class="sc-status ${esc(s)}">${esc({active:'Aktiv',locked:'Låst',paused:'Pausad',archived:'Arkiverad',demo:'Demo'}[s]||s)}</span>`}
  function renderUsers(){const rows=filterRows(state.users,['email','factory_name','role_code']); return `<div class="sc-toolbar"><input class="sc-search" id="scSearch" placeholder="Sök användare…" value="${esc(state.filter)}"><button class="btn secondary" id="scReloadUsers">Ladda användare</button></div><div class="sc-table-wrap"><table class="sc-table"><thead><tr><th>Användare</th><th>Fabrik</th><th>Roll</th><th>Aktiverad</th><th>Uppdaterad</th></tr></thead><tbody>${rows.map(u=>`<tr><td><b>${esc(u.email||u.user_id)}</b><br><small class="sc-muted">${esc(u.user_id)}</small></td><td>${esc(u.factory_name||'—')}</td><td><b>${esc(u.role_code||'—')}</b></td><td>${fmtDate(u.activated_at||u.created_at)}</td><td>${fmtDate(u.updated_at)}</td></tr>`).join('')||'<tr><td colspan="5">Inga användare hittades.</td></tr>'}</tbody></table></div>`}
  function renderUsage(){const rows=filterRows(state.usage,['factory_name','status']); return `<div class="sc-toolbar"><div class="left"><input class="sc-search" id="scSearch" placeholder="Sök fabrik…" value="${esc(state.filter)}"><button class="btn secondary" id="scReloadUsage">Ladda användning</button></div></div><div class="sc-table-wrap"><table class="sc-table"><thead><tr><th>Fabrik</th><th>Status</th><th>Användare</th><th>Satser</th><th>Provkuber</th><th>Avformning</th><th>Cement</th><th>Trend</th></tr></thead><tbody>${rows.map(r=>{const max=Math.max(num(r.batches_30d),num(r.cubes_30d),num(r.demoulding_30d),num(r.silo_tx_30d),1); return `<tr><td><b>${esc(r.factory_name)}</b></td><td>${status(r.status)}</td><td>${fmtN(r.users_count)}</td><td>${fmtN(r.batches_30d)}</td><td>${fmtN(r.cubes_30d)}</td><td>${fmtN(r.demoulding_30d)}</td><td>${fmtN(r.silo_tx_30d)}</td><td><div class="sc-mini-bars">${[r.batches_30d,r.cubes_30d,r.demoulding_30d,r.silo_tx_30d].map(v=>`<span style="height:${Math.max(4,Math.round(num(v)/max*52))}px"></span>`).join('')}</div></td></tr>`}).join('')||'<tr><td colspan="8">Ingen användningsdata hittades.</td></tr>'}</tbody></table></div>`}
  function renderLogs(){return `<div class="sc-toolbar"><button class="btn secondary" id="scReloadLogs">Ladda logg</button></div><div class="sc-card">${state.logs.map(l=>`<div class="sc-log-item"><div><b>${fmtDate(l.created_at)}</b><br><small>${esc(l.actor_email||l.actor_user_id||'—')}</small></div><div><div class="sc-log-action">${esc(l.action)}</div><div>${esc(l.note||'')}</div><small class="sc-muted">${esc(l.target_type||'')} ${esc(l.target_id||'')}</small></div></div>`).join('')||'<p class="sc-muted">Ingen logg laddad ännu.</p>'}</div>`}
  function bindTables(){const root=$('#systemCenterRoot'); $('#scSearch')?.addEventListener('input',e=>{state.filter=e.target.value; render();}); $('#scReloadFactories')?.addEventListener('click',loadFactories); $('#scReloadUsers')?.addEventListener('click',loadUsers); $('#scReloadUsage')?.addEventListener('click',loadUsage); $('#scReloadLogs')?.addEventListener('click',loadLogs); $$('[data-sc-lock]',root).forEach(b=>b.addEventListener('click',()=>openLockDialog(b.dataset.scLock))); $$('[data-sc-unlock]',root).forEach(b=>b.addEventListener('click',()=>updateFactoryStatus(b.dataset.scUnlock,'active'))); $$('[data-sc-edit]',root).forEach(b=>b.addEventListener('click',()=>openEditFactoryDialog(b.dataset.scEdit))); $$('[data-sc-select]',root).forEach(b=>b.addEventListener('click',()=>selectFactory(b.dataset.scSelect)));}
  async function loadAll(){if(!isSuperadmin())return; state.loading=true; render(); await Promise.all([loadOverview(false),loadFactories(false),loadUsers(false),loadUsage(false)]); state.loading=false; render();}
  async function loadOverview(r=true){state.overview=await safeRpc('btg_systemcenter_overview',{},{}); if(r)render();}
  async function loadFactories(r=true){state.factories=await safeRpc('btg_systemcenter_list_factories',{},[]); if(r)render();}
  async function loadUsers(r=true){state.users=await safeRpc('btg_systemcenter_list_users',{},[]); if(r)render();}
  async function loadUsage(r=true){state.usage=await safeRpc('btg_systemcenter_factory_usage',{p_days:30},[]); if(r)render();}
  async function loadLogs(){state.logs=await safeRpc('btg_systemcenter_logs',{p_limit:80},[]); render();}
  function getFactory(id){return state.factories.find(f=>String(f.factory_id)===String(id))||{};}
  function dialog(id,title,body){let d=$('#'+id); if(!d){d=document.createElement('dialog');d.id=id;document.body.appendChild(d);} d.innerHTML=`<form method="dialog"><div style="display:flex;justify-content:space-between;gap:1rem;align-items:center"><h3>${esc(title)}</h3><button class="btn secondary" value="cancel">Stäng</button></div></form>${body}`; try{d.showModal()}catch{d.setAttribute('open','open')} return d;}
  function openCreateFactoryDialog(){dialog('scFactoryDialog','Lägg till fabrik',formHtml({})); $('#scSaveFactory')?.addEventListener('click',()=>saveFactory(null));}
  function openEditFactoryDialog(id){const f=getFactory(id); dialog('scFactoryDialog','Redigera fabrik',formHtml(f)); $('#scSaveFactory')?.addEventListener('click',()=>saveFactory(id));}
  function formHtml(f){return `<div class="sc-form-grid"><label>Fabriksnamn<input id="scFactoryName" value="${esc(f.factory_name||'')}"></label><label>Plan<select id="scFactoryPlan"><option></option>${['Demo','Basic','Standard','Pro','Enterprise','Intern'].map(p=>`<option ${String(f.plan||'')===p?'selected':''}>${p}</option>`).join('')}</select></label><label>Status<select id="scFactoryStatus">${['active','locked','paused','archived','demo'].map(s=>`<option value="${s}" ${String(f.status||'active')===s?'selected':''}>${s}</option>`).join('')}</select></label><label>Max användare<input id="scFactoryMaxUsers" type="number" min="0" value="${esc(f.max_users||'')}"></label><label>Kontakt e-post<input id="scFactoryContactEmail" value="${esc(f.contact_email||'')}"></label><label>Låst till<input id="scFactoryLockedUntil" type="datetime-local"></label><label style="grid-column:1/-1">Meddelande till användare<textarea id="scFactoryPublicMessage">${esc(f.public_message||'')}</textarea></label><label style="grid-column:1/-1">Intern notering<textarea id="scFactoryInternalNote">${esc(f.internal_note||'')}</textarea></label></div><div class="sc-toolbar"><button class="btn" type="button" id="scSaveFactory">Spara</button></div><div id="scFactoryMsg"></div>`}
  async function saveFactory(id){const payload={p_factory_id:id||null,p_name:$('#scFactoryName')?.value||'',p_status:$('#scFactoryStatus')?.value||'active',p_plan:$('#scFactoryPlan')?.value||null,p_max_users:Number($('#scFactoryMaxUsers')?.value||0)||null,p_contact_email:$('#scFactoryContactEmail')?.value||null,p_locked_until:$('#scFactoryLockedUntil')?.value?new Date($('#scFactoryLockedUntil').value).toISOString():null,p_public_message:$('#scFactoryPublicMessage')?.value||null,p_internal_note:$('#scFactoryInternalNote')?.value||null}; try{await rpc('btg_systemcenter_save_factory',payload); toast('Fabrik sparad.'); await loadAll(); $('#scFactoryDialog')?.close();}catch(e){$('#scFactoryMsg').innerHTML='<div class="sc-danger">'+esc(e.message||String(e))+'</div>';}}
  function openLockDialog(id){const f=getFactory(id); const body=`<div class="sc-warning"><b>Du låser:</b> ${esc(f.factory_name||id)}. Vanliga användare stoppas från fabriken tills den låses upp.</div><div class="sc-form-grid"><label>Orsak<textarea id="scLockReason">${esc(f.locked_reason||'')}</textarea></label><label>Synligt meddelande<textarea id="scLockMsg">${esc(f.public_message||'Denna fabrik är tillfälligt låst. Kontakta systemadministratören.')}</textarea></label></div><div class="sc-toolbar"><button class="btn danger" id="scConfirmLock">Lås fabrik</button></div>`; dialog('scLockDialog','Lås fabrik tillfälligt',body); $('#scConfirmLock')?.addEventListener('click',()=>updateFactoryStatus(id,'locked',$('#scLockReason')?.value,$('#scLockMsg')?.value));}
  async function updateFactoryStatus(id,status,reason,msg){try{await rpc('btg_systemcenter_update_factory_status',{p_factory_id:id,p_status:status,p_reason:reason||null,p_public_message:msg||null}); toast(status==='active'?'Fabrik upplåst.':'Fabrik låst.'); await loadAll(); try{$('#scLockDialog')?.close()}catch{}}catch(e){toast(e.message||String(e),'warn');}}
  function selectFactory(id){try{localStorage.setItem('btg_selected_factory_id',id)}catch{} if(window.BTG_FACTORY_ADMIN_STATE) window.BTG_FACTORY_ADMIN_STATE.selectedFactoryId=id; const sel=$('#btgFactorySelector'); if(sel){sel.value=id; sel.dispatchEvent(new Event('change',{bubbles:true}));} toast('Fabrik vald i appen.');}
  async function enforceFactoryLock(){const f=activeFactory(); if(!f||isSuperadmin()) return; let info=f; try{const res=await rpc('btg_systemcenter_my_factory_status',{p_factory_id:f.factory_id||f.id}); if(res) info=Array.isArray(res)?res[0]:res;}catch(_){} const status=String(info.status||info.active_status||'active').toLowerCase(); if(!['locked','paused','archived'].includes(status)) return; if($('#scLockOverlay')) return; const msg=info.public_message||'Denna fabrik är tillfälligt låst. Kontakta systemadministratören.'; const ov=document.createElement('div'); ov.id='scLockOverlay'; ov.className='sc-lock-overlay'; ov.innerHTML=`<div class="sc-lock-box"><h2>Fabriken är låst</h2><p>${esc(msg)}</p><p class="sc-muted">Status: ${esc(status)}</p><div class="sc-actions"><button class="btn" id="scLockLogout">Logga ut</button></div></div>`; document.body.appendChild(ov); $('#scLockLogout')?.addEventListener('click',()=>{try{window.sb?.auth?.signOut()}catch{} location.reload();});}
  function init(){
    ensureUI();
    refreshAccess();
    setTimeout(()=>{ensureUI(); enforceFactoryLock();},1200);
    try{ window.sb?.auth?.onAuthStateChange?.((event)=>{ if(event==='SIGNED_IN'||event==='SIGNED_OUT') setTimeout(()=>{refreshAccess(); ensureUI(); enforceFactoryLock();},700); }); }catch(_){ }
    document.addEventListener('click',e=>{
      const btn=e.target?.closest?.('#btnSystemCenter');
      if(btn){ e.preventDefault(); e.stopPropagation(); openTab(); return; }
      const normalTab=e.target?.closest?.('.tab-btn[data-tab]');
      if(normalTab && normalTab.id!=='btnSystemCenter'){
        closeSystemCenterView();
      }
    },true);
  }
  window.BTG_SYSTEM_CENTER={open:openTab,refresh:loadAll,state};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
