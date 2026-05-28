(function(){
  if (window.__BTG_V19517B_MULTI_PROFILE_SAFE_FIX) return;
  window.__BTG_V19517B_MULTI_PROFILE_SAFE_FIX = true;

  const ACCESS_TABLE = 'btg_user_access_profiles';
  const ACCESS_RPC = 'redeem_btg_access_code';
  const PROD_ALLOWED = { prefab:true, avformningskuber:true };
  const ROLE_PRESETS = {
    ADMIN:{dashboard:true,tillverkning:true,bestallningar:true,provningar:true,utvardering:true,kontroll:true,material:true,dagbok:true,prefab:true,avformningskuber:true,settings:true,nordcert:true,exports:true,imports:true,role_admin:true},
    SUPERADMIN:{dashboard:true,tillverkning:true,bestallningar:true,provningar:true,utvardering:true,kontroll:true,material:true,dagbok:true,prefab:true,avformningskuber:true,settings:true,nordcert:true,exports:true,imports:true,role_admin:true},
    KONTOR:{dashboard:true,tillverkning:true,bestallningar:true,material:true,utvardering:true,provningar:true,nordcert:true,exports:true},
    PRODUKTION:Object.assign({}, PROD_ALLOWED),
    LABB:{dashboard:true,provningar:true,avformningskuber:true,utvardering:true,material:true,exports:true},
    KVALITET:{dashboard:true,tillverkning:true,bestallningar:true,provningar:true,utvardering:true,kontroll:true,material:true,dagbok:true,avformningskuber:true,nordcert:true,exports:true},
    PREFAB:{prefab:true},
    LASARE:{dashboard:true,tillverkning:true,bestallningar:true,provningar:true,utvardering:true,material:true,exports:true},
    'LÄSARE':{dashboard:true,tillverkning:true,bestallningar:true,provningar:true,utvardering:true,material:true,exports:true}
  };

  function sbc(){ try { return window.sb || sb || null; } catch(_) { return window.sb || null; } }
  function currentUser(){ try { return window.CURRENT_USER || CURRENT_USER || null; } catch(_) { return window.CURRENT_USER || null; } }
  function norm(v){ return String(v || '').trim().toUpperCase(); }
  function permsFor(profile){
    const role = norm(profile && (profile.role_code || profile.role));
    const base = Object.assign({}, ROLE_PRESETS[role] || {});
    const extra = (profile && profile.permissions && typeof profile.permissions === 'object') ? profile.permissions : {};
    const merged = Object.assign(base, extra);
    if (role === 'PRODUKTION') return Object.assign({}, PROD_ALLOWED);
    return merged;
  }
  function selectedFactoryId(){
    try { if (window.BTG_FACTORY_ADMIN_STATE && window.BTG_FACTORY_ADMIN_STATE.selectedFactoryId) return String(window.BTG_FACTORY_ADMIN_STATE.selectedFactoryId); } catch(_) {}
    try { const v = localStorage.getItem('btg_selected_factory_id'); if (v) return String(v); } catch(_) {}
    try { if (window.BTG_ACCESS_STATE && window.BTG_ACCESS_STATE.profile && window.BTG_ACCESS_STATE.profile.factory_id) return String(window.BTG_ACCESS_STATE.profile.factory_id); } catch(_) {}
    return '';
  }
  function chooseProfile(profiles){
    profiles = Array.isArray(profiles) ? profiles : [];
    const fid = selectedFactoryId();
    if (fid) {
      const exact = profiles.find(p => String(p.factory_id || '') === fid);
      if (exact) return exact;
    }
    return profiles[0] || null;
  }
  async function fetchFactory(factoryId){
    const c = sbc();
    if (!c || !factoryId) return null;
    try {
      const { data, error } = await c.from('factories').select('id,name,factory_code,join_code,active,created_at').eq('id', factoryId).limit(1);
      if (error) throw error;
      return (data && data[0]) || null;
    } catch(e) { console.warn('v19.5.17b kunde inte läsa fabrik:', e); return null; }
  }
  function setBadge(st){
    const badge = document.getElementById('btgAccessBadge') || document.getElementById('roleAccessBadge');
    if (!badge) return;
    const u = currentUser();
    if (!u) badge.textContent = 'Behörighet: ej inloggad';
    else if (!st || !st.loaded) badge.textContent = 'Behörighet: laddar…';
    else if (st.error) badge.textContent = 'Behörighet: SQL/åtkomstfel';
    else if (!st.profile) badge.textContent = 'Behörighetskod krävs';
    else {
      const role = norm(st.profile.role_code || st.profile.role) || '—';
      const factory = st.factory && (st.factory.name || st.factory.factory_name) ? ' • ' + (st.factory.name || st.factory.factory_name) : '';
      badge.textContent = 'Roll: ' + role + factory;
    }
    try { badge.title = badge.textContent || ''; } catch(_) {}
  }
  function firstAllowed(perms){
    return ['dashboard','prefab','avformningskuber','tillverkning','bestallningar','provningar','utvardering','kontroll','material','dagbok'].find(t => perms && perms[t]) || 'dashboard';
  }
  function applySimpleAccessUi(){
    const st = window.BTG_ACCESS_STATE || {};
    setBadge(st);
    const user = currentUser();
    const locked = !!user && st.loaded && !st.profile;
    document.body.classList.toggle('btg-access-locked', locked);
    document.body.classList.remove('role-requester');
    if (user && st.loaded && st.profile) {
      const perms = st.permissions || {};
      document.querySelectorAll('.main-nav [data-tab], nav.toolbar [data-tab], .tab-btn[data-tab]').forEach(btn => {
        const tab = btn.dataset && btn.dataset.tab;
        if (tab) btn.style.display = perms[tab] ? '' : 'none';
      });
      const role = norm(st.profile.role_code || st.profile.role);
      if (role === 'PRODUKTION') {
        ['btnSettings','btnNordcert','btnExportAll','btnImportAll','btnFactoryAdmin','btnOpenFactoryAdmin'].forEach(id => { const el=document.getElementById(id); if(el) el.style.display='none'; });
      }
      const current = document.querySelector('.tab-btn[aria-current="page"]')?.dataset?.tab;
      if (current && !perms[current]) {
        const target = firstAllowed(perms);
        setTimeout(()=>{ try { window.setTab(target); } catch(_) {} }, 0);
      }
    }
  }

  async function safeLoadAccessState(){
    const u = currentUser();
    window.BTG_ACCESS_STATE = window.BTG_ACCESS_STATE || { loaded:false, profile:null, factory:null, permissions:null, error:null };
    if (!u || !sbc()) {
      window.BTG_ACCESS_STATE = { loaded:!!(!u), profile:null, factory:null, permissions:null, error:null };
      applySimpleAccessUi();
      return window.BTG_ACCESS_STATE;
    }
    try {
      const { data, error } = await sbc()
        .from(ACCESS_TABLE)
        .select('id,user_id,factory_id,role_code,permissions,activated_at,updated_at')
        .eq('user_id', u.id)
        .order('updated_at', { ascending:false, nullsFirst:false });
      if (error) throw error;
      const profiles = Array.isArray(data) ? data : [];
      const profile = chooseProfile(profiles);
      const factory = profile && profile.factory_id ? await fetchFactory(profile.factory_id) : null;
      const permissions = permsFor(profile);
      window.BTG_ACCESS_STATE = { loaded:true, profile:profile || null, factory:factory ? { id:factory.id, name:factory.name, factory_code:factory.factory_code || factory.join_code || '' } : null, permissions, error:null };
      window.BTG_ROLE_STATE = { loaded:true, role: profile ? norm(profile.role_code) : null, factory:window.BTG_ACCESS_STATE.factory, member: profile ? { factory_id: profile.factory_id, role:norm(profile.role_code) } : null };
      if (profile && profile.factory_id) {
        try { localStorage.setItem('btg_selected_factory_id', String(profile.factory_id)); } catch(_) {}
        try { if (window.BTG_FACTORY_ADMIN_STATE) window.BTG_FACTORY_ADMIN_STATE.selectedFactoryId = String(profile.factory_id); } catch(_) {}
      }
    } catch(e) {
      console.warn('v19.5.17b behörighetsladdning misslyckades:', e);
      window.BTG_ACCESS_STATE = { loaded:true, profile:null, factory:null, permissions:null, error:e };
    }
    applySimpleAccessUi();
    try { if (typeof window.applyAccessState === 'function') window.applyAccessState(); } catch(_) {}
    return window.BTG_ACCESS_STATE;
  }

  function setMsg(text, kind){
    const el = document.getElementById('btgAccessMessage');
    if (!el) return;
    el.className = 'pill ' + (kind || '');
    el.textContent = text;
  }
  function closeDlg(){
    const d = document.getElementById('btgAccessDialog');
    try { if (d && d.open) d.close(); } catch(_) { try { d && d.removeAttribute('open'); } catch(__) {} }
  }
  async function safeRedeemAccessCode(ev){
    if (ev) { ev.preventDefault(); ev.stopPropagation(); if (ev.stopImmediatePropagation) ev.stopImmediatePropagation(); }
    const c = sbc();
    const input = document.getElementById('btgAccessCodeInput');
    const code = String(input && input.value || '').trim().toUpperCase();
    if (!code) { setMsg('Ange behörighetskod.', 'warn'); return false; }
    if (!currentUser()) { setMsg('Du måste vara inloggad först.', 'warn'); return false; }
    if (!c) { setMsg('Supabase är inte tillgängligt. Ladda om appen.', 'danger'); return false; }
    const btn = document.getElementById('btnRedeemBtgAccessCode');
    const old = btn && btn.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Aktiverar…'; }
    setMsg('Kontrollerar kod…', '');
    try {
      const { error } = await c.rpc(ACCESS_RPC, { p_code: code });
      if (error) throw error;
      if (input) input.value = '';
      await safeLoadAccessState();
      setMsg('Åtkomst aktiverad.', 'ok');
      closeDlg();
      const st = window.BTG_ACCESS_STATE || {};
      const target = firstAllowed(st.permissions || {});
      setTimeout(()=>{ try { window.setTab(target); } catch(_) {} }, 80);
    } catch(e) {
      setMsg(e && e.message ? e.message : String(e || 'Okänt fel'), 'danger');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = old || 'Aktivera åtkomst'; }
    }
    return false;
  }

  function bindRedeemCapture(){
    const btn = document.getElementById('btnRedeemBtgAccessCode');
    if (btn && !btn.__btgV19517bBound) {
      btn.__btgV19517bBound = true;
      btn.addEventListener('click', safeRedeemAccessCode, true);
    }
    const input = document.getElementById('btgAccessCodeInput');
    if (input && !input.__btgV19517bBound) {
      input.__btgV19517bBound = true;
      input.addEventListener('keydown', function(e){ if (e.key === 'Enter') safeRedeemAccessCode(e); }, true);
    }
  }

  function init(){
    window.loadAccessState = safeLoadAccessState;
    bindRedeemCapture();
    safeLoadAccessState();
    setTimeout(safeLoadAccessState, 700);
    setTimeout(safeLoadAccessState, 1800);
    try { sbc()?.auth?.onAuthStateChange?.(()=>setTimeout(safeLoadAccessState, 450)); } catch(_) {}
  }

  window.BTG_SAFE_LOAD_ACCESS_STATE_V19517B = safeLoadAccessState;
  window.BTG_SAFE_REDEEM_ACCESS_CODE_V19517B = safeRedeemAccessCode;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
