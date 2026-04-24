/* ==========================================================================
   AUTH.JS — Autenticação com Supabase Auth
   ========================================================================== */

window.HT = window.HT || {};

HT.auth = (() => {

  const db = HT.supabase;

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
    window.location.href = 'index.html';
  }

  /* ====== Proteção de rotas ====== */
  async function requireAuth() {
    const ok = await isAuthenticated();
    if (!ok) window.location.replace('index.html');
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
    const page        = window.location.pathname.split('/').pop() || 'index.html';
    const publicPages = ['index.html', ''];

    function onReady(fn) {
      if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', fn);
      else fn();
    }

    if (!publicPages.includes(page)) {
      onReady(async () => {
        await requireAuth();
        await populateUserInfo();
      });
    } else {
      onReady(async () => {
        const authenticated = await isAuthenticated();
        if (authenticated) {
          window.location.replace('dashboard.html');
          return;
        }
        initLoginForm();
      });
    }
  })();

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
        redirectTo: window.location.origin + '/index.html',
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
        setTimeout(() => window.location.replace('dashboard.html'), 800);
      } else {
        alertBox.textContent = result.message;
        alertBox.className   = 'login-alert error';
        passInp.value = '';
        passInp.focus();
      }
    });
  }

  return { isAuthenticated, getUser, login, logout, requireAuth };

})();
