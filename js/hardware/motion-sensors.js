// Motion Sensors Manager
class MotionSensors {
    constructor() {
        this.isMonitoring = false;
        this.stepCount = 0;
        this.lastAcceleration = { x: 0, y: 0, z: 0 };
        this.stepThreshold = 1.2;
        this.stepCooldown = false;
        this.compassHeading = 0;
        this.tilt = { front: 0, side: 0 };
        this.callbacks = {
            onStep: [],
            onOrientationChange: [],
            onShake: []
        };
    }

    async start() {
        // Request permission for iOS 13+
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
            try {
                const permission = await DeviceMotionEvent.requestPermission();
                if (permission !== 'granted') {
                    showNotification('Motion sensor permission denied', 3000);
                    return false;
                }
            } catch (error) {
                console.error('Permission error:', error);
                return false;
            }
        }

        this.startMotionTracking();
        this.startOrientationTracking();
        this.isMonitoring = true;

        return true;
    }

    startMotionTracking() {
        if (!window.DeviceMotionEvent) {
            console.warn('Device motion not supported');
            return;
        }

        window.addEventListener('devicemotion', (event) => {
            this.handleMotionEvent(event);
        });
    }

    startOrientationTracking() {
        if (!window.DeviceOrientationEvent) {
            console.warn('Device orientation not supported');
            return;
        }

        window.addEventListener('deviceorientation', (event) => {
            this.handleOrientationEvent(event);
        });
    }

    handleMotionEvent(event) {
        const accel = event.accelerationIncludingGravity;
        if (!accel) return;

        // Step detection
        const magnitude = Math.sqrt(
            Math.pow(accel.x, 2) +
            Math.pow(accel.y, 2) +
            Math.pow(accel.z, 2)
        );

        const delta = Math.abs(magnitude - 9.81); // Gravity baseline

        if (delta > this.stepThreshold && !this.stepCooldown) {
            this.stepCount++;
            this.stepCooldown = true;

            // Cooldown to prevent double-counting
            setTimeout(() => {
                this.stepCooldown = false;
            }, 250);

            // Trigger callbacks
            this.triggerStepCallbacks(this.stepCount);

            // Update UI
            this.updateStepCount();

            // Save to stats
            statsTracker.addSteps(1);
        }

        // Shake detection
        const deltaX = Math.abs(accel.x - this.lastAcceleration.x);
        const deltaY = Math.abs(accel.y - this.lastAcceleration.y);
        const deltaZ = Math.abs(accel.z - this.lastAcceleration.z);

        if (deltaX > 15 || deltaY > 15 || deltaZ > 15) {
            this.triggerShakeCallbacks();
        }

        this.lastAcceleration = { x: accel.x, y: accel.y, z: accel.z };
    }

    handleOrientationEvent(event) {
        // Alpha: rotation around z-axis (compass)
        this.compassHeading = event.alpha ? Math.round(event.alpha) : 0;

        // Beta: front-to-back tilt
        this.tilt.front = event.beta ? Math.round(event.beta) : 0;

        // Gamma: left-to-right tilt
        this.tilt.side = event.gamma ? Math.round(event.gamma) : 0;

        // Update compass/radar UI
        this.updateCompassRadar();

        // Trigger callbacks
        this.triggerOrientationCallbacks({
            heading: this.compassHeading,
            tilt: this.tilt
        });
    }

    updateStepCount() {
        const stepElement = document.getElementById('step-count');
        if (stepElement) {
            stepElement.textContent = this.stepCount;
        }
    }

    updateCompassRadar() {
        // Update radar blips based on nearby hotspots
        if (!window.mapManager || !window.mapManager.isInitialized) {
            return;
        }

        const userPosition = gpsTracker.currentPosition;
        if (!userPosition) return;

        const hotspots = hotspotManager.hotspots || [];
        const radarBlips = document.querySelectorAll('.radar-blip');

        // Reset all blips
        radarBlips.forEach(blip => blip.classList.remove('active'));

        // Check each hotspot
        hotspots.forEach(hotspot => {
            if (!hotspot || !hotspot.lat || !hotspot.lng) return;

            try {
                const distance = calculateDistance(
                    userPosition.lat,
                    userPosition.lng,
                    hotspot.lat,
                    hotspot.lng
                );

                // Show on radar if within 500m
                if (distance < 500) {
                    const bearing = calculateBearing(
                        userPosition.lat,
                        userPosition.lng,
                        hotspot.lat,
                        hotspot.lng
                    );

                    // Adjust for compass heading
                    const relativeBearing = (bearing - this.compassHeading + 360) % 360;

                    // Determine which blip to activate
                    let direction = '';
                    if (relativeBearing >= 315 || relativeBearing < 45) direction = 'north';
                    else if (relativeBearing >= 45 && relativeBearing < 135) direction = 'east';
                    else if (relativeBearing >= 135 && relativeBearing < 225) direction = 'south';
                    else if (relativeBearing >= 225 && relativeBearing < 315) direction = 'west';

                    const blip = document.querySelector(`.radar-blip[data-direction="${direction}"]`);
                    if (blip) {
                        blip.classList.add('active');
                    }
                }
            } catch (error) {
                console.error('Error updating compass radar:', error);
            }
        });
    }

    // Callback registrations
    onStep(callback) {
        this.callbacks.onStep.push(callback);
    }

    onOrientationChange(callback) {
        this.callbacks.onOrientationChange.push(callback);
    }

    onShake(callback) {
        this.callbacks.onShake.push(callback);
    }

    // Trigger callbacks
    triggerStepCallbacks(stepCount) {
        this.callbacks.onStep.forEach(cb => cb(stepCount));
    }

    triggerOrientationCallbacks(data) {
        this.callbacks.onOrientationChange.forEach(cb => cb(data));
    }

    triggerShakeCallbacks() {
        this.callbacks.onShake.forEach(cb => cb());
    }

    getStepCount() {
        return this.stepCount;
    }

    resetStepCount() {
        this.stepCount = 0;
        this.updateStepCount();
    }

    getCompassHeading() {
        return this.compassHeading;
    }
}

// Create global instance
const motionSensors = new MotionSensors();