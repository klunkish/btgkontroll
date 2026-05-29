/***********************************************************
 * v18.3.1 SAFE SIDEBAR BEHAVIOUR
 * Lägger endast till mobilknapp/backdrop och stänger menyn
 * efter val på mobil. Rör inte dashboard eller datalogik.
 ***********************************************************/
(function(){
  function initSafeSidebar(){
    if (document.getElementById('mobileSidebarToggle')) return;
    const btn = document.createElement('button');
    btn.id = 'mobileSidebarToggle';
    btn.className = 'mobile-sidebar-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-label','Öppna meny');
    btn.textContent = '☰';

    const backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    backdrop.id = 'sidebarBackdrop';

    document.body.prepend(backdrop);
    document.body.prepend(btn);

    const close = () => document.body.classList.remove('sidebar-open');
    btn.addEventListener('click', () => document.body.classList.toggle('sidebar-open'));
    backdrop.addEventListener('click', close);
    document.querySelectorAll('header .tab-btn, header [data-nav]').forEach(el => {
      el.addEventListener('click', () => { if (window.innerWidth <= 900) close(); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSafeSidebar);
  else initSafeSidebar();
})();
