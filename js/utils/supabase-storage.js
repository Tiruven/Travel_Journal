// Supabase Storage Helper
class SupabaseStorage {
    constructor() {
        this.supabase = supabaseClient;
        this.photoBucket = 'photos';
        this.audioBucket = 'audio';
    }

    /**
     * Upload photo to Supabase Storage
     */
    async uploadPhoto(file, userId) {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${userId}/${Date.now()}.${fileExt}`;
            
            const { data, error } = await this.supabase.storage
                .from(this.photoBucket)
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;

            // Get public URL
            const { data: { publicUrl } } = this.supabase.storage
                .from(this.photoBucket)
                .getPublicUrl(fileName);

            return publicUrl;
        } catch (error) {
            console.error('Photo upload error:', error);
            throw error;
        }
    }

    /**
     * Upload photo from base64 data URL
     */
    async uploadPhotoFromDataUrl(dataUrl, userId) {
        try {
            // Convert data URL to blob
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            
            const fileName = `${userId}/${Date.now()}.jpg`;
            
            const { data, error } = await this.supabase.storage
                .from(this.photoBucket)
                .upload(fileName, blob, {
                    contentType: 'image/jpeg',
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;

            // Get public URL
            const { data: { publicUrl } } = this.supabase.storage
                .from(this.photoBucket)
                .getPublicUrl(fileName);

            return publicUrl;
        } catch (error) {
            console.error('Photo upload from data URL error:', error);
            throw error;
        }
    }

    /**
     * Upload audio to Supabase Storage
     */
    async uploadAudio(blob, userId) {
        try {
            const fileName = `${userId}/${Date.now()}.webm`;
            
            const { data, error } = await this.supabase.storage
                .from(this.audioBucket)
                .upload(fileName, blob, {
                    contentType: 'audio/webm',
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;

            // Get public URL
            const { data: { publicUrl } } = this.supabase.storage
                .from(this.audioBucket)
                .getPublicUrl(fileName);

            return publicUrl;
        } catch (error) {
            console.error('Audio upload error:', error);
            throw error;
        }
    }

    /**
     * Delete photo from storage
     */
    async deletePhoto(photoUrl) {
        try {
            // Extract file path from URL
            const urlParts = photoUrl.split('/');
            const bucketIndex = urlParts.indexOf(this.photoBucket);
            const filePath = urlParts.slice(bucketIndex + 1).join('/');

            const { error } = await this.supabase.storage
                .from(this.photoBucket)
                .remove([filePath]);

            if (error) throw error;
        } catch (error) {
            console.error('Photo delete error:', error);
            throw error;
        }
    }

    /**
     * Delete audio from storage
     */
    async deleteAudio(audioUrl) {
        try {
            // Extract file path from URL
            const urlParts = audioUrl.split('/');
            const bucketIndex = urlParts.indexOf(this.audioBucket);
            const filePath = urlParts.slice(bucketIndex + 1).join('/');

            const { error } = await this.supabase.storage
                .from(this.audioBucket)
                .remove([filePath]);

            if (error) throw error;
        } catch (error) {
            console.error('Audio delete error:', error);
            throw error;
        }
    }
}

// Create global instance
const supabaseStorage = new SupabaseStorage();