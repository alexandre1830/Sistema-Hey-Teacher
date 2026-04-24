/* ==========================================================================
   SIDEBAR.JS — Comportamento do menu lateral
   ========================================================================== */

window.HT = window.HT || {};

HT.sidebar = (() => {

  function init() {
    const sidebar  = document.getElementById('sidebar');
    const overlay  = document.getElementById('sidebarOverlay');
    const toggle   = document.getElementById('sidebarToggle');
    const closeBtn = document.getElementById('sidebarClose');

    if (!sidebar) return;

    function open() {
      sidebar.classList.add('is-open');
      overlay.classList.add('is-visible');
      overlay.style.display = 'block';
      document.body.classList.add('sidebar-open');
    }

    function close() {
      sidebar.classList.remove('is-open');
      overlay.classList.remove('is-visible');
      document.body.classList.remove('sidebar-open');
      setTimeout(() => {
        if (!sidebar.classList.contains('is-open')) overlay.style.display = '';
      }, 300);
    }

    toggle?.addEventListener('click',  open);
    closeBtn?.addEventListener('click', close);
    overlay?.addEventListener('click',  close);

    // Fechar com Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidebar.classList.contains('is-open')) close();
    });

    // Fechar ao redimensionar para desktop
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 768) close();
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  return { init };
})();
