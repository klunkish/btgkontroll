(function(){
  if (window.__BTG_V1956_ACCESS_STABILIZER) return;
  window.__BTG_V1956_ACCESS_STABILIZER = true;

  function client(){ return (typeof window.btgGetSupabaseClient === 'function' ? window.btgGetSupabaseClient() : (window.sb || null)); }
  function user(){ try { return window.CURRENT_USER || null; } catch(_) { return null; } }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function setMessage(text, kind){ const el=document.getElementById('btgAccessMessage'); if(el){ el.className='pill '+(kind||''); el.textContent=text; } }
  function openAccessDialogStable(){
    const dlg=document.getElementById('btgAccessDialog');
    if(!dlg) return;
    setMessage('Koden kopplar dig till rätt fabrik, roll och moduler.', '');
    try { if(!dlg.open) dlg.showModal(); } catch(_) { dlg.setAttribute('open','open'); }
    setTimeout(function(){ document.getElementById('btgAccessCodeInput')?.focus(); }, 60);
  }
  async function redeemAccessCodeStable(){
    const input=document.getElementById('btgAccessCodeInput');
    const code=(input?.value || '').trim().toUpperCase();
    if(!code){ setMessage('Ange behörighetskod.', 'warn'); input?.focus(); return; }
    if(!user()){ setMessage('Du måste vara inloggad först.', 'warn'); return; }
    const supa=client();
    if(!supa){ setMessage('Supabase är inte tillgängligt ännu. Ladda om sidan hårt och logga in igen.', 'danger'); return; }
    const btn=document.getElementById('btnRedeemBtgAccessCode');
    const old=btn?.textContent || 'Aktivera åtkomst';
    if(btn){ btn.disabled=true; btn.textContent='Aktiverar…'; }
    setMessage('Kontrollerar kod…', '');
    try{
      const { data, error } = await supa.rpc('redeem_btg_access_code', { p_code: code });
      if(error) throw error;
      if(input) input.value='';
      setMessage('Åtkomst aktiverad. Uppdaterar fabrik och roll…', 'ok');
      try { if (typeof window.loadAccessState === 'function') await window.loadAccessState(); } catch(e){ console.warn('v19.5.6 loadAccessState:', e); }
      try { if (typeof window.loadFactoryAdminState === 'function') await window.loadFactoryAdminState(); } catch(e){ console.warn('v19.5.6 loadFactoryAdminState:', e); }
      try { if (typeof window.loadCloudCoreData === 'function') await window.loadCloudCoreData(); } catch(e){ console.warn('v19.5.6 loadCloudCoreData:', e); }
      const dlg=document.getElementById('btgAccessDialog'); try { dlg?.close(); } catch(_) { dlg?.removeAttribute('open'); }
      const role = (window.BTG_ACCESS_STATE?.profile?.role_code || 'aktiverad');
      const factory = window.BTG_ACCESS_STATE?.factory?.name || window.BTG_ACCESS_STATE?.factory?.factory_name || '';
      alert('Åtkomst aktiverad: ' + role + (factory ? ' – ' + factory : ''));
    }catch(e){
      setMessage(e?.message || String(e || 'Kunde inte aktivera koden.'), 'danger');
    }finally{
      if(btn){ btn.disabled=false; btn.textContent=old; }
    }
  }

  function rebind(){
    const openBtn=document.getElementById('btnOpenAccessCode');
    if(openBtn && !openBtn.__btgV1956Stable){ openBtn.__btgV1956Stable=true; openBtn.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); openAccessDialogStable(); }, true); }
    const redeem=document.getElementById('btnRedeemBtgAccessCode');
    if(redeem && !redeem.__btgV1956Stable){ redeem.__btgV1956Stable=true; redeem.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); redeemAccessCodeStable(); }, true); }
    const input=document.getElementById('btgAccessCodeInput');
    if(input && !input.__btgV1956Stable){ input.__btgV1956Stable=true; input.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); e.stopPropagation(); redeemAccessCodeStable(); } }, true); }
  }
  window.openBtgAccessDialogStable = openAccessDialogStable;
  window.redeemBtgAccessCodeStable = redeemAccessCodeStable;
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', rebind); else rebind();
  setTimeout(rebind, 250);
  setTimeout(rebind, 1000);
})();
