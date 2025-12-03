// Map Manager with Fixed Memory Markers and Navigation

class MapManager {
    constructor() {
        this.map = null;
        this.userMarker = null;
        this.hotspotMarkers = [];
        this.memoryMarkers = [];
        this.currentTheme = 'day';
        this.isInitialized = false;
        this.showMemoryOrbs = true;
        this.navigationRoute = null;
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

            // Add zoom control to bottom right
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
            }).setView([-20.2674718, 57.4796981], 13); // Mauritius

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
                <div style="display: flex; gap: 8px; margin: 8px 0; font-size: 13px;">
                    ${hotspot.rating > 0 ? `<span><i class="fas fa-star" style="color: #f59e0b;"></i> ${hotspot.rating}</span>` : ''}
                    ${hotspot.distance ? `<span><i class="fas fa-route"></i> ${formatDistance(hotspot.distance)}</span>` : ''}
                </div>
                <div style="display: flex; gap: 8px; margin-top: 12px;">
                    <button onclick="window.mapManager.visitHotspot('${hotspot.id}')" class="save-btn" style="flex: 1;">
                        ${hotspot.visited ? '✓ Visited' : 'Mark as Visited'}
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

    toggleHotspotWishlist(hotspotId) {
        if (hotspotManager.isInWishlist(hotspotId)) {
            hotspotManager.removeFromWishlist(hotspotId);
        } else {
            hotspotManager.addToWishlist(hotspotId);
        }
        this.updateHotspotMarkers();
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

    toggleMemoryOrbs() {
        this.showMemoryOrbs = !this.showMemoryOrbs;

        if (this.showMemoryOrbs) {
            this.memoryMarkers.forEach(marker => {
                if (!this.map.hasLayer(marker)) {
                    marker.addTo(this.map);
                }
            });
            showNotification('Memory orbs shown', 2000);
        } else {
            this.memoryMarkers.forEach(marker => {
                this.map.removeLayer(marker);
            });
            showNotification('Memory orbs hidden', 2000);
        }
    }

    checkNavigationTarget() {
        const target = localStorage.getItem('navigationTarget');
        if (target) {
            const navTarget = JSON.parse(target);
            localStorage.removeItem('navigationTarget');

            this.flyTo(navTarget.lat, navTarget.lng, 16);

            setTimeout(() => {
                this.showRouteToTarget(navTarget);
            }, 1000);
        }
    }

    showRouteToTarget(target) {
        const userPos = gpsTracker.currentPosition;
        if (!userPos) {
            showNotification('Location not available for routing', 3000);
            return;
        }

        if (this.navigationRoute) {
            this.map.removeLayer(this.navigationRoute);
        }

        this.navigationRoute = L.polyline([
            [userPos.lat, userPos.lng],
            [target.lat, target.lng]
        ], {
            color: '#ef4444',
            weight: 4,
            opacity: 0.7,
            dashArray: '10, 10'
        }).addTo(this.map);

        const distance = calculateDistance(
            userPos.lat,
            userPos.lng,
            target.lat,
            target.lng
        );

        showNotification(
            `Route to ${target.name}: ${formatDistance(distance)}`,
            5000
        );
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
}

// Create global instance - IMPORTANT: Make it globally accessible
window.mapManager = null;