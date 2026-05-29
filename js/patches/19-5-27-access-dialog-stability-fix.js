(function(){
  if (window.__BTG_V19527_ACCESS_DIALOG_STABILITY_FIX) return;
  window.__BTG_V19527_ACCESS_DIALOG_STABILITY_FIX = true;

  const ACCESS_DIALOG_ID = 'btgAccessDialog';
  const MANUAL_WINDOW_MS = 12000;
  let lastGoodState = null;
  let manualOpenUntil = 0;

  function now(){ return Date.now ? Date.now() : new Date().getTime(); }
  function user(){ try { return window.CURRENT_USER || CURRENT_USER || null; } catch(_) { return window.CURRENT_USER || null; } }
  function hasProfile(st){ return !!(st && st.loaded && st.profile); }
  function cloneState(st){
    if (!st || !st.profile) return null;
    return {
      loaded:true,
      profile:st.profile,
      factory:st.factory || null,
      permissions:st.permissions || {},
      error:null,
      savedAt:now(),
      userId:user()?.id || st.profile.user_id || null
    };
  }
  function sameUser(cached){
    const u=user();
    if (!cached || !u) return false;
    return !cached.userId || String(cached.userId) === String(u.id);
  }
  function remember(st){
    if (hasProfile(st)) lastGoodState = cloneState(st);
  }
  function restoreIfTransient(st){
    if (!user()) return st;
    if (hasProfile(st)) { remember(st); return st; }
    // Om en tidigare giltig profil finns i samma session antar vi att null/error är ett async-glapp.
    if (sameUser(lastGoodState)) {
      window.BTG_ACCESS_STATE = {
        loaded:true,
        profile:lastGoodState.profile,
        factory:lastGoodState.factory,
        permissions:lastGoodState.permissions || {},
        error:null
      };
      return window.BTG_ACCESS_STATE;
    }
    return st;
  }
  function getDialog(){ return document.getElementById(ACCESS_DIALOG_ID); }
  function closeDialogIfNotManual(){
    const dlg=getDialog();
    if (!dlg) return;
    if (manualOpenUntil > now()) return;
    try { if (dlg.open) dlg.close(); } catch(_) { try { dlg.removeAttribute('open'); } catch(__){} }
  }
  function stabilizeMenus(){
    let st=window.BTG_ACCESS_STATE || null;
    st=restoreIfTransient(st);
    if (hasProfile(st)) {
      document.body.classList.remove('btg-access-locked','role-requester');
      const perms=st.permissions || {};
      document.querySelectorAll('.main-nav [data-tab], nav.toolbar [data-tab], .tab-btn[data-tab]').forEach(btn=>{
        const tab=btn.dataset && btn.dataset.tab;
        if (tab) btn.style.display = perms[tab] ? '' : 'none';
      });
      const role=String(st.profile.role_code || st.profile.role || '').toUpperCase();
      const badge=document.getElementById('btgAccessBadge') || document.getElementById('roleAccessBadge');
      if (badge) {
        const f=st.factory && (st.factory.name || st.factory.factory_name) ? ' • ' + (st.factory.name || st.factory.factory_name) : '';
        badge.textContent='Roll: ' + (role || '—') + f;
        badge.title=badge.textContent;
      }
      closeDialogIfNotManual();
    } else if (!user()) {
      document.body.classList.remove('btg-access-locked','role-requester');
      closeDialogIfNotManual();
    } else {
      // Saknas profil på riktigt: visa inte modal automatiskt. Dashboard-kortets knapp får öppna den manuellt.
      if (manualOpenUntil <= now()) closeDialogIfNotManual();
    }
  }
  function allowManualOpen(){ manualOpenUntil = now() + MANUAL_WINDOW_MS; }
  function manualOpen(){
    allowManualOpen();
    const dlg=getDialog();
    if (!dlg) return;
    try { if (!dlg.open) dlg.__btgNativeShowModal ? dlg.__btgNativeShowModal() : dlg.showModal(); }
    catch(_) { try { dlg.setAttribute('open','open'); } catch(__){} }
    setTimeout(()=>document.getElementById('btgAccessCodeInput')?.focus(), 50);
  }
  function patchDialogShow(){
    const dlg=getDialog();
    if (!dlg || dlg.__btgV19527Patched) return;
    dlg.__btgV19527Patched = true;
    try { dlg.__btgNativeShowModal = dlg.showModal ? dlg.showModal.bind(dlg) : null; } catch(_) {}
    if (dlg.__btgNativeShowModal) {
      dlg.showModal = function(){
        if (manualOpenUntil > now()) return dlg.__btgNativeShowModal();
        // Stoppar äldre patchar från att öppna modalen automatiskt.
        setTimeout(stabilizeMenus, 0);
        return undefined;
      };
    }
    const nativeSet = dlg.setAttribute ? dlg.setAttribute.bind(dlg) : null;
    if (nativeSet) {
      dlg.setAttribute = function(name, value){
        if (String(name).toLowerCase() === 'open' && manualOpenUntil <= now()) {
          setTimeout(()=>{ try { dlg.removeAttribute('open'); } catch(_){} stabilizeMenus(); }, 0);
          return undefined;
        }
        return nativeSet(name, value);
      };
    }
  }
  function patchAccessFunctions(){
    if (typeof window.applyAccessState === 'function' && !window.applyAccessState.__btgV19527Wrapped) {
      const oldApply=window.applyAccessState;
      window.applyAccessState=function(){
        const res=oldApply.apply(this, arguments);
        try { remember(window.BTG_ACCESS_STATE); stabilizeMenus(); } catch(_) {}
        return res;
      };
      window.applyAccessState.__btgV19527Wrapped=true;
    }
    if (typeof window.loadAccessState === 'function' && !window.loadAccessState.__btgV19527Wrapped) {
      const oldLoad=window.loadAccessState;
      window.loadAccessState=async function(){
        const before=window.BTG_ACCESS_STATE;
        remember(before);
        const res=await oldLoad.apply(this, arguments);
        restoreIfTransient(res || window.BTG_ACCESS_STATE);
        stabilizeMenus();
        return window.BTG_ACCESS_STATE;
      };
      window.loadAccessState.__btgV19527Wrapped=true;
    }
    if (typeof window.openBtgAccessDialogStable === 'function' && !window.openBtgAccessDialogStable.__btgV19527Wrapped) {
      const oldOpen=window.openBtgAccessDialogStable;
      window.openBtgAccessDialogStable=function(){ allowManualOpen(); return oldOpen.apply(this, arguments); };
      window.openBtgAccessDialogStable.__btgV19527Wrapped=true;
    } else {
      window.openBtgAccessDialogStable=manualOpen;
    }
  }
  function bindManualButtons(){
    document.addEventListener('click', function(e){
      const el=e.target && e.target.closest && e.target.closest('#btnOpenAccessCode, [data-open-access-code]');
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      manualOpen();
    }, true);
    const codeInput=document.getElementById('btgAccessCodeInput');
    if (codeInput && !codeInput.__btgV19527FocusBound) {
      codeInput.__btgV19527FocusBound=true;
      codeInput.addEventListener('focus', allowManualOpen, true);
    }
  }
  function init(){
    remember(window.BTG_ACCESS_STATE);
    patchDialogShow();
    patchAccessFunctions();
    bindManualButtons();
    stabilizeMenus();
    [120,500,1200,2500,4500].forEach(ms=>setTimeout(()=>{ patchDialogShow(); patchAccessFunctions(); bindManualButtons(); stabilizeMenus(); }, ms));
    try { window.sb?.auth?.onAuthStateChange?.(()=>setTimeout(stabilizeMenus, 600)); } catch(_) {}
  }
  window.BTG_STABILIZE_ACCESS_UI_V19527 = stabilizeMenus;
  window.BTG_OPEN_ACCESS_CODE_MANUAL_V19527 = manualOpen;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
