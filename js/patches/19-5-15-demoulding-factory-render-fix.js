(function(){
  if (window.__BTG_V19515_DEMOULDING_FACTORY_RENDER_FIX) return;
  window.__BTG_V19515_DEMOULDING_FACTORY_RENDER_FIX = true;

  let cachedFactoryBatches = [];
  let cachedHistory = [];
  let loading = false;
  let lastError = '';

  function sbc(){ try { return window.sb || sb || null; } catch(_) { return window.sb || null; } }
  function user(){ try { return window.CURRENT_USER || CURRENT_USER || null; } catch(_) { return window.CURRENT_USER || null; } }
  function activeFactoryId(){
    try {
      return window.BTG_FACTORY_ADMIN_STATE?.selectedFactoryId
        || window.BTG_ACCESS_STATE?.profile?.factory_id
        || window.BTG_ACCESS_STATE?.factory?.id
        || window.BTG_ACCESS_STATE?.factory?.factory_id
        || null;
    } catch(_) { return null; }
  }
  function esc(v){
    if (typeof escapeHtml === 'function') return escapeHtml(v);
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function localISO(v){
    const d = v ? new Date(v) : new Date();
    if (Number.isNaN(d.getTime())) return '';
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0,10);
  }
  function fmtDateTime(v){ try { return v ? new Date(v).toLocaleString('sv-SE', { dateStyle:'short', timeStyle:'short' }) : '—'; } catch(_) { return v || '—'; } }
  function fmtDateOnly(v){ try { return v ? new Date(v).toLocaleDateString('sv-SE') : '—'; } catch(_) { return v || '—'; } }
  function numberText(v, decimals){ const n = Number(v); return Number.isFinite(n) ? n.toFixed(decimals) : '—'; }
  function selectedDate(){
    const el = document.getElementById('demouldingCastDate');
    if (el?.value) return el.value;
    const d = new Date(); d.setDate(d.getDate() - 1);
    const iso = localISO(d);
    if (el) el.value = iso;
    return iso;
  }
  function uniqById(rows){
    const seen = new Set();
    const out = [];
    (rows || []).forEach(r => {
      const key = String(r.cloudId || r.id || r.app_data?.id || JSON.stringify([r.dateTime,r.recipeName,r.batchId]));
      if (!seen.has(key)){ seen.add(key); out.push(r); }
    });
    return out;
  }
  function normalizeBatch(row){
    try { if (typeof normalizeBatchRow === 'function' && row && row.app_data !== undefined) return normalizeBatchRow(row); } catch(_) {}
    const app = row?.app_data || row || {};
    return {
      ...app,
      id: row?.id || app.id,
      cloudId: row?.id || app.cloudId || app.id,
      recipeId: app.recipeId || row?.recipe_id || '',
      recipeCloudId: row?.recipe_id || app.recipeCloudId || null,
      recipeName: app.recipeName || app.recipe_name || '',
      strength: app.strength || '',
      amount: app.amount ?? row?.amount_m3 ?? 0,
      dateTime: app.dateTime || row?.datetime || app.datetime || row?.created_at || new Date().toISOString(),
      source: app.source || '',
      productionType: app.productionType || app.production_type || '',
      customerId: app.customerId || app.customer_id || null,
      customerName: app.customerName || app.customer_name || '',
      prefabRequestId: app.prefabRequestId || app.prefab_request_id || null,
      prefabFactoryId: app.prefabFactoryId || app.factory_id || null,
      tableNo: (window.sanitizeDemouldingTableNo ? window.sanitizeDemouldingTableNo(app.tableNo || app.table_no || app.bord || app.bordsnr || '') : (app.tableNo || app.table_no || app.bord || app.bordsnr || '')),
      drawingNo: app.drawingNo || app.drawing_no || app.littra || app.littera || '',
      createdAt: row?.created_at || app.createdAt || new Date().toISOString()
    };
  }
  function productionType(b){
    const app = b?.app_data || {};
    return b?.productionType || b?.production_type || app.productionType || app.production_type || (b?.source === 'customer_order' || app.source === 'customer_order' ? 'order' : (b?.source === 'prefab_queue' || app.source === 'prefab_queue' ? 'prefab' : ''));
  }
  function isPrefabBatch(b){
    const app = b?.app_data || {};
    const pt = String(productionType(b) || '').toLowerCase();
    return pt === 'prefab'
      || b?.source === 'prefab_queue'
      || app.source === 'prefab_queue'
      || !!(b?.prefabRequestId || app.prefabRequestId || app.prefab_request_id)
      || !!(b?.prefabFactoryId || app.prefabFactoryId || app.factory_id)
      || !!(b?.tableNo || app.tableNo || app.table_no || b?.drawingNo || app.drawingNo || app.drawing_no || app.littra || app.littera);
  }
  function batchDate(b){ return localISO(b?.dateTime || b?.datetime || b?.createdAt || b?.created_at); }
  function batchCloudId(b){ return String(b?.cloudId || b?.id || b?.app_data?.cloudId || b?.app_data?.id || ''); }
  function batchHumanId(b){ const app = b?.app_data || {}; return b?.batchId || app.batchId || app.batch_id || app.satsId || b?.id || ''; }
  function drawingNo(b){ const app = b?.app_data || {}; return b?.drawingNo || b?.drawing_no || app.drawingNo || app.drawing_no || app.littra || app.littera || ''; }
  function tableNo(b){
    const app = b?.app_data || {};
    const raw = b?.tableNo || b?.table_no || app.tableNo || app.table_no || app.bord || app.bordsnr || '';
    return window.sanitizeDemouldingTableNo ? window.sanitizeDemouldingTableNo(raw) : raw;
  }
  function findRecipeName(b){
    if (b?.recipeName) return b.recipeName;
    const rid = b?.recipeCloudId || b?.recipeId;
    const rec = (Array.isArray(RECIPES) ? RECIPES : []).find(r => String(r.cloudId || r.id) === String(rid) || String(r.id) === String(rid));
    return rec?.name || '—';
  }
  function findStrength(b){
    if (b?.strength) return b.strength;
    const rid = b?.recipeCloudId || b?.recipeId;
    const rec = (Array.isArray(RECIPES) ? RECIPES : []).find(r => String(r.cloudId || r.id) === String(rid) || String(r.id) === String(rid));
    return rec?.strength || '';
  }
  async function factoryUserIds(){
    const db = sbc();
    const fid = activeFactoryId();
    if (!db || !fid) return user()?.id ? [user().id] : [];
    try{
      const { data, error } = await db.rpc('btg_factory_user_ids', { p_factory_id: fid });
      if (error) throw error;
      const ids = Array.from(new Set((data || []).map(r => String(r.user_id || r.uid || r)).filter(Boolean)));
      return ids.length ? ids : (user()?.id ? [user().id] : []);
    }catch(err){
      console.warn('Avformning: kunde inte läsa factory user ids:', err);
      return user()?.id ? [user().id] : [];
    }
  }
  async function loadFactoryBatches(){
    const db = sbc();
    if (!db || !user()) return [];
    const ids = await factoryUserIds();
    if (!ids.length) return [];
    try{
      const { data, error } = await db
        .from('batches')
        .select('id,recipe_id,amount_m3,datetime,gwp,app_data,created_at,user_id')
        .in('user_id', ids)
        .order('datetime', { ascending:false })
        .limit(800);
      if (error) throw error;
      cachedFactoryBatches = (data || []).map(normalizeBatch);
    }catch(err){
      lastError = err?.message || String(err || 'Kunde inte läsa satser');
      console.warn('Avformning: kunde inte läsa batches direkt:', err);
      cachedFactoryBatches = [];
    }
    const globalBatches = Array.isArray(BATCHES) ? BATCHES : [];
    return uniqById([ ...globalBatches, ...cachedFactoryBatches ]);
  }
  async function loadHistory(){
    const db = sbc();
    if (!db || !user()) { cachedHistory = []; return []; }
    const ids = await factoryUserIds();
    try{
      let q = db.from('demoulding_cubes')
        .select('id,user_id,batch_cloud_id,batch_id,batch_datetime,cast_date,demould_date,recipe_id,recipe_name,strength,production_type,customer_id,customer_name,prefab_request_id,factory_id,amount_m3,mpa,press_time,employee_no,comment,app_data,created_at,updated_at')
        .order('demould_date', { ascending:false })
        .order('created_at', { ascending:false });
      q = ids.length ? q.in('user_id', ids) : q.eq('user_id', user().id);
      const { data, error } = await q;
      if (error) throw error;
      cachedHistory = (data || []).map(r => ({
        id: r.id,
        batchCloudId: r.batch_cloud_id || r.app_data?.batchCloudId || '',
        batchId: r.batch_id || r.app_data?.batchId || '',
        batchDateTime: r.batch_datetime || r.app_data?.batchDateTime || '',
        castDate: r.cast_date || r.app_data?.castDate || '',
        demouldDate: r.demould_date || r.app_data?.demouldDate || '',
        recipeName: r.recipe_name || r.app_data?.recipeName || '',
        strength: r.strength || r.app_data?.strength || '',
        customerName: r.customer_name || r.app_data?.customerName || '',
        amount: r.amount_m3 ?? r.app_data?.amount ?? null,
        mpa: r.mpa ?? r.app_data?.mpa ?? null,
        pressTime: r.press_time || r.app_data?.pressTime || '',
        employeeNo: r.employee_no || r.app_data?.employeeNo || '',
        comment: r.comment || r.app_data?.comment || '',
        createdAt: r.created_at || ''
      }));
    }catch(err){
      lastError = err?.message || String(err || 'Kunde inte läsa avformningshistorik');
      console.warn('Avformning: kunde inte läsa historik:', err);
      cachedHistory = [];
    }
    return cachedHistory;
  }
  function historyForBatch(b){
    const id = batchCloudId(b);
    return cachedHistory.find(h => id && String(h.batchCloudId) === id) || null;
  }
  function candidatesForSelectedDate(all){
    const date = selectedDate();
    return (all || [])
      .filter(isPrefabBatch)
      .filter(b => batchDate(b) === date)
      .sort((a,b) => String(a.dateTime || '').localeCompare(String(b.dateTime || '')));
  }
  function knownPrefabDates(all){
    return Array.from(new Set((all || []).filter(isPrefabBatch).map(batchDate).filter(Boolean))).sort().reverse().slice(0,10);
  }
  function setStatus(allRows, rows){
    const el = document.getElementById('demouldingCloudStatus');
    const label = document.getElementById('demouldingTargetDateLabel');
    if (label) label.textContent = 'Gjutdatum: ' + fmtDateOnly(selectedDate());
    if (!el) return;
    const totalPrefab = (allRows || []).filter(isPrefabBatch).length;
    const fid = activeFactoryId();
    el.textContent = `Aktiv fabrik: ${fid ? 'vald' : 'saknas'} • prefab-satser: ${totalPrefab} • valt datum: ${rows.length}` + (lastError ? ` • ${lastError}` : '');
  }
  async function saveDemoulding(batch, rowEl){
    const db = sbc();
    const u = user();
    if (!db || !u){ alert('Supabase inte tillgänglig eller användare saknas. Ladda om appen.'); return; }
    const box = rowEl?.querySelector('.demoulding-input-row');
    const mpa = Number(String(box?.querySelector('[data-field="mpa"]')?.value || '').replace(',', '.'));
    const pressTime = (box?.querySelector('[data-field="pressTime"]')?.value || '').trim();
    const employeeNo = (box?.querySelector('[data-field="employeeNo"]')?.value || '').trim();
    const comment = (box?.querySelector('[data-field="comment"]')?.value || '').trim();
    if (!Number.isFinite(mpa) || mpa <= 0){ alert('Fyll i MPa med ett värde större än 0.'); return; }
    if (!pressTime){ alert('Fyll i trycktid.'); return; }
    if (!employeeNo){ alert('Fyll i anställningsnummer.'); return; }
    const recName = findRecipeName(batch);
    const strength = findStrength(batch);
    const app = {
      batchCloudId: batchCloudId(batch),
      batchId: batchHumanId(batch),
      batchDateTime: batch.dateTime || batch.datetime || '',
      castDate: batchDate(batch),
      demouldDate: localISO(),
      recipeId: batch.recipeCloudId || batch.recipeId || null,
      recipeName: recName === '—' ? '' : recName,
      strength,
      productionType: 'prefab',
      drawingNo: drawingNo(batch),
      customerId: batch.customerId || batch.app_data?.customerId || null,
      customerName: batch.customerName || batch.app_data?.customerName || batch.app_data?.customer_name || '',
      prefabRequestId: batch.prefabRequestId || batch.app_data?.prefabRequestId || batch.app_data?.prefab_request_id || null,
      factoryId: batch.prefabFactoryId || batch.app_data?.prefabFactoryId || batch.app_data?.factory_id || activeFactoryId(),
      amount: batch.amount ?? null,
      mpa,
      pressTime,
      employeeNo,
      comment,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const payload = {
      user_id: u.id,
      batch_cloud_id: app.batchCloudId || null,
      batch_id: app.batchId || null,
      batch_datetime: app.batchDateTime || null,
      cast_date: app.castDate || selectedDate(),
      demould_date: app.demouldDate,
      recipe_id: app.recipeId || null,
      recipe_name: app.recipeName || null,
      strength: app.strength || null,
      production_type: 'prefab',
      customer_id: app.customerId || null,
      customer_name: app.customerName || null,
      prefab_request_id: app.prefabRequestId || null,
      factory_id: app.factoryId || null,
      amount_m3: Number(app.amount) || null,
      mpa,
      press_time: pressTime,
      employee_no: employeeNo,
      comment: comment || null,
      app_data: app
    };
    const { error } = await db.from('demoulding_cubes').insert([payload]);
    if (error){ alert('Kunde inte spara avformningskub: ' + (error.message || error)); return; }
    await window.btgRefreshDemouldingV19515();
  }
  async function render(){
    const tbody = document.querySelector('#demouldingTodayTable tbody');
    if (!tbody) return;
    if (loading) return;
    loading = true;
    lastError = '';
    try{
      const [all] = await Promise.all([loadFactoryBatches(), loadHistory()]);
      const rows = candidatesForSelectedDate(all);
      setStatus(all, rows);
      if (!user()){
        tbody.innerHTML = '<tr><td colspan="10"><span class="pill warn">Logga in för att arbeta med avformningskuber.</span></td></tr>';
        return;
      }
      if (!rows.length){
        const dates = knownPrefabDates(all);
        tbody.innerHTML = `<tr><td colspan="10">Inga prefabgjutningar hittades för valt gjutdatum. ${dates.length ? 'Datum med prefab-satser: ' + dates.map(d => `<button class="btn secondary" type="button" data-demould-date="${esc(d)}" style="margin:.15rem">${esc(fmtDateOnly(d))}</button>`).join(' ') : 'Inga prefab-satser hittades i aktiv fabrik.'}</td></tr>`;
        tbody.querySelectorAll('[data-demould-date]').forEach(btn => btn.addEventListener('click', () => {
          const input = document.getElementById('demouldingCastDate');
          if (input) input.value = btn.getAttribute('data-demould-date') || '';
          window.btgRefreshDemouldingV19515();
        }));
        return;
      }
      tbody.innerHTML = rows.map((b, idx) => {
        const done = historyForBatch(b);
        const recName = findRecipeName(b);
        const strength = findStrength(b);
        const customer = b.customerName || b.app_data?.customerName || b.app_data?.customer_name || '—';
        const littra = drawingNo(b) || '—';
        return `<tr${done ? ' class="demoulding-done-row"' : ''}>
          <td>${esc(fmtDateTime(b.dateTime))}</td>
          <td>${esc(batchHumanId(b) || '—')}</td>
          <td>${esc(recName)}<span class="demoulding-small">${esc(strength || '')}</span></td>
          <td>${esc(littra)}</td>
          <td>${esc(tableNo(b) || '—')}</td>
          <td>Prefab</td>
          <td>${esc(customer)}</td>
          <td>${numberText(b.amount, 2)} m³</td>
          <td>${done ? `<span class="pill ok">Sparad ${esc(fmtDateOnly(done.demouldDate))}</span><span class="demoulding-small">${numberText(done.mpa,1)} MPa • ${esc(done.employeeNo)}</span>` : `
            <div class="demoulding-input-row">
              <div><label>MPa</label><input type="number" step="0.1" min="0" data-field="mpa"></div>
              <div><label>Trycktid</label><input type="text" data-field="pressTime" placeholder="t.ex. 08:15"></div>
              <div><label>Anst.nr</label><input type="text" data-field="employeeNo" placeholder="t.ex. 1234"></div>
              <div><label>Kommentar</label><input type="text" data-field="comment" placeholder="valfritt"></div>
              <button class="btn" type="button" data-v19515-save="${idx}">Klar</button>
            </div>`}</td>
          <td>${done ? '<span class="pill ok">Klar</span>' : '<span class="pill warn">Ej klar</span>'}</td>
        </tr>`;
      }).join('');
      tbody.querySelectorAll('[data-v19515-save]').forEach(btn => btn.addEventListener('click', () => {
        const b = rows[Number(btn.getAttribute('data-v19515-save'))];
        saveDemoulding(b, btn.closest('tr'));
      }));
    } finally {
      loading = false;
    }
  }
  function patchTab(){
    const oldSetTab = window.setTab || (typeof setTab === 'function' ? setTab : null);
    if (typeof oldSetTab === 'function' && !oldSetTab.__btgV19515DemouldWrapped){
      const wrapped = async function(name){
        const res = await oldSetTab.apply(this, arguments);
        if (name === 'avformningskuber') {
          setTimeout(render, 80);
          setTimeout(render, 500);
        }
        return res;
      };
      wrapped.__btgV19515DemouldWrapped = true;
      window.setTab = setTab = wrapped;
    }
  }
  function bind(){
    document.addEventListener('change', e => {
      if (e.target?.id === 'demouldingCastDate' || e.target?.id === 'btgFactorySelector') setTimeout(render, 80);
    }, true);
    document.addEventListener('click', e => {
      if (e.target?.id === 'btnRefreshDemoulding') setTimeout(render, 120);
    }, true);
  }
  async function refresh(){ await render(); }
  window.btgRefreshDemouldingV19515 = refresh;
  function init(){ patchTab(); bind(); if (document.getElementById('tab-avformningskuber')?.style.display !== 'none') setTimeout(render, 300); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
