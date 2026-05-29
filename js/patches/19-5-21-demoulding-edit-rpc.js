(function(){
  if (window.__BTG_V19521_DEMOULDING_EDIT_RPC) return;
  window.__BTG_V19521_DEMOULDING_EDIT_RPC = true;

  let loading = false;
  let lastError = '';
  let rowsCache = [];

  function s(){ try { return window.sb || sb || null; } catch(_) { return window.sb || null; } }
  function current(){ try { return window.CURRENT_USER || CURRENT_USER || null; } catch(_) { return window.CURRENT_USER || null; } }
  function esc(v){
    if (typeof escapeHtml === 'function') return escapeHtml(v);
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function num(v, d){ const n = Number(v); return Number.isFinite(n) ? n.toFixed(d) : '—'; }
  function val(id){ return (document.getElementById(id)?.value || '').trim(); }
  function fmtDateOnly(v){ try { return v ? new Date(v).toLocaleDateString('sv-SE') : '—'; } catch(_) { return v || '—'; } }
  function fmtDateTime(v){ try { return v ? new Date(v).toLocaleString('sv-SE', { dateStyle:'short', timeStyle:'short' }) : '—'; } catch(_) { return v || '—'; } }
  function activeFactoryId(){
    try{
      return window.BTG_FACTORY_ADMIN_STATE?.selectedFactoryId
        || window.BTG_ACCESS_STATE?.profile?.factory_id
        || window.BTG_ACCESS_STATE?.factory?.id
        || window.BTG_ACCESS_STATE?.factory?.factory_id
        || null;
    }catch(_){ return null; }
  }
  function drawingNoFromApp(app){ return app?.drawingNo || app?.drawing_no || app?.littra || app?.littera || ''; }
  function normalize(r){
    const app = r?.app_data || {};
    return {
      id: r.id || app.id || '',
      userId: r.user_id || app.userId || '',
      batchCloudId: r.batch_cloud_id || app.batchCloudId || '',
      batchId: r.batch_id || app.batchId || app.batch_id || '',
      batchDateTime: r.batch_datetime || app.batchDateTime || '',
      castDate: r.cast_date || app.castDate || '',
      demouldDate: r.demould_date || app.demouldDate || '',
      recipeName: r.recipe_name || app.recipeName || '',
      strength: r.strength || app.strength || '',
      customerName: r.customer_name || app.customerName || app.customer_name || '',
      drawingNo: drawingNoFromApp(app),
      tableNo: (window.sanitizeDemouldingTableNo ? window.sanitizeDemouldingTableNo(app.tableNo || app.table_no || app.bord || app.bordsnr || '') : (app.tableNo || app.table_no || app.bord || app.bordsnr || '')),
      amount: r.amount_m3 ?? app.amount ?? null,
      mpa: r.mpa ?? app.mpa ?? null,
      pressTime: r.press_time || app.pressTime || '',
      employeeNo: r.employee_no || app.employeeNo || '',
      comment: r.comment || app.comment || '',
      createdAt: r.created_at || app.createdAt || '',
      updatedAt: r.updated_at || app.updatedAt || '',
      app_data: app
    };
  }
  async function factoryUserIds(){
    const db = s();
    const fid = activeFactoryId();
    const u = current();
    if (!db || !fid) return u?.id ? [u.id] : [];
    try{
      const { data, error } = await db.rpc('btg_factory_user_ids', { p_factory_id: fid });
      if (error) throw error;
      const ids = Array.from(new Set((data || []).map(x => String(x.user_id || x.uid || x)).filter(Boolean)));
      return ids.length ? ids : (u?.id ? [u.id] : []);
    }catch(err){
      console.warn('Avformning v19.5.21: kunde inte läsa fabriksanvändare:', err);
      return u?.id ? [u.id] : [];
    }
  }
  async function loadHistory(){
    const db = s();
    const u = current();
    if (!db || !u){ rowsCache = []; return rowsCache; }
    const ids = await factoryUserIds();
    try{
      let q = db.from('demoulding_cubes')
        .select('id,user_id,batch_cloud_id,batch_id,batch_datetime,cast_date,demould_date,recipe_id,recipe_name,strength,production_type,customer_id,customer_name,prefab_request_id,factory_id,amount_m3,mpa,press_time,employee_no,comment,app_data,created_at,updated_at')
        .order('demould_date', { ascending:false })
        .order('created_at', { ascending:false });
      q = ids.length ? q.in('user_id', ids) : q.eq('user_id', u.id);
      const { data, error } = await q;
      if (error) throw error;
      lastError = '';
      rowsCache = (data || []).map(normalize);
      return rowsCache;
    }catch(err){
      lastError = err?.message || String(err || 'Kunde inte läsa avformningshistorik');
      console.warn('Avformning v19.5.21: historik:', err);
      rowsCache = [];
      return rowsCache;
    }
  }
  function filtered(){
    const from = val('demouldingHistoryFrom');
    const to = val('demouldingHistoryTo');
    const q = val('demouldingHistorySearch').toLowerCase();
    return (rowsCache || []).filter(r => {
      const d = r.demouldDate || '';
      const hay = [r.batchId, r.recipeName, r.strength, r.customerName, r.drawingNo, r.tableNo, r.employeeNo, r.comment].join(' ').toLowerCase();
      return (!from || d >= from) && (!to || d <= to) && (!q || hay.includes(q));
    }).sort((a,b) => String(b.demouldDate || '').localeCompare(String(a.demouldDate || '')) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }
  function patchHistoryHeader(){
    const tr = document.querySelector('#demouldingHistoryTable thead tr');
    if (!tr) return;
    if (!tr.querySelector('[data-v19521-littra]')){
      const th = document.createElement('th');
      th.textContent = 'Littra/ritning';
      th.setAttribute('data-v19521-littra','1');
      tr.insertBefore(th, tr.children[5] || null);
    }
    if (!tr.querySelector('[data-v19523-history-table-no]')){
      const th = document.createElement('th');
      th.textContent = 'Bord';
      th.setAttribute('data-v19523-history-table-no','1');
      const littraTh = tr.querySelector('[data-v19521-littra]');
      tr.insertBefore(th, littraTh ? littraTh.nextSibling : (tr.children[6] || null));
    }
    if (!tr.querySelector('[data-v19521-actions]')){
      const th = document.createElement('th');
      th.textContent = '';
      th.setAttribute('data-v19521-actions','1');
      tr.appendChild(th);
    }
  }
  function renderHistory(){
    patchHistoryHeader();
    const tbody = document.querySelector('#demouldingHistoryTable tbody');
    const summary = document.getElementById('demouldingHistorySummary');
    if (!tbody) return;
    if (!current()){
      tbody.innerHTML = '<tr><td colspan="12">Logga in för att se historik.</td></tr>';
      if (summary) summary.textContent = 'Ingen användare inloggad.';
      return;
    }
    if (lastError){
      tbody.innerHTML = `<tr><td colspan="12"><span class="pill danger">Historik kunde inte laddas: ${esc(lastError)}</span></td></tr>`;
      if (summary) summary.textContent = 'Historik kunde inte laddas.';
      return;
    }
    const rows = filtered();
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
      <td>${esc(r.drawingNo || '—')}</td>
      <td>${esc(r.tableNo || '—')}</td>
      <td>${num(r.mpa, 1)}</td>
      <td>${esc(r.pressTime || '—')}</td>
      <td>${esc(r.employeeNo || '—')}</td>
      <td>${esc(r.comment || '')}</td>
      <td><button class="btn secondary" type="button" data-v19521-edit-demoulding="${esc(r.id)}">Redigera</button></td>
    </tr>`).join('') : '<tr><td colspan="12">Ingen historik.</td></tr>';
  }
  async function refresh(){
    if (loading) return;
    loading = true;
    try{
      await loadHistory();
      renderHistory();
      try { window.btgRefreshDemouldingV19520?.(); } catch(_) {}
    } finally { loading = false; }
  }
  async function editRow(id){
    const row = (rowsCache || []).find(r => String(r.id) === String(id));
    if (!row){ alert('Avformningskub hittades inte i laddad historik.'); return; }
    const mpaRaw = prompt('MPa', row.mpa ?? '');
    if (mpaRaw === null) return;
    const mpa = Number(String(mpaRaw).replace(',', '.'));
    if (!Number.isFinite(mpa) || mpa <= 0){ alert('MPa måste vara större än 0.'); return; }
    const pressTime = prompt('Trycktid', row.pressTime || '');
    if (pressTime === null) return;
    if (!String(pressTime).trim()){ alert('Trycktid måste anges.'); return; }
    const employeeNo = prompt('Anställningsnummer', row.employeeNo || '');
    if (employeeNo === null) return;
    if (!String(employeeNo).trim()){ alert('Anställningsnummer måste anges.'); return; }
    const comment = prompt('Kommentar', row.comment || '');
    if (comment === null) return;
    const drawingNo = prompt('Littra / ritningsnr', row.drawingNo || '');
    if (drawingNo === null) return;
    const db = s();
    if (!db){ alert('Supabase är inte tillgängligt.'); return; }
    const { error } = await db.rpc('btg_update_demoulding_cube', {
      p_id: row.id,
      p_mpa: mpa,
      p_press_time: String(pressTime).trim(),
      p_employee_no: String(employeeNo).trim(),
      p_comment: String(comment || ''),
      p_drawing_no: String(drawingNo || '')
    });
    if (error){ alert('Kunde inte redigera avformningskub: ' + (error.message || error)); return; }
    await refresh();
  }
  function bind(){
    document.addEventListener('click', e => {
      const id = e.target?.getAttribute?.('data-v19521-edit-demoulding');
      if (id){ e.preventDefault(); editRow(id); return; }
      if (e.target?.dataset?.tab === 'avformningskuber' || e.target?.id === 'btnRefreshDemoulding') setTimeout(refresh, 180);
    }, true);
    document.addEventListener('change', e => {
      if (['demouldingHistoryFrom','demouldingHistoryTo','demouldingHistorySearch','btgFactorySelector'].includes(e.target?.id)) setTimeout(refresh, 120);
    }, true);
    document.addEventListener('input', e => {
      if (e.target?.id === 'demouldingHistorySearch') renderHistory();
    }, true);
  }

  window.loadDemouldingCubesV19521 = loadHistory;
  window.renderDemouldingHistoryV19521 = renderHistory;
  window.refreshDemouldingV19521 = refresh;
  window.loadDemouldingCubes = refresh;
  window.renderDemouldingHistory = renderHistory;

  function init(){ bind(); setTimeout(refresh, 550); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
