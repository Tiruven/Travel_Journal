// Map Manager with Routing API Integration

class MapManager {
    constructor() {
        this.map = null;
        this.userMarker = null;
        this.hotspotMarkers = [];
        this.memoryMarkers = [];
        this.currentTheme = 'day';
        this.isInitialized = false;
        this.navigationRoute = null;
        this.turnMarkers = [];
        this.isNavigating = false;
        this.navigationTarget = null;
        this.offRouteThreshold = 50; // meters
    }

    async init() {
        if (this.isInitialized) {
            console.warn('Map already initialized');
            return;
        }

        await this.initializeMap();
        this.setupEventListeners();
        this.checkNavigationTarget();
        this.isInitialized = true;
    }

    async initializeMap() {
        const mapDiv = document.getElementById('map');
        if (mapDiv) {
            mapDiv.innerHTML = '';
            mapDiv._leaflet_id = null;
        }

        try {
            const position = await gpsTracker.getCurrentPosition();

            this.map = L.map('map', {
                zoomControl: false,
                attributionControl: false
            }).setView([position.lat, position.lng], 15);

            this.tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap'
            }).addTo(this.map);

            L.control.zoom({
                position: 'bottomright'
            }).addTo(this.map);

            this.addUserMarker(position.lat, position.lng);

            await storage.waitForReady();
            await hotspotManager.loadHotspots();
            this.updateHotspotMarkers();

            await memoryManager.loadMemories();
            this.addMemoryMarkers();

            await routeDrawer.init(this.map);
            this.startLocationTracking();
            weatherService.init(position);

        } catch (error) {
            console.error('Map initialization error:', error);
            showNotification('Failed to get your location. Using default.');

            const mapDiv = document.getElementById('map');
            if (mapDiv) {
                mapDiv.innerHTML = '';
                mapDiv._leaflet_id = null;
            }

            this.map = L.map('map', {
                zoomControl: false,
                attributionControl: false
            }).setView([-20.2674718, 57.4796981], 13);

            this.tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19
            }).addTo(this.map);
        }
    }

    addUserMarker(lat, lng) {
        const userIcon = L.divIcon({
            className: 'user-location-marker',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        if (this.userMarker) {
            this.userMarker.setLatLng([lat, lng]);
        } else {
            this.userMarker = L.marker([lat, lng], {
                icon: userIcon,
                zIndexOffset: 1000
            }).addTo(this.map);
        }
    }

    updateHotspotMarkers() {
        this.hotspotMarkers.forEach(marker => this.map.removeLayer(marker));
        this.hotspotMarkers = [];

        const hotspots = hotspotManager.getFilteredHotspots();

        hotspots.forEach(hotspot => {
            const iconClass = hotspot.visited ? 'hotspot-marker visited' : 'hotspot-marker';

            const icon = L.divIcon({
                className: iconClass,
                html: `<i class="fas ${hotspotManager.getCategoryIcon(hotspot.category)}"></i>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15],
                popupAnchor: [0, -15]
            });

            const marker = L.marker([hotspot.lat, hotspot.lng], {
                icon: icon,
                title: hotspot.name
            }).addTo(this.map);

            marker.bindPopup(this.createHotspotPopup(hotspot), {
                maxWidth: 300,
                className: 'hotspot-popup-container'
            });

            marker.on('click', () => {
                this.onHotspotClick(hotspot);
            });

            this.hotspotMarkers.push(marker);
        });
    }

    createHotspotPopup(hotspot) {
        const isWishlisted = hotspotManager.isInWishlist(hotspot.id);

        return `
        <div class="hotspot-popup">
            <h3>${hotspot.name}</h3>
            <p>${hotspot.description}</p>
            <div style="display: flex; gap: 2px; margin: 8px 0; font-size: 13px;">
                ${hotspot.rating > 0 ? `<span><i class="fas fa-star" style="color: #f59e0b;"></i> ${hotspot.rating}</span>` : ''}
                ${hotspot.distance ? `<span><i class="fas fa-route"></i> ${formatDistance(hotspot.distance)}</span>` : ''}
            </div>
            <div style="display: flex; gap: 2px; margin-top: 12px;">
                <button onclick="window.mapManager.startNavigation('${hotspot.id}')" class="save-btn" style="flex: 1;">
                    <i class="fas fa-directions"></i> Navigate
                </button>
                <button onclick="window.mapManager.visitHotspot('${hotspot.id}')" class="save-btn" style="flex: 1;">
                    ${hotspot.visited ? '✓ Visited' : 'Mark Visited'}
                </button>
                <button onclick="window.mapManager.toggleHotspotWishlist('${hotspot.id}')"
                        class="${isWishlisted ? 'retake-btn' : 'save-btn'}"
                        style="width: 40px;">
                    <i class="fas fa-heart"></i>
                </button>
            </div>
        </div>
    `;
    }

    // NEW: Start navigation to hotspot
    async startNavigation(hotspotId) {
        const hotspot = hotspotManager.getHotspotById(hotspotId);
        if (!hotspot) return;

        const userPos = gpsTracker.currentPosition;
        if (!userPos) {
            showNotification('GPS position not available', 3000);
            return;
        }

        this.map.closePopup();
        showNotification('Calculating route...', 2000);

        try {
            // Get route with turn-by-turn instructions
            const route = await routingService.getRouteWithInstructions(
                { lat: userPos.lat, lng: userPos.lng },
                { lat: hotspot.lat, lng: hotspot.lng },
                'walk' // Default to walking
            );

            // Clear any existing route
            this.clearNavigation();

            // Draw route on map
            routingService.drawRouteOnMap(this.map, route, {
                color: '#6366f1',
                weight: 6,
                opacity: 0.8
            });

            // Draw turn-by-turn markers
            this.turnMarkers = routingService.drawTurnByTurnMarkers(
                this.map,
                route.instructions
            );

            // Show navigation info
            this.showNavigationPanel(route, hotspot);

            // Set navigation state
            this.isNavigating = true;
            this.navigationTarget = {
                hotspot: hotspot,
                route: route
            };

            // Start tracking for navigation
            this.startNavigationTracking();

        } catch (error) {
            console.error('Navigation error:', error);
            showNotification('Failed to calculate route', 3000);
        }
    }

    // NEW: Show navigation panel
    showNavigationPanel(route, destination) {
        // Create or update navigation panel
        let navPanel = document.getElementById('navigation-panel');

        if (!navPanel) {
            navPanel = document.createElement('div');
            navPanel.id = 'navigation-panel';
            navPanel.className = 'navigation-panel';
            document.body.appendChild(navPanel);
        }

        const arrivalTime = routingService.getEstimatedArrival(route);

        navPanel.innerHTML = `
            <div class="nav-header">
                <h3><i class="fas fa-navigation"></i> Navigation</h3>
                <button onclick="window.mapManager.clearNavigation()" class="nav-close-btn">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="nav-info">
                <div class="nav-destination">
                    <strong>To:</strong> ${destination.name}
                </div>
                <div class="nav-stats">
                    <div class="nav-stat">
                        <i class="fas fa-route"></i>
                        <span>${route.distanceFormatted}</span>
                    </div>
                    <div class="nav-stat">
                        <i class="fas fa-clock"></i>
                        <span>${route.timeFormatted}</span>
                    </div>
                    <div class="nav-stat">
                        <i class="fas fa-flag-checkered"></i>
                        <span>ETA: ${arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>
            </div>
            <div class="nav-instructions" id="nav-instructions-list">
                ${this.renderInstructions(route.instructions)}
            </div>
        `;

        navPanel.classList.add('visible');
    }

    // NEW: Render turn-by-turn instructions
    renderInstructions(instructions) {
        if (!instructions || instructions.length === 0) {
            return '<p>No instructions available</p>';
        }

        return instructions.map((instruction, index) => `
            <div class="instruction-item" data-index="${index}">
                <div class="instruction-number">${index + 1}</div>
                <div class="instruction-content">
                    <div class="instruction-text">${instruction.text}</div>
                    <div class="instruction-meta">
                        ${routingService.formatDistance(instruction.distance, 'meters')} • 
                        ${routingService.formatTime(instruction.time)}
                    </div>
                </div>
            </div>
        `).join('');
    }

    // NEW: Track navigation progress
    startNavigationTracking() {
        if (this.navigationTrackingInterval) {
            clearInterval(this.navigationTrackingInterval);
        }

        this.navigationTrackingInterval = setInterval(() => {
            if (!this.isNavigating || !this.navigationTarget) {
                clearInterval(this.navigationTrackingInterval);
                return;
            }

            const userPos = gpsTracker.currentPosition;
            if (!userPos) return;

            const route = this.navigationTarget.route;

            // Check if user is still on route
            const isOnRoute = routingService.isNearRoute(
                userPos,
                route,
                this.offRouteThreshold
            );

            if (!isOnRoute) {
                // User went off route - recalculate
                this.recalculateRoute();
            } else {
                // Highlight next instruction
                this.highlightNextInstruction(userPos, route.instructions);
            }

            // Check if arrived
            const distanceToDestination = calculateDistance(
                userPos.lat,
                userPos.lng,
                this.navigationTarget.hotspot.lat,
                this.navigationTarget.hotspot.lng
            );

            if (distanceToDestination < 20) {
                this.arriveAtDestination();
            }

        }, 5000); // Check every 5 seconds
    }

    // NEW: Recalculate route when off track
    async recalculateRoute() {
        const userPos = gpsTracker.currentPosition;
        if (!userPos || !this.navigationTarget) return;

        console.log('User went off route - recalculating...');
        showNotification('Recalculating route...', 2000);

        try {
            const newRoute = await routingService.recalculateRoute(
                { lat: userPos.lat, lng: userPos.lng },
                { lat: this.navigationTarget.hotspot.lat, lng: this.navigationTarget.hotspot.lng },
                'walk'
            );

            // Clear old route
            routingService.clearRoute(this.map);
            this.turnMarkers.forEach(m => this.map.removeLayer(m));

            // Draw new route
            routingService.drawRouteOnMap(this.map, newRoute);
            this.turnMarkers = routingService.drawTurnByTurnMarkers(
                this.map,
                newRoute.instructions
            );

            // Update navigation panel
            this.navigationTarget.route = newRoute;
            this.showNavigationPanel(newRoute, this.navigationTarget.hotspot);

        } catch (error) {
            console.error('Route recalculation error:', error);
        }
    }

    // NEW: Highlight next instruction
    highlightNextInstruction(currentPosition, instructions) {
        const nextInstruction = routingService.getNextInstruction(
            currentPosition,
            instructions
        );

        if (nextInstruction) {
            // Highlight in UI
            const items = document.querySelectorAll('.instruction-item');
            items.forEach(item => item.classList.remove('active'));

            const activeItem = document.querySelector(
                `.instruction-item[data-index="${instructions.indexOf(nextInstruction)}"]`
            );

            if (activeItem) {
                activeItem.classList.add('active');
                activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }

    // NEW: Arrive at destination
    arriveAtDestination() {
        if (!this.navigationTarget) return;

        const hotspot = this.navigationTarget.hotspot;

        showNotification(`✓ Arrived at ${hotspot.name}!`, 5000);

        // Mark as visited
        hotspotManager.markHotspotAsVisited(hotspot.id);

        // Clear navigation
        setTimeout(() => {
            this.clearNavigation();
        }, 3000);
    }

    // NEW: Clear navigation
    clearNavigation() {
        // Clear route from map
        if (routingService.routeLayer) {
            this.map.removeLayer(routingService.routeLayer);
            routingService.routeLayer = null;
        }

        // Clear turn markers
        this.turnMarkers.forEach(marker => this.map.removeLayer(marker));
        this.turnMarkers = [];

        // Clear navigation panel
        const navPanel = document.getElementById('navigation-panel');
        if (navPanel) {
            navPanel.classList.remove('visible');
            setTimeout(() => navPanel.remove(), 300);
        }

        // Clear tracking interval
        if (this.navigationTrackingInterval) {
            clearInterval(this.navigationTrackingInterval);
        }

        // Reset state
        this.isNavigating = false;
        this.navigationTarget = null;

        showNotification('Navigation stopped', 2000);
    }

    onHotspotClick(hotspot) {
        const userPos = gpsTracker.currentPosition;
        if (userPos) {
            const distance = calculateDistance(
                userPos.lat,
                userPos.lng,
                hotspot.lat,
                hotspot.lng
            );

            if (distance <= 50 && !hotspot.visited) {
                showNotification(`You're near ${hotspot.name}! Mark it as visited.`, 5000);
            }
        }
    }

    visitHotspot(hotspotId) {
        hotspotManager.markHotspotAsVisited(hotspotId);
        this.updateHotspotMarkers();
        achievementsManager.checkAchievements();
        this.map.closePopup();
    }

    async toggleHotspotWishlist(hotspotId) {
        if (hotspotManager.isInWishlist(hotspotId)) {
            await hotspotManager.removeFromWishlist(hotspotId);
        } else {
            await hotspotManager.addToWishlist(hotspotId);
        }

        // Update markers to show new wishlist status
        this.updateHotspotMarkers();

        // Close and reopen popup to show updated button
        this.map.closePopup();
    }

    addMemoryMarkers() {
        memoryManager.memories.forEach(memory => {
            if (memory.location) {
                this.addMemoryMarker(memory);
            }
        });
    }

    addMemoryMarker(memory) {
        if (!memory.location) return;

        const nearbyHotspot = this.findNearbyHotspot(
            memory.location.lat,
            memory.location.lng,
            100
        );

        const icon = L.divIcon({
            className: `memory-marker ${memory.type}`,
            html: this.getMemoryIcon(memory.type),
            iconSize: [40, 40],
            iconAnchor: [20, 20],
            popupAnchor: [0, -20]
        });

        const marker = L.marker([memory.location.lat, memory.location.lng], {
            icon: icon,
            title: memory.caption
        }).addTo(this.map);

        marker.bindPopup(this.createMemoryPopup(memory, nearbyHotspot), {
            maxWidth: 300,
            className: 'memory-popup-container'
        });

        this.memoryMarkers.push(marker);
    }

    findNearbyHotspot(lat, lng, radius) {
        return hotspotManager.hotspots.find(hotspot => {
            const distance = calculateDistance(lat, lng, hotspot.lat, hotspot.lng);
            return distance <= radius;
        });
    }

    getMemoryIcon(type) {
        const icons = {
            photo: '<i class="fas fa-camera"></i>',
            audio: '<i class="fas fa-microphone"></i>',
            text: '<i class="fas fa-sticky-note"></i>'
        };
        return icons[type] || '<i class="fas fa-map-marker-alt"></i>';
    }

    createMemoryPopup(memory, nearbyHotspot) {
        let content = `
            <div class="memory-popup">
                <h4>${memory.caption}</h4>
        `;

        if (memory.type === 'photo') {
            content += `<img src="${memory.data}" alt="${memory.caption}">`;
        } else if (memory.type === 'audio') {
            content += `<audio src="${memory.data}" controls style="width: 100%;"></audio>`;
        } else if (memory.type === 'text') {
            content += `<p>${memory.caption.substring(0, 150)}${memory.caption.length > 150 ? '...' : ''}</p>`;
        }

        content += `<p class="timestamp">${formatTimestamp(memory.timestamp)}</p>`;

        if (nearbyHotspot) {
            content += `
                <p style="color: var(--primary-color); margin-top: 8px;">
                    <i class="fas fa-map-marker-alt"></i> Near ${nearbyHotspot.name}
                </p>
            `;
        } else {
            content += `
                <p style="color: #64748b; margin-top: 8px;">
                    <i class="fas fa-map-marker-alt"></i> ${memory.location.lat.toFixed(4)}, ${memory.location.lng.toFixed(4)}
                </p>
            `;
        }

        content += `</div>`;
        return content;
    }

    checkNavigationTarget() {
        const target = localStorage.getItem('navigationTarget');
        if (target) {
            const navTarget = JSON.parse(target);
            localStorage.removeItem('navigationTarget');

            console.log('Navigation target found:', navTarget);

            // Wait for map to be ready
            setTimeout(() => {
                // Fly to target location first
                this.flyTo(navTarget.lat, navTarget.lng, 16);

                // Then start navigation after a short delay
                setTimeout(() => {
                    if (navTarget.id) {
                        // Start navigation using hotspot ID
                        this.startNavigation(navTarget.id);
                    } else {
                        // Just show the location
                        showNotification(`Arrived at ${navTarget.name}`, 3000);
                    }
                }, 1500);
            }, 1000);
        }
    }

    showRouteToTarget(target) {
        const userPos = gpsTracker.currentPosition;
        if (!userPos) {
            showNotification('Location not available for routing', 3000);
            return;
        }

        // Use routing API instead of straight line
        if (target.id) {
            this.startNavigation(target.id);
        }
    }

    startLocationTracking() {
        gpsTracker.startTracking();

        gpsTracker.onPositionUpdate((position) => {
            this.addUserMarker(position.lat, position.lng);
            routeDrawer.addPoint(position.lat, position.lng);
            hotspotManager.updateHotspotDistances(position.lat, position.lng);
            this.checkNearbyHotspots(position);

            if (position.altitude) {
                statsTracker.updateAltitude(position.altitude);
            }

            if (gpsTracker.previousPosition) {
                const distance = calculateDistance(
                    gpsTracker.previousPosition.lat,
                    gpsTracker.previousPosition.lng,
                    position.lat,
                    position.lng
                );

                if (distance > 5) {
                    statsTracker.addDistance(distance);
                }
            }
        });

        gpsTracker.onError((error) => {
            console.error('GPS error:', error);
        });
    }

    checkNearbyHotspots(position) {
        const nearbyHotspots = hotspotManager.getNearbyHotspots(
            position.lat,
            position.lng,
            100
        );

        nearbyHotspots.forEach(hotspot => {
            if (!hotspot.notified && !hotspot.visited) {
                showNotification(
                    `📍 Nearby: ${hotspot.name} - ${formatDistance(hotspot.distance)}`,
                    5000
                );
                hotspot.notified = true;
            }
        });
    }

    flyTo(lat, lng, zoom = 16) {
        this.map.flyTo([lat, lng], zoom, {
            duration: 1.5
        });
    }

    changeTheme(theme) {
        this.currentTheme = theme;
        document.body.className = `theme-${theme}`;

        const tileLayers = {
            day: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            night: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            ocean: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            vintage: 'https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg'
        };

        this.map.removeLayer(this.tileLayer);
        this.tileLayer = L.tileLayer(tileLayers[theme] || tileLayers.day, {
            maxZoom: 19
        }).addTo(this.map);
    }

    setupEventListeners() {
        document.getElementById('suggested-route-btn')?.addEventListener('click', () => {
            this.suggestRoute();
        });
    }

    suggestRoute() {
        const userPos = gpsTracker.currentPosition;
        if (!userPos) {
            showNotification('Location not available', 2000);
            return;
        }

        const nearbyHotspots = hotspotManager.getNearbyHotspots(userPos.lat, userPos.lng, 2000)
            .filter(h => !h.visited)
            .slice(0, 3);

        if (nearbyHotspots.length === 0) {
            showNotification('No nearby unvisited hotspots', 3000);
            return;
        }

        let message = '🗺️ Suggested Route:\n';
        nearbyHotspots.forEach((hotspot, index) => {
            message += `${index + 1}. ${hotspot.name} (${formatDistance(hotspot.distance)})\n`;
        });

        showNotification(message, 8000);

        nearbyHotspots.forEach(hotspot => {
            const marker = this.hotspotMarkers.find(m =>
                m.getLatLng().lat === hotspot.lat &&
                m.getLatLng().lng === hotspot.lng
            );

            if (marker) {
                marker.openPopup();
            }
        });
    }

    // Add this method to MapManager class
    async syncWishlistFromDatabase() {
        await hotspotManager.syncWishlist();
        this.updateHotspotMarkers();
    }
}

window.mapManager = null;