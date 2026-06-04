(function(){
  if (window.__BTG_V19525_DEMOULDING_TABLE_FINALIZER) return;
  window.__BTG_V19525_DEMOULDING_TABLE_FINALIZER = true;

  function isDemouldingVisible(){
    const tab = document.getElementById('tab-avformningskuber');
    return !!tab && tab.style.display !== 'none';
  }
  function headers(){
    return Array.from(document.querySelectorAll('#demouldingTodayTable thead th')).map(th => (th.textContent || '').trim().toLowerCase());
  }
  function bordIndex(){
    return headers().findIndex(h => h === 'bord' || h === 'bordsnr' || h === 'bord nr');
  }
  function tableLooksOverwritten(){
    const idx = bordIndex();
    if (idx < 0) return false;
    const rows = Array.from(document.querySelectorAll('#demouldingTodayTable tbody tr'));
    return rows.some(tr => {
      const tds = Array.from(tr.children || []);
      const txt = (tds[idx]?.textContent || '').trim().toLowerCase();
      return ['prefab','order','beställning','bestallning','customer_order','prefab_queue'].includes(txt);
    });
  }
  let fixing = false;
  function finalRender(delay){
    setTimeout(function(){
      if (fixing || !isDemouldingVisible()) return;
      const fn = window.btgRefreshDemouldingV19520 || window.btgRefreshDemouldingV19515;
      if (typeof fn !== 'function') return;
      fixing = true;
      try { Promise.resolve(fn()).finally(function(){ fixing = false; }); }
      catch(_) { fixing = false; }
    }, delay || 0);
  }
  function finalRenderBurst(){
    [0, 150, 450, 900, 1500, 2500].forEach(finalRender);
  }

  function wrapSetTab(){
    const oldSetTab = window.setTab || (typeof setTab === 'function' ? setTab : null);
    if (typeof oldSetTab !== 'function' || oldSetTab.__btgV19525Wrapped) return;
    const wrapped = function(name){
      const res = oldSetTab.apply(this, arguments);
      if (name === 'avformningskuber') finalRenderBurst();
      return res;
    };
    wrapped.__btgV19525Wrapped = true;
    try { window.setTab = setTab = wrapped; } catch(_) { window.setTab = wrapped; }
  }

  function startObserver(){
    const tbody = document.querySelector('#demouldingTodayTable tbody');
    if (!tbody || tbody.__btgV19525Observed) return;
    tbody.__btgV19525Observed = true;
    let timer = null;
    const obs = new MutationObserver(function(){
      clearTimeout(timer);
      timer = setTimeout(function(){
        if (!fixing && isDemouldingVisible() && tableLooksOverwritten()) finalRender(50);
      }, 80);
    });
    obs.observe(tbody, { childList:true, subtree:true, characterData:true });
  }

  function init(){
    wrapSetTab();
    startObserver();
    document.addEventListener('click', function(e){
      if (e.target?.dataset?.tab === 'avformningskuber' || e.target?.id === 'btnRefreshDemoulding') finalRenderBurst();
    }, true);
    document.addEventListener('change', function(e){
      if (e.target?.id === 'demouldingCastDate' || e.target?.id === 'btgFactorySelector') finalRenderBurst();
    }, true);
    if (isDemouldingVisible()) finalRenderBurst();
    setTimeout(startObserver, 500);
    setTimeout(startObserver, 1500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
