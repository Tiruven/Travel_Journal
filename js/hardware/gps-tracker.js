// GPS Tracker Manager
class GPSTracker {
    constructor() {
        this.watchId = null;
        this.currentPosition = null;
        this.previousPosition = null;
        this.isTracking = false;
        this.path = [];
        this.totalDistance = 0;
        this.callbacks = {
            onPositionUpdate: [],
            onError: []
        };
        this.highAccuracyOptions = {
            enableHighAccuracy: true,
            timeout: 30000,
            maximumAge: 0
        };
        
        //Accuracy thresholds
        this.MIN_ACCURACY = 50; // - reject positions with accuracy worse than this
        this.MIN_MOVEMENT = 5; // - ignore movements smaller than this
        this.lastValidPosition = null;
        this.sessionStartTime = Date.now();
        
        //Detect page reload/navigation
        this.isNewSession = true;
        this.loadSessionState();
    }

    //Load session state to detect reloads
    loadSessionState() {
        const lastSession = sessionStorage.getItem('gps_session_time');
        const now = Date.now();
        
        if (lastSession) {
            const timeSinceLastSession = now - parseInt(lastSession);
            // If less than 5 minutes, - same session
            this.isNewSession = timeSinceLastSession > 300000;
        }
        
        sessionStorage.setItem('gps_session_time', now.toString());
        
        // Clear route on new session to prevent lines across map
        if (this.isNewSession) {
            this.clearSessionRoute();
        }
    }

    //Clear route data from previous session
    clearSessionRoute() {

        const today = new Date().toISOString().split('T')[0];
        const lastRouteDate = localStorage.getItem('last_route_date');
        
        if (lastRouteDate !== today) {
            // New day - clear route
            localStorage.setItem('last_route_date', today);
            sessionStorage.removeItem('current_route_points');
        }
    }

    startTracking() {
        if (!navigator.geolocation) {
            this.triggerError('Geolocation is not supported by this browser');
            return false;
        }

        if (this.isTracking) {
            return true;
        }

        
        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.handlePosition(position),
            (error) => this.handleError(error),
            this.highAccuracyOptions
        );

        this.isTracking = true;
        showNotification('GPS tracking started', 2000);
        return true;
    }

    stopTracking() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
            this.isTracking = false;
            showNotification('GPS tracking stopped', 2000);
        }
    }

    async getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }


            navigator.geolocation.getCurrentPosition(
                (position) => {
                    
                    // Check accuracy
                    if (position.coords.accuracy > this.MIN_ACCURACY * 2) {
                    }
                    
                    this.currentPosition = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        altitude: position.coords.altitude,
                        heading: position.coords.heading,
                        speed: position.coords.speed,
                        timestamp: position.timestamp
                    };
                    
                    this.lastValidPosition = this.currentPosition;
                    resolve(this.currentPosition);
                },
                (error) => {
                    
                    // Provide fallback location - for error 
                    const fallbackPosition = {
                        lat: -20.176931457328774, 
                        lng: 57.467199105857894,
                        accuracy: 100,
                        altitude: null,
                        heading: null,
                        speed: null,
                        timestamp: Date.now()
                    };
                    
                    this.currentPosition = fallbackPosition;
                    this.lastValidPosition = fallbackPosition;
                    resolve(fallbackPosition);
                },
                this.highAccuracyOptions
            );
        });
    }

    handlePosition(position) {
        const newPosition = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp
        };

        //Check accuracy - reject inaccurate positions
        if (position.coords.accuracy > this.MIN_ACCURACY) {
            // Keep using last valid position
            return;
        }


        //Check if location moved enough to record this position
        if (this.lastValidPosition) {
            const distance = calculateDistance(
                this.lastValidPosition.lat,
                this.lastValidPosition.lng,
                newPosition.lat,
                newPosition.lng
            );

            if (distance < this.MIN_MOVEMENT) {
                // Update current position
                this.currentPosition = newPosition;
                this.triggerPositionUpdate(newPosition);
                return;
            }
        }

        this.previousPosition = this.currentPosition;
        this.currentPosition = newPosition;
        this.lastValidPosition = newPosition;


        // Add to path only if it's a valid movement
        this.path.push(this.currentPosition);

        // Calculate distance from previous valid position
        if (this.previousPosition) {
            const distance = calculateDistance(
                this.previousPosition.lat,
                this.previousPosition.lng,
                this.currentPosition.lat,
                this.currentPosition.lng
            );

            if (distance > this.MIN_MOVEMENT && distance < 200) {
                // Only add distance between 5m and 200m)
                this.totalDistance += distance;

                // Save route point
                this.saveRoutePoint({
                    lat: this.currentPosition.lat,
                    lng: this.currentPosition.lng,
                    altitude: this.currentPosition.altitude,
                    speed: this.currentPosition.speed,
                    accuracy: this.currentPosition.accuracy,
                    timestamp: this.currentPosition.timestamp
                });
            } else if (distance >= 200) {
               
            }
        }

        this.triggerPositionUpdate(this.currentPosition);
    }

    // route point saving
    saveRoutePoint(point) {
        // Save to storage
        storage.saveRoutePoint(point);
        
        // 
        const sessionRoute = JSON.parse(sessionStorage.getItem('current_route_points') || '[]');
        sessionRoute.push(point);
        
        // Keep only (last 100 points) in session
        if (sessionRoute.length > 100) {
            sessionRoute.shift();
        }
        
        sessionStorage.setItem('current_route_points', JSON.stringify(sessionRoute));
    }

    handleError(error) {
        let message = 'GPS error occurred';

        switch(error.code) {
            case error.PERMISSION_DENIED:
                message = 'GPS permission denied. Please enable location access.';
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'GPS position unavailable. Trying again...';
                break;
            case error.TIMEOUT:
                message = 'GPS request timed out. Trying again...';
                break;
        }

        this.triggerError(message);
    }

    onPositionUpdate(callback) {
        this.callbacks.onPositionUpdate.push(callback);
    }

    onError(callback) {
        this.callbacks.onError.push(callback);
    }

    triggerPositionUpdate(position) {
        this.callbacks.onPositionUpdate.forEach(cb => {
            try {
                cb(position);
            } catch (error) {
            }
        });
    }

    triggerError(error) {
        this.callbacks.onError.forEach(cb => {
            try {
                cb(error);
            } catch (e) {
            }
        });
    }

    getTrackingData() {
        return {
            currentPosition: this.currentPosition,
            path: this.path,
            totalDistance: this.totalDistance,
            isTracking: this.isTracking
        };
    }

    getCurrentSpeed() {
        if (this.currentPosition && this.currentPosition.speed !== null) {
            return (this.currentPosition.speed * 3.6).toFixed(1);
        }
        return 0;
    }

    reset() {
        this.path = [];
        this.totalDistance = 0;
        this.previousPosition = null;
    }

    // Get accuracy status
    getAccuracyStatus() {
        if (!this.currentPosition) return 'unknown';
        
        const accuracy = this.currentPosition.accuracy;
        if (accuracy <= 10) return 'excellent';
        if (accuracy <= 20) return 'good';
        if (accuracy <= 50) return 'fair';
        return 'poor';
    }
}

// Create global instance
const gpsTracker = new GPSTracker();