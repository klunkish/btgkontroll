/***********************************************************
 * v19.4 – BEHÖRIGHETSKODER & FABRIKSROLLER
 * Isolerad patch ovanpå v19.3.1.
 ***********************************************************/
(function(){
  if (window.__BTG_V194_ACCESS_PATCHED) return;
  window.__BTG_V194_ACCESS_PATCHED = true;

  const ACCESS_TABLE = 'btg_user_access_profiles';
  const ACCESS_RPC = 'redeem_btg_access_code';

  const ROLE_PRESETS = {
    ADMIN: {
      dashboard:true, tillverkning:true, bestallningar:true, provningar:true, utvardering:true, kontroll:true, material:true, dagbok:true,
      prefab:true, avformningskuber:true, avvikelser:true, settings:true, nordcert:true, exports:true, imports:true
    },
    KONTOR: {
      dashboard:true, tillverkning:true, bestallningar:true, material:true, utvardering:true, provningar:true, nordcert:true, exports:true
    },
    PRODUKTION: {
      prefab:true, avformningskuber:true
    },
    LABB: {
      dashboard:true, provningar:true, avformningskuber:true, utvardering:true, material:true, exports:true
    },
    KVALITET: {
      dashboard:true, tillverkning:true, bestallningar:true, provningar:true, utvardering:true, kontroll:true, material:true, dagbok:true,
      prefab:true, avformningskuber:true, avvikelser:true, nordcert:true, exports:true
    },
    PREFAB: {
      prefab:true
    },
    LASARE: {
      dashboard:true, tillverkning:true, bestallningar:true, provningar:true, utvardering:true, material:true, exports:true
    },
    'LÄSARE': {
      dashboard:true, tillverkning:true, bestallningar:true, provningar:true, utvardering:true, material:true, exports:true
    }
  };

  const TAB_LABELS = {
    dashboard:'Dashboard', tillverkning:'Tillverkningsdata', bestallningar:'Beställningar', provningar:'Provningar', utvardering:'Utvärdering',
    kontroll:'Kontroll', material:'Material', dagbok:'Dagbok', prefab:'Prefabkö', avformningskuber:'Avformningskuber', avvikelser:'Avvikelser'
  };

  window.BTG_ACCESS_STATE = window.BTG_ACCESS_STATE || { loaded:false, profile:null, factory:null, permissions:null, error:null };

  function currentUser(){ try { return (typeof CURRENT_USER !== 'undefined') ? CURRENT_USER : null; } catch(_) { return null; } }
  function esc(v){
    if (typeof escapeHtml === 'function') return escapeHtml(v);
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function normalizeRole(role){ return String(role || '').trim().toUpperCase() || ''; }
  function permissionsFor(profile){
    const role = normalizeRole(profile?.role_code || profile?.role);
    return { ...(ROLE_PRESETS[role] || {}), ...(profile?.permissions || {}) };
  }
  function firstAllowedTab(perms){
    const preferred = ['dashboard','prefab','tillverkning','bestallningar','provningar','avformningskuber','utvardering','kontroll','material','dagbok','avvikelser'];
    return preferred.find(t => !!perms?.[t]) || 'dashboard';
  }
  function isTabAllowed(tab){
    const st = window.BTG_ACCESS_STATE || {};
    if (!currentUser()) return true;
    if (!st.loaded) return true;
    if (!st.profile) return false;
    return !!st.permissions?.[tab];
  }
  function roleLabel(role){
    const r = normalizeRole(role);
    if (r === 'LASARE') return 'LÄSARE';
    return r || '—';
  }

  function ensureAccessBadge(){
    if (document.getElementById('btgAccessBadge')) return;
    const target = document.querySelector('.header-actions') || document.querySelector('header .container') || document.querySelector('header');
    if (!target) return;
    const badge = document.createElement('span');
    badge.id = 'btgAccessBadge';
    badge.className = 'pill';
    badge.textContent = 'Behörighet: —';
    const authStatus = document.getElementById('authStatus');
    if (authStatus && authStatus.parentNode === target) target.insertBefore(badge, authStatus.nextSibling);
    else target.appendChild(badge);
  }

  async function fetchFactory(factoryId){
    if (!factoryId || !window.sb) return null;
    try{
      const { data, error } = await sb.from('factories').select('id,name,join_code,created_at').eq('id', factoryId).single();
      if (error) throw error;
      return data || null;
    }catch(err){
      console.warn('Kunde inte läsa fabrik för behörighetsprofil:', err);
      return null;
    }
  }

  async function loadAccessState(){
    ensureAccessBadge();
    const user = currentUser();
    window.BTG_ACCESS_STATE = { loaded:false, profile:null, factory:null, permissions:null, error:null };

    if (!user || !window.SUPABASE_READY || !window.sb){
      applyAccessState();
      return window.BTG_ACCESS_STATE;
    }

    try{
      const { data, error } = await sb
        .from(ACCESS_TABLE)
        .select('id,user_id,factory_id,role_code,permissions,activated_at,updated_at')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      const profile = data || null;
      const factory = profile?.factory_id ? await fetchFactory(profile.factory_id) : null;
      window.BTG_ACCESS_STATE = {
        loaded:true,
        profile,
        factory,
        permissions: permissionsFor(profile),
        error:null
      };

      // Håll äldre prefab/rollpatch lugn: den tittar på BTG_ROLE_STATE.
      window.BTG_ROLE_STATE = {
        loaded:true,
        role: profile ? normalizeRole(profile.role_code) : null,
        factory,
        member: profile ? { factory_id: profile.factory_id, role: normalizeRole(profile.role_code) } : null
      };
    }catch(err){
      console.warn('Kunde inte läsa v19.4-behörighet:', err);
      window.BTG_ACCESS_STATE = { loaded:true, profile:null, factory:null, permissions:null, error:err };
    }

    applyAccessState();
    return window.BTG_ACCESS_STATE;
  }

  function setMessage(text, kind){
    const el = document.getElementById('btgAccessMessage');
    if (!el) return;
    el.className = 'pill ' + (kind || '');
    el.textContent = text;
  }

  async function redeemAccessCode(){
    const input = document.getElementById('btgAccessCodeInput');
    const code = (input?.value || '').trim().toUpperCase();
    if (!code){ setMessage('Ange behörighetskod.', 'warn'); input?.focus(); return; }
    if (!currentUser()){ setMessage('Du måste vara inloggad först.', 'warn'); return; }
    if (!window.sb){ setMessage('Supabase är inte tillgängligt. Ladda om appen.', 'danger'); return; }

    const btn = document.getElementById('btnRedeemBtgAccessCode');
    const old = btn?.textContent;
    if (btn){ btn.disabled = true; btn.textContent = 'Aktiverar…'; }
    setMessage('Kontrollerar kod…', '');

    try{
      const { data, error } = await sb.rpc(ACCESS_RPC, { p_code: code });
      if (error) throw error;
      setMessage('Åtkomst aktiverad. Laddar om behörighet…', 'ok');
      if (input) input.value = '';
      await loadAccessState();
      try { await loadCloudCoreData?.(); } catch(e){ console.warn('Kunde inte ladda om molndata efter kodaktivering:', e); }
      closeAccessDialog();
      const first = firstAllowedTab(window.BTG_ACCESS_STATE.permissions || {});
      setTimeout(()=>{ try { setTab(first); } catch(e){} }, 50);
      const role = roleLabel(window.BTG_ACCESS_STATE.profile?.role_code);
      const factory = window.BTG_ACCESS_STATE.factory?.name ? ' – ' + window.BTG_ACCESS_STATE.factory.name : '';
      alert('Åtkomst aktiverad: ' + role + factory);
    }catch(err){
      const msg = err?.message || String(err || 'Okänt fel');
      setMessage(msg, 'danger');
    }finally{
      if (btn){ btn.disabled = false; btn.textContent = old || 'Aktivera åtkomst'; }
    }
  }

  function openAccessDialog(){
    const dlg = document.getElementById('btgAccessDialog');
    if (!dlg) return;
    setMessage('Koden kopplar dig till rätt fabrik, roll och moduler.', '');
    try { if (!dlg.open) dlg.showModal(); } catch(e){ dlg.setAttribute('open','open'); }
    setTimeout(()=>document.getElementById('btgAccessCodeInput')?.focus(), 80);
  }
  function closeAccessDialog(){
    const dlg = document.getElementById('btgAccessDialog');
    if (!dlg) return;
    try { if (dlg.open) dlg.close(); } catch(e){ dlg.removeAttribute('open'); }
  }

  function applyAccessState(){
    ensureAccessBadge();
    const user = currentUser();
    const st = window.BTG_ACCESS_STATE || {};
    const locked = !!user && st.loaded && !st.profile;
    const perms = st.permissions || {};
    const badge = document.getElementById('btgAccessBadge');

    document.body.classList.toggle('btg-access-locked', locked);
    // Den äldre v18.6-CSS:en låser requester till prefab. v19.4 styr istället själv.
    document.body.classList.remove('role-requester');

    if (badge){
      if (!user) badge.textContent = 'Behörighet: ej inloggad';
      else if (!st.loaded) badge.textContent = 'Behörighet: laddar…';
      else if (st.error) badge.textContent = 'Behörighet: SQL/åtkomstfel';
      else if (!st.profile) badge.textContent = 'Behörighetskod krävs';
      else {
        const factoryTxt = st.factory?.name ? ' • ' + st.factory.name : '';
        badge.textContent = 'Roll: ' + roleLabel(st.profile.role_code) + factoryTxt;
      }
    }

    document.querySelectorAll('.main-nav [data-tab], nav.toolbar [data-tab]').forEach(btn => {
      const tab = btn.dataset.tab;
      if (!user || !st.loaded || !st.profile) btn.style.display = locked ? 'none' : '';
      else btn.style.display = perms[tab] ? '' : 'none';
    });

    const settingsAllowed = !!perms.settings;
    const exportsAllowed = !!perms.exports;
    const importsAllowed = !!perms.imports || !!perms.exports;
    const nordcertAllowed = !!perms.nordcert;
    const setDisplay = (id, show) => { const el = document.getElementById(id); if (el) el.style.display = show ? '' : 'none'; };
    if (user && st.loaded && st.profile){
      setDisplay('btnSettings', settingsAllowed);
      setDisplay('btnNordcert', nordcertAllowed);
      setDisplay('btnExportAll', exportsAllowed);
      setDisplay('btnImportAll', importsAllowed);
    } else if (!user){
      ['btnSettings','btnNordcert','btnExportAll','btnImportAll'].forEach(id => setDisplay(id, true));
    }

    if (locked){
      openAccessDialog();
      return;
    }

    if (user && st.loaded && st.profile){
      closeAccessDialog();
      const current = document.querySelector('.tab-btn[aria-current="page"]')?.dataset?.tab;
      if (current && !perms[current]){
        const first = firstAllowedTab(perms);
        setTimeout(()=>{ try { setTab(first); } catch(e){} }, 0);
      }
    }
  }

  function directShowTab(name){
    try{
      if (name === 'prefab' && typeof window.loadPrefabModule === 'function'){
        for (const [k, el] of Object.entries(tabs || {})) if (el) el.style.display = (k === name ? 'grid':'none');
        document.querySelectorAll('.tab-btn').forEach(btn => btn.setAttribute('aria-current', btn.dataset.tab === name ? 'page':'false'));
        window.loadPrefabModule();
        return true;
      }
      if (name === 'avformningskuber' && document.getElementById('tab-avformningskuber')){
        for (const [k, el] of Object.entries(tabs || {})) if (el) el.style.display = (k === name ? 'grid':'none');
        document.querySelectorAll('.tab-btn').forEach(btn => btn.setAttribute('aria-current', btn.dataset.tab === name ? 'page':'false'));
        try { window.loadDemouldingCubes?.().then(()=>window.renderDemouldingHistory?.()); } catch(e){}
        return true;
      }
    }catch(e){ console.warn('Direkt flikvisning misslyckades:', e); }
    return false;
  }

  function patchAccessIntoCore(){
    if (window.__BTG_V194_ACCESS_CORE_PATCHED) return;
    window.__BTG_V194_ACCESS_CORE_PATCHED = true;

    try{
      const oldLoad = window.loadCloudCoreData || loadCloudCoreData;
      window.loadCloudCoreData = loadCloudCoreData = async function(){
        const res = await oldLoad.apply(this, arguments);
        await loadAccessState();
        return res;
      };
    }catch(e){ console.warn('Kunde inte koppla v19.4 behörighet till molnladdning:', e); }

    try{
      const oldSetTab = window.setTab || setTab;
      window.setTab = setTab = async function(name){
        await loadAccessStateIfNeeded();
        if (!isTabAllowed(name)){
          const st = window.BTG_ACCESS_STATE || {};
          if (currentUser() && st.loaded && !st.profile){ openAccessDialog(); return; }
          const first = firstAllowedTab(st.permissions || {});
          if (name && TAB_LABELS[name]) alert('Din roll har inte åtkomst till ' + TAB_LABELS[name] + '.');
          name = first;
        }
        let res;
        if (directShowTab(name)) res = undefined;
        else res = await oldSetTab.apply(this, [name]);
        applyAccessState();
        if (document.body.classList.contains('sidebar-open')) document.body.classList.remove('sidebar-open');
        return res;
      };
    }catch(e){ console.warn('Kunde inte koppla v19.4 behörighet till fliksystem:', e); }

    try{
      if (window.sb?.auth?.onAuthStateChange){
        sb.auth.onAuthStateChange(()=> setTimeout(()=>{ loadAccessState(); }, 350));
      }
    }catch(e){}
  }

  async function loadAccessStateIfNeeded(){
    const st = window.BTG_ACCESS_STATE || {};
    if (!currentUser()) return st;
    if (!st.loaded) return await loadAccessState();
    return st;
  }

  function initAccessUI(){
    ensureAccessBadge();
    document.getElementById('btnRedeemBtgAccessCode')?.addEventListener('click', redeemAccessCode);
    document.getElementById('btgAccessCodeInput')?.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); redeemAccessCode(); } });
    document.getElementById('btnBtgAccessLogout')?.addEventListener('click', async () => {
      try { await authLogout?.(); } catch(e){}
      closeAccessDialog();
    });
  }

  function init(){
    initAccessUI();
    patchAccessIntoCore();
    loadAccessState();
    setTimeout(applyAccessState, 500);
    setTimeout(applyAccessState, 1500);
    setTimeout(applyAccessState, 3000);
  }

  window.loadAccessState = loadAccessState;
  window.applyAccessState = applyAccessState;
  window.BTG_ROLE_PRESETS = ROLE_PRESETS;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
