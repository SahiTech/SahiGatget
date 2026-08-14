-- Placeholder initialization script for Supabase Auth Owner account.
-- NOTE: Plaintext initial credentials have been removed for security hardening.
-- Production owner account is managed securely via Supabase Auth dashboard and password reset.

INSERT INTO public.admin_users (
  user_id,
  email,
  role,
  full_name,
  is_active
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'helpline.sahitech@gmail.com',
  'owner',
  'Production Owner',
  true
) ON CONFLICT (user_id) DO UPDATE 
SET role = 'owner', is_active = true;
