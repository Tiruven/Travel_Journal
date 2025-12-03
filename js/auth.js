// Authentication Manager
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    init() {
        // Check if user is already logged in
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            // Redirect to main app if on auth page
            if (window.location.pathname.includes('login.html') || 
                window.location.pathname.includes('register.html')) {
                window.location.href = 'index.html';
            }
        }

        // Setup form listeners
        this.setupLoginForm();
        this.setupRegisterForm();
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
                passwordInput.addEventListener('input', (e) => this.checkPasswordStrength(e.target.value));
            }
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('remember-me').checked;

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

        // Simulate API call (replace with actual backend)
        setTimeout(() => {
            // Get stored users
            const users = JSON.parse(localStorage.getItem('users') || '[]');
            const user = users.find(u => u.email === email && u.password === password);

            if (user) {
                // Success
                this.currentUser = {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    loginDate: new Date().toISOString()
                };

                if (rememberMe) {
                    localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                } else {
                    sessionStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                }

                // Redirect to main app
                window.location.href = 'index.html';
            } else {
                // Failure
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
                this.showError('Invalid email or password');
            }
        }, 1500);
    }

    async handleRegister(e) {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const terms = document.getElementById('terms').checked;

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

        if (!terms) {
            this.showError('Please accept the Terms of Service');
            return;
        }

        // Show loading
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';
        submitBtn.disabled = true;

        // Simulate API call
        setTimeout(() => {
            // Get existing users
            const users = JSON.parse(localStorage.getItem('users') || '[]');

            // Check if email already exists
            if (users.find(u => u.email === email)) {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
                this.showError('Email already registered');
                return;
            }

            // Create new user
            const newUser = {
                id: this.generateUserId(),
                username,
                email,
                password, // In production, hash this!
                createdAt: new Date().toISOString()
            };

            users.push(newUser);
            localStorage.setItem('users', JSON.stringify(users));

            // Auto login
            this.currentUser = {
                id: newUser.id,
                username: newUser.username,
                email: newUser.email,
                loginDate: new Date().toISOString()
            };

            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));

            // Redirect
            window.location.href = 'index.html';
        }, 1500);
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
            
            setTimeout(() => {
                errorDiv.classList.add('hidden');
            }, 5000);
        }
    }

    generateUserId() {
        return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    logout() {
        localStorage.removeItem('currentUser');
        sessionStorage.removeItem('currentUser');
        this.currentUser = null;
        window.location.href = 'login.html';
    }
}

// Toggle password visibility
function togglePassword(inputId = 'password') {
    const input = document.getElementById(inputId);
    const button = input.nextElementSibling?.querySelector('.toggle-password');
    const icon = button?.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        if (icon) icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        if (icon) icon.className = 'fas fa-eye';
    }
}

// Social login functions (placeholder - implement with actual OAuth)
function loginWithGoogle() {
    alert('Google OAuth integration coming soon!\nFor now, please use email/password.');
}

function registerWithGoogle() {
    alert('Google OAuth integration coming soon!\nFor now, please use email/password.');
}

function loginWithFacebook() {
    alert('Facebook OAuth integration coming soon!\nFor now, please use email/password.');
}

function registerWithFacebook() {
    alert('Facebook OAuth integration coming soon!\nFor now, please use email/password.');
}

// Initialize auth manager
const authManager = new AuthManager();