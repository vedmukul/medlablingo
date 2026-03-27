// src/lib/supabase/deviceId.ts

const DEVICE_ID_KEY = "lablingo:device_id";

/**
 * Get or create a stable anonymous device ID.
 * This is a UUID stored in localStorage that identifies this browser
 * without requiring user authentication.
 */
export function getDeviceId(): string {
    if (typeof window === "undefined") return "server";

    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
}
