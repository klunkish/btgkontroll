(function(){
  if (window.__BTG_V19526_DEMOULDING_FULL_EDIT) return;
  window.__BTG_V19526_DEMOULDING_FULL_EDIT = true;
  let rowsCache = [];
  let loading = false;
  let lastError = '';

  function db(){ try { return window.sb || sb || null; } catch(_) { return window.sb || null; } }
  function user(){ try { return window.CURRENT_USER || CURRENT_USER || null; } catch(_) { return window.CURRENT_USER || null; } }
  function esc(v){ if (typeof escapeHtml === 'function') return escapeHtml(v); return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function val(id){ return (document.getElementById(id)?.value || '').trim(); }
  function num(v,d){ const n=Number(v); return Number.isFinite(n) ? n.toFixed(d) : '—'; }
  function dateOnly(v){ if(!v) return ''; const s=String(v); if(/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10); try { return new Date(v).toISOString().slice(0,10); } catch(_) { return ''; } }
  function fmtDate(v){ try { return v ? new Date(v).toLocaleDateString('sv-SE') : '—'; } catch(_) { return v || '—'; } }
  function fmtTime(v){ try { return v ? new Date(v).toLocaleString('sv-SE', { dateStyle:'short', timeStyle:'short' }) : '—'; } catch(_) { return v || '—'; } }
  function activeFactoryId(){ try { return window.BTG_FACTORY_ADMIN_STATE?.selectedFactoryId || window.BTG_ACCESS_STATE?.profile?.factory_id || window.BTG_ACCESS_STATE?.factory?.id || window.BTG_ACCESS_STATE?.factory?.factory_id || null; } catch(_) { return null; } }
  function cleanTable(v){ if (window.sanitizeDemouldingTableNo) return window.sanitizeDemouldingTableNo(v); const t=String(v||'').trim(); return /^(prefab|order|prefab_queue)$/i.test(t) ? '' : t; }
  function fromApp(app, keys){ for (const k of keys){ const v=app?.[k]; if (v !== undefined && v !== null && String(v).trim() !== '') return v; } return ''; }
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
      recipeId: r.recipe_id || app.recipeId || '',
      recipeName: r.recipe_name || app.recipeName || '',
      strength: r.strength || app.strength || '',
      productionType: r.production_type || app.productionType || app.source || '',
      customerId: r.customer_id || app.customerId || '',
      customerName: r.customer_name || app.customerName || app.customer_name || '',
      drawingNo: fromApp(app, ['drawingNo','drawing_no','littra','littera']),
      tableNo: cleanTable(fromApp(app, ['tableNo','table_no','bord','bordsnr'])),
      amount: r.amount_m3 ?? app.amount ?? app.amount_m3 ?? null,
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
    const s = db(); const fid = activeFactoryId(); const u = user();
    if (!s || !fid) return u?.id ? [u.id] : [];
    try{
      const { data, error } = await s.rpc('btg_factory_user_ids', { p_factory_id: fid });
      if (error) throw error;
      const ids = Array.from(new Set((data || []).map(x => String(x.user_id || x.uid || x)).filter(Boolean)));
      return ids.length ? ids : (u?.id ? [u.id] : []);
    }catch(e){ return u?.id ? [u.id] : []; }
  }
  async function load(){
    const s = db(); const u = user();
    if (!s || !u){ rowsCache=[]; return rowsCache; }
    try{
      const ids = await factoryUserIds();
      let q = s.from('demoulding_cubes')
        .select('id,user_id,batch_cloud_id,batch_id,batch_datetime,cast_date,demould_date,recipe_id,recipe_name,strength,production_type,customer_id,customer_name,prefab_request_id,factory_id,amount_m3,mpa,press_time,employee_no,comment,app_data,created_at,updated_at')
        .order('demould_date', { ascending:false }).order('created_at', { ascending:false });
      q = ids.length ? q.in('user_id', ids) : q.eq('user_id', u.id);
      const { data, error } = await q;
      if (error) throw error;
      lastError=''; rowsCache=(data||[]).map(normalize); return rowsCache;
    }catch(e){ lastError=e?.message || String(e || 'Kunde inte läsa historik'); rowsCache=[]; return rowsCache; }
  }
  function filtered(){
    const from=val('demouldingHistoryFrom'), to=val('demouldingHistoryTo'), q=val('demouldingHistorySearch').toLowerCase();
    return (rowsCache||[]).filter(r=>{
      const d=String(r.demouldDate||'').slice(0,10);
      const hay=[r.batchId,r.recipeName,r.strength,r.customerName,r.drawingNo,r.tableNo,r.amount,r.mpa,r.pressTime,r.employeeNo,r.comment].join(' ').toLowerCase();
      return (!from || d>=from) && (!to || d<=to) && (!q || hay.includes(q));
    }).sort((a,b)=>String(b.demouldDate||'').localeCompare(String(a.demouldDate||'')) || String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  }
  function ensureHistoryHeader(){
    const tr=document.querySelector('#demouldingHistoryTable thead tr'); if(!tr) return;
    tr.innerHTML = '<th>Avformning</th><th>Gjutdatum</th><th>Sats-ID</th><th>Recept</th><th>Kund</th><th>Littra/ritning</th><th>Bord</th><th>m³</th><th>MPa</th><th>Trycktid</th><th>Anst.nr</th><th>Kommentar</th><th></th>';
  }
  function render(){
    ensureHistoryHeader();
    const tbody=document.querySelector('#demouldingHistoryTable tbody'); const summary=document.getElementById('demouldingHistorySummary');
    if(!tbody) return;
    if(!user()){ tbody.innerHTML='<tr><td colspan="13">Logga in för att se historik.</td></tr>'; if(summary) summary.textContent='Ingen användare inloggad.'; return; }
    if(lastError){ tbody.innerHTML=`<tr><td colspan="13"><span class="pill danger">Historik kunde inte laddas: ${esc(lastError)}</span></td></tr>`; if(summary) summary.textContent='Historik kunde inte laddas.'; return; }
    const rows=filtered();
    if(summary){ const avg=rows.length ? rows.reduce((s,r)=>s+(Number(r.mpa)||0),0)/rows.length : 0; summary.textContent = rows.length ? `${rows.length} avformningar • snitt ${avg.toFixed(1)} MPa` : 'Ingen historik matchar filtret.'; }
    tbody.innerHTML = rows.length ? rows.map(r=>`<tr>
      <td>${esc(fmtDate(r.demouldDate))}<span class="demoulding-small">${esc(fmtTime(r.createdAt))}</span></td>
      <td>${esc(fmtDate(r.castDate))}</td>
      <td>${esc(r.batchId || '—')}</td>
      <td>${esc(r.recipeName || '—')}<span class="demoulding-small">${esc(r.strength || '')}</span></td>
      <td>${esc(r.customerName || '—')}</td>
      <td>${esc(r.drawingNo || '—')}</td>
      <td>${esc(r.tableNo || '—')}</td>
      <td>${r.amount == null || r.amount === '' ? '—' : esc(num(r.amount,2))}</td>
      <td>${esc(num(r.mpa,1))}</td>
      <td>${esc(r.pressTime || '—')}</td>
      <td>${esc(r.employeeNo || '—')}</td>
      <td>${esc(r.comment || '')}</td>
      <td><button class="btn secondary" type="button" data-v19526-edit-demoulding="${esc(r.id)}">Redigera allt</button></td>
    </tr>`).join('') : '<tr><td colspan="13">Ingen historik.</td></tr>';
  }
  async function refresh(){ if(loading) return; loading=true; try{ await load(); render(); try{ window.btgRefreshDemouldingV19520?.(); }catch(_){} } finally { loading=false; } }

  function ensureDialog(){
    let dlg=document.getElementById('demouldingFullEditDialog');
    if(dlg) return dlg;
    dlg=document.createElement('dialog');
    dlg.id='demouldingFullEditDialog';
    dlg.innerHTML=`<form method="dialog" id="demouldingFullEditForm" class="container" novalidate>
      <div class="row" style="justify-content:space-between;align-items:center;"><h3>Redigera avformningskub</h3><button type="button" class="btn secondary" data-v19526-close>Stäng</button></div>
      <input type="hidden" id="demouldingFullEditId">
      <div class="grid grid-3">
        <div><label>Avformningsdatum</label><input id="demouldingFullDemouldDate" type="date"></div>
        <div><label>Gjutdatum</label><input id="demouldingFullCastDate" type="date"></div>
        <div><label>Sats-ID</label><input id="demouldingFullBatchId" type="text"></div>
        <div><label>Recept</label><input id="demouldingFullRecipeName" type="text"></div>
        <div><label>Hållfasthet</label><input id="demouldingFullStrength" type="text"></div>
        <div><label>Kund</label><input id="demouldingFullCustomerName" type="text"></div>
        <div><label>Littra / ritningsnr</label><input id="demouldingFullDrawingNo" type="text"></div>
        <div><label>Bord</label><input id="demouldingFullTableNo" type="text"></div>
        <div><label>Mängd (m³)</label><input id="demouldingFullAmount" type="number" min="0" step="0.01"></div>
        <div><label>MPa</label><input id="demouldingFullMpa" type="number" min="0" step="0.1"></div>
        <div><label>Trycktid</label><input id="demouldingFullPressTime" type="text"></div>
        <div><label>Anställningsnummer</label><input id="demouldingFullEmployeeNo" type="text"></div>
      </div>
      <div style="margin-top:.6rem"><label>Kommentar</label><textarea id="demouldingFullComment"></textarea></div>
      <p class="pill" style="margin-top:.5rem">Ändringar sparas i både kolumner och app_data där fälten används.</p>
      <div class="row" style="justify-content:flex-end;gap:.5rem;margin-top:.7rem;"><button type="button" class="btn secondary" data-v19526-close>Avbryt</button><button type="button" class="btn" id="btnSaveDemouldingFullEdit">Spara allt</button></div>
    </form>`;
    document.body.appendChild(dlg);
    dlg.addEventListener('click', e=>{ if(e.target?.hasAttribute?.('data-v19526-close')) dlg.close(); });
    document.getElementById('btnSaveDemouldingFullEdit')?.addEventListener('click', saveDialog);
    return dlg;
  }
  function openEdit(id){
    const r=(rowsCache||[]).find(x=>String(x.id)===String(id)); if(!r){ alert('Avformningskub hittades inte i laddad historik.'); return; }
    const dlg=ensureDialog();
    document.getElementById('demouldingFullEditId').value=r.id||'';
    document.getElementById('demouldingFullDemouldDate').value=dateOnly(r.demouldDate);
    document.getElementById('demouldingFullCastDate').value=dateOnly(r.castDate);
    document.getElementById('demouldingFullBatchId').value=r.batchId||'';
    document.getElementById('demouldingFullRecipeName').value=r.recipeName||'';
    document.getElementById('demouldingFullStrength').value=r.strength||'';
    document.getElementById('demouldingFullCustomerName').value=r.customerName||'';
    document.getElementById('demouldingFullDrawingNo').value=r.drawingNo||'';
    document.getElementById('demouldingFullTableNo').value=r.tableNo||'';
    document.getElementById('demouldingFullAmount').value=(r.amount ?? '') === null ? '' : (r.amount ?? '');
    document.getElementById('demouldingFullMpa').value=(r.mpa ?? '') === null ? '' : (r.mpa ?? '');
    document.getElementById('demouldingFullPressTime').value=r.pressTime||'';
    document.getElementById('demouldingFullEmployeeNo').value=r.employeeNo||'';
    document.getElementById('demouldingFullComment').value=r.comment||'';
    if(typeof dlg.showModal==='function') dlg.showModal(); else dlg.setAttribute('open','open');
  }
  async function saveDialog(){
    const s=db(); if(!s){ alert('Supabase är inte tillgängligt.'); return; }
    const id=val('demouldingFullEditId');
    const mpa=Number(String(val('demouldingFullMpa')).replace(',','.'));
    const amountRaw=val('demouldingFullAmount');
    const amount=amountRaw ? Number(String(amountRaw).replace(',','.')) : null;
    if(!id){ alert('Saknar ID.'); return; }
    if(!Number.isFinite(mpa) || mpa<=0){ alert('MPa måste vara större än 0.'); return; }
    if(amountRaw && (!Number.isFinite(amount) || amount<0)){ alert('Mängd måste vara 0 eller större.'); return; }
    if(!val('demouldingFullPressTime')){ alert('Trycktid måste anges.'); return; }
    if(!val('demouldingFullEmployeeNo')){ alert('Anställningsnummer måste anges.'); return; }
    const { error } = await s.rpc('btg_update_demoulding_cube_full', {
      p_id:id,
      p_demould_date: val('demouldingFullDemouldDate') || null,
      p_cast_date: val('demouldingFullCastDate') || null,
      p_batch_id: val('demouldingFullBatchId'),
      p_recipe_name: val('demouldingFullRecipeName'),
      p_strength: val('demouldingFullStrength'),
      p_customer_name: val('demouldingFullCustomerName'),
      p_drawing_no: val('demouldingFullDrawingNo'),
      p_table_no: val('demouldingFullTableNo'),
      p_amount_m3: amount,
      p_mpa: mpa,
      p_press_time: val('demouldingFullPressTime'),
      p_employee_no: val('demouldingFullEmployeeNo'),
      p_comment: val('demouldingFullComment')
    });
    if(error){ alert('Kunde inte spara avformningskub: ' + (error.message || error)); return; }
    document.getElementById('demouldingFullEditDialog')?.close?.();
    await refresh();
  }
  function bind(){
    document.addEventListener('click', e=>{
      const id=e.target?.getAttribute?.('data-v19526-edit-demoulding');
      if(id){ e.preventDefault(); e.stopPropagation(); openEdit(id); return; }
      if(e.target?.dataset?.tab==='avformningskuber' || e.target?.id==='btnRefreshDemoulding') setTimeout(refresh,220);
    }, true);
    document.addEventListener('change', e=>{ if(['demouldingHistoryFrom','demouldingHistoryTo','demouldingHistorySearch','btgFactorySelector'].includes(e.target?.id)) setTimeout(refresh,140); }, true);
    document.addEventListener('input', e=>{ if(e.target?.id==='demouldingHistorySearch') render(); }, true);
  }
  window.loadDemouldingCubesV19526 = load;
  window.renderDemouldingHistoryV19526 = render;
  window.refreshDemouldingV19526 = refresh;
  window.loadDemouldingCubes = refresh;
  window.renderDemouldingHistory = render;
  function init(){ bind(); setTimeout(refresh,700); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
