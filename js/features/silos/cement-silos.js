/***********************************************************
 * v19.5.31 – FABRIKSADMIN: CEMENT & SILOR
 *
 * Separat modul för modulär HTML-version.
 * - Skapa/redigera silos
 * - Koppla silo till material
 * - Registrera materialleverans som dagbokslik transaktion
 * - Beräkna förbrukning automatiskt från batch + recept
 * - Visa kg, procent, 3D-silokort och enkel trend
 ***********************************************************/
(function(){
  if (window.__BTG_V19531_CEMENT_SILOS) return;
  window.__BTG_V19531_CEMENT_SILOS = true;

  const TAB = 'cement_silos';
  const state = { silos: [], tx: [], materials: [], recipes: [], batches: [], analysis: [], error: '', loadedAt: null };

  function esc(v){ if (typeof escapeHtml === 'function') return escapeHtml(v); return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function num(v, fb=0){ const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : fb; }
  function round(v, d=0){ const n = num(v, 0); return d ? n.toFixed(d).replace('.', ',') : Math.round(n).toLocaleString('sv-SE'); }
  function todayISO(){ const d = new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10); }
  function localISO(v){ try { if(!v) return ''; const d = new Date(v); if(Number.isNaN(d.getTime())) return String(v).slice(0,10); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10); } catch { return String(v||'').slice(0,10); } }
  function db(){ try { return window.sb || sb || null; } catch { return window.sb || null; } }
  function currentUser(){ try { return CURRENT_USER || window.CURRENT_USER || null; } catch { return window.CURRENT_USER || null; } }
  function activeFactoryId(){ try { return window.BTG_FACTORY_ADMIN_STATE?.selectedFactoryId || window.BTG_ACCESS_STATE?.profile?.factory_id || window.BTG_ACCESS_STATE?.factory?.id || window.BTG_ACCESS_STATE?.factory?.factory_id || localStorage.getItem('btg_selected_factory_id') || ''; } catch { return ''; } }
  function activeFactoryName(){ try { return window.BTG_ACCESS_STATE?.factory?.name || window.BTG_FACTORY_ADMIN_STATE?.selectedFactoryName || ''; } catch { return ''; } }
  function roleCode(){ try { return String(window.BTG_ACCESS_STATE?.profile?.role_code || window.BTG_ACCESS_STATE?.profile?.role || '').toUpperCase(); } catch { return ''; } }
  function isFactoryAdmin(){ const r = roleCode(); return r === 'ADMIN' || r === 'SUPERADMIN' || r === 'FABRIKSADMIN' || !!window.BTG_ACCESS_STATE?.permissions?.role_admin; }
  function allow(){ try { if(!window.BTG_ACCESS_STATE) return; if(isFactoryAdmin()){ window.BTG_ACCESS_STATE.permissions = Object.assign({}, window.BTG_ACCESS_STATE.permissions||{}, { [TAB]: true }); if(window.BTG_ACCESS_STATE.profile) window.BTG_ACCESS_STATE.profile.permissions = Object.assign({}, window.BTG_ACCESS_STATE.profile.permissions||{}, { [TAB]: true }); } } catch(_){} }
  function getApp(row){ return row?.app_data || {}; }
  function matKey(v){ return String(v || '').trim().toLowerCase(); }
  function sameMaterial(a,b){ return matKey(a) && matKey(a) === matKey(b); }
  function materialIdOf(m){ return String(m?.cloudId || m?.id || m?.material_id || '').trim(); }

  async function getFactoryUserIds(fid){
    const s = db(), u = currentUser();
    if (!s || !u) return [];
    if (!fid) return [u.id];
    try {
      const { data, error } = await s.rpc('btg_factory_user_ids', { p_factory_id: fid });
      if (error) throw error;
      const ids = Array.from(new Set((data || []).map(r => String(r.user_id || r.uid || r)).filter(Boolean)));
      return ids.length ? ids : [u.id];
    } catch(e) {
      console.warn('Material & Silor: kunde inte hämta fabriksanvändare, använder aktuell användare.', e);
      return [u.id];
    }
  }
  async function queryByUsers(table, select, userIds, orderCol){
    const s = db(); if (!s || !userIds.length) return { data: [], error: null };
    let q = s.from(table).select(select);
    q = userIds.length === 1 ? q.eq('user_id', userIds[0]) : q.in('user_id', userIds);
    if (orderCol) q = q.order(orderCol, { ascending:false });
    return await q;
  }
  async function queryMaterialsAll(userIds, fid){
    const s = db(); if (!s) return { data: [], error: null };
    const rows = [];
    let firstError = null;

    async function safeSelect(selectText, apply){
      try{
        let q = s.from('materials').select(selectText);
        if(apply) q = apply(q);
        const res = await q;
        if(res?.data) rows.push(...res.data);
        if(res?.error) firstError = firstError || res.error;
        return res;
      }catch(e){
        firstError = firstError || e;
        return { data: [], error: e };
      }
    }

    // v19.5.58: välj bara kolumner som finns i äldre material-schema.
    // Din tabell saknar materials.factory_id, därför får vi inte välja eller filtrera på den kolumnen.
    const baseSelect = 'id,name,type,ef,note,app_data,created_at,user_id';

    // 1. Material kopplat till användare/fabriksanvändare
    if(userIds && userIds.length){
      await safeSelect(baseSelect, q => userIds.length === 1 ? q.eq('user_id', userIds[0]) : q.in('user_id', userIds));
    }

    // 2. Ingen global fallback mot hela materialtabellen här.
    // Det minskar risken att materialnamn från andra fabriker visas om materials saknar factory_id.
    // Extra material kompletteras istället längre ned från coreMaterialsFallback() och receptfallback.

    return { data: mergeMaterials(rows), error: null };
  }

  function normalizeSilo(row){ const app = getApp(row); return {
    id: row.id || app.id || '', cloudId: row.id || app.cloudId || '', userId: row.user_id || app.userId || '', factoryId: row.factory_id || app.factoryId || app.factory_id || '',
    name: row.name || app.name || '', materialId: row.material_id || app.materialId || app.material_id || '', materialName: row.material_name || app.materialName || app.material_name || '',
    maxCapacityKg: num(row.max_capacity_kg ?? app.maxCapacityKg ?? app.max_capacity_kg, 0), startLevelKg: num(row.start_level_kg ?? app.startLevelKg ?? app.start_level_kg, 0), currentLevelKg: num(row.current_level_kg ?? app.currentLevelKg ?? app.current_level_kg, 0),
    lowWarnPct: num(row.low_warn_pct ?? app.lowWarnPct ?? 20, 20), criticalWarnPct: num(row.critical_warn_pct ?? app.criticalWarnPct ?? 10, 10), note: row.note || app.note || '', active: row.active !== false, createdAt: row.created_at || app.createdAt || ''
  }; }
  function normalizeTx(row){ const app = getApp(row); return {
    id: row.id || app.id || '', siloId: row.silo_id || app.siloId || '', factoryId: row.factory_id || app.factoryId || '', type: row.type || app.type || 'in', source: row.source || app.source || 'manual',
    materialId: row.material_id || app.materialId || '', materialName: row.material_name || app.materialName || '', amountKg: Math.abs(num(row.amount_kg ?? app.amountKg, 0)), note: row.note || app.note || '', createdAt: row.created_at || app.createdAt || ''
  }; }
  function normalizeMaterial(row){ const app = getApp(row); return { ...app, id: row.id || app.id || '', cloudId: row.id || app.cloudId || '', name: row.name || app.name || '', type: row.type || app.type || '', factoryId: row.factory_id || app.factoryId || app.factory_id || '' }; }
  function normalizeRecipe(row){ const app = getApp(row); return { ...app, id: row.id || app.id || '', cloudId: row.id || app.cloudId || '', name: row.name || app.name || '', materials: Array.isArray(app.materials) ? app.materials : [], perM3: app.perM3 !== false, satsVolym: app.satsVolym || null, factoryId: row.factory_id || app.factoryId || app.factory_id || '' }; }
  function normalizeBatch(row){ const app = getApp(row); return { ...app, id: row.id || app.id || '', cloudId: row.id || app.cloudId || '', recipeId: app.recipeId || row.recipe_id || '', recipeCloudId: row.recipe_id || app.recipeCloudId || '', recipeName: app.recipeName || app.recipe_name || '', amount: num(app.amount ?? row.amount_m3, 0), dateTime: app.dateTime || row.datetime || row.created_at || '', factoryId: row.factory_id || app.factoryId || app.factory_id || '' }; }
  function belongsSoft(item, fid){ if(!fid) return true; const f = String(item?.factoryId || '').trim(); return !f || f === String(fid); }

  function normalizeLooseMaterial(m){
    if (!m || typeof m !== 'object') return null;
    const name = m.name || m.materialName || m.material_name || '';
    if (!String(name).trim()) return null;
    return {
      id: m.cloudId || m.id || m.material_id || m.materialId || name,
      cloudId: m.cloudId || m.id || m.material_id || m.materialId || '',
      name,
      type: m.type || m.materialType || m.material_type || '',
      factoryId: m.factoryId || m.factory_id || ''
    };
  }
  function coreMaterialsFallback(){
    try { if (Array.isArray(MATERIALS)) return MATERIALS.map(normalizeLooseMaterial).filter(Boolean); } catch(_) {}
    try {
      const raw = JSON.parse(localStorage.getItem('bk_materials_v1') || '[]');
      return Array.isArray(raw) ? raw.map(normalizeLooseMaterial).filter(Boolean) : [];
    } catch(_) { return []; }
  }
  function recipeMaterialFallback(){
    const out = [];
    for (const r of state.recipes || []){
      for (const m of (Array.isArray(r.materials) ? r.materials : [])){
        const name = String(m.name || m.materialName || '').trim();
        if (name){
          out.push(normalizeLooseMaterial({
            id:m.materialId || m.material_id || m.cloudId || m.id || name,
            name,
            type:m.type || m.materialType || m.material_type || 'Receptmaterial',
            factoryId:r.factoryId || ''
          }));
        }
      }
    }
    return out.filter(Boolean);
  }
  function mergeMaterials(list){
    const map = new Map();
    for (const raw of list || []){
      const m = normalizeLooseMaterial(raw);
      if(!m || !String(m.name || '').trim()) continue;

      // v2.0: deduplicera hårdare.
      // Samma material kan komma från Supabase, recept och lokal app samtidigt.
      // Vi nycklar först på normaliserat namn + typ, och använder ID bara som extra data.
      const cleanName = String(m.name || '').trim().toLowerCase().replace(/\s+/g,' ');
      const cleanType = String(m.type || '').trim().toLowerCase().replace(/\s+/g,' ');
      const key = `${cleanName}|${cleanType}`;

      const prev = map.get(key);
      if(!prev){
        map.set(key,m);
        continue;
      }

      map.set(key,{
        ...prev,
        ...m,
        id: prev.id || m.id,
        cloudId: prev.cloudId || m.cloudId,
        userId: prev.userId || m.userId,
        factoryId: prev.factoryId || m.factoryId,
        type: prev.type || m.type,
        name: prev.name || m.name
      });
    }
    return Array.from(map.values()).sort((a,b)=>String(a.name).localeCompare(String(b.name),'sv'));
  }
  function isMaterialMaterial(m){
    // v19.5.57: Alla material ska kunna väljas till silo.
    return !!(m && String(m.name || '').trim());
  }
  function allMaterialOptions(){
    return mergeMaterials([...(state.materials||[]), ...coreMaterialsFallback(), ...recipeMaterialFallback()]);
  }
  function materialOptions(){
    // v2.0: visa alla material, men utan dubletter.
    const seen = new Set();
    const all = allMaterialOptions().filter(m=>{
      const name = String(m.name || '').trim().toLowerCase().replace(/\s+/g,' ');
      const type = String(m.type || '').trim().toLowerCase().replace(/\s+/g,' ');
      const key = `${name}|${type}`;
      if(!name || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if(!all.length) return '<option value="">Inga material hittades</option>';
    return all.map(m => `<option value="${esc(materialIdOf(m) || m.name)}" data-name="${esc(m.name)}" data-type="${esc(m.type||'')}">${esc(m.name)}${m.type ? ' – ' + esc(m.type) : ''}</option>`).join('');
  }
  function findRecipeForBatch(b){ return state.recipes.find(r => String(r.cloudId||r.id) === String(b.recipeCloudId||b.recipeId) || String(r.id) === String(b.recipeId) || String(r.name) === String(b.recipeName)); }
  function materialKgInRecipe(recipe, silo){
    // v19.5.56: generell matchning mot valt material.
    // Tidigare drogs bara receptposter med type === cement.
    const mats = Array.isArray(recipe?.materials) ? recipe.materials : [];
    let kg = 0;
    for (const m of mats){
      const idMatch = silo.materialId && (String(m.materialId || m.material_id || m.cloudId || m.id || '') === String(silo.materialId));
      const nameMatch = sameMaterial(m.name || m.materialName, silo.materialName);
      if (idMatch || nameMatch) kg += num(m.amount ?? m.kg ?? m.quantity ?? m.value, 0);
    }
    return kg;
  }
  function batchConsumptionForSilo(b, silo){
    const r = findRecipeForBatch(b); if (!r) return 0;
    const kgPerUnit = materialKgInRecipe(r, silo); if (!kgPerUnit) return 0;
    const amount = num(b.amount, 0);
    if (r.perM3 === false && num(r.satsVolym,0) > 0) return kgPerUnit * (amount / num(r.satsVolym,1));
    return kgPerUnit * amount;
  }
  function analyzeSilo(silo){
    const ins = state.tx.filter(t => String(t.siloId) === String(silo.id) && t.type === 'in').reduce((sum,t)=>sum+num(t.amountKg,0),0);
    const adjust = state.tx.filter(t => String(t.siloId) === String(silo.id) && t.type === 'adjust').reduce((sum,t)=>sum+num(t.amountKg,0),0);
    const manualOut = state.tx.filter(t => String(t.siloId) === String(silo.id) && t.type === 'out').reduce((sum,t)=>sum+num(t.amountKg,0),0);
    const batchRows = [];
    let batchOut = 0;
    for (const b of state.batches){
      const kg = batchConsumptionForSilo(b, silo);
      if (kg > 0){ batchOut += kg; batchRows.push({ date: localISO(b.dateTime), kg, batch: b }); }
    }
    const current = Math.max(0, num(silo.startLevelKg,0) + ins + adjust - manualOut - batchOut);
    const pct = silo.maxCapacityKg > 0 ? Math.max(0, Math.min(100, current / silo.maxCapacityKg * 100)) : 0;
    const status = pct <= silo.criticalWarnPct ? 'crit' : pct <= silo.lowWarnPct ? 'warn' : 'ok';
    return { silo, inKg: ins, adjustKg: adjust, manualOutKg: manualOut, batchOutKg: batchOut, currentKg: current, pct, status, batchRows };
  }
  function analyzeAll(){ state.analysis = state.silos.filter(s=>s.active !== false).map(analyzeSilo); return state.analysis; }

  function ensureUI(){
    allow();
    const nav = document.querySelector('header .main-nav') || document.querySelector('.main-nav') || document.querySelector('nav.toolbar');
    if (nav && !document.getElementById('btnMaterialSilos')){
      const btn = document.createElement('button');
      btn.className='tab-btn cement-nav-btn';
      btn.type='button';
      btn.id='btnMaterialSilos';
      btn.dataset.tab=TAB;
      btn.textContent='Material & Silor';
      btn.title='Fabriksadmin: cementlager, silos och förbrukning';
      btn.style.display = '';
      btn.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); openTab(); });
      const before = nav.querySelector('#btnSettings') || nav.querySelector('#btnNordcert');
      if (before) nav.insertBefore(btn, before); else nav.appendChild(btn);
    }
    const main = document.querySelector('main.container') || document.querySelector('main');
    if (!main || document.getElementById('tab-cement_silos')) return;
    const sec = document.createElement('section'); sec.id='tab-cement_silos'; sec.className='grid'; sec.style.display='none';
    sec.innerHTML = `
      <div class="card"><div class="cement-silos-header"><div><h3>Material & Silor</h3><p class="pill">Fabriksadmin: silonivåer beräknas från startsaldo + materialleveranser - receptförbrukning i satser.</p><div class="cement-small" id="cementSilosFactory"></div></div><div class="toolbar" style="justify-content:flex-end"><button class="btn secondary" id="btnMaterialRefresh" type="button">Uppdatera</button><button class="btn secondary" id="btnMaterialDelivery" type="button">Registrera materialleverans</button><button class="btn" id="btnMaterialAddSilo" type="button">Ny silo</button></div></div></div>
      <div class="cement-silos-kpis" id="cementSilosKpis"></div>
      <div class="card"><h3>Siloöversikt</h3><div id="cementSilosGrid" class="cement-silo-grid"></div></div>
      <div class="card"><h3>Enkel trendsektion</h3><p class="cement-small">Visar senaste förbrukningar och inleveranser från registrerade transaktioner och satser.</p><div id="cementSilosTrend"></div></div>
      <div class="card"><h3>Senaste rörelser</h3><div id="cementSilosMovements"></div></div>
    `;
    main.appendChild(sec);
    document.getElementById('btnMaterialRefresh')?.addEventListener('click', loadAndRender);
    document.getElementById('btnMaterialAddSilo')?.addEventListener('click', () => openSiloDialog());
    document.getElementById('btnMaterialDelivery')?.addEventListener('click', () => openDeliveryDialog());
    ensureDashboardWidget();
    ensureDialogs();
  }

  function ensureDashboardWidget(){
    const dash = document.getElementById('tab-dashboard');
    if (!dash || document.getElementById('cementDashboardCard')) return;
    const card = document.createElement('div');
    card.className = 'card cement-dashboard-card';
    card.id = 'cementDashboardCard';
    card.innerHTML = `
      <div class="cement-dashboard-head">
        <div>
          <h3>Material & Silor</h3>
          <p class="cement-small">Visar aktuell nivå i aktiva silos för vald fabrik. Nivån räknas från startsaldo + leveranser - receptförbrukning.</p>
        </div>
        <div class="toolbar" style="justify-content:flex-end">
          <button class="btn secondary" id="btnMaterialDashboardRefresh" type="button">Uppdatera</button>
          <button class="btn" id="btnOpenMaterialSilosFromDashboard" type="button">Öppna Material & Silor</button>
        </div>
      </div>
      <div id="cementDashboardSummary" class="cement-dashboard-summary"></div>
      <div id="cementDashboardGrid" class="cement-dashboard-grid"></div>
    `;
    const after = document.getElementById('cloudStatusCard') || document.getElementById('quickstartCard');
    if (after && after.parentNode) after.parentNode.insertBefore(card, after.nextSibling); else dash.appendChild(card);
    document.getElementById('btnOpenMaterialSilosFromDashboard')?.addEventListener('click', openTab);
    document.getElementById('btnMaterialDashboardRefresh')?.addEventListener('click', loadAndRender);
  }

  function ensureDialogs(){
    if (document.getElementById('cementSiloDialog')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <dialog id="cementSiloDialog" class="cement-dialog"><div class="dialog-inner"><div class="dialog-title"><h3 id="cementSiloDialogTitle">Ny silo</h3><button class="btn secondary" type="button" data-close-cement-dialog>Stäng</button></div><form id="cementSiloForm"><input type="hidden" id="cementSiloId"><div class="cement-form-grid"><div><label>Silonamn</label><input id="cementSiloName" required placeholder="Silo 1"></div><div><label>Material/material</label><select id="cementSiloMaterial" required></select></div><div><label>Maxkapacitet kg</label><input id="cementSiloMax" type="number" step="1" min="0" required></div><div><label>Startsaldo kg</label><input id="cementSiloStart" type="number" step="1" min="0"></div><div><label>Varning %</label><input id="cementSiloWarn" type="number" step="1" min="0" max="100" value="20"></div><div><label>Kritiskt %</label><input id="cementSiloCrit" type="number" step="1" min="0" max="100" value="10"></div></div><div style="margin-top:12px"><label>Notering</label><input id="cementSiloNote" placeholder="valfritt"></div><div class="toolbar" style="justify-content:flex-end;margin-top:14px"><button class="btn secondary" type="button" data-close-cement-dialog>Avbryt</button><button class="btn" type="submit">Spara silo</button></div></form></div></dialog>
      <dialog id="cementDeliveryDialog" class="cement-dialog"><div class="dialog-inner"><div class="dialog-title"><h3>Registrera materialleverans</h3><button class="btn secondary" type="button" data-close-cement-delivery>Stäng</button></div><form id="cementDeliveryForm"><div class="cement-form-grid"><div><label>Datum</label><input id="cementDeliveryDate" type="date" required></div><div><label>Silo</label><select id="cementDeliverySilo" required></select></div><div><label>Mängd in kg</label><input id="cementDeliveryKg" type="number" min="0" step="1" required></div><div><label>Följesedel / kommentar</label><input id="cementDeliveryNote" placeholder="valfritt"></div></div><p class="cement-small">Leveransen sparas som silotransaktion och noteras i app_data så den kan visas som dagbokshändelse.</p><div class="toolbar" style="justify-content:flex-end;margin-top:14px"><button class="btn secondary" type="button" data-close-cement-delivery>Avbryt</button><button class="btn" type="submit">Spara leverans</button></div></form></div></dialog>`);
    document.querySelectorAll('[data-close-cement-dialog]').forEach(b=>b.addEventListener('click',()=>document.getElementById('cementSiloDialog')?.close()));
    document.querySelectorAll('[data-close-cement-delivery]').forEach(b=>b.addEventListener('click',()=>document.getElementById('cementDeliveryDialog')?.close()));
    document.getElementById('cementSiloForm')?.addEventListener('submit', saveSilo);
    document.getElementById('cementDeliveryForm')?.addEventListener('submit', saveDelivery);
  }
  function showTab(tab){
    document.querySelectorAll('main section[id^="tab-"]').forEach(s => { s.style.display = s.id === `tab-${tab}` ? '' : 'none'; });
    document.querySelectorAll('.tab-btn,[data-tab]').forEach(b => { if (b.dataset?.tab) b.classList.toggle('active', b.dataset.tab === tab); });
  }
  async function openTab(){ ensureUI(); showTab(TAB); await loadAndRender(); }

  async function loadData(){
    state.error = '';
    const s = db(), u = currentUser();
    if (!s || !u) { state.error = 'Logga in mot Supabase för att använda Material & Silor.'; return; }
    const fid = activeFactoryId();
    const ids = await getFactoryUserIds(fid);
    const [silosRes, txRes, matRes, recRes, batRes] = await Promise.all([
      queryByUsers('cement_silos', '*', ids, 'created_at'),
      queryByUsers('cement_silo_transactions', '*', ids, 'created_at'),
      queryMaterialsAll(ids, fid),
      queryByUsers('recipes', 'id,name,strength,vct,vct_eq,air_req,app_data,created_at,user_id', ids, 'created_at'),
      queryByUsers('batches', 'id,recipe_id,amount_m3,datetime,gwp,app_data,created_at,user_id', ids, 'datetime')
    ]);
    const firstErr = [silosRes,txRes,recRes,batRes].find(r => r?.error)?.error;
    if (firstErr) throw firstErr;
    state.silos = (silosRes.data||[]).map(normalizeSilo).filter(x=>belongsSoft(x,fid));
    state.tx = (txRes.data||[]).map(normalizeTx).filter(x=>belongsSoft(x,fid));
    state.materials = (matRes.data||[]).map(normalizeMaterial).filter(x=>belongsSoft(x,fid));
    state.recipes = (recRes.data||[]).map(normalizeRecipe).filter(x=>belongsSoft(x,fid));
    state.batches = (batRes.data||[]).map(normalizeBatch).filter(x=>belongsSoft(x,fid));
    // Materiallistan i kärnappen är den källa användaren ser. Slå därför ihop Supabase-raden,
    // kärnappens MATERIALS och cement som redan förekommer i recept. Då fungerar silokoppling
    // även när äldre material saknar factory_id/type i molnraden.
    state.materials = mergeMaterials([...(state.materials||[]), ...coreMaterialsFallback(), ...recipeMaterialFallback()]).filter(x=>belongsSoft(x,fid));
    state.loadedAt = new Date();
    analyzeAll();
  }
  async function loadAndRender(){ try { await loadData(); } catch(e){ console.error(e); state.error = 'Kunde inte ladda Material & Silor. Har du kört SQL-filen 19_5_31_cement_silos.sql i Supabase? ' + (e.message || ''); } render(); }

  function render(){
    ensureUI(); allow();
    const f = activeFactoryName() || activeFactoryId() || 'Aktiv fabrik';
    const factoryEl = document.getElementById('cementSilosFactory'); if(factoryEl) factoryEl.textContent = `Fabrik: ${f}${state.loadedAt ? ' • Uppdaterad ' + state.loadedAt.toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'}) : ''}`;
    if (state.error){ const grid = document.getElementById('cementSilosGrid'); if(grid) grid.innerHTML = `<div class="cement-empty">${esc(state.error)}</div>`; renderKpis(); return; }
    renderKpis(); renderSiloGrid(); renderTrend(); renderMovements();
  }
  function renderKpis(){
    const a = state.analysis || [];
    const totalCap = a.reduce((s,x)=>s+x.silo.maxCapacityKg,0), totalNow = a.reduce((s,x)=>s+x.currentKg,0), totalIn = a.reduce((s,x)=>s+x.inKg,0), totalOut = a.reduce((s,x)=>s+x.batchOutKg+x.manualOutKg,0);
    const pct = totalCap ? totalNow/totalCap*100 : 0;
    const el = document.getElementById('cementSilosKpis');
    if(el) el.innerHTML = [`<div class="cement-kpi"><div class="label">Totalt lager</div><div class="value">${round(totalNow)} kg</div><div class="cement-small">${round(pct,1)} % av kapacitet</div></div>`, `<div class="cement-kpi"><div class="label">Total kapacitet</div><div class="value">${round(totalCap)} kg</div><div class="cement-small">${a.length} aktiva silos</div></div>`, `<div class="cement-kpi"><div class="label">Inlevererat</div><div class="value">${round(totalIn)} kg</div><div class="cement-small">registrerade leveranser</div></div>`, `<div class="cement-kpi"><div class="label">Förbrukat</div><div class="value">${round(totalOut)} kg</div><div class="cement-small">beräknat från satser</div></div>`].join('');
    renderDashboardSilos(totalCap, totalNow, totalIn, totalOut, pct);
  }

  function renderDashboardSilos(totalCap, totalNow, totalIn, totalOut, pct){
    ensureDashboardWidget();
    const summary = document.getElementById('cementDashboardSummary');
    const grid = document.getElementById('cementDashboardGrid');
    if (!summary || !grid) return;
    if (state.error){
      summary.innerHTML = '';
      grid.innerHTML = `<div class="cement-empty">${esc(state.error)}</div>`;
      return;
    }
    const a = (state.analysis || []).slice().sort((x,y)=>x.pct-y.pct);
    summary.innerHTML = [`<div class="mini-kpi"><span class="cement-small">Totalt lager</span><b>${round(totalNow)} kg</b><span class="cement-small">${round(pct,1)} %</span></div>`, `<div class="mini-kpi"><span class="cement-small">Kapacitet</span><b>${round(totalCap)} kg</b><span class="cement-small">${a.length} silos</span></div>`, `<div class="mini-kpi"><span class="cement-small">Inlevererat</span><b>${round(totalIn)} kg</b></div>`, `<div class="mini-kpi"><span class="cement-small">Förbrukat</span><b>${round(totalOut)} kg</b></div>`].join('');
    if (!a.length){
      grid.innerHTML = `<div class="cement-empty"><b>Inga silos skapade ännu.</b><br>Klicka på Öppna Material & Silor för att skapa första silon.</div>`;
      return;
    }
    grid.innerHTML = a.slice(0,4).map(x => {
      const pctRound = Math.round(x.pct);
      const fillCls = x.status === 'crit' ? 'crit' : x.status === 'warn' ? 'warn' : '';
      const label = x.status === 'crit' ? 'Kritiskt' : x.status === 'warn' ? 'Låg nivå' : 'OK';
      return `<div class="cement-silo-card ${fillCls}"><h4>${esc(x.silo.name)}</h4><div class="sub">${esc(x.silo.materialName)}</div><div class="silo-visual-wrap"><div class="silo-3d" style="--fill:${pctRound}%"><div class="silo-cap"></div><div class="silo-body"><div class="silo-fill ${fillCls}"></div></div><div class="silo-leg l1"></div><div class="silo-leg l2"></div></div><div><div class="silo-percent">${pctRound}%</div><div class="silo-kg">${round(x.currentKg)} / ${round(x.silo.maxCapacityKg)} kg</div><span class="cement-status ${fillCls}">${label}</span></div></div><div class="silo-meta">In: <b>${round(x.inKg)} kg</b> • Avräknat: <b>${round(x.batchOutKg+x.manualOutKg)} kg</b></div></div>`;
    }).join('');
    try {
      document.dispatchEvent(new CustomEvent('btg:cement-silos-updated', { detail: { analysis: state.analysis || [] } }));
      window.BTG_DASHBOARD_CUSTOMIZER?.mountShell?.();
    } catch(_){}
  }

  function renderSiloGrid(){
    const el = document.getElementById('cementSilosGrid'); if(!el) return;
    const a = state.analysis || [];
    if (!a.length){ el.innerHTML = `<div class="cement-empty"><b>Inga silos ännu.</b><br>Skapa en silo och koppla den till ett material för att börja följa lager i kg och procent.</div>`; return; }
    el.innerHTML = a.map(x => {
      const pct = Math.round(x.pct); const fillCls = x.status === 'crit' ? 'crit' : x.status === 'warn' ? 'warn' : ''; const label = x.status === 'crit' ? 'Kritiskt' : x.status === 'warn' ? 'Låg nivå' : 'OK';
      return `<div class="cement-silo-card ${fillCls}"><h4>${esc(x.silo.name)}</h4><div class="sub">${esc(x.silo.materialName)}</div><div class="silo-visual-wrap"><div class="silo-3d" style="--fill:${pct}%"><div class="silo-cap"></div><div class="silo-body"><div class="silo-fill ${fillCls}"></div></div><div class="silo-leg l1"></div><div class="silo-leg l2"></div></div><div><div class="silo-percent">${pct}%</div><div class="silo-kg">${round(x.currentKg)} / ${round(x.silo.maxCapacityKg)} kg</div><span class="cement-status ${fillCls}">${label}</span></div></div><div class="silo-meta"><div>Startsaldo: <b>${round(x.silo.startLevelKg)} kg</b></div><div>In: <b>${round(x.inKg)} kg</b> • Avräknat: <b>${round(x.batchOutKg+x.manualOutKg)} kg</b></div><div>Varning: ${round(x.silo.lowWarnPct)} % • Kritiskt: ${round(x.silo.criticalWarnPct)} %</div></div><div class="silo-actions"><button class="btn secondary" type="button" data-edit-silo="${esc(x.silo.id)}">Redigera</button><button class="btn secondary" type="button" data-delivery-silo="${esc(x.silo.id)}">Leverans</button><button class="btn danger" type="button" data-delete-silo="${esc(x.silo.id)}">Ta bort</button></div></div>`;
    }).join('');
    el.querySelectorAll('[data-edit-silo]').forEach(b=>b.addEventListener('click',()=>openSiloDialog(state.silos.find(s=>String(s.id)===String(b.dataset.editSilo)))));
    el.querySelectorAll('[data-delivery-silo]').forEach(b=>b.addEventListener('click',()=>openDeliveryDialog(b.dataset.deliverySilo)));
    el.querySelectorAll('[data-delete-silo]').forEach(b=>b.addEventListener('click',()=>deleteSilo(b.dataset.deleteSilo)));
  }
  function renderTrend(){
    const el = document.getElementById('cementSilosTrend'); if(!el) return;
    const rows = [];
    for (const x of state.analysis || []){
      x.batchRows.slice(0,14).forEach(r => rows.push({ date:r.date, kg:r.kg, type:'out', label:x.silo.name }));
      state.tx.filter(t=>String(t.siloId)===String(x.silo.id) && t.type==='in').slice(0,14).forEach(t=>rows.push({date:localISO(t.createdAt),kg:t.amountKg,type:'in',label:x.silo.name}));
    }
    rows.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    const last = rows.slice(-14); const maxv = Math.max(1, ...last.map(r=>r.kg));
    el.innerHTML = last.length ? `<div class="cement-trend-bars">${last.map(r=>`<div class="bar ${r.type}" style="height:${Math.max(4, r.kg/maxv*110)}px" title="${esc(r.date)} ${esc(r.label)} ${r.type==='in'?'in':'ut'} ${round(r.kg)} kg"></div>`).join('')}</div><div class="cement-small">Grön = inleverans, orange/blå = förbrukning. Håll musen över staplarna för detaljer.</div>` : `<div class="cement-empty">Ingen trenddata ännu. Lägg till leverans eller skapa satser med recept som innehåller valt cement.</div>`;
  }
  function renderMovements(){
    const el = document.getElementById('cementSilosMovements'); if(!el) return;
    const manual = state.tx.map(t => ({ date: t.createdAt, type: t.type === 'in' ? 'Inleverans' : t.type === 'adjust' ? 'Justering' : 'Manuell ut', silo: state.silos.find(s=>String(s.id)===String(t.siloId))?.name || '', material: t.materialName, kg: t.amountKg, note:t.note }));
    const derived = [];
    for (const x of state.analysis || []) x.batchRows.slice(0,30).forEach(r=>derived.push({ date:r.batch.dateTime, type:'Batchförbrukning', silo:x.silo.name, material:x.silo.materialName, kg:r.kg, note:r.batch.recipeName||'' }));
    const rows = manual.concat(derived).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,25);
    el.innerHTML = rows.length ? `<table class="cement-table"><thead><tr><th>Datum</th><th>Typ</th><th>Silo</th><th>Material</th><th>Kg</th><th>Notering</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(localISO(r.date))}</td><td>${esc(r.type)}</td><td>${esc(r.silo)}</td><td>${esc(r.material)}</td><td>${round(r.kg)}</td><td>${esc(r.note)}</td></tr>`).join('')}</tbody></table>` : `<div class="cement-empty">Inga rörelser ännu.</div>`;
  }
  function openSiloDialog(silo){
    ensureDialogs();
    const sel = document.getElementById('cementSiloMaterial');
    sel.innerHTML = `<option value="">— välj material —</option>${materialOptions()}`;
    document.getElementById('cementSiloDialogTitle').textContent = silo ? 'Redigera silo' : 'Ny silo';
    document.getElementById('cementSiloId').value = silo?.id || '';
    document.getElementById('cementSiloName').value = silo?.name || '';
    document.getElementById('cementSiloMaterial').value = silo?.materialId || '';
    if (silo?.materialId && !sel.value) sel.insertAdjacentHTML('beforeend', `<option value="${esc(silo.materialId)}" data-name="${esc(silo.materialName)}">${esc(silo.materialName)}</option>`), sel.value = silo.materialId;
    document.getElementById('cementSiloMax').value = silo?.maxCapacityKg || '';
    document.getElementById('cementSiloStart').value = silo?.startLevelKg ?? '';
    document.getElementById('cementSiloWarn').value = silo?.lowWarnPct ?? 20;
    document.getElementById('cementSiloCrit').value = silo?.criticalWarnPct ?? 10;
    document.getElementById('cementSiloNote').value = silo?.note || '';
    document.getElementById('cementSiloDialog')?.showModal();
  }
  async function deleteSilo(id){
    const silo = state.silos.find(s=>String(s.id)===String(id));
    if(!silo){ alert('Silon hittades inte.'); return; }
    const hasTx = state.tx.some(t=>String(t.siloId)===String(id));
    const msg = hasTx
      ? `Ta bort silon "${silo.name}"?\\n\\nDen har historik/transaktioner. Silo tas bort från listan men historiken kan finnas kvar i databasen.`
      : `Ta bort silon "${silo.name}"?`;
    if(!confirm(msg)) return;

    const s = db();
    if(!s){ alert('Supabase saknas.'); return; }

    try{
      const { error } = await s.from('cement_silos').delete().eq('id', id);
      if(error) throw error;
      await loadAndRender();
    }catch(err){
      alert('Kunde inte ta bort silo. Kontrollera behörighet/RLS.\\n' + (err.message || err));
    }
  }

  async function saveSilo(e){
    e.preventDefault(); const s = db(), u = currentUser(); if(!s||!u){ alert('Logga in först.'); return; }
    const id = document.getElementById('cementSiloId').value;
    const matSel = document.getElementById('cementSiloMaterial'); const opt = matSel.selectedOptions[0];
    const materialId = matSel.value; const materialName = opt?.dataset?.name || opt?.textContent || '';
    const obj = { user_id:u.id, factory_id: activeFactoryId() || null, name:document.getElementById('cementSiloName').value.trim(), material_id: materialId || null, material_name: materialName, max_capacity_kg:num(document.getElementById('cementSiloMax').value,0), start_level_kg:num(document.getElementById('cementSiloStart').value,0), current_level_kg:num(document.getElementById('cementSiloStart').value,0), low_warn_pct:num(document.getElementById('cementSiloWarn').value,20), critical_warn_pct:num(document.getElementById('cementSiloCrit').value,10), note:document.getElementById('cementSiloNote').value.trim(), active:true };
    obj.app_data = { name:obj.name, materialId:obj.material_id, materialName:obj.material_name, maxCapacityKg:obj.max_capacity_kg, startLevelKg:obj.start_level_kg, lowWarnPct:obj.low_warn_pct, criticalWarnPct:obj.critical_warn_pct, note:obj.note, factoryId:obj.factory_id };
    let res = id ? await s.from('cement_silos').update(obj).eq('id', id).eq('user_id', u.id).select('*').single() : await s.from('cement_silos').insert([obj]).select('*').single();
    if (res.error){ alert('Kunde inte spara silo. Har du kört SQL-filen?\n' + res.error.message); return; }
    document.getElementById('cementSiloDialog')?.close(); await loadAndRender();
  }
  function openDeliveryDialog(siloId){
    ensureDialogs(); const sel = document.getElementById('cementDeliverySilo');
    sel.innerHTML = `<option value="">— välj silo —</option>` + state.silos.map(s=>`<option value="${esc(s.id)}">${esc(s.name)} – ${esc(s.materialName)}</option>`).join('');
    document.getElementById('cementDeliveryDate').value = todayISO(); document.getElementById('cementDeliveryKg').value = ''; document.getElementById('cementDeliveryNote').value = '';
    if (siloId) sel.value = siloId;
    document.getElementById('cementDeliveryDialog')?.showModal();
  }
  async function saveDelivery(e){
    e.preventDefault(); const s = db(), u = currentUser(); if(!s||!u){ alert('Logga in först.'); return; }
    const silo = state.silos.find(x=>String(x.id)===String(document.getElementById('cementDeliverySilo').value)); if(!silo){ alert('Välj silo.'); return; }
    const date = document.getElementById('cementDeliveryDate').value || todayISO(); const kg = num(document.getElementById('cementDeliveryKg').value,0); const note = document.getElementById('cementDeliveryNote').value.trim();
    const payload = { user_id:u.id, factory_id: activeFactoryId() || null, silo_id:silo.id, type:'in', source:'diary', material_id:silo.materialId || null, material_name:silo.materialName, amount_kg:kg, note, created_at: date + 'T12:00:00', app_data:{ entryType:'cement_delivery', siloId:silo.id, siloName:silo.name, materialName:silo.materialName, amountKg:kg, note, factoryId:activeFactoryId() || null } };
    const { error } = await s.from('cement_silo_transactions').insert([payload]);
    if (error){ alert('Kunde inte spara leverans. Har du kört SQL-filen?\n' + error.message); return; }
    // Försök även skapa en vanlig dagbokspost som syns i historik, men stoppa inte flödet om äldre schema skiljer sig.
    try { await s.from('diary_entries').insert([{ user_id:u.id, entry_date:date, note:`Materialleverans: ${silo.name}, ${silo.materialName}, ${kg} kg${note ? ' – ' + note : ''}`, imports:[], app_data:{ type:'cement_delivery', siloId:silo.id, siloName:silo.name, materialName:silo.materialName, amountKg:kg, note, factoryId:activeFactoryId() || null } }]); } catch(_){}
    document.getElementById('cementDeliveryDialog')?.close(); await loadAndRender();
  }

  const boot = () => { ensureUI(); const cementVisible = document.getElementById('tab-cement_silos')?.style.display !== 'none'; const dashVisible = document.getElementById('tab-dashboard')?.style.display !== 'none'; if (cementVisible || dashVisible) loadAndRender(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else setTimeout(boot, 200);
  window.addEventListener('btg:access-ready', boot);
  window.addEventListener('btg:factory-changed', loadAndRender);
  setInterval(() => { const cementVisible = document.getElementById('tab-cement_silos')?.style.display !== 'none'; const dashVisible = document.getElementById('tab-dashboard')?.style.display !== 'none'; if (cementVisible || dashVisible) loadAndRender(); }, 60000);
  window.BTG_CEMENT_SILOS = {
    open: openTab,
    refresh: loadAndRender,
    state,
    getAnalysis: () => state.analysis || [],
    getDashboardData: () => (state.analysis || []).map(x => ({
      id:x.silo?.id,
      name:x.silo?.name,
      materialName:x.silo?.materialName,
      maxCapacityKg:x.silo?.maxCapacityKg,
      currentKg:x.currentKg,
      pct:x.pct,
      status:x.status,
      inKg:x.inKg,
      outKg:(x.batchOutKg||0)+(x.manualOutKg||0)
    }))
  };
})();
