/***********************************************************
 * v15 – PROVFREKVENS
 *
 * Syfte:
 * - Ge användaren möjlighet att välja intern provfrekvens.
 * - Visa varning om antal registrerade kubuttag inte matchar
 *   vald frekvens i aktuell period.
 * - Visa status i Dashboard och Utvärdering/PDF.
 *
 * Viktigt:
 * Detta är ett praktiskt kontrollstöd. Slutlig frekvens ska
 * fastställas mot stationens kontrollplan och gällande krav.
 ***********************************************************/
(function(){
  const V15 = window.BTG_V15 = window.BTG_V15 || {};

  function ensureSamplingDefaults(){
    try{
      if (!window.SETTINGS) window.SETTINGS = {};
      if (!SETTINGS.en206) SETTINGS.en206 = {};
      if (!SETTINGS.en206.samplingFrequency){
        SETTINGS.en206.samplingFrequency = {
          enabled: true,
          mode: 'workdays',        // workdays | productionDay | weekly | monthly | volume | batches | manual
          every: 5,                // divisor/krav beroende på mode
          volumeM3: 150,           // mode volume: 1 kub per X m³
          batchCount: 50,          // mode batches: 1 kub per X satser
          scope: 'strength',       // all | strength
          note: ''
        };
      }
      const sf = SETTINGS.en206.samplingFrequency;
      if (!sf.mode) sf.mode = 'workdays';
      if (!sf.scope) sf.scope = 'strength';
      if (sf.every == null) sf.every = 5;
      if (sf.volumeM3 == null) sf.volumeM3 = 150;
      if (sf.batchCount == null) sf.batchCount = 50;
      if (sf.enabled == null) sf.enabled = true;
      save?.(DB_KEYS.settings, SETTINGS);
    }catch(e){ console.warn('v15 sampling defaults failed', e); }
  }

  function parseISODateOnly(iso){
    if (!iso) return '';
    return String(iso).slice(0,10);
  }

  function isoWeekKey(dateISO){
    try{
      const d = new Date(dateISO + 'T12:00:00');
      const day = d.getDay() || 7;
      d.setDate(d.getDate() + 4 - day);
      const yearStart = new Date(d.getFullYear(),0,1);
      const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
      return d.getFullYear() + '-W' + String(week).padStart(2,'0');
    }catch(_){ return dateISO || ''; }
  }

  function monthKey(dateISO){
    return String(dateISO||'').slice(0,7);
  }

  function recipeGroup(recipeId){
    try { return recipeGroupIdByRecipeId?.(recipeId) || null; }
    catch(_) { return null; }
  }

  function filterBatchesForPeriod({from=null,to=null,strength='',groupId=''}){
    return (window.BATCHES || BATCHES || [])
      .filter(b=>{
        const d = parseISODateOnly(b.dateTime);
        return (!from || d>=from) && (!to || d<=to);
      })
      .filter(b=> !strength || (b.strength||'')===strength)
      .filter(b=> !groupId || recipeGroup(b.recipeId)===groupId);
  }

  function filterCubesForPeriod({from=null,to=null,strength='',groupId='', includeExcluded=false}){
    return (window.CUBES || CUBES || [])
      .filter(c=> includeExcluded || !c.excludeFromEval)
      .filter(c=>{
        const d = parseISODateOnly(c.castDate);
        return (!from || d>=from) && (!to || d<=to);
      })
      .filter(c=> !strength || (c.strengthClass||'')===strength)
      .filter(c=> !groupId || recipeGroup(c.recipeId)===groupId);
  }

  function countRequiredSamples(batches, sf){
    if (!sf || !sf.enabled) return {required:null, basis:'Provfrekvens avstängd'};
    const every = Math.max(1, parseFloat(sf.every || 1));
    const mode = sf.mode || 'weekly';

    if (mode === 'manual') return {required:null, basis:'Manuell bedömning'};

    if (mode === 'workdays'){
      const weekdays = new Set(batches.map(b=>parseISODateOnly(b.dateTime)).filter(Boolean).filter(d=>{ const day = new Date(d + 'T12:00:00').getDay(); return day >= 1 && day <= 5; }));
      return { required: Math.ceil(weekdays.size / every), basis: `${weekdays.size} arbetsdag(ar) med produktion, krav 1 prov per ${every} arbetsdag(ar)` };
    }

    if (mode === 'productionDay'){
      const days = new Set(batches.map(b=>parseISODateOnly(b.dateTime)).filter(Boolean));
      return { required: Math.ceil(days.size / every), basis: `${days.size} produktionsdag(ar), krav 1 prov per ${every} produktionsdag(ar)` };
    }

    if (mode === 'weekly'){
      const weeks = new Set(batches.map(b=>isoWeekKey(parseISODateOnly(b.dateTime))).filter(Boolean));
      return { required: Math.ceil(weeks.size / every), basis: `${weeks.size} produktionsvecka/veckor, krav 1 prov per ${every} vecka/veckor` };
    }

    if (mode === 'monthly'){
      const months = new Set(batches.map(b=>monthKey(parseISODateOnly(b.dateTime))).filter(Boolean));
      return { required: Math.ceil(months.size / every), basis: `${months.size} produktionsmånad(er), krav 1 prov per ${every} månad(er)` };
    }

    if (mode === 'volume'){
      const limit = Math.max(0.001, parseFloat(sf.volumeM3 || 150));
      const totalM3 = batches.reduce((s,b)=> s + (parseFloat(b.amount)||0), 0);
      return { required: Math.ceil(totalM3 / limit), basis: `${totalM3.toFixed(2)} m³, krav 1 prov per ${limit} m³` };
    }

    if (mode === 'batches'){
      const limit = Math.max(1, parseFloat(sf.batchCount || 50));
      return { required: Math.ceil(batches.length / limit), basis: `${batches.length} sats(er), krav 1 prov per ${limit} sats(er)` };
    }

    return {required:null, basis:'Okänd provfrekvens'};
  }

  function samplingLabel(sf){
    if (!sf || !sf.enabled) return 'Provfrekvens avstängd';
    const mode = sf.mode || 'weekly';
    if (mode === 'workdays') return `1 prov per ${sf.every||5} arbetsdag(ar)`;
    if (mode === 'productionDay') return `1 prov per ${sf.every||1} produktionsdag(ar)`;
    if (mode === 'weekly') return `1 prov per ${sf.every||1} produktionsvecka/veckor`;
    if (mode === 'monthly') return `1 prov per ${sf.every||1} produktionsmånad(er)`;
    if (mode === 'volume') return `1 prov per ${sf.volumeM3||150} m³`;
    if (mode === 'batches') return `1 prov per ${sf.batchCount||50} sats(er)`;
    if (mode === 'manual') return 'Manuell provfrekvensbedömning';
    return 'Provfrekvens';
  }

  function assessSamplingFrequency(filters={}){
    ensureSamplingDefaults();
    const sf = SETTINGS.en206.samplingFrequency;

    // Om användaren valt "per hållfasthetsklass" och inget specifikt filter är valt,
    // bedöms varje hållfasthetsklass separat och summeras. Detta motsvarar t.ex.
    // "1 prov per hållfasthet per 5 arbetsdagar".
    if (sf?.enabled && (sf.scope || 'strength') === 'strength' && !filters.strength){
      const allBatches = filterBatchesForPeriod({...filters, strength:''});
      const strengths = Array.from(new Set(allBatches.map(b=>b.strength||'Okänd').filter(Boolean)));
      let totalRequired = 0;
      let totalTaken = 0;
      const rows = [];
      for (const strength of strengths){
        const subFilters = {...filters, strength: strength === 'Okänd' ? '' : strength};
        const batches = strength === 'Okänd'
          ? allBatches.filter(b=>!(b.strength||''))
          : allBatches.filter(b=>(b.strength||'')===strength);
        const cubes = filterCubesForPeriod(subFilters);
        const req = countRequiredSamples(batches, sf);
        const required = req.required || 0;
        const taken = cubes.length;
        totalRequired += required;
        totalTaken += taken;
        rows.push({strength, required, taken, missing: Math.max(0, required - taken), basis:req.basis});
      }
      return {
        ok: totalTaken >= totalRequired,
        taken: totalTaken,
        required: totalRequired,
        missing: Math.max(0, totalRequired - totalTaken),
        batchesCount: allBatches.length,
        batchesM3: allBatches.reduce((s,b)=>s+(parseFloat(b.amount)||0),0),
        basis: rows.length ? rows.map(r=>`${r.strength}: ${r.basis}, prov ${r.taken}/${r.required}`).join(' • ') : 'Ingen produktion i urvalet',
        label: samplingLabel(sf) + ' per hållfasthetsklass',
        settings: {...sf},
        filters,
        byStrength: rows
      };
    }

    const batches = filterBatchesForPeriod(filters);
    const cubes = filterCubesForPeriod(filters);
    const req = countRequiredSamples(batches, sf);
    const taken = cubes.length;
    const required = req.required;
    const ok = required == null ? null : taken >= required;
    return {
      ok,
      taken,
      required,
      missing: required == null ? null : Math.max(0, required - taken),
      batchesCount: batches.length,
      batchesM3: batches.reduce((s,b)=>s+(parseFloat(b.amount)||0),0),
      basis: req.basis,
      label: samplingLabel(sf),
      settings: {...sf},
      filters
    };
  }

  function samplingStatusHTML(result){
    const status = result.ok == null
      ? '<span class="pill warn">Manuell kontroll</span>'
      : result.ok
        ? '<span class="pill ok">OK</span>'
        : '<span class="pill danger">Saknar prov</span>';
    const miss = result.missing ? `<div class="pill danger" style="margin-top:.35rem">Saknar ${result.missing} prov enligt vald frekvens.</div>` : '';
    return `
      <div class="card" id="samplingFrequencyCard">
        <h3>Provfrekvens</h3>
      <div class="pill ok" style="margin-bottom:.5rem">Standardinställning: 1 prov per hållfasthetsklass per 5 arbetsdagar.</div>
        <div class="grid grid-3">
          <div class="kpi"><div>🧪</div><div><div style="font-weight:700">Vald frekvens</div><small class="muted">${escapeHtml(result.label)}</small></div></div>
          <div class="kpi"><div>📦</div><div><div style="font-weight:700">Produktion i urval</div><small class="muted">${result.batchesCount} satser • ${result.batchesM3.toFixed(2)} m³</small></div></div>
          <div class="kpi"><div>✅</div><div><div style="font-weight:700">Status</div><small class="muted">Prov: ${result.taken}${result.required==null?'':' / krav '+result.required}</small></div><div style="margin-left:auto">${status}</div></div>
        </div>
        <div class="pill" style="margin-top:.5rem">Beräkningsgrund: ${escapeHtml(result.basis)}</div>
        ${miss}
        <div class="pill warn" style="margin-top:.35rem">v15: Provfrekvens är ett kontrollstöd. Verifiera vald frekvens mot stationens kontrollplan och tillämpliga krav innan den används som slutligt revisionsunderlag.</div>
      </div>`;
  }

  function getEvalFiltersForSampling(){
    const from = document.getElementById('evalFrom')?.value || null;
    const to = document.getElementById('evalTo')?.value || null;
    const strength = document.getElementById('evalStrength')?.value || '';
    const groupId = document.getElementById('evalGroup')?.value || '';
    return {from,to,strength,groupId};
  }

  function appendSamplingToEvaluation(){
    const body = document.getElementById('evalBody');
    if (!body || body.querySelector('#samplingFrequencyCard')) return;
    const result = assessSamplingFrequency(getEvalFiltersForSampling());
    body.insertAdjacentHTML('afterbegin', samplingStatusHTML(result));
  }

  function addSamplingSettingsBlock(){
    ensureSamplingDefaults();
    const dlg = document.getElementById('settingsDialog');
    const form = document.getElementById('settingsForm');
    if (!form || form.querySelector('#sampling-frequency-block')) return;
    const sf = SETTINGS.en206.samplingFrequency;
    const wrap = document.createElement('div');
    wrap.id = 'sampling-frequency-block';
    wrap.className = 'card';
    wrap.style.marginTop = '12px';
    wrap.innerHTML = `
      <h3>Provfrekvens</h3>
      <div class="pill ok" style="margin-bottom:.5rem">Standardinställning: 1 prov per hållfasthetsklass per 5 arbetsdagar.</div>
      <div class="row" style="margin-bottom:.45rem">
        <label style="display:flex;align-items:center;gap:.5rem">
          <input id="sampling_enabled" type="checkbox"> <span>Aktivera provfrekvenskontroll</span>
        </label>
      </div>
      <div class="grid grid-3">
        <div>
          <label>Frekvenstyp</label>
          <select id="sampling_mode">
            <option value="workdays">Per arbetsdagar (mån–fre)</option>
            <option value="productionDay">Per produktionsdag</option>
            <option value="weekly">Per produktionsvecka</option>
            <option value="monthly">Per produktionsmånad</option>
            <option value="volume">Per m³ producerad betong</option>
            <option value="batches">Per antal satser</option>
            <option value="manual">Manuell bedömning</option>
          </select>
        </div>
        <div>
          <label>Intervall / arbetsdagar</label>
          <input id="sampling_every" type="number" min="1" step="1" value="${sf.every||5}">
        </div>
        <div>
          <label>Omfattning</label>
          <select id="sampling_scope">
            <option value="strength">Per hållfasthetsklass</option>
            <option value="all">All produktion i urvalet</option>
          </select>
        </div>
      </div>
      <div class="grid grid-3" style="margin-top:.45rem">
        <div>
          <label>m³ per prov</label>
          <input id="sampling_volumeM3" type="number" min="0.001" step="0.1" value="${sf.volumeM3||150}">
        </div>
        <div>
          <label>Satser per prov</label>
          <input id="sampling_batchCount" type="number" min="1" step="1" value="${sf.batchCount||50}">
        </div>
        <div>
          <label>Anteckning / kontrollplan</label>
          <input id="sampling_note" value="${escapeHtml(sf.note||'')}" placeholder="t.ex. intern kontrollplan">
        </div>
      </div>
      <div class="pill warn" style="margin-top:.5rem">Välj frekvens efter er kontrollplan. Appen räknar av mot satser och registrerade kubuttag i vald period.</div>`;
    form.appendChild(wrap);
    wrap.querySelector('#sampling_enabled').checked = !!sf.enabled;
    wrap.querySelector('#sampling_mode').value = sf.mode || 'workdays';
    wrap.querySelector('#sampling_scope').value = sf.scope || 'strength';
  }

  function saveSamplingSettingsFromDialog(){
    const dlg = document.getElementById('settingsDialog');
    const g = id => dlg?.querySelector('#'+id);
    if (!g('sampling_mode')) return;
    ensureSamplingDefaults();
    SETTINGS.en206.samplingFrequency = {
      enabled: !!g('sampling_enabled')?.checked,
      mode: g('sampling_mode')?.value || 'workdays',
      every: parseInt(g('sampling_every')?.value || 1) || 1,
      scope: g('sampling_scope')?.value || 'strength',
      volumeM3: parseFloat(g('sampling_volumeM3')?.value || 150) || 150,
      batchCount: parseInt(g('sampling_batchCount')?.value || 50) || 50,
      note: g('sampling_note')?.value || ''
    };
    save?.(DB_KEYS.settings, SETTINGS);
  }

  function renderDashboardSamplingCard(){
    const overview = document.getElementById('overviewCard');
    if (!overview) return;
    let card = document.getElementById('dashboardSamplingCard');
    if (!card){
      card = document.createElement('div');
      card.className = 'card';
      card.id = 'dashboardSamplingCard';
      overview.insertAdjacentElement('beforebegin', card);
    }
    const d = new Date();
    const from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10);
    const to = todayISO();
    const result = assessSamplingFrequency({from,to,strength:'',groupId:''});
    const status = result.ok == null ? '<span class="pill warn">Manuell</span>' : result.ok ? '<span class="pill ok">OK</span>' : '<span class="pill danger">Saknar prov</span>';
    card.innerHTML = `
      <h3>Provfrekvens denna månad</h3>
      <div class="row" style="justify-content:space-between;align-items:center">
        <div><span class="pill">${escapeHtml(result.label)}</span></div>
        <div>${status}</div>
      </div>
      <div class="grid grid-3" style="margin-top:.5rem">
        <div class="kpi"><div>📦</div><div><div style="font-weight:700">Produktion</div><small class="muted">${result.batchesCount} satser • ${result.batchesM3.toFixed(2)} m³</small></div></div>
        <div class="kpi"><div>🧪</div><div><div style="font-weight:700">Kuber</div><small class="muted">${result.taken}${result.required==null?'':' / krav '+result.required}</small></div></div>
        <div class="kpi"><div>⚠️</div><div><div style="font-weight:700">Avvikelse</div><small class="muted">${result.missing? 'Saknar '+result.missing+' prov' : 'Ingen enligt vald frekvens'}</small></div></div>
      </div>`;
  }

  // Exponera för rapporter/felsökning
  V15.assessSamplingFrequency = assessSamplingFrequency;
  V15.samplingStatusHTML = samplingStatusHTML;
  V15.appendSamplingToEvaluation = appendSamplingToEvaluation;

  // Init och hooks
  ensureSamplingDefaults();

  const btnSettings = document.getElementById('btnSettings');
  if (btnSettings){
    btnSettings.addEventListener('click', ()=> setTimeout(addSamplingSettingsBlock, 0));
  }
  const btnSaveSettings = document.getElementById('btnSaveSettings');
  if (btnSaveSettings){
    btnSaveSettings.addEventListener('click', saveSamplingSettingsFromDialog);
  }

  const oldRunEvaluation = window.runEvaluation;
  window.runEvaluation = function(){
    const out = typeof oldRunEvaluation === 'function' ? oldRunEvaluation.apply(this, arguments) : undefined;
    try { appendSamplingToEvaluation(); } catch(e){ console.warn('v15 provfrekvens i utvärdering misslyckades', e); }
    return out;
  };

  const oldRenderDashboard = window.renderDashboard;
  window.renderDashboard = function(){
    const out = typeof oldRenderDashboard === 'function' ? oldRenderDashboard.apply(this, arguments) : undefined;
    try { renderDashboardSamplingCard(); } catch(e){ console.warn('v15 provfrekvens dashboard misslyckades', e); }
    return out;
  };

  // Lägg till i PDF för utvärdering genom att patcha exportEvaluationPDF lätt.
  const oldExportEvaluationPDF = window.exportEvaluationPDF;
  window.exportEvaluationPDF = async function(){
    try { appendSamplingToEvaluation(); } catch(_){ }
    if (typeof oldExportEvaluationPDF === 'function') return oldExportEvaluationPDF.apply(this, arguments);
  };

  // Om dashboard redan är synlig vid laddning.
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=>{ try{ renderDashboardSamplingCard(); }catch(_){} });
  } else {
    try{ renderDashboardSamplingCard(); }catch(_){}
  }
})();
