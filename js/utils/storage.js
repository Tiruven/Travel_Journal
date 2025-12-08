// Storage Manager for Supabase
class StorageManager {
    constructor() {
        this.supabase = supabaseClient;
        this.isReady = true;
        this.currentUserId = null;
        this.initPromise = this.init();
    }

    async init() {
        try {
            const { data: { user } } = await this.supabase.auth.getUser();
            this.currentUserId = user?.id;
            return true;
        } catch (error) {
            console.error('Storage init error:', error);
            return false;
        }
    }

    async waitForReady() {
        await this.initPromise;
    }

    async getCurrentUserId() {
        if (!this.currentUserId) {
            const { data: { user } } = await this.supabase.auth.getUser();
            this.currentUserId = user?.id;
        }
        return this.currentUserId;
    }

    // ============================================
    // MEMORIES
    // ============================================

    async saveMemory(memory) {
        try {
            const userId = await this.getCurrentUserId();
            if (!userId) throw new Error('User not authenticated');

            // Upload files to storage if they exist
            if (memory.type === 'photo' && memory.data) {
                const photoUrl = await supabaseStorage.uploadPhotoFromDataUrl(memory.data, userId);
                memory.photo_url = photoUrl;
                delete memory.data; // Remove base64 data
            } else if (memory.type === 'audio' && memory.data) {
                // Convert data URL to blob
                const response = await fetch(memory.data);
                const blob = await response.blob();
                const audioUrl = await supabaseStorage.uploadAudio(blob, userId);
                memory.audio_url = audioUrl;
                delete memory.data; // Remove base64 data
            } else if (memory.type === 'text') {
                memory.text_note = memory.caption;
            }

            // Save to database
            const { data, error } = await this.supabase
                .from('user_memories')
                .insert([{
                    user_id: userId,
                    type: memory.type,
                    photo_url: memory.photo_url || null,
                    audio_url: memory.audio_url || null,
                    text_note: memory.text_note || null,
                    caption: memory.caption,
                    latitude: memory.location?.lat || null,
                    longitude: memory.location?.lng || null,
                    hotspot_name: memory.hotspot_name || null,
                    hotspot_category: memory.hotspot_category || null
                }])
                .select()
                .single();

            if (error) throw error;

            return data.id;
        } catch (error) {
            console.error('Save memory error:', error);
            throw error;
        }
    }

    async getAllMemories(type = null) {
        try {
            const userId = await this.getCurrentUserId();
            if (!userId) return [];

            let query = this.supabase
                .from('user_memories')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (type) {
                query = query.eq('type', type);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Convert to format expected by app
            return data.map(memory => ({
                id: memory.id,
                type: memory.type,
                data: memory.photo_url || memory.audio_url || null,
                caption: memory.caption || memory.text_note,
                location: memory.latitude && memory.longitude ? {
                    lat: memory.latitude,
                    lng: memory.longitude
                } : null,
                timestamp: new Date(memory.created_at).getTime(),
                hotspot_name: memory.hotspot_name,
                hotspot_category: memory.hotspot_category
            }));
        } catch (error) {
            console.error('Get memories error:', error);
            return [];
        }
    }

    async deleteMemory(id) {
        try {
            const userId = await this.getCurrentUserId();
            if (!userId) throw new Error('User not authenticated');

            // Get memory to delete files from storage
            const { data: memory } = await this.supabase
                .from('user_memories')
                .select('*')
                .eq('id', id)
                .eq('user_id', userId)
                .single();

            if (memory) {
                // Delete files from storage
                if (memory.photo_url) {
                    await supabaseStorage.deletePhoto(memory.photo_url);
                }
                if (memory.audio_url) {
                    await supabaseStorage.deleteAudio(memory.audio_url);
                }
            }

            // Delete from database
            const { error } = await this.supabase
                .from('user_memories')
                .delete()
                .eq('id', id)
                .eq('user_id', userId);

            if (error) throw error;
        } catch (error) {
            console.error('Delete memory error:', error);
            throw error;
        }
    }

    // ============================================
    // VISITED HOTSPOTS
    // ============================================

    async markHotspotAsVisited(hotspot) {
        try {
            const userId = await this.getCurrentUserId();
            if (!userId) throw new Error('User not authenticated');

            console.log('Saving visited hotspot to DB:', {
                user_id: userId,
                hotspot_api_id: hotspot.id,
                hotspot_name: hotspot.name
            });

            const { data, error } = await this.supabase
                .from('visited_hotspots')
                .upsert([{
                    user_id: userId,
                    hotspot_api_id: hotspot.id,
                    hotspot_name: hotspot.name,
                    latitude: hotspot.lat,
                    longitude: hotspot.lng,
                    category: hotspot.category
                }], { onConflict: 'user_id,hotspot_api_id' })
                .select()
                .single();

            if (error) throw error;

            console.log('✓ Visited hotspot saved to database:', data);
            return data;
        } catch (error) {
            console.error('❌ Mark visited error:', error);
            throw error;
        }
    }

    async getVisitedHotspots() {
        try {
            const userId = await this.getCurrentUserId();
            if (!userId) {
                console.log('No user ID, returning empty visited list');
                return [];
            }

            const { data, error } = await this.supabase
                .from('visited_hotspots')
                .select('*')
                .eq('user_id', userId)
                .order('visited_at', { ascending: false });

            if (error) throw error;

            console.log('✓ Loaded', data?.length || 0, 'visited hotspots from database');
            return data || [];
        } catch (error) {
            console.error('Get visited hotspots error:', error);
            return [];
        }
    }

    async isHotspotVisited(hotspotApiId) {
        try {
            const userId = await this.getCurrentUserId();
            if (!userId) return false;

            const { data, error } = await this.supabase
                .from('visited_hotspots')
                .select('id')
                .eq('user_id', userId)
                .eq('hotspot_api_id', hotspotApiId)
                .maybeSingle();

            return !!data;
        } catch (error) {
            console.error('Check visited error:', error);
            return false;
        }
    }

    // ============================================
    // WISHLIST
    // ============================================

    async addToWishlist(hotspot) {
        try {
            const userId = await this.getCurrentUserId();
            if (!userId) throw new Error('User not authenticated');

            const { data, error } = await this.supabase
                .from('wishlist')
                .insert([{
                    user_id: userId,
                    hotspot_api_id: hotspot.id,
                    hotspot_name: hotspot.name,
                    latitude: hotspot.lat,
                    longitude: hotspot.lng,
                    category: hotspot.category,
                    description: hotspot.description
                }])
                .select()
                .single();

            if (error) {
                // Check if already exists
                if (error.code === '23505') {
                    console.log('Item already in wishlist');
                    return null;
                }
                throw error;
            }

            console.log('Added to wishlist in DB:', data);
            return data;
        } catch (error) {
            console.error('Add to wishlist error:', error);
            throw error;
        }
    }

    async removeFromWishlist(hotspotApiId) {
        try {
            const userId = await this.getCurrentUserId();
            if (!userId) throw new Error('User not authenticated');

            const { error } = await this.supabase
                .from('wishlist')
                .delete()
                .eq('user_id', userId)
                .eq('hotspot_api_id', hotspotApiId);

            if (error) throw error;

            console.log('Removed from wishlist in DB:', hotspotApiId);
        } catch (error) {
            console.error('Remove from wishlist error:', error);
            throw error;
        }
    }

    async getWishlist() {
        try {
            const userId = await this.getCurrentUserId();
            if (!userId) return [];

            const { data, error } = await this.supabase
                .from('wishlist')
                .select('*')
                .eq('user_id', userId)
                .order('added_at', { ascending: false });

            if (error) throw error;

            console.log('Loaded wishlist from DB:', data);
            return data || [];
        } catch (error) {
            console.error('Get wishlist error:', error);
            return [];
        }
    }

    async isInWishlist(hotspotApiId) {
        try {
            const userId = await this.getCurrentUserId();
            if (!userId) return false;

            const { data, error } = await this.supabase
                .from('wishlist')
                .select('id')
                .eq('user_id', userId)
                .eq('hotspot_api_id', hotspotApiId)
                .maybeSingle();

            if (error) throw error;
            return !!data;
        } catch (error) {
            console.error('Check wishlist error:', error);
            return false;
        }
    }

    // ============================================
    // DAILY STATS
    // ============================================

    async saveDailyStats(stats) {
        try {
            const userId = await this.getCurrentUserId();
            if (!userId) throw new Error('User not authenticated');

            const today = new Date().toISOString().split('T')[0];

            const { data, error } = await this.supabase
                .from('daily_stats')
                .upsert([{
                    user_id: userId,
                    date: today,
                    steps: Math.round(stats.stepsToday || 0),
                    distance_km: parseFloat(((stats.distanceToday || 0) / 1000).toFixed(3)),
                    time_walked_seconds: Math.round(stats.timeWalkedToday || 0),
                    places_visited: Math.round(stats.placesVisited || 0),
                    memories_saved: Math.round(stats.memoriesSaved || 0),
                    highest_altitude: stats.highestAltitude ? Math.round(stats.highestAltitude) : null
                }], { onConflict: 'user_id,date' })
                .select()
                .single();

            if (error) throw error;

            // Also update user profile totals
            await this.updateUserProfileStats(stats);

            return data;
        } catch (error) {
            console.error('Save daily stats error:', error);
            // Don't throw - just log and continue
            return null;
        }
    }

    async updateUserProfileStats(stats) {
        try {
            const userId = await this.getCurrentUserId();
            if (!userId) return;

            const { error } = await this.supabase
                .from('user_profiles')
                .update({
                    total_distance_km: parseFloat(((stats.allTimeDistance || 0) / 1000).toFixed(3)),
                    total_steps: Math.round(stats.stepsToday || 0),
                    level: Math.round(stats.level || 1),
                    xp: Math.round(stats.xp || 0)
                })
                .eq('id', userId);

            if (error) throw error;
        } catch (error) {
            console.error('Update profile stats error:', error);
        }
    }

    async getStatsForDate(date) {
        try {
            const userId = await this.getCurrentUserId();
            if (!userId) return {};

            const { data, error } = await this.supabase
                .from('daily_stats')
                .select('*')
                .eq('user_id', userId)
                .eq('date', date)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') throw error;

            if (data) {
                return {
                    stepsToday: data.steps,
                    distanceToday: data.distance_km * 1000,
                    timeWalkedToday: data.time_walked_seconds,
                    placesVisited: data.places_visited,
                    memoriesSaved: data.memories_saved,
                    highestAltitude: data.highest_altitude
                };
            }

            return {};
        } catch (error) {
            console.error('Get stats error:', error);
            return {};
        }
    }

    // ============================================
    // ACHIEVEMENTS
    // ============================================

    async saveAchievement(achievement) {
        try {
            const userId = await this.getCurrentUserId();
            if (!userId) throw new Error('User not authenticated');

            const { data, error } = await this.supabase
                .from('achievements')
                .upsert([{
                    user_id: userId,
                    achievement_key: achievement.id,
                    title: achievement.name,
                    description: achievement.description,
                    progress: Math.round(achievement.progress || 0), // Round to integer
                    target: Math.round(achievement.requirement.value || 0), // Round to integer
                    unlocked: achievement.unlocked || false,
                    unlocked_at: achievement.unlocked ? new Date().toISOString() : null,
                    reward: Math.round(achievement.reward || 0) // Round to integer
                }], { onConflict: 'user_id,achievement_key' })
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Save achievement error:', error);
            // Don't throw - just log and continue
            return null;
        }
    }

    async getAllAchievements() {
        try {
            const userId = await this.getCurrentUserId();
            if (!userId) return [];

            const { data, error } = await this.supabase
                .from('achievements')
                .select('*')
                .eq('user_id', userId)
                .order('unlocked_at', { ascending: false, nullsFirst: false });

            if (error) throw error;

            // Convert to app format
            return data.map(ach => ({
                id: ach.achievement_key,
                name: ach.title,
                description: ach.description,
                icon: this.getAchievementIcon(ach.achievement_key),
                requirement: { type: 'custom', value: ach.target },
                reward: ach.reward,
                unlocked: ach.unlocked,
                progress: ach.progress,
                unlockedAt: ach.unlocked_at
            }));
        } catch (error) {
            console.error('Get achievements error:', error);
            return [];
        }
    }

    getAchievementIcon(key) {
        const icons = {
            'walker_1km': 'fa-walking',
            'walker_5km': 'fa-hiking',
            'walker_10km': 'fa-running',
            'explorer_5': 'fa-map-marked-alt',
            'memory_10': 'fa-camera',
            'steps_1000': 'fa-shoe-prints'
        };
        return icons[key] || 'fa-trophy';
    }

    // ============================================
    // ROUTE POINTS
    // ============================================

    async saveRoutePoint(point) {
        try {
            const userId = await this.getCurrentUserId();
            if (!userId) return;

            const { data, error } = await this.supabase
                .from('route_points')
                .insert([{
                    user_id: userId,
                    latitude: point.lat,
                    longitude: point.lng,
                    altitude: point.altitude || null,
                    speed: point.speed || null,
                    accuracy: point.accuracy || null,
                    timestamp: point.timestamp ? new Date(point.timestamp).toISOString() : new Date().toISOString()
                }])
                .select()
                .single();

            if (error) throw error;
            return data.id;
        } catch (error) {
            console.error('Save route point error:', error);
        }
    }

    async getTodayRoute() {
        try {
            const userId = await this.getCurrentUserId();
            if (!userId) return [];

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const { data, error } = await this.supabase
                .from('route_points')
                .select('*')
                .eq('user_id', userId)
                .gte('timestamp', today.toISOString())
                .order('timestamp', { ascending: true });

            if (error) throw error;

            return data.map(point => ({
                lat: point.latitude,
                lng: point.longitude,
                altitude: point.altitude,
                speed: point.speed,
                accuracy: point.accuracy,
                timestamp: new Date(point.timestamp).getTime()
            }));
        } catch (error) {
            console.error('Get today route error:', error);
            return [];
        }
    }

    // ============================================
    // DEVICE LOGS
    // ============================================

    async logDeviceInfo(deviceInfo) {
        try {
            const userId = await this.getCurrentUserId();
            if (!userId) return;

            const { error } = await this.supabase
                .from('device_logs')
                .insert([{
                    user_id: userId,
                    device_id: deviceInfo.deviceId,
                    user_agent: deviceInfo.userAgent,
                    screen_width: deviceInfo.screenWidth,
                    screen_height: deviceInfo.screenHeight,
                    platform: deviceInfo.platform,
                    timezone: deviceInfo.timezone,
                    network_type: deviceInfo.online ? 'online' : 'offline'
                }]);

            if (error) throw error;
        } catch (error) {
            console.error('Log device info error:', error);
        }
    }

    // ============================================
    // LEGACY SUPPORT (LocalStorage fallback)
    // ============================================

    setItem(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('LocalStorage error:', e);
        }
    }

    getItem(key) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (e) {
            console.error('LocalStorage error:', e);
            return null;
        }
    }

    removeItem(key) {
        localStorage.removeItem(key);
    }
}

// Create global instance
const storage = new StorageManager();