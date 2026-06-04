/* =========================================================
   BTG Quality Control v19.5.29
   Vecko-/månadsrapporter via förinmatad e-postadress.
   - Veckolista och månadslista byggs från vald fabriks data.
   - Prefab och Beställning redovisas separat.
   - Öppnar utskriftsrapport och ett förifyllt mailto-utkast.
   ========================================================= */
(function(){
  if (window.__btgV19529ReportMailPatch) return;
  window.__btgV19529ReportMailPatch = true;

  const EMAIL_KEY = 'btg_report_email_v1';

  function safeHtml(s){
    try { return (typeof escapeHtml === 'function') ? escapeHtml(String(s ?? '')) : String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
    catch(_) { return String(s ?? ''); }
  }
  function dateObj(value){
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  function dateOnly(value){
    const d = dateObj(value);
    if (!d) return '';
    return d.toISOString().slice(0,10);
  }
  function svDate(value){
    const d = dateObj(value);
    if (!d) return '';
    try { return d.toLocaleDateString('sv-SE'); } catch(_) { return dateOnly(value); }
  }
  function svDateTime(value){
    const d = dateObj(value);
    if (!d) return '';
    try { return d.toLocaleString('sv-SE', { dateStyle:'short', timeStyle:'short' }); } catch(_) { return dateOnly(value); }
  }
  function isoWeekParts(d){
    const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = x.getUTCDay() || 7;
    x.setUTCDate(x.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(x.getUTCFullYear(),0,1));
    const week = Math.ceil((((x - yearStart) / 86400000) + 1) / 7);
    return { year: x.getUTCFullYear(), week };
  }
  function weekKeyFromDate(d){
    const p = isoWeekParts(d);
    return `${p.year}-W${String(p.week).padStart(2,'0')}`;
  }
  function weekRangeFromKey(key){
    const m = String(key||'').match(/^(\d{4})-W(\d{2})$/);
    if (!m) return null;
    const year = Number(m[1]), week = Number(m[2]);
    const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
    const dow = simple.getUTCDay() || 7;
    const monday = new Date(simple);
    if (dow <= 4) monday.setUTCDate(simple.getUTCDate() - dow + 1); else monday.setUTCDate(simple.getUTCDate() + 8 - dow);
    const sunday = new Date(monday); sunday.setUTCDate(monday.getUTCDate()+6);
    return { start: monday.toISOString().slice(0,10), end: sunday.toISOString().slice(0,10) };
  }
  function monthKeyFromDate(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
  function monthRangeFromKey(key){
    const m = String(key||'').match(/^(\d{4})-(\d{2})$/);
    if (!m) return null;
    const y = Number(m[1]), mo = Number(m[2]);
    const start = new Date(Date.UTC(y, mo-1, 1));
    const end = new Date(Date.UTC(y, mo, 0));
    return { start: start.toISOString().slice(0,10), end: end.toISOString().slice(0,10) };
  }
  function productionTypeOf(b){
    const raw = (b?.productionType || b?.app_data?.productionType || b?.app_data?.production_type || b?.source || '').toString().toLowerCase();
    if (raw === 'order' || raw === 'customer_order' || raw.includes('beställ')) return 'order';
    if (raw === 'prefab_queue' || raw === 'prefab' || raw) return 'prefab';
    return 'prefab';
  }
  function rowDate(row, kind){
    if (kind === 'order') return row.dateTime || row.deliveryDate || row.delivery_date || row.app_data?.dateTime || row.app_data?.deliveryDate || row.createdAt || row.created_at;
    return row.dateTime || row.datetime || row.createdAt || row.created_at;
  }
  function inRange(dateValue, start, end){
    const s = dateOnly(dateValue);
    return !!s && s >= start && s <= end;
  }
  function getReportEmail(){ return (localStorage.getItem(EMAIL_KEY) || '').trim(); }
  function setReportEmail(v){ localStorage.setItem(EMAIL_KEY, String(v||'').trim()); }
  function ensureEmail(){
    let email = getReportEmail();
    if (!email){
      email = prompt('Ange mottagarens rapportmailadress:') || '';
      email = email.trim();
      if (email) setReportEmail(email);
    }
    return email;
  }
  function allReportDates(){
    const dates = [];
    try { (BATCHES||[]).forEach(b => { const d = dateObj(rowDate(b,'batch')); if (d) dates.push(d); }); } catch(_) {}
    try { (ORDERS||[]).forEach(o => { const d = dateObj(rowDate(o,'order')); if (d) dates.push(d); }); } catch(_) {}
    return dates;
  }
  function buildWeekOptions(){
    const map = new Map();
    allReportDates().forEach(d => {
      const key = weekKeyFromDate(d), r = weekRangeFromKey(key);
      if (r) map.set(key, `Vecka ${Number(key.slice(-2))}, ${key.slice(0,4)} (${r.start} – ${r.end})`);
    });
    if (!map.size){
      const now = new Date();
      for (let i=0;i<10;i++){
        const d = new Date(now); d.setDate(now.getDate() - i*7);
        const key = weekKeyFromDate(d), r = weekRangeFromKey(key);
        if (r) map.set(key, `Vecka ${Number(key.slice(-2))}, ${key.slice(0,4)} (${r.start} – ${r.end})`);
      }
    }
    return Array.from(map.entries()).sort((a,b)=> b[0].localeCompare(a[0])).map(([value,label])=>({value,label}));
  }
  function buildMonthOptions(){
    const map = new Map();
    allReportDates().forEach(d => {
      const key = monthKeyFromDate(d);
      try { map.set(key, d.toLocaleDateString('sv-SE', {year:'numeric', month:'long'})); }
      catch(_) { map.set(key, key); }
    });
    if (!map.size){
      const now = new Date();
      for (let i=0;i<12;i++){
        const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
        const key = monthKeyFromDate(d);
        try { map.set(key, d.toLocaleDateString('sv-SE', {year:'numeric', month:'long'})); }
        catch(_) { map.set(key, key); }
      }
    }
    return Array.from(map.entries()).sort((a,b)=> b[0].localeCompare(a[0])).map(([value,label])=>({value,label}));
  }
  function getPeriodData(start, end){
    const prefab = [];
    const orderRows = [];
    try {
      (BATCHES||[]).forEach(b => {
        if (!inRange(rowDate(b,'batch'), start, end)) return;
        if (productionTypeOf(b) === 'order') orderRows.push({source:'Tillverkningsjournal', row:b});
        else prefab.push(b);
      });
    } catch(_) {}
    try {
      (ORDERS||[]).forEach(o => {
        if (inRange(rowDate(o,'order'), start, end)) orderRows.push({source:'Beställningsjournal', row:o});
      });
    } catch(_) {}
    prefab.sort((a,b)=> String(rowDate(a,'batch')).localeCompare(String(rowDate(b,'batch'))));
    orderRows.sort((a,b)=> String(rowDate(a.row,'order')).localeCompare(String(rowDate(b.row,'order'))));
    return { prefab, orders: orderRows };
  }
  function num(v, digits=2){ const n = Number(v); return Number.isFinite(n) ? n.toFixed(digits) : ''; }
  function amountOf(r){ return Number(r.amount ?? r.amount_m3 ?? r.amountM3 ?? 0) || 0; }
  function gwpTotalOf(r){ return Number(r.gwpTotal ?? r.gwp_total ?? r.gwp ?? 0) || 0; }
  function periodReportHTML(title, label, start, end, data){
    const meta = (typeof reportMetaHTML === 'function') ? reportMetaHTML(`${label}: ${start} – ${end}`) : `<div class="meta">Period: ${safeHtml(start)} – ${safeHtml(end)}</div>`;
    const prefabTotal = data.prefab.reduce((s,r)=>s+amountOf(r),0);
    const orderTotal = data.orders.reduce((s,x)=>s+amountOf(x.row),0);
    const prefabRows = data.prefab.map(b => `<tr>
      <td>${safeHtml(svDateTime(rowDate(b,'batch')))}</td><td>${safeHtml(b.recipeName || '')}</td><td>${safeHtml(b.strength || '')}</td>
      <td class="right">${num(amountOf(b),2)}</td><td class="right">${num(b.vct,3)}</td><td class="right">${num(b.vctEq,3)}</td><td class="right">${num(gwpTotalOf(b),1)}</td>
    </tr>`).join('') || '<tr><td colspan="7">Inga prefab-poster i vald period.</td></tr>';
    const orderRows = data.orders.map(x => { const r = x.row; return `<tr>
      <td>${safeHtml(svDateTime(rowDate(r,'order')))}</td><td>${safeHtml(x.source)}</td><td>${safeHtml(r.customerName || r.customer_name || '')}</td><td>${safeHtml(r.recipeName || '')}</td><td>${safeHtml(r.strength || '')}</td>
      <td class="right">${num(amountOf(r),2)}</td><td class="right">${num(r.vct,3)}</td><td class="right">${num(r.vctEq,3)}</td><td class="right">${num(gwpTotalOf(r),1)}</td><td>${safeHtml(r.orderInfo || r.note || '')}</td>
    </tr>`; }).join('') || '<tr><td colspan="10">Inga beställningsposter i vald period.</td></tr>';
    return `<h1>${safeHtml(title)}</h1>${meta}
      <h2>Sammanfattning</h2>
      <table><thead><tr><th>Del</th><th class="right">Antal poster</th><th class="right">Mängd (m³)</th></tr></thead><tbody>
        <tr><td>Prefab</td><td class="right">${data.prefab.length}</td><td class="right">${prefabTotal.toFixed(2)}</td></tr>
        <tr><td>Beställning</td><td class="right">${data.orders.length}</td><td class="right">${orderTotal.toFixed(2)}</td></tr>
        <tr><td><b>Totalt</b></td><td class="right"><b>${data.prefab.length + data.orders.length}</b></td><td class="right"><b>${(prefabTotal+orderTotal).toFixed(2)}</b></td></tr>
      </tbody></table>
      <h2>Prefab – tillverkningsjournal</h2>
      <table><thead><tr><th>Datum</th><th>Recept</th><th>Hållfasthet</th><th class="right">Mängd (m³)</th><th class="right">VCT</th><th class="right">VCT ekv</th><th class="right">GWP total</th></tr></thead><tbody>${prefabRows}</tbody></table>
      <h2>Beställning – tillverkningsjournal</h2>
      <table><thead><tr><th>Datum</th><th>Källa</th><th>Kund</th><th>Recept</th><th>Hållfasthet</th><th class="right">Mängd (m³)</th><th class="right">VCT</th><th class="right">VCT ekv</th><th class="right">GWP total</th><th>Övrigt</th></tr></thead><tbody>${orderRows}</tbody></table>`;
  }
  function periodReportText(title, start, end, data){
    const lines = [];
    const prefabTotal = data.prefab.reduce((s,r)=>s+amountOf(r),0);
    const orderTotal = data.orders.reduce((s,x)=>s+amountOf(x.row),0);
    lines.push(title, `Period: ${start} – ${end}`, '');
    lines.push(`Prefab: ${data.prefab.length} poster, ${prefabTotal.toFixed(2)} m³`);
    lines.push(`Beställning: ${data.orders.length} poster, ${orderTotal.toFixed(2)} m³`);
    lines.push(`Totalt: ${(prefabTotal+orderTotal).toFixed(2)} m³`, '');
    lines.push('PREFAB');
    if (!data.prefab.length) lines.push('Inga prefab-poster i vald period.');
    data.prefab.forEach(b => lines.push(`${svDateTime(rowDate(b,'batch'))} | ${b.recipeName||''} | ${b.strength||''} | ${num(amountOf(b),2)} m³ | VCT ${num(b.vct,3)} | VCTekv ${num(b.vctEq,3)} | GWP ${num(gwpTotalOf(b),1)}`));
    lines.push('', 'BESTÄLLNING');
    if (!data.orders.length) lines.push('Inga beställningsposter i vald period.');
    data.orders.forEach(x => { const r = x.row; lines.push(`${svDateTime(rowDate(r,'order'))} | ${x.source} | ${r.customerName||r.customer_name||''} | ${r.recipeName||''} | ${r.strength||''} | ${num(amountOf(r),2)} m³ | VCT ${num(r.vct,3)} | VCTekv ${num(r.vctEq,3)} | GWP ${num(gwpTotalOf(r),1)} | ${r.orderInfo||r.note||''}`); });
    return lines.join('\n');
  }
  function openMail(email, subject, body){
    const maxBody = 16000;
    let finalBody = body;
    if (finalBody.length > maxBody) finalBody = finalBody.slice(0, maxBody) + '\n\nRapporten är för lång för mailutkastet och har kortats. Använd utskriftsfönstret för komplett rapport/PDF.';
    const href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(finalBody)}`;
    window.location.href = href;
  }
  async function createAndEmailReport(kind, value){
    const email = ensureEmail();
    if (!email) { alert('Ingen rapportmailadress angiven.'); return; }
    if (typeof ensureFreshCloudDataForReport === 'function'){
      const ok = await ensureFreshCloudDataForReport(kind === 'week' ? 'veckorapport' : 'månadsrapport');
      if (!ok) return;
    }
    const range = kind === 'week' ? weekRangeFromKey(value) : monthRangeFromKey(value);
    if (!range) { alert('Kunde inte tolka vald period.'); return; }
    const data = getPeriodData(range.start, range.end);
    let monthLabel = value;
    if (kind !== 'week') {
      const mr = String(value).match(/^(\d{4})-(\d{2})$/);
      if (mr) {
        const md = new Date(Number(mr[1]), Number(mr[2])-1, 1);
        try { monthLabel = md.toLocaleDateString('sv-SE', {year:'numeric', month:'long'}); } catch(_) {}
      }
    }
    const title = kind === 'week'
      ? `Veckorapport för vecka ${Number(value.slice(-2))} ${value.slice(0,4)}`
      : `Månadsrapport för ${monthLabel}`;
    const html = periodReportHTML(title, kind === 'week' ? 'Vecka' : 'Månad', range.start, range.end, data);
    if (typeof openPrintWindow === 'function') openPrintWindow(title, html);
    else {
      const w = window.open('', '_blank');
      if (w) w.document.write('<!doctype html><meta charset="utf-8"><title>'+safeHtml(title)+'</title>'+html);
    }
    openMail(email, title, periodReportText(title, range.start, range.end, data));
  }
  function ensureDialog(){
    if (document.getElementById('btgReportMailDialog')) return;
    const dlg = document.createElement('dialog');
    dlg.id = 'btgReportMailDialog';
    dlg.innerHTML = `<form method="dialog" class="container" novalidate>
      <div class="row" style="justify-content:space-between;align-items:center;"><h3 id="btgReportMailTitle">Rapport till mail</h3><button type="button" class="btn secondary" data-close>Stäng</button></div>
      <div class="grid grid-2">
        <div><label>Rapportmailadress</label><input id="btgReportMailEmail" type="email" placeholder="namn@foretag.se"></div>
        <div><label id="btgReportPeriodLabel">Period</label><select id="btgReportPeriodSelect"></select></div>
      </div>
      <p class="pill" style="margin-top:.6rem">Appen öppnar rapporten som utskrifts-/PDF-fönster och skapar samtidigt ett förifyllt mailutkast till vald adress.</p>
      <div class="row" style="justify-content:flex-end;margin-top:.8rem;gap:.5rem"><button type="button" class="btn secondary" data-save-email>Spara adress</button><button type="button" class="btn" data-send>Skapa rapport + mail</button></div>
    </form>`;
    document.body.appendChild(dlg);
    dlg.querySelector('[data-close]')?.addEventListener('click', ()=> dlg.close());
    dlg.querySelector('[data-save-email]')?.addEventListener('click', ()=> { setReportEmail(document.getElementById('btgReportMailEmail')?.value || ''); alert('Rapportmailadress sparad.'); });
    dlg.querySelector('[data-send]')?.addEventListener('click', async ()=> {
      setReportEmail(document.getElementById('btgReportMailEmail')?.value || '');
      const kind = dlg.dataset.kind || 'week';
      const value = document.getElementById('btgReportPeriodSelect')?.value;
      if (!value) { alert('Välj period.'); return; }
      dlg.close();
      await createAndEmailReport(kind, value);
    });
  }
  function openReportDialog(kind){
    ensureDialog();
    const dlg = document.getElementById('btgReportMailDialog');
    const title = document.getElementById('btgReportMailTitle');
    const label = document.getElementById('btgReportPeriodLabel');
    const sel = document.getElementById('btgReportPeriodSelect');
    dlg.dataset.kind = kind;
    if (title) title.textContent = kind === 'week' ? 'Veckorapport till mail' : 'Månadsrapport till mail';
    if (label) label.textContent = kind === 'week' ? 'Välj vecka' : 'Välj månad';
    const opts = kind === 'week' ? buildWeekOptions() : buildMonthOptions();
    if (sel) sel.innerHTML = opts.map(o => `<option value="${safeHtml(o.value)}">${safeHtml(o.label)}</option>`).join('');
    const emailInput = document.getElementById('btgReportMailEmail');
    if (emailInput) emailInput.value = getReportEmail();
    try { dlg.showModal(); } catch(_) { dlg.setAttribute('open',''); }
  }
  function addButtons(){
    const batchToolbar = document.querySelector('#tab-tillverkning .card:nth-of-type(3) .toolbar');
    if (batchToolbar && !document.getElementById('btnWeeklyMailReport')){
      const w = document.createElement('button'); w.type='button'; w.className='btn secondary'; w.id='btnWeeklyMailReport'; w.textContent='Veckorapport';
      const m = document.createElement('button'); m.type='button'; m.className='btn secondary'; m.id='btnMonthlyMailReport'; m.textContent='Månadsrapport';
      w.addEventListener('click', ()=> openReportDialog('week'));
      m.addEventListener('click', ()=> openReportDialog('month'));
      batchToolbar.appendChild(w); batchToolbar.appendChild(m);
    }
  }
  function patchSettingsEmail(){
    const form = document.getElementById('settingsForm');
    if (!form || document.getElementById('settingsReportEmailRow')) return;
    const anchor = form.querySelector('.grid.grid-2');
    if (!anchor) return;
    const div = document.createElement('div');
    div.id = 'settingsReportEmailRow';
    div.innerHTML = `<label>Förinmatad rapportmailadress</label><input id="settingsReportEmail" type="email" placeholder="namn@foretag.se">`;
    anchor.appendChild(div);
    const fill = () => { const input = document.getElementById('settingsReportEmail'); if (input) input.value = getReportEmail(); };
    fill();
    document.getElementById('btnSettings')?.addEventListener('click', ()=> setTimeout(fill, 50));
    document.getElementById('btnSaveSettings')?.addEventListener('click', ()=> {
      const input = document.getElementById('settingsReportEmail');
      if (input) setReportEmail(input.value);
    }, true);
  }
  function init(){
    ensureDialog();
    addButtons();
    patchSettingsEmail();
    setTimeout(addButtons, 700);
    setTimeout(addButtons, 1800);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
