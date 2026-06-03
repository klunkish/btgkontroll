(function(){
  try {
    if (!window.SETTINGS) window.SETTINGS = {};
    if (!SETTINGS.en206) SETTINGS.en206 = {};
    if (!SETTINGS.en206.sigmaSource) SETTINGS.en206.sigmaSource = 'latest35';
    const sel = document.getElementById('sigmaSource');
    if (sel){
      sel.value = SETTINGS.en206.sigmaSource;
      sel.addEventListener('change', ()=>{ SETTINGS.en206.sigmaSource = sel.value; save('bk_settings_v2', SETTINGS); });
    }
  } catch(e){}
})();
