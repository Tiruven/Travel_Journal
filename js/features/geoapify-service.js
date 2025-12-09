// Geoapify Service with GeoJSON Support
class GeoapifyService {
    constructor() {
        this.apiKey = '199b4ac789c040c180ad396100269fdd';
        this.baseUrl = 'https://api.geoapify.com/v2';
        this.staticMapUrl = 'https://maps.geoapify.com/v1/staticmap';
    }


    // 1. PLACES API with GeoJSON from geopify
    async fetchNearbyPlaces(lat, lng, categories = [], radius = 5000) {
        try {
            const categoriesParam = categories.length > 0 
                ? categories.join(',') 
                : 'tourism,entertainment,natural,beach,catering,accommodation';

            const url = `${this.baseUrl}/places?categories=${categoriesParam}&filter=circle:${lng},${lat},${radius}&limit=100&apiKey=${this.apiKey}`;
            
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Geoapify API error: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data || !data.features) {
                console.warn('No features in response');
                return [];
            }


            // Convert GeoJSON to hotspot format
            return data.features.map(feature => this.convertGeoJSONToHotspot(feature));

        } catch (error) {
            return [];
        }
    }

    // Convert GeoJSON feature to hotspot format
    convertGeoJSONToHotspot(feature) {
        const props = feature.properties;
        const coords = feature.geometry.coordinates;

        // Extract main category
        const mainCategory = this.extractMainCategory(props.categories);

        return {
            id: props.place_id || generateId(),
            name: props.name || props.address_line1 || 'Unknown Place',
            lat: coords[1],  // GeoJSON [lng, lat]
            lng: coords[0],
            category: mainCategory,
            description: this.generateDescription(props),
            address: props.formatted || props.address_line2 || `${coords[1].toFixed(4)}, ${coords[0].toFixed(4)}`,
            rating: this.extractRating(props),
            photos: [],
            details: {
                website: props.website || props.datasource?.raw?.website || '',
                phone: props.contact?.phone || props.datasource?.raw?.phone || '',
                openingHours: props.opening_hours || props.datasource?.raw?.opening_hours || '',
                facilities: props.facilities || [],
                categories: props.categories || []
            },
            visited: false,
            distance: 0,
            geoapifyData: props
        };
    }

    // Extract main category from Geoapify categories array
    extractMainCategory(categories) {
        if (!categories || categories.length === 0) return 'tourism';

        //main category
        const priorityMap = {
            'beach': 'beach',
            'catering': 'catering',
            'accommodation': 'accommodation',
            'entertainment.museum': 'entertainment',
            'entertainment': 'entertainment',
            'tourism': 'tourism',
            'natural': 'natural'
        };

        // Find first matching priority category
        for (let cat of categories) {
            for (let [key, value] of Object.entries(priorityMap)) {
                if (cat.includes(key)) {
                    return value;
                }
            }
        }

        return 'tourism';
    }

    // Extract rating from datasource
    extractRating(props) {
        if (props.datasource?.raw?.rating) {
            return parseFloat(props.datasource.raw.rating);
        }
        return 0;
    }


    // 2. REVERSE GEOCODING API
    async reverseGeocode(lat, lng) {
        try {
            const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${this.apiKey}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            }
            
            const data = await response.json();

            if (data.features && data.features.length > 0) {
                return data.features[0].properties.formatted;
            }

            return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        } catch (error) {
            return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        }
    }


    // 3. ROUTING API
    async getRoute(startLat, startLng, endLat, endLng, mode = 'walk') {
        try {
            const url = `https://api.geoapify.com/v1/routing?waypoints=${startLat},${startLng}|${endLat},${endLng}&mode=${mode}&apiKey=${this.apiKey}`;
            
            const response = await fetch(url);
            
            if (!response.ok) {
                return null;
            }
            
            const data = await response.json();

            if (!data || !data.features || data.features.length === 0) {
                return null;
            }

            const route = data.features[0];
            const props = route.properties;

            return {
                coordinates: route.geometry.coordinates[0].map(coord => [coord[1], coord[0]]),
                distance: props.distance,
                time: props.time,
                steps: props.legs[0]?.steps || []
            };

        } catch (error) {
            return null;
        }
    }

    // 4. AUTOCOMPLETE API
    async autocomplete(text, lat, lng, limit = 5) {
        try {
            const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(text)}&bias=proximity:${lng},${lat}&limit=${limit}&apiKey=${this.apiKey}`;
            
            const response = await fetch(url);
            
            if (!response.ok) {
                return [];
            }
            
            const data = await response.json();

            if (!data || !data.features) {
                return [];
            }

            return data.features.map(feature => {
                const props = feature.properties;
                const coords = feature.geometry.coordinates;

                return {
                    name: props.name || props.address_line1,
                    address: props.formatted || '',
                    lat: coords[1],
                    lng: coords[0],
                    placeId: props.place_id
                };
            });

        } catch (error) {
            return [];
        }
    }


    // Helper Methods
    generateDescription(props) {
        // Try to get description from raw data
        if (props.datasource?.raw?.description) {
            return props.datasource.raw.description;
        }

        // Generate based on type
        const categories = props.categories || [];
        
        if (categories.some(c => c.includes('museum'))) {
            return 'Museum and cultural attraction';
        }
        if (categories.some(c => c.includes('beach'))) {
            return 'Beach and coastal area';
        }
        if (categories.some(c => c.includes('restaurant') || c.includes('cafe'))) {
            return 'Dining and refreshments';
        }
        if (categories.some(c => c.includes('hotel') || c.includes('accommodation'))) {
            return 'Accommodation and lodging';
        }
        if (categories.some(c => c.includes('park') || c.includes('natural'))) {
            return 'Natural area and outdoor space';
        }
        
        return 'Point of interest';
    }

    calculateDistance(lat1, lng1, lat2, lng2) {
        return calculateDistance(lat1, lng1, lat2, lng2);
    }
}

// Create global instance
const geoapifyService = new GeoapifyService();