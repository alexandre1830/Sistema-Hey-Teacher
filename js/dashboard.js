/* ==========================================================================
   DASHBOARD.JS — Lógica da página principal
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {

  const { utils, storage, calendar } = HT;

  /* ---------- Data atual no topbar ---------- */
  const dateEl = document.getElementById('currentDate');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('pt-BR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  /* ---------- Carregar todos os dados de uma vez ---------- */
  const month = utils.getCurrentMonth();
  const [students, classes, attendance, payments] = await Promise.all([
    storage.getStudents(),
    storage.getClasses(),
    storage.getAttendance(),
    storage.getPayments(),
  ]);

  /* Injeta dados no calendar para evitar chamadas duplicadas ao Supabase */
  calendar.setData(students, classes);

  /* ---------- Cards de resumo ---------- */
  function loadStats() {
    const monthAtt  = attendance.filter(r => r.date.startsWith(month));
    const monthPaid = payments.filter(p => p.reference === month && p.status === 'paid');
    const revenue   = monthPaid.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    utils.setTextContent('statStudents', students.length);
    utils.setTextContent('statClasses',  classes.length);
    utils.setTextContent('statLessons',  monthAtt.length);
    utils.setTextContent('statRevenue',  utils.formatCurrency(revenue));
  }

  /* ---------- Próximas aulas ---------- */
  async function loadUpcoming() {
    const container = document.getElementById('upcomingList');
    if (!container) return;

    const upcoming = await calendar.getUpcoming(6);

    if (!upcoming.length) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fa-regular fa-calendar-xmark empty-state-icon"></i>
          <p>Nenhuma aula agendada</p>
        </div>`;
      return;
    }

    container.innerHTML = upcoming.map(ev => {
      const dt      = new Date(ev.start);
      const time    = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const date    = dt.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
      const isToday = ev.start.startsWith(utils.getCurrentDate());

      const levelShort = utils.formatLevelShort(ev.extendedProps.level);
      const typeLabel  = ev.extendedProps.type === 'class' ? 'Turma' : 'Individual';
      const subLabel   = levelShort || (ev.extendedProps.type === 'class' ? 'Turma' : '—');

      return `
        <div class="upcoming-item">
          <div class="upcoming-time">${isToday ? 'Hoje' : date}<br>${time}</div>
          <div class="upcoming-info">
            <div class="upcoming-name">${ev.title}</div>
            <div class="upcoming-class">${subLabel}</div>
          </div>
          <span class="upcoming-badge">${typeLabel}</span>
        </div>`;
    }).join('');
  }

  /* ---------- Init ---------- */
  loadStats();
  await Promise.all([
    calendar.init('calendar'),
    loadUpcoming(),
  ]);
});
