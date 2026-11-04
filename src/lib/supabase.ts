import { createClient } from "@supabase/supabase-js";

// Configure these VITE_* values only with the Supabase project used by this site.
// Never put a service_role/secret key in client-side environment variables.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
if (!url || !publishableKey) {
  throw new Error("Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no ambiente.");
}
export const supabase = createClient(url, publishableKey, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
});
