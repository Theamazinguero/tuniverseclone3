// web-ui/app.js

const API_BASE = "http://127.0.0.1:8000";
const LS_ACCESS_TOKEN_KEY = "tuniverse_access_token";
const LS_APP_TOKEN_KEY = "tuniverse_app_token";
const LS_DISPLAY_NAME_KEY = "tuniverse_display_name";

/* ------------ Tuniverse Region Definitions ------------ */
const REGION_ICON_MAP = {
    "North America": "assets/northamerica.png",
    "Caribbean": "assets/caribbean.png",
    "South America": "assets/southamerica.png",
    "Middle East": "assets/middleeast.png",
    "South Asia": "assets/southasia.png",
    "Southeast Asia": "assets/southeastasia.png",
    "East Asia": "assets/eastasia.png",
    "Africa": "assets/africa.png",
    "Europe": null,
    "Oceania": null,
    "Unknown": null,
};

const COUNTRY_TO_TUNIVERSE_REGION = {
    // North America
    "US": "North America",
    "USA": "North America",
    "United States": "North America",
    "Canada": "North America",
    "CA": "North America",
    "Montréal": "North America",
    "Ottawa": "North America",
    "Mexico": "North America",

    // Caribbean
    "Puerto Rico": "Caribbean",
    "Jamaica": "Caribbean",
    "Cuba": "Caribbean",
    "Dominican Republic": "Caribbean",
    "Trinidad and Tobago": "Caribbean",

    // South America
    "BR": "South America",
    "Brazil": "South America",
    "AR": "South America",
    "Argentina": "South America",
    "CL": "South America",
    "Chile": "South America",
    "CO": "South America",
    "Colombia": "South America",
    "Peru": "South America",

    // Europe
    "UK": "Europe",
    "GB": "Europe",
    "United Kingdom": "Europe",
    "Ireland": "Europe",
    "Germany": "Europe",
    "DE": "Europe",
    "France": "Europe",
    "FR": "Europe",
    "Spain": "Europe",
    "ES": "Europe",
    "Italy": "Europe",
    "IT": "Europe",
    "Netherlands": "Europe",
    "Sweden": "Europe",
    "Norway": "Europe",
    "Finland": "Europe",
    "Denmark": "Europe",
    "Poland": "Europe",
    "Portugal": "Europe",
    "Russia": "Europe",
    "PL": "Europe",

    // Middle East
    "Saudi Arabia": "Middle East",
    "United Arab Emirates": "Middle East",
    "UAE": "Middle East",
    "Israel": "Middle East",
    "Jordan": "Middle East",
    "Lebanon": "Middle East",
    "Qatar": "Middle East",
    "Kuwait": "Middle East",
    "Oman": "Middle East",
    "Bahrain": "Middle East",
    "Iran": "Middle East",
    "Iraq": "Middle East",
    "Syria": "Middle East",
    "Yemen": "Middle East",

    // South Asia
    "IN": "South Asia",
    "India": "South Asia",
    "Pakistan": "South Asia",
    "Bangladesh": "South Asia",
    "Sri Lanka": "South Asia",
    "Nepal": "South Asia",

    // Southeast Asia
    "TH": "Southeast Asia",
    "Thailand": "Southeast Asia",
    "Vietnam": "Southeast Asia",
    "VN": "Southeast Asia",
    "Malaysia": "Southeast Asia",
    "Singapore": "Southeast Asia",
    "Indonesia": "Southeast Asia",
    "Philippines": "Southeast Asia",
    "Cambodia": "Southeast Asia",
    "Laos": "Southeast Asia",
    "Myanmar": "Southeast Asia",

    // East Asia
    "JP": "East Asia",
    "Japan": "East Asia",
    "KR": "East Asia",
    "South Korea": "East Asia",
    "North Korea": "East Asia",
    "CN": "East Asia",
    "China": "East Asia",
    "Taiwan": "East Asia",
    "Hong Kong": "East Asia",

    // Africa
    "South Africa": "Africa",
    "Nigeria": "Africa",
    "Egypt": "Africa",
    "Kenya": "Africa",
    "Ghana": "Africa",
    "Morocco": "Africa",
    "Algeria": "Africa",
    "Tunisia": "Africa",

    // Oceania
    "AU": "Oceania",
    "Australia": "Oceania",
    "NZ": "Oceania",
    "New Zealand": "Oceania",
};

/* ------------ Helpers ------------ */
function $(id) {
    return document.getElementById(id);
}

/* ------------ Token Handling ------------ */
function setAccessToken(token) {
    if (token) {
        localStorage.setItem(LS_ACCESS_TOKEN_KEY, token);
    }
}
function getAccessToken() {
    return localStorage.getItem(LS_ACCESS_TOKEN_KEY) || "";
}
function setAppToken(token) {
    if (token) {
        localStorage.setItem(LS_APP_TOKEN_KEY, token);
    }
}
function getAppToken() {
    return localStorage.getItem(LS_APP_TOKEN_KEY) || "";
}
function setDisplayName(name) {
    if (name) {
        localStorage.setItem(LS_DISPLAY_NAME_KEY, name);
        const input = $("displayNameInput");
        if (input) input.value = name;
    }
}
function parseAuthFragment() {
    if (!window.location.hash || window.location.hash.length <= 1) {
        return {};
    }
    const frag = window.location.hash.substring(1);
    const params = {};
    for (const part of frag.split("&")) {
        const [rawKey, rawVal] = part.split("=");
        if (!rawKey) continue;
        const key = decodeURIComponent(rawKey);
        const val = rawVal ? decodeURIComponent(rawVal) : "";
        params[key] = val;
    }
    return params;
}

/* ------------ Init ------------ */
window.addEventListener("DOMContentLoaded", () => {
    const authStatus = $("authStatus");
    const fragParams = parseAuthFragment();

    if (fragParams.access_token) {
        setAccessToken(fragParams.access_token);
        setAppToken(fragParams.app_token || "");
        setDisplayName(fragParams.display_name || "");
        if (authStatus) {
            authStatus.textContent = "Access token received / loaded.";
        }
        history.replaceState(null, "", window.location.pathname);
    } else {
        const token = getAccessToken();
        if (token && authStatus) {
            authStatus.textContent = "Access token loaded from previous session.";
        } else if (authStatus) {
            authStatus.textContent = "Not logged in yet.";
        }
        const savedName = localStorage.getItem(LS_DISPLAY_NAME_KEY);
        if (savedName && $("displayNameInput")) {
            $("displayNameInput").value = savedName;
        }
    }
});

/* ------------ Auth / Spotify ------------ */
function loginWithSpotify() {
    window.location.href = `${API_BASE}/auth/login`;
}

// keep these for potential debug use; no UI wired right now
function saveAccessToken() {
    const input = $("accessTokenInput");
    if (!input) return;
    const token = input.value.trim();
    if (!token) {
        alert("Paste an access token first.");
        return;
    }
    setAccessToken(token);
    if ($("authStatus")) {
        $("authStatus").textContent = "Access token saved from textarea.";
    }
}

async function loadCurrentTrack() {
    const token = getAccessToken();
    if (!token) {
        alert("No Spotify access token yet. Login with Spotify first.");
        return;
    }

    const url = `${API_BASE}/spotify/me?access_token=${encodeURIComponent(token)}`;
    try {
        const res = await fetch(url);
        if (!res.ok) {
            const text = await res.text();
            console.error("spotify/me error:", res.status, text);
            return;
        }
        const data = await res.json();
        console.log("spotify/me:", data);

        const displayName = data.display_name || "";
        setDisplayName(displayName);
    } catch (err) {
        console.error("spotify/me failed:", err);
    }
}

async function loadPlaylists() {
    const token = getAccessToken();
    if (!token) {
        alert("No Spotify access token yet.");
        return;
    }
    const container = $("playlistsList");
    if (!container) return;
    container.innerHTML = `<p class="placeholder-text">Loading playlists


