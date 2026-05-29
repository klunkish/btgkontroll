
/* BTG QC v19.5.36 – Systemcenter Applikationsekonomi */
(function(){
  'use strict';
  const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const num=v=>Number(v||0)||0;
  const money=v=>new Intl.NumberFormat('sv-SE',{style:'currency',currency:'SEK',maximumFractionDigits:0}).format(num(v));
  const pct=v=>`${(num(v)).toLocaleString('sv-SE',{maximumFractionDigits:1})}%`;
  const db=()=>window.sb||window.supabaseClient||null;
  const state={tab:'overview',settings:null,costs:[],plans:[],usage:null,scenario:{growth:0,discount:0}};

  function isSuperadmin(){
    const e=String(window.CURRENT_USER?.email||window.BTG_SYSTEM_CENTER?.state?.authEmail||'').toLowerCase();
    return !!(window.BTG_SYSTEM_CENTER?.state?.canAccess || e==='j.ottosson53@gmail.com' || String(window.BTG_ACCESS_STATE?.profile?.role||window.BTG_ACTIVE_ROLE||'').toUpperCase().includes('SUPER'));
  }
  async function rpc(name,args){
    const client=db(); if(!client) throw new Error('Supabase-klient saknas');
    const {data,error}=await client.rpc(name,args||{});
    if(error) throw error;
    return data;
  }

  function ensureDialog(){
    let dlg=$('#scAppEconomyDialog'); if(dlg) return dlg;
    dlg=document.createElement('dialog');
    dlg.id='scAppEconomyDialog'; dlg.className='sc-app-econ-modal';
    dlg.innerHTML=`<div class="sc-app-econ-inner">
      <div class="sc-app-econ-head">
        <div>
          <h3>Applikationsekonomi</h3>
          <p class="sc-app-econ-sub">Intern ekonomi för själva BTG QC-systemet: driftkostnader, support, utveckling, prisförslag, break-even och möjlig intäkt.</p>
        </div>
        <div class="sc-app-econ-toolbar">
          <button class="btn secondary" type="button" id="scAppEconRefresh">Uppdatera</button>
          <button class="btn" type="button" id="scAppEconReport">Rapport</button>
          <button class="btn secondary" type="button" data-sc-app-econ-close>Stäng</button>
        </div>
      </div>
      <div class="sc-app-econ-tabs">
        <button class="sc-app-econ-tab active" data-app-econ-tab="overview">Översikt</button>
        <button class="sc-app-econ-tab" data-app-econ-tab="costs">Kostnader</button>
        <button class="sc-app-econ-tab" data-app-econ-tab="plans">Prisplaner</button>
        <button class="sc-app-econ-tab" data-app-econ-tab="pricing">Prisförslag</button>
        <button class="sc-app-econ-tab" data-app-econ-tab="report">Rapport</button>
      </div>
      <div id="scAppEconBody"></div>
    </div>`;
    document.body.appendChild(dlg);
    dlg.addEventListener('click',e=>{if(e.target.matches('[data-sc-app-econ-close]')) dlg.close();});
    dlg.addEventListener('click',e=>{
      const tab=e.target.closest('[data-app-econ-tab]');
      if(tab){state.tab=tab.dataset.appEconTab; render();}
    });
    $('#scAppEconRefresh',dlg)?.addEventListener('click',loadAndRender);
    $('#scAppEconReport',dlg)?.addEventListener('click',()=>{state.tab='report';render();});
    return dlg;
  }

  async function open(){
    if(!isSuperadmin()) return alert('Endast superadmin kan öppna Applikationsekonomi.');
    const dlg=ensureDialog();
    await loadAndRender();
    if(typeof dlg.showModal==='function') dlg.showModal(); else dlg.setAttribute('open','open');
  }

  async function loadAndRender(){
    try{
      const data=await rpc('btg_systemcenter_app_economy_get',{});
      state.settings=data?.settings||{};
      state.costs=Array.isArray(data?.costs)?data.costs:[];
      state.plans=Array.isArray(data?.plans)?data.plans:[];
      state.usage=data?.usage||{};
    }catch(err){
      console.warn(err);
      alert('Kunde inte ladda applikationsekonomi: '+(err.message||err));
    }
    render();
  }

  function calc(){
    const factories=num(state.usage?.factories_total);
    const active=num(state.usage?.active_factories);
    const users=num(state.usage?.users_total);
    const costs=state.costs.filter(c=>c.is_active!==false);
    const fixed=costs.filter(c=>String(c.cost_type||'fixed')==='fixed').reduce((s,c)=>s+num(c.monthly_amount),0);
    const variablePerFactory=costs.filter(c=>String(c.cost_type)==='per_factory').reduce((s,c)=>s+num(c.monthly_amount),0);
    const variablePerUser=costs.filter(c=>String(c.cost_type)==='per_user').reduce((s,c)=>s+num(c.monthly_amount),0);
    const variable=variablePerFactory*active + variablePerUser*users;
    const totalCost=fixed+variable;
    const targetMargin=num(state.settings?.target_margin_percent||35);
    const tax=num(state.settings?.vat_percent||25);
    const recommendedNet=active ? (totalCost/active)/(1-targetMargin/100) : 0;
    const recommendedGross=recommendedNet*(1+tax/100);
    const revenue=state.plans.reduce((s,p)=>{
      const count=num(p.assigned_factories||0);
      return s + count*num(p.monthly_price);
    },0);
    const profit=revenue-totalCost;
    const margin=revenue?profit/revenue*100:0;
    const breakEvenFactories=recommendedNet?Math.ceil(totalCost/recommendedNet):0;
    return {factories,active,users,fixed,variable,totalCost,targetMargin,tax,recommendedNet,recommendedGross,revenue,profit,margin,breakEvenFactories};
  }

  function render(){
    const dlg=ensureDialog(); const body=$('#scAppEconBody',dlg); if(!body) return;
    $$('.sc-app-econ-tab',dlg).forEach(b=>b.classList.toggle('active',b.dataset.appEconTab===state.tab));
    body.innerHTML = {
      overview: renderOverview,
      costs: renderCosts,
      plans: renderPlans,
      pricing: renderPricing,
      report: renderReport
    }[state.tab]?.() || renderOverview();
    bindBody();
  }

  function kpi(label,value,note,cls=''){return `<div class="sc-app-econ-kpi ${cls}"><div class="label">${esc(label)}</div><div class="value">${value}</div><div class="note">${esc(note||'')}</div></div>`}
  function renderOverview(){
    const c=calc();
    return `<div class="sc-app-econ-kpis">
      ${kpi('Månadskostnad',money(c.totalCost),'fast + rörlig drift','warn')}
      ${kpi('Intäkt / månad',money(c.revenue),'baserat på prisplaner','good')}
      ${kpi('Resultat / månad',money(c.profit),`marginal ${pct(c.margin)}`,c.profit>=0?'good':'bad')}
      ${kpi('Prisförslag / fabrik',money(c.recommendedNet),'exkl. moms / månad','')}
      ${kpi('Break-even',`${c.breakEvenFactories} fabriker`,'vid rekommenderat pris','')}
    </div>
    <div class="sc-app-econ-grid">
      <div class="sc-app-econ-card"><h4>Kostnad vs intäkt</h4>${chartCostRevenue(c)}</div>
      <div class="sc-app-econ-card"><h4>Systemnyckeltal</h4>
        <table class="sc-app-econ-table"><tbody>
          <tr><td>Fabriker totalt</td><td class="money">${c.factories}</td></tr>
          <tr><td>Aktiva fabriker</td><td class="money">${c.active}</td></tr>
          <tr><td>Användare totalt</td><td class="money">${c.users}</td></tr>
          <tr><td>Fast kostnad</td><td class="money">${money(c.fixed)}</td></tr>
          <tr><td>Rörlig kostnad</td><td class="money">${money(c.variable)}</td></tr>
          <tr><td>Rek. pris inkl. moms</td><td class="money">${money(c.recommendedGross)}</td></tr>
        </tbody></table>
      </div>
    </div>`;
  }

  function chartCostRevenue(c){
    const vals=[{l:'Kostnad',v:c.totalCost,cls:'cost'},{l:'Intäkt',v:c.revenue,cls:''},{l:'Resultat',v:Math.abs(c.profit),cls:c.profit>=0?'profit':'cost'}];
    const max=Math.max(1,...vals.map(x=>x.v));
    return `<div class="sc-app-econ-chart">${vals.map(x=>`<div class="sc-app-econ-bar-group"><div class="sc-app-econ-bars"><div class="sc-app-econ-bar ${x.cls}" style="height:${Math.max(4,x.v/max*145)}px" title="${esc(x.l)} ${esc(money(x.v))}"></div></div><div class="sc-app-econ-bar-label">${esc(x.l)}</div></div>`).join('')}</div>`;
  }

  function renderCosts(){
    return `<div class="sc-app-econ-card">
      <h4>Lägg till / ändra kostnad</h4>
      <form id="scAppEconCostForm" class="sc-app-econ-form">
        <input type="hidden" id="scCostId">
        <label>Namn<input id="scCostName" required placeholder="Supabase, domän, support…"></label>
        <label>Kategori<select id="scCostCategory"><option>Hosting</option><option>Databas</option><option>Domän</option><option>Utveckling</option><option>Support</option><option>Licenser</option><option>Övrigt</option></select></label>
        <label>Typ<select id="scCostType"><option value="fixed">Fast/månad</option><option value="per_factory">Per aktiv fabrik/månad</option><option value="per_user">Per användare/månad</option></select></label>
        <label>Belopp / månad<input id="scCostAmount" type="number" step="0.01" min="0" required></label>
        <label style="grid-column:1/-1">Notering<input id="scCostNote" placeholder="valfritt"></label>
        <div class="sc-app-econ-actions" style="grid-column:1/-1"><button class="btn secondary" type="reset">Rensa</button><button class="btn" type="submit">Spara kostnad</button></div>
      </form>
    </div>
    <div class="sc-app-econ-card" style="margin-top:14px"><h4>Registrerade kostnader</h4>${costTable()}</div>`;
  }

  function costTable(){
    const rows=state.costs||[];
    if(!rows.length) return `<div class="sc-app-econ-empty">Inga kostnader inlagda ännu.</div>`;
    return `<div class="sc-app-econ-table-wrap"><table class="sc-app-econ-table"><thead><tr><th>Namn</th><th>Kategori</th><th>Typ</th><th class="money">Belopp/mån</th><th>Notering</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${esc(r.name)}</b></td><td>${esc(r.category||'')}</td><td><span class="sc-app-econ-pill ${esc(r.cost_type)}">${esc(typeLabel(r.cost_type))}</span></td><td class="money">${money(r.monthly_amount)}</td><td>${esc(r.note||'')}</td><td class="money"><button class="btn secondary" data-edit-cost="${esc(r.id)}">Ändra</button></td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderPlans(){
    return `<div class="sc-app-econ-card">
      <h4>Prisplan</h4>
      <form id="scAppEconPlanForm" class="sc-app-econ-form">
        <input type="hidden" id="scPlanId">
        <label>Namn<input id="scPlanName" required placeholder="Basic, Standard, Pro…"></label>
        <label>Månadspris exkl. moms<input id="scPlanPrice" type="number" step="1" min="0" required></label>
        <label>Antal fabriker<input id="scPlanFactories" type="number" step="1" min="0" value="0"></label>
        <label>Max användare<input id="scPlanMaxUsers" type="number" step="1" min="0" value="0"></label>
        <label style="grid-column:1/-1">Beskrivning<input id="scPlanDesc" placeholder="vad ingår i planen"></label>
        <div class="sc-app-econ-actions" style="grid-column:1/-1"><button class="btn secondary" type="reset">Rensa</button><button class="btn" type="submit">Spara plan</button></div>
      </form>
    </div>
    <div class="sc-app-econ-card" style="margin-top:14px"><h4>Prisplaner och möjlig intäkt</h4>${planTable()}</div>`;
  }

  function planTable(){
    const rows=state.plans||[];
    if(!rows.length) return `<div class="sc-app-econ-empty">Inga prisplaner inlagda ännu.</div>`;
    return `<div class="sc-app-econ-table-wrap"><table class="sc-app-econ-table"><thead><tr><th>Plan</th><th class="money">Pris/mån</th><th class="money">Fabriker</th><th class="money">Månadsintäkt</th><th>Beskrivning</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${esc(r.name)}</b></td><td class="money">${money(r.monthly_price)}</td><td class="money">${num(r.assigned_factories)}</td><td class="money">${money(num(r.monthly_price)*num(r.assigned_factories))}</td><td>${esc(r.description||'')}</td><td class="money"><button class="btn secondary" data-edit-plan="${esc(r.id)}">Ändra</button></td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderPricing(){
    const c=calc();
    return `<div class="sc-app-econ-note">
      Prisförslaget räknas från aktuell månadskostnad, antal aktiva fabriker och önskad marginal. Du kan ändra målmarginal och moms nedan.
    </div>
    <div class="sc-app-econ-card">
      <form id="scAppEconSettingsForm" class="sc-app-econ-form">
        <label>Målmarginal %<input id="scTargetMargin" type="number" step="1" min="0" max="90" value="${esc(state.settings?.target_margin_percent??35)}"></label>
        <label>Moms %<input id="scVatPercent" type="number" step="1" min="0" max="50" value="${esc(state.settings?.vat_percent??25)}"></label>
        <label>Minsta pris / fabrik<input id="scMinPrice" type="number" step="1" min="0" value="${esc(state.settings?.min_monthly_price??0)}"></label>
        <label>Önskat supportpåslag %<input id="scSupportMarkup" type="number" step="1" min="0" max="100" value="${esc(state.settings?.support_markup_percent??0)}"></label>
        <div class="sc-app-econ-actions" style="grid-column:1/-1"><button class="btn" type="submit">Spara inställningar</button></div>
      </form>
    </div>
    <div class="sc-app-econ-kpis">
      ${kpi('Rek. pris exkl. moms',money(Math.max(c.recommendedNet,num(state.settings?.min_monthly_price))),`per aktiv fabrik / månad`,'good')}
      ${kpi('Rek. pris inkl. moms',money(Math.max(c.recommendedNet,num(state.settings?.min_monthly_price))*(1+c.tax/100)),'kundpris inkl. moms','')}
      ${kpi('Break-even',`${c.breakEvenFactories} fabriker`,'för att täcka kostnader','warn')}
      ${kpi('Nuvarande resultat',money(c.profit),`marginal ${pct(c.margin)}`,c.profit>=0?'good':'bad')}
      ${kpi('Årsresultat',money(c.profit*12),'nuvarande planläge',c.profit>=0?'good':'bad')}
    </div>`;
  }

  function renderReport(){
    const c=calc();
    return `<div class="sc-app-econ-card"><h4>Intern rapport – Applikationsekonomi</h4>
      <p class="sc-app-econ-sub">Sammanfattning för prisbeslut, budget och uppföljning.</p>
      <table class="sc-app-econ-table"><tbody>
        <tr><td>Månadskostnad</td><td class="money">${money(c.totalCost)}</td></tr>
        <tr><td>Årskostnad</td><td class="money">${money(c.totalCost*12)}</td></tr>
        <tr><td>Beräknad månadsintäkt</td><td class="money">${money(c.revenue)}</td></tr>
        <tr><td>Beräknad årsintäkt</td><td class="money">${money(c.revenue*12)}</td></tr>
        <tr><td>Resultat / månad</td><td class="money">${money(c.profit)}</td></tr>
        <tr><td>Resultat / år</td><td class="money">${money(c.profit*12)}</td></tr>
        <tr><td>Rekommenderat pris / fabrik / månad exkl. moms</td><td class="money">${money(c.recommendedNet)}</td></tr>
        <tr><td>Rekommenderat pris / fabrik / månad inkl. moms</td><td class="money">${money(c.recommendedGross)}</td></tr>
      </tbody></table>
      <div class="sc-app-econ-actions"><button class="btn secondary" id="scAppEconPrint" type="button">Öppna utskriftsrapport</button></div>
    </div>`;
  }

  function typeLabel(t){return ({fixed:'Fast',per_factory:'Per fabrik',per_user:'Per användare'}[t]||t||'Fast')}

  function bindBody(){
    $('#scAppEconCostForm')?.addEventListener('submit',saveCost);
    $('#scAppEconPlanForm')?.addEventListener('submit',savePlan);
    $('#scAppEconSettingsForm')?.addEventListener('submit',saveSettings);
    $$('[data-edit-cost]').forEach(b=>b.addEventListener('click',()=>editCost(b.dataset.editCost)));
    $$('[data-edit-plan]').forEach(b=>b.addEventListener('click',()=>editPlan(b.dataset.editPlan)));
    $('#scAppEconPrint')?.addEventListener('click',printReport);
  }

  async function saveCost(e){
    e.preventDefault();
    await rpc('btg_systemcenter_app_economy_save_cost',{
      p_id: $('#scCostId')?.value || null,
      p_name: $('#scCostName').value,
      p_category: $('#scCostCategory').value,
      p_cost_type: $('#scCostType').value,
      p_monthly_amount: Number($('#scCostAmount').value||0),
      p_note: $('#scCostNote').value || null
    });
    await loadAndRender();
  }
  function editCost(id){
    const r=state.costs.find(x=>String(x.id)===String(id)); if(!r) return;
    state.tab='costs'; render();
    setTimeout(()=>{ $('#scCostId').value=r.id; $('#scCostName').value=r.name||''; $('#scCostCategory').value=r.category||'Övrigt'; $('#scCostType').value=r.cost_type||'fixed'; $('#scCostAmount').value=r.monthly_amount||0; $('#scCostNote').value=r.note||''; },50);
  }

  async function savePlan(e){
    e.preventDefault();
    await rpc('btg_systemcenter_app_economy_save_plan',{
      p_id: $('#scPlanId')?.value || null,
      p_name: $('#scPlanName').value,
      p_monthly_price: Number($('#scPlanPrice').value||0),
      p_assigned_factories: Number($('#scPlanFactories').value||0),
      p_max_users: Number($('#scPlanMaxUsers').value||0),
      p_description: $('#scPlanDesc').value || null
    });
    await loadAndRender();
  }
  function editPlan(id){
    const r=state.plans.find(x=>String(x.id)===String(id)); if(!r) return;
    state.tab='plans'; render();
    setTimeout(()=>{ $('#scPlanId').value=r.id; $('#scPlanName').value=r.name||''; $('#scPlanPrice').value=r.monthly_price||0; $('#scPlanFactories').value=r.assigned_factories||0; $('#scPlanMaxUsers').value=r.max_users||0; $('#scPlanDesc').value=r.description||''; },50);
  }

  async function saveSettings(e){
    e.preventDefault();
    await rpc('btg_systemcenter_app_economy_save_settings',{
      p_target_margin_percent:Number($('#scTargetMargin').value||35),
      p_vat_percent:Number($('#scVatPercent').value||25),
      p_min_monthly_price:Number($('#scMinPrice').value||0),
      p_support_markup_percent:Number($('#scSupportMarkup').value||0)
    });
    await loadAndRender();
  }

  function printReport(){
    const c=calc();
    const w=window.open('','_blank');
    w.document.write(`<!doctype html><html><head><title>Applikationsekonomi</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px;text-align:left}.money{text-align:right}h1{margin-bottom:4px}</style></head><body><h1>Applikationsekonomi</h1><p>Intern rapport för BTG Quality Control</p><table><tbody><tr><td>Månadskostnad</td><td class="money">${money(c.totalCost)}</td></tr><tr><td>Månadsintäkt</td><td class="money">${money(c.revenue)}</td></tr><tr><td>Resultat / månad</td><td class="money">${money(c.profit)}</td></tr><tr><td>Rekommenderat pris exkl. moms</td><td class="money">${money(c.recommendedNet)}</td></tr><tr><td>Rekommenderat pris inkl. moms</td><td class="money">${money(c.recommendedGross)}</td></tr></tbody></table></body></html>`);
    w.document.close(); w.focus();
  }

  function injectButton(){
    const root=$('#systemCenterRoot'); if(!root) return;
    const create=$('#scCreateFactoryBtn',root) || $('#scPagePermGlobalBtn',root);
    if(create && !$('#scAppEconomyBtn',root)){
      const b=document.createElement('button');
      b.id='scAppEconomyBtn'; b.className='btn secondary sc-app-econ-btn'; b.type='button'; b.textContent='Applikationsekonomi';
      b.addEventListener('click',open);
      create.parentElement?.insertBefore(b,create);
    }
  }

  function init(){
    document.addEventListener('click',e=>{ if(e.target?.closest?.('#btnSystemCenter')) setTimeout(injectButton,500); },true);
    const obs=new MutationObserver(()=>{ if($('#systemCenterRoot')) injectButton(); });
    obs.observe(document.body,{childList:true,subtree:true});
    [700,1600,3000].forEach(ms=>setTimeout(injectButton,ms));
  }
  window.BTG_APP_ECONOMY={open,state,calc};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
