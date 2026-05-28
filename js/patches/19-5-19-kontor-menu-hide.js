(function(){
  if (window.__BTG_V19519B_KONTOR_MENU_HIDE_PATCHED) return;
  window.__BTG_V19519B_KONTOR_MENU_HIDE_PATCHED = true;

  const ALLOWED = new Set(['tillverkning', 'bestallningar']);

  function textOf(id){
    const el = document.getElementById(id);
    return el ? String(el.textContent || '') : '';
  }

  function getRole(){
    try {
      const st = window.BTG_ACCESS_STATE || {};
      const p = st.profile || {};
      let role = String(p.role_code || p.role || window.BTG_ACTIVE_ROLE || '').trim().toUpperCase();
      if (!role) {
        const txt = [textOf('btgAccessBadge'), textOf('roleAccessBadge'), textOf('authStatus')].join(' ').toUpperCase();
        if (txt.includes('KONTOR')) role = 'KONTOR';
      }
      return role;
    } catch(_) { return ''; }
  }

  function isKontor(){ return getRole() === 'KONTOR'; }

  function applyKontorMenu(){
    const kontor = isKontor();
    document.body.classList.toggle('btg-role-kontor', kontor);
    if (!kontor) return;

    try {
      if (window.BTG_ACCESS_STATE) {
        window.BTG_ACCESS_STATE.permissions = { tillverkning:true, bestallningar:true };
        if (window.BTG_ACCESS_STATE.profile) {
          window.BTG_ACCESS_STATE.profile.permissions = { tillverkning:true, bestallningar:true };
        }
      }
    } catch(_) {}

    document.querySelectorAll('.main-nav [data-tab], nav.main-nav [data-tab], .tab-btn[data-tab]').forEach(function(btn){
      const tab = btn && btn.dataset ? btn.dataset.tab : '';
      if (!tab) return;
      btn.hidden = !ALLOWED.has(tab);
      btn.style.display = ALLOWED.has(tab) ? '' : 'none';
      btn.setAttribute('aria-hidden', ALLOWED.has(tab) ? 'false' : 'true');
    });

    ['btnSettings','btnNordcert','btnExportAll','btnImportAll','btnFactoryAdmin','btnOpenFactoryAdmin','btnCreateFactoryOpen','btnOpenCreateFactory','btnAccessFactoryAdmin'].forEach(function(id){
      const el = document.getElementById(id);
      if (el) { el.hidden = true; el.style.display = 'none'; }
    });

    try {
      const current = document.querySelector('.tab-btn[aria-current="page"]')?.dataset?.tab;
      if (current && !ALLOWED.has(current) && typeof window.setTab === 'function') window.setTab('tillverkning');
    } catch(_) {}
  }

  const oldSetTab = window.setTab;
  if (typeof oldSetTab === 'function' && !oldSetTab.__btgKontorMenuWrapped) {
    const wrapped = function(tab){
      if (isKontor() && !ALLOWED.has(tab)) tab = 'tillverkning';
      const res = oldSetTab.apply(this, arguments.length ? [tab] : arguments);
      setTimeout(applyKontorMenu, 0);
      return res;
    };
    wrapped.__btgKontorMenuWrapped = true;
    window.setTab = wrapped;
  }

  document.addEventListener('click', function(ev){
    if (!isKontor()) return;
    const nav = ev.target && ev.target.closest ? ev.target.closest('[data-tab], [data-nav]') : null;
    if (!nav) return;
    const tab = (nav.dataset && (nav.dataset.tab || nav.dataset.nav)) || nav.getAttribute('data-nav') || '';
    if (tab && !ALLOWED.has(tab)) {
      ev.preventDefault();
      ev.stopPropagation();
      try { if (typeof window.setTab === 'function') window.setTab('tillverkning'); } catch(_) {}
    }
  }, true);

  document.addEventListener('DOMContentLoaded', function(){ setTimeout(applyKontorMenu, 150); });
  [300, 900, 1800, 3500].forEach(function(ms){ setTimeout(applyKontorMenu, ms); });
  let runs = 0;
  const timer = setInterval(function(){
    applyKontorMenu();
    runs += 1;
    if (runs >= 10) clearInterval(timer);
  }, 1000);
})();
