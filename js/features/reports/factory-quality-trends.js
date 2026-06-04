/***********************************************************
 * v19.5.30 – FABRIKSADMIN: KVALITETSTRENDER
 *
 * Isolerad HTML-modul ovanpå v19.5.29.
 * - Egen flik: Kvalitetstrender
 * - Synlig för FABRIKSADMIN/ADMIN/SUPERADMIN eller roll_admin
 * - Läser befintliga provkuber/satser + demoulding_cubes
 * - Visar trendkort, enkla diagram och utskrivbar rapport
 ***********************************************************/
(function(){
  if (window.__BTG_V19530_FACTORY_QUALITY_TRENDS) return;
  window.__BTG_V19530_FACTORY_QUALITY_TRENDS = true;

  const TAB = 'quality_trends';
  let state = { samples: [], batches: [], demouldings: [], loadedAt: null, lastAnalysis: null, error: '' };

  function esc(v){
    if (typeof escapeHtml === 'function') return escapeHtml(v);
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function todayISO(){ const d = new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10); }
  function addDaysISO(days){ const d = new Date(); d.setDate(d.getDate()+days); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10); }
  function localDateISO(v){ try { if(!v) return ''; const d = new Date(v); if (Number.isNaN(d.getTime())) return String(v).slice(0,10); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10); } catch { return String(v||'').slice(0,10); } }
  function num(v){ const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; }
  function arr(name){ try { return Array.isArray(window[name]) ? window[name] : (Array.isArray(eval(name)) ? eval(name) : []); } catch { try { return Array.isArray(eval(name)) ? eval(name) : []; } catch { return []; } } }
  function currentUser(){ try { return CURRENT_USER || window.CURRENT_USER || null; } catch { return window.CURRENT_USER || null; } }
  function db(){ try { return window.sb || sb || null; } catch { return window.sb || null; } }
  function activeFactoryId(){
    try { return localStorage.getItem('btg_selected_factory_id') || window.BTG_ACTIVE_FACTORY_ID || window.BTG_CURRENT_FACTORY_ID || window.BTG_FACTORY_ADMIN_STATE?.selectedFactoryId || window.BTG_ACCESS_STATE?.factory_id || window.BTG_ACCESS_STATE?.profile?.factory_id || window.BTG_ACCESS_STATE?.factory?.id || window.BTG_ACCESS_STATE?.factory?.factory_id || ''; }
    catch { return ''; }
  }
  function roleCode(){ try { return String(window.BTG_ACCESS_STATE?.profile?.role_code || '').toUpperCase(); } catch { return ''; } }
  function isFactoryAdmin(){
    const role = roleCode();
    return role === 'ADMIN' || role === 'SUPERADMIN' || role === 'FABRIKSADMIN' || !!window.BTG_ACCESS_STATE?.permissions?.role_admin;
  }
  function allowQualityTrends(){
    try {
      if (!window.BTG_ACCESS_STATE) return;
      if (isFactoryAdmin()) {
        window.BTG_ACCESS_STATE.permissions = Object.assign({}, window.BTG_ACCESS_STATE.permissions || {}, { [TAB]: true });
        if (window.BTG_ACCESS_STATE.profile) window.BTG_ACCESS_STATE.profile.permissions = Object.assign({}, window.BTG_ACCESS_STATE.profile.permissions || {}, { [TAB]: true });
      }
    } catch(_) {}
  }
  function belongsToFactory(item, fid){
    if (!fid) return true;
    const app = item?.app_data || item || {};
    const x = item?.factoryId || item?.factory_id || item?.prefabFactoryId || item?.prefab_factory_id || app.factoryId || app.factory_id || app.prefabFactoryId || app.prefab_factory_id || '';
    return String(x || '') === String(fid);
  }
  function dateInRange(iso, from, to){
    const d = String(iso || '').slice(0,10);
    if (!d) return false;
    return (!from || d >= from) && (!to || d <= to);
  }
  function weekKey(iso){
    const d = new Date((iso || todayISO()) + 'T12:00:00');
    const day = d.getDay() || 7;
    d.setDate(d.getDate() + 4 - day);
    const yearStart = new Date(d.getFullYear(),0,1);
    const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return d.getFullYear() + '-v' + String(week).padStart(2,'0');
  }
  function mean(values){ const xs = values.map(num).filter(v=>v!=null); return xs.length ? xs.reduce((s,x)=>s+x,0)/xs.length : null; }
  function min(values){ const xs = values.map(num).filter(v=>v!=null); return xs.length ? Math.min(...xs) : null; }
  function max(values){ const xs = values.map(num).filter(v=>v!=null); return xs.length ? Math.max(...xs) : null; }
  function fckFromStrength(str){ const m = String(str||'').match(/C\s*\d+\s*\/\s*(\d+)/i); return m ? Number(m[1]) : null; }
  function trend(values){
    const xs = values.map(num).filter(v=>v!=null);
    if (xs.length < 3) return { label:'För få värden', cls:'', delta:null };
    const mid = Math.floor(xs.length/2);
    const a = mean(xs.slice(0, mid));
    const b = mean(xs.slice(mid));
    const delta = (b == null || a == null) ? null : b - a;
    if (delta == null || Math.abs(delta) < 1) return { label:'Stabil', cls:'ok', delta };
    return delta > 0 ? { label:'Stigande', cls:'ok', delta } : { label:'Sjunkande', cls:'warn', delta };
  }
  function normalizeDemouldingRow(row){
    const app = row?.app_data || {};
    return {
      ...app,
      id: row.id || app.id || '',
      batchId: row.batch_id || app.batchId || '',
      batchCloudId: row.batch_cloud_id || app.batchCloudId || '',
      castDate: row.cast_date || app.castDate || '',
      demouldDate: row.demould_date || app.demouldDate || row.created_at || '',
      recipeId: row.recipe_id || app.recipeId || '',
      recipeName: row.recipe_name || app.recipeName || '',
      strength: row.strength || app.strength || app.strengthClass || '',
      productionType: row.production_type || app.productionType || '',
      customerName: row.customer_name || app.customerName || '',
      factoryId: row.factory_id || app.factoryId || app.factory_id || '',
      mpa: row.mpa ?? app.mpa ?? app.resultMPa ?? null,
      employeeNo: row.employee_no || app.employeeNo || '',
      comment: row.comment || app.comment || '',
      createdAt: row.created_at || app.createdAt || ''
    };
  }


  function normalizeSampleRow(row){
    const app = row?.app_data || {};
    const castDate = app.castDate || row.cast_date || row.created_at || '';
    return {
      ...app,
      id: row.id || app.id || '',
      cloudId: row.id || app.cloudId || '',
      recipeId: app.recipeId || row.recipe_id || '',
      recipeCloudId: row.recipe_id || app.recipeCloudId || '',
      recipeName: app.recipeName || app.recipe_name || '',
      strengthClass: app.strengthClass || app.strength || app.strength_class || '',
      castDate,
      dueDate: app.dueDate || row.due_date || '',
      cureDays: app.cureDays ?? 28,
      weight: app.weight ?? row.weight ?? null,
      resultMPa: app.resultMPa ?? app.resultMPA ?? row.strength_mpa ?? null,
      batchId: app.batchId || row.batch_id || '',
      note: app.note || row.note || '',
      factoryId: app.factoryId || app.factory_id || row.factory_id || '',
      createdAt: row.created_at || app.createdAt || ''
    };
  }

  function normalizeBatchRowQt(row){
    const app = row?.app_data || {};
    return {
      ...app,
      id: row.id || app.id || '',
      cloudId: row.id || app.cloudId || '',
      recipeId: app.recipeId || row.recipe_id || '',
      recipeCloudId: row.recipe_id || app.recipeCloudId || '',
      recipeName: app.recipeName || app.recipe_name || '',
      strength: app.strength || app.strengthClass || '',
      amount: app.amount ?? row.amount_m3 ?? 0,
      dateTime: app.dateTime || row.datetime || row.created_at || '',
      factoryId: app.factoryId || app.factory_id || row.factory_id || '',
      createdAt: row.created_at || app.createdAt || ''
    };
  }

  function getFactoryMarker(item){
    const app = item?.app_data || item || {};
    return String(item?.factoryId || item?.factory_id || app.factoryId || app.factory_id || '').trim();
  }

  function belongsToFactorySoft(item, fid){
    if (!fid) return true;
    const marker = getFactoryMarker(item);
    // Direktladdningen nedan begränsar redan på fabriksmedlemmarnas user_id.
    // Äldre provningar kan sakna factory_id och ska därför inte tappas bort i rapporten.
    return !marker || marker === String(fid);
  }

  async function getFactoryUserIdsForReport(fid){
    const s = db();
    const u = currentUser();
    if (!s || !u) return [];
    if (!fid) return [u.id];
    try {
      const { data, error } = await s.rpc('btg_factory_user_ids', { p_factory_id: fid });
      if (error) throw error;
      const ids = Array.from(new Set((data || []).map(r => String(r.user_id || r.uid || r)).filter(Boolean)));
      return ids.length ? ids : [u.id];
    } catch(e) {
      console.warn('Kunde inte hämta fabriksanvändare för kvalitetstrender, använder aktuell användare:', e);
      return [u.id];
    }
  }

  async function queryByUsers(table, select, userIds, orderCol){
    const s = db();
    if (!s || !userIds.length) return { data: [], error: null };
    let q = s.from(table).select(select);
    q = userIds.length === 1 ? q.eq('user_id', userIds[0]) : q.in('user_id', userIds);
    if (orderCol) q = q.order(orderCol, { ascending:false });
    return await q;
  }

  function ensureUI(){
    allowQualityTrends();
    const nav = document.querySelector('header .main-nav') || document.querySelector('.main-nav') || document.querySelector('nav.toolbar');
    if (nav && !document.getElementById('btnQualityTrends')) {
      const btn = document.createElement('button');
      btn.className = 'tab-btn';
      btn.type = 'button';
      btn.id = 'btnQualityTrends';
      btn.dataset.tab = TAB;
      btn.textContent = 'Kvalitetstrender';
      btn.title = 'Fabriksadmin: provtagningar, avformningar och hållfasthetstrender';
      btn.addEventListener('click', openQualityTrends);
      const before = nav.querySelector('[data-tab="kontroll"]') || nav.querySelector('[data-tab="utvardering"]') || nav.querySelector('#btnNordcert');
      if (before) nav.insertBefore(btn, before.nextSibling); else nav.appendChild(btn);
    }
    const main = document.querySelector('main.container') || document.querySelector('main');
    if (!main || document.getElementById('tab-quality_trends')) return;
    const section = document.createElement('section');
    section.id = 'tab-quality_trends';
    section.className = 'grid';
    section.style.display = 'none';
    section.innerHTML = `
      <div class="card">
        <div class="quality-trends-header">
          <div>
            <h3>Kvalitetstrender</h3>
            <p class="pill">Fabriksadminrapport uppdelad mellan provtagningar och avformningar. Visar hållfastheter, saknade resultat, låga värden och trender.</p>
          </div>
          <div class="toolbar" id="qtReportActions" style="justify-content:flex-end">
            <button class="btn secondary" id="btnQtRefresh" type="button">Uppdatera data</button>
            <button class="btn" id="btnQtReport" type="button">Skapa rapport</button>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="quality-trends-filters">
          <div><label>Period</label><select id="qtPeriod"><option value="month">Denna månad</option><option value="week">Denna vecka</option><option value="90">Senaste 90 dagar</option><option value="custom">Eget intervall</option></select></div>
          <div><label>Från</label><input id="qtFrom" type="date"></div>
          <div><label>Till</label><input id="qtTo" type="date"></div>
          <div><label>Hållfasthetsklass</label><select id="qtStrength"><option value="">Alla</option></select></div>
          <div><button class="btn secondary" id="btnQtApply" type="button">Tillämpa</button></div>
        </div>
      </div>
      <div id="qtAccessWarning"></div>
      <div class="quality-trends-kpis" id="qtKpis"></div>
      <div class="qt-chart-grid">
        <div class="qt-chart-card"><div class="qt-chart-title"><h3>Provtagningar per vecka</h3><span class="pill" id="qtSampleTrendPill">—</span></div><div id="qtSamplesChart"></div></div>
        <div class="qt-chart-card"><div class="qt-chart-title"><h3>Avformningar per vecka</h3><span class="pill" id="qtDemouldTrendPill">—</span></div><div id="qtDemouldChart"></div></div>
      </div>
      <div class="qt-chart-grid">
        <div class="qt-chart-card"><div class="qt-chart-title"><h3>Hållfasthet per klass</h3><span class="pill">MPa</span></div><div id="qtStrengthTable"></div></div>
        <div class="qt-chart-card"><div class="qt-chart-title"><h3>Bevakning</h3><span class="pill warn">Åtgärdspunkter</span></div><div id="qtWarnings"></div></div>
      </div>
      <div class="card"><h3>Detaljlistor</h3><div class="qt-chart-grid"><div><h4>Provtagningar</h4><div id="qtSamplesTable"></div></div><div><h4>Avformningar</h4><div id="qtDemouldTable"></div></div></div></div>
    `;
    main.appendChild(section);

    document.getElementById('qtPeriod')?.addEventListener('change', applyPeriodPreset);
    document.getElementById('btnQtApply')?.addEventListener('click', render);
    document.getElementById('btnQtRefresh')?.addEventListener('click', async()=>{ await loadData(true); render(); });
    document.getElementById('btnQtReport')?.addEventListener('click', openReport);
    applyPeriodPreset();
  }

  function applyPeriodPreset(){
    const p = document.getElementById('qtPeriod')?.value || 'month';
    const from = document.getElementById('qtFrom');
    const to = document.getElementById('qtTo');
    const now = new Date();
    if (p === 'week') {
      const day = now.getDay() || 7; const d = new Date(now); d.setDate(now.getDate() - day + 1); d.setMinutes(d.getMinutes()-d.getTimezoneOffset());
      if (from) from.value = d.toISOString().slice(0,10); if (to) to.value = todayISO();
    } else if (p === 'month') {
      const d = new Date(now.getFullYear(), now.getMonth(), 1); d.setMinutes(d.getMinutes()-d.getTimezoneOffset());
      if (from) from.value = d.toISOString().slice(0,10); if (to) to.value = todayISO();
    } else if (p === '90') {
      if (from) from.value = addDaysISO(-90); if (to) to.value = todayISO();
    }
    render();
  }

  async function loadData(force){
    if (!currentUser()) return;
    if (!force && state.loadedAt && Date.now() - state.loadedAt < 60000) return;
    state.error = '';

    // Försök först låta den befintliga appen ladda om fabriksdata, så övriga vyer fortsätter vara i synk.
    try {
      if (typeof window.btgLoadFactoryCoreData === 'function') await window.btgLoadFactoryCoreData({ force:true });
      else if (typeof loadCloudCoreData === 'function') await loadCloudCoreData();
    } catch(e){ console.warn('Kunde inte uppdatera core-data för kvalitetstrender:', e); }

    try {
      const s = db();
      const fid = activeFactoryId();
      if (!s) return;
      const userIds = await getFactoryUserIdsForReport(fid);

      const [cubesRes, batchesRes, demRes] = await Promise.all([
        queryByUsers('cubes', 'id,recipe_id,cast_date,due_date,strength_mpa,weight,vct,vct_eq,air,temp,kw,batch_id,note,app_data,created_at,user_id', userIds, 'cast_date'),
        queryByUsers('batches', 'id,recipe_id,amount_m3,datetime,gwp,app_data,created_at,user_id', userIds, 'datetime'),
        (function(){
          let q = s.from('demoulding_cubes').select('*').order('demould_date', { ascending:false });
          if (fid) q = q.eq('factory_id', fid);
          return q;
        })()
      ]);

      if (cubesRes.error) throw cubesRes.error;
      if (batchesRes.error) throw batchesRes.error;
      if (demRes.error) throw demRes.error;

      state.samples = (cubesRes.data || []).map(normalizeSampleRow).filter(x => belongsToFactorySoft(x, fid));
      state.batches = (batchesRes.data || []).map(normalizeBatchRowQt).filter(x => belongsToFactorySoft(x, fid));
      state.demouldings = (demRes.data || []).map(normalizeDemouldingRow);
    } catch(e){
      state.error = e?.message || String(e || 'Okänt fel');
      console.warn('Kunde inte ladda trenddata:', e);
      state.samples = [];
      state.batches = [];
      state.demouldings = [];
    }
    state.loadedAt = Date.now();
  }

  function dataForFilters(){
    const from = document.getElementById('qtFrom')?.value || '';
    const to = document.getElementById('qtTo')?.value || '';
    const strength = document.getElementById('qtStrength')?.value || '';
    const fid = activeFactoryId();
    const sampleSource = state.samples.length ? state.samples : arr('CUBES');
    const batchSource = state.batches.length ? state.batches : arr('BATCHES');
    const cubes = sampleSource.filter(c=>belongsToFactorySoft(c,fid)).filter(c=>dateInRange(c.castDate || c.createdAt, from, to)).filter(c=>!strength || String(c.strengthClass || c.strength || '') === strength);
    const batches = batchSource.filter(b=>belongsToFactorySoft(b,fid)).filter(b=>dateInRange(b.dateTime || b.createdAt, from, to)).filter(b=>!strength || String(b.strength || b.strengthClass || '') === strength);
    const demouldings = state.demouldings.filter(d=>belongsToFactory(d,fid)).filter(d=>dateInRange(d.demouldDate || d.castDate || d.createdAt, from, to)).filter(d=>!strength || String(d.strength || '') === strength);
    return { from, to, strength, cubes, batches, demouldings };
  }

  function analysis(){
    const d = dataForFilters();
    const cubeResults = d.cubes.map(c=>num(c.resultMPa)).filter(v=>v!=null);
    const demResults = d.demouldings.map(x=>num(x.mpa)).filter(v=>v!=null);
    const missingCubes = d.cubes.filter(c=>num(c.resultMPa)==null).length;
    const missingDem = d.demouldings.filter(x=>num(x.mpa)==null).length;
    const lowCubes = d.cubes.filter(c=>{ const f=fckFromStrength(c.strengthClass || c.strength); const r=num(c.resultMPa); return f!=null && r!=null && r < f; });
    const lowDem = d.demouldings.filter(x=>{ const f=fckFromStrength(x.strength); const r=num(x.mpa); return f!=null && r!=null && r < f; });
    const byWeekSamples = groupCount(d.cubes, c=>weekKey(c.castDate || c.createdAt));
    const byWeekDem = groupCount(d.demouldings, x=>weekKey(localDateISO(x.demouldDate || x.castDate || x.createdAt)));
    const byStrength = groupStrength(d.cubes, d.demouldings);
    const warnings = buildWarnings(d, lowCubes, lowDem, missingCubes, missingDem, byStrength);
    return state.lastAnalysis = { ...d, cubeResults, demResults, missingCubes, missingDem, lowCubes, lowDem, byWeekSamples, byWeekDem, byStrength, warnings };
  }

  function groupCount(items, keyFn){
    const m = new Map();
    items.forEach(x=>{ const k = keyFn(x) || '—'; m.set(k, (m.get(k)||0)+1); });
    return Array.from(m.entries()).sort((a,b)=>a[0].localeCompare(b[0])).map(([label,value])=>({label,value}));
  }
  function groupStrength(cubes, demouldings){
    const m = new Map();
    function ensure(k){ if(!m.has(k)) m.set(k,{strength:k||'—', sampleCount:0, demouldCount:0, sampleValues:[], demouldValues:[]}); return m.get(k); }
    cubes.forEach(c=>{ const k=c.strengthClass || c.strength || '—'; const g=ensure(k); g.sampleCount++; const r=num(c.resultMPa); if(r!=null) g.sampleValues.push(r); });
    demouldings.forEach(x=>{ const k=x.strength || '—'; const g=ensure(k); g.demouldCount++; const r=num(x.mpa); if(r!=null) g.demouldValues.push(r); });
    return Array.from(m.values()).map(g=>({ ...g, sampleMean:mean(g.sampleValues), demouldMean:mean(g.demouldValues), sampleMin:min(g.sampleValues), sampleMax:max(g.sampleValues), demouldMin:min(g.demouldValues), demouldMax:max(g.demouldValues), trend:trend(g.sampleValues.concat(g.demouldValues)) })).sort((a,b)=>a.strength.localeCompare(b.strength));
  }
  function buildWarnings(d, lowCubes, lowDem, missingCubes, missingDem, byStrength){
    const out = [];
    if (lowCubes.length || lowDem.length) out.push({type:'danger', title:'Låga hållfasthetsvärden', text:`${lowCubes.length + lowDem.length} resultat ligger under tolkad hållfasthetsklass/fck och bör kontrolleras.`});
    if (missingCubes || missingDem) out.push({type:'warn', title:'Saknade resultat', text:`${missingCubes + missingDem} prov/avformningar saknar MPa-resultat i vald period.`});
    const falling = byStrength.filter(x=>x.trend.cls==='warn');
    if (falling.length) out.push({type:'warn', title:'Sjunkande trend', text:`${falling.map(x=>x.strength).join(', ')} visar sjunkande trend i urvalet.`});
    if (!d.cubes.length && !d.demouldings.length) out.push({type:'', title:'Ingen data i perioden', text:'Välj en längre period eller kontrollera att aktiv fabrik har provtagningar/avformningar.'});
    if (state.error) out.push({type:'warn', title:'Avformningsdata kunde inte laddas', text:state.error});
    if (!out.length) out.push({type:'ok', title:'Inga tydliga bevakningspunkter', text:'Urvalet ser stabilt ut utifrån registrerade värden.'});
    return out;
  }

  function renderStrengthOptions(){
    const select = document.getElementById('qtStrength'); if (!select) return;
    const current = select.value;
    const fid = activeFactoryId();
    const vals = new Set();
    const sampleSource = state.samples.length ? state.samples : arr('CUBES');
    sampleSource.filter(x=>belongsToFactorySoft(x,fid)).forEach(c=>{ const s=c.strengthClass || c.strength; if(s) vals.add(s); });
    state.demouldings.filter(x=>belongsToFactory(x,fid)).forEach(x=>{ if(x.strength) vals.add(x.strength); });
    select.innerHTML = '<option value="">Alla</option>' + Array.from(vals).sort().map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
    if (current && vals.has(current)) select.value = current;
  }
  function kpi(label, value, sub){ return `<div class="qt-kpi"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div><div class="sub">${esc(sub || '')}</div></div>`; }
  function fmt(v, d=1){ const n=num(v); return n==null ? '—' : n.toFixed(d).replace('.', ','); }
  function renderBars(rows, empty){
    if (!rows.length) return `<div class="qt-empty">${esc(empty || 'Ingen data att visa.')}</div>`;
    const maxv = Math.max(1, ...rows.map(r=>Number(r.value)||0));
    return `<div class="qt-bars">${rows.map(r=>`<div class="qt-bar-row"><div class="qt-bar-label" title="${esc(r.label)}">${esc(r.label)}</div><div class="qt-bar-track"><div class="qt-bar-fill" style="width:${Math.max(2, ((Number(r.value)||0)/maxv)*100)}%"></div></div><div class="qt-bar-value">${esc(r.value)}</div></div>`).join('')}</div>`;
  }
  function renderMiniTable(headers, rows, empty){
    if (!rows.length) return `<div class="qt-empty">${esc(empty || 'Ingen data.')}</div>`;
    return `<table class="qt-mini-table"><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
  }
  function render(){
    ensureUI(); allowQualityTrends();
    const warning = document.getElementById('qtAccessWarning');
    if (warning) warning.innerHTML = isFactoryAdmin() ? '' : '<div class="qt-note warn">Denna vy är avsedd för fabriksadmin. Om du saknar rätt roll kan data vara begränsad.</div>';
    renderStrengthOptions();
    const a = analysis();
    const st = a.byStrength;
    document.getElementById('qtKpis').innerHTML = [
      kpi('Provtagningar', a.cubes.length, `${a.cubeResults.length} med MPa-resultat`),
      kpi('Satser', a.batches.length, 'i vald period'),
      kpi('Avformningar', a.demouldings.length, `${a.demResults.length} med MPa-resultat`),
      kpi('Medel prov', fmt(mean(a.cubeResults)), 'MPa'),
      kpi('Medel avformning', fmt(mean(a.demResults)), 'MPa'),
      kpi('Bevakning', a.lowCubes.length + a.lowDem.length + a.missingCubes + a.missingDem, 'låga/saknade värden')
    ].join('');
    document.getElementById('qtSamplesChart').innerHTML = renderBars(a.byWeekSamples, 'Inga provtagningar i vald period.');
    document.getElementById('qtDemouldChart').innerHTML = renderBars(a.byWeekDem, 'Inga avformningar i vald period.');
    const sampleTrend = trend(a.byWeekSamples.map(x=>x.value));
    const demTrend = trend(a.byWeekDem.map(x=>x.value));
    document.getElementById('qtSampleTrendPill').textContent = sampleTrend.label;
    document.getElementById('qtDemouldTrendPill').textContent = demTrend.label;
    document.getElementById('qtStrengthTable').innerHTML = renderMiniTable(['Klass','Prov','Prov medel','Avform','Avform medel','Trend'], st.map(x=>`<tr><td>${esc(x.strength)}</td><td class="qt-right">${x.sampleCount}</td><td class="qt-right">${fmt(x.sampleMean)}</td><td class="qt-right">${x.demouldCount}</td><td class="qt-right">${fmt(x.demouldMean)}</td><td>${esc(x.trend.label)}</td></tr>`), 'Ingen hållfasthetsklass i vald period.');
    document.getElementById('qtWarnings').innerHTML = a.warnings.map(w=>`<div class="qt-note ${esc(w.type)}"><b>${esc(w.title)}</b><br><span>${esc(w.text)}</span></div>`).join('');
    document.getElementById('qtSamplesTable').innerHTML = renderMiniTable(['Datum','Recept','Klass','MPa'], a.cubes.slice(0,50).map(c=>`<tr><td>${esc(localDateISO(c.castDate))}</td><td>${esc(c.recipeName||'—')}</td><td>${esc(c.strengthClass||c.strength||'—')}</td><td class="qt-right">${fmt(c.resultMPa)}</td></tr>`), 'Inga provtagningar.');
    document.getElementById('qtDemouldTable').innerHTML = renderMiniTable(['Datum','Recept','Klass','MPa'], a.demouldings.slice(0,50).map(x=>`<tr><td>${esc(localDateISO(x.demouldDate||x.castDate))}</td><td>${esc(x.recipeName||'—')}</td><td>${esc(x.strength||'—')}</td><td class="qt-right">${fmt(x.mpa)}</td></tr>`), 'Inga avformningar.');
  }

  async function openQualityTrends(){
    ensureUI(); allowQualityTrends();
    document.querySelectorAll('main.container > section[id^="tab-"], main > section[id^="tab-"]').forEach(s=>{ s.style.display = s.id === 'tab-quality_trends' ? 'grid' : 'none'; });
    document.querySelectorAll('.tab-btn').forEach(btn=>btn.setAttribute('aria-current', btn.dataset?.tab === TAB ? 'page' : 'false'));
    await loadData(false);
    render();
  }

  function reportHtml(a){
    const factory = window.BTG_ACCESS_STATE?.factory?.name || window.BTG_FACTORY_ADMIN_STATE?.selectedFactoryName || 'Aktiv fabrik';
    const strengthTxt = a.strength ? ` • ${a.strength}` : '';
    const strengthRows = a.byStrength.map(x=>`<tr><td>${esc(x.strength)}</td><td>${x.sampleCount}</td><td>${fmt(x.sampleMean)}</td><td>${fmt(x.sampleMin)}–${fmt(x.sampleMax)}</td><td>${x.demouldCount}</td><td>${fmt(x.demouldMean)}</td><td>${fmt(x.demouldMin)}–${fmt(x.demouldMax)}</td><td>${esc(x.trend.label)}</td></tr>`).join('');
    const warningHtml = a.warnings.map(w=>`<li><b>${esc(w.title)}:</b> ${esc(w.text)}</li>`).join('');
    return `
      <h1>Kvalitetstrender – ${esc(factory)}</h1>
      <p><b>Period:</b> ${esc(a.from || '—')} – ${esc(a.to || '—')}${esc(strengthTxt)}<br><b>Skapad:</b> ${new Date().toLocaleString('sv-SE')}</p>
      <h2>Sammanfattning</h2>
      <table><tbody>
        <tr><th>Provtagningar</th><td>${a.cubes.length}</td><th>Avformningar</th><td>${a.demouldings.length}</td></tr>
        <tr><th>Medel prov</th><td>${fmt(mean(a.cubeResults))} MPa</td><th>Medel avformning</th><td>${fmt(mean(a.demResults))} MPa</td></tr>
        <tr><th>Saknade resultat</th><td>${a.missingCubes + a.missingDem}</td><th>Låga resultat</th><td>${a.lowCubes.length + a.lowDem.length}</td></tr>
      </tbody></table>
      <h2>Provtagningar</h2>${renderMiniTable(['Vecka','Antal'], a.byWeekSamples.map(r=>`<tr><td>${esc(r.label)}</td><td>${r.value}</td></tr>`), 'Inga provtagningar.')}
      <h2>Avformningar</h2>${renderMiniTable(['Vecka','Antal'], a.byWeekDem.map(r=>`<tr><td>${esc(r.label)}</td><td>${r.value}</td></tr>`), 'Inga avformningar.')}
      <h2>Hållfasthet per klass</h2><table><thead><tr><th>Klass</th><th>Prov</th><th>Prov medel</th><th>Prov min–max</th><th>Avform</th><th>Avform medel</th><th>Avform min–max</th><th>Trend</th></tr></thead><tbody>${strengthRows || '<tr><td colspan="8">Ingen data.</td></tr>'}</tbody></table>
      <h2>Bevakning / åtgärdspunkter</h2><ul>${warningHtml}</ul>
    `;
  }
  function openReport(){
    const a = state.lastAnalysis || analysis();
    const html = reportHtml(a);
    if (typeof openPrintWindow === 'function') { openPrintWindow('Kvalitetstrender', html); return; }
    const w = window.open('', '_blank');
    if (!w) return alert('Popup blockerades. Tillåt popup för att skapa rapporten.');
    w.document.write(`<!doctype html><html lang="sv"><head><meta charset="utf-8"><title>Kvalitetstrender</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111827}table{border-collapse:collapse;width:100%;margin:.7rem 0}th,td{border:1px solid #d1d5db;padding:6px 8px;text-align:left}th{background:#f3f4f6}h1,h2{margin-top:1rem}</style></head><body>${html}<script>setTimeout(()=>window.print(),300)<\/script></body></html>`);
    w.document.close();
  }


  function installNavigationCleanup(){
    if (window.__BTG_QT_NAV_CLEANUP_INSTALLED) return;
    window.__BTG_QT_NAV_CLEANUP_INSTALLED = true;
    document.addEventListener('click', function(e){
      const btn = e.target?.closest?.('[data-tab], [data-nav]');
      const tab = btn?.dataset?.tab || btn?.getAttribute?.('data-nav') || '';
      if (!tab || tab === TAB) return;
      const qtBtn = document.getElementById('btnQualityTrends');
      const qtSection = document.getElementById('tab-quality_trends');
      if (qtBtn) qtBtn.setAttribute('aria-current', 'false');
      if (qtSection) qtSection.style.display = 'none';
    }, true);
  }

  function init(){
    ensureUI();
    installNavigationCleanup();
    setInterval(function(){ allowQualityTrends(); const b=document.getElementById('btnQualityTrends'); if(b) b.style.display = isFactoryAdmin() || !currentUser() ? '' : 'none'; }, 1200);
    try { window.sb?.auth?.onAuthStateChange?.(()=>setTimeout(()=>{ ensureUI(); allowQualityTrends(); }, 800)); } catch(_) {}
  }

  window.openQualityTrends = openQualityTrends;
  window.renderQualityTrends = render;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
