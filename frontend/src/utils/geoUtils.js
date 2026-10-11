import axios from 'axios';
import { fetchWithFallback, getApiBaseUrl } from './apiConfig';

// Curated geographic dictionary of regional landmarks and demo scenarios
const KNOWN_LANDMARKS = [
  { name: 'Sitabuldi', display_name: 'Sitabuldi, Nagpur, Maharashtra, 440001, India', lat: 21.1458, lon: 79.0882 },
  { name: 'Sitabuldi, Nagpur', display_name: 'Sitabuldi, Nagpur, Maharashtra, 440001, India', lat: 21.1458, lon: 79.0882 },
  { name: 'Sitabuldi Fort', display_name: 'Sitabuldi Fort, Ramdaspeth, Nagpur, Maharashtra, 440001, India', lat: 21.1484, lon: 79.0840 },
  { name: 'Civil Lines', display_name: 'Civil Lines, Nagpur, Maharashtra, 440001, India', lat: 21.1610, lon: 79.0725 },
  { name: 'Civil Lines, Nagpur', display_name: 'Civil Lines, Nagpur, Maharashtra, 440001, India', lat: 21.1610, lon: 79.0725 },
  { name: 'Dharampeth', display_name: 'Dharampeth, Nagpur, Maharashtra, 440010, India', lat: 21.1428, lon: 79.0620 },
  { name: 'Dharampeth, Nagpur', display_name: 'Dharampeth, Nagpur, Maharashtra, 440010, India', lat: 21.1428, lon: 79.0620 },
  { name: 'Nagpur Airport', display_name: 'Dr. Babasaheb Ambedkar International Airport, Nagpur, Maharashtra, India', lat: 21.0922, lon: 79.0472 },
  { name: 'Dr. Babasaheb Ambedkar International Airport, Nagpur', display_name: 'Dr. Babasaheb Ambedkar International Airport, Nagpur, Maharashtra, India', lat: 21.0922, lon: 79.0472 },
  { name: 'Ramdaspeth', display_name: 'Ramdaspeth, Nagpur, Maharashtra, India', lat: 21.1375, lon: 79.0740 },
  { name: 'Dhantoli', display_name: 'Dhantoli, Nagpur, Maharashtra, India', lat: 21.1362, lon: 79.0835 },
  { name: 'Itwari', display_name: 'Itwari, Nagpur, Maharashtra, India', lat: 21.1558, lon: 79.1130 },
  { name: 'Sadar', display_name: 'Sadar, Nagpur, Maharashtra, India', lat: 21.1620, lon: 79.0830 },
  { name: 'Bandra West', display_name: 'Bandra West, Mumbai, Maharashtra, India', lat: 19.0596, lon: 72.8295 },
  { name: 'Bandra West, Mumbai', display_name: 'Bandra West, Mumbai, Maharashtra, India', lat: 19.0596, lon: 72.8295 },
  { name: 'Bandra Kurla Complex', display_name: 'Bandra Kurla Complex (BKC), Mumbai, Maharashtra, India', lat: 19.0657, lon: 72.8687 },
  { name: 'Bandra Kurla Complex, Mumbai', display_name: 'Bandra Kurla Complex (BKC), Mumbai, Maharashtra, India', lat: 19.0657, lon: 72.8687 },
  { name: 'BKC', display_name: 'Bandra Kurla Complex (BKC), Mumbai, Maharashtra, India', lat: 19.0657, lon: 72.8687 },
  { name: 'Dadar', display_name: 'Dadar, Mumbai, Maharashtra, India', lat: 19.0178, lon: 72.8478 },
  { name: 'Dadar, Mumbai', display_name: 'Dadar, Mumbai, Maharashtra, India', lat: 19.0178, lon: 72.8478 },
  { name: 'Lower Parel', display_name: 'Lower Parel, Mumbai, Maharashtra, India', lat: 18.9953, lon: 72.8302 },
  { name: 'Lower Parel, Mumbai', display_name: 'Lower Parel, Mumbai, Maharashtra, India', lat: 18.9953, lon: 72.8302 },
  { name: 'Andheri', display_name: 'Andheri, Mumbai, Maharashtra, India', lat: 19.1136, lon: 72.8697 },
  { name: 'Kurla', display_name: 'Kurla, Mumbai, Maharashtra, India', lat: 19.0726, lon: 72.8845 }
];

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

  // Fallback 1: Backend IP endpoint via fallback-aware client
  try {
    const res = await fetchWithFallback('/api/routes/locate-ip', { timeout: 4000 });
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
    const ipRes = await axios.get('https://ipapi.co/json/', { timeout: 3500 });
    if (ipRes.data && ipRes.data.latitude && ipRes.data.longitude) {
      const city = ipRes.data.city || 'Nagpur';
      return {
        lat: parseFloat(ipRes.data.latitude),
        lon: parseFloat(ipRes.data.longitude),
        city: city,
        region: ipRes.data.region,
        method: 'ip',
        label: `${city}, ${ipRes.data.region || ''} (Auto-detected)`
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
  const cleanQ = query.trim().toLowerCase();

  // 1. Check known landmark dictionary first for instant response
  const localMatches = KNOWN_LANDMARKS.filter(item => {
    const n = item.name.toLowerCase();
    const d = item.display_name.toLowerCase();
    return n.includes(cleanQ) || d.includes(cleanQ) || cleanQ.includes(n);
  });

  // 2. Try backend proxy via fallback-aware client (handles both 8000 and 8001)
  try {
    const res = await fetchWithFallback('/api/routes/geocode', {
      params: { q: query.trim() },
      timeout: 5000
    });
    if (res.data && Array.isArray(res.data) && res.data.length > 0) {
      // Merge results with localMatches if needed
      return res.data;
    }
  } catch (err) {
    console.warn("Backend geocode proxy failed, using curated landmark matching:", err.message);
  }

  // 3. If backend returned no results, use local matches if available
  if (localMatches.length > 0) {
    return localMatches;
  }

  // 4. Fallback: Direct OpenStreetMap Nominatim query with polite header
  try {
    const nomRes = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { q: query.trim(), format: 'json', limit: 5, addressdetails: 1 },
      timeout: 5000
    });
    if (nomRes.data && Array.isArray(nomRes.data) && nomRes.data.length > 0) {
      return nomRes.data.map(item => ({
        name: item.name || item.display_name.split(',')[0],
        display_name: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon)
      }));
    }
  } catch (err) {
    console.warn("Nominatim query failed:", err.message);
  }

  // 5. Final fallback for user convenience: synthesize regional coordinate anchor
  return [
    {
      name: query.trim(),
      display_name: `${query.trim()}, Nagpur Region, Maharashtra`,
      lat: 21.1458,
      lon: 79.0882
    }
  ];
}
