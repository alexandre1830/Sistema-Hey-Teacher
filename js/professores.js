/* ==========================================================================
   PROFESSORES.JS — Convites e acesso dos professores (somente admin)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {

  const { utils, storage, modals } = HT;

  /* ====== Cache local ====== */
  let teachers        = [];
  let allClasses      = [];
  let allStudents     = [];
  let pendingRemoveId = null;

  const grid    = document.getElementById('teachersGrid');
  const countEl = document.getElementById('teachersCount');

  /* ====== Carregar ====== */
  async function load() {
    try {
      const [res, classes, students] = await Promise.all([
        storage.manageTeachers('list'),
        storage.getClasses(),
        storage.getStudents(),
      ]);
      teachers    = res.teachers || [];
      allClasses  = classes;
      allStudents = students;
      render();
    } catch (err) {
      if (grid) grid.innerHTML = `<div class="empty-state">
        <i class="fa-solid fa-triangle-exclamation empty-state-icon"></i>
        <p class="empty-state-title">Não foi possível carregar os professores</p>
        <p class="empty-state-desc">${err.message}</p>
      </div>`;
      console.error(err);
    }
  }

  /* Turmas do professor + alunos dele (das turmas e das aulas individuais) */
  function teacherLoad(tid) {
    const classes   = allClasses.filter(c => c.teacherId === tid);
    const classIds  = new Set(classes.map(c => c.id));
    const students  = allStudents.filter(s =>
      (s.status || 'active') === 'active' && (s.classId ? classIds.has(s.classId) : s.teacherId === tid));
    return { classes: classes.length, students: students.length };
  }

  function render() {
    if (countEl) countEl.textContent = `${teachers.length} professor${teachers.length !== 1 ? 'es' : ''}`;
    if (!grid) return;

    if (!teachers.length) {
      grid.innerHTML = `<div class="empty-state">
        <i class="fa-solid fa-chalkboard-user empty-state-icon"></i>
        <p class="empty-state-title">Nenhum professor convidado</p>
        <p class="empty-state-desc">Clique em "Convidar Professor" para dar acesso a alguém da equipe</p>
        <button class="btn btn--primary" id="inviteFirstBtn"><i class="fa-solid fa-paper-plane"></i> Convidar Professor</button>
      </div>`;
      document.getElementById('inviteFirstBtn')?.addEventListener('click', openInvite);
      return;
    }

    grid.innerHTML = teachers.map(t => {
      const load = teacherLoad(t.id);
      const status = t.pending
        ? '<span class="badge badge--pending">Convite pendente</span>'
        : '<span class="badge badge--active">Ativo</span>';
      const lastSeen = t.lastSignIn
        ? `Último acesso: ${utils.formatDate(t.lastSignIn.slice(0, 10))}`
        : `Convidado em ${t.invitedAt ? utils.formatDate(t.invitedAt.slice(0, 10)) : '—'}`;

      return `
        <div class="student-card" data-id="${t.id}">
          <div class="student-card-header">
            <div class="student-card-avatar">${utils.getInitials(t.name || t.email)}</div>
            <div class="student-card-info">
              <div class="student-card-name">${t.name || '—'}</div>
              <div class="student-card-level">${t.email}</div>
            </div>
          </div>
          <div class="student-card-meta">
            <div class="student-card-meta-item"><i class="fa-solid fa-users"></i>${load.classes} turma${load.classes !== 1 ? 's' : ''}</div>
            <div class="student-card-meta-item"><i class="fa-solid fa-user-graduate"></i>${load.students} aluno${load.students !== 1 ? 's' : ''} ativo${load.students !== 1 ? 's' : ''}</div>
            <div class="student-card-meta-item"><i class="fa-regular fa-clock"></i>${lastSeen}</div>
          </div>
          <div class="student-card-footer">
            ${status}
            <div class="table-row-actions">
              ${t.pending ? `<button class="action-btn action-btn--edit" data-action="resend" data-email="${t.email}" title="Reenviar convite">
                <i class="fa-solid fa-paper-plane"></i></button>` : ''}
              <button class="action-btn action-btn--delete" data-action="remove" data-id="${t.id}" title="Remover acesso">
                <i class="fa-solid fa-user-slash"></i></button>
            </div>
          </div>
        </div>`;
    }).join('');

    grid.querySelectorAll('[data-action="resend"]').forEach(btn =>
      btn.addEventListener('click', () => resend(btn)));
    grid.querySelectorAll('[data-action="remove"]').forEach(btn =>
      btn.addEventListener('click', () => confirmRemove(btn.dataset.id)));
  }

  /* ====== Convidar ====== */
  function openInvite() {
    document.getElementById('inviteForm').reset();
    document.getElementById('teacherNameError').textContent  = '';
    document.getElementById('teacherEmailError').textContent = '';
    modals.open('inviteModalOverlay');
    setTimeout(() => document.getElementById('teacherName')?.focus(), 50);
  }

  document.getElementById('inviteTeacherBtn')?.addEventListener('click', openInvite);
  document.getElementById('inviteCancel')?.addEventListener('click',     () => modals.close('inviteModalOverlay'));
  document.getElementById('inviteModalClose')?.addEventListener('click', () => modals.close('inviteModalOverlay'));

  document.getElementById('inviteForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameErr  = document.getElementById('teacherNameError');
    const emailErr = document.getElementById('teacherEmailError');
    nameErr.textContent = emailErr.textContent = '';

    const name  = utils.getInputValue('teacherName');
    const email = utils.getInputValue('teacherEmail').toLowerCase();
    let valid = true;
    if (!name) { nameErr.textContent = 'Informe o nome.'; valid = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { emailErr.textContent = 'E-mail inválido.'; valid = false; }
    if (!valid) return;

    const btn = document.getElementById('inviteSend');
    btn.classList.add('is-loading');
    try {
      await storage.manageTeachers('invite', { name, email, redirectTo: HT.auth.ROOT + 'index.html' });
      modals.close('inviteModalOverlay');
      utils.showToast(`Convite enviado para ${email}!`, 'success');
      await load();
    } catch (err) {
      emailErr.textContent = err.message;
    } finally {
      btn.classList.remove('is-loading');
    }
  });

  /* ====== Reenviar convite ====== */
  async function resend(btn) {
    btn.disabled = true;
    try {
      await storage.manageTeachers('resend', { email: btn.dataset.email, redirectTo: HT.auth.ROOT + 'index.html' });
      utils.showToast('Convite reenviado!', 'success');
    } catch (err) {
      utils.showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  }

  /* ====== Remover acesso ====== */
  function confirmRemove(id) {
    const t = teachers.find(x => x.id === id);
    if (!t) return;
    pendingRemoveId = id;
    document.getElementById('removeConfirmDesc').textContent =
      `Remover o acesso de "${t.name || t.email}"? A conta será apagada e as turmas e alunos dele ficarão sem professor. ` +
      'As frequências que ele registrou continuam no sistema.';
    modals.open('removeConfirmOverlay');
  }

  document.getElementById('removeCancel')?.addEventListener('click', () => {
    pendingRemoveId = null;
    modals.close('removeConfirmOverlay');
  });

  document.getElementById('removeConfirm')?.addEventListener('click', async () => {
    if (!pendingRemoveId) return;
    const btn = document.getElementById('removeConfirm');
    btn.classList.add('is-loading');
    try {
      await storage.manageTeachers('remove', { id: pendingRemoveId });
      modals.close('removeConfirmOverlay');
      utils.showToast('Acesso removido.', 'warning');
      pendingRemoveId = null;
      await load();
    } catch (err) {
      utils.showToast(err.message, 'error');
    } finally {
      btn.classList.remove('is-loading');
    }
  });

  /* ====== Init ====== */
  await load();
});
