(function(){
  if (window.__BTG_V1959_SIDEBAR_CLICK_FIX_PATCHED) return;
  window.__BTG_V1959_SIDEBAR_CLICK_FIX_PATCHED = true;

  /*
    v19.5.9: v19.5.8 observerade även attribut och satte samtidigt title-attribut.
    Det kunde skapa en tät MutationObserver-loop som gjorde att klick i appen låste sig.
    Denna ersätter title-synken med en throttlad variant som inte observerar attribut.
  */
  var scheduled = false;

  function setTitleIfChanged(el, value){
    if (!el) return;
    value = String(value || '').trim();
    if (el.getAttribute('title') !== value) el.setAttribute('title', value);
  }

  function syncTitlesNow(){
    scheduled = false;
    ['authStatus','btgAccessBadge','roleAccessBadge'].forEach(function(id){
      var el = document.getElementById(id);
      if (el) setTitleIfChanged(el, el.textContent || '');
    });
    var sel = document.getElementById('btgFactorySelector');
    if (sel && sel.selectedOptions && sel.selectedOptions[0]) {
      setTitleIfChanged(sel, sel.selectedOptions[0].textContent || '');
    }
  }

  function syncTitles(){
    if (scheduled) return;
    scheduled = true;
    setTimeout(syncTitlesNow, 80);
  }

  function init(){
    syncTitles();
    setTimeout(syncTitles, 500);
    setTimeout(syncTitles, 1500);
    try { window.sb?.auth?.onAuthStateChange?.(function(){ setTimeout(syncTitles, 700); }); } catch(_) {}

    var target = document.querySelector('.header-actions');
    if (target && window.MutationObserver){
      new MutationObserver(syncTitles).observe(target, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
