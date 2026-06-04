(function(){
  if(window.__BTG_304_FACTORY_SELECTION_STABILITY) return;
  window.__BTG_304_FACTORY_SELECTION_STABILITY=true;

  function selected(){return String(localStorage.getItem('btg_selected_factory_id')||window.BTG_ACTIVE_FACTORY_ID||window.BTG_CURRENT_FACTORY_ID||'').trim();}
  function apply(fid){
    fid=String(fid||'').trim();
    if(!fid) return;
    window.BTG_ACTIVE_FACTORY_ID=fid;
    window.BTG_CURRENT_FACTORY_ID=fid;
    if(window.BTG_ACCESS_STATE) window.BTG_ACCESS_STATE.factory_id=fid;
    try{localStorage.setItem('btg_selected_factory_id',fid);}catch(_){}
    const sel=document.getElementById('btgFactorySelector');
    if(sel && sel.value!==fid) sel.value=fid;
  }
  function stabilize(){
    const fid=selected();
    const sel=document.getElementById('btgFactorySelector');
    if(sel){
      if(fid && Array.from(sel.options||[]).some(o=>String(o.value)===fid)) sel.value=fid;
      if(!sel.__btg304Bound){
        sel.__btg304Bound=true;
        sel.addEventListener('change',()=>{
          apply(sel.value);
          window.dispatchEvent(new CustomEvent('btg:factory-changed',{detail:{factory_id:sel.value}}));
          document.dispatchEvent(new CustomEvent('btg:factory-changed',{detail:{factory_id:sel.value}}));
        },true);
      }
    }
  }
  document.addEventListener('DOMContentLoaded',stabilize);
  window.addEventListener('btg:access-ready',()=>setTimeout(stabilize,100));
  window.addEventListener('btg:factory-changed',()=>setTimeout(stabilize,100));
  [500,1500,3000].forEach(ms=>setTimeout(stabilize,ms));
})();