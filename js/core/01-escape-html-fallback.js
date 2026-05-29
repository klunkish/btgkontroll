(function(){ 
  if (typeof window.escapeHtml !== 'function'){
    window.escapeHtml = function(str){
      const s = String(str==null? '': str);
      return s.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#039;' }[m]));
    };
  }
})();
