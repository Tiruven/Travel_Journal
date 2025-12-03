// Stats Tracker
class StatsTracker {
    constructor() {
        this.stats = {
            stepsToday: 0,
            distanceToday: 0,
            placesVisited: 0,
            memoriesSaved: 0,
            highestAltitude: 0,
            timeWalkedToday: 0,
            allTimeDistance: 0,
            level: 1,
            xp: 0,
            xpToNextLevel: 100
        };
        this.init();
    }

    async init() {
        await this.loadStats();
        this.startTimeTracking();
    }

    async loadStats() {
        const today = new Date().toISOString().split('T')[0];
        const savedStats = await storage.getStatsForDate(today);
        
        if (savedStats && Object.keys(savedStats).length > 0) {
            this.stats = { ...this.stats, ...savedStats };
        }

        // Load all-time stats from localStorage
        const allTimeStats = storage.getItem('allTimeStats');
        if (allTimeStats) {
            this.stats.allTimeDistance = allTimeStats.distance || 0;
            this.stats.level = allTimeStats.level || 1;
            this.stats.xp = allTimeStats.xp || 0;
            this.stats.xpToNextLevel = allTimeStats.xpToNextLevel || 100;
        }

        this.updateUI();
    }

    async saveStats() {
        const today = new Date().toISOString().split('T')[0];
        await storage.saveDailyStats(this.stats);

        // Save all-time stats
        storage.setItem('allTimeStats', {
            distance: this.stats.allTimeDistance,
            level: this.stats.level,
            xp: this.stats.xp,
            xpToNextLevel: this.stats.xpToNextLevel
        });
    }

    addSteps(steps = 1) {
        this.stats.stepsToday += steps;
        
        // Estimate distance (average step = 0.762 meters)
        const distance = steps * 0.762;
        this.addDistance(distance);
        
        // Add XP
        this.addXP(1);
        
        this.updateUI();
        this.saveStats();
    }

    addDistance(meters) {
        this.stats.distanceToday += meters;
        this.stats.allTimeDistance += meters;
        
        // Add XP based on distance
        const kmTraveled = meters / 1000;
        this.addXP(Math.floor(kmTraveled * 10));
        
        this.updateUI();
        this.saveStats();
    }

    incrementPlacesVisited() {
        this.stats.placesVisited++;
        this.addXP(20); // Bonus XP for visiting places
        this.updateUI();
        this.saveStats();
    }

    incrementMemories() {
        this.stats.memoriesSaved++;
        this.addXP(15); // Bonus XP for creating memories
        this.updateUI();
        this.saveStats();
    }

    updateAltitude(altitude) {
        if (altitude && altitude > this.stats.highestAltitude) {
            this.stats.highestAltitude = Math.round(altitude);
            this.updateUI();
            this.saveStats();
        }
    }

    addXP(amount) {
        this.stats.xp += amount;
        
        // Check for level up
        while (this.stats.xp >= this.stats.xpToNextLevel) {
            this.levelUp();
        }
    }

    levelUp() {
        this.stats.xp -= this.stats.xpToNextLevel;
        this.stats.level++;
        this.stats.xpToNextLevel = Math.floor(this.stats.xpToNextLevel * 1.5);
        
        showNotification(`🎉 Level Up! You are now Level ${this.stats.level}`, 5000);
        
        // Check achievements
        achievementsManager.checkAchievements();
    }

    startTimeTracking() {
        let lastTime = Date.now();
        
        setInterval(() => {
            if (gpsTracker.isTracking) {
                const currentTime = Date.now();
                const elapsed = (currentTime - lastTime) / 1000; // seconds
                
                this.stats.timeWalkedToday += elapsed;
                this.updateUI();
                this.saveStats();
            }
            
            lastTime = Date.now();
        }, 10000); // Update every 10 seconds
    }

    updateUI() {
        // Bottom bar
        document.getElementById('step-count').textContent = this.stats.stepsToday;
        document.getElementById('distance-traveled').textContent = 
            (this.stats.distanceToday / 1000).toFixed(2);
        document.getElementById('user-level').textContent = `Lv. ${this.stats.level}`;

        // Stats dashboard
        document.getElementById('total-steps-today').textContent = this.stats.stepsToday;
        document.getElementById('distance-today').textContent = 
            `${(this.stats.distanceToday / 1000).toFixed(2)} km`;
        document.getElementById('highest-altitude').textContent = 
            `${this.stats.highestAltitude} m`;
        document.getElementById('places-visited').textContent = this.stats.placesVisited;
        document.getElementById('all-time-distance').textContent = 
            `${(this.stats.allTimeDistance / 1000).toFixed(2)} km`;
        document.getElementById('time-walked').textContent = 
            formatDuration(this.stats.timeWalkedToday);
        
        // Calculate average speed
        const avgSpeed = this.stats.timeWalkedToday > 0 
            ? (this.stats.distanceToday / 1000) / (this.stats.timeWalkedToday / 3600) 
            : 0;
        document.getElementById('avg-speed').textContent = `${avgSpeed.toFixed(1)} km/h`;
        
        document.getElementById('total-memories').textContent = this.stats.memoriesSaved;
    }

    getStats() {
        return this.stats;
    }

    resetDailyStats() {
        this.stats.stepsToday = 0;
        this.stats.distanceToday = 0;
        this.stats.timeWalkedToday = 0;
        this.stats.placesVisited = 0;
        this.updateUI();
        this.saveStats();
    }
}

// Create global instance
const statsTracker = new StatsTracker();