/* v19.5.6 – gör befintlig Supabase-klient tillgänglig för sena patchar utan att duplicera klienten. */
(function(){
  if (window.__BTG_V1956_SUPABASE_BRIDGE) return;
  window.__BTG_V1956_SUPABASE_BRIDGE = true;
  try {
    if (!Object.getOwnPropertyDescriptor(window, 'sb')) {
      Object.defineProperty(window, 'sb', { configurable:true, get:function(){ try { return sb; } catch(_) { return null; } } });
    }
  } catch(_) {}
  try {
    if (!Object.getOwnPropertyDescriptor(window, 'SUPABASE_READY')) {
      Object.defineProperty(window, 'SUPABASE_READY', { configurable:true, get:function(){ try { return !!SUPABASE_READY; } catch(_) { return false; } } });
    }
  } catch(_) {}
  window.btgGetSupabaseClient = function(){ try { return sb || window.sb || null; } catch(_) { return window.sb || null; } };
  window.btgIsSupabaseReady = function(){ try { return !!SUPABASE_READY && !!sb; } catch(_) { return !!window.sb; } };
})();
