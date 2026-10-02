import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';
import { crearHandler } from './handler.mjs';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false }
});
Deno.serve(crearHandler(admin));
