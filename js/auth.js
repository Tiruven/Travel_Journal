// Authentication Manager with Supabase
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
            }
            
            if (session) {
                this.currentUser = session.user;
                this.redirectIfAuthenticated();
            }
        } catch (error) {
        }

        // check auth state changes
        this.supabase.auth.onAuthStateChange(async (event, session) => {
            
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
    }

    redirectIfAuthenticated() {
        const authPages = ['login.html', 'register.html'];
        const currentPage = window.location.pathname.split('/').pop();
        
        if (authPages.includes(currentPage) && this.currentUser) {
            window.location.href = 'index.html';
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

            
            // Redirect will happen via onAuthStateChange
            
        } catch (error) {
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
            }

            if (!existingProfile) {
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
                } else {
                }
            } else {
            }
        } catch (error) {
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