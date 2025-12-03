// Storage Manager for IndexedDB and LocalStorage
class StorageManager {
    constructor() {
        this.dbName = 'TravelJournalDB';
        this.dbVersion = 1;
        this.db = null;
        this.isReady = false;
        this.initPromise = this.initDB();
    }

    // Initialize IndexedDB
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('IndexedDB error:', request.error);
                this.isReady = true; // Mark as ready even on error, will use localStorage
                resolve(null);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                this.isReady = true;
                console.log('IndexedDB initialized successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object stores
                if (!db.objectStoreNames.contains('memories')) {
                    const memoryStore = db.createObjectStore('memories', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    memoryStore.createIndex('type', 'type', { unique: false });
                    memoryStore.createIndex('timestamp', 'timestamp', { unique: false });
                    memoryStore.createIndex('location', 'location', { unique: false });
                }

                if (!db.objectStoreNames.contains('routes')) {
                    db.createObjectStore('routes', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                }

                if (!db.objectStoreNames.contains('stats')) {
                    db.createObjectStore('stats', { keyPath: 'date' });
                }

                if (!db.objectStoreNames.contains('achievements')) {
                    db.createObjectStore('achievements', { keyPath: 'id' });
                }
            };
        });
    }

    // Wait for DB to be ready
    async waitForReady() {
        if (this.isReady) return;
        await this.initPromise;
    }

    // Save memory (photo, audio, text)
    async saveMemory(memory) {
        await this.waitForReady();
        
        if (!this.db) {
            // Fallback to localStorage
            const memories = this.getItem('memories') || [];
            memory.id = Date.now();
            memories.push(memory);
            this.setItem('memories', memories);
            return memory.id;
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['memories'], 'readwrite');
            const store = transaction.objectStore('memories');
            
            memory.timestamp = memory.timestamp || Date.now();
            memory.date = memory.date || new Date().toISOString();
            
            const request = store.add(memory);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Get all memories
    async getAllMemories(type = null) {
        await this.waitForReady();
        
        if (!this.db) {
            // Fallback to localStorage
            const memories = this.getItem('memories') || [];
            return type ? memories.filter(m => m.type === type) : memories;
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['memories'], 'readonly');
            const store = transaction.objectStore('memories');
            
            let request;
            if (type) {
                const index = store.index('type');
                request = index.getAll(type);
            } else {
                request = store.getAll();
            }
            
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    // Delete memory
    async deleteMemory(id) {
        await this.waitForReady();
        
        if (!this.db) {
            const memories = this.getItem('memories') || [];
            const filtered = memories.filter(m => m.id !== id);
            this.setItem('memories', filtered);
            return;
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['memories'], 'readwrite');
            const store = transaction.objectStore('memories');
            const request = store.delete(id);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Save route point
    async saveRoutePoint(point) {
        await this.waitForReady();
        
        if (!this.db) {
            const routes = this.getItem('routes') || [];
            point.id = Date.now();
            routes.push(point);
            this.setItem('routes', routes);
            return point.id;
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['routes'], 'readwrite');
            const store = transaction.objectStore('routes');
            
            point.timestamp = point.timestamp || Date.now();
            const request = store.add(point);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Get today's route
    async getTodayRoute() {
        await this.waitForReady();
        
        const today = new Date().setHours(0, 0, 0, 0);
        
        if (!this.db) {
            const routes = this.getItem('routes') || [];
            return routes.filter(point => {
                const pointDate = new Date(point.timestamp).setHours(0, 0, 0, 0);
                return pointDate === today;
            });
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['routes'], 'readonly');
            const store = transaction.objectStore('routes');
            const request = store.getAll();
            
            request.onsuccess = () => {
                const todayRoute = request.result.filter(point => {
                    const pointDate = new Date(point.timestamp).setHours(0, 0, 0, 0);
                    return pointDate === today;
                });
                resolve(todayRoute);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // Save daily stats
    async saveDailyStats(stats) {
        await this.waitForReady();
        
        const date = new Date().toISOString().split('T')[0];
        
        if (!this.db) {
            const allStats = this.getItem('dailyStats') || {};
            allStats[date] = { ...stats, date };
            this.setItem('dailyStats', allStats);
            return;
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['stats'], 'readwrite');
            const store = transaction.objectStore('stats');
            
            stats.date = date;
            const request = store.put(stats);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Get stats for date
    async getStatsForDate(date) {
        await this.waitForReady();
        
        if (!this.db) {
            const allStats = this.getItem('dailyStats') || {};
            return allStats[date] || {};
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['stats'], 'readonly');
            const store = transaction.objectStore('stats');
            const request = store.get(date);
            
            request.onsuccess = () => resolve(request.result || {});
            request.onerror = () => reject(request.error);
        });
    }

    // Save/Update achievement
    async saveAchievement(achievement) {
        await this.waitForReady();
        
        if (!this.db) {
            const achievements = this.getItem('achievements') || [];
            const index = achievements.findIndex(a => a.id === achievement.id);
            if (index > -1) {
                achievements[index] = achievement;
            } else {
                achievements.push(achievement);
            }
            this.setItem('achievements', achievements);
            return;
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['achievements'], 'readwrite');
            const store = transaction.objectStore('achievements');
            const request = store.put(achievement);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Get all achievements
    async getAllAchievements() {
        await this.waitForReady();
        
        if (!this.db) {
            return this.getItem('achievements') || [];
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['achievements'], 'readonly');
            const store = transaction.objectStore('achievements');
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    // LocalStorage helpers
    setItem(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('LocalStorage error:', e);
        }
    }

    getItem(key) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (e) {
            console.error('LocalStorage error:', e);
            return null;
        }
    }

    removeItem(key) {
        localStorage.removeItem(key);
    }
}

// Create global instance and wait for it to be ready
const storage = new StorageManager();