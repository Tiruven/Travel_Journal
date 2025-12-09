// Geoapify Routing Service

class GeoapifyRoutingService {
    constructor() {
        this.apiKey = '199b4ac789c040c180ad396100269fdd';
        this.baseUrl = 'https://api.geoapify.com/v1/routing';
        this.currentRoute = null;
        this.routeLayer = null;
    }

    /**
     * Get a route between two points
     * @param {Object} start - {lat, lng}
     * @param {Object} end - {lat, lng}
     * @param {String} mode - 'drive', 'walk', 'bicycle', 'motorcycle', 'bus', 'truck'
     * @param {Object} options - Additional options
     */
    async getRoute(start, end, mode = 'walk', options = {}) {
        try {
            // Build waypoints string
            const waypoints = `${start.lat},${start.lng}|${end.lat},${end.lng}`;
            
            // Build URL with parameters
            const params = new URLSearchParams({
                waypoints: waypoints,
                mode: mode,
                apiKey: this.apiKey
            });

            // Add optional parameters
            if (options.details) {
                params.append('details', options.details);
            }
            if (options.units) {
                params.append('units', options.units || 'metric');
            }
            if (options.lang) {
                params.append('lang', options.lang);
            }
            if (options.avoid) {
                params.append('avoid', options.avoid);
            }
            if (options.traffic) {
                params.append('traffic', options.traffic);
            }

            const url = `${this.baseUrl}?${params.toString()}`;
            

            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Routing API error: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data || !data.features || data.features.length === 0) {
                throw new Error('No route found');
            }

            this.currentRoute = data.features[0];
            return this.parseRoute(this.currentRoute);

        } catch (error) {
            
            throw error;
        }
    }

    //Parse route data into usable format
    parseRoute(routeFeature) {
        const props = routeFeature.properties;
        const geometry = routeFeature.geometry;

        return {
            distance: props.distance,
            distanceUnits: props.distance_units,
            time: props.time,
            timeFormatted: this.formatTime(props.time),
            distanceFormatted: this.formatDistance(props.distance, props.distance_units),
            legs: props.legs,
            coordinates: geometry.coordinates,
            geometry: geometry,
            fullFeature: routeFeature
        };
    }

    
    //turn-by-turn instruction
    async getRouteWithInstructions(start, end, mode = 'walk') {
        try {
            const route = await this.getRoute(start, end, mode, {
                details: 'instruction_details'
            });

            // Extract turn-by-turn instructions
            const instructions = [];
            
            route.legs.forEach((leg, legIndex) => {
                leg.steps.forEach((step, stepIndex) => {
                    if (step.instruction) {
                        const coords = route.coordinates[legIndex][step.from_index];
                        
                        instructions.push({
                            text: step.instruction.text,
                            type: step.instruction.type,
                            distance: step.distance,
                            time: step.time,
                            coordinates: coords ? [coords[1], coords[0]] : null, // Convert to [lat, lng]
                            stepIndex: stepIndex,
                            legIndex: legIndex
                        });
                    }
                });
            });

            return {
                ...route,
                instructions: instructions
            };

        } catch (error) {
            
            throw error;
        }
    }

    /**
     * Draw route on Leaflet map
     */
    drawRouteOnMap(map, route, options = {}) {
        // Remove existing route layer
        if (this.routeLayer) {
            map.removeLayer(this.routeLayer);
        }

        const defaultStyle = {
            color: options.color || '#6366f1',
            weight: options.weight || 6,
            opacity: options.opacity || 0.8,
            lineJoin: 'round',
            lineCap: 'round'
        };

        // Draw route line
        this.routeLayer = L.geoJSON(route.fullFeature, {
            style: defaultStyle
        }).addTo(map);

        // Add popup with route info
        const popupContent = `
            <div style="text-align: center; padding: 8px;">
                <strong>Route Information</strong><br>
                Distance: ${route.distanceFormatted}<br>
                Time: ${route.timeFormatted}
            </div>
        `;
        
        this.routeLayer.bindPopup(popupContent);

        // Fit map to route bounds
        if (options.fitBounds !== false) {
            map.fitBounds(this.routeLayer.getBounds(), {
                padding: [50, 50]
            });
        }

        return this.routeLayer;
    }

    /**
     * Draw turn-by-turn markers on map
     */
    drawTurnByTurnMarkers(map, instructions) {
        const markers = [];

        instructions.forEach((instruction, index) => {
            if (!instruction.coordinates) return;

            // custom icon for turn marker
            const icon = L.divIcon({
                className: 'turn-marker',
                html: `<div class="turn-marker-inner">${index + 1}</div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });

            const marker = L.marker(instruction.coordinates, {
                icon: icon,
                title: instruction.text
            }).addTo(map);

            // Add popup with instruction
            marker.bindPopup(`
                <div style="padding: 8px;">
                    <strong>Step ${index + 1}</strong><br>
                    ${instruction.text}<br>
                    <small>${this.formatDistance(instruction.distance, 'meters')} - ${this.formatTime(instruction.time)}</small>
                </div>
            `);

            markers.push(marker);
        });

        return markers;
    }

    /**
     * Clear route from map
     */
    clearRoute(map) {
        if (this.routeLayer) {
            map.removeLayer(this.routeLayer);
            this.routeLayer = null;
        }
        this.currentRoute = null;
    }

    /**
     * Get route for multiple waypoints
     */
    async getMultiWaypointRoute(waypoints, mode = 'walk', options = {}) {
        try {
            // Build waypoints string: lat1,lng1|lat2,lng2|lat3,lng3
            const waypointsStr = waypoints
                .map(wp => `${wp.lat},${wp.lng}`)
                .join('|');

            const params = new URLSearchParams({
                waypoints: waypointsStr,
                mode: mode,
                apiKey: this.apiKey
            });

            if (options.details) {
                params.append('details', options.details);
            }

            const url = `${this.baseUrl}?${params.toString()}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Routing API error: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data || !data.features || data.features.length === 0) {
                throw new Error('No route found');
            }

            return this.parseRoute(data.features[0]);

        } catch (error) {
            
            throw error;
        }
    }

    /**
     * Format time in seconds to readable string
     */
    formatTime(seconds) {
        if (seconds < 60) {
            return `${Math.round(seconds)}s`;
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            return `${minutes} min`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            return `${hours}h ${minutes}m`;
        }
    }

    /**
     * Format distance
     */
    formatDistance(distance, units = 'meters') {
        if (units === 'meters') {
            if (distance < 1000) {
                return `${Math.round(distance)} m`;
            } else {
                return `${(distance / 1000).toFixed(2)} km`;
            }
        } else {
            // Imperial units
            if (distance < 1609) {
                return `${Math.round(distance * 3.281)} ft`;
            } else {
                return `${(distance / 1609.34).toFixed(2)} mi`;
            }
        }
    }

    /**
     * Get estimated arrival time
     */
    getEstimatedArrival(route) {
        const now = new Date();
        const arrivalTime = new Date(now.getTime() + route.time * 1000);
        return arrivalTime;
    }

    /**
     * Check if point is near route (for navigation tracking)
     */
    isNearRoute(point, route, threshold = 50) {
        // Get all coordinates from route
        const routeCoords = [];
        route.coordinates.forEach(leg => {
            leg.forEach(coord => {
                routeCoords.push([coord[1], coord[0]]); // Convert to [lat, lng]
            });
        });

        // Find closest point on route
        let minDistance = Infinity;
        
        for (const coord of routeCoords) {
            const distance = calculateDistance(
                point.lat,
                point.lng,
                coord[0],
                coord[1]
            );
            
            if (distance < minDistance) {
                minDistance = distance;
            }
            
            // Early exit if we're definitely near
            if (distance < threshold) {
                return true;
            }
        }

        return minDistance <= threshold;
    }

    /**
     * Get next instruction based on current position
     */
    getNextInstruction(currentPosition, instructions) {
        let closestInstruction = null;
        let minDistance = Infinity;

        for (const instruction of instructions) {
            if (!instruction.coordinates) continue;

            const distance = calculateDistance(
                currentPosition.lat,
                currentPosition.lng,
                instruction.coordinates[0],
                instruction.coordinates[1]
            );

            if (distance < minDistance) {
                minDistance = distance;
                closestInstruction = instruction;
            }
        }

        return closestInstruction;
    }

    /**
     * Recalculate route if user goes off track
     */
    async recalculateRoute(currentPosition, destination, mode = 'walk') {
        
        return await this.getRouteWithInstructions(
            currentPosition,
            destination,
            mode
        );
    }
}

// Create global instance
const routingService = new GeoapifyRoutingService();