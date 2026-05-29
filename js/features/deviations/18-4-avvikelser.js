/***********************************************************
 * v18.4 AVVIKELSER / ÅTGÄRDER
 *
 * Säker modul ovanpå v18.3.1:
 * - egen flik i menyn
 * - Supabase-tabell: deviation_reports
 * - avvikelse, orsak, åtgärd, ansvarig, status, deadline
 * - dashboardkort med öppna/försenade avvikelser
 ***********************************************************/
(function(){
  let DEVIATIONS = [];

  function getUser(){ return CURRENT_USER || null; }

  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function today(){ return new Date().toISOString().slice(0,10); }

  function normalizeDeviationRow(row){
    const app = row.app_data || {};
    return {
      ...app,
      id: row.id,
      cloudId: row.id,
      title: row.title ?? app.title ?? '',
      status: row.status ?? app.status ?? 'open',
      severity: row.severity ?? app.severity ?? 'medium',
      sourceType: row.source_type ?? app.sourceType ?? '',
      sourceId: row.source_id ?? app.sourceId ?? '',
      description: row.description ?? app.description ?? '',
      action: row.action ?? app.action ?? '',
      responsible: row.responsible ?? app.responsible ?? '',
      dueDate: row.due_date ?? app.dueDate ?? '',
      closedAt: row.closed_at ?? app.closedAt ?? null,
      createdAt: row.created_at ?? app.createdAt ?? new Date().toISOString()
    };
  }

  async function loadDeviations(){
    if (!SUPABASE_READY || !sb || !getUser()) return;
    const { data, error } = await sb
      .from('deviation_reports')
      .select('id,title,status,severity,source_type,source_id,description,action,responsible,due_date,closed_at,app_data,created_at')
      .eq('user_id', getUser().id)
      .order('created_at', { ascending:false });
    if (error){ showSupabaseError('Kunde inte ladda avvikelser från Supabase', error); return; }
    DEVIATIONS = (data || []).map(normalizeDeviationRow);
    renderDeviations();
    renderDeviationDashboardCard();
  }

  async function saveDeviation(item){
    const user = getUser() || await refreshCurrentUser(false);
    if (!user){ alert('Logga in först.'); return null; }
    const payload = {
      user_id: user.id,
      title: item.title || '',
      status: item.status || 'open',
      severity: item.severity || 'medium',
      source_type: item.sourceType || '',
      source_id: item.sourceId || '',
      description: item.description || '',
      action: item.action || '',
      responsible: item.responsible || '',
      due_date: item.dueDate || null,
      closed_at: item.status === 'closed' ? (item.closedAt || new Date().toISOString()) : null,
      app_data: item
    };

    let res;
    if (item.cloudId || item.id){
      const id = item.cloudId || item.id;
      res = await sb.from('deviation_reports')
        .update(payload)
        .eq('id', id)
        .eq('user_id', user.id)
        .select('id,title,status,severity,source_type,source_id,description,action,responsible,due_date,closed_at,app_data,created_at')
        .single();
    } else {
      res = await sb.from('deviation_reports')
        .insert([payload])
        .select('id,title,status,severity,source_type,source_id,description,action,responsible,due_date,closed_at,app_data,created_at')
        .single();
    }
    if (res.error){ showSupabaseError('Kunde inte spara avvikelse/åtgärd', res.error); return null; }
    return normalizeDeviationRow(res.data);
  }

  async function deleteDeviation(item){
    const user = getUser() || await refreshCurrentUser(false);
    if (!user){ alert('Logga in först.'); return false; }
    const id = item.cloudId || item.id;
    if (!id) return true;
    const { error } = await sb.from('deviation_reports').delete().eq('id', id).eq('user_id', user.id);
    if (error){ showSupabaseError('Kunde inte ta bort avvikelse/åtgärd', error); return false; }
    return true;
  }

  function statusLabel(s){
    return s === 'closed' ? 'Stängd' : s === 'in_progress' ? 'Pågår' : 'Öppen';
  }
  function severityLabel(s){
    return s === 'critical' ? 'Kritisk' : s === 'high' ? 'Hög' : s === 'low' ? 'Låg' : 'Medel';
  }
  function sourceLabel(s){
    const map = { batch:'Sats', cube:'Provkub', recipe:'Recept', order:'Beställning', control:'Kontroll', diary:'Dagbok', other:'Övrigt' };
    return map[s] || '—';
  }

  function ensureDeviationUI(){
    const nav = document.querySelector('header .main-nav') || document.querySelector('.main-nav');
    if (nav && !nav.querySelector('[data-tab="avvikelser"]')){
      const btn = document.createElement('button');
      btn.className = 'tab-btn';
      btn.type = 'button';
      btn.dataset.tab = 'avvikelser';
      btn.textContent = 'Avvikelser';
      btn.addEventListener('click', setDeviationTab);
      const diaryBtn = nav.querySelector('[data-tab="dagbok"]');
      if (diaryBtn && diaryBtn.nextSibling) nav.insertBefore(btn, diaryBtn.nextSibling);
      else nav.appendChild(btn);
    }

    const main = document.querySelector('main.container') || document.querySelector('main');
    if (main && !document.getElementById('tab-avvikelser')){
      const sec = document.createElement('section');
      sec.id = 'tab-avvikelser';
      sec.className = 'grid';
      sec.style.display = 'none';
      sec.innerHTML = `
        <div class="card">
          <h3>Avvikelserapport / Åtgärd</h3>
          <p class="pill">Registrera avvikelser, orsaker och åtgärder. Allt sparas i Supabase och kopplas till inloggad användare.</p>
          <div class="toolbar" style="margin-top:.6rem">
            <button class="btn" id="btnAddDeviation">➕ Ny avvikelse</button>
            <button class="btn secondary" id="btnRefreshDeviations">Uppdatera</button>
            <button class="btn secondary" id="btnExportDeviationsPDF">Exportera PDF</button>
          </div>
        </div>
        <div class="card" id="deviationFormCard" style="display:none">
          <h3 id="deviationFormTitle">Ny avvikelse</h3>
          <input type="hidden" id="devId">
          <div class="grid grid-3">
            <div><label>Rubrik</label><input id="devTitle" placeholder="t.ex. Luftvärde under krav"></div>
            <div><label>Status</label><select id="devStatus"><option value="open">Öppen</option><option value="in_progress">Pågår</option><option value="closed">Stängd</option></select></div>
            <div><label>Allvarlighetsgrad</label><select id="devSeverity"><option value="low">Låg</option><option value="medium" selected>Medel</option><option value="high">Hög</option><option value="critical">Kritisk</option></select></div>
          </div>
          <div class="grid grid-3">
            <div><label>Koppling</label><select id="devSourceType"><option value="other">Övrigt</option><option value="recipe">Recept</option><option value="batch">Sats</option><option value="cube">Provkub</option><option value="order">Beställning</option><option value="control">Kontroll</option><option value="diary">Dagbok</option></select></div>
            <div><label>Ansvarig</label><input id="devResponsible" placeholder="namn"></div>
            <div><label>Åtgärd senast</label><input id="devDueDate" type="date"></div>
          </div>
          <div class="grid grid-2">
            <div><label>Avvikelse / observation</label><textarea id="devDescription" placeholder="Beskriv vad som har hänt"></textarea></div>
            <div><label>Åtgärd / korrigerande åtgärd</label><textarea id="devAction" placeholder="Vad ska göras och hur följs det upp?"></textarea></div>
          </div>
          <div class="toolbar" style="justify-content:flex-end;margin-top:.6rem">
            <button class="btn secondary" type="button" id="btnCancelDeviation">Avbryt</button>
            <button class="btn" type="button" id="btnSaveDeviation">Spara avvikelse</button>
          </div>
        </div>
        <div class="card">
          <h3>Avvikelselista</h3>
          <div class="grid grid-3">
            <div><label>Statusfilter</label><select id="devFilterStatus"><option value="">Alla</option><option value="open">Öppna</option><option value="in_progress">Pågår</option><option value="closed">Stängda</option></select></div>
            <div><label>Allvarlighet</label><select id="devFilterSeverity"><option value="">Alla</option><option value="critical">Kritisk</option><option value="high">Hög</option><option value="medium">Medel</option><option value="low">Låg</option></select></div>
            <div style="align-self:end"><button class="btn secondary" id="btnApplyDeviationFilters">Tillämpa</button></div>
          </div>
          <div style="overflow:auto; max-height:520px; margin-top:.6rem">
            <table id="deviationsTable"><thead><tr><th>Skapad</th><th>Rubrik</th><th>Status</th><th>Allvarlighet</th><th>Koppling</th><th>Ansvarig</th><th>Senast</th><th>Åtgärd</th><th></th></tr></thead><tbody></tbody></table>
          </div>
        </div>`;
      const footer = main.querySelector('footer');
      if (footer) main.insertBefore(sec, footer); else main.appendChild(sec);
    }

    document.getElementById('btnAddDeviation')?.addEventListener('click', () => openDeviationForm());
    document.getElementById('btnRefreshDeviations')?.addEventListener('click', loadDeviations);
    document.getElementById('btnCancelDeviation')?.addEventListener('click', closeDeviationForm);
    document.getElementById('btnSaveDeviation')?.addEventListener('click', saveDeviationFromForm);
    document.getElementById('btnApplyDeviationFilters')?.addEventListener('click', renderDeviations);
    document.getElementById('devFilterStatus')?.addEventListener('change', renderDeviations);
    document.getElementById('devFilterSeverity')?.addEventListener('change', renderDeviations);
    document.getElementById('btnExportDeviationsPDF')?.addEventListener('click', exportDeviationsPDF);
  }

  function setDeviationTab(){
    document.querySelectorAll('main > section[id^="tab-"]').forEach(sec => sec.style.display = 'none');
    const sec = document.getElementById('tab-avvikelser');
    if (sec) sec.style.display = '';
    document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => btn.removeAttribute('aria-current'));
    document.querySelectorAll('.tab-btn[data-tab="avvikelser"]').forEach(btn => btn.setAttribute('aria-current','page'));
    if (window.innerWidth <= 900) document.body.classList.remove('sidebar-open');
    loadDeviations();
  }

  function openDeviationForm(item={}){
    const card = document.getElementById('deviationFormCard');
    if (!card) return;
    card.style.display = '';
    document.getElementById('deviationFormTitle').textContent = item.id ? 'Redigera avvikelse' : 'Ny avvikelse';
    document.getElementById('devId').value = item.id || '';
    document.getElementById('devTitle').value = item.title || '';
    document.getElementById('devStatus').value = item.status || 'open';
    document.getElementById('devSeverity').value = item.severity || 'medium';
    document.getElementById('devSourceType').value = item.sourceType || 'other';
    document.getElementById('devResponsible').value = item.responsible || '';
    document.getElementById('devDueDate').value = item.dueDate || '';
    document.getElementById('devDescription').value = item.description || '';
    document.getElementById('devAction').value = item.action || '';
    card.scrollIntoView({behavior:'smooth', block:'start'});
  }

  function closeDeviationForm(){
    const card = document.getElementById('deviationFormCard');
    if (card) card.style.display = 'none';
  }

  async function saveDeviationFromForm(){
    const id = document.getElementById('devId')?.value || '';
    const existing = DEVIATIONS.find(x => x.id === id) || {};
    const title = document.getElementById('devTitle')?.value.trim();
    if (!title){ alert('Ange rubrik för avvikelsen.'); return; }
    const item = {
      ...existing,
      title,
      status: document.getElementById('devStatus')?.value || 'open',
      severity: document.getElementById('devSeverity')?.value || 'medium',
      sourceType: document.getElementById('devSourceType')?.value || 'other',
      responsible: document.getElementById('devResponsible')?.value.trim() || '',
      dueDate: document.getElementById('devDueDate')?.value || '',
      description: document.getElementById('devDescription')?.value.trim() || '',
      action: document.getElementById('devAction')?.value.trim() || '',
      createdAt: existing.createdAt || new Date().toISOString()
    };
    const saved = await saveDeviation(item);
    if (!saved) return;
    const i = DEVIATIONS.findIndex(x => x.id === saved.id);
    if (i >= 0) DEVIATIONS[i] = saved; else DEVIATIONS.unshift(saved);
    closeDeviationForm();
    renderDeviations();
    renderDeviationDashboardCard();
    alert('Avvikelse/åtgärd sparad.');
  }

  function getFilteredDeviations(){
    const status = document.getElementById('devFilterStatus')?.value || '';
    const severity = document.getElementById('devFilterSeverity')?.value || '';
    return (DEVIATIONS || []).filter(d => (!status || d.status === status) && (!severity || d.severity === severity));
  }

  function renderDeviations(){
    const tbody = document.querySelector('#deviationsTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!CURRENT_USER){ tbody.innerHTML = '<tr><td colspan="9">Logga in för att se avvikelser.</td></tr>'; return; }
    const list = getFilteredDeviations();
    if (!list.length){ tbody.innerHTML = '<tr><td colspan="9">Inga avvikelser registrerade.</td></tr>'; return; }
    for (const d of list){
      const overdue = d.status !== 'closed' && d.dueDate && d.dueDate < today();
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${d.createdAt ? new Date(d.createdAt).toLocaleDateString('sv-SE') : ''}</td>
        <td><b>${esc(d.title)}</b><br><small class="muted">${esc((d.description||'').slice(0,90))}</small></td>
        <td><span class="pill ${d.status==='closed'?'ok':d.status==='in_progress'?'warn':''}">${statusLabel(d.status)}</span></td>
        <td><span class="pill ${['critical','high'].includes(d.severity)?'danger':d.severity==='medium'?'warn':''}">${severityLabel(d.severity)}</span></td>
        <td>${sourceLabel(d.sourceType)}</td>
        <td>${esc(d.responsible || '—')}</td>
        <td>${d.dueDate ? esc(d.dueDate) : '—'} ${overdue?'<span class="pill danger">Försenad</span>':''}</td>
        <td>${esc((d.action||'').slice(0,90))}</td>
        <td><div class="toolbar"><button class="btn secondary" data-edit>Redigera</button><button class="btn danger" data-del>Ta bort</button></div></td>`;
      tr.querySelector('[data-edit]')?.addEventListener('click', () => openDeviationForm(d));
      tr.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (!confirm('Ta bort avvikelsen?')) return;
        const ok = await deleteDeviation(d);
        if (!ok) return;
        DEVIATIONS = DEVIATIONS.filter(x => x.id !== d.id);
        renderDeviations(); renderDeviationDashboardCard();
      });
      tbody.appendChild(tr);
    }
  }

  function renderDeviationDashboardCard(){
    const dash = document.getElementById('tab-dashboard');
    if (!dash) return;
    let card = document.getElementById('deviationDashCard');
    if (!card){
      card = document.createElement('div');
      card.id = 'deviationDashCard';
      card.className = 'card';
      card.innerHTML = '<h3>Avvikelser / Åtgärder</h3><div id="deviationDashBody"></div>';
      dash.appendChild(card);
    }
    const open = DEVIATIONS.filter(d => d.status !== 'closed').length;
    const overdue = DEVIATIONS.filter(d => d.status !== 'closed' && d.dueDate && d.dueDate < today()).length;
    const critical = DEVIATIONS.filter(d => d.status !== 'closed' && ['critical','high'].includes(d.severity)).length;
    const body = document.getElementById('deviationDashBody');
    if (body) body.innerHTML = `
      <div class="grid grid-3">
        <div class="kpi"><div>⚠️</div><div><div style="font-weight:700">${open}</div><small>Öppna</small></div></div>
        <div class="kpi"><div>⏰</div><div><div style="font-weight:700">${overdue}</div><small>Försenade</small></div></div>
        <div class="kpi"><div>🔥</div><div><div style="font-weight:700">${critical}</div><small>Hög/kritisk</small></div></div>
      </div>
      <div class="pill" style="margin-top:.6rem;display:inline-block">Registrering sker under fliken Avvikelser.</div>`;
  }

  function exportDeviationsPDF(){
    const rows = (DEVIATIONS||[]).map(d => `<tr><td>${esc(d.createdAt?new Date(d.createdAt).toLocaleDateString('sv-SE'):'')}</td><td>${esc(d.title)}</td><td>${esc(statusLabel(d.status))}</td><td>${esc(severityLabel(d.severity))}</td><td>${esc(sourceLabel(d.sourceType))}</td><td>${esc(d.responsible||'')}</td><td>${esc(d.dueDate||'')}</td><td>${esc(d.description||'')}</td><td>${esc(d.action||'')}</td></tr>`).join('') || '<tr><td colspan="9">Inga avvikelser.</td></tr>';
    const html = `<h1>Avvikelserapport / Åtgärder</h1><p>Källa: Supabase • Användare: ${esc(CURRENT_USER?.email||'')}</p><table><thead><tr><th>Skapad</th><th>Rubrik</th><th>Status</th><th>Allvarlighet</th><th>Koppling</th><th>Ansvarig</th><th>Senast</th><th>Avvikelse</th><th>Åtgärd</th></tr></thead><tbody>${rows}</tbody></table>`;
    if (typeof openPrintWindow === 'function') openPrintWindow('Avvikelserapport', html);
    else { const w = window.open('', '_blank'); w.document.write(html); w.print(); }
  }

  function patchCloudLoad(){
    if (window.__deviationCloudPatched) return;
    window.__deviationCloudPatched = true;
    const originalLoad = window.loadCloudCoreData;
    if (typeof originalLoad === 'function'){
      window.loadCloudCoreData = async function(){
        const res = await originalLoad.apply(this, arguments);
        try { await loadDeviations(); } catch(e){ console.warn('Kunde inte ladda avvikelser', e); }
        return res;
      };
    }
  }

  function init(){
    ensureDeviationUI();
    patchCloudLoad();
    renderDeviationDashboardCard();
    if (CURRENT_USER) loadDeviations();
  }

  window.loadDeviations = loadDeviations;
  window.renderDeviations = renderDeviations;
  window.renderDeviationDashboardCard = renderDeviationDashboardCard;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
