// Hotspot Manager with Auto-Reload on Location Change

class HotspotManager {
    constructor() {
        this.hotspots = [];
        this.wishlist = [];
        this.categories = ['scenic', 'historical', 'beach', 'food', 'hidden', 'activity'];
        this.activeFilters = ['all'];
        
        // NEW: Track last fetch location
        this.lastFetchLocation = null;
        this.RELOAD_DISTANCE = 2000; // Reload when moved 2km from last fetch
        this.FETCH_RADIUS = 5000; // Fetch 5km radius
        this.lastFetchTime = null;
        this.MIN_FETCH_INTERVAL = 60000; // Don't fetch more than once per minute
        
        this.init();
    }

    async init() {
        await this.loadHotspots();
        await this.loadWishlist();
        this.setupCategoryFilters();
        this.startLocationMonitoring();
    }

    // NEW: Monitor location changes and auto-reload hotspots
    startLocationMonitoring() {
        if (gpsTracker) {
            gpsTracker.onPositionUpdate((position) => {
                this.checkAndReloadHotspots(position);
            });
        }
    }

    // NEW: Check if we should reload hotspots
    async checkAndReloadHotspots(position) {
        // Don't check too frequently
        if (this.lastFetchTime && Date.now() - this.lastFetchTime < this.MIN_FETCH_INTERVAL) {
            return;
        }

        // Check if we've moved far enough
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

    // NEW: Reload hotspots for new location
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
                // Merge with existing hotspots (keep visited status)
                this.mergeHotspots(newHotspots);
                
                // Save updated list
                storage.setItem('hotspots', this.hotspots);
                
                // Update last fetch location
                this.lastFetchLocation = {
                    lat: position.lat,
                    lng: position.lng
                };
                this.lastFetchTime = Date.now();
                
                // Save fetch location
                localStorage.setItem('last_hotspot_fetch', JSON.stringify({
                    location: this.lastFetchLocation,
                    time: this.lastFetchTime
                }));

                console.log(`Loaded ${newHotspots.length} new hotspots`);
                showNotification(`Found ${newHotspots.length} places nearby!`, 3000);

                // Update map markers if on main page
                if (window.mapManager && window.mapManager.isInitialized) {
                    window.mapManager.updateHotspotMarkers();
                }
            }
        } catch (error) {
            console.error('Error reloading hotspots:', error);
        }
    }

    // NEW: Merge new hotspots with existing ones, keeping visited status
    mergeHotspots(newHotspots) {
        // Create a map of existing hotspots by location (for quick lookup)
        const existingMap = new Map();
        this.hotspots.forEach(hotspot => {
            const key = `${hotspot.lat.toFixed(4)}_${hotspot.lng.toFixed(4)}`;
            existingMap.set(key, hotspot);
        });

        // Process new hotspots
        newHotspots.forEach(newHotspot => {
            const key = `${newHotspot.lat.toFixed(4)}_${newHotspot.lng.toFixed(4)}`;
            const existing = existingMap.get(key);

            if (existing) {
                // Update existing hotspot but keep visited status
                newHotspot.visited = existing.visited;
                newHotspot.notified = existing.notified;
                
                // Replace in array
                const index = this.hotspots.findIndex(h => h.id === existing.id);
                if (index !== -1) {
                    this.hotspots[index] = newHotspot;
                }
            } else {
                // New hotspot - add it
                this.hotspots.push(newHotspot);
            }
        });

        // Remove hotspots that are too far away (> 10km)
        const userPos = gpsTracker.currentPosition;
        if (userPos) {
            this.hotspots = this.hotspots.filter(hotspot => {
                const distance = calculateDistance(
                    userPos.lat,
                    userPos.lng,
                    hotspot.lat,
                    hotspot.lng
                );
                return distance < 10000; // Keep within 10km
            });
        }
    }

    async loadHotspots() {
        await storage.waitForReady();
        
        // Load last fetch info
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
            
            // Check if we need to refresh based on current location
            const position = gpsTracker.currentPosition;
            if (position) {
                await this.checkAndReloadHotspots(position);
            }
        } else {
            // No saved hotspots - fetch fresh
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

    async loadWishlist() {
        this.wishlist = storage.getItem('wishlist') || [];
    }

    addToWishlist(hotspotId) {
        if (!this.wishlist.includes(hotspotId)) {
            this.wishlist.push(hotspotId);
            storage.setItem('wishlist', this.wishlist);
            showNotification('Added to wishlist!', 2000);
        }
    }

    removeFromWishlist(hotspotId) {
        this.wishlist = this.wishlist.filter(id => id !== hotspotId);
        storage.setItem('wishlist', this.wishlist);
        showNotification('Removed from wishlist', 2000);
    }

    isInWishlist(hotspotId) {
        return this.wishlist.includes(hotspotId);
    }

    getWishlistHotspots() {
        return this.hotspots.filter(h => this.wishlist.includes(h.id));
    }

    getVisitedHotspots() {
        return this.hotspots.filter(h => h.visited);
    }

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

    markHotspotAsVisited(hotspotId) {
        const hotspot = this.hotspots.find(h => h.id === hotspotId);
        
        if (hotspot) {
            if (!hotspot.visited) {
                hotspot.visited = true;
                storage.setItem('hotspots', this.hotspots);
                
                if (typeof statsTracker !== 'undefined') {
                    statsTracker.incrementPlacesVisited();
                }
                
                showNotification(`✓ Visited: ${hotspot.name}`, 3000);
            } else {
                showNotification(`Already visited: ${hotspot.name}`, 2000);
            }
        } else {
            console.error(`Hotspot not found: ${hotspotId}`);
        }
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

    // NEW: Manual refresh function
    async forceRefreshHotspots() {
        const position = gpsTracker.currentPosition;
        if (!position) {
            showNotification('Location not available', 2000);
            return;
        }

        this.lastFetchTime = 0; // Reset timer
        await this.reloadHotspotsForLocation(position);
    }
}

// Create global instance
const hotspotManager = new HotspotManager();