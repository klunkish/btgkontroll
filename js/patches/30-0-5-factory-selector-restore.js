(function(){
  if(window.__BTG_306_FACTORY_SELECTOR_VISIBLE) return;
  window.__BTG_306_FACTORY_SELECTOR_VISIBLE = true;
  window.__BTG_305_FACTORY_SELECTOR_RESTORE = true;

  const LS='btg_selected_factory_id';
  const SUPER_EMAIL='j.ottosson53@gmail.com';
  const state={factories:[], profiles:[], loaded:false, loading:false, lastUserId:''};

  function db(){ try{return window.sb || window.supabaseClient || sb || null;}catch(_){return window.sb||window.supabaseClient||null;} }
  function currentUser(){ return window.CURRENT_USER || window.BTG_CURRENT_USER || window.BTG_ACCESS_STATE?.user || null; }
  async function resolveUser(){
    let u=currentUser();
    if(u) return u;
    try{
      const client=db();
      const res=await client?.auth?.getUser?.();
      u=res?.data?.user||null;
      if(u){
        window.CURRENT_USER=u;
        window.BTG_CURRENT_USER=u;
      }
      return u;
    }catch(_){ return null; }
  }
  function isSuper(){
    const email=String(currentUser()?.email||'').toLowerCase();
    const role=String(window.BTG_ACCESS_STATE?.profile?.role_code||window.BTG_ACCESS_STATE?.role||'').toLowerCase();
    return email===SUPER_EMAIL || role.includes('superadmin') || role.includes('system_admin');
  }
  function esc(v){ return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function fidOf(f){ return String(f.id || f.factory_id || '').trim(); }
  function fname(f){ return f.name || f.factory_name || f.display_name || fidOf(f) || 'Fabrik'; }
  function selected(){ return String(localStorage.getItem(LS)||window.BTG_ACTIVE_FACTORY_ID||window.BTG_CURRENT_FACTORY_ID||window.BTG_ACCESS_STATE?.factory_id||'').trim(); }

  function setActiveFactory(fid, factory){
    fid=String(fid||'').trim();
    if(!fid) return;
    localStorage.setItem(LS,fid);
    window.BTG_ACTIVE_FACTORY_ID=fid;
    window.BTG_CURRENT_FACTORY_ID=fid;
    if(factory){
      window.BTG_ACTIVE_FACTORY_NAME=fname(factory);
      window.BTG_CURRENT_FACTORY_NAME=fname(factory);
    }
    if(window.BTG_ACCESS_STATE){
      window.BTG_ACCESS_STATE.factory_id=fid;
      window.BTG_ACCESS_STATE.factory=factory || window.BTG_ACCESS_STATE.factory || null;
    }
    document.querySelectorAll('#btgFactorySelector,#btgFactorySelectorFloating').forEach(sel=>{
      if(sel && sel.value!==fid) sel.value=fid;
    });
  }

  async function loadFactories(){
    const client=db();
    const user=await resolveUser();
    if(!client || !user) {
      renderSelector();
      return;
    }
    if(state.loading) return;
    state.loading=true;
    try{
      let factories=[], profiles=[];
      try{
        const {data,error}=await client.from('btg_user_access_profiles').select('*').eq('user_id',user.id);
        if(!error) profiles=Array.isArray(data)?data:[];
      }catch(err){ console.warn('Kunde inte läsa accessprofiler',err); }

      const superNow = isSuper() || String(user.email||'').toLowerCase()===SUPER_EMAIL;
      if(superNow){
        try{
          const {data,error}=await client.from('factories').select('*').order('name',{ascending:true});
          if(!error) factories=Array.isArray(data)?data:[];
        }catch(err){ console.warn('Kunde inte läsa fabriker',err); }
      }else{
        const ids=[...new Set(profiles.map(p=>String(p.factory_id||'').trim()).filter(Boolean))];
        if(ids.length){
          try{
            const {data,error}=await client.from('factories').select('*').in('id',ids).order('name',{ascending:true});
            if(!error) factories=Array.isArray(data)?data:[];
          }catch(err){ console.warn('Kunde inte läsa användarens fabriker',err); }
        }
      }

      if(!factories.length && profiles.length){
        factories=profiles.map(p=>({id:p.factory_id, factory_id:p.factory_id, name:p.factory_name || p.factory_id})).filter(f=>fidOf(f));
      }

      state.factories=factories;
      state.profiles=profiles;
      state.loaded=true;
      state.lastUserId=user.id;

      const saved=selected();
      const first=factories[0] ? fidOf(factories[0]) : '';
      const allowedIds=new Set(factories.map(fidOf));
      const use=saved && (superNow || allowedIds.has(saved)) ? saved : first;
      if(use){
        const f=factories.find(x=>fidOf(x)===use) || null;
        setActiveFactory(use,f);
      }
      renderSelector();
    }finally{
      state.loading=false;
    }
  }

  function ensureSelector(){
    let wrap=document.getElementById('btgFactorySelectorWrap');
    if(!wrap){
      wrap=document.createElement('div');
      wrap.id='btgFactorySelectorWrap';
      wrap.className='btg-factory-selector-wrap btg-factory-selector-floating';
      wrap.innerHTML=`<label for="btgFactorySelectorFloating">Aktiv fabrik</label><select id="btgFactorySelectorFloating"><option value="">Laddar fabriker…</option></select>`;
      document.body.appendChild(wrap);
    }

    const sel=wrap.querySelector('#btgFactorySelectorFloating');
    if(sel && !sel.__btg306Bound){
      sel.__btg306Bound=true;
      sel.addEventListener('change',()=>{
        const fid=sel.value;
        const f=state.factories.find(x=>fidOf(x)===fid) || null;
        setActiveFactory(fid,f);
        window.dispatchEvent(new CustomEvent('btg:factory-changed',{detail:{factory_id:fid,factory:f}}));
        document.dispatchEvent(new CustomEvent('btg:factory-changed',{detail:{factory_id:fid,factory:f}}));
        try{ window.btgLoadFactoryCoreData?.({force:true}); }catch(_){}
        try{ window.BTG_MENU_REGISTRY?.rebuild?.(); }catch(_){}
      });
    }
    return wrap;
  }

  function renderSelector(){
    const wrap=ensureSelector();
    const sel=wrap.querySelector('#btgFactorySelectorFloating');
    if(!sel) return;
    const user=currentUser();
    if(!user){
      wrap.style.display='none';
      return;
    }
    wrap.style.display='flex';
    if(!state.factories.length){
      sel.innerHTML='<option value="">Ingen fabrik kopplad</option>';
      return;
    }
    const cur=selected();
    sel.innerHTML=state.factories.map(f=>`<option value="${esc(fidOf(f))}">${esc(fname(f))}</option>`).join('');
    if(cur && state.factories.some(f=>fidOf(f)===cur)) sel.value=cur;
    else if(state.factories[0]) sel.value=fidOf(state.factories[0]);
  }

  async function boot(){
    ensureSelector();
    renderSelector();
    await loadFactories();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot);
  else boot();

  window.addEventListener('btg:access-ready',()=>setTimeout(boot,100));
  window.addEventListener('focus',()=>setTimeout(boot,100));
  try{
    db()?.auth?.onAuthStateChange?.((event)=>{
      if(event==='SIGNED_IN' || event==='SIGNED_OUT' || event==='INITIAL_SESSION' || event==='TOKEN_REFRESHED') setTimeout(boot,300);
    });
  }catch(_){}

  // Säkerhetsnät: om auth/state kommer sent ska väljaren ändå dyka upp.
  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    boot();
    if(tries>20 || (currentUser() && state.loaded)) clearInterval(timer);
  },1000);

  window.BTG_FACTORY_SELECTOR={boot,loadFactories,state,setActiveFactory};
})();