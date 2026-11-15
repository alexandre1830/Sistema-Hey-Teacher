/* ==========================================================================
   AUTH.JS — Autenticação com Supabase Auth
   ========================================================================== */

window.HT = window.HT || {};

HT.auth = (() => {

  const db = HT.supabase;

  /* Raiz do site, derivada do local deste script (js/auth.js) —
     funciona em qualquer profundidade de pasta (/, /alunos/, ...) */
  const ROOT = new URL('../', document.currentScript.src).href;
  const LOGIN_URL     = ROOT;
  const DASHBOARD_URL = ROOT + 'dashboard/';

  const ROLE_LABELS = { admin: 'Administrador', teacher: 'Professor(a)' };

  /* Aplica o papel cedo (cache do último acesso) para evitar piscar itens de admin */
  try {
    const cached = localStorage.getItem('ht_role');
    if (cached) document.documentElement.dataset.role = cached;
  } catch { /* storage indisponível */ }

  function applyRole(role) {
    document.documentElement.dataset.role = role;
    try { localStorage.setItem('ht_role', role); } catch { /* storage indisponível */ }
    document.querySelectorAll('.user-role, .profile-header-role')
      .forEach(el => { el.textContent = ROLE_LABELS[role] || ''; });
  }

  /* ====== Sessão ====== */
  async function isAuthenticated() {
    const { data: { session } } = await db.auth.getSession();
    return session !== null;
  }

  async function getUser() {
    const { data: { user } } = await db.auth.getUser();
    return user;
  }

  /* ====== Login ====== */
  async function login(email, password) {
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) return { success: false, message: _errorMsg(error) };
    return { success: true, user: data.user };
  }

  /* ====== Logout ====== */
  async function logout() {
    await db.auth.signOut();
    try { localStorage.removeItem('ht_role'); } catch { /* storage indisponível */ }
    window.location.href = LOGIN_URL;
  }

  /* ====== Proteção de rotas ====== */
  async function requireAuth() {
    const ok = await isAuthenticated();
    if (!ok) { window.location.replace(LOGIN_URL); return false; }

    /* Conta sem papel (cadastro avulso ou acesso removido) não entra */
    const { role, schoolId } = await HT.storage.getContext();
    if (!role || !schoolId) {
      await db.auth.signOut();
      try { localStorage.removeItem('ht_role'); } catch { /* storage indisponível */ }
      window.location.replace(LOGIN_URL + '?semacesso=1');
      return false;
    }

    applyRole(role);

    /* Páginas só do admin (Turmas, Finanças, Professores) */
    if (role !== 'admin' && document.body.hasAttribute('data-admin-page')) {
      window.location.replace(DASHBOARD_URL);
      return false;
    }
    return true;
  }

  function _errorMsg(error) {
    const msg = error.message || '';
    if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
    if (msg.includes('Email not confirmed'))        return 'Confirme seu e-mail antes de entrar.';
    if (msg.includes('Too many requests'))          return 'Muitas tentativas. Aguarde alguns minutos.';
    return msg || 'Erro ao fazer login.';
  }

  /* ====== Sidebar: nome do usuário ====== */
  async function populateUserInfo() {
    try {
      const profile = await HT.storage.getProfile();
      const nameEl  = document.getElementById('sidebarUserName');
      if (nameEl) nameEl.textContent = profile?.name || 'Professor';
    } catch { /* silencioso */ }
  }

  /* ====== Auto-init ====== */
  (() => {
    /* A única página pública é o login, na raiz (/ ou /index.html) */
    const rootPath    = new URL(ROOT).pathname;
    const path        = window.location.pathname;
    const isLoginPage = path === rootPath || path === rootPath + 'index.html';

    /* Espera o DOMContentLoaded mesmo com readyState "interactive": scripts defer
       rodam nessa fase, e o storage.js (carregado depois deste) ainda não existe */
    function onReady(fn) {
      if (document.readyState === 'complete') fn();
      else document.addEventListener('DOMContentLoaded', fn);
    }

    if (!isLoginPage) {
      onReady(async () => {
        if (await requireAuth()) await populateUserInfo();
      });
    } else {
      onReady(async () => {
        const link = window.__authLink || {};

        /* Link de convite/recuperação: o Supabase abre a sessão a partir do endereço */
        if (link.error) {
          initLoginForm();
          showLoginAlert('Este link expirou ou já foi usado. Peça um novo convite ao administrador ou use "Esqueci a senha".', 'error');
          return;
        }
        if (link.type === 'invite' || link.type === 'recovery') {
          if (await isAuthenticated()) { initSetPasswordForm(link.type); return; }
        }

        const authenticated = await isAuthenticated();
        if (authenticated) {
          window.location.replace(DASHBOARD_URL);
          return;
        }
        initLoginForm();
        if (new URLSearchParams(location.search).has('semacesso')) {
          showLoginAlert('Sua conta não tem acesso ao sistema. Fale com o administrador da escola.', 'error');
        }
      });
    }
  })();

  function showLoginAlert(msg, type) {
    const alertBox = document.getElementById('loginAlert');
    if (!alertBox) return;
    alertBox.textContent = msg;
    alertBox.className   = `login-alert ${type}`;
  }

  /* ====== Definir senha (convite / recuperação) ====== */
  function initSetPasswordForm(type) {
    const loginForm = document.getElementById('loginForm');
    const form      = document.getElementById('setPasswordForm');
    const passInp   = document.getElementById('newPassword');
    const confInp   = document.getElementById('confirmPassword');
    const passErr   = document.getElementById('newPasswordError');
    const confErr   = document.getElementById('confirmPasswordError');
    const btn       = document.getElementById('setPasswordBtn');
    const alertBox  = document.getElementById('setPasswordAlert');
    if (!form) return;

    if (loginForm) loginForm.hidden = true;
    form.hidden = false;
    document.getElementById('setPasswordTitle').textContent =
      type === 'invite' ? 'Bem-vindo(a)! Crie sua senha de acesso' : 'Defina uma nova senha';
    passInp.focus();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      passErr.textContent = confErr.textContent = '';
      alertBox.className  = 'login-alert';

      if (passInp.value.length < 6)             { passErr.textContent = 'Mínimo 6 caracteres.'; return; }
      if (passInp.value !== confInp.value)      { confErr.textContent = 'As senhas não coincidem.'; return; }

      btn.classList.add('is-loading');
      const { error } = await db.auth.updateUser({ password: passInp.value });
      btn.classList.remove('is-loading');

      if (error) {
        alertBox.textContent = _errorMsg(error);
        alertBox.className   = 'login-alert error';
        return;
      }
      alertBox.textContent = 'Senha salva! Entrando...';
      alertBox.className   = 'login-alert success';
      setTimeout(() => window.location.replace(DASHBOARD_URL), 800);
    });
  }

  /* ====== Formulário de login ====== */
  function initLoginForm() {
    const form       = document.getElementById('loginForm');
    const emailInp   = document.getElementById('email');
    const passInp    = document.getElementById('password');
    const toggleBtn  = document.getElementById('togglePassword');
    const toggleIcon = document.getElementById('toggleIcon');
    const loginBtn   = document.getElementById('loginBtn');
    const alertBox   = document.getElementById('loginAlert');
    const emailErr   = document.getElementById('emailError');
    const passErr    = document.getElementById('passwordError');

    if (!form) return;

    /* Mostrar/ocultar senha */
    toggleBtn?.addEventListener('click', () => {
      const isText = passInp.type === 'text';
      passInp.type      = isText ? 'password' : 'text';
      toggleIcon.className = isText ? 'fa-regular fa-eye' : 'fa-regular fa-eye-slash';
    });

    /* Limpar erros ao digitar */
    emailInp?.addEventListener('input', () => { emailErr.textContent = ''; alertBox.className = 'login-alert'; });
    passInp?.addEventListener('input',  () => { passErr.textContent  = ''; alertBox.className = 'login-alert'; });

    /* Recuperar senha */
    document.getElementById('forgotPassword')?.addEventListener('click', async (e) => {
      e.preventDefault();
      const email = emailInp.value.trim();
      if (!email) {
        alertBox.textContent = 'Informe o e-mail para recuperação.';
        alertBox.className   = 'login-alert error';
        return;
      }
      const { error } = await db.auth.resetPasswordForEmail(email, {
        /* Mantém a mesma URL de antes, já liberada nas configurações do Supabase */
        redirectTo: ROOT + 'index.html',
      });
      if (error) {
        alertBox.textContent = error.message;
        alertBox.className   = 'login-alert error';
        return;
      }
      alertBox.textContent = 'E-mail de recuperação enviado. Verifique sua caixa de entrada.';
      alertBox.className   = 'login-alert success';
    });

    /* Submit */
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email    = emailInp.value.trim();
      const password = passInp.value;
      let valid = true;

      emailErr.textContent = '';
      passErr.textContent  = '';
      alertBox.className   = 'login-alert';

      if (!email) {
        emailErr.textContent = 'Informe o e-mail.'; valid = false;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        emailErr.textContent = 'E-mail inválido.'; valid = false;
      }
      if (!password) { passErr.textContent = 'Informe a senha.'; valid = false; }
      if (!valid) return;

      loginBtn.classList.add('is-loading');
      const result = await login(email, password);
      loginBtn.classList.remove('is-loading');

      if (result.success) {
        alertBox.textContent = 'Acesso autorizado. Redirecionando...';
        alertBox.className   = 'login-alert success';
        setTimeout(() => window.location.replace(DASHBOARD_URL), 800);
      } else {
        alertBox.textContent = result.message;
        alertBox.className   = 'login-alert error';
        passInp.value = '';
        passInp.focus();
      }
    });
  }

  return { isAuthenticated, getUser, login, logout, requireAuth, ROOT };

})();
