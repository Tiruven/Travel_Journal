// Weather Service ( Open-Meteo API )
class WeatherService {
    constructor() {
        this.currentWeather = null;
        this.updateInterval = 600000; // Update every 10 minutes
        this.updateTimer = null;
    }

    async init(position) {
        if (!position) {
            position = gpsTracker.currentPosition;
        }

        if (position) {
            await this.fetchWeather(position.lat, position.lng);
            this.startAutoUpdate(position);
        }
    }

    async fetchWeather(lat, lng) {
        try {
            // Using Open-Meteo API
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,wind_speed_10m_max,rain_sum&timezone=auto`;
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Weather API error: ${response.status}`);
            }
            
            const data = await response.json();

            if (!data || !data.current) {
                throw new Error('Invalid weather data received');
            }

            this.currentWeather = {
                temperature: Math.round(data.current.temperature_2m),
                feelsLike: Math.round(data.current.apparent_temperature),
                description: this.getWeatherDescription(data.current.weather_code),
                weatherCode: data.current.weather_code,
                windSpeed: Math.round(data.current.wind_speed_10m),
                windGusts: Math.round(data.current.wind_gusts_10m),
                humidity: data.current.relative_humidity_2m,
                cloudCover: data.current.cloud_cover,
                precipitation: data.current.precipitation || 0,
                uvIndex: data.daily.uv_index_max[0] || 0,
                isDay: data.current.is_day === 1,
                timestamp: Date.now()
            };

            this.updateWeatherUI();
            return this.currentWeather;

        } catch (error) {
            this.useMockWeather();
            return this.currentWeather;
        }
    }

    getWeatherDescription(code) {
        const weatherCodes = {
            0: 'Clear sky',
            1: 'Mainly clear',
            2: 'Partly cloudy',
            3: 'Overcast',
            45: 'Foggy',
            48: 'Depositing rime fog',
            51: 'Light drizzle',
            53: 'Moderate drizzle',
            55: 'Dense drizzle',
            61: 'Slight rain',
            63: 'Moderate rain',
            65: 'Heavy rain',
            71: 'Slight snow',
            73: 'Moderate snow',
            75: 'Heavy snow',
            77: 'Snow grains',
            80: 'Slight rain showers',
            81: 'Moderate rain showers',
            82: 'Violent rain showers',
            85: 'Slight snow showers',
            86: 'Heavy snow showers',
            95: 'Thunderstorm',
            96: 'Thunderstorm with slight hail',
            99: 'Thunderstorm with heavy hail'
        };

        return weatherCodes[code] || 'Unknown';
    }

    getWeatherIcon(code, isDay) {
        // Map weather codes to Font Awesome icons
        if (code === 0) return isDay ? 'fas fa-sun' : 'fas fa-moon';
        if (code <= 3) return isDay ? 'fas fa-cloud-sun' : 'fas fa-cloud-moon';
        if (code >= 45 && code <= 48) return 'fas fa-smog';
        if (code >= 51 && code <= 55) return 'fas fa-cloud-rain';
        if (code >= 61 && code <= 65) return 'fas fa-cloud-showers-heavy';
        if (code >= 71 && code <= 77) return 'fas fa-snowflake';
        if (code >= 80 && code <= 82) return 'fas fa-cloud-sun-rain';
        if (code >= 85 && code <= 86) return 'fas fa-snowflake';
        if (code >= 95) return 'fas fa-bolt';
        
        return 'fas fa-cloud';
    }

    useMockWeather() {
        this.currentWeather = {
            temperature: 24,
            feelsLike: 26,
            description: 'partly cloudy',
            weatherCode: 2,
            windSpeed: 15,
            windGusts: 20,
            humidity: 65,
            cloudCover: 50,
            precipitation: 0,
            uvIndex: 5,
            isDay: true,
            timestamp: Date.now()
        };

        this.updateWeatherUI();
    }

    updateWeatherUI() {
        if (!this.currentWeather) return;

        // Temperature
        const tempElement = document.getElementById('temperature');
        if (tempElement) {
            tempElement.textContent = `${this.currentWeather.temperature}°C`;
        }

        // Weather icon
        const iconElement = document.getElementById('weather-icon');
        if (iconElement) {
            iconElement.className = this.getWeatherIcon(
                this.currentWeather.weatherCode, 
                this.currentWeather.isDay
            );
        }

        // Wind speed
        const windElement = document.getElementById('wind-speed');
        if (windElement) {
            windElement.textContent = `${this.currentWeather.windSpeed} km/h`;
            
            // Highlight dangerous wind
            if (this.currentWeather.windSpeed > 40 || this.currentWeather.windGusts > 60) {
                windElement.classList.add('danger');
            } else {
                windElement.classList.remove('danger');
            }
        }

        // UV Index
        const uvElement = document.getElementById('uv-index');
        if (uvElement) {
            const uvLevel = this.getUVLevel(this.currentWeather.uvIndex);
            uvElement.textContent = `UV: ${Math.round(this.currentWeather.uvIndex)} (${uvLevel})`;
            uvElement.className = `uv-indicator ${uvLevel.toLowerCase()}`;
        }

        // Rain probability (based on precipitation)
        const rainElement = document.getElementById('rain-prob');
        if (rainElement) {
            const rainProb = this.currentWeather.precipitation > 0 ? 80 : 
                            this.currentWeather.cloudCover > 70 ? 40 : 10;
            rainElement.innerHTML = `<i class="fas fa-umbrella"></i> ${rainProb}%`;
        }
    }

    getUVLevel(uvIndex) {
        if (uvIndex <= 2) return 'Safe';
        if (uvIndex <= 5) return 'Moderate';
        if (uvIndex <= 7) return 'High';
        if (uvIndex <= 10) return 'Very High';
        return 'Extreme';
    }

    startAutoUpdate(position) {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }

        this.updateTimer = setInterval(() => {
            const currentPos = gpsTracker.currentPosition || position;
            this.fetchWeather(currentPos.lat, currentPos.lng);
        }, this.updateInterval);
    }

    getCurrentWeather() {
        return this.currentWeather;
    }

    isWeatherSafe() {
        if (!this.currentWeather) return true;

        if (this.currentWeather.windSpeed > 40) return false;
        if (this.currentWeather.windGusts > 60) return false;
        if (this.currentWeather.uvIndex > 10) return false;
        if (this.currentWeather.weatherCode >= 95) return false; // Thunderstorm

        return true;
    }
}

// Create global instance
const weatherService = new WeatherService();