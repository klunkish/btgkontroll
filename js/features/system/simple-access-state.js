(function(){
  if(window.__BTG_SIMPLE_ACCESS_STATE_V304) return;
  window.__BTG_SIMPLE_ACCESS_STATE_V304 = true;
  window.__BTG_SIMPLE_ACCESS_STATE_V303 = true;
  window.__BTG_SIMPLE_ACCESS_STATE_V300 = true;

  let loadingPromise=null;
  let lastSignature='';
  let lastLoadAt=0;

  function db(){ try{return window.sb || window.supabaseClient || sb || null;}catch(_){return window.sb||window.supabaseClient||null;} }
  function savedFactoryId(){ return String(localStorage.getItem('btg_selected_factory_id') || window.BTG_ACTIVE_FACTORY_ID || window.BTG_CURRENT_FACTORY_ID || '').trim(); }
  function setFactoryGlobals(fid,factory){
    fid=String(fid||'').trim();
    window.BTG_ACTIVE_FACTORY_ID=fid;
    window.BTG_CURRENT_FACTORY_ID=fid;
    window.BTG_ACTIVE_FACTORY_NAME=factory?.name || factory?.factory_name || window.BTG_ACTIVE_FACTORY_NAME || '';
    window.BTG_CURRENT_FACTORY_NAME=window.BTG_ACTIVE_FACTORY_NAME;
    if(fid) localStorage.setItem('btg_selected_factory_id',fid);
    const sel=document.getElementById('btgFactorySelector');
    if(sel && fid && sel.value!==fid) sel.value=fid;
  }
  function mapAllowedPages(raw){
    const map={
      dashboard:'dashboard',
      production:'tillverkning',
      orders:'bestallningar',
      cubes:'provningar',
      evaluation:'utvardering',
      control:'kontroll',
      materials:'material',
      diary:'dagbok',
      prefab:'prefab',
      demoulding:'avformningskuber',
      temperature_tables:'temperature_tables',
      environment:'environment',
      cement_silos:'cement_silos',
      quality_trends:'quality_trends',
      economy:'economy',
      documents:'documents',
      reports:'reports',
      recipes:'recipes',
      factory_admin:'factory_admin',
      system_center:'system_center'
    };
    const out={};
    if(Array.isArray(raw)){
      raw.forEach(k=>{ out[k]=true; if(map[k]) out[map[k]]=true; });
    }
    return out;
  }
  function signatureOf(st){
    try{
      return JSON.stringify({
        uid:st?.user_id||'',
        fid:st?.factory_id||'',
        role:st?.role||'',
        pages:st?.profile?.permissions?.allowed_pages||st?.profile?.permissions?.allowedPages||[]
      });
    }catch(_){ return String(Date.now()); }
  }
  function emitIfChanged(st,force){
    const sig=signatureOf(st);
    if(force || sig!==lastSignature){
      lastSignature=sig;
      document.dispatchEvent(new CustomEvent('btg:access-ready',{detail:st}));
      window.dispatchEvent(new CustomEvent('btg:access-ready',{detail:st}));
    }
  }
  async function fetchFactory(client,fid){
    if(!fid) return null;
    try{
      const {data}=await client.from('factories').select('*').eq('id',fid).maybeSingle();
      return data || null;
    }catch(_){ return null; }
  }
  async function loadSimpleAccessState(opts={}){
    const force=!!opts.force;
    const now=Date.now();
    if(!force && loadingPromise) return loadingPromise;
    if(!force && window.BTG_ACCESS_STATE?.loaded && (now-lastLoadAt)<5000) return window.BTG_ACCESS_STATE;

    loadingPromise=(async()=>{
      const client=db();
      if(!client?.auth){
        window.BTG_ACCESS_STATE={loaded:false,profile:null,permissions:{},factory:null};
        loadingPromise=null;
        return window.BTG_ACCESS_STATE;
      }
      const gu=await client.auth.getUser();
      const user=gu?.data?.user || null;
      window.CURRENT_USER = user || window.CURRENT_USER || null;
      window.BTG_CURRENT_USER = user || window.BTG_CURRENT_USER || null;
      if(!user){
        window.BTG_ACCESS_STATE={loaded:true,user:null,profile:null,permissions:{},factory:null};
        lastLoadAt=Date.now();
        emitIfChanged(window.BTG_ACCESS_STATE,force);
        loadingPromise=null;
        return window.BTG_ACCESS_STATE;
      }

      let profiles=[], profile=null, factory=null;
      try{
        const {data,error}=await client
          .from('btg_user_access_profiles')
          .select('*')
          .eq('user_id',user.id)
          .order('activated_at',{ascending:false});
        if(error) throw error;
        profiles=Array.isArray(data)?data:[];
      }catch(err){
        console.warn('Simple access: kunde inte läsa profil', err);
      }

      const selected=savedFactoryId();
      profile = profiles.find(p=>String(p.factory_id||'')===selected) || profiles[0] || null;

      // Superadmin/admin kan ha anledning att stå kvar på en vald fabrik även om profilen pekar på en annan.
      const roleText=String(profile?.role_code||profile?.role||'').toLowerCase();
      const isSuper=roleText.includes('super') || roleText.includes('system_admin') || String(user.email||'').toLowerCase()==='j.ottosson53@gmail.com';
      const effectiveFactoryId = (selected && (isSuper || profiles.some(p=>String(p.factory_id||'')===selected))) ? selected : String(profile?.factory_id||'');

      factory = await fetchFactory(client,effectiveFactoryId) || await fetchFactory(client,profile?.factory_id) || null;

      const permissions=mapAllowedPages(profile?.permissions?.allowed_pages || profile?.permissions?.allowedPages || []);
      if(isSuper) permissions.system_center=true;

      window.CURRENT_PROFILE=profile;
      setFactoryGlobals(effectiveFactoryId || profile?.factory_id || factory?.id || '', factory);

      window.BTG_ACCESS_STATE={
        loaded:true,
        user,
        user_id:user.id,
        profile,
        profiles,
        factory,
        factory_id:window.BTG_ACTIVE_FACTORY_ID || '',
        role:profile?.role_code || '',
        permissions
      };
      lastLoadAt=Date.now();
      emitIfChanged(window.BTG_ACCESS_STATE,force);
      loadingPromise=null;
      return window.BTG_ACCESS_STATE;
    })();

    return loadingPromise;
  }

  window.loadAccessState=loadSimpleAccessState;
  window.BTG_SIMPLE_ACCESS_STATE={load:loadSimpleAccessState};

  document.addEventListener('change',e=>{
    if(e.target?.id==='btgFactorySelector'){
      const fid=String(e.target.value||'').trim();
      if(fid){
        setFactoryGlobals(fid,null);
        if(window.BTG_ACCESS_STATE) window.BTG_ACCESS_STATE.factory_id=fid;
        window.dispatchEvent(new CustomEvent('btg:factory-changed',{detail:{factory_id:fid}}));
        document.dispatchEvent(new CustomEvent('btg:factory-changed',{detail:{factory_id:fid}}));
      }
    }
  },true);

  async function boot(force=false){ try{ await loadSimpleAccessState({force}); }catch(err){ console.warn('Simple access boot:',err); loadingPromise=null; } }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>boot(false)); else boot(false);
  try{ db()?.auth?.onAuthStateChange?.((event)=>{ if(event==='SIGNED_IN' || event==='SIGNED_OUT' || event==='TOKEN_REFRESHED') setTimeout(()=>boot(event!=='TOKEN_REFRESHED'),300); }); }catch(_){}
})();