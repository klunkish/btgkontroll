(function(){
  if (window.__BTG_V1955_STABLE_ACCESS_PATCHED) return;
  window.__BTG_V1955_STABLE_ACCESS_PATCHED = true;

  const SUPERADMIN_EMAILS = ['j.ottosson53@gmail.com'];
  const ALL_PERMISSIONS = {
    dashboard:true,tillverkning:true,bestallningar:true,provningar:true,utvardering:true,kontroll:true,material:true,dagbok:true,
    prefab:true,prefab_queue:true,avformningskuber:true,demoulding_cubes:true,avvikelser:true,tasks:true,settings:true,nordcert:true,exports:true,imports:true,role_admin:true
  };
  const state = window.BTG_FACTORY_ADMIN_STATE = window.BTG_FACTORY_ADMIN_STATE || { loaded:false, factories:[], selectedFactoryId:null, isSuperadmin:false, loading:false };

  function user(){ try { return window.CURRENT_USER || null; } catch(_) { return null; } }
  function email(){ return String(user()?.email || '').toLowerCase(); }
  function isSuperadmin(){ return !!user() && SUPERADMIN_EMAILS.includes(email()); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function closeDialog(id){ const d=document.getElementById(id); try { if(d?.open) d.close(); } catch(_) { d?.removeAttribute('open'); } }
  function fmtDate(v){ if(!v) return '—'; try { return new Date(v).toLocaleDateString('sv-SE'); } catch(_) { return String(v); } }

  function normFactory(row){
    if (!row) return null;
    const id = row.factory_id || row.id;
    if (!id) return null;
    return {
      factory_id: id,
      factory_name: row.factory_name || row.name || 'Namnlös fabrik',
      factory_code: row.factory_code || row.join_code || '',
      user_role: row.user_role || (row.is_superadmin ? 'SUPERADMIN' : null) || row.role_code || '',
      is_superadmin: !!row.is_superadmin
    };
  }
  function selectedFactory(){
    const st = window.BTG_FACTORY_ADMIN_STATE || {};
    const id = st.selectedFactoryId || window.BTG_ACCESS_STATE?.profile?.factory_id || window.BTG_ACCESS_STATE?.factory?.id;
    return (st.factories || []).find(f => String(f.factory_id) === String(id)) || (st.factories || [])[0] || null;
  }
  function roleCode(){
    if (isSuperadmin()) return 'SUPERADMIN';
    return String(window.BTG_ACCESS_STATE?.profile?.role_code || selectedFactory()?.user_role || '').toUpperCase();
  }
  function canAdminFactory(){
    const r = roleCode();
    return isSuperadmin() || r === 'ADMIN' || !!window.BTG_ACCESS_STATE?.permissions?.role_admin;
  }

  function ensureSelector(){
    const actions = document.querySelector('.header-actions');
    if (!actions) return null;
    let wrap = document.getElementById('btgFactorySelectorWrap');
    if (!wrap){
      wrap = document.createElement('div');
      wrap.id = 'btgFactorySelectorWrap';
      wrap.innerHTML = '<label for="btgFactorySelector">Fabrik</label><select id="btgFactorySelector"></select><small class="btg-factory-fallback-note" style="color:var(--muted);font-size:.72rem"></small>';
      actions.insertBefore(wrap, actions.firstChild);
    } else if (!wrap.querySelector('.btg-factory-fallback-note')) {
      const note=document.createElement('small'); note.className='btg-factory-fallback-note'; note.style.cssText='color:var(--muted);font-size:.72rem'; wrap.appendChild(note);
    }
    const sel = document.getElementById('btgFactorySelector');
    if (sel && !sel.__btgV1955Bound){
      sel.__btgV1955Bound = true;
      sel.addEventListener('change', e => {
        const id = e.target.value || '';
        window.BTG_FACTORY_ADMIN_STATE.selectedFactoryId = id || null;
        try { localStorage.setItem('btg_selected_factory_id', id); } catch(_) {}
        applySelectedAccess();
        renderStableUi();
      });
    }
    return wrap;
  }
  function ensureSetupCard(){
    const dash = document.getElementById('tab-dashboard');
    if (!dash) return null;
    let card = document.getElementById('btgFactorySetupCard');
    if (!card){
      card = document.createElement('div');
      card.id = 'btgFactorySetupCard';
      card.className = 'card';
      card.innerHTML = '<h3>Fabrik och behörighet</h3><div id="btgFactorySetupBody"></div>';
      dash.insertBefore(card, dash.firstChild);
    }
    return card;
  }

  function applySelectedAccess(){
    const u = user();
    const f = selectedFactory();
    if (!u) return;
    if (isSuperadmin()){
      window.BTG_ACCESS_STATE = {
        loaded:true,
        profile:{ id:'superadmin', user_id:u.id, factory_id:f?.factory_id || null, role_code:'SUPERADMIN', permissions:{...ALL_PERMISSIONS} },
        factory:f ? { id:f.factory_id, name:f.factory_name, factory_code:f.factory_code } : null,
        permissions:{...ALL_PERMISSIONS},
        error:null
      };
      window.BTG_ROLE_STATE = { loaded:true, role:'admin', factory:window.BTG_ACCESS_STATE.factory, member:null };
      document.body.classList.remove('btg-access-locked','role-requester');
      document.body.classList.add('btg-v195-superadmin');
      document.querySelectorAll('.main-nav [data-tab], nav.toolbar [data-tab]').forEach(btn => { btn.style.display = ''; });
      ['btnSettings','btnNordcert','btnExportAll','btnImportAll'].forEach(id => { const el=document.getElementById(id); if(el) el.style.display=''; });
    }
    const txt = 'Roll: ' + (roleCode() || '—') + (f?.factory_name ? ' • ' + f.factory_name : '');
    ['btgAccessBadge','roleAccessBadge'].forEach(id => { const el=document.getElementById(id); if(el) el.textContent = txt; });
  }

  function renderStableUi(){
    ensureSetupCard(); ensureSelector();
    const st = window.BTG_FACTORY_ADMIN_STATE || {};
    const rows = st.factories || [];
    const f = selectedFactory();
    const wrap = document.getElementById('btgFactorySelectorWrap');
    const sel = document.getElementById('btgFactorySelector');
    if (wrap && sel){
      const show = !!user() && (isSuperadmin() || rows.length > 0);
      wrap.style.display = show ? 'grid' : 'none';
      sel.innerHTML = rows.length
        ? rows.map(x => '<option value="' + esc(x.factory_id) + '" ' + (String(x.factory_id) === String(st.selectedFactoryId) ? 'selected' : '') + '>' + esc(x.factory_name || 'Fabrik') + (x.user_role ? ' – ' + esc(x.user_role) : '') + '</option>').join('')
        : '<option value="">Ingen fabrik skapad ännu</option>';
      const note = wrap.querySelector('.btg-factory-fallback-note');
      if (note) note.textContent = rows.length ? '' : (isSuperadmin() ? 'Superadmin aktiv. Skapa eller migrera en fabrik om listan är tom.' : '');
    }
    const body = document.getElementById('btgFactorySetupBody');
    if (body){
      let status = 'Logga in för att skapa fabrik eller ange behörighetskod.';
      if (user()){
        if (isSuperadmin()) status = 'Aktiv roll: SUPERADMIN' + (f?.factory_name ? ' • vald fabrik: ' + esc(f.factory_name) : ' • ingen fabrik vald/skapat ännu');
        else if (window.BTG_ACCESS_STATE?.profile) status = 'Aktiv åtkomst: ' + esc(roleCode() || '—') + (f?.factory_name ? ' • ' + esc(f.factory_name) : (window.BTG_ACCESS_STATE?.factory?.name ? ' • ' + esc(window.BTG_ACCESS_STATE.factory.name) : ''));
        else status = 'Ditt konto saknar aktiv fabrik/roll.';
      }
      body.innerHTML = '<div class="kpi"><div>🏭</div><div><div style="font-weight:800">' + status + '</div><small class="muted">Skapa fabrik, ange kod eller administrera rollkoder för vald fabrik.</small></div></div>' +
        '<div class="factory-actions">' +
        '<button type="button" class="btn" id="btnOpenCreateFactory">Skapa ny fabrik</button>' +
        '<button type="button" class="btn secondary" id="btnOpenAccessCode">Ange behörighetskod</button>' +
        (canAdminFactory() ? '<button type="button" class="btn secondary" id="btnOpenFactoryAdmin">Rollhantering / skapa koder</button>' : '') +
        '</div>';
      document.getElementById('btnOpenCreateFactory')?.addEventListener('click', openCreateFactoryDialog);
      document.getElementById('btnOpenAccessCode')?.addEventListener('click', () => { const d=document.getElementById('btgAccessDialog'); try { d?.showModal(); } catch(_) { d?.setAttribute('open','open'); } setTimeout(()=>document.getElementById('btgAccessCodeInput')?.focus(),50); });
      document.getElementById('btnOpenFactoryAdmin')?.addEventListener('click', openFactoryAdminDialog);
    }
  }

  async function tryRpc(name, args){
    try{
      const call = window.sb.rpc(name, args || {});
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout: ' + name)), 5500));
      const { data, error } = await Promise.race([call, timeout]);
      if (error) throw error;
      return Array.isArray(data) ? data : [];
    }catch(e){ console.warn('v19.5.5 RPC misslyckades:', name, e); return []; }
  }
  async function refreshFactories(){
    if (state.loading) return;
    const u = user();
    if (!u || !window.sb){
      Object.assign(state, { loaded:true, loading:false, factories:[], selectedFactoryId:null, isSuperadmin:false });
      renderStableUi(); return;
    }
    state.loading = true;
    try{
      let rows = [];
      if (isSuperadmin()) rows = await tryRpc('btg_superadmin_all_factories');
      if (!rows.length) rows = await tryRpc('btg_list_accessible_factories');
      rows = rows.map(normFactory).filter(Boolean);
      if (isSuperadmin() && !rows.length){
        try{
          const { data, error } = await sb.from('factories').select('id,name,factory_code,join_code,active,created_at').order('created_at', { ascending:false });
          if (!error) rows = (Array.isArray(data) ? data : []).filter(x => x.active !== false).map(normFactory).filter(Boolean);
        }catch(e){ console.warn('v19.5.5 direktläsning factories misslyckades:', e); }
      }
      const seen = new Set(); rows = rows.filter(f => { const k=String(f.factory_id); if(seen.has(k)) return false; seen.add(k); return true; });
      let selected = null;
      try { selected = localStorage.getItem('btg_selected_factory_id'); } catch(_) {}
      if (!selected || !rows.some(f => String(f.factory_id) === String(selected))) selected = window.BTG_ACCESS_STATE?.profile?.factory_id || rows[0]?.factory_id || null;
      Object.assign(state, { loaded:true, loading:false, factories:rows, selectedFactoryId:selected, isSuperadmin:isSuperadmin() || rows.some(f => f.is_superadmin) });
      applySelectedAccess();
      renderStableUi();
    }finally{ state.loading = false; }
  }

  function openCreateFactoryDialog(){
    const d=document.getElementById('btgCreateFactoryDialog');
    const msg=document.getElementById('btgCreateFactoryMsg');
    if (msg){ msg.className='pill'; msg.textContent='Fabriksadminkoden visas här när fabriken har skapats.'; }
    try { d?.showModal(); } catch(_) { d?.setAttribute('open','open'); }
  }
  async function createFactory(){
    if (!window.sb || !user()) { alert('Du måste vara inloggad.'); return; }
    const btn=document.getElementById('btnCreateBtgFactory'), msg=document.getElementById('btgCreateFactoryMsg');
    const old=btn?.textContent || 'Starta fabrik'; if(btn){btn.disabled=true;btn.textContent='Skapar…';}
    if(msg){msg.className='pill';msg.textContent='Skapar fabrik och fabriksadminkod…';}
    try{
      const { data, error } = await sb.rpc('btg_create_factory_with_admin_code', {
        p_name: document.getElementById('newFactoryName')?.value.trim(),
        p_factory_code: document.getElementById('newFactoryCode')?.value.trim() || null,
        p_org_number: document.getElementById('newFactoryOrg')?.value.trim() || null,
        p_address: document.getElementById('newFactoryAddress')?.value.trim() || null,
        p_contact_name: document.getElementById('newFactoryContactName')?.value.trim() || null,
        p_contact_email: document.getElementById('newFactoryContactEmail')?.value.trim() || null,
        p_note: document.getElementById('newFactoryNote')?.value.trim() || null
      });
      if(error) throw error;
      const row=Array.isArray(data)?data[0]:data;
      if(msg){
        msg.className='admin-code-box';
        msg.innerHTML='<b>Fabriken är skapad.</b><br>Fabriksadminkod:<br><span class="generated-code">'+esc(row?.admin_code || '')+'</span><br><small class="muted">Kopiera koden och ange den under “Ange behörighetskod” för att aktivera adminåtkomst.</small><div class="toolbar" style="margin-top:.5rem"><button type="button" class="btn secondary" id="btnCopyAdminCode">Kopiera kod</button><button type="button" class="btn" id="btnUseAdminCodeNow">Ange koden nu</button></div>';
        document.getElementById('btnCopyAdminCode')?.addEventListener('click',()=>navigator.clipboard?.writeText(row?.admin_code || ''));
        document.getElementById('btnUseAdminCodeNow')?.addEventListener('click',()=>{ closeDialog('btgCreateFactoryDialog'); const d=document.getElementById('btgAccessDialog'); try{d?.showModal();}catch(_){d?.setAttribute('open','open');} const input=document.getElementById('btgAccessCodeInput'); if(input) input.value=row?.admin_code || ''; input?.focus(); });
      }
      await refreshFactories();
    }catch(e){ if(msg){msg.className='pill danger';msg.textContent=e.message || String(e);} }
    finally{ if(btn){btn.disabled=false;btn.textContent=old;} }
  }

  function openFactoryAdminDialog(){
    if (!canAdminFactory()) { alert('Endast fabriksadmin eller superadmin kan skapa rollkoder.'); return; }
    const f=selectedFactory();
    if (!f) { alert('Välj eller skapa en fabrik först.'); return; }
    const ctx=document.getElementById('btgFactoryAdminContext'); if(ctx) ctx.textContent='Fabrik: '+(f.factory_name || '—')+'. Skapa koder och dela dem med användare som ska ansluta sig.';
    const box=document.getElementById('btgGeneratedCodeBox'); if(box) box.innerHTML='';
    const d=document.getElementById('btgFactoryAdminDialog'); try{d?.showModal();}catch(_){d?.setAttribute('open','open');}
    refreshAccessCodes();
  }
  async function adminCreateAccessCode(){
    const f=selectedFactory(); if(!f || !window.sb) return;
    const btn=document.getElementById('btnAdminCreateAccessCode'), box=document.getElementById('btgGeneratedCodeBox');
    const old=btn?.textContent || 'Skapa kod'; if(btn){btn.disabled=true;btn.textContent='Skapar…';}
    try{
      const expires=document.getElementById('newAccessExpires')?.value;
      const { data, error } = await sb.rpc('btg_admin_create_access_code', {
        p_factory_id:f.factory_id,
        p_role_code:document.getElementById('newAccessRole')?.value,
        p_label:document.getElementById('newAccessLabel')?.value.trim() || null,
        p_max_uses:Number(document.getElementById('newAccessMaxUses')?.value || 1),
        p_expires_at:expires ? expires+'T23:59:59+00:00' : null
      });
      if(error) throw error;
      const row=Array.isArray(data)?data[0]:data;
      if(box) box.innerHTML='<div class="admin-code-box"><b>Ny kod skapad:</b><br><span class="generated-code">'+esc(row?.code || '')+'</span><br><small class="muted">Roll: '+esc(row?.role_code || '')+' • Max användningar: '+esc(row?.max_uses || '')+'</small><div class="toolbar" style="margin-top:.5rem"><button type="button" class="btn secondary" id="btnCopyGeneratedCode">Kopiera kod</button></div></div>';
      document.getElementById('btnCopyGeneratedCode')?.addEventListener('click',()=>navigator.clipboard?.writeText(row?.code || ''));
      const lbl=document.getElementById('newAccessLabel'); if(lbl) lbl.value='';
      await refreshAccessCodes();
    }catch(e){ if(box) box.innerHTML='<div class="pill danger">'+esc(e.message || String(e))+'</div>'; }
    finally{ if(btn){btn.disabled=false;btn.textContent=old;} }
  }
  async function refreshAccessCodes(){
    const f=selectedFactory(); const tbody=document.querySelector('#btgAccessCodesTable tbody');
    if(!f || !tbody || !window.sb) return;
    tbody.innerHTML='<tr><td colspan="6">Laddar…</td></tr>';
    try{
      const { data, error } = await sb.rpc('btg_admin_list_access_codes', { p_factory_id:f.factory_id });
      if(error) throw error;
      const rows=Array.isArray(data)?data:[];
      tbody.innerHTML=rows.length ? rows.map(r=>'<tr><td><b>'+esc(r.code)+'</b></td><td>'+esc(r.role_code)+'</td><td>'+esc(r.label || '')+'</td><td>'+esc(r.used_count)+' / '+esc(r.max_uses)+'</td><td>'+esc(fmtDate(r.expires_at))+'</td><td>'+(r.active?'<span class="pill ok">Aktiv</span>':'<span class="pill danger">Inaktiv</span>')+'</td></tr>').join('') : '<tr><td colspan="6">Inga koder skapade ännu.</td></tr>';
    }catch(e){ tbody.innerHTML='<tr><td colspan="6"><span class="pill danger">'+esc(e.message || String(e))+'</span></td></tr>'; }
  }

  function patchCoreHooks(){
    if (window.__BTG_V1955_CORE_HOOKED) return;
    window.__BTG_V1955_CORE_HOOKED = true;
    const oldApply = window.applyAccessState;
    window.applyAccessState = function(){
      if (isSuperadmin()) { applySelectedAccess(); renderStableUi(); return window.BTG_ACCESS_STATE; }
      const res = typeof oldApply === 'function' ? oldApply.apply(this, arguments) : undefined;
      renderStableUi();
      return res;
    };
    const oldLoad = window.loadAccessState;
    window.loadAccessState = async function(){
      if (isSuperadmin()) { await refreshFactories(); return window.BTG_ACCESS_STATE; }
      const res = typeof oldLoad === 'function' ? await oldLoad.apply(this, arguments) : window.BTG_ACCESS_STATE;
      await refreshFactories();
      return res;
    };
  }

  function bindButtons(){
    if (window.__BTG_V1955_BUTTONS_BOUND) return;
    window.__BTG_V1955_BUTTONS_BOUND = true;
    document.getElementById('btnCloseCreateFactory')?.addEventListener('click',()=>closeDialog('btgCreateFactoryDialog'));
    document.getElementById('btnCreateBtgFactory')?.addEventListener('click',createFactory);
    document.getElementById('btnCloseFactoryAdmin')?.addEventListener('click',()=>closeDialog('btgFactoryAdminDialog'));
    document.getElementById('btnAdminCreateAccessCode')?.addEventListener('click',adminCreateAccessCode);
    document.getElementById('btnRefreshAccessCodes')?.addEventListener('click',refreshAccessCodes);
  }
  function init(){
    ensureSetupCard(); ensureSelector(); bindButtons(); patchCoreHooks();
    applySelectedAccess(); renderStableUi(); refreshFactories();
    setTimeout(()=>{ applySelectedAccess(); renderStableUi(); refreshFactories(); }, 900);
    try { window.sb?.auth?.onAuthStateChange?.(() => setTimeout(()=>{ applySelectedAccess(); renderStableUi(); refreshFactories(); }, 600)); } catch(_) {}
  }

  window.loadFactoryAdminState = refreshFactories;
  window.openFactoryAdminDialog = openFactoryAdminDialog;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
