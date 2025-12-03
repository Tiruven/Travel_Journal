// Route Drawer
class RouteDrawer {
    constructor() {
        this.routeLine = null;
        this.routePoints = [];
        this.isDrawing = false;
    }

    async init(map) {
        this.map = map;
        await this.loadTodayRoute();
    }

    async loadTodayRoute() {
        this.routePoints = await storage.getTodayRoute();
        if (this.routePoints.length > 0) {
            this.drawRoute();
        }
    }

    addPoint(lat, lng) {
        this.routePoints.push([lat, lng]);
        this.drawRoute();
    }

    drawRoute() {
        if (!this.map) return;

        // Remove existing line
        if (this.routeLine) {
            this.map.removeLayer(this.routeLine);
        }

        // Draw new line
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
}

// Create global instance
const routeDrawer = new RouteDrawer();