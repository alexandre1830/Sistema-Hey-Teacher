/* ==========================================================================
   SUPABASE.JS — Inicialização do cliente Supabase
   ========================================================================== */

window.HT = window.HT || {};

/* --------------------------------------------------------------------------
   ⚙️  CONFIGURAÇÃO — substitua pelos valores do seu projeto Supabase
   Painel → Project Settings → API
   -------------------------------------------------------------------------- */
const SUPABASE_URL = 'https://dqsxjymedghvwdgvxfcb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxc3hqeW1lZGdodndkZ3Z4ZmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4ODI0MzIsImV4cCI6MjA5MjQ1ODQzMn0.Iybu9WmikUvCEBmxpcIBUUPZHrb-lOUo7K0QEOhphrk';   // chave pública (anon/public)

HT.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession:    true,   // mantém sessão entre abas/reloads (localStorage)
    autoRefreshToken:  true,   // renova o JWT automaticamente
    detectSessionInUrl: true,  // suporte a magic-links e recuperação de senha
  },
});
