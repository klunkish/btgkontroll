(function(){
  if (window.__BTG_V19518_KONTOR_LIMITED_PATCHED) return;
  window.__BTG_V19518_KONTOR_LIMITED_PATCHED = true;

  const KONTOR_ALLOWED = { tillverkning:true, bestallningar:true };
  const KONTOR_TABS = new Set(Object.keys(KONTOR_ALLOWED));

  function roleCode(){
    try { return String(window.BTG_ACCESS_STATE?.profile?.role_code || window.BTG_ACCESS_STATE?.profile?.role || '').trim().toUpperCase(); }
    catch(_) { return ''; }
  }
  function isKontor(){ return roleCode() === 'KONTOR'; }
  function sanitizeKontorPermissions(){
    if (!isKontor()) return false;
    try {
      window.BTG_ACCESS_STATE.permissions = Object.assign({}, KONTOR_ALLOWED);
      if (window.BTG_ACCESS_STATE.profile) window.BTG_ACCESS_STATE.profile.permissions = Object.assign({}, KONTOR_ALLOWED);
    } catch(_) {}
    return true;
  }
  function originalSetTab(){
    return window.__BTG_ORIGINAL_SET_TAB_V19518 || window.__BTG_ORIGINAL_SET_TAB_V19516 || window.__BTG_ORIGINAL_SET_TAB_V1955 || window.setTab;
  }
  function safeSetTab(tab){
    const target = KONTOR_TABS.has(tab) ? tab : 'tillverkning';
    try {
      const fn = originalSetTab();
      if (typeof fn === 'function' && fn !== safeSetTab) return fn.call(window, target);
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
  function applyKontorUi(){
    if (!sanitizeKontorPermissions()) return;
    try {
      document.querySelectorAll('.tab-btn[data-tab], .main-nav [data-tab]').forEach(btn => {
        const tab = btn.dataset?.tab;
        if (!tab) return;
        btn.style.display = KONTOR_TABS.has(tab) ? '' : 'none';
      });
      document.querySelectorAll('[data-nav]').forEach(btn => {
        const tab = btn.getAttribute('data-nav');
        if (tab && !KONTOR_TABS.has(tab)) btn.style.display = 'none';
      });
      ['btnSettings','btnNordcert','btnExportAll','btnImportAll','btnFactoryAdmin','btnOpenFactoryAdmin','btnCreateFactoryOpen','btnOpenCreateFactory','btnAccessFactoryAdmin','btnAddTask','btnExportTasksPDF'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
      const current = document.querySelector('.tab-btn[aria-current="page"]')?.dataset?.tab || '';
      if (!KONTOR_TABS.has(current)) safeSetTab('tillverkning');
      const badge = document.getElementById('btgAccessBadge') || document.getElementById('roleAccessBadge');
      if (badge) {
        badge.textContent = 'Roll: KONTOR • Tillverkningsdata + Beställningar';
        badge.title = 'Kontorsrollen har endast åtkomst till Tillverkningsdata och Beställningar.';
      }
    } catch(_) {}
  }

  try {
    if (typeof window.setTab === 'function' && !window.__BTG_ORIGINAL_SET_TAB_V19518) {
      window.__BTG_ORIGINAL_SET_TAB_V19518 = window.setTab;
      window.setTab = function(tab){
        sanitizeKontorPermissions();
        if (isKontor() && !KONTOR_TABS.has(tab)) tab = 'tillverkning';
        const result = window.__BTG_ORIGINAL_SET_TAB_V19518.apply(this, [tab]);
        setTimeout(applyKontorUi, 0);
        return result;
      };
    }
  } catch(_) {}

  try {
    if (typeof window.loadAccessState === 'function' && !window.__BTG_ORIGINAL_LOAD_ACCESS_STATE_V19518) {
      window.__BTG_ORIGINAL_LOAD_ACCESS_STATE_V19518 = window.loadAccessState;
      window.loadAccessState = async function(){
        const result = await window.__BTG_ORIGINAL_LOAD_ACCESS_STATE_V19518.apply(this, arguments);
        sanitizeKontorPermissions();
        setTimeout(applyKontorUi, 0);
        return result;
      };
    }
  } catch(_) {}

  document.addEventListener('click', function(ev){
    try {
      if (!isKontor()) return;
      const nav = ev.target.closest('[data-tab], [data-nav]');
      if (!nav) return;
      const tab = nav.dataset?.tab || nav.getAttribute('data-nav');
      if (tab && !KONTOR_TABS.has(tab)) {
        ev.preventDefault();
        ev.stopPropagation();
        safeSetTab('tillverkning');
      }
    } catch(_) {}
  }, true);

  document.addEventListener('DOMContentLoaded', function(){ setTimeout(applyKontorUi, 250); });
  setTimeout(applyKontorUi, 600);
  setTimeout(applyKontorUi, 1600);
})();
