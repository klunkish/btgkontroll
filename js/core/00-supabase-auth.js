/***********************************************************
 * 🔥 SUPABASE / MOLNDATABAS + AUTH
 *
 * Detta är SaaS-grunden:
 * - Supabase-klient
 * - inloggning / skapa konto / logga ut
 * - CURRENT_USER används när vi sparar data i molnet
 *
 * FYLL I:
 * Supabase → Project Settings → API
 ***********************************************************/
const SUPABASE_URL = "https://trbxugdamyxswdreoaaj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyYnh1Z2RhbXl4c3dkcmVvYWFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwOTMwOTAsImV4cCI6MjA5NDY2OTA5MH0.OAuWV8-6ioVPKikqNWP6Bj8IzkQYamCp_dcG9iOkzuA";

let sb = null;
let SUPABASE_READY = false;
let CURRENT_USER = null;
let CLOUD_LOADING = false;
let LAST_CLOUD_SYNC_AT = null;

try {
  if (
    window.supabase &&
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes('DIN_SUPABASE_URL') &&
    !SUPABASE_ANON_KEY.includes('DIN_SUPABASE_ANON_KEY')
  ) {
    const { createClient } = window.supabase;
    sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    SUPABASE_READY = true;
    console.log('Supabase är anslutet.');
  } else {
    console.warn('Supabase är inte konfigurerat ännu. Appen kör lokalt tills URL och anon key är ifyllda.');
  }
} catch (err) {
  console.error('Kunde inte initiera Supabase:', err);
  SUPABASE_READY = false;
}

/***********************************************************
 * SUPABASE FELHANTERING
 ***********************************************************/
function showSupabaseError(context, error){
  console.error(context, error);
  const msg = error?.message || String(error || 'Okänt fel');
  setCloudStatus('danger', context + ': ' + msg);
  alert(context + ': ' + msg);
}

/***********************************************************
 * v10/v11 DASHBOARD + RAPPORTSTATUS
 *
 * Central liten statusrad för molnkoppling, laddning och
 * senast uppdaterad. Gör appen mer professionell och lättare
 * att felsöka vid demo/pilotkund.
 ***********************************************************/
function setCloudStatus(type='warn', text=''){
  const dot = document.getElementById('cloudStatusDot');
  const label = document.getElementById('cloudStatusText');
  if (dot){
    dot.classList.remove('ok','warn','danger');
    if (type) dot.classList.add(type);
  }
  if (label && text) label.textContent = text;
  const indicator = document.querySelector('.cloud-indicator');
  if (indicator && text) indicator.setAttribute('title', text);
}

function formatSyncTime(date){
  if (!date) return 'Ej synkad ännu';
  try { return 'Senast uppdaterad: ' + date.toLocaleString('sv-SE', { dateStyle:'short', timeStyle:'medium' }); }
  catch { return 'Senast uppdaterad: ' + String(date); }
}

function updateCloudDashboardMeta(){
  const last = document.getElementById('cloudLastSync');
  if (last) last.textContent = formatSyncTime(LAST_CLOUD_SYNC_AT);

  const stats = document.getElementById('cloudStats');
  if (stats){
    stats.innerHTML = `
      <span>Recept: <b>${RECIPES?.length || 0}</b></span>
      <span>Material: <b>${MATERIALS?.length || 0}</b></span>
      <span>Satser: <b>${BATCHES?.length || 0}</b></span>
      <span>Provkuber: <b>${CUBES?.length || 0}</b></span>
      <span>Kunder: <b>${CUSTOMERS?.length || 0}</b></span>
      <span>Beställningar: <b>${ORDERS?.length || 0}</b></span>
      <span>Uppgifter: <b>${TASKS?.items?.length || 0}</b></span>
    `;
  }

  if (!SUPABASE_READY){
    setCloudStatus('danger', 'Supabase är inte konfigurerat.');
  } else if (!CURRENT_USER){
    setCloudStatus('warn', 'Logga in för att ladda molndata.');
  } else if (CLOUD_LOADING){
    setCloudStatus('warn', 'Laddar molndata…');
  } else {
    setCloudStatus('ok', 'Molndata är laddad och synkad.');
  }
}

async function refreshCloudDataFromButton(){
  if (!CURRENT_USER){ alert('Logga in först.'); return; }
  await loadCloudCoreData();
}

/***********************************************************
 * 🔐 AUTH-HJÄLPFUNKTIONER
 *
 * CURRENT_USER är null om ingen är inloggad.
 * När användaren loggar in sätts CURRENT_USER = user.
 ***********************************************************/
async function refreshCurrentUser(loadData=true){
  if (!SUPABASE_READY || !sb) {
    CURRENT_USER = null;
    updateAuthUI();
    return null;
  }

  const { data, error } = await sb.auth.getUser();
  if (error) {
    console.warn('Kunde inte hämta aktuell användare:', error.message);
    CURRENT_USER = null;
  } else {
    CURRENT_USER = data?.user || null;
  }

  updateAuthUI();
  if (loadData && CURRENT_USER) await loadCloudCoreData();
  return CURRENT_USER;
}

function updateAuthUI(){
  const status = document.getElementById('authStatus');
  const btnAuth = document.getElementById('btnAuth');
  const btnLogout = document.getElementById('btnLogout');
  const msg = document.getElementById('authMessage');

  if (!status || !btnAuth || !btnLogout) return;

  if (!SUPABASE_READY) {
    status.textContent = 'Supabase ej konfigurerat';
    btnAuth.style.display = 'none';
    btnLogout.style.display = 'none';
    return;
  }

  if (CURRENT_USER) {
    status.textContent = CURRENT_USER.email || 'Inloggad';
    status.classList.add('ok');
    btnAuth.style.display = 'none';
    btnLogout.style.display = '';
    if (msg) msg.textContent = 'Du är inloggad. Recept, material, satser, provkuber, luftprov, kunder, beställningar, kontroll, dagbok och uppgifter laddas/sparas live i Supabase.';
  } else {
    status.textContent = 'Ej inloggad';
    status.classList.remove('ok');
    btnAuth.style.display = '';
    btnLogout.style.display = 'none';
    if (msg) msg.textContent = 'Logga in för att spara molndata kopplad till ditt konto.';
  }
}

function openAuthDialog(){
  const dlg = document.getElementById('authDialog');
  if (dlg) dlg.showModal();
}

async function authLogin(){
  if (!SUPABASE_READY || !sb) {
    alert('Supabase är inte konfigurerat ännu.');
    return;
  }

  const email = document.getElementById('authEmail')?.value.trim();
  const password = document.getElementById('authPassword')?.value || '';

  if (!email || !password) {
    alert('Fyll i e-post och lösenord.');
    return;
  }

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    showSupabaseError('Kunde inte logga in', error);
    return;
  }

  CURRENT_USER = data.user;
  updateAuthUI();
  await loadCloudCoreData();
  document.getElementById('authDialog')?.close();
  alert('Du är inloggad.');
}

async function authSignup(){
  if (!SUPABASE_READY || !sb) {
    alert('Supabase är inte konfigurerat ännu.');
    return;
  }

  const email = document.getElementById('authEmail')?.value.trim();
  const password = document.getElementById('authPassword')?.value || '';

  if (!email || !password) {
    alert('Fyll i e-post och lösenord.');
    return;
  }

  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) {
    showSupabaseError('Kunde inte skapa konto', error);
    return;
  }

  CURRENT_USER = data.user || null;
  updateAuthUI();
  if (CURRENT_USER) await loadCloudCoreData();
  document.getElementById('authDialog')?.close();

  if (CURRENT_USER) {
    alert('Konto skapat och du är inloggad.');
  } else {
    alert('Konto skapat. Kontrollera din e-post om Supabase kräver bekräftelse.');
  }
}

async function authLogout(){
  if (!SUPABASE_READY || !sb) return;
  const { error } = await sb.auth.signOut();
  if (error) {
    showSupabaseError('Kunde inte logga ut', error);
    return;
  }
  CURRENT_USER = null;
  LAST_CLOUD_SYNC_AT = null;
  RECIPES = []; MATERIALS = []; BATCHES = []; CUBES = []; AIR = []; CUSTOMERS = []; ORDERS = []; CONTROL_DEVICES = []; DIARY = {}; TASKS = { items: [] };
  updateAuthUI();
  renderRecipes?.(); renderRecipeSelects?.(); renderMaterials?.(); syncMaterialNamesDatalist?.(); renderBatches?.(); renderCubes?.(); renderAir?.(); renderCustomers?.(); renderCustomerSelects?.(); renderOrders?.(); renderControlDevices?.(); renderDiaryInit?.(); renderTasks?.(); renderDashboard?.();
  alert('Du är utloggad.');
}

/***********************************************************
 * INITIERA AUTH-UI
 ***********************************************************/
function initAuthUI(){
  document.getElementById('btnAuth')?.addEventListener('click', openAuthDialog);
  document.getElementById('btnLogout')?.addEventListener('click', authLogout);
  document.getElementById('btnDoLogin')?.addEventListener('click', authLogin);
  document.getElementById('btnDoSignup')?.addEventListener('click', authSignup);
  document.getElementById('btnCloseAuth')?.addEventListener('click', ()=> document.getElementById('authDialog')?.close());
  document.getElementById('btnRefreshCloud')?.addEventListener('click', refreshCloudDataFromButton);

  if (SUPABASE_READY && sb) {
    sb.auth.onAuthStateChange((_event, session) => {
      CURRENT_USER = session?.user || null;
      updateAuthUI();
    });
    refreshCurrentUser();
  } else {
    updateAuthUI();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuthUI);
} else {
  initAuthUI();
}

/***********************************************************
 * ☁️ SUPABASE: CLOUD-FIRST DATA
 *
 * Från och med denna version kör följande moduler live mot
 * Supabase och använder inte längre LocalStorage som primär
 * lagring:
 * - RECIPES
 * - MATERIALS
 * - BATCHES
 * - CUBES / PROVKUBER
 * - AIR / LUFTPROV
 * - CUSTOMERS / KUNDER
 * - ORDERS / BESTÄLLNINGAR
 * - CONTROL / KONTROLL
 * - DAGBOK / INKOMMANDE MATERIAL
 * - UTVÄRDERING / EN206 läser nu från molnladdade CUBES/RECIPES
 *
 * Övriga moduler ligger kvar lokalt tills vi migrerar dem.
 ***********************************************************/
async function getRequiredCloudUser(actionText='spara i molnet'){
  if (!SUPABASE_READY || !sb) return null;

  const user = CURRENT_USER || await refreshCurrentUser(false);
  if (!user) {
    alert('Du behöver vara inloggad för att ' + actionText + '.');
    openAuthDialog();
    return null;
  }

  return user;
}

function normalizeRecipeRow(row){
  const app = row.app_data || {};
  return {
    ...app,
    id: row.id,
    cloudId: row.id,
    name: row.name ?? app.name ?? '',
    strength: row.strength ?? app.strength ?? '',
    vct: row.vct ?? app.vct ?? 0,
    vctEq: row.vct_eq ?? app.vctEq ?? 0,
    airReq: row.air_req ?? app.airReq ?? null,
    materials: Array.isArray(app.materials) ? app.materials : (Array.isArray(app.recipeMaterials) ? app.recipeMaterials : []),
    perM3: app.perM3 ?? true,
    satsVolym: app.satsVolym ?? null,
    groupId: app.groupId ?? null,
    vctReq: app.vctReq ?? null,
    vctEqReq: app.vctEqReq ?? null,
    createdAt: row.created_at || app.createdAt || new Date().toISOString()
  };
}

function normalizeMaterialRow(row){
  const app = row.app_data || {};
  return {
    ...app,
    id: row.id,
    cloudId: row.id,
    name: row.name ?? app.name ?? '',
    type: row.type ?? app.type ?? '',
    ef: row.ef ?? app.ef ?? 0,
    note: row.note ?? app.note ?? '',
    createdAt: row.created_at || app.createdAt || new Date().toISOString()
  };
}

function normalizeBatchRow(row){
  const app = row.app_data || {};
  return {
    ...app,
    id: row.id,
    cloudId: row.id,
    recipeId: app.recipeId || row.recipe_id || '',
    recipeCloudId: row.recipe_id || app.recipeCloudId || null,
    recipeName: app.recipeName || '',
    strength: app.strength || '',
    amount: app.amount ?? row.amount_m3 ?? 0,
    dateTime: app.dateTime || row.datetime || new Date().toISOString(),
    vct: app.vct ?? null,
    vctEq: app.vctEq ?? null,
    gwpPerM3: app.gwpPerM3 ?? row.gwp ?? 0,
    gwpTotal: app.gwpTotal ?? ((row.gwp || 0) * (row.amount_m3 || 0)),
    createdAt: row.created_at || app.createdAt || new Date().toISOString()
  };
}

function normalizeCubeRow(row){
  const app = row.app_data || {};
  const castDate = app.castDate || row.cast_date || todayISO();
  const cureDays = app.cureDays ?? 28;
  let dueDate = app.dueDate || row.due_date || null;
  if (!dueDate) {
    const due = new Date(castDate);
    due.setDate(due.getDate() + Number(cureDays || 28));
    dueDate = due.toISOString().slice(0,10);
  }
  return {
    ...app,
    id: row.id,
    cloudId: row.id,
    recipeId: app.recipeId || row.recipe_id || '',
    recipeCloudId: row.recipe_id || app.recipeCloudId || null,
    recipeName: app.recipeName || '',
    strengthClass: app.strengthClass || app.strength || '',
    castDate,
    cureDays,
    dueDate,
    weight: app.weight ?? row.weight ?? null,
    resultMPa: app.resultMPa ?? row.strength_mpa ?? null,
    note: app.note || row.note || '',
    batchId: app.batchId || row.batch_id || '',
    extra: app.extra || '',
    excludeFromEval: app.excludeFromEval ?? false,
    vctReq: app.vctReq ?? null,
    vctEqReq: app.vctEqReq ?? null,
    airReq: app.airReq ?? null,
    vct: app.vct ?? row.vct ?? null,
    vctEq: app.vctEq ?? row.vct_eq ?? null,
    air: app.air ?? row.air ?? null,
    temp: app.temp ?? row.temp ?? null,
    kw: app.kw ?? row.kw ?? null,
    createdAt: row.created_at || app.createdAt || new Date().toISOString()
  };
}

function normalizeAirRow(row){
  const app = row.app_data || {};
  return {
    ...app,
    id: row.id,
    cloudId: row.id,
    recipeId: app.recipeId || row.recipe_id || '',
    recipeCloudId: row.recipe_id || app.recipeCloudId || null,
    recipeName: app.recipeName || '',
    strengthClass: app.strengthClass || '',
    date: app.date || row.date || todayISO(),
    pct: app.pct ?? row.pct ?? 0,
    note: app.note || row.note || '',
    createdAt: row.created_at || app.createdAt || new Date().toISOString()
  };
}


function normalizeCustomerRow(row){
  const app = row.app_data || {};
  return {
    ...app,
    id: row.id,
    cloudId: row.id,
    name: row.name ?? app.name ?? '',
    contactPerson: row.contact ?? app.contactPerson ?? '',
    info: row.info ?? app.info ?? '',
    createdAt: row.created_at || app.createdAt || new Date().toISOString()
  };
}

function normalizeOrderRow(row){
  const app = row.app_data || {};
  return {
    ...app,
    id: row.id,
    cloudId: row.id,
    customerId: app.customerId || row.customer_id || '',
    customerCloudId: row.customer_id || app.customerCloudId || null,
    customerName: app.customerName || '',
    recipeId: app.recipeId || row.recipe_id || '',
    recipeCloudId: row.recipe_id || app.recipeCloudId || null,
    recipeName: app.recipeName || row.order_name || '',
    strength: app.strength || '',
    amount: app.amount ?? row.amount_m3 ?? 0,
    dateTime: app.dateTime || row.delivery_date || new Date().toISOString(),
    vct: app.vct ?? null,
    vctEq: app.vctEq ?? null,
    gwpPerM3: app.gwpPerM3 ?? row.gwp ?? 0,
    gwpTotal: app.gwpTotal ?? ((row.gwp || 0) * (row.amount_m3 || 0)),
    orderContact: app.orderContact || '',
    orderInfo: app.orderInfo || row.note || '',
    createdAt: row.created_at || app.createdAt || new Date().toISOString()
  };
}

function normalizeControlDeviceRow(row){
  const app = row.app_data || {};
  return {
    ...app,
    id: row.id,
    cloudId: row.id,
    type: row.type || app.type || 'air',
    name: row.name || app.name || '',
    serial: row.serial || app.serial || '',
    checks: row.checks || app.checks || {},
    createdAt: row.created_at || app.createdAt || new Date().toISOString()
  };
}

function normalizeDiaryRow(row){
  const app = row.app_data || {};
  const entryDate = row.entry_date || app.date || todayISO();
  return {
    ...app,
    id: row.id,
    cloudId: row.id,
    date: entryDate,
    weather: row.weather ?? app.weather ?? '',
    vctReq: row.vct_req ?? app.vctReq ?? '',
    vctMeas: row.vct_meas ?? app.vctMeas ?? '',
    tOut: row.temp_out ?? app.tOut ?? null,
    tCure: row.temp_cure ?? app.tCure ?? null,
    tLab: row.temp_lab ?? app.tLab ?? null,
    airReqMin: row.air_req_min ?? app.airReqMin ?? null,
    airMeas: row.air_meas ?? app.airMeas ?? null,
    waterDensity: row.water_density ?? app.waterDensity ?? null,
    note: row.note ?? app.note ?? '',
    imports: Array.isArray(row.imports) ? row.imports : (Array.isArray(app.imports) ? app.imports : []),
    createdAt: row.created_at || app.createdAt || new Date().toISOString()
  };
}


function normalizeTaskRow(row){
  const app = row.app_data || {};
  return {
    ...app,
    id: row.id,
    cloudId: row.id,
    title: row.title ?? app.title ?? '',
    freq: row.freq ?? app.freq ?? 'daily',
    log: Array.isArray(row.log) ? row.log : (Array.isArray(app.log) ? app.log : []),
    createdAt: row.created_at || app.createdAt || new Date().toISOString()
  };
}

async function loadCloudCoreData(){
  if (!SUPABASE_READY || !sb) return;
  const user = CURRENT_USER || await refreshCurrentUser(false);
  if (!user) { updateCloudDashboardMeta?.(); return; }

  CLOUD_LOADING = true;
  updateCloudDashboardMeta?.();

  try {
    const [recipesRes, materialsRes, batchesRes, cubesRes, airRes, customersRes, ordersRes, controlRes, diaryRes, tasksRes] = await Promise.all([
      sb.from('recipes').select('id,name,strength,vct,vct_eq,air_req,app_data,created_at').eq('user_id', user.id).order('created_at', { ascending: true }),
      sb.from('materials').select('id,name,type,ef,note,app_data,created_at').eq('user_id', user.id).order('created_at', { ascending: true }),
      sb.from('batches').select('id,recipe_id,amount_m3,datetime,gwp,app_data,created_at').eq('user_id', user.id).order('datetime', { ascending: false }),
      sb.from('cubes').select('id,recipe_id,cast_date,due_date,strength_mpa,weight,vct,vct_eq,air,temp,kw,batch_id,note,app_data,created_at').eq('user_id', user.id).order('cast_date', { ascending: false }),
      sb.from('air').select('id,recipe_id,date,pct,note,app_data,created_at').eq('user_id', user.id).order('date', { ascending: false }),
      sb.from('customers').select('id,name,contact,info,app_data,created_at').eq('user_id', user.id).order('created_at', { ascending: true }),
      sb.from('orders').select('id,customer_id,recipe_id,order_name,amount_m3,gwp,delivery_date,note,app_data,created_at').eq('user_id', user.id).order('delivery_date', { ascending: false }),
      sb.from('control_devices').select('id,type,name,serial,checks,app_data,created_at').eq('user_id', user.id).order('created_at', { ascending: true }),
      sb.from('diary_entries').select('id,entry_date,weather,vct_req,vct_meas,temp_out,temp_cure,temp_lab,air_req_min,air_meas,water_density,note,imports,app_data,created_at').eq('user_id', user.id).order('entry_date', { ascending: false }),
      sb.from('tasks').select('id,title,freq,log,app_data,created_at').eq('user_id', user.id).order('created_at', { ascending: true })
    ]);

    if (recipesRes.error) throw recipesRes.error;
    if (materialsRes.error) throw materialsRes.error;
    if (batchesRes.error) throw batchesRes.error;
    if (cubesRes.error) throw cubesRes.error;
    if (airRes.error) throw airRes.error;
    if (customersRes.error) throw customersRes.error;
    if (ordersRes.error) throw ordersRes.error;
    if (controlRes.error) throw controlRes.error;
    if (diaryRes.error) throw diaryRes.error;
    if (tasksRes.error) throw tasksRes.error;

    RECIPES = (recipesRes.data || []).map(normalizeRecipeRow);
    MATERIALS = (materialsRes.data || []).map(normalizeMaterialRow);
    BATCHES = (batchesRes.data || []).map(normalizeBatchRow);
    CUBES = (cubesRes.data || []).map(normalizeCubeRow);
    AIR = (airRes.data || []).map(normalizeAirRow);
    CUSTOMERS = (customersRes.data || []).map(normalizeCustomerRow);
    ORDERS = (ordersRes.data || []).map(normalizeOrderRow);
    CONTROL_DEVICES = (controlRes.data || []).map(normalizeControlDeviceRow);
    DIARY = {};
    (diaryRes.data || []).map(normalizeDiaryRow).forEach(entry => { DIARY[entry.date] = entry; });
    TASKS = { items: (tasksRes.data || []).map(normalizeTaskRow) };

    renderRecipes?.();
    renderRecipeSelects?.();
    renderMaterials?.();
    syncMaterialNamesDatalist?.();
    renderBatches?.();
    renderCubes?.();
    renderAir?.();
    renderCustomers?.();
    renderCustomerSelects?.();
    renderOrders?.();
    renderControlDevices?.();
    renderDiaryInit?.();
    renderTasks?.();
    LAST_CLOUD_SYNC_AT = new Date();
    CLOUD_LOADING = false;
    renderDashboard?.();
    updateCloudDashboardMeta?.();

    console.log('Molndata laddad:', { recipes: RECIPES.length, materials: MATERIALS.length, batches: BATCHES.length, cubes: CUBES.length, air: AIR.length, customers: CUSTOMERS.length, orders: ORDERS.length, controlDevices: CONTROL_DEVICES.length, diaryEntries: Object.keys(DIARY||{}).length, tasks: TASKS.items.length });
  } catch (err) {
    CLOUD_LOADING = false;
    updateCloudDashboardMeta?.();
    showSupabaseError('Kunde inte ladda molndata från Supabase', err);
  }
}

async function saveRecipeToSupabase(recipe){
  const user = await getRequiredCloudUser('spara recept i molnet');
  if (!user) return null;

  const payload = {
    user_id: user.id,
    name: recipe.name,
    strength: recipe.strength || '',
    vct: Number.isFinite(Number(recipe.vct)) ? Number(recipe.vct) : null,
    vct_eq: Number.isFinite(Number(recipe.vctEq)) ? Number(recipe.vctEq) : null,
    air_req: Number.isFinite(Number(recipe.airReq)) ? Number(recipe.airReq) : null,
    app_data: recipe
  };

  if (recipe.cloudId) {
    const { data, error } = await sb
      .from('recipes')
      .update(payload)
      .eq('id', recipe.cloudId)
      .eq('user_id', user.id)
      .select('id,name,strength,vct,vct_eq,air_req,app_data,created_at')
      .single();
    if (error) { showSupabaseError('Fel vid uppdatering av recept i Supabase', error); return null; }
    return normalizeRecipeRow(data);
  }

  const { data, error } = await sb
    .from('recipes')
    .insert([payload])
    .select('id,name,strength,vct,vct_eq,air_req,app_data,created_at')
    .single();
  if (error) { showSupabaseError('Fel vid sparning av recept i Supabase', error); return null; }
  return normalizeRecipeRow(data);
}

async function deleteRecipeFromSupabase(recipe){
  const user = await getRequiredCloudUser('ta bort recept i molnet');
  if (!user) return false;
  const cloudId = recipe.cloudId || recipe.id;
  const { error } = await sb.from('recipes').delete().eq('id', cloudId).eq('user_id', user.id);
  if (error) { showSupabaseError('Fel vid borttagning av recept i Supabase', error); return false; }
  return true;
}

async function saveMaterialToSupabase(material){
  const user = await getRequiredCloudUser('spara material i molnet');
  if (!user) return null;

  const payload = {
    user_id: user.id,
    name: material.name,
    type: material.type,
    ef: Number.isFinite(Number(material.ef)) ? Number(material.ef) : 0,
    note: material.note || '',
    app_data: material
  };

  if (material.cloudId) {
    const { data, error } = await sb
      .from('materials')
      .update(payload)
      .eq('id', material.cloudId)
      .eq('user_id', user.id)
      .select('id,name,type,ef,note,app_data,created_at')
      .single();
    if (error) { showSupabaseError('Fel vid uppdatering av material i Supabase', error); return null; }
    return normalizeMaterialRow(data);
  }

  const { data, error } = await sb
    .from('materials')
    .insert([payload])
    .select('id,name,type,ef,note,app_data,created_at')
    .single();
  if (error) { showSupabaseError('Fel vid sparning av material i Supabase', error); return null; }
  return normalizeMaterialRow(data);
}

async function deleteMaterialFromSupabase(material){
  const user = await getRequiredCloudUser('ta bort material i molnet');
  if (!user) return false;
  const cloudId = material.cloudId || material.id;
  const { error } = await sb.from('materials').delete().eq('id', cloudId).eq('user_id', user.id);
  if (error) { showSupabaseError('Fel vid borttagning av material i Supabase', error); return false; }
  return true;
}

async function saveBatchToSupabase(batch){
  const user = await getRequiredCloudUser('spara sats i molnet');
  if (!user) return null;

  const payload = {
    user_id: user.id,
    recipe_id: batch.recipeCloudId || null,
    amount_m3: Number(batch.amount) || 0,
    datetime: batch.dateTime,
    gwp: Number(batch.gwpPerM3) || 0,
    app_data: batch
  };

  if (batch.cloudId) {
    const { data, error } = await sb
      .from('batches')
      .update(payload)
      .eq('id', batch.cloudId)
      .eq('user_id', user.id)
      .select('id,recipe_id,amount_m3,datetime,gwp,app_data,created_at')
      .single();
    if (error) { showSupabaseError('Fel vid uppdatering av sats i Supabase', error); return null; }
    return normalizeBatchRow(data);
  }

  const { data, error } = await sb
    .from('batches')
    .insert([payload])
    .select('id,recipe_id,amount_m3,datetime,gwp,app_data,created_at')
    .single();
  if (error) { showSupabaseError('Fel vid sparning av sats i Supabase', error); return null; }
  return normalizeBatchRow(data);
}

async function deleteBatchFromSupabase(batch){
  const user = await getRequiredCloudUser('ta bort sats i molnet');
  if (!user) return false;
  const cloudId = batch.cloudId || batch.id;
  const { error } = await sb.from('batches').delete().eq('id', cloudId).eq('user_id', user.id);
  if (error) { showSupabaseError('Fel vid borttagning av sats i Supabase', error); return false; }
  return true;
}

async function saveCubeToSupabase(cube){
  const user = await getRequiredCloudUser('spara provkub i molnet');
  if (!user) return null;

  const payload = {
    user_id: user.id,
    recipe_id: cube.recipeCloudId || null,
    cast_date: cube.castDate || null,
    due_date: cube.dueDate || null,
    strength_mpa: Number.isFinite(Number(cube.resultMPa)) ? Number(cube.resultMPa) : null,
    weight: Number.isFinite(Number(cube.weight)) ? Number(cube.weight) : null,
    vct: Number.isFinite(Number(cube.vct)) ? Number(cube.vct) : null,
    vct_eq: Number.isFinite(Number(cube.vctEq)) ? Number(cube.vctEq) : null,
    air: Number.isFinite(Number(cube.air)) ? Number(cube.air) : null,
    temp: Number.isFinite(Number(cube.temp)) ? Number(cube.temp) : null,
    kw: Number.isFinite(Number(cube.kw)) ? Number(cube.kw) : null,
    batch_id: cube.batchId || null,
    note: cube.note || '',
    app_data: cube
  };

  if (cube.cloudId) {
    const { data, error } = await sb
      .from('cubes')
      .update(payload)
      .eq('id', cube.cloudId)
      .eq('user_id', user.id)
      .select('id,recipe_id,cast_date,due_date,strength_mpa,weight,vct,vct_eq,air,temp,kw,batch_id,note,app_data,created_at')
      .single();
    if (error) { showSupabaseError('Fel vid uppdatering av provkub i Supabase', error); return null; }
    return normalizeCubeRow(data);
  }

  const { data, error } = await sb
    .from('cubes')
    .insert([payload])
    .select('id,recipe_id,cast_date,due_date,strength_mpa,weight,vct,vct_eq,air,temp,kw,batch_id,note,app_data,created_at')
    .single();
  if (error) { showSupabaseError('Fel vid sparning av provkub i Supabase', error); return null; }
  return normalizeCubeRow(data);
}

async function deleteCubeFromSupabase(cube){
  const user = await getRequiredCloudUser('ta bort provkub i molnet');
  if (!user) return false;
  const cloudId = cube.cloudId || cube.id;
  const { error } = await sb.from('cubes').delete().eq('id', cloudId).eq('user_id', user.id);
  if (error) { showSupabaseError('Fel vid borttagning av provkub i Supabase', error); return false; }
  return true;
}

async function saveAirToSupabase(airSample){
  const user = await getRequiredCloudUser('spara luftprov i molnet');
  if (!user) return null;

  const payload = {
    user_id: user.id,
    recipe_id: airSample.recipeCloudId || null,
    date: airSample.date || null,
    pct: Number.isFinite(Number(airSample.pct)) ? Number(airSample.pct) : null,
    note: airSample.note || '',
    app_data: airSample
  };

  if (airSample.cloudId) {
    const { data, error } = await sb
      .from('air')
      .update(payload)
      .eq('id', airSample.cloudId)
      .eq('user_id', user.id)
      .select('id,recipe_id,date,pct,note,app_data,created_at')
      .single();
    if (error) { showSupabaseError('Fel vid uppdatering av luftprov i Supabase', error); return null; }
    return normalizeAirRow(data);
  }

  const { data, error } = await sb
    .from('air')
    .insert([payload])
    .select('id,recipe_id,date,pct,note,app_data,created_at')
    .single();
  if (error) { showSupabaseError('Fel vid sparning av luftprov i Supabase', error); return null; }
  return normalizeAirRow(data);
}

async function deleteAirFromSupabase(airSample){
  const user = await getRequiredCloudUser('ta bort luftprov i molnet');
  if (!user) return false;
  const cloudId = airSample.cloudId || airSample.id;
  const { error } = await sb.from('air').delete().eq('id', cloudId).eq('user_id', user.id);
  if (error) { showSupabaseError('Fel vid borttagning av luftprov i Supabase', error); return false; }
  return true;
}


async function saveCustomerToSupabase(customer){
  const user = await getRequiredCloudUser('spara kund i molnet');
  if (!user) return null;

  const payload = {
    user_id: user.id,
    name: customer.name || '',
    contact: customer.contactPerson || '',
    info: customer.info || '',
    app_data: customer
  };

  if (customer.cloudId) {
    const { data, error } = await sb
      .from('customers')
      .update(payload)
      .eq('id', customer.cloudId)
      .eq('user_id', user.id)
      .select('id,name,contact,info,app_data,created_at')
      .single();
    if (error) { showSupabaseError('Fel vid uppdatering av kund i Supabase', error); return null; }
    return normalizeCustomerRow(data);
  }

  const { data, error } = await sb
    .from('customers')
    .insert([payload])
    .select('id,name,contact,info,app_data,created_at')
    .single();
  if (error) { showSupabaseError('Fel vid sparning av kund i Supabase', error); return null; }
  return normalizeCustomerRow(data);
}

async function deleteCustomerFromSupabase(customer){
  const user = await getRequiredCloudUser('ta bort kund i molnet');
  if (!user) return false;
  const cloudId = customer.cloudId || customer.id;
  const { error } = await sb.from('customers').delete().eq('id', cloudId).eq('user_id', user.id);
  if (error) { showSupabaseError('Fel vid borttagning av kund i Supabase', error); return false; }
  return true;
}

async function saveOrderToSupabase(order){
  const user = await getRequiredCloudUser('spara beställning i molnet');
  if (!user) return null;

  const payload = {
    user_id: user.id,
    customer_id: order.customerCloudId || order.customerId || null,
    recipe_id: order.recipeCloudId || order.recipeId || null,
    order_name: order.recipeName || '',
    amount_m3: Number(order.amount) || 0,
    gwp: Number(order.gwpPerM3) || 0,
    delivery_date: order.dateTime || null,
    note: order.orderInfo || '',
    app_data: order
  };

  if (order.cloudId) {
    const { data, error } = await sb
      .from('orders')
      .update(payload)
      .eq('id', order.cloudId)
      .eq('user_id', user.id)
      .select('id,customer_id,recipe_id,order_name,amount_m3,gwp,delivery_date,note,app_data,created_at')
      .single();
    if (error) { showSupabaseError('Fel vid uppdatering av beställning i Supabase', error); return null; }
    return normalizeOrderRow(data);
  }

  const { data, error } = await sb
    .from('orders')
    .insert([payload])
    .select('id,customer_id,recipe_id,order_name,amount_m3,gwp,delivery_date,note,app_data,created_at')
    .single();
  if (error) { showSupabaseError('Fel vid sparning av beställning i Supabase', error); return null; }
  return normalizeOrderRow(data);
}

async function deleteOrderFromSupabase(order){
  const user = await getRequiredCloudUser('ta bort beställning i molnet');
  if (!user) return false;
  const cloudId = order.cloudId || order.id;
  const { error } = await sb.from('orders').delete().eq('id', cloudId).eq('user_id', user.id);
  if (error) { showSupabaseError('Fel vid borttagning av beställning i Supabase', error); return false; }
  return true;
}

async function saveControlDeviceToSupabase(device){
  const user = await getRequiredCloudUser('spara kontrollinstrument i molnet');
  if (!user) return null;

  const payload = {
    user_id: user.id,
    type: device.type || 'air',
    name: device.name || '',
    serial: device.serial || '',
    checks: device.checks || {},
    app_data: device
  };

  if (device.cloudId) {
    const { data, error } = await sb
      .from('control_devices')
      .update(payload)
      .eq('id', device.cloudId)
      .eq('user_id', user.id)
      .select('id,type,name,serial,checks,app_data,created_at')
      .single();
    if (error) { showSupabaseError('Fel vid uppdatering av kontrollinstrument i Supabase', error); return null; }
    return normalizeControlDeviceRow(data);
  }

  const { data, error } = await sb
    .from('control_devices')
    .insert([payload])
    .select('id,type,name,serial,checks,app_data,created_at')
    .single();
  if (error) { showSupabaseError('Fel vid sparning av kontrollinstrument i Supabase', error); return null; }
  return normalizeControlDeviceRow(data);
}

async function deleteControlDeviceFromSupabase(device){
  const user = await getRequiredCloudUser('ta bort kontrollinstrument i molnet');
  if (!user) return false;
  const cloudId = device.cloudId || device.id;
  const { error } = await sb.from('control_devices').delete().eq('id', cloudId).eq('user_id', user.id);
  if (error) { showSupabaseError('Fel vid borttagning av kontrollinstrument i Supabase', error); return false; }
  return true;
}

async function saveDiaryEntryToSupabase(entryDate, entry){
  const user = await getRequiredCloudUser('spara dagbok i molnet');
  if (!user) return null;

  const appData = { ...entry, date: entryDate, cloudId: entry.cloudId || entry.id || null };
  const payload = {
    user_id: user.id,
    entry_date: entryDate,
    weather: entry.weather || '',
    vct_req: entry.vctReq || '',
    vct_meas: entry.vctMeas || '',
    temp_out: Number.isFinite(Number(entry.tOut)) ? Number(entry.tOut) : null,
    temp_cure: Number.isFinite(Number(entry.tCure)) ? Number(entry.tCure) : null,
    temp_lab: Number.isFinite(Number(entry.tLab)) ? Number(entry.tLab) : null,
    air_req_min: Number.isFinite(Number(entry.airReqMin)) ? Number(entry.airReqMin) : null,
    air_meas: Number.isFinite(Number(entry.airMeas)) ? Number(entry.airMeas) : null,
    water_density: Number.isFinite(Number(entry.waterDensity)) ? Number(entry.waterDensity) : null,
    note: entry.note || '',
    imports: Array.isArray(entry.imports) ? entry.imports : [],
    app_data: appData
  };

  const { data, error } = await sb
    .from('diary_entries')
    .upsert(payload, { onConflict: 'user_id,entry_date' })
    .select('id,entry_date,weather,vct_req,vct_meas,temp_out,temp_cure,temp_lab,air_req_min,air_meas,water_density,note,imports,app_data,created_at')
    .single();

  if (error) { showSupabaseError('Fel vid sparning av dagbok i Supabase', error); return null; }
  return normalizeDiaryRow(data);
}
