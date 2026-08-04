-- =============================================
-- MIGRATION 015 — Correção do cadastro de usuários / login
-- Execute no Supabase SQL Editor
-- =============================================
-- Contexto: usuários criados em Configurações → Usuários não conseguiam logar.
-- Causa principal: o projeto está com "Confirm email" LIGADO
-- (auth/v1/settings → mailer_autoconfirm: false), então o signUp cria a conta
-- com email_confirmed_at = NULL e o login falha com "Email not confirmed".
--
-- Correção definitiva (fora do SQL, no painel):
--   Supabase → Authentication → Providers → Email → desmarcar "Confirm email"
-- Depois disso, todo usuário criado pelo ERP entra imediatamente.

-- ---------------------------------------------
-- 1) Trigger de criação de perfil à prova de duplicidade
-- ---------------------------------------------
-- O ERP faz signUp e, logo em seguida, um upsert em profiles. Se a linha já
-- existir (retentativa, e-mail reaproveitado), o INSERT do trigger abortava a
-- criação do usuário no Auth. Agora ele apenas complementa o que faltar.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'social')
  )
  ON CONFLICT (id) DO UPDATE
    SET email     = EXCLUDED.email,
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------
-- 2) Perfis órfãos: usuários no Auth sem linha em profiles
-- ---------------------------------------------
-- Sem perfil, o login autentica mas para em "sem perfil cadastrado".
INSERT INTO public.profiles (id, full_name, email, role)
SELECT u.id,
       COALESCE(u.raw_user_meta_data->>'full_name', u.email),
       u.email,
       COALESCE(u.raw_user_meta_data->>'role', 'social')
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- ---------------------------------------------
-- 3) OPCIONAL — confirmar manualmente quem já foi criado e está travado
-- ---------------------------------------------
-- Use somente para as contas que VOCÊ criou pelo ERP e que estão presas em
-- "Email not confirmed". Descomente e ajuste o e-mail antes de rodar.
--
-- UPDATE auth.users
--    SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
--  WHERE email = 'usuario@sejacreate.com';

-- Para conferir quem está pendente de confirmação:
-- SELECT email, created_at, email_confirmed_at
--   FROM auth.users
--  WHERE email_confirmed_at IS NULL
--  ORDER BY created_at DESC;
