/***********************************************************
 * v19.3.1 – AVFORMNINGSKUBER + DATUMVÄLJARE
 * Isolerad patch ovanpå v19.3.
 * Datumväljare styr vilka prefabgjutningar som visas för avformning.
 ***********************************************************/
(function(){
  if (window.__BTG_V193_DEMOULDING_PATCHED) return;
  window.__BTG_V193_DEMOULDING_PATCHED = true;

  let DEMOULDING_CUBES = [];
  let DEMOULDING_TABLE_READY = true;
  let DEMOULDING_LAST_ERROR = '';
  let DEMOULDING_LAST_VIEW = [];

  function esc(v){
    if (typeof escapeHtml === 'function') return escapeHtml(v);
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function uid(){ return (typeof uuid === 'function') ? uuid() : ('demould_' + Date.now() + '_' + Math.random().toString(16).slice(2)); }
  function currentUser(){ return (typeof CURRENT_USER !== 'undefined') ? CURRENT_USER : null; }
  function localISO(d){
    const x = d ? new Date(d) : new Date();
    x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
    return x.toISOString().slice(0,10);
  }
  function yesterdayISO(){ const d = new Date(); d.setDate(d.getDate() - 1); return localISO(d); }
  function selectedDemouldingCastDate(){
    const el = document.getElementById('demouldingCastDate');
    const val = (el?.value || '').trim();
    return val || yesterdayISO();
  }
  function ensureDemouldingCastDateDefault(){
    const el = document.getElementById('demouldingCastDate');
    if (el && !el.value) el.value = yesterdayISO();
  }
  function fmtDateTime(v){ try { return v ? new Date(v).toLocaleString('sv-SE', { dateStyle:'short', timeStyle:'short' }) : '—'; } catch { return v || '—'; } }
  function fmtDateOnly(v){ try { return v ? new Date(v).toLocaleDateString('sv-SE') : '—'; } catch { return v || '—'; } }
  function numOrNull(v){ const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; }
  function textVal(id){ return (document.getElementById(id)?.value || '').trim(); }
  function numberText(v, decimals){ const n = Number(v); return Number.isFinite(n) ? n.toFixed(decimals) : '—'; }

  function batchCloudId(b){ return String(b?.cloudId || b?.id || ''); }
  function batchHumanId(b){ return b?.batchId || b?.app_data?.batchId || b?.app_data?.batch_id || b?.app_data?.satsId || b?.id || ''; }
  function productionType(b){
    const raw = b?.productionType || b?.app_data?.productionType || b?.app_data?.production_type || (b?.source === 'customer_order' ? 'order' : (b?.source === 'prefab_queue' ? 'prefab' : ''));
    return raw || '';
  }
  function isPrefabBatch(b){ return productionType(b) === 'prefab' || b?.source === 'prefab_queue'; }
  function batchCastISO(b){ return localISO(b?.dateTime || b?.datetime || b?.createdAt || new Date()); }
  function isCompleted(batch){
    const id = batchCloudId(batch);
    return !!id && DEMOULDING_CUBES.some(x => String(x.batchCloudId || '') === id);
  }
  function historyForBatch(batch){
    const id = batchCloudId(batch);
    return DEMOULDING_CUBES.find(x => String(x.batchCloudId || '') === id) || null;
  }

  function normalizeDemouldingRow(row){
    const app = row?.app_data || {};
    return {
      ...app,
      id: row.id || app.id || uid(),
      cloudId: row.id || app.cloudId || null,
      batchCloudId: row.batch_cloud_id || app.batchCloudId || '',
      batchId: row.batch_id || app.batchId || '',
      batchDateTime: row.batch_datetime || app.batchDateTime || '',
      castDate: row.cast_date || app.castDate || '',
      demouldDate: row.demould_date || app.demouldDate || localISO(),
      recipeId: row.recipe_id || app.recipeId || '',
      recipeName: row.recipe_name || app.recipeName || '',
      strength: row.strength || app.strength || '',
      productionType: row.production_type || app.productionType || 'prefab',
      customerId: row.customer_id || app.customerId || '',
      customerName: row.customer_name || app.customerName || '',
      prefabRequestId: row.prefab_request_id || app.prefabRequestId || '',
      factoryId: row.factory_id || app.factoryId || '',
      amount: row.amount_m3 ?? app.amount ?? null,
      mpa: row.mpa ?? app.mpa ?? null,
      pressTime: row.press_time || app.pressTime || '',
      employeeNo: row.employee_no || app.employeeNo || '',
      comment: row.comment || app.comment || '',
      createdAt: row.created_at || app.createdAt || new Date().toISOString(),
      updatedAt: row.updated_at || app.updatedAt || row.created_at || new Date().toISOString()
    };
  }

  async function loadDemouldingCubes(){
    if (typeof sb === 'undefined' || !sb || !currentUser()) { DEMOULDING_CUBES = []; return; }
    try{
      const { data, error } = await sb
        .from('demoulding_cubes')
        .select('id,batch_cloud_id,batch_id,batch_datetime,cast_date,demould_date,recipe_id,recipe_name,strength,production_type,customer_id,customer_name,prefab_request_id,factory_id,amount_m3,mpa,press_time,employee_no,comment,app_data,created_at,updated_at')
        .eq('user_id', currentUser().id)
        .order('demould_date', { ascending:false })
        .order('created_at', { ascending:false });
      if (error) throw error;
      DEMOULDING_TABLE_READY = true;
      DEMOULDING_LAST_ERROR = '';
      DEMOULDING_CUBES = (data || []).map(normalizeDemouldingRow);
    }catch(err){
      DEMOULDING_TABLE_READY = false;
      DEMOULDING_LAST_ERROR = err?.message || String(err || 'Okänt fel');
      console.warn('Kunde inte ladda avformningskuber. Har SQL-migrationen körts?', err);
    }
  }

  async function saveDemouldingCube(record){
    if (typeof getRequiredCloudUser !== 'function') { alert('Molnauth saknas. Ladda om appen.'); return null; }
    const user = await getRequiredCloudUser('spara avformningskub i molnet');
    if (!user) return null;
    if (typeof sb === 'undefined' || !sb) { alert('Supabase är inte tillgängligt.'); return null; }

    const appData = { ...record, cloudId: record.cloudId || null };
    const payload = {
      user_id: user.id,
      batch_cloud_id: record.batchCloudId || null,
      batch_id: record.batchId || '',
      batch_datetime: record.batchDateTime || null,
      cast_date: record.castDate || null,
      demould_date: record.demouldDate || localISO(),
      recipe_id: record.recipeId || null,
      recipe_name: record.recipeName || '',
      strength: record.strength || '',
      production_type: record.productionType || 'prefab',
      customer_id: record.customerId || null,
      customer_name: record.customerName || '',
      prefab_request_id: record.prefabRequestId || null,
      factory_id: record.factoryId || null,
      amount_m3: Number.isFinite(Number(record.amount)) ? Number(record.amount) : null,
      mpa: Number(record.mpa),
      press_time: record.pressTime || '',
      employee_no: record.employeeNo || '',
      comment: record.comment || '',
      app_data: appData,
      updated_at: new Date().toISOString()
    };

    try{
      const { data, error } = await sb
        .from('demoulding_cubes')
        .upsert(payload, { onConflict: 'user_id,batch_cloud_id' })
        .select('id,batch_cloud_id,batch_id,batch_datetime,cast_date,demould_date,recipe_id,recipe_name,strength,production_type,customer_id,customer_name,prefab_request_id,factory_id,amount_m3,mpa,press_time,employee_no,comment,app_data,created_at,updated_at')
        .single();
      if (error) throw error;
      const saved = normalizeDemouldingRow(data);
      DEMOULDING_TABLE_READY = true;
      DEMOULDING_LAST_ERROR = '';
      DEMOULDING_CUBES = [saved, ...DEMOULDING_CUBES.filter(x => String(x.cloudId || x.id) !== String(saved.cloudId || saved.id) && String(x.batchCloudId || '') !== String(saved.batchCloudId || ''))];
      return saved;
    }catch(err){
      DEMOULDING_TABLE_READY = false;
      DEMOULDING_LAST_ERROR = err?.message || String(err || 'Okänt fel');
      if (typeof showSupabaseError === 'function') showSupabaseError('Fel vid sparning av avformningskub i Supabase', err);
      else alert('Fel vid sparning av avformningskub: ' + DEMOULDING_LAST_ERROR);
      return null;
    }
  }

  function ensureDemouldingUI(){
    if (document.getElementById('tab-avformningskuber')) return;

    const nav = document.querySelector('header .main-nav') || document.querySelector('.main-nav') || document.querySelector('nav.toolbar');
    if (nav && !nav.querySelector('[data-tab="avformningskuber"]')){
      const btn = document.createElement('button');
      btn.className = 'tab-btn';
      btn.type = 'button';
      btn.dataset.tab = 'avformningskuber';
      btn.textContent = 'Avformningskuber';
      btn.addEventListener('click', () => setTab('avformningskuber'));
      const before = nav.querySelector('[data-tab="provningar"]') || nav.querySelector('[data-tab="utvardering"]') || nav.querySelector('[data-tab="dagbok"]');
      if (before) nav.insertBefore(btn, before.nextSibling);
      else nav.appendChild(btn);
    }

    const main = document.querySelector('main.container') || document.querySelector('main');
    if (!main) return;
    const section = document.createElement('section');
    section.id = 'tab-avformningskuber';
    section.className = 'grid';
    section.style.display = 'none';
    section.innerHTML = `
      <div class="card">
        <div class="row" style="justify-content:space-between;align-items:flex-start;flex-wrap:wrap;">
          <div>
            <h3>Avformningskuber</h3>
            <div class="demoulding-status-line">
              <span class="pill ok">v19.3.1</span>
              <span class="pill" id="demouldingTargetDateLabel">Valt gjutdatum</span>
              <span class="pill" id="demouldingCloudStatus">Väntar på molndata…</span>
            </div>
          </div>
          <div class="toolbar" style="justify-content:flex-end;">
            <button class="btn secondary" id="btnRefreshDemoulding" type="button">Uppdatera</button>
            <button class="btn secondary" id="btnExportDemouldingPDF" type="button">Exportera PDF</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="row" style="justify-content:space-between;align-items:end;gap:.75rem;flex-wrap:wrap;">
          <div>
            <h3>Att avforma</h3>
            <p class="pill">Välj gjutdatum för prefab-satserna som ska avformas. Gårdagen är förvald. Fyll MPa, trycktid, anställningsnummer och eventuell kommentar, klicka sedan Klar.</p>
          </div>
          <div style="max-width:240px;min-width:190px;">
            <label>Gjutdatum att visa</label>
            <input type="date" id="demouldingCastDate">
          </div>
        </div>
        <div style="overflow:auto; max-height:520px; margin-top:.6rem">
          <table id="demouldingTodayTable">
            <thead><tr>
              <th>Gjutning</th><th>Sats-ID</th><th>Recept</th><th data-v19520-littra="1">Littra/ritning</th><th data-v19523-table-no="1">Bord</th><th>Prefab/beställning</th><th>Kund</th><th>Mängd</th><th>Registrering</th><th>Status</th>
            </tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h3>Historik</h3>
        <div class="row demoulding-history-filters">
          <div><label>Från</label><input type="date" id="demouldingHistoryFrom"></div>
          <div><label>Till</label><input type="date" id="demouldingHistoryTo"></div>
          <div><label>Filter</label><input id="demouldingHistorySearch" placeholder="sats, recept, kund, anställningsnummer"></div>
          <div class="toolbar"><button class="btn secondary" id="btnApplyDemouldingHistory" type="button">Filtrera</button><button class="btn secondary" id="btnClearDemouldingHistory" type="button">Rensa</button></div>
        </div>
        <div id="demouldingHistorySummary" class="pill" style="margin-top:.6rem">Ingen historik laddad.</div>
        <div style="overflow:auto; max-height:520px; margin-top:.6rem">
          <table id="demouldingHistoryTable">
            <thead><tr>
              <th>Avformning</th><th>Gjutdatum</th><th>Sats-ID</th><th>Recept</th><th>Kund</th><th>MPa</th><th>Trycktid</th><th>Anst.nr</th><th>Kommentar</th>
            </tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>`;

    const footer = main.querySelector('footer');
    if (footer) main.insertBefore(section, footer);
    else main.appendChild(section);
    try { tabs.avformningskuber = section; } catch(e) { console.warn('Kunde inte registrera Avformningskuber-flik:', e); }

    ensureDemouldingCastDateDefault();
    document.getElementById('demouldingCastDate')?.addEventListener('change', () => {
      renderDemouldingStatus();
      renderDemouldingToday();
    });
    document.getElementById('btnRefreshDemoulding')?.addEventListener('click', refreshDemouldingModule);
    document.getElementById('btnApplyDemouldingHistory')?.addEventListener('click', renderDemouldingHistory);
    document.getElementById('btnClearDemouldingHistory')?.addEventListener('click', () => {
      ['demouldingHistoryFrom','demouldingHistoryTo','demouldingHistorySearch'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      renderDemouldingHistory();
    });
    document.getElementById('btnExportDemouldingPDF')?.addEventListener('click', exportDemouldingPDF);
  }

  function prefabBatchesForSelectedDate(){
    const target = selectedDemouldingCastDate();
    return (Array.isArray(BATCHES) ? BATCHES : [])
      .filter(b => isPrefabBatch(b) && batchCastISO(b) === target)
      .sort((a,b) => String(a.dateTime || '').localeCompare(String(b.dateTime || '')));
  }

  function renderDemouldingStatus(){
    const target = document.getElementById('demouldingTargetDateLabel');
    ensureDemouldingCastDateDefault();
    const selected = selectedDemouldingCastDate();
    if (target) target.textContent = 'Gjutdatum: ' + fmtDateOnly(selected);
    const status = document.getElementById('demouldingCloudStatus');
    if (!status) return;
    if (!currentUser()) status.textContent = 'Logga in för att se och spara molndata.';
    else if (!DEMOULDING_TABLE_READY) status.textContent = 'SQL saknas eller kunde inte läsas: ' + DEMOULDING_LAST_ERROR;
    else status.textContent = 'Historik laddad: ' + DEMOULDING_CUBES.length + ' avformningar';
  }

  function renderDemouldingToday(){
    const tbody = document.querySelector('#demouldingTodayTable tbody');
    if (!tbody) return;
    if (!currentUser()){
      tbody.innerHTML = '<tr><td colspan="10"><span class="pill warn">Logga in för att arbeta med avformningskuber.</span></td></tr>';
      return;
    }
    if (!DEMOULDING_TABLE_READY){
      tbody.innerHTML = `<tr><td colspan="9"><span class="pill danger">Kör SQL-migrationen för demoulding_cubes först. ${esc(DEMOULDING_LAST_ERROR)}</span></td></tr>`;
      return;
    }
    const rows = prefabBatchesForSelectedDate();
    if (!rows.length){
      tbody.innerHTML = '<tr><td colspan="9">Inga prefabgjutningar hittades för valt gjutdatum i tillverkningsjournalen.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((b, idx) => {
      const done = historyForBatch(b);
      const rowClass = done ? ' class="demoulding-done-row"' : '';
      const inputId = 'demoulding-row-' + idx;
      const typeTxt = productionType(b) === 'order' ? 'Beställning' : 'Prefab';
      const app = b.app_data || {};
      const littra = b.drawingNo || b.drawing_no || app.drawingNo || app.drawing_no || app.littra || app.littera || '';
      const tableNo = window.sanitizeDemouldingTableNo ? window.sanitizeDemouldingTableNo(b.tableNo || b.table_no || app.tableNo || app.table_no || app.bord || app.bordsnr || '') : (b.tableNo || b.table_no || app.tableNo || app.table_no || app.bord || app.bordsnr || '');
      return `<tr${rowClass} data-batch-cloud-id="${esc(batchCloudId(b))}">
        <td>${esc(fmtDateTime(b.dateTime))}</td>
        <td>${esc(batchHumanId(b) || '—')}</td>
        <td>${esc(b.recipeName || '—')}<span class="demoulding-small">${esc(b.strength || '')}</span></td>
        <td>${esc(littra || '—')}</td>
        <td>${esc(tableNo || '—')}</td>
        <td>${esc(typeTxt)}</td>
        <td>${esc(b.customerName || b.app_data?.customerName || b.app_data?.customer_name || '—')}</td>
        <td>${numberText(b.amount, 2)} m³</td>
        <td>
          ${done ? `<span class="pill ok">Sparad ${esc(fmtDateOnly(done.demouldDate))}</span><span class="demoulding-small">${numberText(done.mpa,1)} MPa • ${esc(done.employeeNo)}</span>` : `
          <div class="demoulding-input-row" id="${inputId}">
            <div><label>MPa</label><input type="number" step="0.1" min="0" data-field="mpa"></div>
            <div><label>Trycktid</label><input type="text" data-field="pressTime" placeholder="t.ex. 08:15"></div>
            <div><label>Anst.nr</label><input type="text" data-field="employeeNo" placeholder="t.ex. 1234"></div>
            <div><label>Kommentar</label><input type="text" data-field="comment" placeholder="valfritt"></div>
            <button class="btn" type="button" data-demoulding-save="${idx}">Klar</button>
          </div>`}
        </td>
        <td>${done ? '<span class="pill ok">Klar</span>' : '<span class="pill warn">Ej klar</span>'}</td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('[data-demoulding-save]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const b = rows[Number(btn.getAttribute('data-demoulding-save'))];
        await completeDemouldingBatch(b, btn.closest('tr'));
      });
    });
  }

  async function completeDemouldingBatch(batch, rowEl){
    const box = rowEl?.querySelector('.demoulding-input-row');
    if (!batch || !box) return;
    const mpa = numOrNull(box.querySelector('[data-field="mpa"]')?.value);
    const pressTime = (box.querySelector('[data-field="pressTime"]')?.value || '').trim();
    const employeeNo = (box.querySelector('[data-field="employeeNo"]')?.value || '').trim();
    const comment = (box.querySelector('[data-field="comment"]')?.value || '').trim();
    if (!Number.isFinite(mpa) || mpa <= 0){ alert('Fyll i MPa med ett värde större än 0.'); return; }
    if (!pressTime){ alert('Fyll i trycktid.'); return; }
    if (!employeeNo){ alert('Fyll i anställningsnummer.'); return; }

    const record = {
      id: uid(),
      batchCloudId: batchCloudId(batch),
      batchId: batchHumanId(batch),
      batchDateTime: batch.dateTime || batch.datetime || '',
      castDate: batchCastISO(batch),
      demouldDate: localISO(),
      recipeId: batch.recipeCloudId || batch.recipeId || null,
      recipeName: batch.recipeName || '',
      strength: batch.strength || '',
      productionType: productionType(batch) || 'prefab',
      drawingNo: batch.drawingNo || batch.drawing_no || batch.app_data?.drawingNo || batch.app_data?.drawing_no || batch.app_data?.littra || batch.app_data?.littera || '',
      customerId: batch.customerId || batch.app_data?.customerId || null,
      customerName: batch.customerName || batch.app_data?.customerName || batch.app_data?.customer_name || '',
      prefabRequestId: batch.prefabRequestId || batch.app_data?.prefabRequestId || batch.app_data?.prefab_request_id || null,
      factoryId: batch.prefabFactoryId || batch.app_data?.prefabFactoryId || batch.app_data?.factory_id || null,
      amount: batch.amount ?? null,
      mpa,
      pressTime,
      employeeNo,
      comment,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const saved = await saveDemouldingCube(record);
    if (!saved) return;
    renderDemouldingStatus();
    renderDemouldingToday();
    renderDemouldingHistory();
  }

  function filteredHistory(){
    const from = textVal('demouldingHistoryFrom');
    const to = textVal('demouldingHistoryTo');
    const q = textVal('demouldingHistorySearch').toLowerCase();
    return (DEMOULDING_CUBES || []).filter(r => {
      const d = r.demouldDate || '';
      const hay = [r.batchId, r.recipeName, r.strength, r.customerName, r.employeeNo, r.comment].join(' ').toLowerCase();
      return (!from || d >= from) && (!to || d <= to) && (!q || hay.includes(q));
    }).sort((a,b) => String(b.demouldDate || '').localeCompare(String(a.demouldDate || '')) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }

  function renderDemouldingHistory(){
    const tbody = document.querySelector('#demouldingHistoryTable tbody');
    const summary = document.getElementById('demouldingHistorySummary');
    if (!tbody) return;
    if (!currentUser()){
      tbody.innerHTML = '<tr><td colspan="9">Logga in för att se historik.</td></tr>';
      if (summary) summary.textContent = 'Ingen användare inloggad.';
      DEMOULDING_LAST_VIEW = [];
      return;
    }
    if (!DEMOULDING_TABLE_READY){
      tbody.innerHTML = `<tr><td colspan="9"><span class="pill danger">SQL saknas eller kunde inte läsas: ${esc(DEMOULDING_LAST_ERROR)}</span></td></tr>`;
      if (summary) summary.textContent = 'Historik kunde inte laddas.';
      DEMOULDING_LAST_VIEW = [];
      return;
    }
    const rows = filteredHistory();
    DEMOULDING_LAST_VIEW = rows;
    if (summary){
      const avg = rows.length ? rows.reduce((sum,r)=>sum + (Number(r.mpa)||0), 0) / rows.length : 0;
      summary.textContent = rows.length ? `${rows.length} avformningar • snitt ${avg.toFixed(1)} MPa` : 'Ingen historik matchar filtret.';
    }
    tbody.innerHTML = rows.length ? rows.map(r => `<tr>
      <td>${esc(fmtDateOnly(r.demouldDate))}<span class="demoulding-small">${esc(fmtDateTime(r.createdAt))}</span></td>
      <td>${esc(fmtDateOnly(r.castDate))}</td>
      <td>${esc(r.batchId || '—')}</td>
      <td>${esc(r.recipeName || '—')}<span class="demoulding-small">${esc(r.strength || '')}</span></td>
      <td>${esc(r.customerName || '—')}</td>
      <td>${numberText(r.mpa, 1)}</td>
      <td>${esc(r.pressTime || '—')}</td>
      <td>${esc(r.employeeNo || '—')}</td>
      <td>${esc(r.comment || '')}</td>
    </tr>`).join('') : '<tr><td colspan="9">Ingen historik.</td></tr>';
  }

  async function refreshDemouldingModule(){
    if (currentUser() && typeof loadCloudCoreData === 'function') {
      try { await loadCloudCoreData(); } catch(e){ console.warn('Kunde inte uppdatera molndata för Avformningskuber:', e); }
    } else {
      await loadDemouldingCubes();
    }
    renderDemouldingStatus();
    renderDemouldingToday();
    renderDemouldingHistory();
  }

  async function exportDemouldingPDF(){
    if (currentUser() && typeof loadDemouldingCubes === 'function') await loadDemouldingCubes();
    const rows = DEMOULDING_LAST_VIEW.length ? DEMOULDING_LAST_VIEW : filteredHistory();
    const meta = (typeof reportMetaHTML === 'function') ? reportMetaHTML() : `<div class="meta">Skapad: ${esc(new Date().toLocaleString('sv-SE'))}</div>`;
    const bodyRows = rows.map(r => `<tr>
      <td>${esc(fmtDateOnly(r.demouldDate))}</td><td>${esc(fmtDateOnly(r.castDate))}</td><td>${esc(r.batchId || '—')}</td>
      <td>${esc(r.recipeName || '—')}</td><td>${esc(r.strength || '')}</td><td>${esc(r.customerName || '—')}</td>
      <td class="right">${numberText(r.amount,2)}</td><td class="right">${numberText(r.mpa,1)}</td><td>${esc(r.pressTime || '—')}</td><td>${esc(r.employeeNo || '—')}</td><td>${esc(r.comment || '')}</td>
    </tr>`).join('') || '<tr><td colspan="12">Ingen historik.</td></tr>';
    const html = `<h1>Avformningskuber</h1>${meta}
      <p><b>Filter:</b> ${esc(textVal('demouldingHistoryFrom') || '—')} till ${esc(textVal('demouldingHistoryTo') || '—')} • ${esc(textVal('demouldingHistorySearch') || 'Alla')}</p>
      <table><thead><tr><th>Avformning</th><th>Gjutdatum</th><th>Sats-ID</th><th>Recept</th><th>Hållfasthet</th><th>Kund</th><th>m³</th><th>MPa</th><th>Trycktid</th><th>Anst.nr</th><th>Kommentar</th></tr></thead><tbody>${bodyRows}</tbody></table>`;
    if (typeof openPrintWindow === 'function') openPrintWindow('Avformningskuber', html);
    else { const w = window.open('', '_blank'); w.document.write(html); w.document.close(); w.print(); }
  }

  function patchCore(){
    try{
      const oldLoad = loadCloudCoreData;
      loadCloudCoreData = async function(){
        const res = await oldLoad.apply(this, arguments);
        await loadDemouldingCubes();
        return res;
      };
    }catch(e){ console.warn('Kunde inte koppla Avformningskuber till molnladdning:', e); }

    try{
      const oldSetTab = setTab;
      setTab = async function(name){
        if (name === 'avformningskuber'){
          ensureDemouldingUI();
          for (const [k, el] of Object.entries(tabs)) if (el) el.style.display = (k === name ? 'grid' : 'none');
          document.querySelectorAll('.tab-btn').forEach(btn => btn.setAttribute('aria-current', btn.dataset.tab === name ? 'page' : 'false'));
          await refreshDemouldingModule();
          if (document.body.classList.contains('sidebar-open')) document.body.classList.remove('sidebar-open');
          return;
        }
        const res = await oldSetTab.apply(this, arguments);
        const section = document.getElementById('tab-avformningskuber');
        if (section) section.style.display = 'none';
        return res;
      };
    }catch(e){ console.warn('Kunde inte koppla Avformningskuber till fliksystem:', e); }

    try{
      const oldLogout = authLogout;
      authLogout = async function(){
        const res = await oldLogout.apply(this, arguments);
        DEMOULDING_CUBES = [];
        renderDemouldingStatus(); renderDemouldingToday(); renderDemouldingHistory();
        return res;
      };
    }catch(e){ /* äldre versioner utan authLogout */ }

    try{
      const oldBuildFullBackup = buildFullBackup;
      buildFullBackup = function(){
        const backup = oldBuildFullBackup.apply(this, arguments);
        backup.version = Math.max(Number(backup.version || 0), 3);
        backup.data = backup.data || {};
        backup.data.demouldingCubes = DEMOULDING_CUBES.slice();
        return backup;
      };
    }catch(e){ /* äldre versioner utan buildFullBackup */ }
  }

  function init(){
    ensureDemouldingUI();
    patchCore();
    loadDemouldingCubes().then(() => { renderDemouldingStatus(); renderDemouldingHistory(); }).catch(()=>{});
  }

  window.BTG_DEMOULDING_CUBES = () => DEMOULDING_CUBES.slice();
  window.loadDemouldingCubes = loadDemouldingCubes;
  window.renderDemouldingHistory = renderDemouldingHistory;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
