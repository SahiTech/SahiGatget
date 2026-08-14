INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'helpline.sahitech@gmail.com',
  crypt('ProductionOwner2026#Secure', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Production Owner"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
) ON CONFLICT (id) DO NOTHING;

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
