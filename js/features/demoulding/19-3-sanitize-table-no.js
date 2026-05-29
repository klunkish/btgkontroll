(function(){
  window.sanitizeDemouldingTableNo = function(v){
    const s = String(v == null ? '' : v).trim();
    if (!s) return '';
    const low = s.toLowerCase();
    if (['prefab','beställning','bestallning','order','customer_order','prefab_queue','kundorder'].includes(low)) return '';
    return s;
  };
})();
