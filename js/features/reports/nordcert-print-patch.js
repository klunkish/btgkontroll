(function(){
  const patchOnce = () => {
    if (!window.openPrintWindow || window._patchedNordcert) return;
    const origOpen = window.openPrintWindow;
    window.openPrintWindow = function(title, html){
      try {
        if (title === 'Nordcert-rapport'){
          const cfg = (window.SETTINGS && SETTINGS.en206) ? SETTINGS.en206 : { kSigma:1.48, indivMinDeltaMPa:4, ageNominal:28, ageTolerance:2, includeOutOfAge:false };
          const get = id => document.getElementById(id);
          const from = get('ncFrom')?.value || null;
          const to   = get('ncTo')?.value || null;
          const strength = get('ncStrength')?.value || '';
          const groupId  = get('ncGroup')?.value || '';
          const includeOut = !!get('ncIncludeOutAge')?.checked;

          const all = (window.cubesForEvaluation ? cubesForEvaluation({from,to,strengthClass:strength,groupId,ageDays:null}) : []);
          const ageFiltered = (includeOut || cfg.includeOutOfAge) ? all : all.filter(c => {
            const age = Number(c.cureDays ?? c.age ?? 28);
            return Number.isFinite(age) && Math.abs(age - (cfg.ageNominal||28)) <= (cfg.ageTolerance||2);
          });
          const valid = ageFiltered
            .map(c => ({ c, fck: parseFckFromStrength(String(c.strengthClass||'')) }))
            .filter(o => o.fck!=null && Number.isFinite(o.c?.resultMPa));

          const cubesOnly = valid.map(o => o.c);
          const wins = (window.rollingWindows ? rollingWindows(cubesOnly, Math.max(3, cfg.window||15)) : []);

          const sigmaRef = computeSigmaRef({from,to,strength,groupId,includeOut,cfg});
const fails = [];
          const winResults = wins.map((w,i) => {
            const r = window.windowPass ? windowPass(w, {...cfg, _sigmaRef: sigmaRef}) : {ok:true, meanOk:true, indivOk:true, mean:NaN, sd:NaN, n:w.length};
            if (!r.ok) {
              const reason = !r.meanOk ? 'Medelkrav (x̄−k·σ)' : 'Individkrav (fci < fck − 4)';
              fails.push({i:i+1, mean:r.mean, sd:r.sd, n:r.n, reason});
            
    // Build "Ingick i utvärderingen" table (all valid cubes)
    const includedRows = valid.map((o, idx) => {
      const c = o.c, fck = o.fck;
      const delta = (Number.isFinite(c.resultMPa) && fck!=null) ? (c.resultMPa - fck) : NaN;
      const okInd = Number.isFinite(c.resultMPa) && fck!=null && (c.resultMPa >= (fck - (cfg.indivMinDeltaMPa ?? 4)));
      return `<tr>
        <td>${idx+1}</td>
        <td>${(c.testId||c.batchId||'—')}</td>
        <td>${fmtOnlyDate(c.castDate)}</td>
        <td>${escapeHtml(c.recipeCode||c.recipeName||'')}</td>
        <td>${escapeHtml(c.strengthClass||'')}</td>
        <td class="right">${Number.isFinite(fck)? fck.toFixed(0) : '—'}</td>
        <td class="right">${Number.isFinite(c.resultMPa)? c.resultMPa.toFixed(2) : '—'}</td>
        <td class="right">${Number.isFinite(delta)? delta.toFixed(2) : '—'}</td>
        <td>${okInd ? 'OK' : 'EJ'}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="9">Inga prov uppfyllde urvalet.</td></tr>';

    const includedHTML = `<div class="card"><h3>Ingick i utvärderingen</h3>
      <div class="muted">Urval: ${from||'—'} – ${to||'—'} • Klass: ${escapeHtml(strength||'alla')} • Grupp: ${escapeHtml(groupId||'alla')} • Ålder: ${ (includeOut || cfg.includeOutOfAge) ? 'alla' : ( (cfg.ageNominal||28)+'±'+(cfg.ageTolerance||2)+' d' ) } • n=${valid.length}</div>
      <table style="margin-top:.4rem">
        <thead><tr>
          <th>Nr</th><th>Prov.bet.</th><th>Datum</th><th>Receptkod</th><th>C-klass</th>
          <th class="right">f<sub>ck</sub></th><th class="right">MPa</th><th class="right">Δ=MPa−f<sub>ck</sub></th><th>Individ</th>
        </tr></thead>
        <tbody>${includedRows}</tbody>
      </table>
    </div>`;
}
            return {index:i+1, span: `${fmtOnlyDate(w[0].castDate)} – ${fmtOnlyDate(w[w.length-1].castDate)}`, ...r};
          });

          const overall = fails.length? '<span class="pill danger">EJ GODKÄND</span>' : '<span class="pill ok">GODKÄND</span>';
          const why = fails.length? ('<ul>'+fails.map(f=>'<li>Fönster #'+f.i+': '+f.reason+' (x̄='+ (f.mean||0).toFixed(2) +', s='+(f.sd||0).toFixed(2)+', n='+f.n+')</li>').join('')+'</ul>') : '<div>Inga överträdelser.</div>';
          const kUsed = (cfg.kSigma ?? 1.48);
          const fckSrc = (cfg.fckSource || 'parse');
          const sigmaTxt = (Number.isFinite(sigmaRef) ? sigmaRef.toFixed(2)+' MPa' : '—');
          const meta = `<div class="muted" style="margin-top:.35rem">σRef: ${sigmaTxt} (källa: ${cfg.sigmaSource||'latest35'}) &nbsp;•&nbsp; k: ${kUsed} &nbsp;•&nbsp; f<sub>ck</sub>-källa: ${fckSrc}</div>`;
          const style = `<style>
            .nc-pass{border-left:4px solid #2e7d32; padding-left:.5rem;}
            .nc-fail{border-left:4px solid #c62828; padding-left:.5rem;}
            .nc-head .pill{margin-left:.5rem;}
            .appendix .card{page-break-inside:avoid}
          </style>`;
          const colorizeScript = `<script>(function(){try{
            document.querySelectorAll('table tr').forEach(tr=>{
              const t = tr.innerText || '';
              if (/FAIL/i.test(t)) tr.classList.add('nc-fail');
              else if (/PASS/i.test(t)) tr.classList.add('nc-pass');
            });
          }catch(e){}})();<\/script>`;
          const head = style + '<div class="card nc-head"><h3>Utvärderingsresultat</h3><div>'+overall+'</div>'+why+ meta +'</div>' + colorizeScript;

          // Appendix (default on unless explicit checkbox off)
          const wantAppendix = (get('ncAppendix') ? get('ncAppendix').checked : true);
          let appendixHTML = '';
          if (wantAppendix && wins.length){
            const fmt = (x,d=2)=> (x==null||!isFinite(x))? '—' : Number(x).toFixed(d);
            const esc = (s)=> String(s==null?'':s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m]));
            const appendix = winResults.map((wr, idx)=>{
              const w = wins[idx];
              const rows = w.map((c,j)=>{
                const fck = parseFckFromStrength(String(c.strengthClass||''));
                const delta = (Number.isFinite(c.resultMPa) && fck!=null) ? (c.resultMPa - fck) : null;
                return `<tr><td>${idx+1}.${j+1}</td><td>${fmtOnlyDate(c.castDate)}</td><td>${esc(c.strengthClass||'')}</td><td class="right">${fmt(fck,0)}</td><td class="right">${fmt(c.resultMPa,2)}</td><td class="right">${fmt(delta,2)}</td></tr>`;
              }).join('') || '<tr><td colspan="6">—</td></tr>';
              const critMean = cfg.useSigma ? `x̄ − k·σRef = ${fmt(wr.mean,2)} − ${fmt(kUsed,2)}·${fmt(sigmaRef,2)} = ${fmt(wr.mean - kUsed * (isFinite(sigmaRef)? sigmaRef : wr.sd),2)} ≥ 0` : `x̄ = ${fmt(wr.mean,2)} ≥ ${fmt(cfg.meanMarginMPa||0,2)} MPa`;
              const critInd = `min(cᵢ − fckᵢ) ≥ −${fmt(cfg.indivMinDeltaMPa??4,0)} MPa`;
              const passMean = (wr.meanOk ? 'PASS' : 'FAIL');
              const passInd  = (wr.indivOk ? 'PASS' : 'FAIL');
              return `
                <div class="card" style="margin-top:.6rem">
                  <h4>Fönster #${idx+1} <small>${wr.span}</small></h4>
                  <div class="muted">n=${wr.n}</div>
                  <table style="margin-top:.4rem">
                    <thead><tr><th>#</th><th>Datum</th><th>Klass</th><th class="right">f<sub>ck</sub></th><th class="right">MPa</th><th class="right">Δ=MPa−f<sub>ck</sub></th></tr></thead>
                    <tbody>${rows}</tbody>
                  </table>
                  <div style="margin-top:.35rem">
                    <div>Medel x̄ = ${fmt(wr.mean,2)} MPa, s = ${fmt(wr.sd,2)} MPa</div>
                    <div>Medelkrav: ${critMean} → <b>${passMean}</b></div>
                    <div>Individkrav: ${critInd} → <b>${passInd}</b></div>
                  </div>
                </div>`;
            }).join('');
            const appendixHead = `<div class="card"><h3>Beräkningsbilaga (EN 206)</h3>
              <div class="muted">Metod: ${en206MethodLabel(cfg.method)} &nbsp;•&nbsp; σRef: ${Number.isFinite(sigmaRef)? sigmaRef.toFixed(2)+' MPa' : '—'} &nbsp;•&nbsp; k: ${kUsed} &nbsp;•&nbsp; Individkrav: −${cfg.indivMinDeltaMPa??4} MPa</div>
            </div>`;
            appendixHTML = '<div class="appendix">' + appendixHead + appendix + '</div>';
          }
          
// Insert head + appendix directly **after** the report's own header
(function(){
  try{
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    // Heuristics: first header element
    const target = wrap.querySelector('h1, .report-header, .card h1, h2');
    const fragHtml = head + includedHTML + (appendixHTML || '');
    if (target && target.parentNode){
      const range = document.createRange();
      range.setStartAfter(target);
      target.parentNode.insertBefore(range.createContextualFragment(fragHtml), target.nextSibling);
    } else {
      wrap.insertAdjacentHTML('afterbegin', fragHtml);
    }
    html = wrap.innerHTML;
  }catch(_){ html = head + (appendixHTML||'') + html; }
})();

        }
      } catch(e){ /* swallow to not break printing */ }
      return origOpen.call(this, title, html);
    };
    window._patchedNordcert = true;
  };
  // Run patch ASAP
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', patchOnce);
  else patchOnce();
})();
