(function(){
  if (window.__BTG_V19528_FACTORY_DATA_ISOLATION) return;
  window.__BTG_V19528_FACTORY_DATA_ISOLATION = true;

  const CORE_ARRAYS = ['RECIPES','MATERIALS','BATCHES','CUBES','AIR','CUSTOMERS','ORDERS','CONTROL_DEVICES'];
  const SAVE_NAMES = [
    'saveRecipeToSupabase','saveMaterialToSupabase','saveBatchToSupabase','saveCubeToSupabase','saveAirToSupabase',
    'saveCustomerToSupabase','saveOrderToSupabase','saveControlDeviceToSupabase','saveTaskToSupabase'
  ];

  function activeFactoryId(){
    try {
      return window.BTG_FACTORY_ADMIN_STATE?.selectedFactoryId
        || window.BTG_ACCESS_STATE?.profile?.factory_id
        || window.BTG_ACCESS_STATE?.factory?.id
        || window.BTG_ACCESS_STATE?.factory?.factory_id
        || localStorage.getItem('btg_selected_factory_id')
        || null;
    } catch(_) { return null; }
  }

  function getDataFactoryId(item){
    const app = item?.app_data || item || {};
    return String(
      item?.factoryId || item?.factory_id || item?.prefabFactoryId ||
      app.factoryId || app.factory_id || app.prefabFactoryId || app.prefab_factory_id || ''
    ).trim();
  }

  function stampFactory(obj){
    const fid = activeFactoryId();
    if (!fid || !obj || typeof obj !== 'object') return obj;
    obj.factoryId = fid;
    obj.factory_id = fid;
    if (obj.app_data && typeof obj.app_data === 'object') {
      obj.app_data.factoryId = fid;
      obj.app_data.factory_id = fid;
    }
    return obj;
  }

  function belongsToActiveFactory(item, fid){
    if (!fid) return true;
    return getDataFactoryId(item) === String(fid);
  }

  function filterArrayByFactory(name, fid){
    try {
      const arr = window[name] || (typeof globalThis[name] !== 'undefined' ? globalThis[name] : null);
      if (!Array.isArray(arr)) return;
      const filtered = arr.filter(x => belongsToActiveFactory(x, fid));
      if (arr.length !== filtered.length) {
        window[name] = filtered;
        try { globalThis[name] = filtered; } catch(_) {}
      }
    } catch(_) {}
  }

  function filterDiaryByFactory(fid){
    try {
      if (!fid || !window.DIARY || typeof window.DIARY !== 'object') return;
      const next = {};
      Object.keys(window.DIARY).forEach(k => {
        const entry = window.DIARY[k];
        if (belongsToActiveFactory(entry, fid)) next[k] = entry;
      });
      window.DIARY = next;
      try { DIARY = next; } catch(_) {}
    } catch(_) {}
  }

  function filterTasksByFactory(fid){
    try {
      if (!fid || !window.TASKS || !Array.isArray(window.TASKS.items)) return;
      window.TASKS.items = window.TASKS.items.filter(x => belongsToActiveFactory(x, fid));
      try { TASKS = window.TASKS; } catch(_) {}
    } catch(_) {}
  }

  function renderAllAfterFilter(){
    try { renderRecipes?.(); } catch(_) {}
    try { renderRecipeSelects?.(); } catch(_) {}
    try { renderMaterials?.(); } catch(_) {}
    try { syncMaterialNamesDatalist?.(); } catch(_) {}
    try { renderBatches?.(); } catch(_) {}
    try { renderCubes?.(); } catch(_) {}
    try { renderAir?.(); } catch(_) {}
    try { renderCustomers?.(); } catch(_) {}
    try { renderCustomerSelects?.(); } catch(_) {}
    try { renderOrders?.(); } catch(_) {}
    try { renderControlDevices?.(); } catch(_) {}
    try { renderDiaryInit?.(); } catch(_) {}
    try { renderTasks?.(); } catch(_) {}
    try { renderDashboard?.(); } catch(_) {}
    try { window.renderDemouldingHistory?.(); } catch(_) {}
    try { updateCloudDashboardMeta?.(); } catch(_) {}
  }

  function enforceFactoryIsolation(reason){
    const fid = activeFactoryId();
    if (!fid) return;
    CORE_ARRAYS.forEach(name => filterArrayByFactory(name, fid));
    filterDiaryByFactory(fid);
    filterTasksByFactory(fid);
    try { window.__BTG_LAST_FACTORY_ISOLATION = { factoryId: fid, reason: reason || '', at: new Date().toISOString() }; } catch(_) {}
    renderAllAfterFilter();
  }

  function wrapSaveFunction(name){
    const fn = window[name] || (typeof globalThis[name] !== 'undefined' ? globalThis[name] : null);
    if (typeof fn !== 'function' || fn.__btgV19528Wrapped) return;
    const wrapped = async function(){
      if (arguments.length && arguments[0] && typeof arguments[0] === 'object') stampFactory(arguments[0]);
      const res = await fn.apply(this, arguments);
      stampFactory(res);
      setTimeout(() => enforceFactoryIsolation('after-save-' + name), 60);
      return res;
    };
    wrapped.__btgV19528Wrapped = true;
    try { window[name] = wrapped; } catch(_) {}
    try { globalThis[name] = wrapped; } catch(_) {}
  }

  function wrapDiarySave(){
    const fn = window.saveDiaryEntryToSupabase || (typeof saveDiaryEntryToSupabase !== 'undefined' ? saveDiaryEntryToSupabase : null);
    if (typeof fn !== 'function' || fn.__btgV19528Wrapped) return;
    const wrapped = async function(entryDate, entry){
      stampFactory(entry);
      const res = await fn.apply(this, arguments);
      stampFactory(res);
      setTimeout(() => enforceFactoryIsolation('after-save-diary'), 60);
      return res;
    };
    wrapped.__btgV19528Wrapped = true;
    try { window.saveDiaryEntryToSupabase = wrapped; } catch(_) {}
    try { saveDiaryEntryToSupabase = wrapped; } catch(_) {}
  }

  function patchSaves(){
    SAVE_NAMES.forEach(wrapSaveFunction);
    wrapDiarySave();
  }

  function patchLoader(){
    const oldLoad = window.loadCloudCoreData || (typeof loadCloudCoreData !== 'undefined' ? loadCloudCoreData : null);
    if (typeof oldLoad !== 'function' || oldLoad.__btgV19528Wrapped) return;
    const wrapped = async function(){
      const res = await oldLoad.apply(this, arguments);
      enforceFactoryIsolation('after-loadCloudCoreData');
      return res;
    };
    wrapped.__btgV19528Wrapped = true;
    try { window.loadCloudCoreData = wrapped; } catch(_) {}
    try { loadCloudCoreData = wrapped; } catch(_) {}
  }

  function patchFactoryChange(){
    document.addEventListener('change', function(e){
      if (e.target && e.target.id === 'btgFactorySelector') {
        setTimeout(() => enforceFactoryIsolation('factory-selector-change'), 120);
        setTimeout(() => enforceFactoryIsolation('factory-selector-change-late'), 900);
      }
    }, true);
  }

  function addDashboardNote(){
    try {
      const card = document.getElementById('btgFactorySetupCard');
      if (!card || document.getElementById('btgFactoryIsolationNote')) return;
      const p = document.createElement('p');
      p.id = 'btgFactoryIsolationNote';
      p.className = 'pill ok';
      p.style.marginTop = '.5rem';
      p.textContent = 'Datasäkerhet: vald fabrik visar endast data som är märkt med samma fabrik. Nya fabriker startar därför tomma.';
      card.appendChild(p);
    } catch(_) {}
  }

  function init(){
    patchSaves();
    patchLoader();
    patchFactoryChange();
    setTimeout(() => { patchSaves(); patchLoader(); enforceFactoryIsolation('init-1'); addDashboardNote(); }, 500);
    setTimeout(() => { patchSaves(); patchLoader(); enforceFactoryIsolation('init-2'); addDashboardNote(); }, 1800);
    setTimeout(() => { patchSaves(); patchLoader(); enforceFactoryIsolation('init-3'); }, 3500);
    try { window.sb?.auth?.onAuthStateChange?.(() => setTimeout(() => enforceFactoryIsolation('auth-change'), 1200)); } catch(_) {}
  }

  window.btgEnforceFactoryIsolation = enforceFactoryIsolation;
  window.btgStampFactoryOnObject = stampFactory;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
