// Main Application

class TravelJournalApp {
    constructor() {
        this.isInitialized = false;
    }

    async init() {
        this.checkAuth();
        showLoading(true);

        try {
            await storage.waitForReady();

            await this.initializeManagers();
            this.setupEventListeners();
            this.checkDailySummary();
            this.setupDailyReset();

            this.isInitialized = true;
            showLoading(false);
            showNotification('Welcome to Travel Journal!', 3000);

        } catch (error) {
            showLoading(false);
            showNotification('Failed to initialize app: ' + error.message, 5000);
        }
    }

    checkAuth() {
        const currentUser = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
        if (!currentUser) {
            window.location.href = 'login.html';
            return;
        }

        const user = JSON.parse(currentUser);
    }

    async initializeManagers() {
        try {

            // Initialize mapManager globally
            if (!window.mapManager) {
                window.mapManager = new MapManager();
            }

            await window.mapManager.init();

            // Load wishlist after map is initialized
            await hotspotManager.syncWishlist();

            await motionSensors.start();
        } catch (error) {
            throw error;
        }
    }

    setupEventListeners() {
        const mainBtn = document.querySelector('.main-circle-btn');
        const actionMenu = document.querySelector('.action-menu');

        mainBtn?.addEventListener('click', () => {
            mainBtn.classList.toggle('active');
            actionMenu.classList.toggle('hidden');
        });

        const filterToggleBtn = document.querySelector('.filter-toggle-btn');
        const filtersMenu = document.querySelector('.filters-menu');

        filterToggleBtn?.addEventListener('click', () => {
            filterToggleBtn.classList.toggle('active');
            filtersMenu.classList.toggle('hidden');
        });

        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                this.handleAction(action);
                mainBtn.classList.remove('active');
                actionMenu.classList.add('hidden');
            });
        });

        document.getElementById('stats-btn')?.addEventListener('click', () => {
            this.openStatsModal();
        });

        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    modal.classList.add('hidden');
                    this.cleanupModal(modal.id);
                }
            });
        });

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const tab = btn.dataset.tab;
                memoryManager.currentFilter = tab === 'photos' ? 'photo' : tab === 'audio' ? 'audio' : 'text';
                memoryManager.displayMemoriesInGallery();
            });
        });

        document.getElementById('save-text-btn')?.addEventListener('click', () => {
            this.saveTextNote();
        });

        const themeToggleBtn = document.querySelector('.theme-toggle-btn');
        const themeMenu = document.querySelector('.theme-menu');

        themeToggleBtn?.addEventListener('click', () => {
            themeToggleBtn.classList.toggle('active');
            themeMenu.classList.toggle('hidden');
        });

        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const theme = btn.dataset.theme;
                if (window.mapManager) {
                    window.mapManager.changeTheme(theme);
                }
                themeToggleBtn.classList.remove('active');
                themeMenu.classList.add('hidden');
            });
        });

        window.logout = () => {
            if (confirm('Are you sure you want to logout?')) {
                authManager.logout();
            }
        };
    }

    async handleAction(action) {
        switch (action) {
            case 'photo':
                await this.openCameraModal();
                break;
            case 'audio':
                this.openAudioModal();
                break;
            case 'text':
                this.openTextModal();
                break;
            case 'storage':
                this.openStorageModal();
                break;
            case 'explore':
                window.location.href = 'hotspots.html';
                break;
        }
    }

    async openCameraModal() {
        const modal = document.getElementById('camera-modal');
        modal.classList.remove('hidden');
        const success = await cameraManager.startCamera();
        if (!success) {
            modal.classList.add('hidden');
        }
    }

    openAudioModal() {
        const modal = document.getElementById('audio-modal');
        modal.classList.remove('hidden');
    }

    openTextModal() {
        const modal = document.getElementById('text-modal');
        modal.classList.remove('hidden');
    }

    async openStorageModal() {
        const modal = document.getElementById('storage-modal');
        modal.classList.remove('hidden');
        memoryManager.currentFilter = 'photo';
        await memoryManager.loadMemories();
        memoryManager.displayMemoriesInGallery();
    }

    openStatsModal() {
        const modal = document.getElementById('stats-modal');
        modal.classList.remove('hidden');
        statsTracker.updateUI();
        achievementsManager.updateAchievementsUI();
        this.updateDailyMissions();
    }

    async saveTextNote() {
        const textNote = document.getElementById('text-note').value.trim();
        if (!textNote) {
            showNotification('Please write something', 2000);
            return;
        }

        const position = gpsTracker.currentPosition;

        const memory = {
            type: 'text',
            data: null,
            caption: textNote,
            location: position ? {
                lat: position.lat,
                lng: position.lng
            } : null,
            timestamp: Date.now()
        };

        try {
            await storage.saveMemory(memory);
            showNotification('Note saved!');

            document.getElementById('text-modal').classList.add('hidden');
            document.getElementById('text-note').value = '';

            if (window.mapManager && position) {
                window.mapManager.addMemoryMarker(memory);
            }

            statsTracker.incrementMemories();

        } catch (error) {
            showNotification('Failed to save note', 3000);
        }
    }

    updateDailyMissions() {
        const missions = [
            {
                id: 'walk_1.5km',
                name: 'Walk 1.5 km today',
                progress: statsTracker.stats.distanceToday,
                target: 1500,
                reward: 30,
                completed: statsTracker.stats.distanceToday >= 1500
            },
            {
                id: 'visit_2_hotspots',
                name: 'Visit 2 hotspots',
                progress: statsTracker.stats.placesVisited,
                target: 2,
                reward: 40,
                completed: statsTracker.stats.placesVisited >= 2
            },
            {
                id: 'take_photo',
                name: 'Take 1 photo memory',
                progress: memoryManager.getMemoriesByType('photo').length,
                target: 1,
                reward: 25,
                completed: memoryManager.getMemoriesByType('photo').length >= 1
            }
        ];

        const missionsList = document.getElementById('daily-missions');
        if (!missionsList) return;

        missionsList.innerHTML = missions.map(mission => `
            <div class="mission-item ${mission.completed ? 'completed' : ''}">
                <div class="mission-info">
                    <h4>${mission.name}</h4>
                    <p>${mission.progress} / ${mission.target}</p>
                </div>
                ${mission.completed ?
                '<span class="mission-check">✓</span>' :
                `<div class="mission-reward">+${mission.reward} XP</div>`
            }
            </div>
        `).join('');
    }

    cleanupModal(modalId) {
        if (modalId === 'camera-modal') {
            cameraManager.stopCamera();
            cameraManager.retakePhoto();
        } else if (modalId === 'audio-modal') {
            if (audioRecorder.mediaRecorder && audioRecorder.mediaRecorder.state === 'recording') {
                audioRecorder.stopRecording();
            }
        }
    }

    checkDailySummary() {
        const lastSummary = storage.getItem('lastDailySummary');
        const today = new Date().toISOString().split('T')[0];

        if (lastSummary !== today) {
            setTimeout(() => {
                this.showDailySummary();
                storage.setItem('lastDailySummary', today);
            }, 2000);
        }
    }

    showDailySummary() {
        const stats = statsTracker.stats;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const message = `
            📊 Yesterday's Summary:
            • ${stats.stepsToday} steps
            • ${(stats.distanceToday / 1000).toFixed(2)} km traveled
            • ${stats.memoriesSaved} memories saved
            • ${stats.placesVisited} places visited
           
            ${weatherService.currentWeather ? `Weather today: ${weatherService.currentWeather.description}` : ''}
        `;

        showNotification(message, 10000);
    }

    setupDailyReset() {
        setInterval(() => {
            const lastReset = storage.getItem('lastDailyReset');
            const today = new Date().toISOString().split('T')[0];

            if (lastReset !== today) {
                statsTracker.resetDailyStats();
                motionSensors.resetStepCount();
                storage.setItem('lastDailyReset', today);
                showNotification('New day started! Fresh stats.', 3000);
            }
        }, 3600000);
    }
}

// Initialize app when DOM is ready
let app = null;

document.addEventListener('DOMContentLoaded', () => {
    if (!app) {
        app = new TravelJournalApp();
        app.init();
    }
});

//global function for GPS permission
window.requestLocationPermission = async function () {
    try {
        const position = await gpsTracker.getCurrentPosition();
        document.getElementById('gps-permission-alert').classList.add('hidden');
        showNotification('Location access granted!', 2000);

        if (window.mapManager && window.mapManager.map) {
            window.mapManager.map.setView([position.lat, position.lng], 15);
            window.mapManager.addUserMarker(position.lat, position.lng);
        }
    } catch (error) {
        showNotification('Location access denied', 3000);
    }
};

// Clear hotspots and force refresh - for clearing (test)
window.clearHotspots = function () {
    localStorage.removeItem('hotspots');
    localStorage.removeItem('hotspots_last_fetch');
    location.reload();
};