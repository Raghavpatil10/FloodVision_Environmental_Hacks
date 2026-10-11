import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * Robust user location resolver:
 * 1. Attempts browser Geolocation (HTML5 GPS/WiFi)
 * 2. Falls back seamlessly to IP-based Geolocation (No API key required)
 * 3. Never triggers blocking alert() popups
 */
export async function getUserLocation() {
  // Try HTML5 Geolocation first if supported
  if ('geolocation' in navigator) {
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
        );
      });
      if (pos && pos.coords) {
        return {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          method: 'gps',
          label: `GPS (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`
        };
      }
    } catch (err) {
      console.warn("Browser GPS not available or timed out, trying IP geolocation fallback:", err.message);
    }
  }

  // Fallback 1: Backend IP endpoint
  try {
    const res = await axios.get(`${API_BASE_URL}/api/routes/locate-ip`, { timeout: 4000 });
    if (res.data && res.data.lat && res.data.lon) {
      const city = res.data.city || 'Local Area';
      const region = res.data.region ? `, ${res.data.region}` : '';
      return {
        lat: parseFloat(res.data.lat),
        lon: parseFloat(res.data.lon),
        city: city,
        region: res.data.region,
        method: 'ip',
        label: `${city}${region} (IP Location)`
      };
    }
  } catch (backendErr) {
    console.warn("Backend IP locate failed, trying public IP fallback:", backendErr.message);
  }

  // Fallback 2: Direct public IP lookup
  try {
    const ipRes = await axios.get('http://ip-api.com/json', { timeout: 3500 });
    if (ipRes.data && ipRes.data.status === 'success') {
      const city = ipRes.data.city || 'Nagpur';
      return {
        lat: parseFloat(ipRes.data.lat),
        lon: parseFloat(ipRes.data.lon),
        city: city,
        region: ipRes.data.regionName,
        method: 'ip',
        label: `${city}, ${ipRes.data.regionName || ''} (Auto-detected)`
      };
    }
  } catch (e) {
    console.warn("Direct IP lookup failed:", e.message);
  }

  // Fallback 3: Regional default (Nagpur, Maharashtra)
  return {
    lat: 21.1463,
    lon: 79.0849,
    city: 'Nagpur',
    region: 'Maharashtra',
    method: 'default',
    label: 'Nagpur, Maharashtra'
  };
}

/**
 * Geocodes location names, landmarks, or addresses to geographic coordinates.
 */
export async function searchLocations(query) {
  if (!query || query.trim().length < 2) return [];

  // Try backend proxy first
  try {
    const res = await axios.get(`${API_BASE_URL}/api/routes/geocode`, {
      params: { q: query.trim() },
      timeout: 5000
    });
    if (res.data && Array.isArray(res.data) && res.data.length > 0) {
      return res.data;
    }
  } catch (err) {
    console.warn("Backend geocode proxy failed, trying Nominatim directly:", err.message);
  }

  // Fallback: Direct OpenStreetMap Nominatim query
  try {
    const nomRes = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { q: query.trim(), format: 'json', limit: 5, addressdetails: 1 },
      timeout: 5000
    });
    if (nomRes.data && Array.isArray(nomRes.data)) {
      return nomRes.data.map(item => ({
        name: item.name || item.display_name.split(',')[0],
        display_name: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon)
      }));
    }
  } catch (err) {
    console.error("Nominatim query failed:", err.message);
  }

  return [];
}
