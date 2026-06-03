/***********************************************************
 * v18.6 ROLE BASED ACCESS
 *
 * admin     = full åtkomst
 * producer  = prefabkö + produktion/provning
 * requester = endast prefabkö
 *
 * Viktigt: detta är UX/klientstyrning. RLS i Supabase skyddar datan.
 ***********************************************************/
(function(){
  window.BTG_ROLE_STATE = window.BTG_ROLE_STATE || {
    loaded:false,
    role:null,
    factory:null,
    member:null
  };

  function currentUser(){ return (typeof CURRENT_USER !== 'undefined') ? CURRENT_USER : null; }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function ensureRoleBadge(){
    if (document.getElementById('roleAccessBadge')) return;
    const target = document.querySelector('.header-actions') || document.querySelector('header .container') || document.querySelector('header');
    if (!target) return;
    const badge = document.createElement('span');
    badge.id = 'roleAccessBadge';
    badge.className = 'pill';
    badge.textContent = 'Roll: —';
    target.appendChild(badge);
  }

  function roleLabel(role){
    if (role === 'admin') return 'Admin';
    if (role === 'producer') return 'Produktion/labb';
    if (role === 'requester') return 'Fabriksbeställare';
    return 'Standard';
  }

  async function loadRoleState(){
    const user = currentUser();
    window.BTG_ROLE_STATE = { loaded:false, role:null, factory:null, member:null };
    if (!user || !window.SUPABASE_READY || !window.sb) {
      applyRoleBasedAccess();
      return window.BTG_ROLE_STATE;
    }

    try{
      const { data: members, error: memberError } = await sb
        .from('factory_members')
        .select('id,factory_id,user_id,role,created_at')
        .eq('user_id', user.id)
        .limit(1);

      if (memberError) throw memberError;

      const member = members && members.length ? members[0] : null;
      let factory = null;
      if (member?.factory_id){
        const { data: f, error: factoryError } = await sb
          .from('factories')
          .select('id,name,join_code,created_by,created_at')
          .eq('id', member.factory_id)
          .single();
        if (factoryError) throw factoryError;
        factory = f;
      }

      window.BTG_ROLE_STATE = {
        loaded:true,
        role: member?.role || null,
        factory,
        member
      };
    }catch(err){
      console.warn('Kunde inte läsa roll/behörighet:', err);
      window.BTG_ROLE_STATE = { loaded:true, role:null, factory:null, member:null, error:err };
    }

    applyRoleBasedAccess();
    return window.BTG_ROLE_STATE;
  }

  function allowedTabsForRole(role){
    if (role === 'requester') return ['prefab'];
    if (role === 'producer') return ['dashboard','prefab','tillverkning','provningar','material'];
    return null; // admin/standard = alla
  }

  function applyRoleBasedAccess(){
    ensureRoleBadge();
    const state = window.BTG_ROLE_STATE || {};
    const role = state.role;
    const allowed = allowedTabsForRole(role);
    const badge = document.getElementById('roleAccessBadge');
    if (badge){
      const factoryTxt = state.factory?.name ? ' • ' + state.factory.name : '';
      badge.textContent = 'Roll: ' + roleLabel(role) + factoryTxt;
      badge.title = role === 'requester'
        ? 'Detta konto kan endast lägga och se prefab-beställningar för sin fabrik.'
        : 'Behörighet styr vilka moduler som visas.';
    }

    document.body.classList.toggle('role-requester', role === 'requester');

    document.querySelectorAll('.main-nav [data-tab], nav.toolbar [data-tab]').forEach(btn=>{
      const tab = btn.dataset.tab;
      if (!allowed) btn.style.display = '';
      else btn.style.display = allowed.includes(tab) ? '' : 'none';
    });

    if (allowed){
      for (const [key, el] of Object.entries(window.tabs || {})){
        if (!el) continue;
        if (!allowed.includes(key)) el.style.display = 'none';
      }
      const visibleCurrent = document.querySelector('.tab-btn[aria-current="page"]');
      const currentTab = visibleCurrent?.dataset?.tab;
      if (!currentTab || !allowed.includes(currentTab)){
        setTimeout(()=>{
          try { window.setTab ? setTab(allowed[0]) : null; } catch(e){}
        }, 0);
      }
    }
  }

  function patchRoleIntoCore(){
    if (window.__roleBasedAccessPatched) return;
    window.__roleBasedAccessPatched = true;

    try{
      const oldLoad = window.loadCloudCoreData || loadCloudCoreData;
      window.loadCloudCoreData = loadCloudCoreData = async function(){
        const res = await oldLoad.apply(this, arguments);
        await loadRoleState();
        return res;
      };
    }catch(e){ console.warn('Kunde inte koppla rollstyrning till molnladdning:', e); }

    try{
      const oldSetTab = window.setTab || setTab;
      window.setTab = setTab = function(name){
        const state = window.BTG_ROLE_STATE || {};
        const allowed = allowedTabsForRole(state.role);
        if (allowed && !allowed.includes(name)) name = allowed[0];
        const res = oldSetTab.apply(this, arguments.length ? [name] : arguments);
        applyRoleBasedAccess();
        return res;
      };
    }catch(e){ console.warn('Kunde inte koppla rollstyrning till fliksystem:', e); }

    try{
      if (window.sb?.auth?.onAuthStateChange){
        sb.auth.onAuthStateChange(()=> setTimeout(loadRoleState, 250));
      }
    }catch(e){}
  }

  function init(){
    ensureRoleBadge();
    patchRoleIntoCore();
    loadRoleState();
    setTimeout(applyRoleBasedAccess, 500);
    setTimeout(applyRoleBasedAccess, 1500);
  }

  window.loadRoleState = loadRoleState;
  window.applyRoleBasedAccess = applyRoleBasedAccess;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
