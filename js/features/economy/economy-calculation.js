/***********************************************************
 * v19.5.34 – FABRIKSADMIN: EKONOMI & KALKYL
 *
 * Separat modul för modulär HTML-version.
 * - Materialpriser
 * - Utpris per recept
 * - Receptkalkyl kr/m³
 * - Tillverkningsanalys från journalen
 * - Diagram och rapportknapp
 ***********************************************************/
(function(){
  if (window.__BTG_V19534_ECONOMY) return;
  window.__BTG_V19534_ECONOMY = true;

  const TAB = 'economy_calculation';
  const state = {
    materials: [], recipes: [], batches: [], materialPrices: [], salesPrices: [], recipeRows: [], batchRows: [], error: '', loadedAt: null,
    panel: 'overview', from: '', to: ''
  };

  function esc(v){ if (typeof escapeHtml === 'function') return escapeHtml(v); return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function num(v, fb=0){ const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : fb; }
  function money(v){ const n = num(v,0); return n.toLocaleString('sv-SE', { maximumFractionDigits: 0 }) + ' kr'; }
  function money1(v){ const n = num(v,0); return n.toLocaleString('sv-SE', { maximumFractionDigits: 1 }) + ' kr'; }
  function qty(v,d=1){ return num(v,0).toLocaleString('sv-SE', { maximumFractionDigits:d, minimumFractionDigits:d }); }
  function pct(v){ return num(v,0).toLocaleString('sv-SE', { maximumFractionDigits:1 }) + ' %'; }
  function todayISO(){ const d = new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10); }
  function monthStartISO(){ const d = new Date(); d.setDate(1); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10); }
  function localISO(v){ try { if(!v) return ''; const d = new Date(v); if(Number.isNaN(d.getTime())) return String(v).slice(0,10); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10); } catch { return String(v||'').slice(0,10); } }
  function db(){ try { return window.sb || sb || null; } catch { return window.sb || null; } }
  function currentUser(){ try { return CURRENT_USER || window.CURRENT_USER || null; } catch { return window.CURRENT_USER || null; } }
  function activeFactoryId(){ try { return window.BTG_FACTORY_ADMIN_STATE?.selectedFactoryId || window.BTG_ACCESS_STATE?.profile?.factory_id || window.BTG_ACCESS_STATE?.factory?.id || window.BTG_ACCESS_STATE?.factory?.factory_id || localStorage.getItem('btg_selected_factory_id') || ''; } catch { return ''; } }
  function activeFactoryName(){ try { return window.BTG_ACCESS_STATE?.factory?.name || window.BTG_FACTORY_ADMIN_STATE?.selectedFactoryName || ''; } catch { return ''; } }
  function roleCode(){ try { return String(window.BTG_ACCESS_STATE?.profile?.role_code || window.BTG_ACCESS_STATE?.profile?.role || '').toUpperCase(); } catch { return ''; } }
  function isSuperAdmin(){ const r = roleCode(); return r === 'SUPERADMIN' || !!window.BTG_SYSTEMCENTER?.isSuperAdmin; }
  function isFactoryAdmin(){ const r = roleCode(); return r === 'ADMIN' || r === 'SUPERADMIN' || r === 'FABRIKSADMIN' || !!window.BTG_ACCESS_STATE?.permissions?.role_admin; }
  function getApp(row){ return row?.app_data || {}; }
  function refOf(x){ return String(x?.cloudId || x?.id || x?.material_ref || x?.recipe_ref || x?.name || '').trim(); }
  function key(v){ return String(v || '').trim().toLowerCase(); }
  function belongsSoft(item, fid){ if(!fid) return true; const f = String(item?.factoryId || '').trim(); return !f || f === String(fid); }

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
      console.warn('Ekonomi: kunde inte hämta fabriksanvändare, använder aktuell användare.', e);
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
  async function queryFactoryRows(table, select, fid, orderCol){
    const s = db(), u = currentUser(); if(!s || !u) return { data: [], error: null };
    let q = s.from(table).select(select);
    if (fid) q = q.eq('factory_id', fid); else q = q.eq('user_id', u.id);
    if (orderCol) q = q.order(orderCol, { ascending:false });
    return await q;
  }

  function normalizeMaterial(row){ const app = getApp(row); return { ...app, id: row.id || app.id || '', cloudId: row.id || app.cloudId || '', name: row.name || app.name || '', type: row.type || app.type || '', factoryId: row.factory_id || app.factoryId || app.factory_id || '' }; }
  function normalizeRecipe(row){ const app = getApp(row); return { ...app, id: row.id || app.id || '', cloudId: row.id || app.cloudId || '', name: row.name || app.name || '', strength: row.strength || app.strength || '', materials: Array.isArray(app.materials) ? app.materials : [], perM3: app.perM3 !== false, satsVolym: app.satsVolym || null, factoryId: row.factory_id || app.factoryId || app.factory_id || '' }; }
  function normalizeBatch(row){ const app = getApp(row); return { ...app, id: row.id || app.id || '', cloudId: row.id || app.cloudId || '', recipeId: app.recipeId || row.recipe_id || '', recipeCloudId: row.recipe_id || app.recipeCloudId || '', recipeName: app.recipeName || app.recipe_name || '', amount: num(app.amount ?? row.amount_m3, 0), dateTime: app.dateTime || row.datetime || row.created_at || '', customerName: app.customerName || app.customer_name || '', orderName: app.orderName || app.order_name || '', factoryId: row.factory_id || app.factoryId || app.factory_id || '' }; }
  function normalizeMaterialPrice(row){ const app = getApp(row); return { id: row.id || '', userId: row.user_id || '', factoryId: row.factory_id || app.factoryId || '', materialRef: row.material_ref || app.materialRef || '', materialName: row.material_name || app.materialName || '', materialType: row.material_type || app.materialType || '', priceValue: num(row.price_value ?? app.priceValue, 0), priceUnit: row.price_unit || app.priceUnit || 'kr/kg', pricePerBase: num(row.price_per_base ?? app.pricePerBase, 0), validFrom: row.valid_from || app.validFrom || '', note: row.note || app.note || '', active: row.active !== false }; }
  function normalizeSalesPrice(row){ const app = getApp(row); return { id: row.id || '', userId: row.user_id || '', factoryId: row.factory_id || app.factoryId || '', recipeRef: row.recipe_ref || app.recipeRef || '', recipeName: row.recipe_name || app.recipeName || '', strength: row.strength || app.strength || '', salesPricePerM3: num(row.sales_price_per_m3 ?? app.salesPricePerM3, 0), validFrom: row.valid_from || app.validFrom || '', note: row.note || app.note || '', active: row.active !== false }; }

  function normalizeLooseMaterial(m){
    if(!m || typeof m !== 'object') return null;
    const name = m.name || m.materialName || m.material_name || '';
    if(!String(name).trim()) return null;
    return { id:m.cloudId || m.id || m.material_id || m.materialId || name, cloudId:m.cloudId || m.id || '', name, type:m.type || m.materialType || m.material_type || '', factoryId:m.factoryId || m.factory_id || '' };
  }
  function coreMaterialsFallback(){
    try { if (Array.isArray(MATERIALS)) return MATERIALS.map(normalizeLooseMaterial).filter(Boolean); } catch(_) {}
    try { const raw = JSON.parse(localStorage.getItem('bk_materials_v1') || '[]'); return Array.isArray(raw) ? raw.map(normalizeLooseMaterial).filter(Boolean) : []; } catch(_) { return []; }
  }
  function mergeMaterials(list){
    const map = new Map();
    for (const m of list.map(normalizeLooseMaterial).filter(Boolean)){
      const k = key(refOf(m) || m.name);
      if(!k) continue;
      const prev = map.get(k);
      if(!prev || (!prev.type && m.type) || (!prev.cloudId && m.cloudId)) map.set(k, m);
    }
    return Array.from(map.values()).sort((a,b)=>String(a.name).localeCompare(String(b.name),'sv'));
  }
  function recipeMaterialFallback(){
    const out = [];
    for(const r of state.recipes || []) for(const m of (Array.isArray(r.materials) ? r.materials : [])) if(String(m.name||'').trim()) out.push(normalizeLooseMaterial({ id:m.materialId || m.material_id || m.id || m.name, cloudId:m.cloudId || m.materialId || m.material_id || '', name:m.name, type:m.type || '', factoryId:r.factoryId || '' }));
    return out.filter(Boolean);
  }
  function allMaterials(){ return mergeMaterials([...(state.materials||[]), ...coreMaterialsFallback(), ...recipeMaterialFallback()]); }

  function convertPriceToBase(value, unit){
    const v = num(value,0);
    const u = String(unit || 'kr/kg').toLowerCase();
    if (u.includes('ton')) return v / 1000;
    return v;
  }
  function amountPerM3(recipe, mat){
    const amount = num(mat.amount ?? mat.kg ?? mat.value, 0);
    if (recipe?.perM3 === false && num(recipe?.satsVolym,0) > 0) return amount / num(recipe.satsVolym,1);
    return amount;
  }
  function materialPriceFor(mat){
    const refs = [mat?.materialId, mat?.material_id, mat?.cloudId, mat?.id, mat?.name].map(key).filter(Boolean);
    return state.materialPrices.find(p => p.active && (refs.includes(key(p.materialRef)) || key(p.materialName) === key(mat?.name)));
  }
  function salesPriceFor(recipe){
    const refs = [recipe?.cloudId, recipe?.id, recipe?.name].map(key).filter(Boolean);
    return state.salesPrices.find(p => p.active && (refs.includes(key(p.recipeRef)) || key(p.recipeName) === key(recipe?.name)));
  }
  function recipeForBatch(batch){
    return state.recipes.find(r => String(r.cloudId||r.id) === String(batch.recipeCloudId||batch.recipeId) || String(r.id) === String(batch.recipeId) || key(r.name) === key(batch.recipeName));
  }
  function calcRecipe(recipe){
    let cost = 0, missing = 0; const lines = [];
    for(const m of (Array.isArray(recipe.materials) ? recipe.materials : [])){
      if(!String(m.name||'').trim()) continue;
      const amt = amountPerM3(recipe, m);
      const price = materialPriceFor(m);
      const priceBase = price ? num(price.pricePerBase,0) : 0;
      const lineCost = amt * priceBase;
      if(!price) missing += 1;
      cost += lineCost;
      lines.push({ name:m.name, type:m.type||'', amountPerM3:amt, price, lineCost });
    }
    const sales = salesPriceFor(recipe);
    const salesPerM3 = sales ? num(sales.salesPricePerM3,0) : 0;
    const tbPerM3 = salesPerM3 - cost;
    const marginPct = salesPerM3 > 0 ? tbPerM3 / salesPerM3 * 100 : 0;
    return { recipe, materialCostPerM3:cost, salesPerM3, tbPerM3, marginPct, missingPrices:missing, lines };
  }
  function analyze(){
    state.recipeRows = (state.recipes || []).map(calcRecipe).sort((a,b)=>a.recipe.name.localeCompare(b.recipe.name,'sv'));
    const from = state.from || monthStartISO(); const to = state.to || todayISO();
    state.batchRows = (state.batches || []).filter(b => {
      const d = localISO(b.dateTime); return (!from || d >= from) && (!to || d <= to);
    }).map(b => {
      const recipe = recipeForBatch(b);
      const rc = recipe ? calcRecipe(recipe) : null;
      const volume = num(b.amount,0);
      const cost = (rc?.materialCostPerM3 || 0) * volume;
      const revenue = (rc?.salesPerM3 || 0) * volume;
      const tb = revenue - cost;
      const margin = revenue > 0 ? tb / revenue * 100 : 0;
      return { batch:b, recipe, volume, materialCost:cost, revenue, tb, margin, materialCostPerM3:rc?.materialCostPerM3 || 0, salesPerM3:rc?.salesPerM3 || 0 };
    }).sort((a,b)=>String(b.batch.dateTime).localeCompare(String(a.batch.dateTime)));
  }

  async function loadData(){
    state.error = '';
    const s = db(), u = currentUser();
    if(!s || !u){ state.error = 'Logga in mot Supabase för att använda Ekonomi & Kalkyl.'; return; }
    const fid = activeFactoryId();
    const ids = await getFactoryUserIds(fid);
    const [matRes, recRes, batRes, mpRes, spRes] = await Promise.all([
      queryByUsers('materials', 'id,name,type,ef,note,app_data,created_at,user_id', ids, 'created_at'),
      queryByUsers('recipes', 'id,name,strength,vct,vct_eq,air_req,app_data,created_at,user_id', ids, 'created_at'),
      queryByUsers('batches', 'id,recipe_id,amount_m3,datetime,gwp,app_data,created_at,user_id', ids, 'datetime'),
      queryFactoryRows('material_prices', '*', fid, 'updated_at'),
      queryFactoryRows('recipe_sales_prices', '*', fid, 'updated_at')
    ]);
    const firstErr = [matRes,recRes,batRes,mpRes,spRes].find(r => r?.error)?.error;
    if(firstErr) throw firstErr;
    state.materials = mergeMaterials((matRes.data||[]).map(normalizeMaterial).filter(x=>belongsSoft(x,fid)));
    state.recipes = (recRes.data||[]).map(normalizeRecipe).filter(x=>belongsSoft(x,fid));
    state.batches = (batRes.data||[]).map(normalizeBatch).filter(x=>belongsSoft(x,fid));
    state.materials = mergeMaterials([...(state.materials||[]), ...coreMaterialsFallback(), ...recipeMaterialFallback()]).filter(x=>belongsSoft(x,fid));
    state.materialPrices = (mpRes.data||[]).map(normalizeMaterialPrice).filter(x=>belongsSoft(x,fid));
    state.salesPrices = (spRes.data||[]).map(normalizeSalesPrice).filter(x=>belongsSoft(x,fid));
    state.loadedAt = new Date(); analyze();
  }
  async function loadAndRender(){ try { await loadData(); } catch(e){ console.error(e); state.error = 'Kunde inte ladda Ekonomi & Kalkyl. Har du kört SQL-filen 19_5_34_economy_calculation.sql? ' + (e.message || ''); } render(); }

  function ensureUI(){
    const nav = document.querySelector('header .main-nav') || document.querySelector('.main-nav') || document.querySelector('nav.toolbar');
    if(nav && !document.getElementById('btnEconomyCalculation')){
      const btn = document.createElement('button');
      btn.className = 'tab-btn econ-nav-btn'; btn.type='button'; btn.id='btnEconomyCalculation'; btn.textContent='Ekonomi & Kalkyl'; btn.title='Fabriksadmin: materialkostnad, utpris och tillverkningsanalys';
      btn.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); openTab(); });
      const before = nav.querySelector('#btnSystemCenter') || nav.querySelector('#btnSettings') || nav.querySelector('#btnNordcert');
      if(before) nav.insertBefore(btn, before); else nav.appendChild(btn);
    }
    const main = document.querySelector('main.container') || document.querySelector('main');
    if(!main || document.getElementById('tab-economy_calculation')) return;
    const sec = document.createElement('section'); sec.id='tab-economy_calculation'; sec.className='grid econ-shell'; sec.style.display='none';
    sec.innerHTML = `
      <div class="card"><div class="econ-head"><div><h3>Ekonomi & Kalkyl</h3><p class="econ-sub">Materialpriser, utpris per recept och professionell ekonomianalys från tillverkningsjournalen.</p><div class="econ-small" id="econFactory"></div></div><div class="econ-toolbar"><label class="econ-small">Från <input id="econFrom" type="date"></label><label class="econ-small">Till <input id="econTo" type="date"></label><button class="btn secondary" id="btnEconRefresh" type="button">Uppdatera</button><button class="btn" id="btnEconReport" type="button">Skapa rapport</button></div></div><div class="econ-tabs"><button class="econ-tab active" data-econ-panel="overview">Översikt</button><button class="econ-tab" data-econ-panel="materials">Materialpriser</button><button class="econ-tab" data-econ-panel="recipes">Receptkalkyl</button><button class="econ-tab" data-econ-panel="batches">Tillverkningsanalys</button><button class="econ-tab" data-econ-panel="report">Rapport</button></div></div>
      <div id="econError"></div>
      <div class="econ-panel active" id="econPanelOverview"><div id="econKpis" class="econ-kpis"></div><div class="econ-grid"><div class="econ-card"><h3>Intäkt vs materialkostnad</h3><div id="econRevenueCostChart" class="econ-chart"></div></div><div class="econ-card"><h3>Bästa täckningsbidrag</h3><div id="econTopRecipes"></div></div></div></div>
      <div class="econ-panel" id="econPanelMaterials"><div class="econ-card"><div class="econ-head"><div><h3>Materialpriser</h3><p class="econ-sub">Ange inköpspris för inmaterial. Priset används i receptkalkylen.</p></div><button class="btn" id="btnEconMaterialPrice" type="button">Lägg till / ändra materialpris</button></div><div id="econMaterialsTable" class="econ-table-wrap"></div></div></div>
      <div class="econ-panel" id="econPanelRecipes"><div class="econ-card"><div class="econ-head"><div><h3>Receptkalkyl</h3><p class="econ-sub">Materialkostnad, utpris, TB och marginal per m³.</p></div><button class="btn" id="btnEconSalesPrice" type="button">Lägg till / ändra utpris</button></div><div id="econRecipesTable" class="econ-table-wrap"></div></div></div>
      <div class="econ-panel" id="econPanelBatches"><div class="econ-card"><h3>Tillverkningsanalys</h3><p class="econ-sub">Beräknas från tillverkningsjournalen för vald period.</p><div id="econBatchesTable" class="econ-table-wrap"></div></div></div>
      <div class="econ-panel" id="econPanelReport"><div class="econ-card"><h3>Ekonomirapport</h3><p class="econ-sub">Sammanfattning av periodens volym, materialkostnad, intäkt, täckningsbidrag och marginal.</p><div id="econReportPreview"></div><div class="econ-report-actions"><button class="btn secondary" id="btnEconPrintReport" type="button">Öppna utskriftsrapport</button></div></div></div>
    `;
    main.appendChild(sec);
    document.getElementById('econFrom').value = state.from || monthStartISO();
    document.getElementById('econTo').value = state.to || todayISO();
    document.getElementById('econFrom')?.addEventListener('change', e=>{ state.from=e.target.value; loadAndRender(); });
    document.getElementById('econTo')?.addEventListener('change', e=>{ state.to=e.target.value; loadAndRender(); });
    document.getElementById('btnEconRefresh')?.addEventListener('click', loadAndRender);
    document.getElementById('btnEconReport')?.addEventListener('click', ()=>switchPanel('report'));
    document.getElementById('btnEconPrintReport')?.addEventListener('click', openReport);
    document.getElementById('btnEconMaterialPrice')?.addEventListener('click', ()=>openMaterialPriceDialog());
    document.getElementById('btnEconSalesPrice')?.addEventListener('click', ()=>openSalesPriceDialog());
    document.querySelectorAll('[data-econ-panel]').forEach(b=>b.addEventListener('click',()=>switchPanel(b.dataset.econPanel)));
    ensureDialogs();
  }
  function ensureDialogs(){
    if(document.getElementById('econMaterialDialog')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <dialog id="econMaterialDialog" class="econ-dialog"><div class="dialog-inner"><div class="dialog-title"><h3>Materialpris</h3><button class="btn secondary" type="button" data-close-econ-material>Stäng</button></div><form id="econMaterialForm"><input type="hidden" id="econMaterialPriceId"><div class="econ-form-grid"><div><label>Material</label><select id="econMaterialSelect" required></select></div><div><label>Pris</label><input id="econMaterialPriceValue" type="number" step="0.0001" min="0" required></div><div><label>Enhet</label><select id="econMaterialPriceUnit"><option>kr/kg</option><option>kr/ton</option><option>kr/liter</option><option>kr/m³</option></select></div><div><label>Gäller från</label><input id="econMaterialValidFrom" type="date"></div></div><div style="margin-top:12px"><label>Notering</label><input id="econMaterialNote" placeholder="valfritt"></div><div class="econ-report-actions"><button class="btn secondary" type="button" data-close-econ-material>Avbryt</button><button class="btn" type="submit">Spara</button></div></form></div></dialog>
      <dialog id="econSalesDialog" class="econ-dialog"><div class="dialog-inner"><div class="dialog-title"><h3>Utpris per recept</h3><button class="btn secondary" type="button" data-close-econ-sales>Stäng</button></div><form id="econSalesForm"><input type="hidden" id="econSalesPriceId"><div class="econ-form-grid"><div><label>Recept</label><select id="econRecipeSelect" required></select></div><div><label>Utpris kr/m³</label><input id="econSalesPriceValue" type="number" step="0.01" min="0" required></div><div><label>Gäller från</label><input id="econSalesValidFrom" type="date"></div><div><label>Notering</label><input id="econSalesNote" placeholder="valfritt"></div></div><div class="econ-report-actions"><button class="btn secondary" type="button" data-close-econ-sales>Avbryt</button><button class="btn" type="submit">Spara</button></div></form></div></dialog>`);
    document.querySelectorAll('[data-close-econ-material]').forEach(b=>b.addEventListener('click',()=>document.getElementById('econMaterialDialog')?.close()));
    document.querySelectorAll('[data-close-econ-sales]').forEach(b=>b.addEventListener('click',()=>document.getElementById('econSalesDialog')?.close()));
    document.getElementById('econMaterialForm')?.addEventListener('submit', saveMaterialPrice);
    document.getElementById('econSalesForm')?.addEventListener('submit', saveSalesPrice);
  }
  function showTab(tab){
    document.querySelectorAll('main section[id^="tab-"]').forEach(s => { s.style.display = s.id === `tab-${tab}` ? '' : 'none'; });
    document.querySelectorAll('.tab-btn,[data-tab]').forEach(b => { b.classList?.toggle('active', b.id === 'btnEconomyCalculation'); if(b.dataset?.tab) b.setAttribute('aria-current','false'); });
    const btn = document.getElementById('btnEconomyCalculation'); if(btn) btn.setAttribute('aria-current','page');
    try { window.scrollTo({top:0, behavior:'smooth'}); } catch(_) { window.scrollTo(0,0); }
  }
  async function openTab(){
    ensureUI();
    if(!isFactoryAdmin() && !isSuperAdmin()){ alert('Ekonomi & Kalkyl visas bara för fabriksadmin/superadmin.'); return; }
    if(!state.from) state.from = document.getElementById('econFrom')?.value || monthStartISO();
    if(!state.to) state.to = document.getElementById('econTo')?.value || todayISO();
    showTab(TAB); await loadAndRender();
  }
  function switchPanel(name){
    state.panel = name;
    document.querySelectorAll('.econ-tab').forEach(b=>b.classList.toggle('active', b.dataset.econPanel === name));
    document.querySelectorAll('.econ-panel').forEach(p=>p.classList.remove('active'));
    const id = {overview:'econPanelOverview',materials:'econPanelMaterials',recipes:'econPanelRecipes',batches:'econPanelBatches',report:'econPanelReport'}[name] || 'econPanelOverview';
    document.getElementById(id)?.classList.add('active');
    if(name==='report') renderReportPreview();
  }

  function render(){
    ensureUI();
    const errorEl = document.getElementById('econError');
    const fac = activeFactoryName() || activeFactoryId() || 'Aktiv fabrik';
    const fEl = document.getElementById('econFactory'); if(fEl) fEl.textContent = `${fac} • Period ${state.from || monthStartISO()} – ${state.to || todayISO()}`;
    if(errorEl) errorEl.innerHTML = state.error ? `<div class="econ-empty">${esc(state.error)}</div>` : '';
    renderKpis(); renderCharts(); renderTopRecipes(); renderMaterialsTable(); renderRecipesTable(); renderBatchesTable(); renderReportPreview();
  }
  function totals(){ const rows = state.batchRows || []; const volume = rows.reduce((s,r)=>s+r.volume,0); const cost = rows.reduce((s,r)=>s+r.materialCost,0); const revenue = rows.reduce((s,r)=>s+r.revenue,0); const tb = revenue-cost; const margin = revenue>0 ? tb/revenue*100 : 0; return {rows, volume, cost, revenue, tb, margin}; }
  function renderKpis(){
    const el = document.getElementById('econKpis'); if(!el) return; const t = totals();
    el.innerHTML = [`<div class="econ-kpi"><div class="label">Producerad volym</div><div class="value">${qty(t.volume,1)} m³</div><div class="note">vald period</div></div>`, `<div class="econ-kpi"><div class="label">Materialkostnad</div><div class="value">${money(t.cost)}</div><div class="note">från recept + materialpriser</div></div>`, `<div class="econ-kpi"><div class="label">Beräknad intäkt</div><div class="value">${money(t.revenue)}</div><div class="note">utpris per recept</div></div>`, `<div class="econ-kpi ${t.tb<0?'bad':'good'}"><div class="label">Täckningsbidrag</div><div class="value">${money(t.tb)}</div><div class="note">intäkt - materialkostnad</div></div>`, `<div class="econ-kpi ${t.margin<15?'warn':'good'}"><div class="label">Marginal</div><div class="value">${pct(t.margin)}</div><div class="note">TB / intäkt</div></div>`].join('');
  }
  function groupByRecipe(){
    const map = new Map();
    for(const r of state.batchRows || []){
      const name = r.recipe?.name || r.batch.recipeName || 'Okänt recept';
      const x = map.get(name) || {name, volume:0,cost:0,revenue:0,tb:0};
      x.volume += r.volume; x.cost += r.materialCost; x.revenue += r.revenue; x.tb += r.tb; map.set(name,x);
    }
    return Array.from(map.values()).map(x=>({...x, margin:x.revenue>0?x.tb/x.revenue*100:0}));
  }
  function renderCharts(){
    const el = document.getElementById('econRevenueCostChart'); if(!el) return;
    const rows = groupByRecipe().sort((a,b)=>b.revenue-a.revenue).slice(0,8); const maxv = Math.max(1, ...rows.flatMap(r=>[r.revenue,r.cost,Math.abs(r.tb)]));
    if(!rows.length){ el.innerHTML = `<div class="econ-empty">Ingen tillverkningsdata för vald period.</div>`; return; }
    el.innerHTML = rows.map(r=>`<div class="econ-bar-group"><div class="econ-bars"><div class="econ-bar" style="height:${Math.max(4,r.revenue/maxv*125)}px" title="Intäkt ${esc(money(r.revenue))}"></div><div class="econ-bar cost" style="height:${Math.max(4,r.cost/maxv*125)}px" title="Kostnad ${esc(money(r.cost))}"></div><div class="econ-bar tb" style="height:${Math.max(4,Math.abs(r.tb)/maxv*125)}px" title="TB ${esc(money(r.tb))}"></div></div><div class="econ-bar-label" title="${esc(r.name)}">${esc(r.name)}</div></div>`).join('');
  }
  function renderTopRecipes(){
    const el = document.getElementById('econTopRecipes'); if(!el) return;
    const rows = groupByRecipe().sort((a,b)=>b.tb-a.tb).slice(0,8);
    el.innerHTML = rows.length ? `<table class="econ-table"><thead><tr><th>Recept</th><th class="money">Volym</th><th class="money">TB</th><th class="money">Marginal</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.name)}</td><td class="money">${qty(r.volume,1)} m³</td><td class="money ${r.tb<0?'econ-negative':'econ-positive'}">${money(r.tb)}</td><td class="money">${pct(r.margin)}</td></tr>`).join('')}</tbody></table>` : `<div class="econ-empty">Ingen data ännu.</div>`;
  }
  function renderMaterialsTable(){
    const el = document.getElementById('econMaterialsTable'); if(!el) return; const mats = allMaterials();
    if(!mats.length){ el.innerHTML = `<div class="econ-empty">Inga material hittades. Lägg först in material i Materiallistan.</div>`; return; }
    el.innerHTML = `<table class="econ-table"><thead><tr><th>Material</th><th>Typ</th><th class="money">Pris</th><th>Enhet</th><th>Notering</th><th></th></tr></thead><tbody>${mats.map(m=>{ const p = materialPriceFor(m); return `<tr><td><b>${esc(m.name)}</b></td><td>${esc(m.type||'—')}</td><td class="money">${p?money1(p.priceValue):'<span class="muted">saknas</span>'}</td><td>${p?esc(p.priceUnit):'—'}</td><td>${esc(p?.note||'')}</td><td class="money"><button class="btn secondary" type="button" data-edit-matprice="${esc(refOf(m))}">${p?'Ändra':'Sätt pris'}</button></td></tr>`; }).join('')}</tbody></table>`;
    el.querySelectorAll('[data-edit-matprice]').forEach(b=>b.addEventListener('click',()=>openMaterialPriceDialog(b.dataset.editMatprice)));
  }
  function renderRecipesTable(){
    const el = document.getElementById('econRecipesTable'); if(!el) return; const rows = state.recipeRows || [];
    if(!rows.length){ el.innerHTML = `<div class="econ-empty">Inga recept hittades.</div>`; return; }
    el.innerHTML = `<table class="econ-table"><thead><tr><th>Recept</th><th>Hållfasthet</th><th class="money">Kostnad kr/m³</th><th class="money">Utpris kr/m³</th><th class="money">TB kr/m³</th><th class="money">Marginal</th><th>Priser</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${esc(r.recipe.name)}</b></td><td>${esc(r.recipe.strength||'—')}</td><td class="money">${money1(r.materialCostPerM3)}</td><td class="money">${r.salesPerM3?money1(r.salesPerM3):'<span class="muted">saknas</span>'}</td><td class="money ${r.tbPerM3<0?'econ-negative':'econ-positive'}">${money1(r.tbPerM3)}</td><td class="money">${r.salesPerM3?pct(r.marginPct):'—'}</td><td>${r.missingPrices?`<span class="econ-pill warn">${r.missingPrices} saknas</span>`:'<span class="econ-pill good">OK</span>'}</td><td class="money"><button class="btn secondary" type="button" data-edit-sales="${esc(refOf(r.recipe))}">${r.salesPerM3?'Ändra utpris':'Sätt utpris'}</button></td></tr>`).join('')}</tbody></table>`;
    el.querySelectorAll('[data-edit-sales]').forEach(b=>b.addEventListener('click',()=>openSalesPriceDialog(b.dataset.editSales)));
  }
  function renderBatchesTable(){
    const el = document.getElementById('econBatchesTable'); if(!el) return; const rows = state.batchRows || [];
    if(!rows.length){ el.innerHTML = `<div class="econ-empty">Inga satser i vald period.</div>`; return; }
    el.innerHTML = `<table class="econ-table"><thead><tr><th>Datum</th><th>Recept</th><th>Kund/order</th><th class="money">m³</th><th class="money">Kostnad</th><th class="money">Intäkt</th><th class="money">TB</th><th class="money">Marginal</th></tr></thead><tbody>${rows.slice(0,120).map(r=>`<tr><td>${esc(localISO(r.batch.dateTime))}</td><td>${esc(r.recipe?.name || r.batch.recipeName || '—')}</td><td>${esc(r.batch.customerName || r.batch.orderName || '—')}</td><td class="money">${qty(r.volume,1)}</td><td class="money">${money(r.materialCost)}</td><td class="money">${money(r.revenue)}</td><td class="money ${r.tb<0?'econ-negative':'econ-positive'}">${money(r.tb)}</td><td class="money">${r.revenue?pct(r.margin):'—'}</td></tr>`).join('')}</tbody></table>${rows.length>120?`<p class="econ-small">Visar 120 av ${rows.length} satser.</p>`:''}`;
  }
  function renderReportPreview(){
    const el = document.getElementById('econReportPreview'); if(!el) return; const t = totals(); const rows = groupByRecipe().sort((a,b)=>b.volume-a.volume);
    el.innerHTML = `<div class="econ-kpis"><div class="econ-kpi"><div class="label">Volym</div><div class="value">${qty(t.volume,1)} m³</div></div><div class="econ-kpi"><div class="label">Materialkostnad</div><div class="value">${money(t.cost)}</div></div><div class="econ-kpi"><div class="label">Intäkt</div><div class="value">${money(t.revenue)}</div></div><div class="econ-kpi ${t.tb<0?'bad':'good'}"><div class="label">TB</div><div class="value">${money(t.tb)}</div></div><div class="econ-kpi"><div class="label">Marginal</div><div class="value">${pct(t.margin)}</div></div></div><div class="econ-card" style="margin-top:14px"><h3>Per recept</h3>${rows.length?`<table class="econ-table"><thead><tr><th>Recept</th><th class="money">Volym</th><th class="money">Kostnad</th><th class="money">Intäkt</th><th class="money">TB</th><th class="money">Marginal</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.name)}</td><td class="money">${qty(r.volume,1)} m³</td><td class="money">${money(r.cost)}</td><td class="money">${money(r.revenue)}</td><td class="money ${r.tb<0?'econ-negative':'econ-positive'}">${money(r.tb)}</td><td class="money">${pct(r.margin)}</td></tr>`).join('')}</tbody></table>`:`<div class="econ-empty">Ingen data för vald period.</div>`}</div>`;
  }
  function materialOptions(selectedRef){ return allMaterials().map(m=>`<option value="${esc(refOf(m))}" data-name="${esc(m.name)}" data-type="${esc(m.type||'')}" ${String(refOf(m))===String(selectedRef)?'selected':''}>${esc(m.name)}${m.type?' – '+esc(m.type):''}</option>`).join(''); }
  function recipeOptions(selectedRef){ return (state.recipes||[]).map(r=>`<option value="${esc(refOf(r))}" data-name="${esc(r.name)}" data-strength="${esc(r.strength||'')}" ${String(refOf(r))===String(selectedRef)?'selected':''}>${esc(r.name)}${r.strength?' – '+esc(r.strength):''}</option>`).join(''); }
  function openMaterialPriceDialog(materialRef){
    ensureDialogs(); const price = state.materialPrices.find(p=>key(p.materialRef)===key(materialRef) || key(p.materialName)===key(materialRef));
    const sel = document.getElementById('econMaterialSelect'); sel.innerHTML = `<option value="">— välj material —</option>${materialOptions(materialRef || price?.materialRef || '')}`;
    document.getElementById('econMaterialPriceId').value = price?.id || '';
    document.getElementById('econMaterialPriceValue').value = price?.priceValue || '';
    document.getElementById('econMaterialPriceUnit').value = price?.priceUnit || 'kr/kg';
    document.getElementById('econMaterialValidFrom').value = price?.validFrom || todayISO();
    document.getElementById('econMaterialNote').value = price?.note || '';
    document.getElementById('econMaterialDialog')?.showModal();
  }
  function openSalesPriceDialog(recipeRef){
    ensureDialogs(); const price = state.salesPrices.find(p=>key(p.recipeRef)===key(recipeRef) || key(p.recipeName)===key(recipeRef));
    const sel = document.getElementById('econRecipeSelect'); sel.innerHTML = `<option value="">— välj recept —</option>${recipeOptions(recipeRef || price?.recipeRef || '')}`;
    document.getElementById('econSalesPriceId').value = price?.id || '';
    document.getElementById('econSalesPriceValue').value = price?.salesPricePerM3 || '';
    document.getElementById('econSalesValidFrom').value = price?.validFrom || todayISO();
    document.getElementById('econSalesNote').value = price?.note || '';
    document.getElementById('econSalesDialog')?.showModal();
  }
  async function saveMaterialPrice(e){
    e.preventDefault(); const s=db(), u=currentUser(); if(!s||!u){ alert('Logga in först.'); return; }
    const sel = document.getElementById('econMaterialSelect'); const opt = sel.selectedOptions[0]; if(!sel.value){ alert('Välj material.'); return; }
    const unit = document.getElementById('econMaterialPriceUnit').value; const value = num(document.getElementById('econMaterialPriceValue').value,0);
    const payload = { user_id:u.id, factory_id:activeFactoryId() || null, material_ref:sel.value, material_name:opt?.dataset?.name || opt?.textContent || '', material_type:opt?.dataset?.type || '', price_value:value, price_unit:unit, price_per_base:convertPriceToBase(value,unit), valid_from:document.getElementById('econMaterialValidFrom').value || todayISO(), note:document.getElementById('econMaterialNote').value.trim(), active:true };
    payload.app_data = { materialRef:payload.material_ref, materialName:payload.material_name, materialType:payload.material_type, priceValue:payload.price_value, priceUnit:payload.price_unit, pricePerBase:payload.price_per_base, validFrom:payload.valid_from, note:payload.note, factoryId:payload.factory_id };
    const id = document.getElementById('econMaterialPriceId').value; let res;
    if(id) res = await s.from('material_prices').update(payload).eq('id', id).select('*').single(); else res = await s.from('material_prices').insert([payload]).select('*').single();
    if(res.error){ alert('Kunde inte spara materialpris. Har du kört SQL-filen?\n' + res.error.message); return; }
    document.getElementById('econMaterialDialog')?.close(); await loadAndRender();
  }
  async function saveSalesPrice(e){
    e.preventDefault(); const s=db(), u=currentUser(); if(!s||!u){ alert('Logga in först.'); return; }
    const sel = document.getElementById('econRecipeSelect'); const opt = sel.selectedOptions[0]; if(!sel.value){ alert('Välj recept.'); return; }
    const payload = { user_id:u.id, factory_id:activeFactoryId() || null, recipe_ref:sel.value, recipe_name:opt?.dataset?.name || opt?.textContent || '', strength:opt?.dataset?.strength || '', sales_price_per_m3:num(document.getElementById('econSalesPriceValue').value,0), valid_from:document.getElementById('econSalesValidFrom').value || todayISO(), note:document.getElementById('econSalesNote').value.trim(), active:true };
    payload.app_data = { recipeRef:payload.recipe_ref, recipeName:payload.recipe_name, strength:payload.strength, salesPricePerM3:payload.sales_price_per_m3, validFrom:payload.valid_from, note:payload.note, factoryId:payload.factory_id };
    const id = document.getElementById('econSalesPriceId').value; let res;
    if(id) res = await s.from('recipe_sales_prices').update(payload).eq('id', id).select('*').single(); else res = await s.from('recipe_sales_prices').insert([payload]).select('*').single();
    if(res.error){ alert('Kunde inte spara utpris. Har du kört SQL-filen?\n' + res.error.message); return; }
    document.getElementById('econSalesDialog')?.close(); await loadAndRender();
  }
  function reportHtml(){
    const t = totals(); const byRecipe = groupByRecipe().sort((a,b)=>b.volume-a.volume);
    return `<!doctype html><html><head><meta charset="utf-8"><title>Ekonomirapport</title><style>body{font-family:Arial,sans-serif;margin:28px;color:#111827}h1{margin:0 0 4px}small{color:#64748b}.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:18px 0}.kpi{border:1px solid #cbd5e1;border-radius:12px;padding:12px}.label{font-size:11px;text-transform:uppercase;color:#64748b;font-weight:bold}.value{font-size:20px;font-weight:900;margin-top:6px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border-bottom:1px solid #e2e8f0;padding:8px;text-align:left}th{font-size:11px;text-transform:uppercase;color:#64748b}.money{text-align:right}.pos{color:#047857}.neg{color:#be123c}@media print{button{display:none}}</style></head><body><button onclick="print()">Skriv ut</button><h1>Ekonomirapport</h1><small>${esc(activeFactoryName() || 'Aktiv fabrik')} • Period ${esc(state.from || monthStartISO())} – ${esc(state.to || todayISO())}</small><div class="kpis"><div class="kpi"><div class="label">Volym</div><div class="value">${qty(t.volume,1)} m³</div></div><div class="kpi"><div class="label">Materialkostnad</div><div class="value">${money(t.cost)}</div></div><div class="kpi"><div class="label">Intäkt</div><div class="value">${money(t.revenue)}</div></div><div class="kpi"><div class="label">TB</div><div class="value ${t.tb<0?'neg':'pos'}">${money(t.tb)}</div></div><div class="kpi"><div class="label">Marginal</div><div class="value">${pct(t.margin)}</div></div></div><h2>Per recept</h2><table><thead><tr><th>Recept</th><th class="money">Volym</th><th class="money">Kostnad</th><th class="money">Intäkt</th><th class="money">TB</th><th class="money">Marginal</th></tr></thead><tbody>${byRecipe.map(r=>`<tr><td>${esc(r.name)}</td><td class="money">${qty(r.volume,1)} m³</td><td class="money">${money(r.cost)}</td><td class="money">${money(r.revenue)}</td><td class="money ${r.tb<0?'neg':'pos'}">${money(r.tb)}</td><td class="money">${pct(r.margin)}</td></tr>`).join('')}</tbody></table></body></html>`;
  }
  function openReport(){ const w = window.open('', '_blank'); if(!w){ alert('Tillåt popup-fönster för att öppna rapporten.'); return; } w.document.open(); w.document.write(reportHtml()); w.document.close(); }

  const boot = () => { ensureUI(); const visible = document.getElementById('tab-economy_calculation')?.style.display !== 'none'; if(visible) loadAndRender(); };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else setTimeout(boot, 250);
  window.addEventListener('btg:access-ready', boot);
  window.addEventListener('btg:factory-changed', loadAndRender);
  document.addEventListener('click', (ev)=>{ const tabBtn = ev.target.closest?.('.tab-btn'); if(tabBtn && tabBtn.id !== 'btnEconomyCalculation'){ const sec=document.getElementById('tab-economy_calculation'); if(sec) sec.style.display='none'; } });
  window.BTG_ECONOMY_CALCULATION = { open: openTab, refresh: loadAndRender, state };
})();
