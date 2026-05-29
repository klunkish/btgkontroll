(function(){
  if (window.__BTG_V19516_PRODUCTION_LIMITED_PATCHED) return;
  window.__BTG_V19516_PRODUCTION_LIMITED_PATCHED = true;

  const PROD_ALLOWED = { prefab:true, avformningskuber:true };
  const PROD_ALLOWED_TABS = new Set(Object.keys(PROD_ALLOWED));

  function roleCode(){
    try { return String(window.BTG_ACCESS_STATE?.profile?.role_code || '').trim().toUpperCase(); }
    catch(_) { return ''; }
  }
  function isProduction(){ return roleCode() === 'PRODUKTION'; }
  function sanitizeProductionPermissions(){
    if (!isProduction()) return false;
    try {
      window.BTG_ACCESS_STATE.permissions = Object.assign({}, PROD_ALLOWED);
      if (window.BTG_ACCESS_STATE.profile) window.BTG_ACCESS_STATE.profile.permissions = Object.assign({}, PROD_ALLOWED);
    } catch(_) {}
    return true;
  }
  function safeSetTab(tab){
    const target = PROD_ALLOWED_TABS.has(tab) ? tab : 'prefab';
    try {
      if (typeof window.__BTG_ORIGINAL_SET_TAB_V19516 === 'function') return window.__BTG_ORIGINAL_SET_TAB_V19516(target);
      if (typeof setTab === 'function') return setTab(target);
    } catch(_) {}
    try {
      document.querySelectorAll('main > section[id^="tab-"]').forEach(sec => {
        sec.style.display = (sec.id === 'tab-' + target) ? 'grid' : 'none';
      });
      document.querySelectorAll('.tab-btn[data-tab], .main-nav [data-tab]').forEach(btn => {
        btn.setAttribute('aria-current', btn.dataset.tab === target ? 'page' : 'false');
      });
    } catch(_) {}
  }
  function applyProductionUi(){
    if (!sanitizeProductionPermissions()) return;
    try {
      document.querySelectorAll('.tab-btn[data-tab], .main-nav [data-tab]').forEach(btn => {
        const tab = btn.dataset?.tab;
        if (!tab) return;
        btn.style.display = PROD_ALLOWED_TABS.has(tab) ? '' : 'none';
      });
      document.querySelectorAll('[data-nav]').forEach(btn => {
        const tab = btn.getAttribute('data-nav');
        if (tab && !PROD_ALLOWED_TABS.has(tab)) btn.style.display = 'none';
      });
      ['btnSettings','btnNordcert','btnExportAll','btnImportAll','btnFactoryAdmin','btnOpenFactoryAdmin','btnCreateFactoryOpen','btnOpenCreateFactory','btnAccessFactoryAdmin'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
      const current = document.querySelector('.tab-btn[aria-current="page"]')?.dataset?.tab || '';
      if (!PROD_ALLOWED_TABS.has(current)) safeSetTab('prefab');
      const badge = document.getElementById('btgAccessBadge') || document.getElementById('roleAccessBadge');
      if (badge) {
        badge.textContent = 'Roll: PRODUKTION • Prefabkö + Avformning';
        badge.title = 'Produktionsrollen har endast åtkomst till Prefabkö och Avformningskuber.';
      }
    } catch(_) {}
  }

  try {
    if (typeof window.setTab === 'function' && !window.__BTG_ORIGINAL_SET_TAB_V19516) {
      window.__BTG_ORIGINAL_SET_TAB_V19516 = window.setTab;
      window.setTab = function(tab){
        sanitizeProductionPermissions();
        if (isProduction() && !PROD_ALLOWED_TABS.has(tab)) tab = 'prefab';
        const result = window.__BTG_ORIGINAL_SET_TAB_V19516.apply(this, [tab]);
        setTimeout(applyProductionUi, 0);
        return result;
      };
    }
  } catch(_) {}

  try {
    if (typeof window.loadAccessProfile === 'function' && !window.__BTG_ORIGINAL_LOAD_ACCESS_PROFILE_V19516) {
      window.__BTG_ORIGINAL_LOAD_ACCESS_PROFILE_V19516 = window.loadAccessProfile;
      window.loadAccessProfile = async function(){
        const result = await window.__BTG_ORIGINAL_LOAD_ACCESS_PROFILE_V19516.apply(this, arguments);
        sanitizeProductionPermissions();
        setTimeout(applyProductionUi, 0);
        return result;
      };
    }
  } catch(_) {}

  document.addEventListener('click', function(ev){
    try {
      if (!isProduction()) return;
      const nav = ev.target.closest('[data-tab], [data-nav]');
      if (!nav) return;
      const tab = nav.dataset?.tab || nav.getAttribute('data-nav');
      if (tab && !PROD_ALLOWED_TABS.has(tab)) {
        ev.preventDefault();
        ev.stopPropagation();
        safeSetTab('prefab');
      }
    } catch(_) {}
  }, true);

  document.addEventListener('DOMContentLoaded', function(){ setTimeout(applyProductionUi, 250); });
  setTimeout(applyProductionUi, 600);
  setTimeout(applyProductionUi, 1600);
})();
