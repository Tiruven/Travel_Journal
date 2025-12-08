// Auth Guard for Protected Pages
(async function() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    const isAuthPage = window.location.pathname.includes('login.html') || 
                       window.location.pathname.includes('register.html');
    
    if (!session && !isAuthPage) {
        // Not logged in and trying to access protected page
        window.location.href = 'login.html';
    } else if (session && isAuthPage) {
        // Logged in but on auth page
        window.location.href = 'index.html';
    }
})();