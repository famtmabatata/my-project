// supabase-config.js
const SUPABASE_URL = 'https://jaxgopgtgjaqecgbajbm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpheGdvcGd0Z2phcWVjZ2JhamJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTAwMzMsImV4cCI6MjA5MzU2NjAzM30.BUCe_u9onFWZQ1NyWrmdEja7H3URSBYi_zM74zD6QIE';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export { supabase };