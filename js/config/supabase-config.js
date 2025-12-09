// Supabase Configuration
const SUPABASE_URL = 'https://vcnpwchkgpvcuswmtlxi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjbnB3Y2hrZ3B2Y3Vzd210bHhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwOTYzMTUsImV4cCI6MjA4MDY3MjMxNX0.0B_MUhiMsdq5GBopSTKfpbKjKwhB1oyIx-S-x3oJPqE';

// Initialize Supabase client
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});

// Storage buckets
const STORAGE_BUCKETS = {
    photos: 'photos',
    audio: 'audio'
};

