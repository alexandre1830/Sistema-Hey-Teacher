/* ==========================================================================
   MANAGE-TEACHERS — Convida, lista e remove professores da escola
   Roda no Supabase (Edge Function) com a chave de serviço, que nunca vai
   para o navegador. Só o admin da escola pode chamar.
   ========================================================================== */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return json({ error: 'Método não permitido.' }, 405);

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    /* Quem está chamando precisa ser o admin da escola */
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: { user }, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !user) return json({ error: 'Não autenticado.' }, 401);

    const { data: me } = await admin.from('profiles')
      .select('role, school_id').eq('id', user.id).single();
    if (me?.role !== 'admin') return json({ error: 'Apenas o administrador pode gerenciar professores.' }, 403);
    const schoolId = me.school_id;

    const body   = await req.json().catch(() => ({}));
    const action = body.action;

    /* ---------- Listar ---------- */
    if (action === 'list') {
      const { data: profs, error } = await admin.from('profiles')
        .select('id, name, email').eq('school_id', schoolId).eq('role', 'teacher').order('name');
      if (error) return json({ error: error.message }, 500);

      const teachers = await Promise.all((profs || []).map(async (p) => {
        const { data } = await admin.auth.admin.getUserById(p.id);
        const u = data?.user;
        return {
          id:         p.id,
          name:       p.name || '',
          email:      u?.email || p.email || '',
          pending:    !u?.last_sign_in_at,          // ainda não aceitou o convite
          invitedAt:  u?.invited_at || null,
          lastSignIn: u?.last_sign_in_at || null,
        };
      }));
      return json({ teachers });
    }

    /* ---------- Convidar / reenviar convite ---------- */
    if (action === 'invite' || action === 'resend') {
      const email = String(body.email || '').trim().toLowerCase();
      const name  = String(body.name  || '').trim();
      if (!EMAIL_RE.test(email))           return json({ error: 'E-mail inválido.' }, 400);
      if (action === 'invite' && !name)    return json({ error: 'Informe o nome do professor.' }, 400);

      if (action === 'resend') {
        const { data: target } = await admin.from('profiles').select('id')
          .eq('email', email).eq('school_id', schoolId).eq('role', 'teacher').maybeSingle();
        if (!target) return json({ error: 'Professor não encontrado.' }, 404);
      }

      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { name },
        redirectTo: typeof body.redirectTo === 'string' ? body.redirectTo : undefined,
      });
      if (error) {
        const exists = /already (been )?registered|already exists/i.test(error.message);
        return json({
          error: exists
            ? (action === 'resend' ? 'Este professor já aceitou o convite.' : 'Já existe uma conta com este e-mail.')
            : error.message,
        }, 400);
      }

      if (action === 'invite') {
        const { error: pErr } = await admin.from('profiles').upsert({
          id: data.user.id, email, name, role: 'teacher', school_id: schoolId,
        });
        if (pErr) return json({ error: pErr.message }, 500);
      }
      return json({ ok: true });
    }

    /* ---------- Remover acesso ---------- */
    if (action === 'remove') {
      const { data: target } = await admin.from('profiles').select('id')
        .eq('id', body.id).eq('school_id', schoolId).eq('role', 'teacher').maybeSingle();
      if (!target) return json({ error: 'Professor não encontrado.' }, 404);

      /* Apaga a conta: turmas/alunos ficam sem professor e as frequências
         lançadas por ele continuam na escola (chaves com ON DELETE SET NULL) */
      const { error } = await admin.auth.admin.deleteUser(body.id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    return json({ error: 'Ação inválida.' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
