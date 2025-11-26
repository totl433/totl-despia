import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// More defensive error handling - log but don't throw immediately
// This allows the app to render and show a proper error message
let supabaseClient;

if (!url || !anon) {
  console.error('[Supabase] Missing environment variables:', {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? 'Present' : 'Missing',
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Present' : 'Missing',
    allEnvKeys: Object.keys(import.meta.env).filter(k => k.startsWith('VITE_'))
  })
  
  // Create a dummy client to prevent crashes, but log the error
  // The app will show an error message through ErrorBoundary
  const dummyUrl = url || 'https://placeholder.supabase.co'
  const dummyAnon = anon || 'dummy-key'
  
  console.error('[Supabase] Using placeholder values - app will not function correctly')
  
  supabaseClient = createClient(dummyUrl, dummyAnon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
} else {
  supabaseClient = createClient(url, anon, {
    auth: {
      persistSession: true,       // keep users logged in across reloads
      autoRefreshToken: true,     // refresh tokens in the background
      detectSessionInUrl: true,   // handle OAuth/magic link redirects
    },
  })
}

export const supabase = supabaseClient
