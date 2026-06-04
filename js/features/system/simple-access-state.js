(function(){
  if(window.__BTG_SIMPLE_ACCESS_STATE_V303) return;
  window.__BTG_SIMPLE_ACCESS_STATE_V303 = true;
  window.__BTG_SIMPLE_ACCESS_STATE_V300 = true;

  let loadingPromise=null;
  let lastSignature='';
  let lastLoadAt=0;

  function db(){ try{return window.sb || window.supabaseClient || sb || null;}catch(_){return window.sb||window.supabaseClient||null;} }
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

      let profile=null, factory=null;
      try{
        const {data,error}=await client
          .from('btg_user_access_profiles')
          .select('*')
          .eq('user_id',user.id)
          .order('activated_at',{ascending:false})
          .limit(1)
          .maybeSingle();
        if(error) throw error;
        profile=data||null;
      }catch(err){
        console.warn('Simple access: kunde inte läsa profil', err);
      }
      try{
        if(profile?.factory_id){
          const {data}=await client.from('factories').select('*').eq('id',profile.factory_id).maybeSingle();
          factory=data||null;
        }
      }catch(err){ console.warn('Simple access: kunde inte läsa fabrik', err); }

      const permissions=mapAllowedPages(profile?.permissions?.allowed_pages || profile?.permissions?.allowedPages || []);
      if(String(profile?.role_code||'').toLowerCase().includes('super') || String(user.email||'').toLowerCase()==='j.ottosson53@gmail.com'){
        permissions.system_center=true;
      }

      window.CURRENT_PROFILE=profile;
      window.BTG_ACTIVE_FACTORY_ID=profile?.factory_id || factory?.id || '';
      window.BTG_ACTIVE_FACTORY_NAME=factory?.name || '';
      window.BTG_ACCESS_STATE={
        loaded:true,
        user,
        user_id:user.id,
        profile,
        factory,
        factory_id:profile?.factory_id || factory?.id || '',
        role:profile?.role_code || '',
        permissions
      };
      localStorage.setItem('btg_selected_factory_id', window.BTG_ACCESS_STATE.factory_id || '');
      lastLoadAt=Date.now();
      emitIfChanged(window.BTG_ACCESS_STATE,force);
      loadingPromise=null;
      return window.BTG_ACCESS_STATE;
    })();

    return loadingPromise;
  }

  window.loadAccessState=loadSimpleAccessState;
  window.BTG_SIMPLE_ACCESS_STATE={load:loadSimpleAccessState};

  async function boot(force=false){ try{ await loadSimpleAccessState({force}); }catch(err){ console.warn('Simple access boot:',err); loadingPromise=null; } }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>boot(false)); else boot(false);
  try{ db()?.auth?.onAuthStateChange?.((event)=>{ if(event==='SIGNED_IN' || event==='SIGNED_OUT' || event==='TOKEN_REFRESHED') setTimeout(()=>boot(event!=='TOKEN_REFRESHED'),300); }); }catch(_){}
})();