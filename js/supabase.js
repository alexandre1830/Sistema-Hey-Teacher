/* ==========================================================================
   SUPABASE.JS — Inicialização do cliente Supabase
   ========================================================================== */

window.HT = window.HT || {};

/* --------------------------------------------------------------------------
   ⚙️  CONFIGURAÇÃO — substitua pelos valores do seu projeto Supabase
   Painel → Project Settings → API
   -------------------------------------------------------------------------- */
const SUPABASE_URL = 'https://llqzpwdfibnxntotjsiw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxscXpwd2RmaWJueG50b3Rqc2l3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMzYwNDQsImV4cCI6MjA5MjkxMjA0NH0._A1RdYjwWZJ_psEr-WwO0P2jo6CoCDmQ2dUM3dJDE1M';   // chave pública (anon/public)

HT.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession:    true,   // mantém sessão entre abas/reloads (localStorage)
    autoRefreshToken:  true,   // renova o JWT automaticamente
    detectSessionInUrl: true,  // suporte a magic-links e recuperação de senha
  },
});
