(function(){
  if (window.__BTG_V1957_STABLE_NAV_PATCHED) return;
  window.__BTG_V1957_STABLE_NAV_PATCHED = true;

  try {
    if (!Object.getOwnPropertyDescriptor(window, 'CURRENT_USER')) {
      Object.defineProperty(window, 'CURRENT_USER', { configurable:true, get:function(){ try { return CURRENT_USER || null; } catch(_) { return null; } } });
    }
  } catch(_) {}

  const TAB_LABELS = {
    dashboard:'Dashboard', tillverkning:'Tillverkningsdata', bestallningar:'Beställningar', provningar:'Provningar', utvardering:'Utvärdering',
    kontroll:'Kontroll', material:'Material', dagbok:'Dagbok', prefab:'Prefabkö', avformningskuber:'Avformningskuber', avvikelser:'Avvikelser'
  };
  const ORDER = ['dashboard','tillverkning','bestallningar','prefab','avformningskuber','provningar','utvardering','kontroll','material','dagbok','avvikelser'];
  let lastManualTab = { tab:null, at:0 };
  let safeTabBusy = false;

  function user(){ try { return CURRENT_USER || window.CURRENT_USER || null; } catch(_) { return window.CURRENT_USER || null; } }
  function perms(){ return window.BTG_ACCESS_STATE?.permissions || {}; }
  function profile(){ return window.BTG_ACCESS_STATE?.profile || null; }
  function role(){ return String(profile()?.role_code || '').toUpperCase(); }
  function currentTab(){ return document.querySelector('.tab-btn[aria-current="page"]')?.dataset?.tab || 'dashboard'; }
  function firstAllowed(){ const p=perms(); return ORDER.find(t => p[t]) || 'dashboard'; }
  function isAllowed(tab){
    if (!user()) return true;
    const st = window.BTG_ACCESS_STATE || {};
    if (!st.loaded) return true;
    if (!st.profile) return tab === 'dashboard';
    return !!st.permissions?.[tab];
  }
  function isRecentManual(tab){ return lastManualTab.tab === tab && (Date.now() - lastManualTab.at) < 1200; }
  function normalizeOldRoleLayer(){
    try { document.body.classList.remove('role-requester'); } catch(_) {}
    try {
      const st = window.BTG_ACCESS_STATE || {};
      if (user() && st.loaded && st.profile) {
        window.BTG_ROLE_STATE = {
          loaded:true,
          role:'admin',
          factory:st.factory || null,
          member:{ factory_id:st.profile.factory_id || null, role:'admin' }
        };
        const badge = document.getElementById('roleAccessBadge');
        if (badge) {
          const f = st.factory?.name ? ' • ' + st.factory.name : '';
          badge.textContent = 'Roll: ' + (st.profile.role_code || '—') + f;
          badge.title = 'Roll styrs av v19.5 behörighetssystem.';
        }
      }
    } catch(_) {}
  }
  function setHeaderBadges(){
    try {
      const st = window.BTG_ACCESS_STATE || {};
      const txt = user()
        ? (st.profile ? ('Roll: ' + (st.profile.role_code || '—') + (st.factory?.name ? ' • ' + st.factory.name : '')) : 'Behörighetskod krävs')
        : 'Ej inloggad';
      ['btgAccessBadge','roleAccessBadge'].forEach(id => { const el=document.getElementById(id); if(el) el.textContent = txt; });
    } catch(_) {}
  }
  function showOnlyTab(name){
    const known = new Set(Object.keys(window.tabs || {}));
    document.querySelectorAll('.main-nav [data-tab], nav.toolbar [data-tab], [data-nav]').forEach(el => {
      const t = el.dataset?.tab || el.getAttribute?.('data-nav');
      if (t) known.add(t);
    });
    known.add('dashboard');
    known.forEach(t => {
      const el = (window.tabs && window.tabs[t]) || document.getElementById('tab-' + t);
      if (el) el.style.display = (t === name ? 'grid' : 'none');
    });
    document.querySelectorAll('.tab-btn[data-tab], .main-nav [data-tab]').forEach(btn => {
      btn.setAttribute('aria-current', btn.dataset.tab === name ? 'page' : 'false');
    });
  }
  function renderTab(name){
    try {
      if (name === 'dashboard') { if (typeof renderDashboard === 'function') renderDashboard(); if (typeof window.renderStableUi === 'function') window.renderStableUi(); }
      if (name === 'tillverkning') { renderRecipes?.(); renderRecipeSelects?.(); renderBatchForm?.(); renderBatches?.(); }
      if (name === 'bestallningar') { renderCustomers?.(); renderOrderForm?.(); renderOrders?.(); }
      if (name === 'provningar') { renderCubeForm?.(); renderCubes?.(); renderAirForm?.(); renderAir?.(); }
      if (name === 'utvardering') { initEvaluationTab?.(); }
      if (name === 'kontroll') { renderControlDevices?.(); }
      if (name === 'material') { renderMaterials?.(); }
      if (name === 'dagbok') { renderDiaryInit?.(); }
      if (name === 'prefab') { window.loadPrefabModule?.(); }
      if (name === 'avformningskuber') { window.loadDemouldingCubes?.().then(()=>window.renderDemouldingHistory?.()).catch(()=>{}); }
      if (name === 'avvikelser') { window.loadDeviations?.(); }
    } catch(e){ console.warn('v19.5.7 renderTab:', e); }
  }
  async function ensureAccess(){
    const st = window.BTG_ACCESS_STATE || {};
    if (user() && !st.loaded && typeof window.loadAccessState === 'function') {
      try { await window.loadAccessState(); } catch(e){ console.warn('v19.5.7 loadAccessState:', e); }
    }
  }
  async function safeSetTab(name){
    if (safeTabBusy) return;
    safeTabBusy = true;
    try {
      name = name || 'dashboard';
      await ensureAccess();
      normalizeOldRoleLayer();

      // Äldre prefab/factory_members-lagret kan försöka skicka anslutna konton till prefab automatiskt.
      // Tillåt manuell prefab-klickning, men blockera automatisk om dashboard är tillåten i nya rollen.
      if (name === 'prefab' && !isRecentManual('prefab') && profile() && perms().dashboard && role() !== 'PREFAB' && currentTab() === 'dashboard') {
        name = 'dashboard';
      }

      if (!isAllowed(name)) {
        name = profile() ? firstAllowed() : 'dashboard';
      }

      showOnlyTab(name);
      renderTab(name);
      normalizeOldRoleLayer();
      setHeaderBadges();
      try { document.body.classList.remove('sidebar-open'); } catch(_) {}
    } finally {
      safeTabBusy = false;
    }
  }

  function bindManualClicks(){
    document.addEventListener('click', function(e){
      const btn = e.target?.closest?.('[data-tab], [data-nav]');
      const tab = btn?.dataset?.tab || btn?.getAttribute?.('data-nav');
      if (!tab) return;
      lastManualTab = { tab, at:Date.now() };
    }, true);
  }

  function patchCore(){
    try { window.applyRoleBasedAccess = normalizeOldRoleLayer; } catch(_) {}
    try { window.setTab = setTab = safeSetTab; } catch(_) { window.setTab = safeSetTab; }

    const oldLoad = window.loadCloudCoreData;
    if (typeof oldLoad === 'function' && !oldLoad.__btgV1957Wrapped) {
      const wrapped = async function(){
        const before = currentTab();
        const res = await oldLoad.apply(this, arguments);
        normalizeOldRoleLayer();
        setHeaderBadges();
        // Om äldre lager bytte flik under molnladdning: återställ till tidigare tillåten flik.
        setTimeout(function(){
          const after = currentTab();
          if (before && before !== after && isAllowed(before) && !isRecentManual(after)) safeSetTab(before);
          else normalizeOldRoleLayer();
        }, 20);
        return res;
      };
      wrapped.__btgV1957Wrapped = true;
      window.loadCloudCoreData = loadCloudCoreData = wrapped;
    }
  }

  function init(){
    bindManualClicks();
    patchCore();
    normalizeOldRoleLayer();
    setHeaderBadges();
    setTimeout(function(){ normalizeOldRoleLayer(); setHeaderBadges(); }, 400);
    setTimeout(function(){ normalizeOldRoleLayer(); setHeaderBadges(); if (currentTab() !== 'dashboard' && profile() && perms().dashboard && !isRecentManual(currentTab())) safeSetTab('dashboard'); }, 1400);
    try { window.sb?.auth?.onAuthStateChange?.(() => setTimeout(function(){ normalizeOldRoleLayer(); setHeaderBadges(); }, 700)); } catch(_) {}
  }

  window.btgNormalizeOldRoleLayer = normalizeOldRoleLayer;
  window.btgStableSetTab = safeSetTab;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
