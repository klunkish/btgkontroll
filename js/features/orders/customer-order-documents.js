
/* BTG QC v19.5.38 – Kund & Beställningsdokument */
(function(){
  'use strict';
  const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const n=v=>Number(v||0)||0;
  const money=v=>new Intl.NumberFormat('sv-SE',{style:'currency',currency:'SEK',maximumFractionDigits:2}).format(n(v));
  const db=()=>window.sb||window.supabaseClient||null;
  const factoryId=()=>String(localStorage.getItem('btg_selected_factory_id')||window.BTG_ACTIVE_FACTORY_ID||window.BTG_CURRENT_FACTORY_ID||window.BTG_FACTORY_ADMIN_STATE?.activeFactoryId||window.BTG_ACCESS_STATE?.factory_id||window.BTG_ACCESS_STATE?.profile?.factory_id||'');
  const userId=()=>String(window.CURRENT_USER?.id||window.BTG_ACCESS_STATE?.profile?.user_id||'');
  const isAdmin=()=>String(window.BTG_ACCESS_STATE?.profile?.role||window.BTG_ACTIVE_ROLE||'').toUpperCase().includes('ADMIN') || !!window.BTG_SYSTEM_CENTER?.state?.canAccess;
  const state={tab:'editor',customers:[],orders:[],docs:[],lines:[],editing:null,include:{customer:true,order:true,number:true,dates:true,lines:true,vat:true,terms:true,signature:false},header:{}};

  async function trySelect(table){
    const client=db(); if(!client) return [];
    const uid=userId();
    const attempts=[];
    if(uid) attempts.push(()=>client.from(table).select('*').eq('user_id',uid).limit(800));
    attempts.push(()=>client.from(table).select('*').limit(800));
    for(const run of attempts){
      try{
        const {data,error}=await run();
        if(error) throw error;
        if(Array.isArray(data) && data.length) return data;
      }catch(e){ /* prova nästa strategi */ }
    }
    return [];
  }
  function globalArray(name){
    try{
      const arr = Function(`return (typeof ${name} !== "undefined" && Array.isArray(${name})) ? ${name} : []`)();
      return Array.isArray(arr)?arr:[];
    }catch(_){ return []; }
  }
  function arrGlobal(names){ return names.flatMap(n=>Array.isArray(window[n])?window[n]:globalArray(n)); }
  function localArray(keys){
    const out=[];
    keys.forEach(k=>{
      try{
        const raw=localStorage.getItem(k);
        if(!raw) return;
        const parsed=JSON.parse(raw);
        if(Array.isArray(parsed)) out.push(...parsed);
      }catch(_){ }
    });
    return out;
  }
  function dedupe(list){
    const seen=new Set();
    return (list||[]).filter(x=>{
      if(!x) return false;
      const id=String(x.id||x.cloudId||x.customer_id||x.order_id||x.name||x.order_name||JSON.stringify(x)).toLowerCase();
      if(seen.has(id)) return false;
      seen.add(id); return true;
    });
  }
  function normalizeCustomer(c){
    const app=c.app_data||c.appData||{};
    return {...app,...c,
      id:c.id||c.cloudId||c.customer_id||app.id||app.customerId,
      name:c.name||c.customer_name||c.company||c.company_name||c.kund||app.name||app.customerName||'Kund',
      contactPerson:c.contactPerson||c.contact||app.contactPerson||'',
      info:c.info||app.info||''
    };
  }
  function normalizeOrder(o){
    const app=o.app_data||o.appData||{};
    return {...app,...o,
      id:o.id||o.cloudId||o.order_id||app.id||app.orderId,
      customerId:o.customerId||o.customer_id||app.customerId||app.customer_id||'',
      name:o.name||o.order_name||o.orderName||o.order_number||o.number||o.littra||o.project||o.recipeName||app.orderName||app.recipeName||'Beställning',
      orderInfo:o.orderInfo||o.note||app.orderInfo||''
    };
  }
  function customerName(c){return c.name||c.customer_name||c.company||c.company_name||c.kund||c.title||'Kund'}
  function customerId(c){return String(c.id||c.cloudId||c.customer_id||c.customerId||customerName(c))}
  function orderName(o){return o.name||o.order_name||o.orderName||o.order_number||o.number||o.littra||o.project||o.recipeName||o.title||'Beställning'}
  function orderId(o){return String(o.id||o.cloudId||o.order_id||o.orderId||orderName(o))}
  function orderCustomerId(o){return String(o.customerId||o.customer_id||o.customer||'')}

  async function rpc(name,args){
    const client=db(); if(!client) throw new Error('Supabase-klient saknas');
    const {data,error}=await client.rpc(name,args||{});
    if(error) throw error;
    return data;
  }
  async function loadData(){
    const [cust1,cust2,ord1,ord2,docs]=await Promise.all([
      trySelect('customers'), trySelect('btg_customers'), trySelect('orders'), trySelect('btg_orders'),
      rpcSafe('btg_customer_order_documents_list',{p_factory_id:factoryId()})
    ]);
    const globalCustomers=arrGlobal(['CUSTOMERS','customers','BTG_CUSTOMERS','APP_CUSTOMERS']);
    const globalOrders=arrGlobal(['ORDERS','orders','CUSTOMER_ORDERS','BTG_ORDERS','APP_ORDERS']);
    const localCustomers=localArray(['bk_customers_v2','customers','CUSTOMERS','btg_customers']);
    const localOrders=localArray(['bk_orders_v2','orders','ORDERS','btg_orders']);
    state.customers=dedupe([...globalCustomers,...cust1,...cust2,...localCustomers].map(normalizeCustomer));
    state.orders=dedupe([...globalOrders,...ord1,...ord2,...localOrders].map(normalizeOrder));
    state.docs=Array.isArray(docs)?docs:[];
  }
  async function rpcSafe(name,args){try{return await rpc(name,args)}catch(e){console.warn(e);return []}}

  function ensureDialog(){
    let d=$('#customerOrderDocumentsDialog'); if(d) return d;
    d=document.createElement('dialog'); d.id='customerOrderDocumentsDialog'; d.className='cod-modal';
    d.innerHTML=`<div class="cod-inner">
      <div class="cod-head">
        <div><h3>Kund & Beställningsdokument</h3><p class="cod-sub">Skapa offert, faktura, orderbekräftelse eller beställningsunderlag från kund och beställning.</p></div>
        <div class="cod-toolbar">
          <button class="btn secondary" id="codRefresh" type="button">Uppdatera</button>
          <button class="btn" id="codPrintTop" type="button">PDF-vy</button>
          <button class="btn secondary" data-cod-close type="button">Stäng</button>
        </div>
      </div>
      <div class="cod-tabs">
        <button class="cod-tab active" data-cod-tab="editor">Skapa dokument</button>
        <button class="cod-tab" data-cod-tab="history">Historik</button>
      </div>
      <div id="codBody"></div>
    </div>`;
    document.body.appendChild(d);
    d.addEventListener('click',e=>{
      if(e.target.matches('[data-cod-close]')) d.close();
      const t=e.target.closest('[data-cod-tab]'); if(t){state.tab=t.dataset.codTab;render();}
    });
    $('#codRefresh',d).addEventListener('click',async()=>{await loadData();render();});
    $('#codPrintTop',d).addEventListener('click',printCurrent);
    return d;
  }
  async function open(){
    if(!db()) return alert('Supabase saknas.');
    const d=ensureDialog();
    await loadData();
    if(!state.lines.length) addLine();
    render();
    if(d.showModal) d.showModal(); else d.setAttribute('open','open');
  }

  function addLine(line={}){
    state.lines.push({description:line.description||'',qty:n(line.qty)||1,unit:line.unit||'st',unit_price:n(line.unit_price),discount_percent:n(line.discount_percent),vat_percent:line.vat_percent==null?25:n(line.vat_percent)});
  }
  function lineTotals(l){
    const net=n(l.qty)*n(l.unit_price)*(1-n(l.discount_percent)/100);
    const vat=net*n(l.vat_percent)/100;
    return {net,vat,total:net+vat};
  }
  function totals(){
    return state.lines.reduce((s,l)=>{const t=lineTotals(l);s.net+=t.net;s.vat+=t.vat;s.total+=t.total;return s},{net:0,vat:0,total:0});
  }

  function render(){
    const d=ensureDialog(); $$('.cod-tab',d).forEach(b=>b.classList.toggle('active',b.dataset.codTab===state.tab));
    $('#codBody',d).innerHTML=state.tab==='history'?renderHistory():renderEditor();
    bind();
  }
  function renderEditor(){
    const t=totals();
    return `<div class="cod-grid">
      <div class="cod-card">
        <h4>Dokument</h4>
        <form id="codForm" class="cod-form">
          <label>Typ<select id="codType"><option value="offer">Offert</option><option value="invoice">Faktura</option><option value="order">Orderbekräftelse</option><option value="basis">Beställningsunderlag</option></select></label>
          <label>Kund<select id="codCustomer"><option value="">Välj kund…</option>${state.customers.map(c=>`<option value="${esc(customerId(c))}">${esc(customerName(c))}</option>`).join('')}</select></label>
          <label>Beställning<select id="codOrder"><option value="">Välj beställning…</option>${state.orders.map(o=>`<option value="${esc(orderId(o))}">${esc(orderName(o))}</option>`).join('')}</select></label>
          <label>Dokumentnr<input id="codNumber" placeholder="auto om tomt"></label>
          <label>Datum<input id="codDate" type="date"></label>
          <label>Giltig/Förfallo<input id="codDue" type="date"></label>
          <label>Betalningsvillkor<input id="codTerms" value="30 dagar netto"></label>
          <label>Er referens<input id="codRef" placeholder="valfritt"></label>
          <label style="grid-column:1/-1">Rubrik<input id="codTitle" placeholder="Offert / Faktura / Orderbekräftelse"></label>
          <label style="grid-column:1/-1">Kommentar / villkor<textarea id="codNote" placeholder="T.ex. priser exkl. moms, giltighet, leveransvillkor..."></textarea></label>
        </form>
        ${(!state.customers.length || !state.orders.length)?`<div class="cod-empty">${!state.customers.length?'Inga kunder hittades. Modulen söker nu i appens minne, localStorage och Supabase-tabellerna customers/btg_customers.':''} ${!state.orders.length?'Inga beställningar hittades. Modulen söker nu i appens minne, localStorage och Supabase-tabellerna orders/btg_orders.':''}</div>`:''}
        <h4>Prisrader</h4>
        <div class="cod-table-wrap">${renderLines()}</div>
        <div class="cod-actions"><button class="btn secondary" id="codAddLine" type="button">Lägg till rad</button><button class="btn" id="codSave" type="button">Spara dokument</button><button class="btn" id="codPrint" type="button">PDF-vy</button></div>
      </div>
      <div class="cod-card">
        <h4>Vad ska vara med?</h4>
        <div class="cod-checks">${Object.entries({
          customer:'Kunduppgifter',order:'Beställning',number:'Dokumentnummer',dates:'Datum/giltighet',lines:'Prisrader',vat:'Moms/totaler',terms:'Villkor',signature:'Signaturruta'
        }).map(([k,l])=>`<label class="cod-check"><input type="checkbox" data-cod-inc="${k}" ${state.include[k]?'checked':''}> ${l}</label>`).join('')}</div>
        <h4>Summering</h4>
        <div class="cod-summary">
          <div><span>Netto</span><b>${money(t.net)}</b></div>
          <div><span>Moms</span><b>${money(t.vat)}</b></div>
          <div><span>Totalt</span><b>${money(t.total)}</b></div>
        </div>
      </div>
    </div>`;
  }
  function renderLines(){
    if(!state.lines.length) return `<div class="cod-empty">Inga rader ännu.</div>`;
    return `<table class="cod-table"><thead><tr><th>Benämning</th><th>Antal</th><th>Enhet</th><th>Pris/st</th><th>Rabatt %</th><th>Moms %</th><th class="money">Summa</th><th></th></tr></thead><tbody>${state.lines.map((l,i)=>{const t=lineTotals(l);return `<tr data-line="${i}">
      <td><input data-line-field="description" value="${esc(l.description)}" placeholder="Tjänst/produkt"></td>
      <td><input data-line-field="qty" type="number" step="0.01" value="${esc(l.qty)}"></td>
      <td><input data-line-field="unit" value="${esc(l.unit)}"></td>
      <td><input data-line-field="unit_price" type="number" step="0.01" value="${esc(l.unit_price)}"></td>
      <td><input data-line-field="discount_percent" type="number" step="0.01" value="${esc(l.discount_percent)}"></td>
      <td><input data-line-field="vat_percent" type="number" step="0.01" value="${esc(l.vat_percent)}"></td>
      <td class="money">${money(t.total)}</td>
      <td><button class="btn secondary" data-remove-line="${i}" type="button">Ta bort</button></td></tr>`}).join('')}</tbody></table>`;
  }
  function renderHistory(){
    if(!state.docs.length) return `<div class="cod-card"><div class="cod-empty">Inga sparade dokument ännu.</div></div>`;
    return `<div class="cod-card"><h4>Sparade dokument</h4><div class="cod-table-wrap"><table class="cod-table"><thead><tr><th>Typ</th><th>Nr</th><th>Kund</th><th>Datum</th><th class="money">Total</th><th></th></tr></thead><tbody>${state.docs.map(d=>`<tr><td><span class="cod-pill ${esc(d.document_type)}">${esc(typeLabel(d.document_type))}</span></td><td>${esc(d.document_number)}</td><td>${esc(d.customer_name||'')}</td><td>${esc((d.document_date||'').slice(0,10))}</td><td class="money">${money(d.total_amount)}</td><td><button class="btn secondary" data-open-doc="${esc(d.id)}" type="button">Öppna</button></td></tr>`).join('')}</tbody></table></div></div>`;
  }
  function typeLabel(t){return ({offer:'Offert',invoice:'Faktura',order:'Orderbekräftelse',basis:'Beställningsunderlag'}[t]||t||'Dokument')}

  function bind(){
    $('#codAddLine')?.addEventListener('click',()=>{addLine();render();});
    $('#codSave')?.addEventListener('click',saveDoc);
    $('#codPrint')?.addEventListener('click',printCurrent);
    $$('[data-cod-inc]').forEach(c=>c.addEventListener('change',e=>state.include[e.target.dataset.codInc]=e.target.checked));
    $$('[data-line-field]').forEach(inp=>inp.addEventListener('input',e=>{
      const tr=e.target.closest('[data-line]'); const i=Number(tr.dataset.line); const f=e.target.dataset.lineField;
      state.lines[i][f]=['qty','unit_price','discount_percent','vat_percent'].includes(f)?n(e.target.value):e.target.value;
      render();
    }));
    $$('[data-remove-line]').forEach(b=>b.addEventListener('click',()=>{state.lines.splice(Number(b.dataset.removeLine),1);render();}));
    $$('[data-open-doc]').forEach(b=>b.addEventListener('click',async()=>openDoc(b.dataset.openDoc)));
  }
  function collectHeader(){
    const cid=$('#codCustomer')?.value||''; const oid=$('#codOrder')?.value||'';
    const c=state.customers.find(x=>customerId(x)===cid)||{};
    const o=state.orders.find(x=>orderId(x)===oid)||{};
    return {
      document_type:$('#codType')?.value||'offer',
      customer_id:cid, order_id:oid,
      customer_name:customerName(c)||$('#codCustomer')?.selectedOptions?.[0]?.textContent||'',
      order_name:orderName(o)||$('#codOrder')?.selectedOptions?.[0]?.textContent||'',
      document_number:$('#codNumber')?.value||'',
      document_date:$('#codDate')?.value||new Date().toISOString().slice(0,10),
      due_date:$('#codDue')?.value||'',
      payment_terms:$('#codTerms')?.value||'',
      reference:$('#codRef')?.value||'',
      title:$('#codTitle')?.value||typeLabel($('#codType')?.value),
      note:$('#codNote')?.value||''
    };
  }
  async function saveDoc(){
    try{
      const h=collectHeader(); const t=totals();
      const payload={...h,include:state.include,lines:state.lines,totals:t};
      const id=await rpc('btg_customer_order_document_save',{p_factory_id:factoryId(),p_document:payload});
      alert('Dokument sparat.');
      await loadData(); state.tab='history'; render();
    }catch(e){alert('Kunde inte spara dokument: '+(e.message||e));}
  }
  async function openDoc(id){
    const d=state.docs.find(x=>String(x.id)===String(id)); if(!d) return;
    state.lines=Array.isArray(d.lines)?d.lines:(d.document_data?.lines||[]);
    state.include=d.document_data?.include||state.include;
    state.tab='editor'; render();
    setTimeout(()=>{
      $('#codType').value=d.document_type||'offer';
      $('#codNumber').value=d.document_number||'';
      $('#codDate').value=(d.document_date||'').slice(0,10);
      $('#codDue').value=(d.due_date||'').slice(0,10);
      $('#codTitle').value=d.title||'';
      $('#codNote').value=d.note||'';
    },50);
  }
  function printCurrent(){
    const h=collectHeader(); const t=totals(); const inc=state.include;
    const rows=state.lines.map(l=>{const lt=lineTotals(l);return `<tr><td>${esc(l.description)}</td><td>${esc(l.qty)}</td><td>${esc(l.unit)}</td><td class="r">${money(l.unit_price)}</td><td class="r">${esc(l.discount_percent)}%</td><td class="r">${esc(l.vat_percent)}%</td><td class="r">${money(lt.total)}</td></tr>`}).join('');
    const w=window.open('','_blank');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(h.title)}</title><style>
      body{font-family:Arial,sans-serif;color:#111;margin:0;padding:36px}.top{display:flex;justify-content:space-between;gap:20px;border-bottom:3px solid #111;padding-bottom:18px;margin-bottom:24px}h1{margin:0;font-size:32px}.muted{color:#555}.box{border:1px solid #ddd;border-radius:10px;padding:14px;margin:14px 0}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{border-bottom:1px solid #ddd;padding:9px;text-align:left}th{background:#f4f4f4}.r{text-align:right}.tot{max-width:360px;margin-left:auto}.sign{display:flex;gap:40px;margin-top:70px}.sign div{flex:1;border-top:1px solid #111;padding-top:8px}@media print{button{display:none}body{padding:22px}}</style></head><body>
      <button onclick="window.print()">Skriv ut / Spara som PDF</button>
      <div class="top"><div><h1>${esc(h.title||typeLabel(h.document_type))}</h1><div class="muted">BTG Quality Control</div></div><div>${inc.number?`<b>Nr:</b> ${esc(h.document_number||'Auto')}<br>`:''}${inc.dates?`<b>Datum:</b> ${esc(h.document_date)}<br><b>Giltig/Förfallo:</b> ${esc(h.due_date||'')}`:''}</div></div>
      ${inc.customer?`<div class="box"><b>Kund</b><br>${esc(h.customer_name||'')}</div>`:''}
      ${inc.order?`<div class="box"><b>Beställning</b><br>${esc(h.order_name||'')}<br>${esc(h.reference||'')}</div>`:''}
      ${inc.lines?`<table><thead><tr><th>Benämning</th><th>Antal</th><th>Enhet</th><th class="r">Pris/st</th><th class="r">Rabatt</th><th class="r">Moms</th><th class="r">Summa</th></tr></thead><tbody>${rows}</tbody></table>`:''}
      ${inc.vat?`<div class="tot"><table><tr><td>Netto</td><td class="r">${money(t.net)}</td></tr><tr><td>Moms</td><td class="r">${money(t.vat)}</td></tr><tr><td><b>Totalt</b></td><td class="r"><b>${money(t.total)}</b></td></tr></table></div>`:''}
      ${inc.terms?`<div class="box"><b>Villkor</b><br>Betalningsvillkor: ${esc(h.payment_terms||'')}<br>${esc(h.note||'')}</div>`:''}
      ${inc.signature?`<div class="sign"><div>För kund</div><div>För leverantör</div></div>`:''}
      </body></html>`);
    w.document.close(); w.focus();
  }

  function inject(){
    if($('#btnCustomerOrderDocuments')) return;
    const candidates=$$('.tab-btn,button[data-tab],.main-nav button,nav button');
    const after=candidates.find(b=>/kund|beställ|order/i.test(b.textContent||''));
    const b=document.createElement('button');
    b.id='btnCustomerOrderDocuments'; b.className='tab-btn cod-nav-btn'; b.type='button'; b.textContent='Offert / Faktura';
    b.addEventListener('click',open);
    if(after?.parentElement) after.parentElement.insertBefore(b,after.nextSibling);
    else {
      const nav=document.querySelector('nav,.sidebar,.main-nav,#sidebar')||document.body;
      nav.appendChild(b);
    }
  }
  function init(){ inject(); new MutationObserver(inject).observe(document.body,{childList:true,subtree:true}); setTimeout(inject,1000); }
  window.BTG_CUSTOMER_ORDER_DOCUMENTS={open,state};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
