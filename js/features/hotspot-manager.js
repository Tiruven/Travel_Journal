// Hotspot Manager with Geoapify Integration - FIXED

class HotspotManager {
    constructor() {
        this.hotspots = [];
        this.wishlist = [];
        this.categories = ['scenic', 'historical', 'beach', 'food', 'hidden', 'activity'];
        this.activeFilters = ['all'];
        this.init();
    }

    async init() {
        await this.loadHotspots();
        await this.loadWishlist();
        this.setupCategoryFilters();
    }

    async loadHotspots() {
        await storage.waitForReady();
        const savedHotspots = storage.getItem('hotspots');
       
        if (savedHotspots && savedHotspots.length > 0) {
            console.log(`Loaded ${savedHotspots.length} hotspots from storage`);
            this.hotspots = savedHotspots;
        } else {
            const position = gpsTracker.currentPosition;
           
            if (position && geoapifyService.apiKey === '199b4ac789c040c180ad396100269fdd') {
                console.log('Fetching hotspots from Geoapify...');
               
                try {
                    this.hotspots = await geoapifyService.fetchNearbyPlaces(
                        position.lat,
                        position.lng,
                        ['tourism', 'entertainment', 'natural', 'beach', 'catering', 'leisure'],
                        5000
                    );
                   
                    if (this.hotspots.length > 0) {
                        console.log(`✓ Loaded ${this.hotspots.length} hotspots from Geoapify`);
                        storage.setItem('hotspots', this.hotspots);
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
            // Toggle visited status
            if (!hotspot.visited) {
                hotspot.visited = true;
                
                // Save to storage
                storage.setItem('hotspots', this.hotspots);
                
                // Update stats
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
}

// Create global instance
const hotspotManager = new HotspotManager();