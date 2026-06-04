(function(){
  if (window.__BTG_V19514_FACTORY_DATA_COMPAT) return;
  window.__BTG_V19514_FACTORY_DATA_COMPAT = true;

  let loadingFactoryData = false;
  let lastFactoryLoadKey = '';

  function sbClient(){ try { return window.sb || sb || null; } catch(_) { return window.sb || null; } }
  function user(){ try { return window.CURRENT_USER || CURRENT_USER || null; } catch(_) { return window.CURRENT_USER || null; } }
  function activeFactoryId(){
    try {
      return localStorage.getItem('btg_selected_factory_id')
        || window.BTG_ACTIVE_FACTORY_ID
        || window.BTG_CURRENT_FACTORY_ID
        || window.BTG_FACTORY_ADMIN_STATE?.selectedFactoryId
        || window.BTG_ACCESS_STATE?.factory_id
        || window.BTG_ACCESS_STATE?.profile?.factory_id
        || window.BTG_ACCESS_STATE?.factory?.id
        || window.BTG_ACCESS_STATE?.factory?.factory_id
        || null;
    } catch(_) { return null; }
  }
  function uniq(arr){ return Array.from(new Set((arr || []).filter(Boolean).map(String))); }

  async function getFactoryUserIds(factoryId){
    const sbc = sbClient();
    if (!sbc || !factoryId) return [];
    const { data, error } = await sbc.rpc('btg_factory_user_ids', { p_factory_id: factoryId });
    if (error) throw error;
    return uniq((data || []).map(r => r.user_id || r.uid || r));
  }

  function applyCoreData(results){
    const [recipesRes, materialsRes, batchesRes, cubesRes, airRes, customersRes, ordersRes, controlRes, diaryRes, tasksRes] = results;
    if (recipesRes.error) throw recipesRes.error;
    if (materialsRes.error) throw materialsRes.error;
    if (batchesRes.error) throw batchesRes.error;
    if (cubesRes.error) throw cubesRes.error;
    if (airRes.error) throw airRes.error;
    if (customersRes.error) throw customersRes.error;
    if (ordersRes.error) throw ordersRes.error;
    if (controlRes.error) throw controlRes.error;
    if (diaryRes.error) throw diaryRes.error;
    if (tasksRes.error) throw tasksRes.error;

    RECIPES = (recipesRes.data || []).map(normalizeRecipeRow);
    MATERIALS = (materialsRes.data || []).map(normalizeMaterialRow);
    BATCHES = (batchesRes.data || []).map(normalizeBatchRow);
    CUBES = (cubesRes.data || []).map(normalizeCubeRow);
    AIR = (airRes.data || []).map(normalizeAirRow);
    CUSTOMERS = (customersRes.data || []).map(normalizeCustomerRow);
    ORDERS = (ordersRes.data || []).map(normalizeOrderRow);
    CONTROL_DEVICES = (controlRes.data || []).map(normalizeControlDeviceRow);
    DIARY = {};
    (diaryRes.data || []).map(normalizeDiaryRow).forEach(entry => { DIARY[entry.date] = entry; });
    TASKS = { items: (tasksRes.data || []).map(normalizeTaskRow) };

    renderRecipes?.();
    renderRecipeSelects?.();
    renderMaterials?.();
    syncMaterialNamesDatalist?.();
    renderBatches?.();
    renderCubes?.();
    renderAir?.();
    renderCustomers?.();
    renderCustomerSelects?.();
    renderOrders?.();
    renderControlDevices?.();
    renderDiaryInit?.();
    renderTasks?.();
    renderDashboard?.();
    try { window.renderDemouldingHistory?.(); } catch(_) {}
    try {
      if (document.getElementById('tab-avformningskuber')?.style.display !== 'none') {
        // Avformningslistan använder BATCHES, så rendera om fliken efter fabriksdata.
        const btn = document.querySelector('[data-tab="avformningskuber"][aria-current="page"]');
        if (btn) window.setTab?.('avformningskuber');
      }
    } catch(_) {}
    try { updateCloudDashboardMeta?.(); } catch(_) {}
  }

  async function loadFactoryCoreData(opts){
    const sbc = sbClient();
    const u = user();
    const factoryId = activeFactoryId();
    if (!sbc || !u || !factoryId || loadingFactoryData) return false;

    loadingFactoryData = true;
    try{
      const ids = await getFactoryUserIds(factoryId);
      if (!ids.length) return false;
      const key = factoryId + '|' + ids.sort().join(',');
      if (!opts?.force && key === lastFactoryLoadKey && Array.isArray(RECIPES) && RECIPES.length) return true;
      lastFactoryLoadKey = key;

      const results = await Promise.all([
        sbc.from('recipes').select('id,name,strength,vct,vct_eq,air_req,app_data,created_at,user_id').in('user_id', ids).order('created_at', { ascending: true }),
        sbc.from('materials').select('id,name,type,ef,note,app_data,created_at,user_id').in('user_id', ids).order('created_at', { ascending: true }),
        sbc.from('batches').select('id,recipe_id,amount_m3,datetime,gwp,app_data,created_at,user_id').in('user_id', ids).order('datetime', { ascending: false }),
        sbc.from('cubes').select('id,recipe_id,cast_date,due_date,strength_mpa,weight,vct,vct_eq,air,temp,kw,batch_id,note,app_data,created_at,user_id').in('user_id', ids).order('cast_date', { ascending: false }),
        sbc.from('air').select('id,recipe_id,date,pct,note,app_data,created_at,user_id').in('user_id', ids).order('date', { ascending: false }),
        sbc.from('customers').select('id,name,contact,info,app_data,created_at,user_id').in('user_id', ids).order('created_at', { ascending: true }),
        sbc.from('orders').select('id,customer_id,recipe_id,order_name,amount_m3,gwp,delivery_date,note,app_data,created_at,user_id').in('user_id', ids).order('delivery_date', { ascending: false }),
        sbc.from('control_devices').select('id,type,name,serial,checks,app_data,created_at,user_id').in('user_id', ids).order('created_at', { ascending: true }),
        sbc.from('diary_entries').select('id,entry_date,weather,vct_req,vct_meas,temp_out,temp_cure,temp_lab,air_req_min,air_meas,water_density,note,imports,app_data,created_at,user_id').in('user_id', ids).order('entry_date', { ascending: false }),
        sbc.from('tasks').select('id,title,freq,log,app_data,created_at,user_id').in('user_id', ids).order('created_at', { ascending: true })
      ]);
      applyCoreData(results);
      return true;
    }catch(err){
      console.warn('v19.5.14 kunde inte ladda fabriksdata:', err);
      try { setCloudStatus?.('warn', 'Fabriksdata kunde inte laddas: ' + (err.message || err)); } catch(_) {}
      return false;
    }finally{
      loadingFactoryData = false;
    }
  }

  function patchCoreLoader(){
    const oldLoad = window.loadCloudCoreData || (typeof loadCloudCoreData === 'function' ? loadCloudCoreData : null);
    if (typeof oldLoad === 'function' && !oldLoad.__btgV19514Wrapped){
      const wrapped = async function(){
        const res = await oldLoad.apply(this, arguments);
        await loadFactoryCoreData({ force:true });
        return res;
      };
      wrapped.__btgV19514Wrapped = true;
      window.loadCloudCoreData = loadCloudCoreData = wrapped;
    }
  }

  function bindFactorySelector(){
    document.addEventListener('change', function(e){
      if (e.target && e.target.id === 'btgFactorySelector') {
        lastFactoryLoadKey = '';
        setTimeout(() => loadFactoryCoreData({ force:true }), 50);
      }
    }, true);
  }

  function init(){
    patchCoreLoader();
    bindFactorySelector();
    setTimeout(() => loadFactoryCoreData({ force:true }), 800);
    setTimeout(() => loadFactoryCoreData({ force:true }), 2000);
    try { window.sb?.auth?.onAuthStateChange?.(() => setTimeout(() => loadFactoryCoreData({ force:true }), 900)); } catch(_) {}
  }

  window.btgLoadFactoryCoreData = loadFactoryCoreData;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
