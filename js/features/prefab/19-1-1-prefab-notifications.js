(function(){
  const PATCH_ID = 'prefab-notifications-v19-1-1';
  let knownNewIds = new Set();
  let firstRun = true;
  let timer = null;
  let lastFactoryId = null;

  function log(){ try { console.log('[BTG notifications]', ...arguments); } catch(_){} }
  function currentUserSafe(){ try { return (typeof CURRENT_USER !== 'undefined') ? CURRENT_USER : null; } catch(_) { return null; } }
  async function getUserId(){
    try {
      if (currentUserSafe()?.id) return currentUserSafe().id;
      if (window.sb?.auth?.getUser){
        const { data } = await sb.auth.getUser();
        return data?.user?.id || null;
      }
    } catch(_) {}
    return null;
  }
  function fmt(v){ return String(v == null ? '' : v); }
  function playSound(){
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
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.5);
      setTimeout(()=>ctx.close?.(), 800);
    } catch(e){ log('Ljud blockerades', e); }
  }
  function canNotify(){ return 'Notification' in window && Notification.permission === 'granted'; }
  function notifyOrder(r){
    const title = 'Ny prefab-beställning';
    const body = [
      r.table_no ? 'Bord: ' + r.table_no : '',
      r.strength ? 'Hållfasthet: ' + r.strength : '',
      r.amount_m3 ? 'Mängd: ' + r.amount_m3 + ' m³' : '',
      r.drawing_no ? 'Littra: ' + r.drawing_no : '',
      r.requester_name ? 'Beställare: ' + r.requester_name : ''
    ].filter(Boolean).join(' • ');
    playSound();
    if (canNotify()){
      try{
        const n = new Notification(title, { body, tag: 'prefab-' + r.id, renotify: true });
        n.onclick = function(){
          window.focus();
          try { if (typeof setTab === 'function') setTab('prefab'); } catch(_){}
          n.close();
        };
      } catch(e){ log('Notis kunde inte visas', e); }
    }
  }
  async function getFactoryId(){
    if (!window.sb) return null;
    const uid = await getUserId();
    if (!uid) return null;
    try{
      const { data, error } = await sb.from('factory_members').select('factory_id, role').eq('user_id', uid).limit(1);
      if (error) throw error;
      const row = data && data[0];
      return row?.factory_id || null;
    }catch(e){ log('Kunde inte läsa factory_members', e); return null; }
  }
  async function poll(){
    if (!window.sb) return;
    const factoryId = await getFactoryId();
    if (!factoryId) return;
    if (factoryId !== lastFactoryId){
      knownNewIds = new Set();
      firstRun = true;
      lastFactoryId = factoryId;
    }
    try{
      const { data, error } = await sb
        .from('prefab_requests')
        .select('id, status, table_no, strength, amount_m3, drawing_no, requester_name, created_at')
        .eq('factory_id', factoryId)
        .eq('status', 'new')
        .order('created_at', { ascending:false })
        .limit(50);
      if (error) throw error;
      const rows = data || [];
      const ids = new Set(rows.map(r=>r.id));
      if (!firstRun){
        rows.filter(r=>!knownNewIds.has(r.id)).forEach(notifyOrder);
      }
      knownNewIds = ids;
      firstRun = false;
    }catch(e){ log('Kunde inte polla prefab_requests', e); }
  }
  function notificationStatusText(){
    if (!('Notification' in window)) return 'Notiser stöds inte i denna webbläsare';
    if (Notification.permission === 'granted') return 'Notiser aktiverade';
    if (Notification.permission === 'denied') return 'Notiser blockerade i webbläsaren';
    return 'Notiser inte aktiverade';
  }
  function ensureButton(){
    const card = document.getElementById('prefabRequestFormCard') || document.getElementById('tab-prefab');
    if (!card || document.getElementById('btnEnablePrefabNotifications')) return;
    const toolbar = card.querySelector('.toolbar') || card;
    const btn = document.createElement('button');
    btn.id = 'btnEnablePrefabNotifications';
    btn.type = 'button';
    btn.className = 'btn secondary';
    btn.textContent = '🔔 Aktivera notiser';
    btn.title = notificationStatusText();
    btn.addEventListener('click', async ()=>{
      if (!('Notification' in window)) { alert('Den här webbläsaren stödjer inte browser-notiser.'); return; }
      try{
        const perm = await Notification.requestPermission();
        btn.title = notificationStatusText();
        btn.textContent = perm === 'granted' ? '🔔 Notiser aktiva' : '🔕 Aktivera notiser';
        if (perm === 'granted'){
          playSound();
          await poll();
          alert('Notiser är aktiverade för prefab-beställningar.');
        } else {
          alert('Notiser aktiverades inte. Kontrollera webbläsarens behörigheter.');
        }
      }catch(e){ alert('Kunde inte aktivera notiser.'); }
    });
    toolbar.appendChild(btn);
  }
  function start(){
    ensureButton();
    if (!timer){
      poll();
      timer = setInterval(()=>{ ensureButton(); poll(); }, 30000);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  window.addEventListener('focus', poll);
})();
