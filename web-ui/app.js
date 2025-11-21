/*
@Author: Tuniverse Team
@Version: 1.0
@Since: 11/9/2025

Usage:
    Core frontend logic for the Tuniverse web UI.
    Handles:
        • Spotify login and token handling
        • Fetching playlists and user profile
        • Building Music Passport snapshots from backend data
        • Computing region breakdown (Artists by Region)
        • Sharing passport snapshots to the Community feed
        • Loading and rendering community posts and achievements

Change Log:
    Version 1.0 (11/9/2025): Implemented main frontend behavior for Tuniverse, including
                             passport loading, region breakdown, and community sharing.
*/


// web-ui/app.js

const API_BASE = "http://127.0.0.1:8000";
const LS_ACCESS_TOKEN_KEY = "tuniverse_access_token";
const LS_APP_TOKEN_KEY = "tuniverse_app_token";
const LS_DISPLAY_NAME_KEY = "tuniverse_display_name";

// cache of the last "Artists by Region" HTML
let lastArtistsByRegionHtml = "";

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

// kept for possible debug re-use
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
    container.innerHTML = `<p class="placeholder-text">Loading playlists…</p>`;

    const url = `${API_BASE}/spotify/playlists?access_token=${encodeURIComponent(token)}&limit=20`;
    try {
        const res = await fetch(url);
        if (!res.ok) {
            const text = await res.text();
            console.error("spotify/playlists error:", res.status, text);
            container.innerHTML = `<p class="placeholder-text">Failed to load playlists.</p>`;
            return;
        }
        const data = await res.json();
        const items = data.items || [];
        if (!items.length) {
            container.innerHTML = `<p class="placeholder-text">No playlists found.</p>`;
            return;
        }
        const lines = items.map((pl) => {
            const name = pl.name || "Untitled playlist";
            const tracks = (pl.tracks && pl.tracks.total) || 0;
            const owner = pl.owner && pl.owner.display_name ? pl.owner.display_name : "Unknown";
            return `<p>${name} — ${tracks} tracks (by ${owner})</p>`;
        });
        container.innerHTML = lines.join("");
    } catch (err) {
        console.error("playlists failed:", err);
        container.innerHTML = `<p class="placeholder-text">Failed to load playlists.</p>`;
    }
}

/* ------------ Passport ------------ */

function mapCountryToRegion(countryNameRaw) {
    if (!countryNameRaw) return "Unknown";
    const key = countryNameRaw.trim();

    if (COUNTRY_TO_TUNIVERSE_REGION[key]) {
        return COUNTRY_TO_TUNIVERSE_REGION[key];
    }
    const upper = key.toUpperCase();
    if (COUNTRY_TO_TUNIVERSE_REGION[upper]) {
        return COUNTRY_TO_TUNIVERSE_REGION[upper];
    }
    return "Unknown";
}

async function loadPassportCountries() {
    const token = getAccessToken();
    if (!token) {
        alert("No Spotify access token yet.");
        return;
    }

    const countriesBox = $("countriesList");
    if (countriesBox) {
        countriesBox.innerHTML = `<p class="placeholder-text">Loading passport snapshot…</p>`;
    }

    const passportUrl = `${API_BASE}/passport/from_token?access_token=${encodeURIComponent(token)}&limit=8`;
    const topArtistsUrl = `${API_BASE}/spotify/top-artists?access_token=${encodeURIComponent(token)}&limit=1`;

    try {
        const [passportRes, topRes] = await Promise.all([
            fetch(passportUrl),
            fetch(topArtistsUrl),
        ]);

        // Handle passport snapshot
        if (!passportRes.ok) {
            const text = await passportRes.text();
            console.error("passport/from_token error:", passportRes.status, text);
            if (countriesBox) {
                countriesBox.innerHTML =
                    `<p class="placeholder-text">Failed to load passport countries.</p>`;
            }
        } else {
            const passportData = await passportRes.json();
            console.log("passport snapshot:", passportData);
            renderPassportCountries(passportData);
            updatePassportStats(passportData);
            cacheArtistsByRegionHtml(passportData);
        }

        // Handle top artist
        const statTop = $("statTopArtist");
        if (topRes.ok) {
            const topData = await topRes.json();
            const items = topData.items || [];
            const first = items[0];
            const name = first && first.name ? first.name : null;
            if (statTop) {
                statTop.textContent = name || "No top artist data";
            }
        } else {
            if (statTop) {
                statTop.textContent = "No top artist data";
            }
        }
    } catch (err) {
        console.error("loadPassportCountries failed:", err);
        if (countriesBox) {
            countriesBox.innerHTML =
                `<p class="placeholder-text">Failed to load passport countries.</p>`;
        }
    }
}

function buildRegionCounts(countryCounts) {
    const regionCounts = {};
    let totalArtists = 0;

    for (const [country, count] of Object.entries(countryCounts)) {
        const c = Number(count) || 0;
        if (!c) continue;
        totalArtists += c;
        const region = mapCountryToRegion(country);
        regionCounts[region] = (regionCounts[region] || 0) + c;
    }
    return { regionCounts, totalArtists };
}

function renderPassportCountries(data) {
    const countriesBox = $("countriesList");
    if (!countriesBox) return;

    const countryCounts = data.country_counts || {};
    const { regionCounts, totalArtists } = buildRegionCounts(countryCounts);
    const numCountries = Object.keys(countryCounts).length;

    if (numCountries === 0) {
        countriesBox.innerHTML = `
            <p class="placeholder-text">No countries inferred yet. Listen to more artists from around the world to fill your passport.</p>
        `;
        const countryCountInput = $("countryCountInput");
        if (countryCountInput) {
            countryCountInput.value = "0";
        }
        lastArtistsByRegionHtml = "";
        return;
    }

    // Sort countries and regions by count (descending)
    const countryItems = Object.entries(countryCounts).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
    const regionItems = Object.entries(regionCounts).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));

    const countryListHtml = countryItems
        .map(([country, count]) => `<li>${country}: ${count} artist(s)</li>`)
        .join("");

    const regionListHtml = regionItems
        .map(([region, count]) => {
            const pct = totalArtists ? ((count / totalArtists) * 100).toFixed(1) : "0.0";
            const iconPath = REGION_ICON_MAP[region] || null;
            const iconHtml = iconPath
                ? `<img src="${iconPath}" alt="${region}" class="region-icon-inline" />`
                : "";
            return `
                <li>
                    ${iconHtml}
                    <span class="region-name">${region}:</span>
                    ${count} artist(s) – ${pct}%
                </li>
            `;
        })
        .join("");

    countriesBox.innerHTML = `
        <div class="passport-summary">
            <div class="passport-summary-main">
                <span class="passport-summary-number">${totalArtists}</span> artist${totalArtists === 1 ? "" : "s"}
                across
                <span class="passport-summary-number">${numCountries}</span>
                countr${numCountries === 1 ? "y" : "ies"}.
            </div>
        </div>
        <div class="passport-columns">
            <div class="passport-column">
                <div class="passport-column-title">By country</div>
                <ul class="passport-list">
                    ${countryListHtml}
                </ul>
            </div>
            <div class="passport-column">
                <div class="passport-column-title">By region</div>
                <ul class="passport-list">
                    ${regionListHtml}
                </ul>
            </div>
        </div>
    `;

    // auto-fill #countries for achievements (based on distinct countries)
    const countryCountInput = $("countryCountInput");
    if (countryCountInput) {
        countryCountInput.value = String(numCountries);
    }
}

// build and cache the "Artists by Region" HTML used in community posts
function cacheArtistsByRegionHtml(data) {
    const countryCounts = data.country_counts || {};
    const { regionCounts, totalArtists } = buildRegionCounts(countryCounts);
    const regionEntries = Object.entries(regionCounts);

    if (!regionEntries.length || totalArtists === 0) {
        lastArtistsByRegionHtml = "";
        return;
    }

    // sort regions by count desc, Unknown last
    const sorted = regionEntries.sort((a, b) => {
        if (a[0] === "Unknown") return 1;
        if (b[0] === "Unknown") return -1;
        return (b[1] ?? 0) - (a[1] ?? 0);
    });

    const chunks = [];

    for (const [region, count] of sorted) {
        const pct = totalArtists ? ((count / totalArtists) * 100).toFixed(1) : "0.0";
        const iconPath = REGION_ICON_MAP[region] || null;
        const iconHtml = iconPath
            ? `<img src="${iconPath}" alt="${region}" class="region-icon-inline" />`
            : "";
        chunks.push(`
            <div class="artists-country-group">
                <div class="artists-country-title">
                    ${iconHtml}<span class="region-name">${region}</span>
                </div>
                <ul class="artists-country-list">
                    <li>${count} artist(s) – ${pct}% of your passport</li>
                </ul>
            </div>
        `);
    }

    lastArtistsByRegionHtml = chunks.join("");
}

function updatePassportStats(data) {
    const totalEl = $("statTotalArtists");
    const favRegionEl = $("statFavRegion");
    const favRegionIcon = $("favRegionIcon");

    if (!totalEl || !favRegionEl || !favRegionIcon) return;

    const countryCounts = data.country_counts || {};
    const { regionCounts, totalArtists } = buildRegionCounts(countryCounts);

    totalEl.textContent = totalArtists;

    // pick favorite region from Tuniverse regionCounts (excluding Unknown)
    let favRegion = "Unknown";
    let bestCount = 0;
    for (const [region, count] of Object.entries(regionCounts)) {
        if (region === "Unknown") continue;
        if (count > bestCount) {
            bestCount = count;
            favRegion = region;
        }
    }
    favRegionEl.textContent = favRegion;

    const iconPath = REGION_ICON_MAP[favRegion] || null;
    if (iconPath) {
        favRegionIcon.src = iconPath;
        favRegionIcon.style.visibility = "visible";
    } else {
        favRegionIcon.src = "";
        favRegionIcon.style.visibility = "hidden";
    }
}

/* ------------ Community ------------ */
async function shareToCommunity() {
    const msgBox = $("communityMessageInput");
    const displayName = $("displayNameInput") ? $("displayNameInput").value.trim() : "";
    const appToken = getAppToken();

    if (!msgBox) return;

    const message = msgBox.value.trim();
    if (!message) {
        alert("Write something to share.");
        return;
    }

    if (!lastArtistsByRegionHtml) {
        alert("Load your passport first so we can share your region breakdown.");
        return;
    }

    const payload = {
        display_name: displayName || "Anonymous traveler",
        message,
        passport_summary: lastArtistsByRegionHtml,
    };

    const headers = { "Content-Type": "application/json" };
    if (appToken) {
        headers["X-App-Token"] = appToken;
    }

    try {
        const res = await fetch(`${API_BASE}/community/share`, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const text = await res.text();
            console.error("community/share error:", res.status, text);
            alert("Failed to share post.");
            return;
        }
        msgBox.value = "";
        loadCommunityFeed();
    } catch (err) {
        console.error("shareToCommunity failed:", err);
        alert("Failed to share post (network error).");
    }
}

async function loadCommunityFeed() {
    const container = $("communityFeed");
    if (!container) return;
    container.innerHTML = `<p class="placeholder-text">Loading community feed…</p>`;

    try {
        const res = await fetch(`${API_BASE}/community/feed`);
        if (!res.ok) {
            const text = await res.text();
            console.error("community/feed error:", res.status, text);
            container.innerHTML =
                `<p class="placeholder-text">Failed to load community feed.</p>`;
            return;
        }
        const data = await res.json();
        const posts = data.posts || data || [];
        if (!posts.length) {
            container.innerHTML =
                `<p class="placeholder-text">No posts yet – be the first to share!</p>`;
            return;
        }

        const html = posts
            .map((p) => {
                const name = p.display_name || "Anonymous traveler";
                const when = p.created_at || "";
                const summaryHtml = p.passport_summary || "";
                const message = p.message || "";
                return `
                <div class="community-post">
                    <div class="community-post-header">
                        <span class="community-name">${name}</span>
                        <span class="community-time">${when}</span>
                    </div>
                    <div class="community-passport-summary">
                        <span class="badge-passport">Passport</span>
                        <div class="community-country">
                            ${summaryHtml}
                        </div>
                    </div>
                    <div class="community-message">${message}</div>
                </div>
            `;
            })
            .join("");

        container.innerHTML = html;
    } catch (err) {
        console.error("loadCommunityFeed failed:", err);
        container.innerHTML =
            `<p class="placeholder-text">Failed to load community feed.</p>`;
    }
}

/* ------------ Achievements ------------ */
function computeAchievements(countryCount) {
    const n = countryCount || 0;
    const list = [];

    if (n >= 1) {
        list.push({
            name: "First Stamp",
            desc: "You’ve visited at least one country with your listening.",
        });
    }
    if (n >= 5) {
        list.push({
            name: "Frequent Flyer",
            desc: "Your tunes have crossed 5+ country borders.",
        });
    }
    if (n >= 10) {
        list.push({
            name: "Globetrotter",
            desc: "10 or more countries – your playlists need a passport of their own.",
        });
    }
    if (n >= 15) {
        list.push({
            name: "Sonic Cartographer",
            desc: "You’re mapping the whole world with music.",
        });
    }
    if (n >= 20) {
        list.push({
            name: "Interstellar DJ",
            desc: "Beyond borders – your listening goes everywhere.",
        });
    }

    if (!list.length) {
        list.push({
            name: "Local Listener",
            desc: "Start exploring artists from other countries to earn more stamps.",
        });
    }

    return list;
}

function loadAchievements() {
    const input = $("countryCountInput");
    const box = $("achievementsList");
    if (!input || !box) return;

    const value = parseInt(input.value, 10);
    const n = Number.isFinite(value) && value >= 0 ? value : 0;

    const stamps = computeAchievements(n);
    const html = stamps
        .map(
            (s) => `
        <div class="achievement-item">
            <strong>${s.name}</strong><br />
            <span>${s.desc}</span>
        </div>
    `
        )
        .join("");

    box.innerHTML = html;
}





