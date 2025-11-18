const BACKEND_BASE = "http://127.0.0.1:8000";

let accessToken = null;
let currentTrack = null;

// ---------------- TOKEN HANDLING ----------------

// Get token from URL (query or hash), or from localStorage
function initAuth() {
    const authStatus = document.getElementById("authStatus");

    // 1) Look in URL fragment: #access_token=...
    const hash = window.location.hash;
    let tokenFromUrl = null;
    if (hash && hash.includes("access_token=")) {
        const params = new URLSearchParams(hash.substring(1)); // strip '#'
        tokenFromUrl = params.get("access_token");
    }

    // 2) Look in query string: ?access_token=...
    if (!tokenFromUrl) {
        const qs = new URLSearchParams(window.location.search);
        tokenFromUrl = qs.get("access_token");
    }

    if (tokenFromUrl) {
        accessToken = tokenFromUrl;
        localStorage.setItem("spotify_access_token", accessToken);
        authStatus.textContent = "Access token received from redirect.";
        // Clean the URL so token isn't sitting there forever
        window.history.replaceState({}, document.title, window.location.pathname);
    } else {
        // 3) Fall back to localStorage
        const stored = localStorage.getItem("spotify_access_token");
        if (stored) {
            accessToken = stored;
            authStatus.textContent = "Using stored access token.";
        } else {
            authStatus.textContent = "Not logged in yet.";
        }
    }

    // Reflect token into the input for debugging
    if (accessToken) {
        const input = document.getElementById("accessTokenInput");
        if (input) input.value = accessToken;
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
    // This hits FastAPI /auth/login from spotify_auth.py
    window.location.href = `${BACKEND_BASE}/auth/login`;
}

// ---------------- LOAD CURRENT TRACK ----------------

async function loadCurrentTrack() {
    if (!accessToken) {
        alert("You must login with Spotify or paste/save a token first.");
        return;
    }

    // Use /spotify/me and give BOTH:
    //  - query param: access_token=...
    //  - header: Authorization: Bearer ...
    // so it works whether the backend expects a query or a header.
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
        alert("Failed to load profile / current track from backend.");
        return;
    }

    const data = await res.json();

    // spotify_auth.py returns:
    // { display_name, id, now_playing, raw_profile }
    // but if your other spotify router returns a different shape, we handle both.
    const nowPlaying = data.now_playing || data.current_track || null;

    if (!nowPlaying) {
        document.getElementById("currentTrackLabel").textContent =
            "Nothing is currently playing.";
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

// ---------------- SHARE TO COMMUNITY ----------------

async function shareToCommunity() {
    if (!currentTrack) {
        alert("Load current track first.");
        return;
    }

    const displayName = document.getElementById("displayNameInput").value.trim() || "Anonymous";
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
    const displayName = document.getElementById("displayNameInput").value.trim() || "Anonymous";
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

