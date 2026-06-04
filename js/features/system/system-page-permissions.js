(function(){
  if(window.__BTG_SIMPLE_ACCOUNT_ACCESS_V2033) return;
  window.__BTG_SIMPLE_ACCOUNT_ACCESS_V2033 = true;

  const PAGES=[
    {key:'dashboard',label:'Dashboard'},
    {key:'production',label:'Tillverkningsdata'},
    {key:'prefab',label:'Prefabkö'},
    {key:'orders',label:'Beställningar'},
    {key:'cubes',label:'Provningar'},
    {key:'demoulding',label:'Avformningskuber'},
    {key:'evaluation',label:'Utvärdering'},
    {key:'control',label:'Kontroll'},
    {key:'materials',label:'Material'},
    {key:'recipes',label:'Recept'},
    {key:'temperature_tables',label:'Bord & Temperatur'},
    {key:'diary',label:'Dagbok'},
    {key:'cement_silos',label:'Material & Silor'},
    {key:'quality_trends',label:'Kvalitetstrender'},
    {key:'economy',label:'Ekonomi & Kalkyl'},
    {key:'documents',label:'Offert / Faktura'},
    {key:'environment',label:'Miljö'},
    {key:'reports',label:'Rapporter'},
    {key:'factory_admin',label:'Fabriksadmin'},
    {key:'system_center',label:'Systemcenter'}
  ];

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const db=()=>window.sb||window.supabaseClient||null;
  const currentUser=()=>window.CURRENT_USER||null;
  const state={accounts:[],factories:[],profiles:[],selectedUserId:'',selectedProfile:null,loading:false};

  function isSuperadmin(){
    const email=String(currentUser()?.email||window.BTG_SYSTEM_CENTER?.state?.authEmail||'').toLowerCase();
    const role=String(window.BTG_ACCESS_STATE?.profile?.role_code||window.BTG_ACCESS_STATE?.profile?.role||window.BTG_ACTIVE_ROLE||'').toLowerCase();
    return !!(email==='j.ottosson53@gmail.com' || role.includes('superadmin') || role.includes('system_admin') || window.BTG_SYSTEM_CENTER?.state?.canAccess);
  }

  async function rpc(name,args){
    const client=db();
    if(!client) throw new Error('Supabase-klient saknas');
    const {data,error}=await client.rpc(name,args||{});
    if(error) throw error;
    return data;
  }

  function userName(a){
    return a.email || a.name || a.full_name || a.user_id || 'Användare';
  }
  function factoryName(f){
    return f.name || f.factory_name || f.display_name || f.id || f.factory_id || 'Fabrik';
  }
  function factoryId(f){
    return String(f.id || f.factory_id || '');
  }

  async function loadMeta(){
    state.loading=true;
    try{
      const data=await rpc('btg_systemcenter_accounts_meta',{});
      state.accounts=Array.isArray(data?.accounts)?data.accounts:[];
      state.factories=Array.isArray(data?.factories)?data.factories:[];
      state.profiles=Array.isArray(data?.profiles)?data.profiles:[];
    }finally{
      state.loading=false;
    }
  }

  function accountProfile(userId){
    return state.profiles.find(p=>String(p.user_id)===String(userId)) || null;
  }

  function profileAllowedPages(profile){
    const perms=profile?.permissions||{};
    const allowed=perms.allowed_pages || perms.allowedPages || [];
    if(Array.isArray(allowed)) return allowed.map(String);
    if(allowed && typeof allowed==='object') return Object.keys(allowed).filter(k=>allowed[k]!==false);
    return [];
  }

  function ensureDialog(){
    let dlg=$('#scSimpleAccessDialog');
    if(dlg) return dlg;
    dlg=document.createElement('dialog');
    dlg.id='scSimpleAccessDialog';
    dlg.className='sc-simple-access-modal';
    dlg.innerHTML=`<div class="sc-simple-access-inner">
      <div class="sc-simple-access-head">
        <div>
          <h3>Användarkonton & behörigheter</h3>
          <p>Enklare flöde: klicka på ett konto, välj fabrik och kryssa vilka sidor användaren ska se.</p>
        </div>
        <button class="btn secondary" type="button" data-close>Stäng</button>
      </div>
      <div class="sc-simple-access-layout">
        <aside class="sc-simple-account-list">
          <div class="sc-simple-list-tools">
            <input id="scSimpleSearch" placeholder="Sök användare/e-post">
            <button class="btn secondary" id="scSimpleReload" type="button">Ladda om</button>
          </div>
          <div id="scSimpleAccounts"></div>
        </aside>
        <main class="sc-simple-editor">
          <div id="scSimpleEditorEmpty" class="sc-simple-empty">Välj ett konto i listan.</div>
          <div id="scSimpleEditor" hidden>
            <div class="sc-simple-selected">
              <div>
                <span>Valt konto</span>
                <h4 id="scSimpleSelectedName"></h4>
                <p id="scSimpleSelectedSub"></p>
              </div>
            </div>
            <div class="sc-simple-form-grid">
              <label>Fabrik
                <select id="scSimpleFactory"></select>
              </label>
              <label>Roll
                <select id="scSimpleRole">
                  <option value="viewer">viewer</option>
                  <option value="user">user</option>
                  <option value="factory_admin">factory_admin</option>
                  <option value="admin">admin</option>
                  <option value="system_admin">system_admin</option>
                  <option value="superadmin">superadmin</option>
                </select>
              </label>
            </div>
            <div class="sc-simple-actions">
              <button class="btn secondary" type="button" id="scSimpleAll">Välj alla sidor</button>
              <button class="btn secondary" type="button" id="scSimpleNone">Rensa sidor</button>
              <button class="btn" type="button" id="scSimpleSave">Spara konto</button>
            </div>
            <div id="scSimplePages" class="sc-simple-pages"></div>
          </div>
        </main>
      </div>
    </div>`;
    document.body.appendChild(dlg);

    dlg.addEventListener('click',e=>{ if(e.target.matches('[data-close]')) dlg.close(); });
    $('#scSimpleReload',dlg)?.addEventListener('click',async()=>{await refresh();});
    $('#scSimpleSearch',dlg)?.addEventListener('input',renderAccounts);
    $('#scSimpleAll',dlg)?.addEventListener('click',()=>{$$('#scSimplePages input[type=checkbox]').forEach(c=>c.checked=true);});
    $('#scSimpleNone',dlg)?.addEventListener('click',()=>{$$('#scSimplePages input[type=checkbox]').forEach(c=>c.checked=false);});
    $('#scSimpleSave',dlg)?.addEventListener('click',async()=>{try{await saveSelected();}catch(err){alert('Kunde inte spara: '+(err.message||err));}});

    return dlg;
  }

  function renderAccounts(){
    const box=$('#scSimpleAccounts');
    if(!box) return;
    const q=String($('#scSimpleSearch')?.value||'').toLowerCase().trim();
    const list=state.accounts.filter(a=>{
      const hay=[a.email,a.name,a.full_name,a.user_id].map(x=>String(x||'')).join(' ').toLowerCase();
      return !q || hay.includes(q);
    });
    box.innerHTML=list.map(a=>{
      const p=accountProfile(a.user_id);
      const active=String(state.selectedUserId)===String(a.user_id);
      const f=state.factories.find(x=>factoryId(x)===String(p?.factory_id));
      const pages=profileAllowedPages(p);
      return `<button class="sc-simple-account ${active?'active':''}" data-user-id="${esc(a.user_id)}">
        <b>${esc(userName(a))}</b>
        <span>${esc(p?.role_code||'ingen roll')} ${f?'• '+esc(factoryName(f)):'• ingen fabrik'}</span>
        <small>${pages.length ? pages.length+' sidor' : 'inga sidor valda'}</small>
      </button>`;
    }).join('') || '<div class="sc-simple-empty">Inga användare hittades. Användaren måste ha loggat in minst en gång.</div>';
    $$('[data-user-id]',box).forEach(btn=>btn.addEventListener('click',()=>selectUser(btn.dataset.userId)));
  }

  function selectUser(userId){
    state.selectedUserId=String(userId);
    const a=state.accounts.find(x=>String(x.user_id)===String(userId));
    const p=accountProfile(userId);
    $('#scSimpleEditorEmpty').hidden=true;
    $('#scSimpleEditor').hidden=false;
    $('#scSimpleSelectedName').textContent=userName(a||{user_id:userId});
    $('#scSimpleSelectedSub').textContent=a?.email || userId;

    const factorySelect=$('#scSimpleFactory');
    factorySelect.innerHTML='<option value="">Välj fabrik</option>'+state.factories.map(f=>`<option value="${esc(factoryId(f))}">${esc(factoryName(f))}</option>`).join('');
    factorySelect.value=String(p?.factory_id||'');

    $('#scSimpleRole').value=String(p?.role_code||'viewer');

    const allowed=new Set(profileAllowedPages(p));
    const pagesBox=$('#scSimplePages');
    pagesBox.innerHTML=PAGES.map(pg=>`<label class="sc-simple-page">
      <input type="checkbox" value="${esc(pg.key)}" ${allowed.has(pg.key)?'checked':''}>
      <span>${esc(pg.label)}</span>
      <small>${esc(pg.key)}</small>
    </label>`).join('');

    renderAccounts();
  }

  async function saveSelected(){
    const userId=state.selectedUserId;
    if(!userId) return alert('Välj användare först.');
    const factoryId=$('#scSimpleFactory')?.value||'';
    const role=$('#scSimpleRole')?.value||'viewer';
    if(!factoryId) return alert('Välj fabrik.');
    const allowed=$$('#scSimplePages input[type=checkbox]:checked').map(c=>c.value);
    if(!allowed.length) return alert('Välj minst en sida.');

    await rpc('btg_systemcenter_save_account_access',{
      p_user_id:userId,
      p_factory_id:factoryId,
      p_role_code:role,
      p_allowed_pages:allowed
    });

    await refresh(false);
    alert('Behörigheter sparade.');
    try{ await window.BTG_MENU_REGISTRY?.rebuild?.(); }catch(_){}
  }

  async function refresh(openFirst=true){
    await loadMeta();
    renderAccounts();
    if(state.selectedUserId && state.accounts.some(a=>String(a.user_id)===String(state.selectedUserId))){
      selectUser(state.selectedUserId);
    }else if(openFirst && state.accounts[0]){
      selectUser(state.accounts[0].user_id);
    }
  }

  async function openSimpleAccess(){
    if(!isSuperadmin()) return alert('Endast superadmin kan ändra användarbehörigheter.');
    const dlg=ensureDialog();
    await refresh(false);
    if(typeof dlg.showModal==='function') dlg.showModal(); else dlg.setAttribute('open','open');
  }

  function injectSystemcenterButtons(){
    const root=$('#systemCenterRoot');
    if(!root) return;
    const anchor=$('#scCreateFactoryBtn',root) || root.querySelector('button');
    if(anchor && !$('#scSimpleAccessBtn',root)){
      const b=document.createElement('button');
      b.id='scSimpleAccessBtn';
      b.className='btn secondary sc-simple-access-open-btn';
      b.type='button';
      b.textContent='Användarkonton';
      b.addEventListener('click',openSimpleAccess);
      anchor.parentElement?.insertBefore(b,anchor);
    }
  }

  function init(){
    document.addEventListener('click',e=>{
      if(e.target?.closest?.('#btnSystemCenter,#btgNav_system_center')) setTimeout(injectSystemcenterButtons,500);
    },true);
    const obs=new MutationObserver(()=>{ if($('#systemCenterRoot')) injectSystemcenterButtons(); });
    obs.observe(document.body,{childList:true,subtree:true});
    [600,1600,3000].forEach(ms=>setTimeout(injectSystemcenterButtons,ms));
  }

  window.BTG_SIMPLE_ACCOUNT_ACCESS={open:openSimpleAccess,refresh,state,PAGES};
  window.BTG_PAGE_PERMISSIONS={open:openSimpleAccess,state:{},PAGE_DEFS:PAGES,apply:()=>window.BTG_MENU_REGISTRY?.rebuild?.()};

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
