import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// More defensive error handling - log but don't throw immediately
// This allows the app to render and show a proper error message
let supabaseClient;

// Only log Supabase initialization in development
if (import.meta.env.DEV) {
  console.log('[Supabase] Initializing client...', {
    hasUrl: !!url,
    hasAnon: !!anon,
    urlPreview: url ? url.substring(0, 30) + '...' : 'missing',
  });
}

if (!url || !anon) {
  console.error('[Supabase] Missing environment variables:', {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? 'Present' : 'Missing',
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Present' : 'Missing',
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
  if (import.meta.env.DEV) {
    console.log('[Supabase] Creating client with valid credentials');
    console.log('[Supabase] URL:', url.substring(0, 40) + '...');
  }
  supabaseClient = createClient(url, anon, {
    auth: {
      persistSession: true,       // keep users logged in across reloads
      autoRefreshToken: true,     // refresh tokens in the background
      detectSessionInUrl: true,   // handle OAuth/magic link redirects
      storage: window.localStorage, // Explicitly set storage
      storageKey: 'supabase.auth.token', // Explicit storage key
    },
  })
  if (import.meta.env.DEV) {
    console.log('[Supabase] Client created successfully');
  }
  
  // Test the client immediately (only log errors)
  supabaseClient.auth.getSession()
    .then(({ data, error }) => {
      if (error) {
        console.error('[Supabase] Initial session check failed:', error.message);
      } else if (import.meta.env.DEV) {
        console.log('[Supabase] Initial session check:', data.session ? 'has session' : 'no session');
      }
    })
    .catch((err) => {
      console.error('[Supabase] Initial session check failed:', err);
    });
}

export const supabase = supabaseClient
