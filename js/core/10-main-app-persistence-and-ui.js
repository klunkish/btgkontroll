/***********************
   * PERSISTENS / LAGRING
   *
   * Här ligger alla nycklar för LocalStorage.
   * LocalStorage används fortfarande som lokal backup under
   * övergången till Supabase.
   ************************/
  const DB_KEYS = {
    recipes: 'bk_recipes_v3',            // v3: +groupId + kravfält
    batches: 'bk_batches_v2',
    cubes:   'bk_cubes_v4',              // v4: +krav & mätfält (vct/vctEq/luft/temp/kw)
    air:     'bk_air_v1',
    materials: 'bk_materials_v1',
    controlDevices: 'bk_control_devices_v1',
    orders:'bk_orders_v2',
    customers:'bk_customers_v2',
    settings:'bk_settings_v2',          // v2: +groups
    diary: 'bk_diary_v1',
    tasks: 'bk_tasks_v1'
  };
  const load = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback } catch { return fallback } };
  const CLOUD_ONLY_KEYS = new Set([DB_KEYS.recipes, DB_KEYS.materials, DB_KEYS.batches, DB_KEYS.cubes, DB_KEYS.air, DB_KEYS.customers, DB_KEYS.orders, DB_KEYS.controlDevices, DB_KEYS.diary, DB_KEYS.tasks]);
  const save = (k, v) => {
    if (CLOUD_ONLY_KEYS.has(k)) {
      try { localStorage.removeItem(k); } catch {}
      return;
    }
    localStorage.setItem(k, JSON.stringify(v));
  };

  /*********************** Hjälpfunktioner ************************/
  const fmtDate = (iso) => new Date(iso).toLocaleString('sv-SE', { dateStyle:'medium', timeStyle:'short' });
  const fmtOnlyDate = (iso) => new Date(iso).toLocaleDateString('sv-SE');
  const todayISO = () => new Date().toISOString().slice(0,10);
  const uuid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

  function calcVCT(materials){
    let water = 0, cement = 0, equivAdd = 0;
    for (const m of materials){
      const amt = parseFloat(m.amount || 0) || 0;
      if (m.type === 'Vatten') water += amt;
      if (m.type === 'Cement') cement += amt;
      if (['GGBS/Slagg','Flygaska','Silika'].includes(m.type)){
        const k = parseFloat(m.k || 0) || 0;
        equivAdd += k * amt;
      }
    }
    const vct = cement > 0 ? (water / cement) : 0;
    const vctEq = (cement + equivAdd) > 0 ? (water / (cement + equivAdd)) : 0;
    return { water, cement, equivAdd, vct, vctEq };
  }

  function gwpPerM3FromRecipe(recipe, materialsLib){
    let sum = 0;
    for (const m of recipe.materials){
      const lib = m.name ? materialsLib.find(x => x.name === m.name) : null;
      const ef = lib ? (parseFloat(lib.ef) || 0) : 0;
      const perM3 = recipe.perM3 ? (parseFloat(m.amount)||0) : ((recipe.satsVolym>0)? (parseFloat(m.amount)||0)/parseFloat(recipe.satsVolym):0);
      sum += perM3 * ef;
    }
    return sum;
  }

  function stats(values){
    const n = values.length; if (!n) return {n:0, mean:null, sd:null, min:null, max:null};
    const mean = values.reduce((s,x)=>s+x,0)/n;
    let sd = null;
    if (n>1){
      const variance = values.reduce((s,x)=> s + Math.pow(x-mean,2), 0) / (n-1);
      sd = Math.sqrt(variance);
    }
    return { n, mean, sd, min: Math.min(...values), max: Math.max(...values) };
  }

  function rollingWindows(arr, k){ const out=[]; for (let i=0;i+k<=arr.length;i++){ out.push(arr.slice(i,i+k)); } return out; }

  /***********************
   * STATE / APPENS DATA I MINNET
   *
   * Dessa arrayer/objekt är appens arbetsdata medan sidan är öppen.
   * De fylls just nu från LocalStorage, och senare steg kan fylla dem
   * direkt från Supabase.
   ************************/
  let RECIPES = []; // Cloud-first: laddas från Supabase efter inloggning
  let BATCHES = []; // Cloud-first: laddas från Supabase efter inloggning
  let CUBES   = load(DB_KEYS.cubes,   []);
  let AIR     = load(DB_KEYS.air,     []);
  let MATERIALS = []; // Cloud-first: laddas från Supabase efter inloggning
  let CONTROL_DEVICES = []; // Cloud-first: laddas från Supabase efter inloggning
  let ORDERS  = []; // Cloud-first: laddas från Supabase efter inloggning
  let CUSTOMERS = []; // Cloud-first: laddas från Supabase efter inloggning
  let SETTINGS= load(DB_KEYS.settings, { creator:"", defaultCureDays:28, groups:[{id:'g1',name:'Grupp 1 – Vanlig betong'},{id:'g2',name:'Grupp 2 – Luftbetong'}] });
  let DIARY   = {}; // Cloud-first i v9: laddas från Supabase efter inloggning
  let TASKS   = { items: [] }; // Cloud-first i v17: laddas från Supabase efter inloggning

  let LAST_BATCHES_VIEW = [];
  let LAST_ORDERS_VIEW = [];

  /***********************
   * UI / NAVIGATION
   *
   * Visar och gömmer appens huvudflikar.
   ************************/
  const tabs = {
    dashboard: document.getElementById('tab-dashboard'),
    tillverkning: document.getElementById('tab-tillverkning'),
    provningar: document.getElementById('tab-provningar'),
    utvardering: document.getElementById('tab-utvardering'),
    kontroll: document.getElementById('tab-kontroll'),
    bestallningar: document.getElementById('tab-bestallningar'),
    material: document.getElementById('tab-material'),
    dagbok: document.getElementById('tab-dagbok')
  };
  async function setTab(name){
    for (const [k, el] of Object.entries(tabs)) el.style.display = (k===name? 'grid':'none');
    document.querySelectorAll('.tab-btn').forEach(btn=>{
      btn.setAttribute('aria-current', btn.dataset.tab===name? 'page': 'false');
    });

    /***********************************************************
     * v7: EN206 / Utvärdering mot molndata
     *
     * Innan utvärderingsfliken renderas laddar vi om cloud-data
     * från Supabase. Då bygger glidande 15, statistik och filter
     * på senaste RECIPES + CUBES i databasen, inte gammalt UI-state.
     ***********************************************************/
    if (CURRENT_USER && ['dashboard','tillverkning','provningar','utvardering','bestallningar','material','dagbok'].includes(name)) {
      try { await loadCloudCoreData(); } catch (err) { console.warn('Kunde inte ladda om molndata vid flikbyte:', err); }
    }

    if (name==='dashboard') renderDashboard();
    if (name==='tillverkning') { renderRecipes(); renderRecipeSelects(); renderBatchForm(); renderBatches(); }
    if (name==='provningar') { renderCubeForm(); renderCubes(); renderAirForm(); renderAir(); }
    if (name==='utvardering') { initEvaluationTab(); }
    if (name==='kontroll') { renderControlDevices(); }
    if (name==='bestallningar') { renderCustomers(); renderOrderForm(); renderOrders(); }
    if (name==='material') { renderMaterials(); }
    if (name==='dagbok') { renderDiaryInit(); }
  }
  document.querySelectorAll('.tab-btn[data-tab]').forEach(btn=>btn.addEventListener('click',()=>setTab(btn.dataset.tab)));
  document.querySelectorAll('[data-nav]')?.forEach(b=>b.addEventListener('click',()=>setTab(b.getAttribute('data-nav'))));

  /*********************** Inställningar ************************/
  const yearEl = document.getElementById('year');
  const creatorEls = [document.getElementById('creatorName'), document.getElementById('creatorNameFooter'), document.getElementById('creatorNameFooter2')];
  const settingsDialog = document.getElementById('settingsDialog');
  document.getElementById('btnSettings')?.addEventListener('click', ()=>{
    document.getElementById('creatorInput').value = SETTINGS.creator || '';
    document.getElementById('defaultCureDays').value = SETTINGS.defaultCureDays || 28;
    if (!Array.isArray(SETTINGS.groups)) SETTINGS.groups = [];
    renderGroupsEditor();
    settingsDialog.showModal();
  });
  document.getElementById('btnSaveSettings')?.addEventListener('click', (e)=>{
    e.preventDefault();
    SETTINGS.creator = document.getElementById('creatorInput').value.trim();
    SETTINGS.defaultCureDays = parseInt(document.getElementById('defaultCureDays').value||28);
    save(DB_KEYS.settings, SETTINGS);
    applyBranding();
    settingsDialog.close();
    renderRecipeSelects();
  });

  function applyBranding(){
    // v18.1 safety fix: branding layout can omit footer/year elements.
    // Always check elements exist before writing textContent.
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    creatorEls.forEach(el=> { if (el) el.textContent = SETTINGS.creator || 'du'; });
  }

  function renderGroupsEditor(){
    const wrap = document.getElementById('groupsEditor');
    if (!wrap) return;
    wrap.innerHTML = '';
    (SETTINGS.groups||[]).forEach((g, idx)=>{
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `
        <input value="${g.name}" data-idx="${idx}" />
        <button type="button" class="btn danger" data-del data-idx="${idx}">Ta bort</button>`;
      row.querySelector('[data-del]').onclick = (e)=>{
        const i = parseInt(e.currentTarget.dataset.idx);
        SETTINGS.groups.splice(i,1);
        renderGroupsEditor();
      };
      row.querySelector('input').oninput = (e)=>{
        const i = parseInt(e.currentTarget.dataset.idx);
        SETTINGS.groups[i].name = e.currentTarget.value;
      };
      wrap.appendChild(row);
    });
    document.getElementById('btnAddGroup').onclick = ()=>{
      SETTINGS.groups.push({ id: 'g'+(Date.now()), name: 'Ny grupp' });
      renderGroupsEditor();
    };
  }

  /***********************
   * MATERIALBIBLIOTEK
   *
   * Hanterar material och emissionsfaktorer för GWP/CO₂.
   * Från SaaS v3 sparas material både lokalt och i Supabase.
   ************************/
  function renderMaterials(){
    const tbody = document.querySelector('#materialsLibTable tbody');
    if(!tbody) return;
    tbody.innerHTML='';
    for (const m of MATERIALS){
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${m.name}</td>
        <td>${m.type||''}</td>
        <td>${(parseFloat(m.ef)||0).toFixed(3)}</td>
        <td>${m.note||''}</td>
        <td><div class="toolbar">
          <button class="btn secondary" data-edit>Redigera</button>
          <button class="btn danger" data-del>Ta bort</button>
        </div></td>`;
      tr.querySelector('[data-del]').addEventListener('click', async ()=>{
        if(!confirm('Ta bort materialet?')) return;

        const cloudOk = await deleteMaterialFromSupabase(m);
        if (!cloudOk) return;

        MATERIALS = MATERIALS.filter(x=>x.id!==m.id);
        renderMaterials();
        syncMaterialNamesDatalist();
      });
      tr.querySelector('[data-edit]').addEventListener('click', ()=> openEditDialog('material', m));
      tbody.appendChild(tr);
    }
  }
  document.getElementById('btnAddMat')?.addEventListener('click', ()=>{ openEditDialog('material', { id:null, name:'', type:'Cement', ef:'', note:'' }); });
  document.getElementById('btnExportMaterials')?.addEventListener('click', ()=> downloadJSON('materials.json', MATERIALS));
  document.getElementById('btnImportMaterials')?.addEventListener('click', ()=> document.getElementById('importMaterialsFile').click());
  document.getElementById('importMaterialsFile')?.addEventListener('change', ()=> alert('Import av material till molnet gör vi i ett senare steg. Lägg till material direkt i appen så sparas de i Supabase.'));
  function syncMaterialNamesDatalist(){
    const dl = document.getElementById('materialNamesList');
    if(!dl) return;
    dl.innerHTML = MATERIALS.map(m=> `<option value="${m.name}"></option>`).join('');
  }

  /***********************
   * RECEPTSYSTEM
   *
   * Hanterar receptdialog, materialrader, VCT/VCTekv,
   * rendering av recepttabell och första Supabase-sparningen.
   ************************/
  const recipeDialog = document.getElementById('recipeDialog');
  const materialsTbody = document.querySelector('#materialsTable tbody');
  let editingRecipeId = null;

  function newMaterialRow(m={type:'Cement', name:'', amount:'', k:'', note:''}){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <select class="mat-type">
          <option>Vatten</option>
          <option selected>Cement</option>
          <option>GGBS/Slagg</option>
          <option>Flygaska</option>
          <option>Silika</option>
          <option>Tillsatsmedel</option>
          <option>Ballast</option>
        </select>
      </td>
      <td>
        <input class="mat-name" list="materialNamesList" placeholder="materialnamn" />
      </td>
      <td><input class="mat-amount" type="number" step="0.01" min="0" placeholder="kg" /></td>
      <td><input class="mat-k" type="number" step="0.01" min="0" placeholder="k" /></td>
      <td><input class="mat-note" placeholder="valfritt" /></td>
      <td><button type="button" class="btn danger btn-del-row">Ta bort</button></td>
    `;
    tr.querySelector('.mat-type').value = m.type || 'Cement';
    tr.querySelector('.mat-name').value = m.name ?? '';
    tr.querySelector('.mat-amount').value = m.amount ?? '';
    tr.querySelector('.mat-k').value = m.k ?? (['GGBS/Slagg','Flygaska','Silika'].includes(m.type)? '0.6':'');
    tr.querySelector('.mat-note').value = m.note ?? '';
    tr.querySelector('.btn-del-row').addEventListener('click', ()=>{ tr.remove(); previewRecipeCalc(); });
    ['change','input'].forEach(evt=> tr.addEventListener(evt, previewRecipeCalc));
    return tr;
  }

  function openRecipeDialog(recipe){
    editingRecipeId = recipe?.id || null;
    document.getElementById('recipeDialogTitle').textContent = editingRecipeId? 'Redigera recept' : 'Nytt recept';
    document.getElementById('recipeName').value = recipe?.name || '';
    document.getElementById('recipeStrength').value = recipe?.strength || '';
    document.getElementById('recipePerM3').value = String(recipe?.perM3 ?? true);
    document.getElementById('satsVolumeRow').style.display = (recipe?.perM3 ?? true) ? 'none':'grid';
    document.getElementById('recipeSatsVolym').value = recipe?.satsVolym ?? '';
    const groupSel = document.getElementById('recipeGroup');
    const items = (SETTINGS.groups||[]);
    if (!items.length) SETTINGS.groups = [ {id:'g1',name:'Grupp 1 – Vanlig betong'}, {id:'g2',name:'Grupp 2 – Luftbetong'} ];
    groupSel.innerHTML = items.map(g=>`<option value="${g.id}">${g.name}</option>`).join('');
    groupSel.value = recipe?.groupId || items[0].id;

    document.getElementById('recipeVctReq').value = recipe?.vctReq ?? '';
    document.getElementById('recipeVctEqReq').value = recipe?.vctEqReq ?? '';
    document.getElementById('recipeAirReq').value = recipe?.airReq ?? '';
    if (document.getElementById('recipeBinderCategory')) document.getElementById('recipeBinderCategory').value = recipe?.binderCategory || recipe?.exposureAssessment?.binderCategory || 'standard';
    if (document.getElementById('recipeDmaxClass')) document.getElementById('recipeDmaxClass').value = recipe?.dmaxClass || recipe?.exposureAssessment?.dmaxClass || 'gt16';

    materialsTbody.innerHTML = '';
    (recipe?.materials?.length? recipe.materials : [{type:'Vatten'},{type:'Cement'}]).forEach(m=> materialsTbody.appendChild(newMaterialRow(m)));
    previewRecipeCalc();
    recipeDialog.showModal();
  }
  document.getElementById('recipePerM3')?.addEventListener('change', (e)=>{ const per = e.target.value === 'true'; document.getElementById('satsVolumeRow').style.display = per? 'none':'grid'; });
  ['recipeVctEqReq','recipeAirReq','recipeBinderCategory','recipeDmaxClass'].forEach(id=>{
    document.getElementById(id)?.addEventListener('input', previewRecipeCalc);
    document.getElementById(id)?.addEventListener('change', previewRecipeCalc);
  });

  function getMaterialsFromTable(){
    const rows = [...materialsTbody.querySelectorAll('tr')];
    return rows.map(r=>({
      type: r.querySelector('.mat-type').value,
      name: r.querySelector('.mat-name').value.trim(),
      amount: parseFloat(r.querySelector('.mat-amount').value || 0),
      k: r.querySelector('.mat-k').value===''? null : parseFloat(r.querySelector('.mat-k').value),
      note: r.querySelector('.mat-note').value
    }));
  }

  /*********************** v12 – Preliminär exponeringsklassbedömning ************************/
  function parseExposureNum(v){
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function minAirForDmaxClass(dmaxClass){
    if (dmaxClass === 'le8') return 5.0;
    if (dmaxClass === 'gt8_le16') return 4.5;
    return 4.0; // >16 mm
  }

  function exposureThresholdsForBinder(category){
    // Förenklad första kontroll: vctekv + lufthalt.
    // Denna ersätter inte full kontroll av cementtyp, klinkerandel, tillsatsmaterial, frostprovning eller EPCC.
    const blended = category === 'cem_iib_iiia';
    return [
      { code:'X0',  label:'X0',  max:null, note:'Ingen vctekv-gräns i denna preliminära kontroll.' },
      { code:'XC1', label:'XC1', max:0.90 },
      { code:'XC2', label:'XC2', max: blended ? 0.55 : 0.60 },
      { code:'XC3', label:'XC3', max: blended ? 0.50 : 0.55 },
      { code:'XC4', label:'XC4', max: blended ? 0.50 : 0.55 },
      { code:'XA1', label:'XA1', max:0.50, note:'Kemiskt angrepp kräver att miljödata och bindemedel kontrolleras.' },
      { code:'XA2', label:'XA2', max:0.45, note:'Kräver sulfatresistent/lämpligt bindemedel enligt standard.' },
      { code:'XA3', label:'XA3', max:0.40, note:'Bindemedel bestäms normalt i varje enskilt fall.' }
    ];
  }

  function assessRecipeExposure({vctEq, airReq, dmaxClass, binderCategory}){
    const v = parseExposureNum(vctEq);
    const air = parseExposureNum(airReq);
    const minAir = minAirForDmaxClass(dmaxClass);
    const ok = [];
    const warnings = [];

    for (const rule of exposureThresholdsForBinder(binderCategory)){
      if (rule.max == null || (v != null && v <= rule.max)) ok.push(rule.code);
    }

    // Frostklassernas fulla bedömning är mer avancerad. Här ger vi bara en försiktig preliminär signal.
    if (v != null && v <= 0.55) ok.push('XF1*');
    if (v != null && air != null && air >= minAir) {
      if (v <= 0.45) ok.push('XF2*');
      if (v <= 0.50) ok.push('XF3*');
    }
    if (air == null || air < minAir) warnings.push(`XF2/XF3 kräver luftkontroll: minst ${minAir.toFixed(1)} % för vald Dmax.`);
    warnings.push('Preliminär kontroll: verifiera alltid cement/bindemedel, ballast, tillsatsmaterial, frostprovning och projektspecifika krav manuellt. * = kräver särskild kontroll.');

    return {
      classes: Array.from(new Set(ok)),
      warnings,
      vctEq: v,
      airReq: air,
      dmaxClass,
      binderCategory,
      source: 'SS 137003:2021/SS-EN 206:2013+A2:2021 – förenklad v12-bedömning'
    };
  }

  function renderExposurePills(assessment){
    const classes = assessment?.classes || [];
    if (!classes.length) return '<span class="pill warn">Inga preliminära klasser</span>';
    return `<div class="exposure-pills">${classes.map(c=>`<span class="exposure-pill ${c.includes('*')?'warn':'ok'}">${escapeHtml(c)}</span>`).join('')}</div>`;
  }

  function currentRecipeExposureAssessment(vctEqOverride=null){
    const vctEq = vctEqOverride ?? parseFloat(document.getElementById('recipeVctEqReq')?.value || '');
    const airReq = parseFloat(document.getElementById('recipeAirReq')?.value || '');
    const dmaxClass = document.getElementById('recipeDmaxClass')?.value || 'gt16';
    const binderCategory = document.getElementById('recipeBinderCategory')?.value || 'standard';
    return assessRecipeExposure({vctEq, airReq, dmaxClass, binderCategory});
  }

  function previewRecipeCalc(){
    const mats = getMaterialsFromTable();
    const {water, cement, equivAdd, vct, vctEq} = calcVCT(mats);
    const el = document.getElementById('recipeCalcPreview');
    const per = document.getElementById('recipePerM3').value==='true';
    const satsV = parseFloat(document.getElementById('recipeSatsVolym').value||0);
    const exposure = currentRecipeExposureAssessment(Number.isFinite(vctEq) ? vctEq : null);
    el.innerHTML = `Vatten: <b>${water.toFixed(1)}</b> kg • Cement: <b>${cement.toFixed(1)}</b> kg • Σ(k×tillsats): <b>${equivAdd.toFixed(1)}</b> kg • VCT: <b>${(vct||0).toFixed(3)}</b> • VCT<sub>ekv</sub>: <b>${(vctEq||0).toFixed(3)}</b> • Per m³: <b>${per?'Ja':'Nej'}</b>${per?'':` (satsvolym ${satsV||'?'} m³)`}`;
    const expEl = document.getElementById('recipeExposurePreview');
    if (expEl) expEl.innerHTML = renderExposurePills(exposure) + `<div class="exposure-note">${escapeHtml((exposure.warnings||[])[0] || 'Preliminär bedömning.')}</div>`;
  }
  /***********************************************************
   * 🍳 SPARA RECEPT
   *
   * Första SaaS-steget:
   * - Recept sparas fortfarande lokalt i LocalStorage.
   * - Om Supabase är konfigurerat sparas receptet även i molnet.
   *
   * Det gör övergången trygg: appen fungerar även om molnet
   * inte är färdigkonfigurerat ännu.
   ***********************************************************/
  async function saveRecipeFromDialog(e){
    e.preventDefault();

    const name = document.getElementById('recipeName').value.trim();
    if (!name) {
      alert('Ange namn på recept.');
      return;
    }

    const strength = document.getElementById('recipeStrength').value.trim();
    const perM3 = document.getElementById('recipePerM3').value==='true';
    const satsVolym = parseFloat(document.getElementById('recipeSatsVolym').value||0) || null;
    const materials = getMaterialsFromTable().filter(m=>!isNaN(m.amount) && m.amount>0);
    const {vct, vctEq} = calcVCT(materials);
    const groupId = document.getElementById('recipeGroup')?.value || null;

    const existing = editingRecipeId ? RECIPES.find(r=>r.id===editingRecipeId) : null;
    const obj = {
      id: existing?.id || editingRecipeId || uuid(),
      cloudId: existing?.cloudId || null,
      name,
      strength,
      perM3,
      satsVolym,
      materials,
      vct,
      vctEq,
      vctReq: parseFloat(document.getElementById('recipeVctReq')?.value||''),
      vctEqReq: parseFloat(document.getElementById('recipeVctEqReq')?.value||''),
      airReq: parseFloat(document.getElementById('recipeAirReq')?.value||''),
      binderCategory: document.getElementById('recipeBinderCategory')?.value || 'standard',
      dmaxClass: document.getElementById('recipeDmaxClass')?.value || 'gt16',
      exposureAssessment: currentRecipeExposureAssessment(Number.isFinite(Number(vctEq)) ? Number(vctEq) : null),
      groupId,
      createdAt: existing?.createdAt || new Date().toISOString()
    };

    const cloudRecipe = await saveRecipeToSupabase(obj);
    if (!cloudRecipe) return;

    if (existing){
      RECIPES = RECIPES.map(r=> r.id===editingRecipeId ? cloudRecipe : r);
    } else {
      RECIPES.push(cloudRecipe);
    }

    recipeDialog.close();
    renderRecipes();
    renderRecipeSelects();
    renderDashboard();

    alert('Recept sparat live i Supabase.');
  }
  function renderRecipes(){
    const tbody = document.querySelector('#recipesTable tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    RECIPES.forEach(r=>{
      const matsShort = r.materials.map(m=> `${m.type}${m.name?`/${m.name}`:''}:${m.amount}${(['GGBS/Slagg','Flygaska','Silika'].includes(m.type) && (m.k||m.k===0))? `(k=${m.k})`:''}`).join(', ');
      const groupName = (SETTINGS.groups||[]).find(g=>g.id===r.groupId)?.name || '';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.name}</td>
        <td>${r.strength||''}</td>
        <td>${escapeHtml(groupName)}</td>
        <td>${r.perM3? 'Ja' : `Nej (${r.satsVolym||'?'} m³/sats)`}</td>
        <td>${(r.vct??0).toFixed(3)}</td>
        <td>${(r.vctEq??0).toFixed(3)}</td>
        <td>${renderExposurePills(r.exposureAssessment || assessRecipeExposure({vctEq:r.vctEq, airReq:r.airReq, dmaxClass:r.dmaxClass||'gt16', binderCategory:r.binderCategory||'standard'}))}</td>
        <td style="max-width:520px">${matsShort}</td>
        <td>
          <div class="toolbar">
            <button class="btn secondary" data-edit>Redigera</button>
            <button class="btn danger" data-del>Ta bort</button>
          </div>
        </td>`;
      tr.querySelector('[data-edit]').addEventListener('click', ()=> openRecipeDialog(r));
      tr.querySelector('[data-del]').addEventListener('click', async ()=>{
        if(!confirm('Ta bort receptet?')) return;
        const ok = await deleteRecipeFromSupabase(r);
        if (!ok) return;
        RECIPES = RECIPES.filter(x=>x.id!==r.id);
        renderRecipes(); renderRecipeSelects(); renderDashboard();
      });
      tbody.appendChild(tr);
    });
  }
  function renderRecipeSelects(){
    const selects = [document.getElementById('batchRecipe'), document.getElementById('cubeRecipe'), document.getElementById('airRecipe'), document.getElementById('orderRecipe'), document.getElementById('ncStrength')];
    for (const sel of selects){ if (!sel) continue; sel.innerHTML = '<option value="">— välj —</option>' + RECIPES.map(r=>`<option value="${r.id}">${r.name}${r.strength?` (${r.strength})`:''}</option>`).join(''); }
    const strengths = Array.from(new Set(RECIPES.map(r=> r.strength).filter(Boolean)));
    const strengthSelects = [document.getElementById('batchStrengthFilter'), document.getElementById('dashStrengthFilter'), document.getElementById('orderStrengthFilter'), document.getElementById('evalStrength')];
    for (const ssel of strengthSelects){ if (!ssel) continue; ssel.innerHTML = '<option value="">Alla</option>' + strengths.map(s=> `<option>${s}</option>`).join(''); }
    syncMaterialNamesDatalist();
    fillEvalGroupSelect();
  }
  document.getElementById('btnAddMaterialRow')?.addEventListener('click', ()=> materialsTbody.appendChild(newMaterialRow()));
  document.getElementById('btnSaveRecipe')?.addEventListener('click', saveRecipeFromDialog);
  document.getElementById('openAddRecipe')?.addEventListener('click', ()=> openRecipeDialog());
  document.getElementById('btnAddRecipe')?.addEventListener('click', ()=> openRecipeDialog());
  document.getElementById('btnExportRecipes')?.addEventListener('click', ()=> downloadJSON('recipes.json', RECIPES));
  document.getElementById('btnImportRecipes')?.addEventListener('click', ()=> document.getElementById('importRecipesFile').click());
  document.getElementById('importRecipesFile')?.addEventListener('change', ()=> alert('Import av recept till molnet gör vi i ett senare steg. Lägg till recept direkt i appen så sparas de i Supabase.'));

  /*********************** Satser ************************/
  function renderBatchForm(){
    renderRecipeSelects();
    const dt = document.getElementById('batchDateTime');
    if (dt) dt.value = new Date().toISOString().slice(0,16);
  }
  document.getElementById('btnAddBatch')?.addEventListener('click', async ()=>{
    const recipeId = document.getElementById('batchRecipe').value;
    const amountM3 = parseFloat(document.getElementById('batchAmount').value || 0);
    const dt = document.getElementById('batchDateTime').value;
    const recipe = RECIPES.find(r=> r.id===recipeId);
    if (!recipe) { alert('Välj ett recept.'); return; }
    if (!(amountM3>0)) { alert('Ange mängd i m³.'); return; }

    const perM3 = gwpPerM3FromRecipe(recipe, MATERIALS);
    const b = {
      id: uuid(),
      cloudId: null,
      recipeId,
      recipeCloudId: recipe.cloudId || recipe.id,
      recipeName: recipe.name,
      strength: recipe.strength||'',
      amount: amountM3,
      dateTime: new Date(dt||Date.now()).toISOString(),
      vct: recipe.vct,
      vctEq: recipe.vctEq,
      gwpPerM3: perM3,
      gwpTotal: perM3 * amountM3,
      createdAt: new Date().toISOString()
    };

    const cloudBatch = await saveBatchToSupabase(b);
    if (!cloudBatch) return;

    BATCHES.unshift(cloudBatch);
    renderBatches();
    renderDashboard();
    document.getElementById('batchAmount').value='';
    alert('Sats sparad live i Supabase.');
  });

  function ensureBatchGwp(b){
    if (b.gwpPerM3==null || isNaN(b.gwpPerM3)){
      const recipe = RECIPES.find(r=> r.id===b.recipeId);
      if (recipe){ const perM3 = gwpPerM3FromRecipe(recipe, MATERIALS); b.gwpPerM3 = perM3; b.gwpTotal = perM3 * (parseFloat(b.amount)||0); }
    }
    return b;
  }
  function renderBatches(){
    const tbody = document.querySelector('#batchesTable tbody');
    if(!tbody) return;
    tbody.innerHTML='';
    const from = document.getElementById('batchDateFrom').value;
    const to = document.getElementById('batchDateTo').value;
    const strength = document.getElementById('batchStrengthFilter').value;
    const sourceFilter = document.getElementById('batchSourceFilter')?.value || '';
    let list = [...BATCHES];
    list = list.filter(b=> {
      const batchType = (b.productionType || b.app_data?.productionType || b.app_data?.production_type || (b.source === 'customer_order' ? 'order' : (b.source === 'prefab_queue' ? 'prefab' : '')));
      return (!from || b.dateTime.slice(0,10)>=from) && (!to || b.dateTime.slice(0,10)<=to) && (!strength || b.strength===strength) && (!sourceFilter || batchType === sourceFilter);
    });
    let updated=false;
    for (const b of list){ ensureBatchGwp(b) && (updated=true); }
    // Cloud-first: GWP uppdateras i minnet här; vid ändring sparas raden via Supabase i redigeringsflödet.
    LAST_BATCHES_VIEW = list;
    const totalM3 = list.reduce((s,b)=> s + (parseFloat(b.amount)||0), 0);
    const totalGWP = list.reduce((s,b)=> s + (b.gwpTotal||0), 0);
    const totalsEl = document.getElementById('batchTotals');
    if (totalsEl) totalsEl.innerHTML = `Summering: <b>${totalM3.toFixed(2)} m³</b> • <b>${totalGWP.toFixed(0)} kg CO₂e</b>`;
    for (const b of list){
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${fmtDate(b.dateTime)}</td>
        <td>${b.recipeName}</td>
        <td>${b.strength||''}</td>
        <td>${((b.productionType || b.app_data?.productionType || b.app_data?.production_type || (b.source === 'customer_order' ? 'order' : (b.source === 'prefab_queue' ? 'prefab' : ''))) === 'order') ? 'Beställning' : (((b.productionType || b.app_data?.productionType || b.app_data?.production_type || b.source) ? 'Prefab' : '—'))}</td>
        <td>${b.amount}</td>
        <td>${(b.vct??0).toFixed(3)}</td>
        <td>${(b.vctEq??0).toFixed(3)}</td>
        <td>${(b.gwpPerM3??0).toFixed(1)}</td>
        <td>${(b.gwpTotal??0).toFixed(1)}</td>
        <td>
          <div class="toolbar">
            <button class="btn secondary" data-edit>Redigera</button>
            <button class="btn danger" data-del>Ta bort</button>
          </div>
        </td>`;
      tr.querySelector('[data-del]').addEventListener('click', async ()=>{
        if(!confirm('Ta bort satsen?')) return;
        const ok = await deleteBatchFromSupabase(b);
        if (!ok) return;
        BATCHES = BATCHES.filter(x=>x.id!==b.id);
        renderBatches(); renderDashboard();
      });
      tr.querySelector('[data-edit]').addEventListener('click', ()=> openEditDialog('batch', b));
      tbody.appendChild(tr);
    }
  }
  document.getElementById('btnApplyBatchFilters')?.addEventListener('click', renderBatches);
  document.getElementById('batchSourceFilter')?.addEventListener('change', renderBatches);
  document.getElementById('btnExportBatches')?.addEventListener('click', ()=> downloadJSON('batches.json', BATCHES));
  document.getElementById('btnExportBatchesPDF')?.addEventListener('click', exportBatchesPDF);
  document.getElementById('btnImportBatches')?.addEventListener('click', ()=> document.getElementById('importBatchesFile').click());
  document.getElementById('importBatchesFile')?.addEventListener('change', ()=> alert('Import av satser till molnet gör vi i ett senare steg. Registrera satser direkt i appen så sparas de i Supabase.'));

  /*********************** Provkuber ************************/
  function renderCubeForm(){
    renderRecipeSelects();
    document.getElementById('cubeCastDate').value = todayISO();
    document.getElementById('cubeCureDays').value = SETTINGS.defaultCureDays || 28;
  }
  document.getElementById('btnAddCube')?.addEventListener('click', async ()=>{
    const recipeId = document.getElementById('cubeRecipe').value;
    const recipe = RECIPES.find(r=> r.id===recipeId);
    if (!recipe){ alert('Välj ett recept.'); return; }
    const castDate = document.getElementById('cubeCastDate').value || todayISO();
    const cureDays = parseInt(document.getElementById('cubeCureDays').value||SETTINGS.defaultCureDays||28);
    const weight = parseFloat(document.getElementById('cubeWeight').value||'');
    const strengthMPa = parseFloat(document.getElementById('cubeStrength').value||'');
    const note = document.getElementById('cubeNote').value||'';
    const batchId = (document.getElementById('cubeBatchId').value||'').trim();
    const extra = (document.getElementById('cubeExtra').value||'').trim();
    const excludeFromEval = document.getElementById('cubeExclude')?.checked || false;
    const due = new Date(castDate); due.setDate(due.getDate()+cureDays);
    let item = { vctReq: parseFloat(document.getElementById('cubeVctReq')?.value||''), vctEqReq: parseFloat(document.getElementById('cubeVctEqReq')?.value||''), airReq: parseFloat(document.getElementById('cubeAirReq')?.value||''), vct: parseFloat(document.getElementById('cubeVct')?.value||''), vctEq: parseFloat(document.getElementById('cubeVctEq')?.value||''), air: parseFloat(document.getElementById('cubeAir')?.value||''), temp: parseFloat(document.getElementById('cubeTemp')?.value||''), kw: parseFloat(document.getElementById('cubeKw')?.value||''), id: uuid(),
      recipeId, recipeCloudId: recipe.cloudId || recipe.id, recipeName: recipe.name, strengthClass: recipe.strength||'',
      castDate, cureDays, dueDate: due.toISOString().slice(0,10),
      weight: isNaN(weight)? null: weight,
      resultMPa: isNaN(strengthMPa)? null: strengthMPa,
      note, batchId, extra,
      excludeFromEval
    };
    const cloudItem = await saveCubeToSupabase(item);
    if (!cloudItem) return;
    item = cloudItem;
    CUBES.unshift(item);
    renderCubes(); renderDashboard();
    ['cubeWeight','cubeStrength','cubeNote','cubeBatchId','cubeExtra','cubeExclude'].forEach(id=>{
      const el = document.getElementById(id); if (!el) return; if (el.type==='checkbox') el.checked=false; else el.value='';
    });
  });

  function renderCubes(){
    const tbody = document.querySelector('#cubesTable tbody');
    if(!tbody) return;
    tbody.innerHTML='';
    for (const c of CUBES){
      const status = c.resultMPa!=null? '<span class="pill ok">Klar</span>' : (new Date(c.dueDate) <= new Date()? '<span class="pill warn">Klar att prova</span>':'<span class="pill">Under härdning</span>');
      const excl = c.excludeFromEval ? ' <small class="pill warn">Ej i utvärdering</small>' : '';
      const vctPair = `${isFinite(c.vct)? Number(c.vct).toFixed(3):''}${isFinite(c.vctReq)?' / '+Number(c.vctReq).toFixed(3):''}`;
      const vctEqPair = `${isFinite(c.vctEq)? Number(c.vctEq).toFixed(3):''}${isFinite(c.vctEqReq)?' / '+Number(c.vctEqReq).toFixed(3):''}`;
      const airPair = `${isFinite(c.air)? Number(c.air).toFixed(1):''}${isFinite(c.airReq)?' / '+Number(c.airReq).toFixed(1):''}`;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${fmtOnlyDate(c.castDate)}</td>
        <td>${escapeHtml(c.recipeName)}${excl}</td>
        <td>${c.strengthClass||''}</td>
        <td>${vctPair}</td>
        <td>${vctEqPair}</td>
        <td>${airPair}</td>
        <td>${isFinite(c.temp)? Number(c.temp).toFixed(1):''}</td>
        <td>${isFinite(c.kw)? Number(c.kw).toFixed(1):''}</td>
        <td>${c.weight??''}</td>
        <td>${c.resultMPa??''}</td>
        <td>${fmtOnlyDate(c.dueDate)}</td>
        <td>${status}</td>
        <td>${c.batchId? `<span class="pill">${c.batchId}</span>`:''}</td>
        <td>${c.extra||''}</td>
        <td>
          <div class="toolbar">
            <button class="btn secondary" data-edit>Redigera</button>
            <button class="btn danger" data-del>Ta bort</button>
          </div>
        </td>`;
      tr.querySelector('[data-del]').addEventListener('click', async ()=>{
        if(!confirm('Ta bort provkuben?')) return;
        const ok = await deleteCubeFromSupabase(c);
        if (!ok) return;
        CUBES = CUBES.filter(x=>x.id!==c.id);
        renderCubes(); renderDashboard();
      });
      tr.querySelector('[data-edit]').addEventListener('click', ()=> openEditDialog('cube', c));
      tbody.appendChild(tr);
    }
  }
  document.getElementById('btnExportCubes')?.addEventListener('click', ()=> downloadJSON('cubes.json', CUBES));
  document.getElementById('btnImportCubes')?.addEventListener('click', ()=> document.getElementById('importCubesFile').click());
  document.getElementById('importCubesFile')?.addEventListener('change', ()=> alert('Import av provkuber till molnet gör vi i ett senare steg. Registrera provkuber direkt i appen så sparas de i Supabase.'));
  document.getElementById('btnExportCubesPDF')?.addEventListener('click', async ()=>{ const ok = await ensureFreshCloudDataForReport('provkuber'); if (!ok) return; openPrintWindow('Provkuber', `<h1>Provkuber</h1>${reportMetaHTML()}${cubesReportHTML(CUBES)}`); });

  /*********************** Luftprov ************************/
  function renderAirForm(){ renderRecipeSelects(); document.getElementById('airDate').value = todayISO(); }
  document.getElementById('btnAddAir')?.addEventListener('click', async ()=>{
    const recipeId = document.getElementById('airRecipe').value;
    const recipe = RECIPES.find(r=> r.id===recipeId);
    if (!recipe){ alert('Välj ett recept.'); return; }
    const date = document.getElementById('airDate').value || todayISO();
    const pct = parseFloat(document.getElementById('airPct').value||'');
    if (isNaN(pct)) { alert('Ange lufthalt (%)'); return; }
    const note = document.getElementById('airNote').value||'';
    let item = { id: uuid(), recipeId, recipeCloudId: recipe.cloudId || recipe.id, recipeName: recipe.name, strengthClass: recipe.strength||'', date, pct, note };
    const cloudItem = await saveAirToSupabase(item);
    if (!cloudItem) return;
    item = cloudItem;
    AIR.unshift(item);
    renderAir();
    document.getElementById('airPct').value=''; document.getElementById('airNote').value='';
  });
  function renderAir(){
    const tbody = document.querySelector('#airTable tbody');
    if(!tbody) return;
    tbody.innerHTML='';
    for (const a of AIR){
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${fmtOnlyDate(a.date)}</td>
        <td>${a.recipeName}</td>
        <td>${a.strengthClass||''}</td>
        <td>${a.pct}</td>
        <td>${a.note||''}</td>
        <td>
          <div class="toolbar">
            <button class="btn secondary" data-edit>Redigera</button>
            <button class="btn danger" data-del>Ta bort</button>
          </div>
        </td>`;
      tr.querySelector('[data-del]').addEventListener('click', async ()=>{
        if(!confirm('Ta bort luftprovet?')) return;
        const ok = await deleteAirFromSupabase(a);
        if (!ok) return;
        AIR = AIR.filter(x=>x.id!==a.id);
        renderAir();
      });
      tr.querySelector('[data-edit]').addEventListener('click', ()=> openEditDialog('air', a));
      tbody.appendChild(tr);
    }
  }
  document.getElementById('btnExportAir')?.addEventListener('click', ()=> downloadJSON('air.json', AIR));
  document.getElementById('btnImportAir')?.addEventListener('click', ()=> document.getElementById('importAirFile').click());
  document.getElementById('importAirFile')?.addEventListener('change', ()=> alert('Import av luftprov till molnet gör vi i ett senare steg. Registrera luftprov direkt i appen så sparas de i Supabase.'));

  /* ********************* Kontroll (Instrument) ********************* */
  const CONTROL_TYPES = { AIR:'air', THERMO:'thermo' };
  const MONTHS_SE = ['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];

  function renderControlDevices(){
    const airBody = document.querySelector('#airDevicesTable tbody');
    const thermoBody = document.querySelector('#thermoDevicesTable tbody');
    if (!airBody || !thermoBody) return;
    airBody.innerHTML = '';
    thermoBody.innerHTML = '';
    const year = new Date().getFullYear();
    for (const d of (CONTROL_DEVICES||[]).filter(x=>x.type===CONTROL_TYPES.AIR)){
      const st = deviceYearStatus(d, year);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${d.name}${d.serial?` <small class="pill">${d.serial}</small>`:''}</td>
        <td class="dev-status">${statusPill(st)}</td>
        <td>${st.lastDate? fmtOnlyDate(st.lastDate):''}</td>
        <td>
          <div class="toolbar">
            <button class="btn" data-manage>Hantera</button>
            <button class="btn secondary" data-edit>Redigera</button>
            <button class="btn secondary" data-export>PDF</button>
            <button class="btn danger" data-del>Ta bort</button>
          </div>
        </td>`;
      tr.querySelector('[data-manage]').addEventListener('click', ()=> openControlDialog(d.id));
      tr.querySelector('[data-edit]').addEventListener('click', ()=> openEditDialog('instrument', d));
      tr.querySelector('[data-export]').addEventListener('click', async ()=>{ const ok = await ensureFreshCloudDataForReport('kontrollrapport'); if (!ok) return; const fresh = CONTROL_DEVICES.find(x=>x.id===d.id) || d; openPrintWindow(`Kontroll – ${fresh.name}`, `<h1>Kontroll – ${escapeHtml(fresh.name)}</h1>${reportMetaHTML()}${controlDeviceReportHTML(fresh)}`); });
      tr.querySelector('[data-del]').addEventListener('click', async ()=>{ if(confirm('Ta bort instrumentet?')){ const ok = await deleteControlDeviceFromSupabase(d); if (!ok) return; CONTROL_DEVICES = CONTROL_DEVICES.filter(x=>x.id!==d.id); renderControlDevices(); renderDashboard(); }});
      airBody.appendChild(tr);
    }
    for (const d of (CONTROL_DEVICES||[]).filter(x=>x.type===CONTROL_TYPES.THERMO)){
      const st = deviceYearStatus(d, year);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${d.name}${d.serial?` <small class="pill">${d.serial}</small>`:''}</td>
        <td class="dev-status">${statusPill(st)}</td>
        <td>${st.lastDate? fmtOnlyDate(st.lastDate):''}</td>
        <td>
          <div class="toolbar">
            <button class="btn" data-manage>Hantera</button>
            <button class="btn secondary" data-edit>Redigera</button>
            <button class="btn secondary" data-export>PDF</button>
            <button class="btn danger" data-del>Ta bort</button>
          </div>
        </td>`;
      tr.querySelector('[data-manage]').addEventListener('click', ()=> openControlDialog(d.id));
      tr.querySelector('[data-edit]').addEventListener('click', ()=> openEditDialog('instrument', d));
      tr.querySelector('[data-export]').addEventListener('click', async ()=>{ const ok = await ensureFreshCloudDataForReport('kontrollrapport'); if (!ok) return; const fresh = CONTROL_DEVICES.find(x=>x.id===d.id) || d; openPrintWindow(`Kontroll – ${fresh.name}`, `<h1>Kontroll – ${escapeHtml(fresh.name)}</h1>${reportMetaHTML()}${controlDeviceReportHTML(fresh)}`); });
      tr.querySelector('[data-del]').addEventListener('click', async ()=>{ if(confirm('Ta bort instrumentet?')){ const ok = await deleteControlDeviceFromSupabase(d); if (!ok) return; CONTROL_DEVICES = CONTROL_DEVICES.filter(x=>x.id!==d.id); renderControlDevices(); renderDashboard(); }});
      thermoBody.appendChild(tr);
    }
    const addAirBtn = document.getElementById('btnAddAirDevice');
    const addThermoBtn = document.getElementById('btnAddThermoDevice');
    addAirBtn && (addAirBtn.onclick = ()=> openEditDialog('instrument', { id:null, type: CONTROL_TYPES.AIR, name:'', serial:'', checks:{} }));
    addThermoBtn && (addThermoBtn.onclick = ()=> openEditDialog('instrument', { id:null, type: CONTROL_TYPES.THERMO, name:'', serial:'', checks:{} }));

    const btnAll = document.getElementById('btnExportControlPDF');
    btnAll && (btnAll.onclick = async ()=>{
      const ok = await ensureFreshCloudDataForReport('kontrollrapport');
      if (!ok) return;
      const html = `<h1>Kontroll – Alla instrument</h1>${reportMetaHTML()}` + CONTROL_DEVICES.map(d=> controlDeviceReportHTML(d)).join('<hr style="margin:12px 0;border:none;border-top:1px solid #999">');
      openPrintWindow('Kontroll – Alla instrument', html);
    });
  }

  function deviceYearStatus(device, year){
    const checks = device.checks?.[year] || {};
    let ok=0, fail=0, miss=0; let lastDate=null;
    for (let m=1;m<=12;m++){
      const r = checks[m];
      if (!r){ miss++; continue; }
      const okMonth = (device.type===CONTROL_TYPES.AIR)
        ? (typeof r.target==='number' && typeof r.actual==='number' && Math.abs(r.actual - r.target) <= 0.1)
        : (typeof r.t1==='number' && typeof r.t2==='number' && Math.abs(r.t1 - r.t2) <= 1);
      okMonth? ok++ : fail++;
      if (r.date) lastDate = (!lastDate || r.date>lastDate)? r.date : lastDate;
    }
    return { ok, fail, miss, lastDate };
  }
  function statusPill(st){
    if (st.fail>0) return `<span class="pill danger">Ej godkänd (${st.fail} fail)</span>`;
    if (st.ok===12) return `<span class="pill ok">OK (12/12)</span>`;
    return `<span class="pill warn">Ej utförd (${st.miss} saknas)</span>`;
  }

  const controlDialog = document.getElementById('controlDialog');
  function openControlDialog(id){
    const d = CONTROL_DEVICES.find(x=>x.id===id);
    if (!d) return;
    document.getElementById('controlDialogTitle').textContent = `Kontroll – ${d.name}`;
    const yearSel = document.getElementById('controlYear');
    const yNow = new Date().getFullYear();
    yearSel.innerHTML = [yNow-1,yNow,yNow+1].map(y=>`<option ${y===yNow?'selected':''} value="${y}">${y}</option>`).join('');
    yearSel.onchange = ()=> renderControlMonths(d, parseInt(yearSel.value));
    renderControlMonths(d, yNow);
    document.getElementById('btnSaveControl').onclick = async (e)=>{ e.preventDefault(); await saveControlMonths(d, parseInt(yearSel.value)); };
    document.getElementById('btnExportThisDevicePDF').onclick = async (e)=>{ e.preventDefault(); const ok = await ensureFreshCloudDataForReport('kontrollrapport'); if (!ok) return; const fresh = CONTROL_DEVICES.find(x=>x.id===d.id) || d; openPrintWindow(`Kontroll – ${fresh.name}`, `<h1>Kontroll – ${escapeHtml(fresh.name)}</h1>${reportMetaHTML()}${controlDeviceReportHTML(fresh)}`); };
    controlDialog.showModal();
  }

  function renderControlMonths(d, year){
    const container = document.getElementById('controlMonths');
    const checks = d.checks?.[year] || {};
    let thead = '';
    if (d.type===CONTROL_TYPES.AIR){
      thead = '<tr><th>Månad</th><th>Datum</th><th>Bör (%)</th><th>Är (%)</th><th>Avvikelse</th><th>Status</th></tr>';
    } else {
      thead = '<tr><th>Månad</th><th>Datum</th><th>Termometer 1 (°C)</th><th>Termometer 2 (°C)</th><th>Diff</th><th>Status</th></tr>';
    }
    const rows = [];
    for (let m=1;m<=12;m++){
      const r = checks[m] || {};
      if (d.type===CONTROL_TYPES.AIR){
        const dev = (typeof r.actual==='number' && typeof r.target==='number')? (r.actual - r.target) : null;
        const ok = (dev!=null) && Math.abs(dev) <= 0.1;
        rows.push(`
          <tr>
            <td class="month-label">${MONTHS_SE[m-1]}</td>
            <td><input type="date" id="air_m${m}_date" value="${r.date||''}"></td>
            <td><input type="number" step="0.1" id="air_m${m}_target" value="${r.target??''}"></td>
            <td><input type="number" step="0.1" id="air_m${m}_actual" value="${r.actual??''}"></td>
            <td>${dev!=null? dev.toFixed(2):''}</td>
            <td>${dev!=null? (ok? '<span class="pill ok">OK</span>' : '<span class="pill danger">Ej godkänd</span>') : '<span class="pill warn">Ej utförd</span>'}</td>
          </tr>`);
      } else {
        const diff = (typeof r.t1==='number' && typeof r.t2==='number')? (r.t1 - r.t2) : null;
        const ok = (diff!=null) && Math.abs(diff) <= 1;
        rows.push(`
          <tr>
            <td class="month-label">${MONTHS_SE[m-1]}</td>
            <td><input type="date" id="thermo_m${m}_date" value="${r.date||''}"></td>
            <td><input type="number" step="0.1" id="thermo_m${m}_t1" value="${r.t1??''}"></td>
            <td><input type="number" step="0.1" id="thermo_m${m}_t2" value="${r.t2??''}"></td>
            <td>${diff!=null? diff.toFixed(2):''}</td>
            <td>${diff!=null? (ok? '<span class="pill ok">OK</span>' : '<span class="pill danger">Ej godkänd</span>') : '<span class="pill warn">Ej utförd</span>'}</td>
          </tr>`);
      }
    }
    container.innerHTML = `<div class="control-months"><table><thead>${thead}</thead><tbody>${rows.join('')}</tbody></table></div>`;
  }
  async function saveControlMonths(d, year){
    const out = {};
    for (let m=1;m<=12;m++){
      if (d.type===CONTROL_TYPES.AIR){
        const date = document.getElementById(`air_m${m}_date`).value || '';
        const target = parseFloat(document.getElementById(`air_m${m}_target`).value);
        const actual = parseFloat(document.getElementById(`air_m${m}_actual`).value);
        if (date && !isNaN(target) && !isNaN(actual)) out[m] = { date, target, actual };
      } else {
        const date = document.getElementById(`thermo_m${m}_date`).value || '';
        const t1 = parseFloat(document.getElementById(`thermo_m${m}_t1`).value);
        const t2 = parseFloat(document.getElementById(`thermo_m${m}_t2`).value);
        if (date && !isNaN(t1) && !isNaN(t2)) out[m] = { date, t1, t2 };
      }
    }
    if (!d.checks) d.checks = {};
    d.checks[year] = out;
    const cloudDevice = await saveControlDeviceToSupabase(d);
    if (!cloudDevice) return;
    CONTROL_DEVICES = CONTROL_DEVICES.map(x=> x.id===d.id? cloudDevice : x);
    renderControlDevices();
    renderDashboard();
    controlDialog.close();
  }
  function controlDeviceReportHTML(d){
    const y = new Date().getFullYear();
    const checks = d.checks?.[y] || {};
    const header = `<h2 style="margin:0">${escapeHtml(d.name)} ${d.serial?`<small>(${escapeHtml(d.serial)})</small>`:''}</h2><div class="meta">År ${y} • Typ: ${d.type==='air'?'Lufthaltsmätare':'Termometer'}</div>`;
    const th = d.type==='air'
      ? '<tr><th>Månad</th><th>Datum</th><th>Bör (%)</th><th>Är (%)</th><th>Avvikelse</th><th>Status</th></tr>'
      : '<tr><th>Månad</th><th>Datum</th><th>T1 (°C)</th><th>T2 (°C)</th><th>Diff</th><th>Status</th></tr>';
    const rows = [];
    for (let m=1;m<=12;m++){
      const r = checks[m]||{};
      if (d.type==='air'){
        const dev = (typeof r.actual==='number' && typeof r.target==='number')? (r.actual - r.target) : null;
        const ok = (dev!=null) && Math.abs(dev)<=0.1;
        rows.push(`<tr><td>${MONTHS_SE[m-1]}</td><td>${escapeHtml(r.date||'')}</td><td class="right">${r.target??''}</td><td class="right">${r.actual??''}</td><td class="right">${dev!=null?dev.toFixed(2):''}</td><td>${ok? 'OK':'—'}</td></tr>`);
      } else {
        const diff = (typeof r.t1==='number' && typeof r.t2==='number')? (r.t1 - r.t2) : null;
        const ok = (diff!=null) && Math.abs(diff)<=1;
        rows.push(`<tr><td>${MONTHS_SE[m-1]}</td><td>${escapeHtml(r.date||'')}</td><td class="right">${r.t1??''}</td><td class="right">${r.t2??''}</td><td class="right">${diff!=null?diff.toFixed(2):''}</td><td>${ok? 'OK':'—'}</td></tr>`);
      }
    }
    return `<h1>Kontrollprotokoll</h1>${header}<table><thead>${th}</thead><tbody>${rows.join('')}</tbody></table>`;
  }

  /* ********************* Beställningar ********************* */
  function renderCustomers(){
    const tbody = document.querySelector('#customersTable tbody');
    if (!tbody) return;
    tbody.innerHTML='';
    for (const c of (CUSTOMERS||[])){
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${c.name}</td>
        <td>${c.contactPerson||''}</td>
        <td>${c.info||''}</td>
        <td>
          <div class="toolbar">
            <button class="btn secondary" data-edit>Redigera</button>
            <button class="btn danger" data-del>Ta bort</button>
          </div>
        </td>`;
      tr.querySelector('[data-edit]').addEventListener('click', ()=> openEditDialog('customer', c));
      tr.querySelector('[data-del]').addEventListener('click', async ()=>{ if(confirm('Ta bort kunden?')){ const ok = await deleteCustomerFromSupabase(c); if(!ok) return; CUSTOMERS = CUSTOMERS.filter(x=>x.id!==c.id); renderCustomers(); renderCustomerSelects(); renderOrders(); }});
      tbody.appendChild(tr);
    }
    const btnAdd = document.getElementById('btnAddCustomer');
    const btnExp = document.getElementById('btnExportCustomers');
    const btnImp = document.getElementById('btnImportCustomers');
    const inpImp = document.getElementById('importCustomersFile');
    btnAdd && (btnAdd.onclick = ()=> openEditDialog('customer', { id:null, name:'', contactPerson:'', info:'' }));
    btnExp && (btnExp.onclick = ()=> downloadJSON('customers.json', CUSTOMERS||[]));
    btnImp && (btnImp.onclick = ()=> inpImp.click());
    inpImp && inpImp.addEventListener('change', async (e)=> importJSON(e, async (arr)=>{ for (const c of (arr||[])){ await saveCustomerToSupabase(c); } await loadCloudCoreData(); }));
  }
  function renderCustomerSelects(){
    const opts = ['<option value="">— välj kund —</option>'].concat((CUSTOMERS||[]).map(c=>`<option value="${c.id}">${c.name}</option>`)).join('');
    const selForm = document.getElementById('orderCustomer'); if (selForm) selForm.innerHTML = opts;
    const selFilter = document.getElementById('orderCustomerFilter'); if (selFilter) selFilter.innerHTML = '<option value="">Alla</option>' + (CUSTOMERS||[]).map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  }
  function renderOrderForm(){
    renderRecipeSelects();
    renderCustomerSelects();
    const dt = document.getElementById('orderDateTime'); if (dt) dt.value = new Date().toISOString().slice(0,16);
  }
  document.addEventListener('click', async (e)=>{
    if (e.target && e.target.id==='btnAddOrder'){
      const recipeId = document.getElementById('orderRecipe').value;
      const amountM3 = parseFloat(document.getElementById('orderAmount').value || 0);
      const dt = document.getElementById('orderDateTime').value;
      const customerId = document.getElementById('orderCustomer').value;
      const orderContact = (document.getElementById('orderContact').value||'').trim();
      const orderInfo = (document.getElementById('orderInfo').value||'').trim();
      const recipe = RECIPES.find(r=> r.id===recipeId);
      const customer = (CUSTOMERS||[]).find(c=> c.id===customerId);
      if (!recipe) { alert('Välj ett recept.'); return; }
      if (!(amountM3>0)) { alert('Ange mängd i m³.'); return; }
      if (!customer) { alert('Välj kund.'); return; }
      const o = {
        id: uuid(), recipeId, recipeCloudId: recipe.cloudId || recipe.id, recipeName: recipe.name, strength: recipe.strength||'',
        amount: amountM3, dateTime: new Date(dt||Date.now()).toISOString(),
        vct: recipe.vct, vctEq: recipe.vctEq,
        customerId: customer.id, customerCloudId: customer.cloudId || customer.id, customerName: customer.name,
        orderContact, orderInfo
      };
      const perM3 = gwpPerM3FromRecipe(recipe, MATERIALS);
      o.gwpPerM3 = perM3; o.gwpTotal = perM3 * amountM3;
      const cloudOrder = await saveOrderToSupabase(o);
      if (!cloudOrder) return;
      ORDERS.unshift(cloudOrder);
      renderOrders();
      renderDashboard();
      document.getElementById('orderAmount').value='';
    }
  });
  function ensureOrderGwp(o){
    if (o.gwpPerM3==null || isNaN(o.gwpPerM3)){
      const recipe = RECIPES.find(r=> r.id===o.recipeId);
      if (recipe){ const perM3 = gwpPerM3FromRecipe(recipe, MATERIALS); o.gwpPerM3 = perM3; o.gwpTotal = perM3 * (parseFloat(o.amount)||0); }
    }
    return o;
  }
  function renderOrders(){
    const tbody = document.querySelector('#ordersTable tbody');
    if (!tbody) return;
    tbody.innerHTML='';
    const from = document.getElementById('orderDateFrom').value;
    const to = document.getElementById('orderDateTo').value;
    const strength = document.getElementById('orderStrengthFilter').value;
    const customerId = document.getElementById('orderCustomerFilter').value;
    let list = [...(ORDERS||[])];
    list = list.filter(o=> (!from || o.dateTime.slice(0,10)>=from) && (!to || o.dateTime.slice(0,10)<=to) && (!strength || o.strength===strength) && (!customerId || o.customerId===customerId));
    for (const o of list){ ensureOrderGwp(o); }
    LAST_ORDERS_VIEW = list;
    const totalM3 = list.reduce((s,o)=> s + (parseFloat(o.amount)||0), 0);
    const totalGWP = list.reduce((s,o)=> s + (o.gwpTotal||0), 0);
    const totalsEl = document.getElementById('orderTotals');
    if (totalsEl) totalsEl.innerHTML = `Summering: <b>${totalM3.toFixed(2)} m³</b> • <b>${totalGWP.toFixed(0)} kg CO₂e</b>`;
    for (const o of list){
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${fmtDate(o.dateTime)}</td>
        <td>${o.customerName||''}</td>
        <td>${o.recipeName}</td>
        <td>${o.strength||''}</td>
        <td>${o.amount}</td>
        <td>${(o.vct??0).toFixed(3)}</td>
        <td>${(o.vctEq??0).toFixed(3)}</td>
        <td>${(o.gwpPerM3??0).toFixed(1)}</td>
        <td>${(o.gwpTotal??0).toFixed(1)}</td>
        <td>${o.orderContact||''}</td>
        <td>${o.orderInfo||''}</td>
        <td>
          <div class="toolbar">
            <button class="btn secondary" data-edit>Redigera</button>
            <button class="btn danger" data-del>Ta bort</button>
          </div>
        </td>`;
      tr.querySelector('[data-del]').addEventListener('click', async ()=>{ if(confirm('Ta bort beställningen?')){ const ok = await deleteOrderFromSupabase(o); if(!ok) return; ORDERS = ORDERS.filter(x=> x.id!==o.id); renderOrders(); renderDashboard(); }});
      tr.querySelector('[data-edit]').addEventListener('click', ()=> openEditDialog('order', o));
      tbody.appendChild(tr);
    }
    const btnApply = document.getElementById('btnApplyOrderFilters'); btnApply && (btnApply.onclick = renderOrders);
    const btnExp = document.getElementById('btnExportOrders'); btnExp && (btnExp.onclick = ()=> downloadJSON('orders.json', ORDERS||[]));
    const btnImp = document.getElementById('btnImportOrders'); const inpImp = document.getElementById('importOrdersFile');
    btnImp && (btnImp.onclick = ()=> inpImp.click());
    inpImp && inpImp.addEventListener('change', async (e)=> importJSON(e, async (arr)=>{ for (const o of (arr||[])){ await saveOrderToSupabase(o); } await loadCloudCoreData(); }));
    const btnExpPDF = document.getElementById('btnExportOrdersPDF'); btnExpPDF && (btnExpPDF.onclick = exportOrdersPDF);
    renderRecipeSelects(); renderCustomerSelects();
  }

  /* ********************* Dagbok ********************* */
  function renderDiaryInit(){
    const dateEl = document.getElementById('diaryDate');
    dateEl.value = dateEl.value || todayISO();
    renderDiaryFor(dateEl.value);
    dateEl.onchange = ()=> renderDiaryFor(dateEl.value);
    document.getElementById('btnAddImport').onclick = ()=> addImportRow();
    document.getElementById('btnSaveDiary').onclick = saveDiaryToday;
    document.getElementById('btnExportDiaryPDF').onclick = exportDiaryPDF;
  }
  function addImportRow(data={ material:'', amount:'', order:'' }){
    const wrap = document.getElementById('importsList');
    const row = document.createElement('div');
    row.className='imports-item';
    row.innerHTML = `
      <input placeholder="Material" value="${data.material||''}">
      <input type="number" step="0.01" placeholder="Mängd" value="${data.amount||''}">
      <input placeholder="Ordernr" value="${data.order||''}">
      <button class="btn danger" type="button">Ta bort</button>
    `;
    row.querySelector('button').onclick = ()=> row.remove();
    wrap.appendChild(row);
  }
  function renderDiaryFor(iso){
    const e = DIARY[iso];
    document.getElementById('diaryWeather').value = e?.weather||'';
    document.getElementById('diaryVctReq').value = e?.vctReq||'';
    document.getElementById('diaryVctMeas').value = e?.vctMeas||'';
    document.getElementById('diaryTempOut').value = e?.tOut??'';
    document.getElementById('diaryTempCure').value = e?.tCure??'';
    document.getElementById('diaryTempLab').value = e?.tLab??'';
    document.getElementById('diaryAirReqMin').value = e?.airReqMin??'';
    document.getElementById('diaryAirMeas').value = e?.airMeas??'';
    document.getElementById('diaryWaterDensity').value = e?.waterDensity??'';
    document.getElementById('diaryNote').value = e?.note||'';
    const list = document.getElementById('importsList'); list.innerHTML=''; (e?.imports||[]).forEach(addImportRow);
    document.getElementById('diaryPreview').innerHTML = e ? diaryPreviewHTML(e, iso) : '<div class="pill">Ingen dagbokspost sparad ännu.</div>';
  }
  function diaryPreviewHTML(e, iso){
    const imp = (e.imports||[]).map(i=> `<li>${escapeHtml(i.material)} – ${escapeHtml(String(i.amount))} (${escapeHtml(i.order)})</li>`).join('');
    return `<div><b>${fmtOnlyDate(iso)}</b> • ${escapeHtml(e.weather||'—')} • VCT ${escapeHtml(e.vctReq||'—')}/${escapeHtml(e.vctMeas||'—')} • Luft ${escapeHtml(e.airReqMin||'—')}/${escapeHtml(e.airMeas||'—')} • Vatten: ${escapeHtml(e.waterDensity||'—')} • Temp ute/härd/lab: ${escapeHtml(e.tOut??'—')}/${escapeHtml(e.tCure??'—')}/${escapeHtml(e.tLab??'—')} • Not: ${escapeHtml(e.note||'')}${imp? `<ul style="margin:.25rem 0 0 1rem">${imp}</ul>`:''}</div>`;
  }
  async function saveDiaryToday(){
    const iso = document.getElementById('diaryDate').value || todayISO();
    const imports = [...document.querySelectorAll('#importsList .imports-item')].map(r=>{
      const [materialEl, amountEl, orderEl] = r.querySelectorAll('input');
      return { material: materialEl.value.trim(), amount: parseFloat(amountEl.value||'')||'', order: orderEl.value.trim() };
    }).filter(x=> x.material || x.amount || x.order);
    const e = {
      ...(DIARY[iso] || {}),
      weather: (document.getElementById('diaryWeather').value||'').trim(),
      vctReq: (document.getElementById('diaryVctReq').value||'').trim(),
      vctMeas: (document.getElementById('diaryVctMeas').value||'').trim(),
      tOut: parseFloat(document.getElementById('diaryTempOut').value||''),
      tCure: parseFloat(document.getElementById('diaryTempCure').value||''),
      tLab: parseFloat(document.getElementById('diaryTempLab').value||''),
      airReqMin: parseFloat(document.getElementById('diaryAirReqMin').value||''),
      airMeas: parseFloat(document.getElementById('diaryAirMeas').value||''),
      waterDensity: parseFloat(document.getElementById('diaryWaterDensity').value||''),
      note: (document.getElementById('diaryNote').value||'').trim(),
      imports
    };

    const saved = await saveDiaryEntryToSupabase(iso, e);
    if (!saved) return;

    DIARY[iso] = saved;
    renderDiaryFor(iso);
    alert('Dagbok sparad i molnet.');
  }
  async function exportDiaryPDF(){
    const from = prompt('Från datum (YYYY-MM-DD):', todayISO());
    if (!from) return;
    const to = prompt('Till datum (YYYY-MM-DD):', todayISO());
    if (!to) return;
    const ok = await ensureFreshCloudDataForReport('dagboksrapport');
    if (!ok) return;
    const keys = Object.keys(DIARY).filter(d=> d>=from && d<=to).sort();
    const html = `<h1>Dagbok</h1>${reportMetaHTML(`Intervall: ${escapeHtml(from)}–${escapeHtml(to)}`)}` + (keys.map(k=> diaryReportHTML(k, DIARY[k])).join('') || '<p>Inga dagboksposter i valt intervall.</p>');
    openPrintWindow(`Dagbok ${from}–${to}`, html);
  }
  function diaryReportHTML(date, e){
    const impRows = (e.imports||[]).map(i=> `<tr><td>${escapeHtml(i.material)}</td><td class="right">${escapeHtml(String(i.amount))}</td><td>${escapeHtml(i.order)}</td></tr>`).join('') || '<tr><td colspan="3">—</td></tr>';
    return `
      <h2 style="margin:8px 0">${escapeHtml(date)}</h2>
      <table><tbody>
        <tr><th style="width:220px">Väder</th><td>${escapeHtml(e.weather||'')}</td></tr>
        <tr><th>Temps (ute / härd / lab)</th><td>${e.tOut??'—'} / ${e.tCure??'—'} / ${e.tLab??'—'} °C</td></tr>
        <tr><th>VCT krav / uppmätt</th><td>${escapeHtml(e.vctReq||'—')} / ${escapeHtml(e.vctMeas||'—')}</td></tr>
        <tr><th>Luft krav min / uppmätt</th><td>${e.airReqMin??'—'} / ${e.airMeas??'—'} %</td></tr>
        <tr><th>Vattendensitet</th><td>${e.waterDensity??'—'} kg/m³</td></tr>
        <tr><th>Notering</th><td>${escapeHtml(e.note||'')}</td></tr>
      </tbody></table>
      <div style="margin-top:6px"><b>Intransporter</b>
        <table><thead><tr><th>Material</th><th>Mängd</th><th>Ordernr</th></tr></thead><tbody>${impRows}</tbody></table>
      </div>`;
  }

  /************ Komplett export/import ************/
  function buildFullBackup(){
    return {
      app: "BTG Quality Control",
      version: 2,
      exportedAt: new Date().toISOString(),
      data: {
        recipes: RECIPES,
        batches: BATCHES,
        cubes: CUBES,
        air: AIR,
        materials: MATERIALS,
        controlDevices: CONTROL_DEVICES,
        orders: ORDERS,
        customers: CUSTOMERS,
        settings: SETTINGS,
        diary: DIARY,
        tasks: TASKS
      }
    };
  }
  function exportAllJSON(){
    const ts = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
    const backup = buildFullBackup();
    downloadJSON(`betongkontroll-backup-${ts}.json`, backup);
  }
  function importAllFromObject(obj){
    const d = obj?.data ? obj.data : obj;
    if (!d) { alert("Ogiltig fil."); return; }
    RECIPES = d.recipes || [];
    BATCHES = d.batches || [];
    CUBES = d.cubes || [];
    AIR = d.air || [];
    MATERIALS = d.materials || [];
    CONTROL_DEVICES = d.controlDevices || [];
    ORDERS = d.orders || [];
    CUSTOMERS = d.customers || [];
    SETTINGS = d.settings || { creator:"", defaultCureDays:28, groups:[{id:'g1',name:'Grupp 1 – Vanlig betong'},{id:'g2',name:'Grupp 2 – Luftbetong'}] };
    DIARY = d.diary || {};
    TASKS = d.tasks || { items:[] };

    save(DB_KEYS.recipes, RECIPES);
    save(DB_KEYS.batches, BATCHES);
    save(DB_KEYS.cubes, CUBES);
    save(DB_KEYS.air, AIR);
    save(DB_KEYS.materials, MATERIALS);
    save(DB_KEYS.controlDevices, CONTROL_DEVICES);
    save(DB_KEYS.orders, ORDERS);
    save(DB_KEYS.customers, CUSTOMERS);
    save(DB_KEYS.settings, SETTINGS);
    save(DB_KEYS.diary, DIARY);
    save(DB_KEYS.tasks, TASKS);

    applyBranding?.();
    renderRecipeSelects?.();
    renderDashboard?.();
    renderBatches?.();
    renderCubes?.();
    renderAir?.();
    renderCustomers?.();
    renderOrders?.();
    renderMaterials?.();
    renderControlDevices?.();
    renderTasks?.();
    renderDiaryInit?.();

    alert("Import klar! All lokal data ersattes av backupen.");
  }
  document.getElementById('btnExportAll')?.addEventListener('click', exportAllJSON);
  document.getElementById('btnImportAll')?.addEventListener('click', ()=>{
    if (!confirm("Detta ersätter all lokal data på denna enhet med innehållet i filen. Fortsätta?")) return;
    document.getElementById('importAllFile').click();
  });
  document.getElementById('importAllFile')?.addEventListener('change', (e)=>{
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      try { const obj = JSON.parse(reader.result); importAllFromObject(obj); }
      catch(err){ console.error(err); alert("Kunde inte importera filen."); }
    };
    reader.readAsText(file);
    e.target.value='';
  });

  /* ********************* Uppgifter ********************* */
  function renderTasks(){
    const cols = { daily: document.getElementById('tasks-daily'), weekly: document.getElementById('tasks-weekly'), monthly: document.getElementById('tasks-monthly')};
    Object.values(cols).forEach(el=> { if (el) el.innerHTML=''; });

    if (CLOUD_LOADING){
      Object.values(cols).forEach(el=> { if (el) el.innerHTML='<div class="pill warn">Laddar uppgifter från molnet…</div>'; });
      return;
    }
    if (!CURRENT_USER){
      Object.values(cols).forEach(el=> { if (el) el.innerHTML='<div class="pill warn">Logga in för att se uppgifter.</div>'; });
      return;
    }

    const items = TASKS.items || [];
    for (const key of Object.keys(cols)){
      if (cols[key] && !items.some(t=>t.freq===key)) cols[key].innerHTML = '<div class="pill">Inga uppgifter.</div>';
    }

    for (const t of items){
      const wrap = document.createElement('div');
      wrap.style.margin = '.35rem 0';
      const checked = isTaskDoneForCurrentPeriod(t);
      wrap.innerHTML = `
        <div style="display:flex; align-items:center; gap:.5rem; border-bottom:1px solid var(--border); padding:.3rem 0;">
          <input type="checkbox" ${checked?'checked':''} data-task="${t.id}">
          <span style="flex:1">${escapeHtml(t.title)}</span>
          <small class="pill">${t.freq==='daily'?'Dag':t.freq==='weekly'?'Vecka':'Månad'}</small>
          <button class="btn secondary" data-edit-task style="padding:.25rem .45rem">Redigera</button>
          <button class="btn danger" data-delete-task style="padding:.25rem .45rem">Ta bort</button>
        </div>`;
      wrap.querySelector('input').addEventListener('change', async (e)=>{
        if (e.target.checked){
          openEditDialog('task-check', { id:t.id, cloudId:t.cloudId, title:t.title, defaultDate: todayISO() });
        } else {
          await undoTaskForCurrentPeriod(t.id);
          renderTasks();
        }
      });
      wrap.querySelector('[data-edit-task]')?.addEventListener('click', ()=> openEditDialog('task', t));
      wrap.querySelector('[data-delete-task]')?.addEventListener('click', async ()=>{
        if (!confirm('Ta bort uppgiften?')) return;
        const ok = await deleteTaskFromSupabase(t);
        if (!ok) return;
        TASKS.items = (TASKS.items||[]).filter(x=>x.id!==t.id);
        renderTasks();
        renderDashboard();
      });
      cols[t.freq]?.appendChild(wrap);
    }
  }
  document.getElementById('btnAddTask')?.addEventListener('click', ()=> openEditDialog('task', { id:null, title:'', freq:'daily', log:[] }));
  document.getElementById('btnExportTasksPDF')?.addEventListener('click', async ()=>{ const ok = await ensureFreshCloudDataForReport('uppgifter'); if (!ok) return; openPrintWindow('Uppgifter', tasksReportHTML()); });

  function isTaskDoneForCurrentPeriod(t){
    const d = todayISO();
    if (!t.log||!t.log.length) return false;
    if (t.freq==='daily') return t.log.some(x=> x.date===d);
    if (t.freq==='weekly') return t.log.some(x=> sameISOWeek(x.date, d));
    return t.log.some(x=> x.date.slice(0,7)===d.slice(0,7));
  }
  async function markTaskDone(id, dateISO){
    const existing = (TASKS.items||[]).find(t=>t.id===id);
    if (!existing) return;
    const updated = { ...existing, log:[...(existing.log||[]), {date:dateISO}] };
    const cloudObj = await saveTaskToSupabase(updated);
    if (!cloudObj) return;
    TASKS.items = (TASKS.items||[]).map(t=> t.id===id ? cloudObj : t);
    renderTasks();
  }
  async function undoTaskForCurrentPeriod(id){
    const d = todayISO();
    const existing = (TASKS.items||[]).find(t=>t.id===id);
    if (!existing) return;
    const keep = (existing.log||[]).filter(x=>{
      if (existing.freq==='daily') return x.date!==d;
      if (existing.freq==='weekly') return !sameISOWeek(x.date, d);
      return x.date.slice(0,7)!==d.slice(0,7);
    });
    const cloudObj = await saveTaskToSupabase({...existing, log: keep});
    if (!cloudObj) return;
    TASKS.items = (TASKS.items||[]).map(t=> t.id===id ? cloudObj : t);
  }
  function sameISOWeek(a,b){
    const A=new Date(a), B=new Date(b);
    const w=(d)=>{const t=new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day=t.getUTCDay()||7; t.setUTCDate(t.getUTCDate()+4-day); const yStart=new Date(Date.UTC(t.getUTCFullYear(),0,1)); const week = Math.ceil((((t - yStart) / 86400000) + 1) / 7); return `${t.getUTCFullYear()}-w${week}`; };
    return w(A)===w(B);
  }

  function tasksReportHTML(){
    const items = TASKS.items||[];
    const sec = (title, list)=>`
      <h2 style="margin:8px 0">${escapeHtml(title)}</h2>
      <table>
        <thead><tr><th>Uppgift</th><th>Senast utförd</th></tr></thead>
        <tbody>
          ${list.map(t=>{
            const last = (t.log||[]).slice().sort((a,b)=> b.date.localeCompare(a.date))[0]?.date || '—';
            return `<tr><td>${escapeHtml(t.title)}</td><td>${escapeHtml(last)}</td></tr>`;
          }).join('') || '<tr><td colspan="2">—</td></tr>'}
        </tbody>
      </table>`;
    const daily = items.filter(x=>x.freq==='daily');
    const weekly= items.filter(x=>x.freq==='weekly');
    const monthly=items.filter(x=>x.freq==='monthly');
    return `<h1>Uppgifter</h1>${reportMetaHTML?.() || ''}${sec('Dagliga',daily)}${sec('Veckovisa',weekly)}${sec('Månatliga',monthly)}`;
  }

    /*********************** Redigeringsdialog (generisk) ************************/
    const editDialog = document.getElementById('editDialog');
    const editBody = document.getElementById('editDialogBody');
    let editCtx = { type:null, data:null };

    function openEditDialog(type, data){
      editCtx = { type, data: JSON.parse(JSON.stringify(data||{})) };
      document.getElementById('editDialogTitle').textContent = ({
        'batch':'Redigera sats',
        'cube':'Redigera provkub',
        'air':'Redigera luftprov',
        'material':'Redigera material',
        'instrument':'Redigera instrument',
        'order':'Redigera beställning',
        'customer':'Redigera kund',
        'task':'Ny / redigera uppgift',
        'task-check':'Markera utförd'
      })[type] || 'Redigera';

      const d = editCtx.data;
      let html = '';
      if (type==='material'){
        html = `
          <div class="grid grid-3">
            <div><label>Namn</label><input id="f-name" value="${d.name||''}"></div>
            <div><label>Typ</label>
              <select id="f-type">
                <option ${d.type==='Cement'?'selected':''}>Cement</option>
                <option ${d.type==='Vatten'?'selected':''}>Vatten</option>
                <option ${d.type==='GGBS/Slagg'?'selected':''}>GGBS/Slagg</option>
                <option ${d.type==='Flygaska'?'selected':''}>Flygaska</option>
                <option ${d.type==='Silika'?'selected':''}>Silika</option>
                <option ${d.type==='Tillsatsmedel'?'selected':''}>Tillsatsmedel</option>
                <option ${d.type==='Ballast'?'selected':''}>Ballast</option>
              </select>
            </div>
            <div><label>EF (kgCO₂e/kg)</label><input id="f-ef" type="number" step="0.0001" value="${d.ef??''}"></div>
          </div>
          <div><label>Notis</label><input id="f-note" value="${d.note||''}"></div>
        `;
      } else if (type==='instrument'){
        html = `
          <div class="grid grid-3">
            <div><label>Typ</label>
              <select id="f-type">
                <option value="air" ${d.type==='air'?'selected':''}>Lufthaltsmätare</option>
                <option value="thermo" ${d.type==='thermo'?'selected':''}>Termometer</option>
              </select>
            </div>
            <div><label>Namn</label><input id="f-name" value="${d.name||''}"></div>
            <div><label>Serienummer</label><input id="f-serial" value="${d.serial||''}"></div>
          </div>
        `;
      } else if (type==='batch'){
        html = `
          <div class="grid grid-3">
            <div><label>Receptnamn</label><input id="f-recipeName" value="${d.recipeName||''}"></div>
            <div><label>Mängd (m³)</label><input id="f-amount" type="number" step="0.01" value="${d.amount??''}"></div>
            <div><label>Datum & tid</label><input id="f-dt" type="datetime-local" value="${(d.dateTime||'').slice(0,16)}"></div>
          </div>
          <div class="grid grid-3">
            <div><label>VCT</label><input id="f-vct" type="number" step="0.001" value="${d.vct??''}"></div>
            <div><label>VCT ekv</label><input id="f-vctEq" type="number" step="0.001" value="${d.vctEq??''}"></div>
          </div>
        `;
      } else if (type==='cube'){
        html = `
          <div class="grid grid-3">
            <div><label>Receptnamn</label><input id="f-recipeName" value="${d.recipeName||''}"></div>
            <div><label>Gjutdatum</label><input id="f-cast" type="date" value="${d.castDate||''}"></div>
            <div><label>Sparas (dagar)</label><input id="f-cure" type="number" min="1" value="${d.cureDays??''}"></div>
          </div>
          <div class="grid grid-3">
            <div><label>Vikt (kg)</label><input id="f-weight" type="number" step="0.01" value="${d.weight??''}"></div>
            <div><label>MPa</label><input id="f-mpa" type="number" step="0.1" value="${d.resultMPA??d.resultMPa??''}"></div>
            <div><label>Sats-ID</label><input id="f-batchId" value="${d.batchId||''}"></div>
          </div>
          <div class="grid grid-3">
            <div><label>Vct krav</label><input id="f-vctReq" type="number" step="0.001" value="${d.vctReq??''}"></div>
            <div><label>Vct ekv krav</label><input id="f-vctEqReq" type="number" step="0.001" value="${d.vctEqReq??''}"></div>
            <div><label>Luft krav (%)</label><input id="f-airReq" type="number" step="0.1" value="${d.airReq??''}"></div>
          </div>
          <div class="grid grid-3">
            <div><label>Vct uppmätt</label><input id="f-vct" type="number" step="0.001" value="${d.vct??''}"></div>
            <div><label>Vct ekv uppmätt</label><input id="f-vctEq" type="number" step="0.001" value="${d.vctEq??''}"></div>
            <div><label>Luft uppmätt (%)</label><input id="f-air" type="number" step="0.1" value="${d.air??''}"></div>
          </div>
          <div class="grid grid-3">
            <div><label>Betongtemp (°C)</label><input id="f-temp" type="number" step="0.1" value="${d.temp??''}"></div>
            <div><label>Konsistensmätare (Kw)</label><input id="f-kw" type="number" step="0.1" value="${d.kw??''}"></div>
            <div></div>
          </div>
          <div><label>Övrig info</label><input id="f-extra" value="${d.extra||''}"></div>
          <div class="row"><label style="display:flex;align-items:center;gap:.5rem"><input id="f-exclude" type="checkbox" /> <span>Exkludera från utvärdering</span></label></div>
        `;
      } else if (type==='air'){
        html = `
          <div class="grid grid-3">
            <div><label>Receptnamn</label><input id="f-recipeName" value="${d.recipeName||''}"></div>
            <div><label>Datum</label><input id="f-date" type="date" value="${d.date||''}"></div>
            <div><label>Lufthalt (%)</label><input id="f-pct" type="number" step="0.1" value="${d.pct??''}"></div>
          </div>
          <div><label>Kommentar</label><input id="f-note" value="${d.note||''}"></div>
        `;
      } else if (type==='order'){
        html = `
          <div class="grid grid-3">
            <div><label>Kund</label><input id="f-customer" value="${d.customerName||''}"></div>
            <div><label>Recept</label><input id="f-recipeName" value="${d.recipeName||''}"></div>
            <div><label>Datum & tid</label><input id="f-dt" type="datetime-local" value="${(d.dateTime||'').slice(0,16)}"></div>
          </div>
          <div class="grid grid-3">
            <div><label>Mängd (m³)</label><input id="f-amount" type="number" step="0.01" value="${d.amount??''}"></div>
            <div><label>Kontaktperson</label><input id="f-contact" value="${d.orderContact||''}"></div>
            <div><label>Övrigt</label><input id="f-info" value="${d.orderInfo||''}"></div>
          </div>
        `;
      } else if (type==='customer'){
        html = `
          <div class="grid grid-3">
            <div><label>Namn</label><input id="f-name" value="${d.name||''}"></div>
            <div><label>Kontaktperson</label><input id="f-contact" value="${d.contactPerson||''}"></div>
            <div><label>Info</label><input id="f-info" value="${d.info||''}"></div>
          </div>
        `;
      } else if (type==='task'){
        html = `
          <div class="grid grid-3">
            <div><label>Titel</label><input id="f-title" value="${d.title||''}"></div>
            <div><label>Frekvens</label>
              <select id="f-freq">
                <option value="daily" ${d.freq==='daily'?'selected':''}>Daglig</option>
                <option value="weekly" ${d.freq==='weekly'?'selected':''}>Veckovis</option>
                <option value="monthly" ${d.freq==='monthly'?'selected':''}>Månatlig</option>
              </select>
            </div>
          </div>
        `;
      } else if (type==='task-check'){
        html = `
          <div class="grid grid-3">
            <div><label>Uppgift</label><input disabled value="${d.title||''}"></div>
            <div><label>Datum utfört</label><input id="f-date" type="date" value="${d.defaultDate||todayISO()}"></div>
          </div>
        `;
      } else {
        html = '<div>—</div>';
      }
      editBody.innerHTML = html;
      if (type==='cube'){ const ex = document.getElementById('f-exclude'); if (ex) ex.checked = !!d.excludeFromEval; }
      editDialog.showModal();
    }

    document.getElementById('btnSaveEdit')?.addEventListener('click', async (e)=>{
      e.preventDefault();
      const {type, data} = editCtx;
      if (!type) { editDialog.close(); return; }

      if (type==='material'){
        /***************************************************
         * MATERIAL → LOCALSTORAGE + SUPABASE
         *
         * Material används bland annat för GWP/CO₂-beräkning.
         * Därför migrerar vi material innan satser och order.
         ***************************************************/
        let obj = {
          id: data.id || uuid(),
          cloudId: data.cloudId || null,
          name: (document.getElementById('f-name').value||'').trim(),
          type: document.getElementById('f-type').value,
          ef: parseFloat(document.getElementById('f-ef').value||'')||0,
          note: (document.getElementById('f-note').value||'').trim()
        };

        if (!obj.name) {
          alert('Ange namn på material.');
          return;
        }

        const cloudObj = await saveMaterialToSupabase(obj);
        if (!cloudObj) return;
        obj = cloudObj;

        if (data.id){
          MATERIALS = MATERIALS.map(x=> x.id===data.id? obj: x);
        } else {
          MATERIALS.push(obj);
        }

        renderMaterials();
        syncMaterialNamesDatalist();
      }

      if (type==='instrument'){
        let obj = {
          ...data,
          id: data.id || uuid(),
          type: document.getElementById('f-type').value,
          name: (document.getElementById('f-name').value||'').trim(),
          serial: (document.getElementById('f-serial').value||'').trim(),
          checks: data.checks || {}
        };
        const cloudObj = await saveControlDeviceToSupabase(obj);
        if (!cloudObj) return;
        if (data.id){ CONTROL_DEVICES = CONTROL_DEVICES.map(x=> x.id===data.id? cloudObj: x); } else { CONTROL_DEVICES.push(cloudObj); }
        renderControlDevices(); renderDashboard();
      }

      if (type==='batch'){
        const obj = {
          ...data,
          recipeName: (document.getElementById('f-recipeName').value||'').trim(),
          amount: parseFloat(document.getElementById('f-amount').value||'')||0,
          dateTime: new Date(document.getElementById('f-dt').value||data.dateTime||Date.now()).toISOString(),
          vct: parseFloat(document.getElementById('f-vct').value||'')||null,
          vctEq: parseFloat(document.getElementById('f-vctEq').value||'')||null
        };
        const cloudObj = await saveBatchToSupabase(obj);
        if (!cloudObj) return;
        BATCHES = BATCHES.map(x=> x.id===data.id? cloudObj: x);
        renderBatches(); renderDashboard();
      }

      if (type==='cube'){
        /***************************************************
         * PROVKUB → SUPABASE UPDATE
         *
         * Viktigt: när kuben pressas efter t.ex. 28 dagar
         * och MPa/vikt fylls i via Redigera måste raden
         * uppdateras i Supabase, inte bara i UI:t.
         ***************************************************/
        const cast = document.getElementById('f-cast').value||data.castDate||todayISO();
        const cure = parseInt(document.getElementById('f-cure').value||data.cureDays||28);
        const due = new Date(cast); due.setDate(due.getDate()+cure);

        const parseNullable = (id) => {
          const raw = document.getElementById(id)?.value;
          if (raw === '' || raw == null) return null;
          const n = parseFloat(raw);
          return Number.isFinite(n) ? n : null;
        };

        const obj = {
          ...data,
          // Säkerställ att redigerade gamla/molnladdade kuber har cloudId.
          cloudId: data.cloudId || data.id,
          recipeName: (document.getElementById('f-recipeName').value||'').trim(),
          castDate: cast,
          cureDays: cure,
          dueDate: due.toISOString().slice(0,10),
          weight: parseNullable('f-weight'),
          resultMPa: parseNullable('f-mpa'),
          batchId: (document.getElementById('f-batchId').value||'').trim(),
          extra: (document.getElementById('f-extra').value||'').trim(),
          excludeFromEval: document.getElementById('f-exclude')?.checked || false,
          vctReq: parseNullable('f-vctReq'),
          vctEqReq: parseNullable('f-vctEqReq'),
          airReq: parseNullable('f-airReq'),
          vct: parseNullable('f-vct'),
          vctEq: parseNullable('f-vctEq'),
          air: parseNullable('f-air'),
          temp: parseNullable('f-temp'),
          kw: parseNullable('f-kw')
        };

        const cloudObj = await saveCubeToSupabase(obj);
        if (!cloudObj) return;

        // Uppdatera lokalt direkt...
        CUBES = CUBES.map(x=> (x.id===data.id || x.cloudId===obj.cloudId) ? cloudObj: x);
        renderCubes();
        renderDashboard();

        // ...och ladda sedan om från Supabase så vi verifierar att molnet är källan.
        await loadCloudCoreData();
      }

      if (type==='air'){
        const obj = {
          ...data,
          recipeName: (document.getElementById('f-recipeName').value||'').trim(),
          date: document.getElementById('f-date').value||data.date||todayISO(),
          pct: parseFloat(document.getElementById('f-pct').value||'')||0,
          note: (document.getElementById('f-note').value||'').trim()
        };
        const cloudObj = await saveAirToSupabase(obj);
        if (!cloudObj) return;
        AIR = AIR.map(x=> x.id===data.id? cloudObj: x);
        renderAir();
      }

      if (type==='order'){
        let obj = {
          ...data,
          cloudId: data.cloudId || data.id,
          customerName: (document.getElementById('f-customer').value||'').trim(),
          recipeName: (document.getElementById('f-recipeName').value||'').trim(),
          dateTime: new Date(document.getElementById('f-dt').value||data.dateTime||Date.now()).toISOString(),
          amount: parseFloat(document.getElementById('f-amount').value||'')||0,
          orderContact: (document.getElementById('f-contact').value||'').trim(),
          orderInfo: (document.getElementById('f-info').value||'').trim()
        };
        const perM3 = Number(obj.gwpPerM3) || 0;
        obj.gwpTotal = perM3 * (parseFloat(obj.amount)||0);
        const cloudObj = await saveOrderToSupabase(obj);
        if (!cloudObj) return;
        ORDERS = ORDERS.map(x=> (x.id===data.id || x.cloudId===obj.cloudId) ? cloudObj: x);
        renderOrders(); renderDashboard();
        await loadCloudCoreData();
      }

      if (type==='customer'){
        let obj = {
          id: data.id || uuid(),
          cloudId: data.cloudId || null,
          name: (document.getElementById('f-name').value||'').trim(),
          contactPerson: (document.getElementById('f-contact').value||'').trim(),
          info: (document.getElementById('f-info').value||'').trim()
        };
        if (!obj.name){ alert('Ange kundnamn.'); return; }
        const cloudObj = await saveCustomerToSupabase(obj);
        if (!cloudObj) return;
        if (data.id){ CUSTOMERS = CUSTOMERS.map(x=> x.id===data.id? cloudObj: x); } else { CUSTOMERS.push(cloudObj); }
        renderCustomers(); renderCustomerSelects(); renderOrders();
      }

      if (type==='task'){
        const obj = {
          id: data.id || null,
          cloudId: data.cloudId || null,
          title: (document.getElementById('f-title').value||'').trim(),
          freq: document.getElementById('f-freq').value,
          log: data.log||[]
        };
        if (!obj.title){ alert('Ange titel på uppgiften.'); return; }
        const cloudObj = await saveTaskToSupabase(obj);
        if (!cloudObj) return;
        if (data.id){ TASKS.items = (TASKS.items||[]).map(x=> x.id===data.id? cloudObj: x); } else { (TASKS.items||=[]).push(cloudObj); }
        renderTasks(); renderDashboard();
      }

      if (type==='task-check'){
        const dateISO = document.getElementById('f-date').value || todayISO();
        await markTaskDone(data.id, dateISO);
      }

      editDialog.close();
    });

    /*********************** Dashboard ************************/
    function renderDashboard(){
      applyBranding();
      updateCloudDashboardMeta?.();
      renderLatestBatches();
      renderControlDash();
      renderCubesDash();
      renderTasks();
      setupOverviewFilters();
      renderOverviewSummary();
    }

    function renderLatestBatches(){
      const box = document.getElementById('latestBatches');
      if(!box) return;
      const list = (BATCHES||[]).slice(0,6);
      if (CLOUD_LOADING){ box.innerHTML = '<div class="pill warn">Laddar senaste satser från molnet…</div>'; return; }
      if (!CURRENT_USER){ box.innerHTML = '<div class="pill warn">Logga in för att se molndata.</div>'; return; }
      if (!list.length){ box.innerHTML = '<div class="pill">Inga satser ännu.</div>'; return; }
      box.innerHTML = '<ul>'+list.map(b=> `<li>${fmtDate(b.dateTime)} • ${escapeHtml(b.recipeName)} • ${b.amount} m³ • GWP: ${(b.gwpTotal||0).toFixed(0)} kg</li>`).join('')+'</ul>';
    }

    function renderControlDash(){
      const span = document.getElementById('controlDashMonth');
      const body = document.getElementById('controlDashBody');
      if(!span || !body) return;
      const now = new Date(); const y=now.getFullYear(), m=now.getMonth()+1;
      span.innerHTML = `${MONTHS_SE[m-1]} ${y}`;
      const rows = (CONTROL_DEVICES||[]).map(d=>{
        const r = d.checks?.[y]?.[m];
        let status = '<span class="pill warn">Ej utförd</span>';
        if (d.type==='air' && r && typeof r.actual==='number' && typeof r.target==='number'){
          status = Math.abs(r.actual-r.target)<=0.1 ? '<span class="pill ok">OK</span>' : '<span class="pill danger">Ej godkänd</span>';
        }
        if (d.type==='thermo' && r && typeof r.t1==='number' && typeof r.t2==='number'){
          status = Math.abs(r.t1-r.t2)<=1 ? '<span class="pill ok">OK</span>' : '<span class="pill danger">Ej godkänd</span>';
        }
        const typeTxt = d.type==='air'?'Luft':'Termo';
        return `<tr><td>${escapeHtml(d.name)} <small class="dev-type pill">${typeTxt}</small></td><td>${r?.date?escapeHtml(r.date):'—'}</td><td>${status}</td></tr>`;
      }).join('');
      body.innerHTML = `<table><thead><tr><th>Instrument</th><th>Datum</th><th>Status</th></tr></thead><tbody>${rows||'<tr><td colspan="3">—</td></tr>'}</tbody></table>`;
    }

    function renderCubesDash(){
      const span = document.getElementById('cubesDashWeek');
      const body = document.getElementById('cubesDashBody');
      if(!span || !body) return;
      const today = new Date();
      span.innerHTML = `Vecka ${new Intl.DateTimeFormat('sv-SE',{week:'numeric'}).format(today)}`;
      const dISO = todayISO();
      const batchesThisWeek = (BATCHES||[]).filter(b=>{
        const bDate = (b.dateTime||'').slice(0,10);
        return bDate && sameISOWeek(bDate, dISO);
      });
      const byStrength = {};
      for (const b of batchesThisWeek){
        const s = b.strength || '—';
        if (!byStrength[s]) byStrength[s] = { count:0, m3:0 };
        byStrength[s].count += 1;
        byStrength[s].m3 += parseFloat(b.amount)||0;
      }
      const rows = Object.entries(byStrength).map(([strength, info])=>{
        const hasCube = (CUBES||[]).some(c=>{
          const s = c.strengthClass || '';
          return s === strength && c.castDate && sameISOWeek(c.castDate, dISO);
        });
        const status = hasCube ? '<span class="pill ok">OK</span>' : '<span class="pill danger">Kub saknas</span>';
        return `<tr>
          <td>${escapeHtml(strength)}</td>
          <td>${info.count} satser • ${info.m3.toFixed(2)} m³</td>
          <td>${status}</td>
        </tr>`;
      }).join('');
      body.innerHTML = `
        <table>
          <thead>
            <tr><th>Hållfasthet</th><th>Aktivitet (denna vecka)</th><th>Kubstatus</th></tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="3">—</td></tr>'}</tbody>
        </table>`;
    }

    function setupOverviewFilters(){
      const apply = document.getElementById('dashApply');
      apply && (apply.onclick = renderOverviewSummary);
      const to = document.getElementById('dashDateTo'), from = document.getElementById('dashDateFrom');
      if (to && !to.value) to.value = todayISO();
      if (from && !from.value){ const d=new Date(); d.setDate(d.getDate()-30); from.value = d.toISOString().slice(0,10); }
      renderRecipeSelects();
    }

    function renderOverviewSummary(){
      const s = document.getElementById('dashStrengthFilter').value;
      const from = document.getElementById('dashDateFrom').value;
      const to = document.getElementById('dashDateTo').value;
      const list = (BATCHES||[]).filter(b=> (!s || b.strength===s) && (!from || b.dateTime.slice(0,10)>=from) && (!to || b.dateTime.slice(0,10)<=to));
      const m3 = list.reduce((a,b)=> a+(parseFloat(b.amount)||0),0);
      const gwp = list.reduce((a,b)=> a+(b.gwpTotal||0),0);
      const per = m3>0? (gwp/m3):0;
      const html = `
        <div class="kpi">
          <div>📦</div><div><div style="font-weight:700">Mängd</div><small class="muted">${list.length} satser</small></div><div class="pill" style="margin-left:auto">${m3.toFixed(2)} m³</div>
        </div>
        <div class="kpi">
          <div>🌍</div><div><div style="font-weight:700">GWP totalt</div><small class="muted">Summerat över satser</small></div><div class="pill" style="margin-left:auto">${gwp.toFixed(0)} kg CO₂e</div>
        </div>
        <div class="kpi">
          <div>⚖️</div><div><div style="font-weight:700">GWP / m³</div><small class="muted">Viktat snitt</small></div><div class="pill" style="margin-left:auto">${per.toFixed(1)} kg CO₂e/m³</div>
        </div>`;
      document.getElementById('dashSummary').innerHTML = `<div class="grid grid-3">${html}</div>`;
    }

    /*********************** Utvärdering ************************/
    function fillEvalGroupSelect(){
      const sel = document.getElementById('evalGroup');
      if (!sel) return;
      const items = [{id:'', name:'Alla grupper'}].concat(SETTINGS.groups||[]);
      sel.innerHTML = items.map(g=>`<option value="${g.id}">${g.name || 'Alla grupper'}</option>`).join('');
    }

    function recipeGroupIdByRecipeId(recipeId){
      const r = RECIPES.find(x=>x.id===recipeId);
      return r?.groupId || null;
    }

    /***********************************************************
     * v7: EN206 / UTVÄRDERING
     *
     * CUBES och RECIPES är nu molnladdade från Supabase via
     * loadCloudCoreData(). Den här funktionen filtrerar därför
     * live-data för statistik, glidande 15 och kravfliken.
     ***********************************************************/
    function cubesForEvaluation({from=null, to=null, strengthClass='', groupId='', ageDays=null}){
      const inRange = (d)=> (!from || d>=from) && (!to || d<=to);
      return (CUBES||[])
        .filter(c=> !c.excludeFromEval)
        .filter(c=> c.resultMPa!=null && !isNaN(c.resultMPa))
        .filter(c=> (!strengthClass || (c.strengthClass||'')===strengthClass))
        .filter(c=> inRange(c.castDate))
        .filter(c=> (!groupId || recipeGroupIdByRecipeId(c.recipeId)===groupId))
        .filter(c=> (ageDays==null || parseInt(c.cureDays||0)===parseInt(ageDays)))
        .sort((a,b)=> (a.castDate<b.castDate? -1 : a.castDate>b.castDate? 1 : 0));
    }

    function initEvaluationTab(){
      const to = document.getElementById('evalTo'); const from = document.getElementById('evalFrom');
      if (to && !to.value) to.value = todayISO();
      if (from && !from.value){ const d=new Date(); d.setMonth(d.getMonth()-6); from.value = d.toISOString().slice(0,10); }
      renderRecipeSelects();
      document.querySelectorAll('#tab-utvardering .subtabs .tab').forEach(t=>{
        t.onclick = ()=>{
          document.querySelectorAll('#tab-utvardering .subtabs .tab').forEach(x=> x.removeAttribute('aria-current'));
          t.setAttribute('aria-current','page');
          runEvaluation();
        };
      });
      document.getElementById('btnEvalApply').onclick = runEvaluation;
      document.getElementById('btnEvalExportPDF').onclick = exportEvaluationPDF;
      document.getElementById('btnEvalExportJSON').onclick = exportEvaluationJSON;
      runEvaluation();
    }

    function runEvaluation(){
      const from = document.getElementById('evalFrom').value || null;
      const to = document.getElementById('evalTo').value || null;
      const strength = document.getElementById('evalStrength').value || '';
      const groupId = document.getElementById('evalGroup').value || '';
      const ageDaysRaw = document.getElementById('evalAgeDays').value;
      const ageDays = ageDaysRaw===''? null : parseInt(ageDaysRaw);
      const cubes = cubesForEvaluation({from,to,strengthClass:strength,groupId,ageDays});

      const active = document.querySelector('#tab-utvardering .subtabs .tab[aria-current="page"]')?.dataset.subtab || 'stat';
      const body = document.getElementById('evalBody');

      if (active==='krav') { renderEvalKrav(); return; }

      if (active==='stat'){
        const vals = cubes.map(c=> c.resultMPa);
        const s = stats(vals);
        body.innerHTML = buildEvalStatsHTML(cubes, s);
      } else {
        body.innerHTML = buildEvalEN206HTML(cubes);
      }
    }

    function buildEvalStatsHTML(cubes, s){
      const header = `<div class="grid grid-3">
        <div class="kpi"><div>🔢</div><div><div style="font-weight:700">Antal kuber</div><small class="muted">I urvalet</small></div><div class="pill" style="margin-left:auto">${s.n}</div></div>
        <div class="kpi"><div>📈</div><div><div style="font-weight:700">Medelvärde</div><small class="muted">MPa</small></div><div class="pill" style="margin-left:auto">${s.mean!=null? s.mean.toFixed(2):'—'}</div></div>
        <div class="kpi"><div>σ</div><div><div style="font-weight:700">Standardavvikelse</div><small class="muted">Stickprov</small></div><div class="pill" style="margin-left:auto">${s.sd!=null? s.sd.toFixed(2):'—'}</div></div>
      </div>`;
      const rows = cubes.map(c=> `<tr><td>${fmtOnlyDate(c.castDate)}</td><td>${escapeHtml(c.recipeName)}</td><td>${escapeHtml(c.strengthClass||'')}</td><td class="right">${c.cureDays}</td><td class="right">${c.resultMPa}</td></tr>`).join('') || '<tr><td colspan="5">—</td></tr>';
      return `${header}
      <div style="margin-top:.6rem">
        <table>
          <thead><tr><th>Gjutdatum</th><th>Recept</th><th>Hållfasthet</th><th>Ålder (d)</th><th class="right">MPa</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    }

    function buildEvalEN206HTML(cubes){
      const note = `<div class="pill">Glidande 15: beräkningar på kronologiskt sorterade prov. Visa medelvärde och min per fönster.</div>`;
      const wins = rollingWindows(cubes, 15);
      if (!wins.length) return note + '<div class="pill" style="margin-top:.5rem">Färre än 15 kuber i urvalet.</div>';
      const rows = wins.map((win, i)=>{
        const vals = win.map(c=> c.resultMPa);
        const s = stats(vals);
        const span = `${fmtOnlyDate(win[0].castDate)} – ${fmtOnlyDate(win[win.length-1].castDate)}`;
        return `<tr><td>${i+1}</td><td>${span}</td><td class="right">${s.mean.toFixed(2)}</td><td class="right">${s.min.toFixed(2)}</td><td class="right">${s.sd.toFixed(2)}</td></tr>`;
      }).join('');
      return `${note}
      <div style="margin-top:.6rem">
        <table>
          <thead><tr><th>#</th><th>Period</th><th class="right">Medel</th><th class="right">Min</th><th class="right">σ</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    }

    function renderEvalKrav(){
      const body = document.getElementById('evalBody');
      const info = `<div class="pill">Kravuppfyllnad: jämför Vct/Vct ekv/Luft mot eventuella krav (från recept eller inskrivna i kubpost). Markera grön/röd per prov.</div>`;
      const rows = (CUBES||[]).map(c=>{
        const vctOk   = isFinite(c.vct)    && isFinite(c.vctReq)    ? (c.vct <= c.vctReq) : '';
        const eqOk    = isFinite(c.vctEq)  && isFinite(c.vctEqReq)  ? (c.vctEq <= c.vctEqReq) : '';
        const airOk   = isFinite(c.air)    && isFinite(c.airReq)    ? (c.air >= c.airReq) : '';
        const pill = ok => ok===''? '<span class="pill">—</span>' : ok? '<span class="pill ok">OK</span>' : '<span class="pill danger">Ej</span>';
        return `<tr>
          <td>${fmtOnlyDate(c.castDate)}</td>
          <td>${escapeHtml(c.recipeName)}</td>
          <td>${escapeHtml(c.strengthClass||'')}</td>
          <td class="right">${isFinite(c.vct)? Number(c.vct).toFixed(3):''}${isFinite(c.vctReq)?' / '+Number(c.vctReq).toFixed(3):''}</td>
          <td>${pill(vctOk)}</td>
          <td class="right">${isFinite(c.vctEq)? Number(c.vctEq).toFixed(3):''}${isFinite(c.vctEqReq)?' / '+Number(c.vctEqReq).toFixed(3):''}</td>
          <td>${pill(eqOk)}</td>
          <td class="right">${isFinite(c.air)? Number(c.air).toFixed(1):''}${isFinite(c.airReq)?' / '+Number(c.airReq).toFixed(1):''}</td>
          <td>${pill(airOk)}</td>
        </tr>`;
      }).join('') || '<tr><td colspan="9">—</td></tr>';
      body.innerHTML = `${info}<div style="margin-top:.5rem"><table>
        <thead><tr>
          <th>Gjutdatum</th><th>Recept</th><th>Hållfasthet</th>
          <th>Vct m/krav</th><th></th><th>Vct ekv m/krav</th><th></th><th>Luft m/krav</th><th></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;
    }

    async function exportEvaluationPDF(){
      const ok = await ensureFreshCloudDataForReport('utvärdering');
      if (!ok) return;
      runEvaluation?.();
      const html = `<h1>Utvärdering</h1>${reportMetaHTML()}` + document.getElementById('evalBody').innerHTML;
      openPrintWindow('Utvärdering', html);
    }
    function exportEvaluationJSON(){
      const from = document.getElementById('evalFrom').value || null;
      const to = document.getElementById('evalTo').value || null;
      const strength = document.getElementById('evalStrength').value || '';
      const groupId = document.getElementById('evalGroup').value || '';
      const ageDaysRaw = document.getElementById('evalAgeDays').value;
      const ageDays = ageDaysRaw===''? null : parseInt(ageDaysRaw);
      const cubes = cubesForEvaluation({from,to,strengthClass:strength,groupId,ageDays});
      downloadJSON('utvardering.json', { filters:{from,to,strength,groupId,ageDays}, cubes });
    }


    /*********************** v11: PDF/Nordcert från molndata ************************/
    async function ensureFreshCloudDataForReport(reportName='rapport'){
      if (!SUPABASE_READY || !sb) return true;
      if (!CURRENT_USER){
        alert('Logga in först för att skapa ' + reportName + ' från molndata.');
        openAuthDialog?.();
        return false;
      }
      try {
        setCloudStatus?.('warn', 'Uppdaterar molndata inför ' + reportName + '…');
        await loadCloudCoreData();
        setCloudStatus?.('ok', 'Molndata uppdaterad inför ' + reportName + '.');
        return true;
      } catch (err){
        showSupabaseError?.('Kunde inte uppdatera molndata inför ' + reportName, err);
        return false;
      }
    }

    function reportMetaHTML(extra=''){
      const user = CURRENT_USER?.email ? ` • Användare: ${escapeHtml(CURRENT_USER.email)}` : '';
      const synced = LAST_CLOUD_SYNC_AT ? ` • Synkad: ${escapeHtml(LAST_CLOUD_SYNC_AT.toLocaleString('sv-SE'))}` : '';
      return `<div class="meta">Källa: Supabase molndata${user}${synced}${extra? ' • '+extra:''}</div>`;
    }

    /*********************** Exporter (PDF/Print) ************************/
    async function exportBatchesPDF(){
      const ok = await ensureFreshCloudDataForReport('tillverkningsjournal');
      if (!ok) return;
      const html = `<h1>Tillverkningsjournal</h1>${reportMetaHTML()}${batchesReportHTML(LAST_BATCHES_VIEW.length? LAST_BATCHES_VIEW : BATCHES)}`;
      openPrintWindow('Tillverkningsjournal', html);
    }
    async function exportOrdersPDF(){
      const ok = await ensureFreshCloudDataForReport('beställningsjournal');
      if (!ok) return;
      const html = `<h1>Beställningsjournal</h1>${reportMetaHTML()}${ordersReportHTML(LAST_ORDERS_VIEW.length? LAST_ORDERS_VIEW : ORDERS)}`;
      openPrintWindow('Beställningsjournal', html);
    }
    function batchesReportHTML(list){
      list = list || [];
      const grouped = new Map();
      let totalM3 = 0;
      for (const b of list){
        const recipe = b.recipeName || 'Okänt recept';
        const amount = parseFloat(b.amount || b.amount_m3 || 0) || 0;
        totalM3 += amount;
        if (!grouped.has(recipe)) grouped.set(recipe, { recipeName: recipe, strength: b.strength || '', count: 0, total: 0, rows: [] });
        const g = grouped.get(recipe);
        g.count += 1;
        g.total += amount;
        if (!g.strength && b.strength) g.strength = b.strength;
        g.rows.push(b);
      }
      const sections = Array.from(grouped.values()).sort((a,b)=>a.recipeName.localeCompare(b.recipeName, 'sv')).map(g => {
        const detailRows = g.rows.map(b => {
          const typeRaw = b.productionType || b.app_data?.productionType || b.app_data?.production_type || (b.source === 'customer_order' ? 'order' : (b.source === 'prefab_queue' ? 'prefab' : ''));
          const typeTxt = typeRaw === 'order' ? 'Beställning' : (typeRaw ? 'Prefab' : '—');
          return `<tr>
            <td>${fmtDate(b.dateTime)}</td>
            <td>${escapeHtml(typeTxt)}</td>
            <td class="right">${(parseFloat(b.amount || 0) || 0).toFixed(2)}</td>
            <td class="right">${(b.vct ?? 0).toFixed(3)}</td>
            <td class="right">${(b.vctEq ?? 0).toFixed(3)}</td>
            <td class="right">${(b.gwpTotal ?? 0).toFixed(1)}</td>
          </tr>`;
        }).join('');
        return `<h2 style="margin-top:18px">${escapeHtml(g.recipeName)}${g.strength ? ' – '+escapeHtml(g.strength) : ''}</h2>
          <p><b>Antal poster:</b> ${g.count} &nbsp; <b>Total mängd:</b> ${g.total.toFixed(2)} m³</p>
          <table>
            <thead><tr><th>Datum</th><th>Typ</th><th class="right">Mängd (m³)</th><th class="right">VCT</th><th class="right">VCT ekv</th><th class="right">GWP total</th></tr></thead>
            <tbody>${detailRows || '<tr><td colspan="6">—</td></tr>'}</tbody>
          </table>`;
      }).join('') || '<p>Inga satser i vald period.</p>';
      return `${sections}<h2 style="margin-top:22px;border-top:1px solid #ddd;padding-top:12px">Totalt för perioden: ${totalM3.toFixed(2)} m³</h2>`;
    }
    function ordersReportHTML(list){
      list = list||[];
      const rows = list.map(o=> `<tr>
        <td>${fmtDate(o.dateTime)}</td><td>${escapeHtml(o.customerName||'')}</td><td>${escapeHtml(o.recipeName)}</td><td>${escapeHtml(o.strength||'')}</td>
        <td class="right">${o.amount}</td><td class="right">${(o.vct??0).toFixed(3)}</td><td class="right">${(o.vctEq??0).toFixed(3)}</td>
        <td class="right">${(o.gwpPerM3??0).toFixed(1)}</td><td class="right">${(o.gwpTotal??0).toFixed(1)}</td>
        <td>${escapeHtml(o.orderContact||'')}</td><td>${escapeHtml(o.orderInfo||'')}</td>
      </tr>`).join('') || '<tr><td colspan="11">—</td></tr>';
      return `<table>
        <thead><tr><th>Datum</th><th>Kund</th><th>Recept</th><th>Hållfasthet</th><th>Mängd</th><th>VCT</th><th>VCT ekv</th><th>GWP/m³</th><th>GWP total</th><th>Kontakt</th><th>Övrigt</th></tr></thead>
        <tbody>${rows}</tbody></table>`;
    }
    function cubesReportHTML(list){
      list = list||[];
      const rows = list.map(c=> `<tr>
        <td>${fmtOnlyDate(c.castDate)}</td><td>${escapeHtml(c.recipeName)}</td><td>${escapeHtml(c.strengthClass||'')}</td>
        <td class="right">${isFinite(c.vct)? Number(c.vct).toFixed(3):''}${isFinite(c.vctReq)?' / '+Number(c.vctReq).toFixed(3):''}</td>
        <td class="right">${isFinite(c.vctEq)? Number(c.vctEq).toFixed(3):''}${isFinite(c.vctEqReq)?' / '+Number(c.vctEqReq).toFixed(3):''}</td>
        <td class="right">${isFinite(c.air)? Number(c.air).toFixed(1):''}${isFinite(c.airReq)?' / '+Number(c.airReq).toFixed(1):''}</td>
        <td class="right">${isFinite(c.temp)? Number(c.temp).toFixed(1):''}</td>
        <td class="right">${isFinite(c.kw)? Number(c.kw).toFixed(1):''}</td>
        <td class="right">${c.weight??'—'}</td><td class="right">${c.resultMPa??'—'}</td>
        <td>${fmtOnlyDate(c.dueDate)}</td><td>${c.batchId?escapeHtml(c.batchId):'—'}</td><td>${escapeHtml(c.extra||'')}</td>
      </tr>`).join('') || '<tr><td colspan="13">—</td></tr>';
      return `<table>
        <thead><tr>
          <th>Gjutdatum</th><th>Recept</th><th>Hållfasthet</th>
          <th>Vct m/krav</th><th>Vct ekv m/krav</th><th>Luft m/krav</th><th>Temp (°C)</th><th>Kw</th>
          <th>Vikt (kg)</th><th>MPa</th><th>Uttag</th><th>Sats-ID</th><th>Övrigt</th>
        </tr></thead>
        <tbody>${rows}</tbody></table>`;
    }

    function openPrintWindow(title, innerHTML){
      const win = window.open('', '_blank');
      const styles = `
        <style>
          body{font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial;padding:16px;color:#111}
          h1{margin:0 0 8px;}
          table{width:100%;border-collapse:collapse;margin:8px 0}
          th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
          th{background:#f3f4f6}
          .right{text-align:right}
          .meta{color:#555;margin:2px 0 8px;font-size:12px}
          .report-footer{margin-top:16px;color:#555;font-size:11px;border-top:1px solid #ddd;padding-top:8px}
        </style>`;
      win.document.write(`<html><head><title>${escapeHtml(title)}</title>${styles}</head><body>${innerHTML}<div class="report-footer">Rapport genererad ${escapeHtml(new Date().toLocaleString('sv-SE'))} från BTGkontroll.</div>
<!-- =========================================================
     v19.5.10 DASHBOARD TAB VISIBILITY FIX
     Dashboard ska inte tvingas visas ovanför andra flikar för superadmin.
     Ingen behörighetslogik ändrad.
========================================================= -->
</body></html>`);
      win.document.close();
      win.focus();
      win.print();
    }

    /*********************** Utils ************************/
    function downloadJSON(filename, data){
      const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href=url; a.download=filename; a.click();
      URL.revokeObjectURL(url);
    }
    function importJSON(e, onData){
      const file = e.target.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = ()=>{ try { const arr = JSON.parse(reader.result); onData(Array.isArray(arr)?arr:[]); } catch { alert('Ogiltig JSON'); } };
      reader.readAsText(file);
      e.target.value='';
    }
    function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }

    /*********************** App init ************************/
    applyBranding();
    setTab('dashboard');

    /* ==== Hjälptexter (hover-tooltips) ==== */
    (function(){
      const HELP_TEXT = {
        mean: 'Medelvärde x̄: summan av värden dividerat med antal (n).',
        sd: 'Standardavvikelse (stickprov, n−1). Mått på spridning.',
        n: 'Antal provkuber som ingår efter filter (exklusive kuber markerade som exkluderade).',
        window15: 'Glidande 15-metod (EN 206): statistik per fönster om 15 på varandra följande prov.',
        age: 'Ålder (dagar) vid provning. Filtrering begränsar vilka prov som ingår.',
        group: 'Receptgrupp (t.ex. Grupp 1: vanlig betong, Grupp 2: luftbetong).'
      };
      function mark(el, key){ if (!el) return; el.classList.add('help-hint'); if (!el.title) el.title = HELP_TEXT[key]||''; }
      function scanAndAnnotate(){
        const root = document.getElementById('tab-utvardering');
        if (!root) return;
        const pairs = [
          {key:'sd', text:'Standardavvikelse'},
          {key:'mean', text:'Medel'},
          {key:'n', text:'Antal'},
          {key:'window15', text:'Glidande 15'},
          {key:'age', text:'Ålder'},
          {key:'group', text:'Grupp'}
        ];
        pairs.forEach(({key,text})=>{
          const all = root.querySelectorAll('*');
          Array.from(all).filter(el=> el.childElementCount===0 && el.textContent && el.textContent.includes(text)).forEach(el=> mark(el, key));
        });
      }
      document.querySelectorAll('.tab-btn[data-tab="utvardering"]').forEach(btn=>{
        btn.addEventListener('click', ()=> setTimeout(scanAndAnnotate, 0));
      });
      const evalTab = document.getElementById('tab-utvardering');
      if (evalTab){
        const obs = new MutationObserver(()=> scanAndAnnotate());
        obs.observe(evalTab, {childList:true, subtree:true});
      }
      setTimeout(scanAndAnnotate, 400);
    })();

    /* ==== Prefill krav vid receptval i kub-form ==== */
    function prefillCubeReqFromRecipe(){
      const recipeId = document.getElementById('cubeRecipe').value;
      const recipe = RECIPES.find(r=> r.id===recipeId);
      if (!recipe) return;
      const v = id => document.getElementById(id);
      if (v('cubeVctReq') && !v('cubeVctReq').value) v('cubeVctReq').value = recipe.vctReq ?? '';
      if (v('cubeVctEqReq') && !v('cubeVctEqReq').value) v('cubeVctEqReq').value = recipe.vctEqReq ?? '';
      if (v('cubeAirReq') && !v('cubeAirReq').value) v('cubeAirReq').value = recipe.airReq ?? '';
    }
    document.getElementById('cubeRecipe')?.addEventListener('change', prefillCubeReqFromRecipe);

    /*********************** Nordcert-rapport (GUI) ************************/
    const nordBtn = document.getElementById('btnNordcert');
    const nordDlg = document.getElementById('nordcertDialog');
    nordBtn && (nordBtn.onclick = ()=>{
      renderRecipeSelects();
      const f = document.getElementById('ncFrom'), t = document.getElementById('ncTo');
      if (t && !t.value) t.value = todayISO();
      if (f && !f.value){ const d=new Date(); d.setMonth(d.getMonth()-6); f.value = d.toISOString().slice(0,10); }
      nordDlg.showModal();
    });

    document.getElementById('btnMakeNordcert')?.addEventListener('click', async (e)=>{
      e.preventDefault();
      const from = document.getElementById('ncFrom').value || null;
      const to = document.getElementById('ncTo').value || null;
      const strength = (()=>{ 
        const sel = document.getElementById('ncStrength');
        if(!sel) return '';
        const rid = sel.value;
        if(!rid) return '';
        const r = RECIPES.find(x=>x.id===rid);
        return r?.strength || '';
      })();

      const ok = await ensureFreshCloudDataForReport('Nordcert-rapport');
      if (!ok) return;

      // bygg sektioner
      const secEN206  = document.getElementById('ncSecEN206')?.checked;
      const secStat   = document.getElementById('ncSecStat')?.checked;
      const secCubes  = document.getElementById('ncSecCubes')?.checked;
      const secBatches= document.getElementById('ncSecBatches')?.checked;
      const secOrders = document.getElementById('ncSecOrders')?.checked;
      const secControl= document.getElementById('ncSecControl')?.checked;
      const secDiary  = document.getElementById('ncSecDiary')?.checked;

      // Filterhjälp
      const filterByRange = (iso) => (!from || iso.slice(0,10)>=from) && (!to || iso.slice(0,10)<=to);

      const title = `Nordcert-rapport ${from||''}${to? ' – '+to:''}${strength? ' • '+strength:''}${SETTINGS?.creator? ' • '+escapeHtml(SETTINGS.creator):''}`;
      let html = `<h1>${escapeHtml(title)}</h1>${reportMetaHTML()}`;

      // Kuber
      const cubesFiltered = (CUBES||[])
        .filter(c=> !c.excludeFromEval)
        .filter(c=> filterByRange(c.castDate))
        .filter(c=> !strength || (c.strengthClass||'')===strength)
        .sort((a,b)=> a.castDate.localeCompare(b.castDate));

      if (secEN206){
        html += `<h2>EN 206 – glidande 15</h2>${buildEvalEN206HTML(cubesFiltered)}`;
      }
      if (secStat){
        const s = stats(cubesFiltered.map(c=> c.resultMPa).filter(v=> v!=null && !isNaN(v)));
        html += `<h2>Utvärdering – statistik</h2>${buildEvalStatsHTML(cubesFiltered, s)}`;
      }
      if (secCubes){
        html += `<h2>Provkuber</h2>${cubesReportHTML(cubesFiltered)}`;
      }

      if (secBatches){
        const batchesFiltered = (BATCHES||[])
          .filter(b=> filterByRange(b.dateTime))
          .filter(b=> !strength || (b.strength||'')===strength)
          .sort((a,b)=> a.dateTime.localeCompare(b.dateTime));
        html += `<h2>Tillverkningsjournal</h2>${batchesReportHTML(batchesFiltered)}`;
      }
      if (secOrders){
        const ordersFiltered = (ORDERS||[])
          .filter(o=> filterByRange(o.dateTime))
          .filter(o=> !strength || (o.strength||'')===strength)
          .sort((a,b)=> a.dateTime.localeCompare(b.dateTime));
        html += `<h2>Beställningsjournal</h2>${ordersReportHTML(ordersFiltered)}`;
      }
      if (secControl){
        const year = new Date().getFullYear();
        const blocks = (CONTROL_DEVICES||[]).map(d=> controlDeviceReportHTML(d)).join('<hr style="border:none;border-top:1px solid #ccc;margin:8px 0">') || '<div class="pill">Inga instrument registrerade.</div>';
        html += `<h2>Instrumentkontroller (år ${year})</h2>${blocks}`;
      }
      if (secDiary){
        const keys = Object.keys(DIARY).filter(d=> (!from || d>=from) && (!to || d<=to)).sort();
        html += `<h2>Dagbok</h2>` + (keys.map(k=> diaryReportHTML(k, DIARY[k])).join('') || '<div class="pill">Ingen dagbok i detta intervall.</div>');
      }

      openPrintWindow('Nordcert-rapport', html);
      nordDlg.close();
    });


/* ================= EN206/SS137003 – Drop-in Enhancements ================= */

/* 1) Defaults (engångsinit) */
(function ensureEn206Defaults(){
  const def = {
    method: 'methodB',         // 'methodA' | 'methodB' | 'cusum' | 'shewhart' | 'manual'
    window: 15,                // fönsterstorlek för Metod B / fortlöpande tillverkning
    ageNominal: 28,            // nominell ålder (dagar)
    ageTolerance: 2,           // ± tolerans (dagar)
    includeOutOfAge: false,    // inkludera prov utanför tolerans i beräkningarna?
    fckSource: 'parse',        // 'parse' = hämta f_ck(cube) från styrka t.ex. "C28/35" -> 35
    meanMarginMPa: 0,          // kräv x̄ - f_ck ≥ meanMarginMPa (om useSigma=false)
    useSigma: false,           // om true: EN-typ x̄ − k·s ≥ f_ck
    kSigma: 1.48,              // k för x̄ − k·s ≥ f_ck
    indivMinDeltaMPa: 3,       // individuellt min: c_i ≥ f_ck − indivMinDeltaMPa
    // CUSUM (enkel “underside”-variant på avvikelse mot target)
    cusumK: 0,                 // slakhet K (MPa)
    cusumH: 10                 // tröskel H (MPa) – överskridande flaggas
  };
  try {
    if (!SETTINGS.en206) SETTINGS.en206 = def;
    else SETTINGS.en206 = { ...def, ...SETTINGS.en206 };
    // v13: mappa gamla interna metodnamn till tydliga EN206-val
    if (SETTINGS.en206.method === 'sliding15') SETTINGS.en206.method = 'methodB';
    save?.(DB_KEYS.settings, SETTINGS);
  } catch {}
})();

/* v13: tydliga metodnamn enligt EN 206 */
function en206MethodLabel(method){
  const labels = {
    methodA: 'Metod A – Inledande tillverkning',
    methodB: 'Metod B – Fortlöpande tillverkning',
    cusum: 'CUSUM – alternativ styrmetod',
    shewhart: 'Shewhart – alternativ styrmetod',
    manual: 'Manuell bedömning / rapportläge',
    sliding15: 'Metod B – Fortlöpande tillverkning'
  };
  return labels[method] || labels.methodB;
}


async function saveTaskToSupabase(task){
  const user = await getRequiredCloudUser('spara uppgift i molnet');
  if (!user) return null;

  const payload = {
    user_id: user.id,
    title: task.title || '',
    freq: task.freq || 'daily',
    log: Array.isArray(task.log) ? task.log : [],
    app_data: {
      ...task,
      title: task.title || '',
      freq: task.freq || 'daily',
      log: Array.isArray(task.log) ? task.log : []
    }
  };

  let result;
  if (task.cloudId || (task.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(task.id))) {
    const id = task.cloudId || task.id;
    result = await sb.from('tasks').update(payload).eq('id', id).eq('user_id', user.id).select('id,title,freq,log,app_data,created_at').single();
  } else {
    result = await sb.from('tasks').insert([payload]).select('id,title,freq,log,app_data,created_at').single();
  }

  if (result.error) {
    showSupabaseError('Fel vid sparning av uppgift till Supabase', result.error);
    return null;
  }

  return normalizeTaskRow(result.data);
}

async function deleteTaskFromSupabase(task){
  const user = await getRequiredCloudUser('ta bort uppgift i molnet');
  if (!user) return false;
  const id = task.cloudId || task.id;
  if (!id) return true;
  const { error } = await sb.from('tasks').delete().eq('id', id).eq('user_id', user.id);
  if (error) {
    showSupabaseError('Fel vid borttagning av uppgift i Supabase', error);
    return false;
  }
  return true;
}

/* 2) Inställningar – injicera UI dynamiskt */
(function enhanceSettingsUI(){
  const dlg = document.getElementById('settingsDialog');
  if (!dlg) return;

  function fieldRow(html){ const d=document.createElement('div'); d.className='grid grid-2'; d.innerHTML=html; return d; }
  function addBlock(){
    const form = dlg.querySelector('#settingsForm .container');
    if (!form || form.querySelector('#en206-block')) return;
    const wrap = document.createElement('div');
    wrap.id = 'en206-block';
    wrap.className = 'card';
    wrap.style.marginTop = '12px';
    wrap.innerHTML = `<h3>EN 206 / SS 137003 – Konformitet</h3>`;
    form.appendChild(wrap);

    // Rad 1: metod & fönster
    wrap.appendChild(fieldRow(`
      <div>
        <label>Utvärderingsmetod</label>
        <select id="en206_method">
          <option value="methodA">Metod A – Inledande tillverkning</option>
          <option value="methodB">Metod B – Fortlöpande tillverkning</option>
          <option value="cusum">CUSUM – alternativ styrmetod</option>
          <option value="shewhart">Shewhart – alternativ styrmetod</option>
          <option value="manual">Manuell bedömning / rapportläge</option>
        </select>
      </div>
      <div>
        <label>Fönsterstorlek för Metod B</label>
        <input id="en206_window" type="number" min="5" value="${SETTINGS.en206.window}">
      </div>
    `));

    // Rad 2: ålder
    wrap.appendChild(fieldRow(`
      <div>
        <label>Nominell ålder (dagar)</label>
        <input id="en206_ageNominal" type="number" min="1" value="${SETTINGS.en206.ageNominal}">
      </div>
      <div>
        <label>± Tolerans (dagar)</label>
        <input id="en206_ageTol" type="number" min="0" value="${SETTINGS.en206.ageTolerance}">
      </div>
    `));
    const rowAge = document.createElement('div');
    rowAge.className='row';
    rowAge.style.marginTop='.35rem';
    rowAge.innerHTML = `
      <label style="display:flex;align-items:center;gap:.5rem">
        <input id="en206_includeOutOfAge" type="checkbox"> <span>Inkludera prov utanför ålderstolerans i beräkningar</span>
      </label>`;
    wrap.appendChild(rowAge);

    // Rad 3: kriterier
    wrap.appendChild(fieldRow(`
      <div>
        <label>f<sub>ck</sub>-källa</label>
        <select id="en206_fckSource">
          <option value="parse">Parsa från hållfasthet (t.ex. C28/35 → 35)</option>
        </select>
      </div>
      <div>
        <label>Individuellt min (MPa under f<sub>ck</sub>)</label>
        <input id="en206_indivDelta" type="number" min="0" step="0.1" value="${SETTINGS.en206.indivMinDeltaMPa}">
      </div>
    `));

    // Rad 4: medelvärdeskrav
    wrap.appendChild(fieldRow(`
      <div>
        <label>Medelvärdeskrav</label>
        <select id="en206_meanMode">
          <option value="margin">x̄ − f<sub>ck</sub> ≥ marginal (MPa)</option>
          <option value="sigma">x̄ − k·s ≥ f<sub>ck</sub></option>
        </select>
      </div>
      <div>
        <div class="row">
          <div>
            <label>Marginal (MPa)</label>
            <input id="en206_meanMargin" type="number" step="0.1" value="${SETTINGS.en206.meanMarginMPa}">
          </div>
          <div>
            <label>k (för σ-metoden)</label>
            <input id="en206_kSigma" type="number" step="0.01" value="${SETTINGS.en206.kSigma}">
          </div>
        </div>
      </div>
    `));

    // Rad 5: CUSUM-parametrar
    wrap.appendChild(fieldRow(`
      <div>
        <label>CUSUM K (slakhet, MPa)</label>
        <input id="en206_cusumK" type="number" step="0.1" value="${SETTINGS.en206.cusumK}">
      </div>
      <div>
        <label>CUSUM H (tröskel, MPa)</label>
        <input id="en206_cusumH" type="number" step="0.1" value="${SETTINGS.en206.cusumH}">
      </div>
    `));

    // Init values
    wrap.querySelector('#en206_method').value = SETTINGS.en206.method;
    wrap.querySelector('#en206_includeOutOfAge').checked = !!SETTINGS.en206.includeOutOfAge;
    wrap.querySelector('#en206_meanMode').value = SETTINGS.en206.useSigma ? 'sigma' : 'margin';
  }

  // Bind open & save
  const btnOpen = document.getElementById('btnSettings');
  if (btnOpen){
    btnOpen.addEventListener('click', ()=> setTimeout(addBlock, 0));
  }
  const btnSave = document.getElementById('btnSaveSettings');
  if (btnSave){
    btnSave.addEventListener('click', ()=>{
      const g = (id)=> dlg.querySelector('#'+id);
      const en = SETTINGS.en206 || {};
      en.method = g('en206_method')?.value || en.method;
      en.window = parseInt(g('en206_window')?.value||en.window)||en.window;
      en.ageNominal = parseInt(g('en206_ageNominal')?.value||en.ageNominal)||en.ageNominal;
      en.ageTolerance = parseInt(g('en206_ageTol')?.value||en.ageTolerance)||en.ageTolerance;
      en.includeOutOfAge = !!g('en206_includeOutOfAge')?.checked;
      en.fckSource = g('en206_fckSource')?.value || en.fckSource;
      en.indivMinDeltaMPa = parseFloat(g('en206_indivDelta')?.value||en.indivMinDeltaMPa)||en.indivMinDeltaMPa;

      const meanMode = g('en206_meanMode')?.value || (en.useSigma?'sigma':'margin');
      en.useSigma = (meanMode==='sigma');
      en.meanMarginMPa = parseFloat(g('en206_meanMargin')?.value||en.meanMarginMPa)||0;
      en.kSigma = parseFloat(g('en206_kSigma')?.value||en.kSigma)||en.kSigma;

      en.cusumK = parseFloat(g('en206_cusumK')?.value||en.cusumK)||en.cusumK;
      en.cusumH = parseFloat(g('en206_cusumH')?.value||en.cusumH)||en.cusumH;

      SETTINGS.en206 = en;
      save(DB_KEYS.settings, SETTINGS);
    });
  }
})();

/* 3) Hjälp: tolkning av f_ck från styrkeklass (t.ex. "C28/35" → 35) */
function parseFckFromStrength(str){
  if (!str) return null;
  const m = String(str).match(/C\s*\d+\s*\/\s*(\d+)/i);
  if (m) return parseFloat(m[1]);
  const m2 = String(str).match(/(\d+)/);
  return m2 ? parseFloat(m2[1]) : null;
}

/* 4) Dubbletter och Grubbs outlier-test (α≈0.05) */
function detectDuplicates(cubes){
  const seen = new Set(), dups = new Set();
  for (const c of cubes){
    const key = [c.castDate, c.recipeName, c.resultMPa].join('|');
    if (seen.has(key)) dups.add(key); else seen.add(key);
  }
  return new Set([...dups]); // return key-set
}
function grubbsCriticalValue(n, alpha=0.05){
  // Approx via t-kvantil (tvåsidig) – räcker här
  // t_{α/(2n), n-2}; för enkelhet: tabell lite förenklad
  // Fallback: konservativ ~2.2 vid större n
  const table = {3:1.15,4:1.48,5:1.71,6:1.89,7:2.02,8:2.13,9:2.21,10:2.29,11:2.36,12:2.41,13:2.46,14:2.50,15:2.54,16:2.57,17:2.60,18:2.62,19:2.64,20:2.66};
  return table[n] || 2.7; // enkel approx
}
function grubbsOutliers(values){
  const n = values.length;
  if (n<3) return { indices:[], G:null, Gcrit:null };
  const mean = values.reduce((s,x)=>s+x,0)/n;
  const sd = Math.sqrt(values.reduce((s,x)=> s+(x-mean)*(x-mean),0)/(n-1));
  if (!isFinite(sd) || sd===0) return { indices:[], G:null, Gcrit:null };
  let maxDev = -Infinity, idx = -1;
  values.forEach((v,i)=>{ const d=Math.abs(v-mean)/sd; if (d>maxDev){ maxDev=d; idx=i; } });
  const Gcrit = grubbsCriticalValue(n);
  return { indices: maxDev>Gcrit ? [idx] : [], G:maxDev, Gcrit };
}

/* 5) EN206-kärna: kravvärdering */
function cubeFlags(c, cfg){
  const age = parseInt(c.cureDays||0);
  const ageOk = Math.abs(age - cfg.ageNominal) <= cfg.ageTolerance;
  const fck = parseFckFromStrength(c.strengthClass||'');
  const indivMinOk = (fck==null || c.resultMPa==null) ? true : (c.resultMPa >= (fck - cfg.indivMinDeltaMPa));
  return { ageOk, fck, indivMinOk };
}
function deltasForCubes(windowCubes){
  return windowCubes.map(c=>{
    const fck = parseFckFromStrength(c.strengthClass||'');
    if (fck==null || c.resultMPa==null) return null;
    return { cube:c, fck, delta:c.resultMPa - fck };
  }).filter(Boolean);
}

function methodAPass(windowCubes, cfg){
  // EN 206 Metod A: inledande tillverkning, grupper om 3 resultat.
  // Medelkrav: fcm >= fck + 4 MPa. Vi räknar som delta-medel >= +4 MPa.
  const items = deltasForCubes(windowCubes);
  if (items.length < 3) return { ok:false, reason:'färre än 3 giltiga prov', n:items.length };
  const mean = items.reduce((s,x)=>s+x.delta,0)/items.length;
  const meanOk = mean >= 4;
  let indivOk = true;
  for (const {cube, fck} of items){
    if (cube.resultMPa < (fck - 4)){ indivOk = false; break; }
  }
  const sd = items.length>1 ? Math.sqrt(items.reduce((s,x)=> s+(x.delta-mean)*(x.delta-mean),0)/(items.length-1)) : 0;
  return { ok:meanOk && indivOk, mean, sd, n:items.length, meanOk, indivOk };
}

function methodBPass(windowCubes, cfg){
  // v14 EN 206 audit:
  // Metod B använder referensstandardavvikelse (σRef) om den finns.
  // Enligt EN 206 ska σ för populationen skattas utifrån minst 35 på varandra följande resultat
  // vid slutet av inledande tillverkning. Om σRef saknas visar appen en varning och faller tillbaka
  // till stickprovs-s i aktuellt fönster endast som preliminär beräkning.
  const items = deltasForCubes(windowCubes);
  if (!items.length) return { ok:false, reason:'saknar f_ck/x', n:0, sigmaWarning:'Inga giltiga resultat.' };
  const n = items.length;
  const mean = items.reduce((sum,x)=>sum+x.delta,0)/n;
  const sampleSd = n>1 ? Math.sqrt(items.reduce((sum,x)=> sum+(x.delta-mean)*(x.delta-mean),0)/(n-1)) : 0;
  const sigmaRef = Number.isFinite(parseFloat(cfg._sigmaRef)) ? parseFloat(cfg._sigmaRef) : sampleSd;
  const sigmaSource = Number.isFinite(parseFloat(cfg._sigmaRef)) ? 'σRef' : 'fönstrets stickprovs-s (preliminärt)';
  const sigmaWarning = Number.isFinite(parseFloat(cfg._sigmaRef))
    ? ''
    : 'σRef saknas/otillräcklig. EN 206 anger skattning från minst 35 på varandra följande resultat; här används fönstrets stickprovs-s preliminärt.';
  const k = Number.isFinite(parseFloat(cfg.kSigma)) ? parseFloat(cfg.kSigma) : 1.48;
  const meanOk = (mean - k*sigmaRef) >= 0;
  const deltaMin = Number.isFinite(parseFloat(cfg.indivMinDeltaMPa)) ? parseFloat(cfg.indivMinDeltaMPa) : 4;
  let indivOk = true;
  for (const {cube, fck} of items){
    if (cube.resultMPa < (fck - deltaMin)){ indivOk=false; break; }
  }
  return { ok:meanOk && indivOk, mean, sd:sampleSd, sigmaRef, sigmaSource, n, meanOk, indivOk, sigmaWarning };
}

function nonOverlappingWindows(arr, k){
  const out=[];
  for (let i=0; i+k<=arr.length; i+=k) out.push(arr.slice(i,i+k));
  return out;
}

function en206PeriodNotice(cubes, method){
  if (!cubes || !cubes.length) return '';
  const first = new Date(cubes[0].castDate);
  const last = new Date(cubes[cubes.length-1].castDate);
  if (!Number.isFinite(first.getTime()) || !Number.isFinite(last.getTime())) return '';
  const days = Math.max(1, Math.round((last-first)/86400000)+1);
  if (method === 'methodB'){
    const over6 = days > 183;
    const over3 = days > 92;
    return `<div class="pill ${over6?'danger':over3?'warn':''}" style="margin-top:.35rem">Bedömningsperiod: ${days} dagar. EN 206 Metod B anger minst 15 resultat och högst 6 månader vid lägre provningsfrekvens, respektive högst 3 månader vid högre provningsfrekvens.</div>`;
  }
  return '';
}

function windowPass(windowCubes, cfg){
  if ((cfg.method||'methodB') === 'methodA') return methodAPass(windowCubes, cfg);
  return methodBPass(windowCubes, cfg);
}

function shewhartAnalysis(cubes, cfg){
  const items = deltasForCubes(cubes);
  if (!items.length) return { rows:[], mean:null, sd:null, lcl:null, ucl:null };
  const vals = items.map(x=>x.delta);
  const n = vals.length;
  const mean = vals.reduce((s,x)=>s+x,0)/n;
  const sd = n>1 ? Math.sqrt(vals.reduce((s,x)=>s+(x-mean)*(x-mean),0)/(n-1)) : 0;
  const lcl = mean - 3*sd;
  const ucl = mean + 3*sd;
  return {
    mean, sd, lcl, ucl,
    rows: items.map(x=>({ cube:x.cube, delta:x.delta, breach: sd>0 && (x.delta<lcl || x.delta>ucl) }))
  };
}

function cusumAnalysis(cubes, cfg){
  // Vi kör på "underside": target = f_ck + meanMarginMPa
  // Ackumulerar underskott. Flaggar när S>H
  const out = [];
  let S = 0;
  for (const c of cubes){
    const fck = parseFckFromStrength(c.strengthClass||'');
    if (fck==null || c.resultMPa==null){ out.push({S, breach:false}); continue; }
    const target = fck + (cfg.useSigma? 0 : cfg.meanMarginMPa); // enkel tolkning
    const d = target - c.resultMPa - cfg.cusumK;
    S = Math.max(0, S + (isFinite(d)? d : 0));
    out.push({ S, breach: S > cfg.cusumH });
  }
  return out;
}

/* 6) Krav-fliken: rendering */
function renderEvalKrav(){
  const cfg = SETTINGS.en206 || {};
  const from = document.getElementById('evalFrom').value || null;
  const to = document.getElementById('evalTo').value || null;
  const strength = document.getElementById('evalStrength').value || '';
  const groupId = document.getElementById('evalGroup').value || '';
  const ageDaysRaw = document.getElementById('evalAgeDays').value;
  const ageDays = ageDaysRaw===''? null : parseInt(ageDaysRaw);

  let cubes = cubesForEvaluation({from,to,strengthClass:strength,groupId,ageDays:null});
  const ageFiltered = [];
  const rows = [];
  const dupKeys = detectDuplicates(cubes);
  const values = cubes.map(c=> c.resultMPa).filter(v=> v!=null);
  const gr = grubbsOutliers(values);
  const outlierIndex = new Set(gr.indices.map(i=> i));

  for (let i=0;i<cubes.length;i++){
    const c = cubes[i];
    const f = cubeFlags(c, cfg);
    const ageOff = !f.ageOk;
    const dup = dupKeys.has([c.castDate,c.recipeName,c.resultMPa].join('|'));
    const outl = outlierIndex.has(i);
    const warn = [];
    if (ageOff) warn.push('Ålder ±'+cfg.ageTolerance+' d');
    if (dup) warn.push('Dubblett');
    if (outl) warn.push('Outlier');
    const indivPass = f.indivMinOk!==false;
    if (cfg.includeOutOfAge || f.ageOk) ageFiltered.push(c);
    rows.push({c, warn, indivPass});
  }

  const method = cfg.method || 'methodB';
  const sigmaRef = (typeof computeSigmaRef === 'function')
    ? computeSigmaRef({from,to,strength,groupId,includeOut:!!cfg.includeOutOfAge,cfg})
    : NaN;
  const sigmaPill = Number.isFinite(sigmaRef)
    ? `<span class="pill ok">σRef ${sigmaRef.toFixed(2)} MPa</span>`
    : `<span class="pill warn">σRef saknas – minst 35 resultat behövs normalt för etablerad skattning</span>`;

  let windowsHTML = '';
  if (method === 'methodA'){
    // EN 206 Metod A: kriteriet är framtaget för icke överlappande grupper.
    // Standardtexten tillåter även överlappande grupper men anger att det ökar risken för förkastande.
    const wins = nonOverlappingWindows(ageFiltered, 3);
    if (!wins.length){
      windowsHTML = '<div class="pill" style="margin-top:.35rem">Metod A kräver minst 3 giltiga prov i urvalet.</div>';
    } else {
      const wrows = wins.map((win, i)=>{
        const r = methodAPass(win, cfg);
        const span = `${fmtOnlyDate(win[0].castDate)} – ${fmtOnlyDate(win[win.length-1].castDate)}`;
        const flag = r.ok ? '<span class="pill ok">PASS</span>' : (!r.meanOk ? '<span class="pill danger">FAIL (medel ≥ fck + 4)</span>' : '<span class="pill danger">FAIL (individ)</span>');
        return `<tr><td>${i+1}</td><td>${span}</td><td class="right">${(r.mean??0).toFixed(2)}</td><td class="right">${r.n}</td><td>${flag}</td></tr>`;
      }).join('');
      windowsHTML = `
        <div class="pill">Metod A – Inledande tillverkning: icke överlappande grupper om 3 prov. Medelkrav: f<sub>cm</sub> ≥ f<sub>ck</sub> + 4 MPa. Individkrav: f<sub>ci</sub> ≥ f<sub>ck</sub> − 4 MPa.</div>
        <div class="pill warn" style="margin-top:.35rem">Obs: EN 206 anger att kriterierna är framtagna för icke överlappande resultat; överlappande grupper kan öka risken för förkastande.</div>
        <div style="margin-top:.5rem"><table>
          <thead><tr><th>#</th><th>Period</th><th class="right">Δ-medel (MPa)</th><th class="right">n</th><th>Status</th></tr></thead>
          <tbody>${wrows}</tbody>
        </table></div>`;
    }
  } else if (method === 'methodB'){
    const k = Math.max(15, cfg.window||15);
    const wins = rollingWindows(ageFiltered, k);
    if (!wins.length){
      windowsHTML = '<div class="pill" style="margin-top:.35rem">Metod B kräver minst '+k+' prov i urvalet.</div>';
    } else {
      const wrows = wins.map((win, i)=>{
        const r = methodBPass(win, {...cfg, _sigmaRef: sigmaRef});
        const span = `${fmtOnlyDate(win[0].castDate)} – ${fmtOnlyDate(win[win.length-1].castDate)}`;
        const flag = r.ok ? '<span class="pill ok">PASS</span>' : (!r.meanOk ? '<span class="pill danger">FAIL (x̄−k·σ)</span>' : '<span class="pill danger">FAIL (individ)</span>');
        const warn = r.sigmaWarning ? '<br><small class="muted">'+escapeHtml(r.sigmaWarning)+'</small>' : '';
        return `<tr>
          <td>${i+1}</td><td>${span}</td>
          <td class="right">${(r.mean??0).toFixed(2)}</td>
          <td class="right">${(r.sigmaRef??0).toFixed(2)}</td>
          <td class="right">${(r.sd??0).toFixed(2)}</td>
          <td class="right">${r.n}</td>
          <td>${flag}${warn}</td>
        </tr>`;
      }).join('');
      windowsHTML = `
        <div class="pill">Metod B – Fortlöpande tillverkning: f<sub>cm</sub> ≥ f<sub>ck</sub> + ${cfg.kSigma||1.48}σ. Individkrav: f<sub>ci</sub> ≥ f<sub>ck</sub> − ${cfg.indivMinDeltaMPa||4} MPa.</div>
        <div style="margin-top:.35rem">${sigmaPill}</div>
        ${en206PeriodNotice(ageFiltered, 'methodB')}
        <div class="pill warn" style="margin-top:.35rem">v14-kontroll: Metod B använder σRef när den kan skattas. Om σRef saknas visas preliminär beräkning med fönstrets stickprovs-s och ska verifieras manuellt.</div>
        <div style="margin-top:.5rem">
          <table>
            <thead><tr><th>#</th><th>Period</th><th class="right">Δ-medel (MPa)</th><th class="right">σRef</th><th class="right">s fönster</th><th class="right">n</th><th>Status</th></tr></thead>
            <tbody>${wrows}</tbody>
          </table>
        </div>`;
    }
  } else if (method === 'cusum'){
    const seq = cusumAnalysis(ageFiltered, cfg);
    const anyBreach = seq.some(x=> x.breach);
    const trs = ageFiltered.map((c, i)=>`
      <tr><td>${fmtOnlyDate(c.castDate)}</td><td>${escapeHtml(c.recipeName)}</td><td class="right">${c.resultMPa??'—'}</td><td class="right">${seq[i]?.S?.toFixed(2)??'—'}</td><td>${seq[i]?.breach?'<span class="pill danger">Breach</span>':'—'}</td></tr>
    `).join('');
    windowsHTML = `
      <div class="pill">CUSUM (alternativ styrmetod): target = f<sub>ck</sub> + marginal, K=${cfg.cusumK}, H=${cfg.cusumH}. ${anyBreach?'<b>Överträdelse noterad.</b>':'Ingen överträdelse.'}</div>
      <div class="pill warn" style="margin-top:.35rem">Obs: CUSUM/Shewhart kräver regler som uppfyller EN 206:s krav för alternativa användningsregler. Behandla resultatet som styrdiagram/varningssystem tills metodparametrar är fastställda.</div>
      <div style="margin-top:.5rem"><table>
        <thead><tr><th>Gjutdatum</th><th>Recept</th><th class="right">MPa</th><th class="right">S</th><th>Status</th></tr></thead>
        <tbody>${trs || '<tr><td colspan="5">—</td></tr>'}</tbody>
      </table></div>`;
  } else if (method === 'shewhart'){
    const sh = shewhartAnalysis(ageFiltered, cfg);
    const trs = sh.rows.map(r=>`<tr><td>${fmtOnlyDate(r.cube.castDate)}</td><td>${escapeHtml(r.cube.recipeName)}</td><td class="right">${r.cube.resultMPa??'—'}</td><td class="right">${r.delta.toFixed(2)}</td><td>${r.breach?'<span class="pill danger">Utanför 3σ</span>':'—'}</td></tr>`).join('');
    windowsHTML = `
      <div class="pill">Shewhart – alternativ styrmetod. Δ-medel=${sh.mean==null?'—':sh.mean.toFixed(2)} MPa, σ=${sh.sd==null?'—':sh.sd.toFixed(2)} MPa, gränser ≈ ±3σ.</div>
      <div class="pill warn" style="margin-top:.35rem">Obs: Shewhart visas som styrdiagram/varningssystem tills användningsregler enligt EN 206 är fastställda.</div>
      <div style="margin-top:.5rem"><table>
        <thead><tr><th>Gjutdatum</th><th>Recept</th><th class="right">MPa</th><th class="right">Δ</th><th>Status</th></tr></thead>
        <tbody>${trs || '<tr><td colspan="5">—</td></tr>'}</tbody>
      </table></div>`;
  } else {
    windowsHTML = `<div class="pill warn">Manuell bedömning / rapportläge: appen visar urval, individkrav och varningar men gör ingen automatisk slutbedömning.</div>`;
  }

  const sampleRows = rows.map(({c, warn, indivPass})=>{
    const f = cubeFlags(c, cfg);
    const ageTxt = f.ageOk ? '<span class="pill ok">OK</span>' : '<span class="pill warn">Avvikelse</span>';
    const indivTxt = indivPass ? '<span class="pill ok">PASS</span>' : '<span class="pill danger">FAIL</span>';
    const warnTxt = warn.length ? warn.map(w=>`<span class="pill warn">${escapeHtml(w)}</span>`).join(' ') : '—';
    return `<tr>
      <td>${fmtOnlyDate(c.castDate)}</td>
      <td>${escapeHtml(c.recipeName)}</td>
      <td>${escapeHtml(c.strengthClass||'')}</td>
      <td class="right">${c.cureDays}</td>
      <td>${ageTxt}</td>
      <td class="right">${c.resultMPa??'—'}</td>
      <td>${indivTxt}</td>
      <td>${warnTxt}</td>
    </tr>`;
  }).join('');

  const body = document.getElementById('evalBody');
  body.innerHTML = `
    <div class="grid">
      <div class="kpi">
        <div>🧮</div><div><div style="font-weight:700">Metod</div><small class="muted">${en206MethodLabel(cfg.method)}</small></div>
        <div class="pill" style="margin-left:auto">Ålder: ${cfg.ageNominal}±${cfg.ageTolerance} d</div>
      </div>
      <div class="card">
        <h3>v14 – EN 206 math audit</h3>
        <div class="pill ok">Kontrollerat: individkrav f<sub>ci</sub> ≥ f<sub>ck</sub> − 4 MPa, Metod A f<sub>cm</sub> ≥ f<sub>ck</sub> + 4 MPa, Metod B f<sub>cm</sub> ≥ f<sub>ck</sub> + 1,48σ.</div>
        <div class="pill warn" style="margin-top:.35rem">Ej full certifiering: betongfamiljer/överförda resultat, fastställd σ-historik, CUSUM/Shewhart-parametrar och svenska specialfall ska fortfarande verifieras mot stationens faktiska kontrollplan.</div>
      </div>
      ${windowsHTML}
      <div style="margin-top:.8rem">
        <h4 style="margin:.25rem 0 .5rem">Per prov (individ-krav & varningar)</h4>
        <table>
          <thead><tr>
            <th>Gjutdatum</th><th>Recept</th><th>Hållfasthet</th><th class="right">Ålder (d)</th><th>Ålder OK</th>
            <th class="right">MPa</th><th>Individ</th><th>Varningar</th>
          </tr></thead>
          <tbody>${sampleRows || '<tr><td colspan="8">—</td></tr>'}</tbody>
        </table>
        <div class="pill" style="margin-top:.35rem">Outlier-test (Grubbs): G=${(gr.G??'—')}, G<sub>krit</sub>=${(gr.Gcrit??'—')} • Dubbletter kontrolleras på (datum+recept+MPa).</div>
      </div>
    </div>`;
}

/* 7) Koppla in “Krav”-fliken om den är vald */
(function hookEvalTab(){
  const evalTab = document.getElementById('tab-utvardering');
  if (!evalTab) return;
  // Finns redan i din kod: runEvaluation -> kollar subtab. Vi override: om 'krav' kalla renderEvalKrav
  const _runEval = window.runEvaluation;
  window.runEvaluation = function(){
    const active = document.querySelector('#tab-utvardering .subtabs .tab[aria-current="page"]')?.dataset.subtab || 'stat';
    if (active==='krav'){ renderEvalKrav(); return; }
    if (typeof _runEval === 'function') return _runEval();
  };
})();
