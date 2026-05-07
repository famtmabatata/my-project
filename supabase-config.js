const SUPABASE_URL = window.APP_CONFIG?.url;
const SUPABASE_ANON_KEY = window.APP_CONFIG?.key;
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export { supabase };