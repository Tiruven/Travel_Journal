// Hotspot Manager with Auto-Reload on Location Change

class HotspotManager {
    constructor() {
        this.hotspots = [];
        this.wishlist = [];
        this.categories = ['scenic', 'historical', 'beach', 'food', 'hidden', 'activity'];
        this.activeFilters = ['all'];

        // Track last fetch location
        this.lastFetchLocation = null;
        this.RELOAD_DISTANCE = 2000;
        this.FETCH_RADIUS = 5000;
        this.lastFetchTime = null;
        this.MIN_FETCH_INTERVAL = 60000;

        this.init();
    }

    async init() {
        await this.loadHotspots();
        await this.loadWishlist();
        await this.syncVisitedHotspots();
        this.setupCategoryFilters();
        this.startLocationMonitoring();
    }

    startLocationMonitoring() {
        if (gpsTracker) {
            gpsTracker.onPositionUpdate((position) => {
                this.checkAndReloadHotspots(position);
            });
        }
    }

    async checkAndReloadHotspots(position) {
        if (this.lastFetchTime && Date.now() - this.lastFetchTime < this.MIN_FETCH_INTERVAL) {
            return;
        }

        if (this.lastFetchLocation) {
            const distance = calculateDistance(
                this.lastFetchLocation.lat,
                this.lastFetchLocation.lng,
                position.lat,
                position.lng
            );

            if (distance > this.RELOAD_DISTANCE) {
                console.log(`Moved ${(distance / 1000).toFixed(2)}km - reloading hotspots...`);
                await this.reloadHotspotsForLocation(position);
            }
        }
    }

    async reloadHotspotsForLocation(position) {
        try {
            showNotification('Loading nearby hotspots...', 2000);

            const newHotspots = await geoapifyService.fetchNearbyPlaces(
                position.lat,
                position.lng,
                ['tourism', 'entertainment', 'natural', 'beach', 'catering', 'leisure'],
                this.FETCH_RADIUS
            );

            if (newHotspots.length > 0) {
                this.mergeHotspots(newHotspots);
                storage.setItem('hotspots', this.hotspots);

                this.lastFetchLocation = {
                    lat: position.lat,
                    lng: position.lng
                };
                this.lastFetchTime = Date.now();

                localStorage.setItem('last_hotspot_fetch', JSON.stringify({
                    location: this.lastFetchLocation,
                    time: this.lastFetchTime
                }));

                console.log(`Loaded ${newHotspots.length} new hotspots`);
                showNotification(`Found ${newHotspots.length} places nearby!`, 3000);

                if (window.mapManager && window.mapManager.isInitialized) {
                    window.mapManager.updateHotspotMarkers();
                }
            }
        } catch (error) {
            console.error('Error reloading hotspots:', error);
        }
    }

    mergeHotspots(newHotspots) {
        const existingMap = new Map();
        this.hotspots.forEach(hotspot => {
            const key = `${hotspot.lat.toFixed(4)}_${hotspot.lng.toFixed(4)}`;
            existingMap.set(key, hotspot);
        });

        newHotspots.forEach(newHotspot => {
            const key = `${newHotspot.lat.toFixed(4)}_${newHotspot.lng.toFixed(4)}`;
            const existing = existingMap.get(key);

            if (existing) {
                newHotspot.visited = existing.visited;
                newHotspot.notified = existing.notified;

                const index = this.hotspots.findIndex(h => h.id === existing.id);
                if (index !== -1) {
                    this.hotspots[index] = newHotspot;
                }
            } else {
                this.hotspots.push(newHotspot);
            }
        });

        const userPos = gpsTracker.currentPosition;
        if (userPos) {
            this.hotspots = this.hotspots.filter(hotspot => {
                const distance = calculateDistance(
                    userPos.lat,
                    userPos.lng,
                    hotspot.lat,
                    hotspot.lng
                );
                return distance < 10000;
            });
        }
    }

    async loadHotspots() {
        await storage.waitForReady();

        const lastFetch = localStorage.getItem('last_hotspot_fetch');
        if (lastFetch) {
            const fetchData = JSON.parse(lastFetch);
            this.lastFetchLocation = fetchData.location;
            this.lastFetchTime = fetchData.time;
        }

        const savedHotspots = storage.getItem('hotspots');

        if (savedHotspots && savedHotspots.length > 0) {
            console.log(`Loaded ${savedHotspots.length} hotspots from storage`);
            this.hotspots = savedHotspots;

            await this.syncVisitedHotspots();

            const position = gpsTracker.currentPosition;
            if (position) {
                await this.checkAndReloadHotspots(position);
            }
        } else {
            const position = await gpsTracker.getCurrentPosition();

            if (position && geoapifyService.apiKey === '199b4ac789c040c180ad396100269fdd') {
                console.log('Fetching hotspots from Geoapify...');

                try {
                    this.hotspots = await geoapifyService.fetchNearbyPlaces(
                        position.lat,
                        position.lng,
                        ['tourism', 'entertainment', 'natural', 'beach', 'catering', 'leisure'],
                        this.FETCH_RADIUS
                    );

                    if (this.hotspots.length > 0) {
                        console.log(`✓ Loaded ${this.hotspots.length} hotspots from Geoapify`);
                        storage.setItem('hotspots', this.hotspots);

                        await this.syncVisitedHotspots();

                        this.lastFetchLocation = {
                            lat: position.lat,
                            lng: position.lng
                        };
                        this.lastFetchTime = Date.now();

                        localStorage.setItem('last_hotspot_fetch', JSON.stringify({
                            location: this.lastFetchLocation,
                            time: this.lastFetchTime
                        }));
                    } else {
                        console.log('No hotspots found from Geoapify, generating demo hotspots');
                        this.hotspots = this.generateDemoHotspots(position.lat, position.lng);
                        storage.setItem('hotspots', this.hotspots);
                    }
                } catch (error) {
                    console.error('Geoapify error:', error);
                    this.hotspots = this.generateDemoHotspots(position.lat, position.lng);
                    storage.setItem('hotspots', this.hotspots);
                }
            } else if (position) {
                console.log('Generating demo hotspots...');
                this.hotspots = this.generateDemoHotspots(position.lat, position.lng);
                storage.setItem('hotspots', this.hotspots);
            }
        }

        return this.hotspots;
    }

    // WISHLIST METHODS - CLEANED UP
    async loadWishlist() {
        try {
            const wishlistData = await storage.getWishlist();
            this.wishlist = wishlistData.map(item => item.hotspot_api_id);
            console.log('✓ Wishlist loaded from database:', this.wishlist.length, 'items');
        } catch (error) {
            console.error('Load wishlist error:', error);
            this.wishlist = [];
        }
    }

    async addToWishlist(hotspotId) {
        const hotspot = this.getHotspotById(hotspotId);
        if (!hotspot) {
            console.error('Hotspot not found:', hotspotId);
            return;
        }

        try {
            // Check if already in wishlist
            if (this.wishlist.includes(hotspotId)) {
                console.log('Already in wishlist');
                return;
            }

            // Add to database
            await storage.addToWishlist(hotspot);

            // Update local array
            this.wishlist.push(hotspotId);

            console.log('✓ Added to wishlist:', hotspot.name, 'Total:', this.wishlist.length);
            showNotification('❤️ Added to wishlist!', 2000);

            // Trigger UI updates
            this.notifyWishlistChange();

        } catch (error) {
            console.error('Add to wishlist error:', error);
            showNotification('Failed to add to wishlist', 3000);
        }
    }

    async removeFromWishlist(hotspotId) {
        try {
            // Remove from database
            await storage.removeFromWishlist(hotspotId);

            // Update local array
            this.wishlist = this.wishlist.filter(id => id !== hotspotId);

            console.log('✓ Removed from wishlist:', hotspotId, 'Total:', this.wishlist.length);
            showNotification('Removed from wishlist', 2000);

            // Trigger UI updates
            this.notifyWishlistChange();

        } catch (error) {
            console.error('Remove from wishlist error:', error);
            showNotification('Failed to remove from wishlist', 3000);
        }
    }

    isInWishlist(hotspotId) {
        return this.wishlist.includes(hotspotId);
    }

    getWishlistHotspots() {
        return this.hotspots.filter(h => this.wishlist.includes(h.id));
    }

    notifyWishlistChange() {
        if (window.mapManager && window.mapManager.updateHotspotMarkers) {
            window.mapManager.updateHotspotMarkers();
        }

        if (window.hotspotsExplorer) {
            window.hotspotsExplorer.updateStats();
            window.hotspotsExplorer.applyFilters();
        }
    }

    async syncWishlist() {
        await this.loadWishlist();
    }

    // VISITED HOTSPOTS
    async syncVisitedHotspots() {
        try {
            console.log('=== SYNCING VISITED HOTSPOTS ===');
            const visited = await storage.getVisitedHotspots();
            const visitedIds = visited.map(v => v.hotspot_api_id);

            console.log('Visited hotspots from database:', visitedIds.length);
            console.log('IDs:', visitedIds);

            let syncedCount = 0;
            this.hotspots.forEach(hotspot => {
                if (visitedIds.includes(hotspot.id)) {
                    hotspot.visited = true;
                    syncedCount++;
                }
            });

            console.log('✓ Synced', syncedCount, 'visited hotspots to local data');
            console.log('==============================');
        } catch (error) {
            console.error('Sync visited hotspots error:', error);
        }
    }

    async markHotspotAsVisited(hotspotId) {
        const hotspot = this.hotspots.find(h => h.id === hotspotId);

        if (hotspot) {
            if (!hotspot.visited) {
                hotspot.visited = true;

                try {
                    console.log('=== MARKING AS VISITED ===');
                    console.log('Hotspot:', hotspot.name);
                    console.log('ID:', hotspotId);

                    // Save to Supabase database
                    const result = await storage.markHotspotAsVisited(hotspot);
                    console.log('✓ Saved to database:', result);

                    // Save to localStorage as backup
                    storage.setItem('hotspots', this.hotspots);

                    if (typeof statsTracker !== 'undefined') {
                        statsTracker.incrementPlacesVisited();
                    }

                    if (typeof achievementsManager !== 'undefined') {
                        await achievementsManager.checkAchievements();
                    }

                    // Get total visited count
                    const visitedCount = this.getVisitedHotspots().length;
                    console.log('Total visited hotspots:', visitedCount);
                    console.log('========================');

                    showNotification(`✓ Visited: ${hotspot.name}`, 3000);
                } catch (error) {
                    console.error('❌ Mark visited error:', error);
                    hotspot.visited = false;
                    showNotification('Failed to mark as visited', 3000);
                }
            } else {
                showNotification(`Already visited: ${hotspot.name}`, 2000);
            }
        } else {
            console.error(`Hotspot not found: ${hotspotId}`);
        }
    }

    getVisitedHotspots() {
        return this.hotspots.filter(h => h.visited);
    }

    // OTHER METHODS
    generateDemoHotspots(lat, lng, count = 20) {
        const hotspots = [];
        const radius = 0.02;

        const names = {
            scenic: ['Sunset Point', 'Mountain View', 'Valley Lookout', 'Panorama Peak', 'Vista Ridge'],
            historical: ['Old Fort', 'Heritage Museum', 'Ancient Temple', 'Historic Square', 'Memorial Park'],
            beach: ['Sandy Bay', 'Crystal Cove', 'Paradise Beach', 'Coral Shore', 'Sunset Beach'],
            food: ['Local Café', 'Street Food Market', 'Seaside Restaurant', 'Garden Bistro', 'Rooftop Dining'],
            hidden: ['Secret Garden', 'Hidden Waterfall', 'Mystery Cave', 'Forgotten Trail', 'Lost Valley'],
            activity: ['Adventure Park', 'Sports Complex', 'Hiking Trail', 'Water Sports Center', 'Bike Path']
        };

        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const distance = radius * (0.5 + Math.random() * 0.5);

            const hotspotLat = lat + distance * Math.cos(angle);
            const hotspotLng = lng + distance * Math.sin(angle);
            const category = this.categories[Math.floor(Math.random() * this.categories.length)];
            const categoryNames = names[category];
            const name = categoryNames[Math.floor(Math.random() * categoryNames.length)];

            hotspots.push({
                id: generateId(),
                name: name,
                lat: hotspotLat,
                lng: hotspotLng,
                category: category,
                description: this.generateDescription(category),
                address: `${hotspotLat.toFixed(4)}, ${hotspotLng.toFixed(4)}`,
                visited: false,
                rating: (3 + Math.random() * 2).toFixed(1),
                photos: [],
                details: {
                    website: '',
                    phone: '',
                    openingHours: '',
                    facilities: []
                },
                distance: 0
            });
        }

        return hotspots;
    }

    generateDescription(category) {
        const descriptions = {
            scenic: 'Beautiful views and perfect photo opportunities',
            historical: 'Rich history and cultural significance',
            beach: 'Pristine shores and crystal clear waters',
            food: 'Delicious local cuisine and atmosphere',
            hidden: 'Off the beaten path gem',
            activity: 'Fun activities and adventures'
        };
        return descriptions[category] || 'Interesting place to visit';
    }

    setupCategoryFilters() {
        const filterButtons = document.querySelectorAll('.filter-btn');

        filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const category = btn.dataset.category;
                this.toggleCategoryFilter(category);

                filterButtons.forEach(b => b.classList.remove('active'));

                if (this.activeFilters.includes('all')) {
                    const allBtn = document.querySelector('[data-category="all"]');
                    if (allBtn) allBtn.classList.add('active');
                } else {
                    this.activeFilters.forEach(cat => {
                        const catBtn = document.querySelector(`[data-category="${cat}"]`);
                        if (catBtn) catBtn.classList.add('active');
                    });
                }

                if (window.mapManager && window.mapManager.isInitialized) {
                    window.mapManager.updateHotspotMarkers();
                }
            });
        });
    }

    toggleCategoryFilter(category) {
        if (category === 'all') {
            this.activeFilters = ['all'];
        } else {
            this.activeFilters = this.activeFilters.filter(f => f !== 'all');

            const index = this.activeFilters.indexOf(category);
            if (index > -1) {
                this.activeFilters.splice(index, 1);
            } else {
                this.activeFilters.push(category);
            }

            if (this.activeFilters.length === 0) {
                this.activeFilters = ['all'];
            }
        }
    }

    getFilteredHotspots() {
        if (this.activeFilters.includes('all')) {
            return this.hotspots;
        }
        return this.hotspots.filter(h => this.activeFilters.includes(h.category));
    }

    updateHotspotDistances(userLat, userLng) {
        this.hotspots.forEach(hotspot => {
            hotspot.distance = calculateDistance(
                userLat,
                userLng,
                hotspot.lat,
                hotspot.lng
            );
        });
    }

    getNearbyHotspots(lat, lng, radius = 500) {
        this.updateHotspotDistances(lat, lng);
        return this.hotspots
            .filter(h => h.distance <= radius)
            .sort((a, b) => a.distance - b.distance);
    }

    getHotspotById(id) {
        return this.hotspots.find(h => h.id === id);
    }

    getCategoryIcon(category) {
        const icons = {
            scenic: 'fa-mountain',
            historical: 'fa-landmark',
            beach: 'fa-umbrella-beach',
            food: 'fa-utensils',
            hidden: 'fa-gem',
            activity: 'fa-running',
            tourism: 'fa-camera',
            entertainment: 'fa-theater-masks',
            natural: 'fa-tree',
            catering: 'fa-utensils',
            accommodation: 'fa-hotel'
        };
        return icons[category] || 'fa-map-marker-alt';
    }

    addCustomHotspot(hotspot) {
        hotspot.id = generateId();
        this.hotspots.push(hotspot);
        storage.setItem('hotspots', this.hotspots);

        if (window.mapManager) {
            window.mapManager.updateHotspotMarkers();
        }
    }

    async forceRefreshHotspots() {
        const position = gpsTracker.currentPosition;
        if (!position) {
            showNotification('Location not available', 2000);
            return;
        }

        this.lastFetchTime = 0;
        await this.reloadHotspotsForLocation(position);
    }


}

// Create global instance
const hotspotManager = new HotspotManager();