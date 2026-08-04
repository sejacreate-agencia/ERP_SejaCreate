-- =============================================
-- MIGRATION 016 — Redefinição de senha pelo admin, sem SQL manual
-- Execute UMA VEZ no Supabase SQL Editor.
-- =============================================
-- Depois desta migration, o botão "Redefinir Senha" em Configurações →
-- Usuários aplica a senha temporária sozinho. Não é mais preciso abrir o
-- SQL Editor a cada usuário.
--
-- Por que precisa ser assim: trocar a senha de OUTRO usuário exige a Admin
-- API do Supabase, que só funciona com a service_role key — e essa chave não
-- pode ficar num site estático. A alternativa é esta: uma função
-- SECURITY DEFINER que roda com privilégio no banco, mas só aceita ser
-- chamada por quem tem role='admin' em public.profiles.
--
-- ATENÇÃO: a guarda de admin é o que separa "reset de senha" de "qualquer
-- usuário logado assume a conta do dono". Não remova as checagens abaixo
-- nem os REVOKE do final.

-- pgcrypto fornece crypt()/gen_salt() para gerar o hash bcrypt que o
-- Supabase Auth espera em auth.users.encrypted_password.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------
-- 1) Definir a senha de um usuário
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_user_password(
  target_id    UUID,
  new_password TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '28000';
  END IF;

  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();

  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Apenas administradores podem redefinir senhas.' USING ERRCODE = '42501';
  END IF;

  IF new_password IS NULL OR length(new_password) < 8 THEN
    RAISE EXCEPTION 'A senha deve ter no mínimo 8 caracteres.' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado no Auth.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE auth.users
     SET encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
         -- Senha definida pelo admin também vale como confirmação da conta,
         -- senão o usuário continua travado em "Email not confirmed".
         email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
         updated_at         = NOW()
   WHERE id = target_id;

  -- Derruba as sessões antigas: a senha mudou, os tokens vigentes não valem mais.
  -- Os nomes destas tabelas são internos do GoTrue; se mudarem numa versão
  -- futura, a troca de senha não deve falhar por causa da limpeza.
  BEGIN
    DELETE FROM auth.refresh_tokens WHERE user_id = target_id::text;
    DELETE FROM auth.sessions       WHERE user_id = target_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    NULL;
  END;
END;
$$;

-- ---------------------------------------------
-- 2) Confirmar o e-mail de um usuário
-- ---------------------------------------------
-- Destrava quem foi criado enquanto "Confirm email" estava ligado, sem
-- depender do usuário abrir o link.
CREATE OR REPLACE FUNCTION public.admin_confirm_user_email(target_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '28000';
  END IF;

  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();

  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Apenas administradores podem confirmar contas.' USING ERRCODE = '42501';
  END IF;

  UPDATE auth.users
     SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
         updated_at         = NOW()
   WHERE id = target_id;
END;
$$;

-- ---------------------------------------------
-- 3) Permissões — só usuário logado chega na função
-- ---------------------------------------------
-- A guarda de admin está dentro da função, mas anon nem deve poder chamá-la.
REVOKE ALL ON FUNCTION public.admin_set_user_password(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_confirm_user_email(UUID)      FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_set_user_password(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_confirm_user_email(UUID)      TO authenticated;

-- ---------------------------------------------
-- Conferência rápida (opcional)
-- ---------------------------------------------
-- SELECT proname, prosecdef FROM pg_proc
--  WHERE proname IN ('admin_set_user_password','admin_confirm_user_email');
