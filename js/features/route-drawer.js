// Route Drawer

class RouteDrawer {
    constructor() {
        this.routeLine = null;
        this.routePoints = [];
        this.isDrawing = false;
        this.sessionId = this.generateSessionId();
    }

    generateSessionId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    async init(map) {
        this.map = map;
        
        // Check if this is a new session
        const lastSessionId = sessionStorage.getItem('route_session_id');
        const isNewSession = !lastSessionId || lastSessionId !== this.sessionId;
        
        if (isNewSession) {
            sessionStorage.setItem('route_session_id', this.sessionId);
            // start fresh
            this.routePoints = [];
        } else {
            // Same session - load current route
            await this.loadTodayRoute();
        }
    }

    async loadTodayRoute() {
        // Only load routes from current session
        const sessionRoute = sessionStorage.getItem('current_route_points');
        
        if (sessionRoute) {
            try {
                const points = JSON.parse(sessionRoute);
                this.routePoints = points.map(p => [p.lat, p.lng]);
                
                if (this.routePoints.length > 0) {
                    this.drawRoute();
                }
            } catch (e) {
                this.routePoints = [];
            }
        }
    }

    addPoint(lat, lng) {
        // Check if point is valid
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
            return;
        }

        // Check if too far from last point ( GPS error)
        if (this.routePoints.length > 0) {
            const lastPoint = this.routePoints[this.routePoints.length - 1];
            const distance = calculateDistance(
                lastPoint[0],
                lastPoint[1],
                lat,
                lng
            );

            // If more than 500m from last point, might be GPS error or new session
            if (distance > 500) {
                // Start a new route segment instead of connecting
                this.clearRoute();
            }
        }

        this.routePoints.push([lat, lng]);
        
        // Keep only last 200 points ( memory issues )
        if (this.routePoints.length > 200) {
            this.routePoints.shift();
        }
        
        this.drawRoute();
    }

    drawRoute() {
        if (!this.map) return;

        // Remove existing line
        if (this.routeLine) {
            this.map.removeLayer(this.routeLine);
        }

        // Draw new line - if theres enough points
        if (this.routePoints.length > 1) {
            this.routeLine = L.polyline(this.routePoints, {
                color: '#6366f1',
                weight: 4,
                opacity: 0.8,
                smoothFactor: 1,
                lineCap: 'round',
                lineJoin: 'round'
            }).addTo(this.map);
        }
    }

    clearRoute() {
        if (this.routeLine) {
            this.map.removeLayer(this.routeLine);
            this.routeLine = null;
        }
        this.routePoints = [];
        
        // Clear session storage
        sessionStorage.removeItem('current_route_points');
    }

    getRouteDistance() {
        if (this.routePoints.length < 2) return 0;

        let totalDistance = 0;
        for (let i = 0; i < this.routePoints.length - 1; i++) {
            totalDistance += calculateDistance(
                this.routePoints[i][0],
                this.routePoints[i][1],
                this.routePoints[i + 1][0],
                this.routePoints[i + 1][1]
            );
        }

        return totalDistance;
    }

    // Get route as GeoJSON for export
    getRouteGeoJSON() {
        if (this.routePoints.length < 2) return null;

        return {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: this.routePoints.map(p => [p[1], p[0]]) // [lng, lat] for GeoJSON
            },
            properties: {
                distance: this.getRouteDistance(),
                timestamp: Date.now(),
                sessionId: this.sessionId
            }
        };
    }
}

// Create global instance
const routeDrawer = new RouteDrawer();