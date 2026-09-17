import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pnpbvlcmuopiytszziks.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucGJ2bGNtdW9waXl0c3p6aWtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxOTYyMjksImV4cCI6MjEwNDc3MjIyOX0.5VlKLWT9-AuRaYt79oV8xOSM04YhPi9Vxvy-49Psj8k';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
});