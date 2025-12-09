// Authentication Manager with Supabase and Google OAuth

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.supabase = supabaseClient;
        this.init();
    }

    async init() {
        // Check for existing session
        try {
            const { data: { session }, error } = await this.supabase.auth.getSession();
            
            if (error) {
                console.error('Session error:', error);
            }
            
            if (session) {
                this.currentUser = session.user;
                this.redirectIfAuthenticated();
            }
        } catch (error) {
            console.error('Init error:', error);
        }

        // Listen for auth state changes
        this.supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth event:', event);
            
            if (event === 'SIGNED_IN' && session) {
                this.currentUser = session.user;
                await this.handleSuccessfulLogin(session.user);
            } else if (event === 'SIGNED_OUT') {
                this.currentUser = null;
                this.handleLogout();
            }
        });

        // Setup form listeners
        this.setupLoginForm();
        this.setupRegisterForm();
        this.setupGoogleSignIn();
    }

    redirectIfAuthenticated() {
        const authPages = ['login.html', 'register.html'];
        const currentPage = window.location.pathname.split('/').pop();
        
        if (authPages.includes(currentPage) && this.currentUser) {
            window.location.href = 'index.html';
        }
    }

    setupGoogleSignIn() {
        const googleBtn = document.getElementById('google-signin-btn');
        if (googleBtn) {
            googleBtn.addEventListener('click', () => this.signInWithGoogle());
        }
    }

    async signInWithGoogle() {
        try {
            const googleBtn = document.getElementById('google-signin-btn');
            if (googleBtn) {
                googleBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting to Google...';
                googleBtn.disabled = true;
            }

            const { data, error } = await this.supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/index.html`,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    }
                }
            });

            if (error) throw error;

            // The redirect will happen automatically
            console.log('Redirecting to Google...');
            
        } catch (error) {
            console.error('Google sign-in error:', error);
            
            const googleBtn = document.getElementById('google-signin-btn');
            if (googleBtn) {
                googleBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                `;
                googleBtn.disabled = false;
            }
            
            this.showError('Failed to connect with Google. Please try again.');
        }
    }

    setupLoginForm() {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }
    }

    setupRegisterForm() {
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
            
            // Password strength checker
            const passwordInput = document.getElementById('password');
            if (passwordInput) {
                passwordInput.addEventListener('input', (e) =>
                    this.checkPasswordStrength(e.target.value)
                );
            }
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        // Basic validation
        if (!this.validateEmail(email)) {
            this.showError('Please enter a valid email address');
            return;
        }

        if (password.length < 8) {
            this.showError('Password must be at least 8 characters');
            return;
        }

        // Show loading
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
        submitBtn.disabled = true;

        try {
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) throw error;

            console.log('Login successful');
            
            // Redirect will happen via onAuthStateChange
            
        } catch (error) {
            console.error('Login error:', error);
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            
            if (error.message.includes('Invalid login credentials')) {
                this.showError('Invalid email or password');
            } else if (error.message.includes('Email not confirmed')) {
                this.showError('Please check your email and confirm your account first');
            } else {
                this.showError(error.message || 'Login failed. Please try again.');
            }
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        // Validation
        if (username.length < 3) {
            this.showError('Username must be at least 3 characters');
            return;
        }

        if (!this.validateEmail(email)) {
            this.showError('Please enter a valid email address');
            return;
        }

        if (password.length < 8) {
            this.showError('Password must be at least 8 characters');
            return;
        }

        if (password !== confirmPassword) {
            this.showError('Passwords do not match');
            return;
        }

        // Show loading
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';
        submitBtn.disabled = true;

        try {
            // Sign up the user
            const { data, error } = await this.supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        username: username,
                    }
                }
            });

            if (error) throw error;

            if (data.user) {
                // If email confirmation is disabled, user can login immediately
                if (data.session) {
                    this.showSuccess('Account created successfully! Redirecting...');
                    // Will redirect via onAuthStateChange
                } else {
                    // If confirmation is required
                    this.showSuccess('Account created! Please check your email to verify your account.');
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 3000);
                }
            }
            
        } catch (error) {
            console.error('Registration error:', error);
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            
            if (error.message.includes('already registered') || error.message.includes('already exists')) {
                this.showError('Email already registered. Please login instead.');
            } else {
                this.showError(error.message || 'Registration failed. Please try again.');
            }
        }
    }

    async handleSuccessfulLogin(user) {
        console.log('User logged in:', user.email);
        
        // Ensure user profile exists
        await this.ensureUserProfile(user);
        
        // Store user info in localStorage
        localStorage.setItem('currentUser', JSON.stringify({
            id: user.id,
            email: user.email,
            username: user.user_metadata?.username || user.email.split('@')[0]
        }));
        
        // Redirect to main app
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 500);
    }

    async ensureUserProfile(user) {
        try {
            // Check if profile exists
            const { data: existingProfile, error: fetchError } = await this.supabase
                .from('user_profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();

            if (fetchError) {
                console.error('Error fetching profile:', fetchError);
            }

            if (!existingProfile) {
                console.log('Creating user profile...');
                // Profile doesn't exist, create it
                const { data, error: insertError } = await this.supabase
                    .from('user_profiles')
                    .insert([{
                        id: user.id,
                        username: user.user_metadata?.username || user.email.split('@')[0],
                        avatar_url: user.user_metadata?.avatar_url || null
                    }])
                    .select()
                    .single();

                if (insertError) {
                    console.error('Error creating profile:', insertError);
                } else {
                    console.log('Profile created:', data);
                }
            } else {
                console.log('Profile already exists');
            }
        } catch (error) {
            console.error('Error ensuring user profile:', error);
        }
    }

    handleLogout() {
        localStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    }

    async logout() {
        try {
            const { error } = await this.supabase.auth.signOut();
            if (error) throw error;
        } catch (error) {
            console.error('Logout error:', error);
            // Force logout anyway
            this.handleLogout();
        }
    }

    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    checkPasswordStrength(password) {
        const strengthBar = document.getElementById('strength-bar');
        const hint = document.getElementById('password-hint');
        
        if (!strengthBar) return;

        let strength = 0;
        
        if (password.length >= 8) strength++;
        if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
        if (password.match(/\d/)) strength++;
        if (password.match(/[^a-zA-Z\d]/)) strength++;

        strengthBar.className = 'strength-bar';
        
        if (strength <= 1) {
            strengthBar.classList.add('weak');
            hint.textContent = 'Weak password';
            hint.style.color = 'var(--danger-color)';
        } else if (strength <= 3) {
            strengthBar.classList.add('medium');
            hint.textContent = 'Medium strength';
            hint.style.color = 'var(--warning-color)';
        } else {
            strengthBar.classList.add('strong');
            hint.textContent = 'Strong password';
            hint.style.color = 'var(--success-color)';
        }
    }

    showError(message) {
        const errorDiv = document.getElementById('error-message');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.classList.remove('hidden');
            errorDiv.style.background = '#fee2e2';
            errorDiv.style.color = 'var(--danger-color)';
            
            setTimeout(() => {
                errorDiv.classList.add('hidden');
            }, 5000);
        }
    }

    showSuccess(message) {
        const errorDiv = document.getElementById('error-message');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.classList.remove('hidden');
            errorDiv.style.background = '#d1fae5';
            errorDiv.style.color = '#065f46';
        }
    }
}

// Toggle password visibility
function togglePassword(inputId = 'password') {
    const input = document.getElementById(inputId);
    const button = input?.nextElementSibling?.querySelector('.toggle-password');
    const icon = button?.querySelector('i');
    
    if (input && input.type === 'password') {
        input.type = 'text';
        if (icon) icon.className = 'fas fa-eye-slash';
    } else if (input) {
        input.type = 'password';
        if (icon) icon.className = 'fas fa-eye';
    }
}

// Initialize auth manager
const authManager = new AuthManager();