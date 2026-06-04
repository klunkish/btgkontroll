/***********************************************************
 * v18.8 PREFABKÖ – VCT, tillverkningsjournal och drag/drop
 *
 * Bygger vidare på fungerande v18.7.
 * Statusflöde: Ny → Bekräftad → Klar → Tillverkningsjournal.
 ***********************************************************/
(function(){
  let FACTORY = null;
  let FACTORY_MEMBER = null;
  let PREFAB_REQUESTS = [];
  let PREFAB_KNOWN_IDS = new Set();
  let PREFAB_FIRST_LOAD_DONE = false;
  let PREFAB_POLL_TIMER = null;

  const EXPOSURE_CLASSES = ['X0','XC1','XC2','XC3','XC4','XD1','XD2','XD3','XS1','XS2','XS3','XF1','XF2','XF3','XF4','XA1','XA2','XA3'];
  const DEFAULT_STRENGTHS = ['C20/25','C25/30','C28/35','C30/37','C32/40','C35/45','C40/50','C45/55','C50/60','C54/65'];

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function currentUser(){ return (typeof CURRENT_USER !== 'undefined') ? CURRENT_USER : null; }
  function today(){ return new Date().toISOString().slice(0,10); }
  function fmtDateSafe(v){ try { return v ? new Date(v).toLocaleDateString('sv-SE') : ''; } catch { return v || ''; } }
  function fmtDateTimeSafe(v){ try { return v ? new Date(v).toLocaleString('sv-SE', {dateStyle:'short', timeStyle:'short'}) : ''; } catch { return v || ''; } }
  function numOrNull(v){ const n = Number(v); return Number.isFinite(n) ? n : null; }
  function canManageQueue(){ return FACTORY_MEMBER && ['admin','producer'].includes(FACTORY_MEMBER.role); }
  function roleName(){ return FACTORY_MEMBER?.role || ''; }

  function statusLabel(status){
    if (status === 'new') return 'Ny';
    if (status === 'confirmed' || status === 'in_progress') return 'Bekräftad';
    if (status === 'done') return 'Klar';
    if (status === 'cancelled') return 'Avbruten';
    return status || '—';
  }
  function statusClass(status){
    if (status === 'new') return 'prefab-status-new warn';
    if (status === 'confirmed' || status === 'in_progress') return 'prefab-status-confirmed';
    if (status === 'done') return 'prefab-status-done ok';
    return '';
  }

  function playNewPrefabSound(){
    try{
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1175, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
      setTimeout(()=>ctx.close?.(), 800);
    }catch(e){ console.warn('Kunde inte spela ljudsignal:', e); }
  }

  function ensurePrefabUI(){
    if (document.getElementById('tab-prefab')) return;

    const nav = document.querySelector('header .main-nav') || document.querySelector('.main-nav') || document.querySelector('nav.toolbar');
    if (nav && !nav.querySelector('[data-tab="prefab"]')){
      const btn = document.createElement('button');
      btn.className = 'tab-btn';
      btn.type = 'button';
      btn.dataset.tab = 'prefab';
      btn.textContent = 'Prefabkö';
      btn.addEventListener('click', ()=> setTab('prefab'));
      const before = nav.querySelector('[data-tab="avvikelser"]') || nav.querySelector('[data-tab="dagbok"]');
      if (before) nav.insertBefore(btn, before);
      else nav.appendChild(btn);
    }

    const main = document.querySelector('main.container') || document.querySelector('main');
    if (!main) return;

    const section = document.createElement('section');
    section.id = 'tab-prefab';
    section.className = 'grid';
    section.style.display = 'none';
    section.innerHTML = `
      <div class="card">
        <h3>Prefabkö / interna betongbeställningar</h3>
        <p class="pill">För fabrikspersonal som vill lägga beställningar när t.ex. ett bord är färdigformat.</p>
        <div id="prefabFactoryBox" class="grid" style="margin-top:.6rem"></div>
      </div>

      <div class="card" id="prefabRequestFormCard">
        <h3>Lägg beställning</h3>
        <div class="grid grid-3">
          <div><label>Datum</label><input id="prefabDate" type="date"></div>
          <div><label>Hållfasthet</label><select id="prefabStrength"></select></div>
          <div><label>Mängd (m³)</label><input id="prefabAmount" type="number" min="0" step="0.01" placeholder="t.ex. 1.25"></div>
          <div><label>VCT</label><input id="prefabVct" type="number" min="0" step="0.001" placeholder="t.ex. 0.45"></div>
        </div>
        <div class="grid grid-3">
          <div><label>Littra / ritningsnr</label><input id="prefabDrawing" placeholder="t.ex. V-102 / A-451"></div>
          <div><label>Bord/form</label><input id="prefabTable" placeholder="t.ex. Bord 8"></div>
          <div><label>Beställare</label><input id="prefabRequester" placeholder="Namn"></div>
          <div><label>Temperatursensor</label><select id="prefabTemperatureSensor"><option value="">— ingen sensor vald —</option></select></div>
        </div>
        <div style="margin-top:.6rem">
          <label>Exponeringsklasser</label>
          <div id="prefabExposureGrid" class="prefab-checkbox-grid"></div>
        </div>
        <div style="margin-top:.6rem">
          <label>Notering</label>
          <input id="prefabNote" placeholder="valfritt">
        </div>
        <div class="toolbar" style="margin-top:.8rem">
          <button class="btn" id="btnAddPrefabRequest">Skicka beställning</button>
          <button class="btn secondary" id="btnRefreshPrefabQueue">Uppdatera kö</button>
        </div>
      </div>

      <div class="card">
        <h3>Kölista</h3>
        <div class="toolbar" style="margin-bottom:.5rem">
          <span class="pill" id="prefabQueueSummary">Ingen kö laddad.</span>
        </div>
        <div style="overflow:auto; max-height:520px; margin-top:.5rem">
          <table id="prefabQueueTable">
            <thead><tr>
              <th></th><th>Skapad</th><th>Datum</th><th>Status</th><th>Bord</th><th>Hållfasthet</th><th>VCT</th><th>Exponering</th><th>Mängd</th><th>Littra/ritning</th><th>Beställare</th><th>Sats-ID</th><th>Recept</th><th>GWP</th><th>Notering</th><th></th>
            </tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>`;

    const footer = main.querySelector('footer');
    if (footer) main.insertBefore(section, footer);
    else main.appendChild(section);

    try { tabs.prefab = section; } catch(e) { console.warn('Kunde inte registrera prefabflik:', e); }
    initPrefabControls();
    ensurePrefabDashboardCard();
  }

  function initPrefabControls(){
    const date = document.getElementById('prefabDate');
    if (date && !date.value) date.value = today();

    const strengthSel = document.getElementById('prefabStrength');
    if (strengthSel){
      const strengths = Array.from(new Set([...(RECIPES||[]).map(r=>r.strength).filter(Boolean), ...DEFAULT_STRENGTHS]));
      strengthSel.innerHTML = '<option value="">— välj —</option>' + strengths.map(s=>`<option>${esc(s)}</option>`).join('');
    }

    const expGrid = document.getElementById('prefabExposureGrid');
    if (expGrid && !expGrid.dataset.ready){
      expGrid.innerHTML = EXPOSURE_CLASSES.map(x=>`<label><input type="checkbox" value="${x}"> ${x}</label>`).join('');
      expGrid.dataset.ready = '1';
    }

    document.getElementById('btnAddPrefabRequest')?.addEventListener('click', savePrefabRequest);
    refreshPrefabTemperatureSensorSelect();
    document.getElementById('btnRefreshPrefabQueue')?.addEventListener('click', loadPrefabModule);
  }

  function ensurePrefabDashboardCard(){
    const dash = document.getElementById('tab-dashboard');
    if (!dash || document.getElementById('prefabDashboardCard')) return;
    const card = document.createElement('div');
    card.className = 'card prefab-status-card';
    card.id = 'prefabDashboardCard';
    card.innerHTML = `
      <h3>Prefabkö</h3>
      <div class="kpi">
        <div>🏭</div>
        <div>
          <div style="font-weight:700">Inkomna beställningar</div>
          <small id="prefabDashText" class="muted">Ingen kö laddad.</small>
        </div>
        <div class="prefab-count" id="prefabDashCount">0</div>
      </div>
      <div class="toolbar" style="margin-top:.6rem">
        <button class="btn secondary" id="btnGoPrefabFromDash" type="button">Öppna prefabkö</button>
      </div>`;
    const overview = document.getElementById('overviewCard');
    if (overview) dash.insertBefore(card, overview);
    else dash.appendChild(card);
    document.getElementById('btnGoPrefabFromDash')?.addEventListener('click', ()=> setTab('prefab'));
  }

  function renderFactoryBox(){
    const box = document.getElementById('prefabFactoryBox');
    if (!box) return;
    if (!currentUser()){
      box.innerHTML = '<div class="pill warn">Logga in för att använda prefabkön.</div>';
      return;
    }
    if (!FACTORY){
      box.innerHTML = `
        <div class="grid grid-3">
          <div><label>Fabriksnamn</label><input id="factoryNameInput" placeholder="t.ex. Landvetter Prefab"></div>
          <div style="align-self:end"><button class="btn" id="btnCreateFactory" type="button">Skapa fabrik för mitt konto</button></div>
        </div>
        <div class="grid grid-3" style="margin-top:.6rem">
          <div><label>Fabrikskod</label><input id="factoryJoinCodeInput" placeholder="kod från admin"></div>
          <div style="align-self:end"><button class="btn secondary" id="btnJoinFactory" type="button">Anslut till fabrik</button></div>
        </div>`;
      document.getElementById('btnCreateFactory')?.addEventListener('click', createFactory);
      document.getElementById('btnJoinFactory')?.addEventListener('click', joinFactory);
      return;
    }
    box.innerHTML = `
      <div class="kpi">
        <div>🏭</div>
        <div>
          <div style="font-weight:700">${esc(FACTORY.name)}</div>
          <small class="muted">Din roll: ${esc(FACTORY_MEMBER?.role || '—')} • Fabrikskod: <b>${esc(FACTORY.join_code || '')}</b></small>
        </div>
      </div>`;
  }

  async function loadFactoryMembership(){
    FACTORY = null; FACTORY_MEMBER = null;
    const user = currentUser();
    if (!user || !SUPABASE_READY || !sb) return;

    const { data: memberRows, error: memberError } = await sb
      .from('factory_members')
      .select('id,factory_id,user_id,role,created_at')
      .eq('user_id', user.id)
      .limit(1);

    if (memberError) throw memberError;
    if (!memberRows || !memberRows.length) return;

    FACTORY_MEMBER = memberRows[0];

    const { data: factory, error: factoryError } = await sb
      .from('factories')
      .select('id,name,join_code,created_by,created_at')
      .eq('id', FACTORY_MEMBER.factory_id)
      .single();

    if (factoryError) throw factoryError;
    FACTORY = factory;
  }

  async function createFactory(){
    const user = currentUser();
    if (!user) return alert('Logga in först.');
    const name = (document.getElementById('factoryNameInput')?.value || '').trim() || 'Min prefabfabrik';
    const joinCode = ('BTG-' + Math.random().toString(36).slice(2,8)).toUpperCase();
    try{
      const { data: f, error: ferr } = await sb.from('factories').insert([{ name, join_code: joinCode, created_by: user.id }]).select().single();
      if (ferr) throw ferr;
      const { error: merr } = await sb.from('factory_members').insert([{ factory_id: f.id, user_id: user.id, role: 'admin' }]);
      if (merr) throw merr;
      await loadPrefabModule();
      alert('Fabrik skapad. Dela fabrikskoden med fabrikspersonal som ska kunna lägga beställningar.');
    }catch(err){ showSupabaseError?.('Kunde inte skapa fabrik', err); }
  }

  async function joinFactory(){
    const user = currentUser();
    if (!user) return alert('Logga in först.');
    const code = (document.getElementById('factoryJoinCodeInput')?.value || '').trim().toUpperCase();
    if (!code) return alert('Ange fabrikskod.');
    try{
      const { data: f, error: ferr } = await sb.from('factories').select('id,name,join_code').eq('join_code', code).single();
      if (ferr) throw ferr;
      const { error: merr } = await sb.from('factory_members').insert([{ factory_id: f.id, user_id: user.id, role: 'requester' }]);
      if (merr) throw merr;
      await loadPrefabModule();
      alert('Du är ansluten till fabriken.');
    }catch(err){ showSupabaseError?.('Kunde inte ansluta till fabrik', err); }
  }

  function handleNewOrdersSound(rows){
    const ids = new Set((rows || []).map(r => r.id));
    const newRows = (rows || []).filter(r => !PREFAB_KNOWN_IDS.has(r.id) && r.status === 'new');
    if (PREFAB_FIRST_LOAD_DONE && newRows.length && canManageQueue()){
      playNewPrefabSound();
      try { document.title = `(${newRows.length}) Ny prefab-beställning – BTG Quality Control`; } catch(e){}
    }
    PREFAB_KNOWN_IDS = ids;
    PREFAB_FIRST_LOAD_DONE = true;
  }

  async function loadPrefabQueue(){
    PREFAB_REQUESTS = [];
    if (!FACTORY || !SUPABASE_READY || !sb) return;
    const { data, error } = await sb
      .from('prefab_requests')
      .select('*')
      .eq('factory_id', FACTORY.id)
      .order('queue_order', { ascending:true, nullsFirst:false })
      .order('created_at', { ascending:false });
    if (error) throw error;
    PREFAB_REQUESTS = data || [];
    handleNewOrdersSound(PREFAB_REQUESTS);
  }

  async function loadPrefabModule(){
    try{
      if (!currentUser()) { renderFactoryBox(); renderPrefabQueue(); renderPrefabDashboard(); return; }
      await loadFactoryMembership();
      await loadPrefabQueue();
      renderFactoryBox();
      renderPrefabQueue();
      renderPrefabDashboard();
      ensurePrefabPolling();
    }catch(err){
      console.warn('Kunde inte ladda prefabkö:', err);
      setCloudStatus?.('danger', 'Kunde inte ladda prefabkö: ' + (err.message || err));
      FACTORY = null;
      FACTORY_MEMBER = null;
      renderFactoryBox();
      renderPrefabQueue();
      renderPrefabDashboard();
    }
  }

  function ensurePrefabPolling(){
    if (PREFAB_POLL_TIMER) return;
    PREFAB_POLL_TIMER = setInterval(()=>{
      if (document.hidden) return;
      if (currentUser() && FACTORY) loadPrefabModule();
    }, 30000);
  }

  function refreshPrefabTemperatureSensorSelect(){
    const sel = document.getElementById('prefabTemperatureSensor');
    if(!sel) return;
    const current = sel.value;
    if(window.BTG_TABLE_TEMPERATURE?.sensorOptionsHtml){
      sel.innerHTML = window.BTG_TABLE_TEMPERATURE.sensorOptionsHtml(current).replace('<option value="">— välj sensor/bord —</option>','<option value="">— ingen sensor vald —</option>');
      if(current) sel.value = current;
    }
  }

  function selectedExposureClasses(){
    return Array.from(document.querySelectorAll('#prefabExposureGrid input[type="checkbox"]:checked')).map(x=>x.value);
  }

  async function savePrefabRequest(){
    const user = currentUser();
    if (!user) return alert('Logga in först.');
    if (!FACTORY) return alert('Skapa eller anslut till en fabrik först.');
    const strength = document.getElementById('prefabStrength')?.value || '';
    const amount = parseFloat(document.getElementById('prefabAmount')?.value || '0');
    const vct = numOrNull(document.getElementById('prefabVct')?.value || '');
    if (!strength) return alert('Välj hållfasthet.');
    if (!(amount > 0)) return alert('Ange mängd i m³.');
    const prefabTempSensorId = (document.getElementById('prefabTemperatureSensor')?.value || '').trim();
    const prefabTempSensorLabel = prefabTempSensorId && window.BTG_TABLE_TEMPERATURE?.sensorLabelById ? window.BTG_TABLE_TEMPERATURE.sensorLabelById(prefabTempSensorId) : '';
    const prefabTableName = (document.getElementById('prefabTable')?.value || '').trim();

    const payload = {
      factory_id: FACTORY.id,
      user_id: user.id,
      request_date: document.getElementById('prefabDate')?.value || today(),
      strength,
      exposure_classes: selectedExposureClasses(),
      amount_m3: amount,
      vct,
      drawing_no: (document.getElementById('prefabDrawing')?.value || '').trim(),
      table_no: prefabTableName,
      requester_name: (document.getElementById('prefabRequester')?.value || '').trim(),
      note: (document.getElementById('prefabNote')?.value || '').trim(),
      status: 'new',
      queue_order: Date.now(),
      app_data: {
        vct,
        temperature_sensor_id: prefabTempSensorId,
        temperature_sensor_label: prefabTempSensorLabel,
        temperature_sensor_table_name: prefabTableName
      }
    };
    try{
      const { error } = await sb.from('prefab_requests').insert([payload]);
      if (error) throw error;
      ['prefabAmount','prefabVct','prefabDrawing','prefabTable','prefabRequester','prefabNote'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
      document.querySelectorAll('#prefabExposureGrid input[type="checkbox"]').forEach(x=>x.checked=false);
      await loadPrefabModule();
      alert('Beställning skickad.');
    }catch(err){ showSupabaseError?.('Kunde inte spara prefab-beställning', err); }
  }

  async function confirmPrefabRequest(id){
    const user = currentUser();
    try{
      const { error } = await sb.from('prefab_requests').update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        confirmed_by: user?.id || null,
        updated_at: new Date().toISOString()
      }).eq('id', id);
      if (error) throw error;
      await loadPrefabModule();
    }catch(err){ showSupabaseError?.('Kunde inte bekräfta beställning', err); }
  }

  function promptPrefabCompletionDetails(req){
    return new Promise(resolve=>{
      const recipes = (RECIPES || []).filter(r => r && (r.cloudId || r.id));
      if (!recipes.length){
        alert('Det finns inga recept att välja. Lägg först in ett recept i receptbiblioteket.');
        resolve(null);
        return;
      }

      const existingBatchId = req?.batch_id || req?.app_data?.batch_id || '';
      const existingRecipeId = req?.used_recipe_id || req?.app_data?.used_recipe_id || req?.recipe_id || '';

      const dlg = document.createElement('dialog');
      dlg.id = 'prefabCompleteDialog';
      dlg.innerHTML = `
        <form method="dialog" class="container" novalidate>
          <div class="row" style="justify-content:space-between;align-items:center;">
            <h3>Markera prefab-beställning som klar</h3>
            <button type="button" class="btn secondary" data-cancel>Stäng</button>
          </div>
          <div class="grid grid-2">
            <div>
              <label>Sats-ID</label>
              <input id="prefabCompleteBatchId" value="${esc(existingBatchId)}" placeholder="t.ex. 24-00123">
            </div>
            <div>
              <label>Recept som användes</label>
              <select id="prefabCompleteRecipe">
                <option value="">— välj recept —</option>
                ${recipes.map(r=>{
                  const rid = r.cloudId || r.id;
                  const selected = String(rid) === String(existingRecipeId) ? 'selected' : '';
                  return `<option value="${esc(rid)}" ${selected}>${esc(r.name || 'Recept')} ${r.strength ? '('+esc(r.strength)+')' : ''}</option>`;
                }).join('')}
              </select>
            </div>
            <div>
              <label>Rapporttyp</label>
              <select id="prefabCompleteProductionType">
                <option value="prefab">Prefab</option>
                <option value="order">Beställning</option>
              </select>
            </div>
            <div id="prefabCompleteCustomerWrap" style="display:none">
              <label>Kund vid beställning</label>
              <select id="prefabCompleteCustomer">
                <option value="">— välj kund —</option>
                ${(CUSTOMERS||[]).map(c=>`<option value="${esc(c.cloudId || c.id)}">${esc(c.name || '')}</option>`).join('')}
              </select>
            </div>
            <div>
              <label>Aktivera temperatur-sensor</label>
              <select id="prefabCompleteTempSensor">
                ${window.BTG_TABLE_TEMPERATURE?.sensorOptionsHtml ? window.BTG_TABLE_TEMPERATURE.sensorOptionsHtml(req?.app_data?.temperature_sensor_id || '') : '<option value="">Bord & Temperatur-modul saknas</option>'}
              </select>
              <small class="muted">Valfri. Sensor kopplas till prefab när du sparar klar.</small>
            </div>
            <div>
              <label>Bekräfta bord/form för sensorn</label>
              <input id="prefabCompleteTempTableName" value="${esc(req?.app_data?.temperature_sensor_table_name || req?.app_data?.temperatureSensorTableName || req?.app_data?.form_table_name || req?.table_name || '')}" placeholder="t.ex. Bord 8 eller Form 3">
              <small class="muted">Detta visas i Bord & Temperatur och Live-vy.</small>
            </div>
          </div>
          <div id="prefabRecipePreview" class="pill" style="margin-top:.6rem">Välj recept för att beräkna VCT/VCTekv/GWP.</div>
          <div class="row" style="justify-content:flex-end;gap:.5rem;margin-top:.8rem;">
            <button type="button" class="btn secondary" data-cancel>Avbryt</button>
            <button type="button" class="btn" id="btnPrefabCompleteSave">Spara klar</button>
          </div>
        </form>`;

      document.body.appendChild(dlg);
      const batchInput = dlg.querySelector('#prefabCompleteBatchId');
      const recipeSelect = dlg.querySelector('#prefabCompleteRecipe');
      const typeSelect = dlg.querySelector('#prefabCompleteProductionType');
      const customerWrap = dlg.querySelector('#prefabCompleteCustomerWrap');
      const customerSelect = dlg.querySelector('#prefabCompleteCustomer');
      const preview = dlg.querySelector('#prefabRecipePreview');
      const tempSensorSelect = dlg.querySelector('#prefabCompleteTempSensor');
      const tempTableNameInput = dlg.querySelector('#prefabCompleteTempTableName');
      const updateCustomerVisibility = () => {
        if (customerWrap) customerWrap.style.display = typeSelect?.value === 'order' ? '' : 'none';
      };
      typeSelect?.addEventListener('change', updateCustomerVisibility);
      updateCustomerVisibility();

      const updatePreview = () => {
        const recipe = recipes.find(r => String(r.cloudId || r.id) === String(recipeSelect.value));
        if (!recipe){
          preview.textContent = 'Välj recept för att beräkna VCT/VCTekv/GWP.';
          return;
        }
        const gwpPerM3 = (typeof gwpPerM3FromRecipe === 'function') ? gwpPerM3FromRecipe(recipe, MATERIALS || []) : 0;
        const total = gwpPerM3 * (Number(req?.amount_m3 || 0) || 0);
        preview.innerHTML = `Recept: <b>${esc(recipe.name || '')}</b> • VCT: <b>${Number(recipe.vct||0).toFixed(3)}</b> • VCTekv: <b>${Number(recipe.vctEq||0).toFixed(3)}</b> • GWP: <b>${Number(gwpPerM3||0).toFixed(1)} kgCO₂e/m³</b> • Total: <b>${Number(total||0).toFixed(1)} kgCO₂e</b>`;
      };

      recipeSelect.addEventListener('change', updatePreview);
      updatePreview();

      const close = (value) => {
        try { dlg.close(); } catch(_){ }
        dlg.remove();
        resolve(value);
      };
      dlg.querySelectorAll('[data-cancel]').forEach(btn=>btn.addEventListener('click', ()=>close(null)));
      dlg.querySelector('#btnPrefabCompleteSave')?.addEventListener('click', ()=>{
        const batchId = String(batchInput.value || '').trim();
        const recipe = recipes.find(r => String(r.cloudId || r.id) === String(recipeSelect.value));
        const productionType = typeSelect?.value || 'prefab';
        const customer = (CUSTOMERS || []).find(c => String(c.cloudId || c.id) === String(customerSelect?.value || '')) || null;
        if (!batchId){ alert('Sats-ID krävs för att markera beställningen som klar.'); return; }
        if (!recipe){ alert('Välj vilket recept som användes.'); return; }
        if (productionType === 'order' && !customer){ alert('Välj kund när rapporttypen är Beställning.'); return; }
        close({
          batchId,
          recipe,
          productionType,
          customer,
          temperatureSensorId: tempSensorSelect?.value || req?.app_data?.temperature_sensor_id || '',
          temperatureSensorTableName: tempTableNameInput?.value?.trim() || req?.app_data?.temperature_sensor_table_name || req?.table_no || ''
        });
      });
      dlg.addEventListener('cancel', (e)=>{ e.preventDefault(); close(null); });
      dlg.showModal();
    });
  }

  async function completePrefabRequest(id){
    const user = currentUser();
    const req = PREFAB_REQUESTS.find(r=>r.id===id);
    const details = await promptPrefabCompletionDetails(req);
    if (!details) return;
    const cleaned = details.batchId;
    const recipe = details.recipe;
    const productionType = details.productionType || 'prefab';
    const customer = details.customer || null;
    const selectedTempSensorId = details.temperatureSensorId || req?.app_data?.temperature_sensor_id || '';
    const selectedTempTableName = details.temperatureSensorTableName || req?.app_data?.temperature_sensor_table_name || req?.table_no || '';
    const recipeCloudId = recipe.cloudId || recipe.id;
    const gwpPerM3 = (typeof gwpPerM3FromRecipe === 'function') ? gwpPerM3FromRecipe(recipe, MATERIALS || []) : 0;
    const amount = Number(req?.amount_m3 || 0) || 0;
    const gwpTotal = gwpPerM3 * amount;

    try{
      let createdBatch = null;
      const requestedVct = numOrNull(req?.vct ?? req?.app_data?.vct);
      const batchObj = {
        id: (typeof uuid === 'function') ? uuid() : ('prefab_' + Date.now()),
        recipeId: recipe.id || recipeCloudId,
        recipeCloudId,
        recipeName: recipe.name || '',
        strength: recipe.strength || req?.strength || '',
        amount,
        dateTime: new Date().toISOString(),
        vct: Number.isFinite(Number(recipe.vct)) ? Number(recipe.vct) : requestedVct,
        vctEq: Number.isFinite(Number(recipe.vctEq)) ? Number(recipe.vctEq) : null,
        gwpPerM3,
        gwpTotal,
        batchId: cleaned,
        source: productionType === 'order' ? 'customer_order' : 'prefab_queue',
        productionType,
        customerId: customer ? (customer.cloudId || customer.id) : null,
        customerName: customer ? (customer.name || '') : '',
        prefabRequestId: req?.id,
        prefabFactoryId: req?.factory_id,
        exposureClasses: req?.exposure_classes || [],
        tableNo: req?.table_no || '',
        drawingNo: req?.drawing_no || '',
        requesterName: req?.requester_name || '',
        requestedVct,
        note: req?.note || '',
        createdAt: new Date().toISOString()
      };

      if (typeof saveBatchToSupabase === 'function') {
        createdBatch = await saveBatchToSupabase(batchObj);
        if (!createdBatch) throw new Error('Tillverkningsjournalen kunde inte skapas.');
        if (Array.isArray(BATCHES)) {
          BATCHES.unshift(createdBatch);
          renderBatches?.();
        }
      } else {
        throw new Error('saveBatchToSupabase saknas i appen.');
      }

      const appData = {
        ...(req?.app_data || {}),
        batch_id: cleaned,
        vct: requestedVct,
        used_recipe_id: recipeCloudId,
        used_recipe_name: recipe.name || '',
        used_recipe_strength: recipe.strength || '',
        recipe_vct: batchObj.vct,
        recipe_vct_eq: batchObj.vctEq,
        gwp_per_m3: gwpPerM3,
        gwp_total: gwpTotal,
        manufacturing_batch_id: createdBatch?.cloudId || createdBatch?.id || null,
        production_type: productionType,
        customer_id: customer ? (customer.cloudId || customer.id) : null,
        customer_name: customer ? (customer.name || '') : '',
        temperature_sensor_id: selectedTempSensorId || '',
        temperature_sensor_table_name: selectedTempTableName || '',
        temperature_sensor_activated_at: selectedTempSensorId ? new Date().toISOString() : null
      };

      const { error } = await sb.from('prefab_requests').update({
        status: 'done',
        batch_id: cleaned,
        manufacturing_batch_id: createdBatch?.cloudId || createdBatch?.id || null,
        used_recipe_id: recipeCloudId,
        used_recipe_name: recipe.name || '',
        gwp_per_m3: gwpPerM3,
        gwp_total: gwpTotal,
        completed_at: new Date().toISOString(),
        completed_by: user?.id || null,
        updated_at: new Date().toISOString(),
        app_data: appData
      }).eq('id', id);
      if (error) throw error;

      if (selectedTempSensorId && window.BTG_TABLE_TEMPERATURE?.activateSensorForPrefab){
        try{
          window.BTG_TABLE_TEMPERATURE.activateSensorForPrefab({
            sensorId: selectedTempSensorId,
            prefabId: id,
            batchId: cleaned,
            label: `${req?.project_name || req?.customer_name || 'Prefab'} ${cleaned ? '• '+cleaned : ''}`,
            tableName: selectedTempTableName || ''
          });
        }catch(tempErr){
          console.warn('Kunde inte aktivera temperatursensor', tempErr);
        }
      }

      await loadPrefabModule();
      renderDashboard?.();
    }catch(err){ showSupabaseError?.('Kunde inte markera beställning som klar / skapa tillverkningsjournal', err); }
  }

  async function deletePrefabRequest(id){
    if (!confirm('Ta bort beställningen?')) return;
    try{
      const { error } = await sb.from('prefab_requests').delete().eq('id', id);
      if (error) throw error;

      await loadPrefabModule();
    }catch(err){ showSupabaseError?.('Kunde inte ta bort beställning', err); }
  }

  function printPrefabRequest(r){
    const rows = [
      ['Status', statusLabel(r.status)],
      ['Skapad', fmtDateTimeSafe(r.created_at)],
      ['Önskat datum', fmtDateSafe(r.request_date)],
      ['Bord', r.table_no],
      ['Temperatursensor', r.app_data?.temperature_sensor_label || '—'],
      ['Hållfasthet', r.strength],
      ['VCT', (r.vct ?? r.app_data?.vct ?? '—')],
      ['Exponeringsklasser', (r.exposure_classes||[]).join(', ')],
      ['Mängd', `${Number(r.amount_m3||0).toFixed(2)} m³`],
      ['Rapporttyp', (r.app_data?.production_type === 'order' ? 'Beställning' : 'Prefab')],
      ['Kund', r.app_data?.customer_name || '—'],
      ['Littra / ritningsnr', r.drawing_no],
      ['Beställare', r.requester_name],
      ['Sats-ID', r.batch_id || r.app_data?.batch_id || '—'],
      ['Använt recept', r.used_recipe_name || r.app_data?.used_recipe_name || '—'],
      ['GWP', (r.gwp_total ?? r.app_data?.gwp_total) != null ? `${Number(r.gwp_total ?? r.app_data?.gwp_total).toFixed(1)} kg CO₂e` : '—'],
      ['Tillverkningsjournal-ID', r.manufacturing_batch_id || r.app_data?.manufacturing_batch_id || '—'],
      ['Bekräftad', fmtDateTimeSafe(r.confirmed_at) || '—'],
      ['Klar', fmtDateTimeSafe(r.completed_at) || '—'],
      ['Notering', r.note || '—']
    ].map(([k,v])=>`<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');

    const html = `
      <h1>Prefab-beställning</h1>
      <p><b>Fabrik:</b> ${esc(FACTORY?.name || '')}</p>
      <table>${rows}</table>
      <p style="margin-top:20px;color:#666;font-size:12px">Skapad från BTG Quality Control • ${new Date().toLocaleString('sv-SE')}</p>`;
    if (typeof openPrintWindow === 'function') openPrintWindow('Prefab-beställning', html);
    else {
      const w = window.open('', '_blank');
      w.document.write(`<!doctype html><html><head><title>Prefab-beställning</title><style>body{font-family:Arial;padding:24px}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #ddd;text-align:left;padding:8px}</style></head><body>${html}<script>window.print()<\/script></body></html>`);
      w.document.close();
    }
  }



  const CLIMATE_REVIEW_KEY='btg_climate_third_party_reviews_v1';
  function climateReviewId(prefix,id){ return `${prefix}:${id}`; }
  function climateReviews(){ try{return JSON.parse(localStorage.getItem(CLIMATE_REVIEW_KEY)||'{}')||{};}catch(_){return{};} }
  function saveClimateReview(key,data){ const all=climateReviews(); all[key]=data; localStorage.setItem(CLIMATE_REVIEW_KEY, JSON.stringify(all)); }
  function climateDefaultReview(key){ return climateReviews()[key] || {reviewer:'',reviewer_company:'',epd_verified:true,en15804:true,coverage_percent:90,third_party_tool:true,approved:true,notes:''}; }
  function climatePrintWindow(title,html){
    const w=window.open('','_blank');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      body{font-family:Arial,Helvetica,sans-serif;color:#111827;margin:0;padding:34px;line-height:1.42}button{padding:10px 14px;border:0;border-radius:8px;background:#0f766e;color:#fff;font-weight:700;margin-bottom:18px}h1{margin:.2rem 0 0;font-size:26px}h2{margin:22px 0 8px;font-size:17px;border-bottom:2px solid #111827;padding-bottom:5px}.muted{color:#64748b}.meta{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:18px 0}.box{border:1px solid #d1d5db;border-radius:12px;padding:12px;margin:10px 0}.ok{color:#166534;font-weight:800}.bad{color:#991b1b;font-weight:800}table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid #d1d5db;padding:8px;text-align:left;vertical-align:top}th{background:#f3f4f6}.small{font-size:12px;color:#64748b}.sign{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:38px}.line{border-bottom:1px solid #111;height:42px}@media print{button{display:none}body{padding:22px}}
    </style></head><body><button onclick="window.print()">Skriv ut / Spara som PDF</button>${html}</body></html>`);
    w.document.close(); w.focus();
  }
  function climateReviewDialog(order,key,kind){
    const old=document.querySelector('#climateReviewDialog'); if(old) old.remove();
    const saved=climateDefaultReview(key);
    const d=document.createElement('dialog'); d.id='climateReviewDialog'; d.className='climate-review-dialog';
    d.innerHTML=`<form method="dialog" class="climate-review-form"><div class="climate-review-head"><div><span>Tredjepartsgranskning</span><h3>Klimatunderlag / ${esc(order.drawing_no||order.id||'order')}</h3><p>Fyll i granskningsuppgifter och skapa PDF-underlag enligt kravet på verifierad klimatpåverkan.</p></div><button class="btn" id="prefabClimatePdf" type="button">Klimatgranskning PDF</button><button class="btn secondary" value="cancel">Stäng</button></div><div class="climate-review-grid"><label>Granskare<input id="crReviewer" value="${esc(saved.reviewer||'')}"></label><label>Företag/organisation<input id="crCompany" value="${esc(saved.reviewer_company||'')}"></label><label>Täckningsgrad klimatpåverkan %<input id="crCoverage" type="number" min="0" max="100" step="1" value="${esc(saved.coverage_percent??90)}"></label><label>Slutsats<select id="crApproved"><option value="true" ${saved.approved!==false?'selected':''}>Godkänd</option><option value="false" ${saved.approved===false?'selected':''}>Avvikelse / ej godkänd</option></select></label><label><input id="crEpd" type="checkbox" ${saved.epd_verified!==false?'checked':''}> EPD/miljövarudeklaration verifierad</label><label><input id="crEn" type="checkbox" ${saved.en15804!==false?'checked':''}> EN15804 omfattas</label><label><input id="crTool" type="checkbox" ${saved.third_party_tool!==false?'checked':''}> Tredjepartsgranskat verktyg / verifierad beräkning</label><label><input id="crCoverageOk" type="checkbox" ${Number(saved.coverage_percent??90)>=90?'checked':''}> Minst 90 % av materialets klimatpåverkan styrkt</label><label class="climate-review-span">Noteringar<textarea id="crNotes">${esc(saved.notes||'')}</textarea></label></div><div class="climate-review-actions"><button class="btn secondary" id="crSave" type="button">Spara granskning</button><button class="btn" id="crPdf" type="button">Skapa PDF</button></div></form>`;
    document.body.appendChild(d);
    const read=()=>({reviewer:document.getElementById('crReviewer')?.value||'',reviewer_company:document.getElementById('crCompany')?.value||'',coverage_percent:Number(document.getElementById('crCoverage')?.value||0),approved:document.getElementById('crApproved')?.value==='true',epd_verified:!!document.getElementById('crEpd')?.checked,en15804:!!document.getElementById('crEn')?.checked,third_party_tool:!!document.getElementById('crTool')?.checked,coverage_ok:!!document.getElementById('crCoverageOk')?.checked,notes:document.getElementById('crNotes')?.value||'',reviewed_at:new Date().toISOString(),kind});
    d.querySelector('#crSave')?.addEventListener('click',()=>{saveClimateReview(key,read()); alert('Granskningen är sparad lokalt på denna enhet.');});
    d.querySelector('#crPdf')?.addEventListener('click',()=>{const data=read(); saveClimateReview(key,data); printPrefabClimateReview(order,data);});
    d.addEventListener('close',()=>d.remove(),{once:true}); d.showModal();
  }
  function printPrefabClimateReview(r,review){
    const app=r.app_data||{}; const littra=r.drawing_no||r.id||'';
    const rows=[['Littra / ritningsnr',littra],['Fabrik',FACTORY?.name||''],['Kund/projekt',app.customer_name||'—'],['Bord/form',app.temperature_sensor_table_name||r.table_no||'—'],['Hållfasthet',r.strength||'—'],['Mängd',`${Number(r.amount_m3||0).toFixed(2)} m³`],['Valt recept',r.used_recipe_name||app.used_recipe_name||'—'],['Sats-ID',app.batch_id||r.batch_id||'—'],['Tillverkningsjournal-ID',app.manufacturing_batch_id||r.manufacturing_batch_id||'—'],['GWP total',app.gwp_total!=null?`${Number(app.gwp_total).toFixed(1)} kg CO₂e`:'—'],['GWP per m³',(app.gwp_total&&r.amount_m3)?`${(Number(app.gwp_total)/Number(r.amount_m3)).toFixed(1)} kg CO₂e/m³`:'—'],['Temperatursensor',app.temperature_sensor_label||'—'],['Klar',fmtDateTimeSafe(r.completed_at)||'—']].map(([k,v])=>`<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');
    const checks=[['Verifierad EPD / miljövarudeklaration',review.epd_verified],['Omfattar livscykelfaser enligt EN15804',review.en15804],['Tredjepartsgranskat verktyg/verifierad beräkning',review.third_party_tool],['Minst 90 % av materialets klimatpåverkan styrkt',review.coverage_ok || Number(review.coverage_percent)>=90]].map(([k,ok])=>`<tr><td>${esc(k)}</td><td class="${ok?'ok':'bad'}">${ok?'Ja':'Nej'}</td></tr>`).join('');
    const html=`<div class="small">BTG Quality Control • ${new Date().toLocaleString('sv-SE')}</div><h1>Tredjepartsgranskning klimatpåverkan</h1><p class="muted">Underlag för verifiering av betongens klimatpåverkan enligt krav på tredjepartsgranskad miljövarudeklaration/EPD, EN15804 och minst 90 % styrkt klimatpåverkan.</p><div class="box"><b>Slutsats:</b> <span class="${review.approved?'ok':'bad'}">${review.approved?'Godkänd':'Avvikelse / ej godkänd'}</span><br><b>Täckningsgrad:</b> ${esc(review.coverage_percent)} %<br><b>Granskare:</b> ${esc(review.reviewer||'—')} • ${esc(review.reviewer_company||'—')}</div><h2>Orderunderlag</h2><table>${rows}</table><h2>Kontrollpunkter</h2><table><thead><tr><th>Kontroll</th><th>Status</th></tr></thead><tbody>${checks}</tbody></table><h2>Noteringar</h2><div class="box">${esc(review.notes||'Inga noteringar.').replace(/\n/g,'<br>')}</div><h2>Granskarsignatur</h2><div class="sign"><div><div class="line"></div><div>Datum</div></div><div><div class="line"></div><div>Underskrift / granskare</div></div></div>`;
    climatePrintWindow(`Tredjepartsgranskning ${littra}`, html);
  }


  function prefabLocalDate(value){
    if(!value) return '';
    try{
      const d = new Date(value);
      if(Number.isNaN(d.getTime())) return String(value).slice(0,10);
      const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
      return `${y}-${m}-${day}`;
    }catch(_){ return String(value).slice(0,10); }
  }

  function prefabTodayISO(){
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function prefabDateForFilter(r){
    return prefabLocalDate(r.request_date || r.created_at || r.confirmed_at || r.completed_at);
  }

  function getPrefabFilter(){
    return {
      mode: document.getElementById('prefabQueueDayFilter')?.value || 'today',
      date: document.getElementById('prefabQueueDateFilter')?.value || prefabTodayISO()
    };
  }

  function applyPrefabDateFilter(list, includeDone=false){
    const filter=getPrefabFilter();
    let rows=list.filter(r=> includeDone ? r.status==='done' : r.status!=='done');
    if(filter.mode==='all') return rows;
    if(filter.mode==='today') return rows.filter(r=>prefabDateForFilter(r)===prefabTodayISO());
    if(filter.mode==='tomorrow'){
      const d=new Date(); d.setDate(d.getDate()+1);
      const iso=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      return rows.filter(r=>prefabDateForFilter(r)===iso);
    }
    if(filter.mode==='date') return rows.filter(r=>prefabDateForFilter(r)===filter.date);
    if(filter.mode==='week'){
      const now=new Date(); const start=new Date(now); start.setHours(0,0,0,0); start.setDate(start.getDate()-((start.getDay()+6)%7));
      const end=new Date(start); end.setDate(start.getDate()+7);
      return rows.filter(r=>{ const d=new Date(r.request_date || r.created_at || 0); return d>=start && d<end; });
    }
    return rows;
  }

  function ensurePrefabQueueTools(){
    const table=document.getElementById('prefabQueueTable');
    if(!table || document.getElementById('prefabQueueTools')) return;
    const tools=document.createElement('div');
    tools.id='prefabQueueTools';
    tools.className='prefab-queue-tools';
    tools.innerHTML=`<div class="prefab-filter-card">
      <div>
        <b>Filtrera prefabkö</b>
        <span>Visa bara beställningar för vald dag så listan blir enklare att arbeta med.</span>
      </div>
      <label>Visa
        <select id="prefabQueueDayFilter">
          <option value="today">Idag</option>
          <option value="tomorrow">Imorgon</option>
          <option value="week">Denna vecka</option>
          <option value="date">Valt datum</option>
          <option value="all">Alla öppna</option>
        </select>
      </label>
      <label>Datum
        <input id="prefabQueueDateFilter" type="date" value="${prefabTodayISO()}">
      </label>
    </div>`;
    table.parentElement.insertBefore(tools, table);
    tools.querySelector('#prefabQueueDayFilter')?.addEventListener('change', renderPrefabQueue);
    tools.querySelector('#prefabQueueDateFilter')?.addEventListener('change', renderPrefabQueue);

    const completed=document.createElement('section');
    completed.id='prefabCompletedOrdersPanel';
    completed.className='prefab-completed-panel';
    completed.innerHTML=`<div class="prefab-completed-head">
      <div><h3>Klara ordrar</h3><p>Klicka på littra/ritningsnr för att öppna all insamlad data för ordern.</p></div>
      <button class="btn secondary" id="prefabRefreshCompleted" type="button">Uppdatera</button>
    </div>
    <div class="table-wrap"><table id="prefabCompletedOrdersTable">
      <thead><tr><th>Littra</th><th>Klar</th><th>Bord/form</th><th>Recept</th><th>Sensor</th><th>Sats</th><th>Granskning</th></tr></thead>
      <tbody></tbody>
    </table></div>`;
    table.parentElement.insertBefore(completed, table.nextSibling);
    completed.querySelector('#prefabRefreshCompleted')?.addEventListener('click', renderPrefabQueue);
  }

  function loadTemperatureAssignments(){
    try{
      const all=JSON.parse(localStorage.getItem('btg_temperature_assignments_v1')||'[]');
      return Array.isArray(all) ? all.filter(x=>String(x.factoryId||'local_factory')===String(FACTORY?.id||'local_factory')) : [];
    }catch(_){ return []; }
  }

  function loadTemperatureReadings(){
    try{
      const all=JSON.parse(localStorage.getItem('btg_temperature_readings_v1')||'[]');
      return Array.isArray(all) ? all.filter(x=>String(x.factoryId||'local_factory')===String(FACTORY?.id||'local_factory')) : [];
    }catch(_){ return []; }
  }

  function temperatureDataForPrefab(r){
    const app=r.app_data||{};
    const assignments=loadTemperatureAssignments();
    const match=assignments.find(a=>String(a.prefabId||'')===String(r.id) || String(a.batchId||'')===String(app.batch_id||r.batch_id||'') || String(a.orderId||'')===String(r.id));
    const sensorId=app.temperature_sensor_id || match?.sensorId || '';
    let readings=loadTemperatureReadings().filter(x=>String(x.sensorId||'')===String(sensorId));
    if(match?.startedAt){
      const start=new Date(match.startedAt).getTime();
      readings=readings.filter(x=>new Date(x.createdAt).getTime()>=start);
    }
    if(r.completed_at){
      const end=new Date(r.completed_at).getTime()+24*60*60*1000;
      readings=readings.filter(x=>new Date(x.createdAt).getTime()<=end);
    }
    return {assignment:match, sensorId, readings:readings.slice(-160)};
  }

  function demouldingDataForPrefab(r){
    const batchId=r.app_data?.batch_id || r.batch_id || '';
    const drawing=r.drawing_no || '';
    const batches=Array.isArray(window.BATCHES) ? window.BATCHES : [];
    return batches.filter(b=>{
      const hay=[b.id,b.cloudId,b.batchId,b.batch_id,b.littra,b.drawing_no,b.tableNo,b.table_no,b.notes,b.comment].map(x=>String(x||'')).join(' ').toLowerCase();
      return (batchId && hay.includes(String(batchId).toLowerCase())) || (drawing && hay.includes(String(drawing).toLowerCase()));
    });
  }

  function renderTemperatureMiniGraph(readings){
    if(!readings.length) return '<div class="prefab-detail-empty">Ingen temperaturdata hittad för denna order ännu.</div>';
    const values=readings.map(r=>Number(r.temperatureC||0));
    const min=Math.min(...values), max=Math.max(...values);
    const bars=readings.map(r=>{
      const v=Number(r.temperatureC||0);
      const pct=max>min?((v-min)/(max-min))*100:50;
      const amb=r.ambientTemperatureC!=null?` • Omgivning ${Number(r.ambientTemperatureC).toFixed(1)} °C`:'';
      return `<i style="height:${Math.max(6,pct)}%" title="${esc(new Date(r.createdAt).toLocaleString('sv-SE'))}: Betong ${v.toFixed(1)} °C${amb}"></i>`;
    }).join('');
    const last=readings[readings.length-1];
    return `<div class="prefab-temp-summary">
      <div><span>Senaste betongtemp</span><b>${Number(last.temperatureC||0).toFixed(1)} °C</b></div>
      <div><span>Omgivning</span><b>${last.ambientTemperatureC!=null?Number(last.ambientTemperatureC).toFixed(1)+' °C':'—'}</b></div>
      <div><span>Min / Max</span><b>${min.toFixed(1)} / ${max.toFixed(1)} °C</b></div>
      <div><span>Mätpunkter</span><b>${readings.length}</b></div>
    </div><div class="prefab-temp-graph">${bars}</div>`;
  }

  function openPrefabOrderDetail(id){
    const r=PREFAB_REQUESTS.find(x=>String(x.id)===String(id));
    if(!r) return;
    const app=r.app_data||{};
    const tempData=temperatureDataForPrefab(r);
    const demould=demouldingDataForPrefab(r);
    const d=document.createElement('dialog');
    d.className='prefab-order-detail-dialog';
    const littra=r.drawing_no || r.id;
    const rows=[
      ['Littra / ritningsnr', littra],
      ['Status', statusLabel(r.status)],
      ['Beställningsdatum', fmtDateSafe(r.request_date)],
      ['Skapad', fmtDateTimeSafe(r.created_at)],
      ['Bekräftad', fmtDateTimeSafe(r.confirmed_at) || '—'],
      ['Klar', fmtDateTimeSafe(r.completed_at) || '—'],
      ['Bord/form', app.temperature_sensor_table_name || r.table_no || '—'],
      ['Hållfasthet', r.strength || '—'],
      ['Mängd', `${Number(r.amount_m3||0).toFixed(2)} m³`],
      ['VCT önskat', r.vct ?? app.vct ?? '—'],
      ['Valt recept', r.used_recipe_name || app.used_recipe_name || '—'],
      ['Recept hållfasthet', app.used_recipe_strength || '—'],
      ['Recept VCT', app.recipe_vct ?? '—'],
      ['Sats-ID', app.batch_id || r.batch_id || '—'],
      ['Tillverkningsjournal-ID', app.manufacturing_batch_id || '—'],
      ['GWP total', app.gwp_total!=null ? `${Number(app.gwp_total).toFixed(1)} kg CO₂e` : '—'],
      ['Temperatursensor', app.temperature_sensor_label || tempData.sensorId || '—'],
      ['Sensor aktiverad', fmtDateTimeSafe(app.temperature_sensor_activated_at) || '—'],
      ['Beställare', r.requester_name || '—'],
      ['Notering', r.note || '—']
    ].map(([k,v])=>`<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');
    const demouldHtml=demould.length
      ? demould.slice(0,8).map(x=>`<li>${esc(x.tableNo||x.table_no||x.batchId||x.batch_id||x.id||'Avformningspost')} ${x.demoulded_at? '• '+esc(fmtDateTimeSafe(x.demoulded_at)) : ''}</li>`).join('')
      : '<li>Ingen avformningsdata hittad kopplad till denna order.</li>';
    d.innerHTML=`<form method="dialog" class="prefab-order-detail">
      <div class="prefab-detail-head">
        <div><span>Klar order</span><h2>${esc(littra)}</h2><p>Samlad orderdata, recept, tider, avformning och temperatur.</p></div>
        <button class="btn secondary" value="cancel">Stäng</button>
      </div>
      <div class="prefab-detail-grid">
        <section><h3>Orderdata</h3><table class="prefab-detail-table">${rows}</table></section>
        <section><h3>Temperaturgraf</h3>${renderTemperatureMiniGraph(tempData.readings)}</section>
      </div>
      <section class="prefab-detail-section"><h3>Avformning</h3><ul>${demouldHtml}</ul></section>
    </form>`;
    document.body.appendChild(d);
    d.querySelector('#prefabClimatePdf')?.addEventListener('click',()=>climateReviewDialog(r, climateReviewId('prefab', r.id), 'prefab'));
    d.addEventListener('close',()=>d.remove(),{once:true});
    d.showModal();
  }

  function renderCompletedOrdersList(){
    const tbody=document.querySelector('#prefabCompletedOrdersTable tbody');
    if(!tbody) return;
    const rows=applyPrefabDateFilter(PREFAB_REQUESTS,true).sort((a,b)=>new Date(b.completed_at||b.updated_at||b.created_at||0)-new Date(a.completed_at||a.updated_at||a.created_at||0));
    tbody.innerHTML='';
    if(!rows.length){
      tbody.innerHTML='<tr><td colspan="7">Inga klara ordrar för valt filter.</td></tr>';
      return;
    }
    rows.forEach(r=>{
      const tr=document.createElement('tr');
      const app=r.app_data||{};
      const littra=r.drawing_no || r.id;
      tr.innerHTML=`<td><button class="prefab-littra-link" data-prefab-detail="${esc(r.id)}">${esc(littra)}</button></td>
        <td>${esc(fmtDateTimeSafe(r.completed_at)||'—')}</td>
        <td>${esc(app.temperature_sensor_table_name || r.table_no || '')}</td>
        <td>${esc(r.used_recipe_name || app.used_recipe_name || '')}</td>
        <td>${esc(app.temperature_sensor_label || '')}</td>
        <td>${esc(app.batch_id || r.batch_id || '')}</td><td><button class="btn secondary" data-prefab-climate="${esc(r.id)}" type="button">Klimat-PDF</button></td>`;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('[data-prefab-detail]').forEach(btn=>btn.addEventListener('click',()=>openPrefabOrderDetail(btn.dataset.prefabDetail)));
    tbody.querySelectorAll('[data-prefab-climate]').forEach(btn=>btn.addEventListener('click',()=>{ const r=PREFAB_REQUESTS.find(x=>String(x.id)===String(btn.dataset.prefabClimate)); if(r) climateReviewDialog(r, climateReviewId('prefab', r.id), 'prefab'); }));
  }


  function renderPrefabQueue(){
    ensurePrefabQueueTools();
    const tbody = document.querySelector('#prefabQueueTable tbody');
    const summary = document.getElementById('prefabQueueSummary');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!FACTORY){
      if (summary) summary.textContent = 'Ingen fabrik vald.';
      tbody.innerHTML = '<tr><td colspan="16">Skapa eller anslut till en fabrik för att visa kön.</td></tr>';
      return;
    }
    const unconfirmed = PREFAB_REQUESTS.filter(r=>r.status==='new').length;
    const open = PREFAB_REQUESTS.filter(r=>['new','confirmed','in_progress'].includes(r.status)).length;
    const visibleRequests = applyPrefabDateFilter(PREFAB_REQUESTS,false);
    if (summary) summary.textContent = `${PREFAB_REQUESTS.length} beställningar totalt • ${unconfirmed} nya/obekräftade • ${open} öppna • ${visibleRequests.length} visas`;
    if (!PREFAB_REQUESTS.length){
      tbody.innerHTML = '<tr><td colspan="16">Inga beställningar ännu.</td></tr>';
      return;
    }
    if (!visibleRequests.length){
      tbody.innerHTML = '<tr><td colspan="16">Inga öppna beställningar för valt filter.</td></tr>';
      renderCompletedOrdersList();
      return;
    }
    for (const r of visibleRequests){
      const tr = document.createElement('tr');
      tr.dataset.prefabId = r.id;
      if (canManageQueue()) tr.draggable = true;
      const batchId = r.batch_id || r.app_data?.batch_id || '';
      const vctVal = r.vct ?? r.app_data?.vct ?? '';
      const trace = r.status === 'done'
        ? `<span class="prefab-trace-small">Klar: ${esc(fmtDateTimeSafe(r.completed_at))}</span>`
        : (r.status === 'confirmed' || r.status === 'in_progress')
          ? `<span class="prefab-trace-small">Bekräftad: ${esc(fmtDateTimeSafe(r.confirmed_at))}</span>`
          : '';
      tr.innerHTML = `
        <td class="prefab-drag-handle" title="Dra för att ändra köordning">${canManageQueue() ? '⋮⋮' : ''}</td>
        <td>${fmtDateSafe(r.created_at)}</td>
        <td>${fmtDateSafe(r.request_date)}</td>
        <td><span class="pill ${statusClass(r.status)}">${statusLabel(r.status)}</span>${trace}</td>
        <td>${esc(r.table_no)}${r.app_data?.temperature_sensor_label ? `<br><span class="prefab-trace-small">Sensor: ${esc(r.app_data.temperature_sensor_label)}</span>` : ''}</td>
        <td>${esc(r.strength)}</td>
        <td>${vctVal==='' || vctVal==null ? '' : Number(vctVal).toFixed(3)}</td>
        <td>${(r.exposure_classes||[]).map(esc).join(', ')}</td>
        <td>${Number(r.amount_m3||0).toFixed(2)}</td>
        <td><button class="prefab-littra-link" data-prefab-detail="${esc(r.id)}">${esc(r.drawing_no || r.id)}</button></td>
        <td>${esc(r.requester_name)}</td>
        <td>${esc(batchId)}</td>
        <td>${esc(r.used_recipe_name || r.app_data?.used_recipe_name || '')}</td>
        <td>${(r.gwp_total ?? r.app_data?.gwp_total) != null ? Number(r.gwp_total ?? r.app_data?.gwp_total).toFixed(1) : ''}</td>
        <td>${esc(r.note)}</td>
        <td><div class="toolbar"></div></td>`;
      const tb = tr.querySelector('.toolbar');
      const mk = (text, cls, fn)=>{ const b=document.createElement('button'); b.type='button'; b.className=cls; b.textContent=text; b.addEventListener('click', fn); tb.appendChild(b); };
      mk('PDF', 'btn secondary', ()=>printPrefabRequest(r));
      if (canManageQueue()){
        if (r.status === 'new') mk('Bekräfta','btn secondary',()=>confirmPrefabRequest(r.id));
        if (r.status !== 'done') mk('Klar','btn',()=>completePrefabRequest(r.id));
        mk('Ta bort','btn danger',()=>deletePrefabRequest(r.id));
      } else if (!tb.children.length) {
        tb.innerHTML = '<span class="pill">Endast visning</span>';
      }
      tbody.appendChild(tr);
    }
    tbody.querySelectorAll('[data-prefab-detail]').forEach(btn=>btn.addEventListener('click',()=>openPrefabOrderDetail(btn.dataset.prefabDetail)));
    renderCompletedOrdersList();
    attachPrefabDragAndDrop();
  }

  function attachPrefabDragAndDrop(){
    if (!canManageQueue()) return;
    const tbody = document.querySelector('#prefabQueueTable tbody');
    if (!tbody || tbody.dataset.dragReady === '1') return;
    tbody.dataset.dragReady = '1';
    let dragged = null;
    tbody.addEventListener('dragstart', (e)=>{
      const tr = e.target.closest('tr[data-prefab-id]');
      if (!tr) return;
      dragged = tr;
      tr.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', tr.dataset.prefabId); } catch(_){}
    });
    tbody.addEventListener('dragend', ()=>{
      if (dragged) dragged.classList.remove('dragging');
      tbody.querySelectorAll('.drag-over').forEach(x=>x.classList.remove('drag-over'));
      dragged = null;
    });
    tbody.addEventListener('dragover', (e)=>{
      e.preventDefault();
      const tr = e.target.closest('tr[data-prefab-id]');
      tbody.querySelectorAll('.drag-over').forEach(x=>x.classList.remove('drag-over'));
      if (tr && tr !== dragged) tr.classList.add('drag-over');
    });
    tbody.addEventListener('drop', async (e)=>{
      e.preventDefault();
      const target = e.target.closest('tr[data-prefab-id]');
      if (!dragged || !target || dragged === target) return;
      const rows = Array.from(tbody.querySelectorAll('tr[data-prefab-id]'));
      const draggedIndex = rows.indexOf(dragged);
      const targetIndex = rows.indexOf(target);
      if (draggedIndex < targetIndex) target.after(dragged); else target.before(dragged);
      await persistPrefabQueueOrder();
    });
  }

  async function persistPrefabQueueOrder(){
    try{
      const rows = Array.from(document.querySelectorAll('#prefabQueueTable tbody tr[data-prefab-id]'));
      const updates = rows.map((tr, idx)=>({ id: tr.dataset.prefabId, queue_order: idx + 1, updated_at: new Date().toISOString() }));
      for (const u of updates){
        const { error } = await sb.from('prefab_requests').update({ queue_order: u.queue_order, updated_at: u.updated_at }).eq('id', u.id);
        if (error) throw error;
      }
      await loadPrefabModule();
    }catch(err){ showSupabaseError?.('Kunde inte spara köordning', err); }
  }

  function renderPrefabDashboard(){
    ensurePrefabDashboardCard();
    const count = document.getElementById('prefabDashCount');
    const text = document.getElementById('prefabDashText');
    const unconfirmed = PREFAB_REQUESTS.filter(r=>r.status==='new').length;
    const open = PREFAB_REQUESTS.filter(r=>['new','confirmed','in_progress'].includes(r.status)).length;
    if (count) count.textContent = String(unconfirmed);
    if (text) text.textContent = FACTORY ? `${unconfirmed} nya/obekräftade • ${open} öppna i ${FACTORY.name}` : 'Ingen fabrik kopplad ännu.';
  }

  function patchCoreRenderers(){
    if (window.__prefabQueuePatched) return;
    window.__prefabQueuePatched = true;
    try{
      const oldLoad = loadCloudCoreData;
      loadCloudCoreData = async function(){
        const res = await oldLoad.apply(this, arguments);
        await loadPrefabModule();
        return res;
      };
    }catch(e){ console.warn('Kunde inte koppla prefab till molnladdning:', e); }
    try{
      const oldRenderDash = renderDashboard;
      renderDashboard = function(){
        const res = oldRenderDash.apply(this, arguments);
        renderPrefabDashboard();
        return res;
      };
    }catch(e){ console.warn('Kunde inte koppla prefab till dashboard:', e); }
    try{
      const oldSetTab = setTab;
      setTab = async function(name){
        if (name === 'prefab'){
          for (const [k, el] of Object.entries(tabs)) if (el) el.style.display = (k===name? 'grid':'none');
          document.querySelectorAll('.tab-btn').forEach(btn=>btn.setAttribute('aria-current', btn.dataset.tab===name? 'page':'false'));
          await loadPrefabModule();
          return;
        }
        return oldSetTab.apply(this, arguments);
      };
    }catch(e){ console.warn('Kunde inte koppla prefab till fliksystem:', e); }
  }

  function init(){
    ensurePrefabUI();
    refreshPrefabTemperatureSensorSelect();
    patchCoreRenderers();
    loadPrefabModule();
  }


  async function openPrefabQueuePage(){
    ensurePrefabUI();
    try{
      document.querySelectorAll('main > section[id^="tab-"], .page-section, .tab-content, .page').forEach(sec=>{
        if(sec && sec.id !== 'tab-prefab' && !sec.closest('dialog')){
          sec.classList.remove('active');
          sec.style.display='none';
          sec.hidden=true;
          sec.setAttribute('aria-hidden','true');
        }
      });
    }catch(_){}
    const sec=document.getElementById('tab-prefab');
    if(sec){
      sec.hidden=false;
      sec.style.display='grid';
      sec.classList.add('active');
      sec.setAttribute('aria-hidden','false');
    }
    try{
      document.querySelectorAll('.tab-btn[data-tab], .main-nav [data-tab]').forEach(btn=>{
        btn.setAttribute('aria-current', btn.dataset.tab==='prefab' ? 'page' : 'false');
        btn.classList.toggle('active', btn.dataset.tab==='prefab');
      });
    }catch(_){}
    try{ if(typeof tabs!=='undefined') tabs.prefab=sec; }catch(_){}
    await loadPrefabModule();
    try{ document.body.classList.remove('sidebar-open'); }catch(_){}
    return true;
  }

  window.BTG_PREFAB_QUEUE = {
    open: openPrefabQueuePage,
    refresh: loadPrefabModule,
    render: renderPrefabQueue,
    state: () => ({requests:PREFAB_REQUESTS.slice(), factory:FACTORY})
  };


  window.loadPrefabModule = loadPrefabModule;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
