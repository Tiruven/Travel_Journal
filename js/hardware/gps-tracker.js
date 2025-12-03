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
            timeout: 30000, // 30 seconds
            maximumAge: 0
        };
    }

    // Start tracking
    startTracking() {
        if (!navigator.geolocation) {
            this.triggerError('Geolocation is not supported by this browser');
            return false;
        }

        if (this.isTracking) {
            return true;
        }

        console.log('Starting GPS tracking...');

        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.handlePosition(position),
            (error) => this.handleError(error),
            this.highAccuracyOptions
        );

        this.isTracking = true;
        showNotification('GPS tracking started', 2000);
        return true;
    }

    // Stop tracking
    stopTracking() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
            this.isTracking = false;
            showNotification('GPS tracking stopped', 2000);
        }
    }

    // Get current position once
    async getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }

            console.log('Requesting current position...');

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    console.log('Position obtained:', position.coords);
                    this.currentPosition = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        altitude: position.coords.altitude,
                        heading: position.coords.heading,
                        speed: position.coords.speed,
                        timestamp: position.timestamp
                    };
                    resolve(this.currentPosition);
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    
                    // Provide fallback location for testing
                    const fallbackPosition = {
                        lat: -20.2456, // Mauritius coordinates
                        lng: 57.5012,
                        accuracy: 100,
                        altitude: null,
                        heading: null,
                        speed: null,
                        timestamp: Date.now()
                    };
                    
                    console.warn('Using fallback location:', fallbackPosition);
                    this.currentPosition = fallbackPosition;
                    resolve(fallbackPosition);
                },
                this.highAccuracyOptions
            );
        });
    }

    handlePosition(position) {
        this.previousPosition = this.currentPosition;
        
        this.currentPosition = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp
        };

        console.log('Position updated:', this.currentPosition);

        // Add to path
        this.path.push(this.currentPosition);

        // Calculate distance from previous position
        if (this.previousPosition) {
            const distance = calculateDistance(
                this.previousPosition.lat,
                this.previousPosition.lng,
                this.currentPosition.lat,
                this.currentPosition.lng
            );
            
            // Only add if moved more than 5 meters (to avoid GPS jitter)
            if (distance > 5) {
                this.totalDistance += distance;
                
                // Save route point
                storage.saveRoutePoint({
                    lat: this.currentPosition.lat,
                    lng: this.currentPosition.lng,
                    altitude: this.currentPosition.altitude,
                    speed: this.currentPosition.speed,
                    timestamp: this.currentPosition.timestamp
                });
            }
        }

        // Trigger callbacks
        this.triggerPositionUpdate(this.currentPosition);
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

        console.error('GPS Error:', message, error);
        this.triggerError(message);
    }

    // Register callbacks
    onPositionUpdate(callback) {
        this.callbacks.onPositionUpdate.push(callback);
    }

    onError(callback) {
        this.callbacks.onError.push(callback);
    }

    // Trigger callbacks
    triggerPositionUpdate(position) {
        this.callbacks.onPositionUpdate.forEach(cb => {
            try {
                cb(position);
            } catch (error) {
                console.error('Error in position callback:', error);
            }
        });
    }

    triggerError(error) {
        this.callbacks.onError.forEach(cb => {
            try {
                cb(error);
            } catch (e) {
                console.error('Error in error callback:', e);
            }
        });
    }

    // Get tracking data
    getTrackingData() {
        return {
            currentPosition: this.currentPosition,
            path: this.path,
            totalDistance: this.totalDistance,
            isTracking: this.isTracking
        };
    }

    // Calculate current speed in km/h
    getCurrentSpeed() {
        if (this.currentPosition && this.currentPosition.speed !== null) {
            return (this.currentPosition.speed * 3.6).toFixed(1); // m/s to km/h
        }
        return 0;
    }

    // Reset tracking data
    reset() {
        this.path = [];
        this.totalDistance = 0;
        this.previousPosition = null;
    }
}

// Create global instance
const gpsTracker = new GPSTracker();