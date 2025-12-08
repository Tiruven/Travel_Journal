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
        
        // Load all-time stats from localStorage as backup
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
        try {
            await storage.saveDailyStats(this.stats);
            
            // Save all-time stats to localStorage as backup
            storage.setItem('allTimeStats', {
                distance: this.stats.allTimeDistance,
                level: this.stats.level,
                xp: this.stats.xp,
                xpToNextLevel: this.stats.xpToNextLevel
            });
        } catch (error) {
            console.error('Error saving stats:', error);
        }
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
        if (typeof achievementsManager !== 'undefined') {
            achievementsManager.checkAchievements();
        }
    }

    startTimeTracking() {
        let lastTime = Date.now();
        
        setInterval(() => {
            if (gpsTracker && gpsTracker.isTracking) {
                const currentTime = Date.now();
                const elapsed = Math.round((currentTime - lastTime) / 1000); // Round to seconds
                
                this.stats.timeWalkedToday += elapsed;
                this.updateUI();
                this.saveStats();
            }
            
            lastTime = Date.now();
        }, 10000); // Update every 10 seconds
    }

    updateUI() {
        // Bottom bar
        const stepCount = document.getElementById('step-count');
        if (stepCount) stepCount.textContent = Math.round(this.stats.stepsToday);
        
        const distanceTraveled = document.getElementById('distance-traveled');
        if (distanceTraveled) distanceTraveled.textContent = (this.stats.distanceToday / 1000).toFixed(2);
        
        const userLevel = document.getElementById('user-level');
        if (userLevel) userLevel.textContent = `Lv. ${this.stats.level}`;

        // Stats dashboard
        const totalStepsToday = document.getElementById('total-steps-today');
        if (totalStepsToday) totalStepsToday.textContent = Math.round(this.stats.stepsToday);
        
        const distanceToday = document.getElementById('distance-today');
        if (distanceToday) distanceToday.textContent = `${(this.stats.distanceToday / 1000).toFixed(2)} km`;
        
        const highestAltitude = document.getElementById('highest-altitude');
        if (highestAltitude) highestAltitude.textContent = `${Math.round(this.stats.highestAltitude)} m`;
        
        const placesVisited = document.getElementById('places-visited');
        if (placesVisited) placesVisited.textContent = Math.round(this.stats.placesVisited);
        
        const allTimeDistance = document.getElementById('all-time-distance');
        if (allTimeDistance) allTimeDistance.textContent = `${(this.stats.allTimeDistance / 1000).toFixed(2)} km`;
        
        const timeWalked = document.getElementById('time-walked');
        if (timeWalked) timeWalked.textContent = formatDuration(Math.round(this.stats.timeWalkedToday));
        
        // Calculate average speed
        const avgSpeed = this.stats.timeWalkedToday > 0
            ? (this.stats.distanceToday / 1000) / (this.stats.timeWalkedToday / 3600)
            : 0;
        
        const avgSpeedElem = document.getElementById('avg-speed');
        if (avgSpeedElem) avgSpeedElem.textContent = `${avgSpeed.toFixed(1)} km/h`;
        
        const totalMemories = document.getElementById('total-memories');
        if (totalMemories) totalMemories.textContent = Math.round(this.stats.memoriesSaved);
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