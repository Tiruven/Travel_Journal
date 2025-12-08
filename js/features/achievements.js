// Achievements Manager

class AchievementsManager {
    constructor() {
        this.achievements = [
            {
                id: 'walker_1km',
                name: 'First Steps',
                description: 'Walk 1 kilometer',
                icon: 'fa-walking',
                requirement: { type: 'distance', value: 1000 },
                reward: 50,
                unlocked: false,
                progress: 0
            },
            {
                id: 'walker_5km',
                name: 'Distance Walker',
                description: 'Walk 5 kilometers',
                icon: 'fa-hiking',
                requirement: { type: 'distance', value: 5000 },
                reward: 100,
                unlocked: false,
                progress: 0
            },
            {
                id: 'walker_10km',
                name: 'Marathon Trainee',
                description: 'Walk 10 kilometers',
                icon: 'fa-running',
                requirement: { type: 'distance', value: 10000 },
                reward: 200,
                unlocked: false,
                progress: 0
            },
            {
                id: 'explorer_5',
                name: 'Explorer',
                description: 'Visit 5 different hotspots',
                icon: 'fa-map-marked-alt',
                requirement: { type: 'hotspots', value: 5 },
                reward: 75,
                unlocked: false,
                progress: 0
            },
            {
                id: 'memory_10',
                name: 'Memory Keeper',
                description: 'Save 10 memories',
                icon: 'fa-camera',
                requirement: { type: 'memories', value: 10 },
                reward: 100,
                unlocked: false,
                progress: 0
            },
            {
                id: 'steps_1000',
                name: 'Step Master',
                description: 'Take 1000 steps in a day',
                icon: 'fa-shoe-prints',
                requirement: { type: 'steps', value: 1000 },
                reward: 80,
                unlocked: false,
                progress: 0
            }
        ];
        this.init();
    }

    async init() {
        await this.loadAchievements();
        this.updateAchievementsUI();
    }

    async loadAchievements() {
        const saved = await storage.getAllAchievements();
        
        if (saved && saved.length > 0) {
            // Merge saved data with default achievements
            this.achievements = this.achievements.map(achievement => {
                const savedAchievement = saved.find(s => s.id === achievement.id);
                if (savedAchievement) {
                    return {
                        ...achievement,
                        progress: Math.round(savedAchievement.progress || 0),
                        unlocked: savedAchievement.unlocked || false,
                        unlockedAt: savedAchievement.unlockedAt
                    };
                }
                return achievement;
            });
        }
    }

    async checkAchievements() {
        const stats = statsTracker.getStats();
        let newUnlocks = [];

        for (const achievement of this.achievements) {
            if (achievement.unlocked) continue;

            let progress = 0;
            let completed = false;

            switch(achievement.requirement.type) {
                case 'distance':
                    progress = Math.round(stats.allTimeDistance);
                    completed = progress >= achievement.requirement.value;
                    break;
                
                case 'hotspots':
                    progress = Math.round(stats.placesVisited);
                    completed = progress >= achievement.requirement.value;
                    break;
                
                case 'memories':
                    progress = Math.round(stats.memoriesSaved);
                    completed = progress >= achievement.requirement.value;
                    break;
                
                case 'steps':
                    progress = Math.round(stats.stepsToday);
                    completed = progress >= achievement.requirement.value;
                    break;
            }

            // Update progress
            achievement.progress = Math.min(progress, achievement.requirement.value);

            if (completed && !achievement.unlocked) {
                achievement.unlocked = true;
                achievement.unlockedAt = Date.now();
                newUnlocks.push(achievement);
                
                // Award XP
                statsTracker.addXP(achievement.reward);
            }

            // Save achievement (without throwing errors)
            try {
                await storage.saveAchievement(achievement);
            } catch (error) {
                console.error('Error saving achievement:', achievement.id, error);
            }
        }

        // Show notifications for new unlocks
        newUnlocks.forEach(achievement => {
            showNotification(
                `🏆 Achievement Unlocked: ${achievement.name} (+${achievement.reward} XP)`,
                5000
            );
        });

        this.updateAchievementsUI();
    }

    updateAchievementsUI() {
        const achievementsList = document.getElementById('achievements-list');
        if (!achievementsList) return;

        achievementsList.innerHTML = this.achievements.map(achievement => {
            const progressPercent = (achievement.progress / achievement.requirement.value) * 100;
            
            return `
                <div class="achievement-item ${achievement.unlocked ? '' : 'locked'}">
                    <i class="fas ${achievement.icon}"></i>
                    <div class="achievement-info">
                        <h4>${achievement.name}</h4>
                        <p>${achievement.description}</p>
                        ${!achievement.unlocked ? `
                            <div class="achievement-progress">
                                <div class="achievement-progress-bar" style="width: ${progressPercent}%"></div>
                            </div>
                            <small>${Math.round(achievement.progress)} / ${achievement.requirement.value}</small>
                        ` : `
                            <small style="color: var(--success-color);">✓ Unlocked</small>
                        `}
                    </div>
                </div>
            `;
        }).join('');
    }

    getUnlockedCount() {
        return this.achievements.filter(a => a.unlocked).length;
    }

    getTotalCount() {
        return this.achievements.length;
    }
}

// Create global instance
const achievementsManager = new AchievementsManager();