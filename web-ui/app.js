const BACKEND_BASE = "http://127.0.0.1:8000";

let accessToken = null;
let appToken = null;
let spotifyId = null;
let currentTrack = null;

// ---------------- TOKEN HANDLING ----------------

function initAuth() {
    const authStatus = document.getElementById("authStatus");

    const hash = window.location.hash;
    let paramsFromHash = null;
    if (hash && hash.length > 1) {
        paramsFromHash = new URLSearchParams(hash.substring(1));
    }

    const qs = new URLSearchParams(window.location.search);

    function getFromHashOrQuery(name) {
        if (paramsFromHash && paramsFromHash.has(name)) {
            return paramsFromHash.get(name);
        }
        if (qs.has(name)) {
            return qs.get(name);
        }
        return null;
    }

    const tokenFromUrl = getFromHashOrQuery("access_token");
    const appTokenFromUrl = getFromHashOrQuery("app_token");
    const displayNameFromUrl = getFromHashOrQuery("display_name");
    const spotifyIdFromUrl = getFromHashOrQuery("spotify_id");

    if (tokenFromUrl) {
        accessToken = tokenFromUrl;
        localStorage.setItem("spotify_access_token", accessToken);
    } else {
        const stored = localStorage.getItem("spotify_access_token");
        if (stored) accessToken = stored;
    }

    if (appTokenFromUrl) {
        appToken = appTokenFromUrl;
        localStorage.setItem("tuniverse_app_token", appToken);
    } else {
        const storedApp = localStorage.getItem("tuniverse_app_token");
        if (storedApp) appToken = storedApp;
    }

    if (spotifyIdFromUrl) {
        spotifyId = spotifyIdFromUrl;
        localStorage.setItem("tuniverse_spotify_id", spotifyId);
    } else {
        const storedSpotifyId = localStorage.getItem("tuniverse_spotify_id");
        if (storedSpotifyId) spotifyId = storedSpotifyId;
    }

    const displayInput = document.getElementById("displayNameInput");
    if (displayNameFromUrl) {
        if (displayInput) displayInput.value = displayNameFromUrl;
        localStorage.setItem("tuniverse_display_name", displayNameFromUrl);
    } else {
        const storedName = localStorage.getItem("tuniverse_display_name");
        if (storedName && displayInput) displayInput.value = storedName;
    }

    // Clean URL after parsing hash
    if (paramsFromHash) {
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (accessToken) {
        authStatus.textContent = "Access token received / loaded.";
        const input = document.getElementById("accessTokenInput");
        if (input) input.value = accessToken;
    } else {
        authStatus.textContent = "Not logged in yet.";
    }
}

function saveAccessToken() {
    const input = document.getElementById("accessTokenInput");
    const token = input.value.trim();
    if (!token) {
        alert("Paste a token first.");
        return;
    }
    accessToken = token;
    localStorage.setItem("spotify_access_token", token);
    document.getElementById("authStatus").textContent = "Token saved to localStorage.";
}

// ---------------- SPOTIFY AUTH ----------------

function loginWithSpotify() {
    window.location.href = `${BACKEND_BASE}/auth/login`;
}

// ---------------- LOAD RECENT TRACK ----------------

async function loadCurrentTrack() {
    if (!accessToken) {
        alert("You must login with Spotify or paste/save a token first.");
        return;
    }

    const url = `${BACKEND_BASE}/spotify/me?access_token=${encodeURIComponent(
        accessToken
    )}`;

    const res = await fetch(url, {
        headers: {
            "Authorization": `Bearer ${accessToken}`
        }
    });

    if (!res.ok) {
        const txt = await res.text();
        console.error("Error from /spotify/me:", txt);
        alert("Failed to load profile / recent track from backend.");
        return;
    }

    const data = await res.json();

    const nowPlaying = data.now_playing || data.current_track || null;

    if (!nowPlaying) {
        document.getElementById("currentTrackLabel").textContent =
            "No recent tracks found.";
        currentTrack = null;
        return;
    }

    currentTrack = {
        track_name: nowPlaying.track_name || nowPlaying.name || "Unknown track",
        artist_name: nowPlaying.artist_name || nowPlaying.artist || "Unknown artist",
        album_name: nowPlaying.album_name || nowPlaying.album || "Unknown album",
        album_image_url: nowPlaying.album_image_url || null
    };

    document.getElementById("currentTrackLabel").textContent =
        `${currentTrack.track_name} — ${currentTrack.artist_name}`;
}

// ---------------- PASSPORT COUNTRIES ----------------

async function loadPassportCountries() {
    const container = document.getElementById("countriesList");
    container.innerHTML = "";

    const token = appToken || localStorage.getItem("tuniverse_app_token");
    if (!token) {
        container.innerHTML = "<p>No app token; make sure you logged in via Spotify in this app.</p>";
        return;
    }

    // Assume backend route: GET /passport/from_token/{app_token}
    const url = `${BACKEND_BASE}/passport/from_token/${encodeURIComponent(token)}`;

    const res = await fetch(url);

    if (!res.ok) {
        const txt = await res.text();
        console.error("Error from /passport/from_token:", txt);
        container.innerHTML = "<p>Failed to load passport countries.</p>";
        return;
    }

    const data = await res.json();

    let countries = [];
    if (Array.isArray(data)) {
        countries = data;
    } else if (Array.isArray(data.countries)) {
        countries = data.countries;
    } else if (Array.isArray(data.passport)) {
        countries = data.passport;
    }

    if (!countries.length) {
        container.innerHTML = "<p>No passport countries found.</p>";
        return;
    }

    const ul = document.createElement("ul");

    countries.forEach(c => {
        const li = document.createElement("li");
        const code = c.code || c.country_code || "";
        const name = c.name || c.country_name || code || JSON.stringify(c);
        const visits = c.visit_count || c.count || "";
        li.textContent = visits
            ? `${name} (${visits} visits)`
            : name;
        ul.appendChild(li);
    });

    container.appendChild(ul);
}

// ---------------- PLAYLISTS ----------------

async function loadPlaylists() {
    const container = document.getElementById("playlistsList");
    container.innerHTML = "";

    if (!accessToken) {
        container.innerHTML = "<p>You must login with Spotify first.</p>";
        return;
    }

    const url = `${BACKEND_BASE}/spotify/playlists?access_token=${encodeURIComponent(
        accessToken
    )}`;

    const res = await fetch(url, {
        headers: {
            "Authorization": `Bearer ${accessToken}`
        }
    });

    if (!res.ok) {
        const txt = await res.text();
        console.error("Error from /spotify/playlists:", txt);
        container.innerHTML = "<p>Failed to load playlists.</p>";
        return;
    }

    const data = await res.json();

    let items = [];
    if (Array.isArray(data)) {
        items = data;
    } else if (Array.isArray(data.items)) {
        items = data.items;
    }

    if (!items.length) {
        container.innerHTML = "<p>No playlists found.</p>";
        return;
    }

    const ul = document.createElement("ul");

    items.forEach(p => {
        const li = document.createElement("li");
        const name = p.name || "Unnamed playlist";
        const owner = (p.owner && p.owner.display_name) || "";
        const tracks = (p.tracks && p.tracks.total) || 0;
        li.textContent = owner
            ? `${name} — ${tracks} tracks (by ${owner})`
            : `${name} — ${tracks} tracks`;
        ul.appendChild(li);
    });

    container.appendChild(ul);
}

// ---------------- SHARE TO COMMUNITY ----------------

async function shareToCommunity() {
    if (!currentTrack) {
        alert("Load current (recent) track first.");
        return;
    }

    const displayName = document.getElementById("displayNameInput").value.trim()
        || localStorage.getItem("tuniverse_display_name")
        || "Anonymous";

    const message = document.getElementById("communityMessageInput").value.trim();

    const payload = {
        display_name: displayName,
        track_name: currentTrack.track_name,
        artist_name: currentTrack.artist_name,
        album_name: currentTrack.album_name,
        album_image_url: currentTrack.album_image_url,
        message: message
    };

    const res = await fetch(`${BACKEND_BASE}/community/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const txt = await res.text();
        console.error("Error from /community/share:", txt);
        alert("Failed to share to community.");
        return;
    }

    await loadCommunityFeed();
}

// ---------------- COMMUNITY FEED ----------------

async function loadCommunityFeed() {
    const res = await fetch(`${BACKEND_BASE}/community/feed`);

    if (!res.ok) {
        const txt = await res.text();
        console.error("Error from /community/feed:", txt);
        alert("Failed to load community feed.");
        return;
    }

    const posts = await res.json();
    const container = document.getElementById("communityFeed");
    container.innerHTML = "";

    if (!posts.length) {
        container.innerHTML = "<p>No posts yet.</p>";
        return;
    }

    posts.forEach(post => {
        const div = document.createElement("div");
        div.innerHTML = `
            <p><strong>${post.display_name}</strong> — ${post.track_name} (${post.artist_name})</p>
            <p>${post.message || ""}</p>
            <hr>
        `;
        container.appendChild(div);
    });
}

// ---------------- ACHIEVEMENTS ----------------

async function loadAchievements() {
    const displayName = document.getElementById("displayNameInput").value.trim()
        || localStorage.getItem("tuniverse_display_name")
        || "Anonymous";

    const countryCount = parseInt(document.getElementById("countryCountInput").value) || 0;

    const res = await fetch(`${BACKEND_BASE}/community/achievements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            display_name: displayName,
            country_count: countryCount
        })
    });

    if (!res.ok) {
        const txt = await res.text();
        console.error("Error from /community/achievements:", txt);
        alert("Failed to load achievements.");
        return;
    }

    const achievements = await res.json();

    const container = document.getElementById("achievementsList");
    container.innerHTML = "";

    if (!achievements.length) {
        container.innerHTML = "<p>No achievements defined.</p>";
        return;
    }

    achievements.forEach(a => {
        const div = document.createElement("div");
        div.innerHTML = `
            <p>${a.unlocked ? "✅" : "🔒"} <strong>${a.name}</strong><br>
            ${a.description}</p>
            <hr>
        `;
        container.appendChild(div);
    });
}

// ---------------- INIT ----------------

window.addEventListener("DOMContentLoaded", () => {
    initAuth();
    loadCommunityFeed().catch(console.error);
});



