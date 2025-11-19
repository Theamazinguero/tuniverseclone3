// web-ui/app.js

const BACKEND_URL = "http://127.0.0.1:8000";

let lastPassportSnapshot = null;

// -------- helpers --------
function $(id) {
    return document.getElementById(id);
}

function getStored(key) {
    return window.localStorage.getItem(key) || null;
}

function setStored(key, value) {
    if (value == null) return;
    window.localStorage.setItem(key, value);
}

function getAccessToken() {
    const fromInput = $("accessTokenInput").value.trim();
    if (fromInput) return fromInput;
    return getStored("spotify_access_token");
}

// -------- initial hash handling (Spotify callback) --------
function handleHash() {
    if (!window.location.hash) return;
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);

    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const appToken = params.get("app_token");
    const displayName = params.get("display_name");
    const spotifyId = params.get("spotify_id");

    if (accessToken) {
        setStored("spotify_access_token", accessToken);
        $("accessTokenInput").value = accessToken;
    }
    if (refreshToken) setStored("spotify_refresh_token", refreshToken);
    if (appToken) setStored("app_token", appToken);
    if (spotifyId) setStored("spotify_id", spotifyId);

    if (displayName) {
        $("displayNameInput").value = displayName;
        setStored("display_name", displayName);
    }

    if (accessToken) {
        $("authStatus").textContent = "Access token received / loaded.";
    }

    // Clean hash so refreshes look nicer
    window.history.replaceState({}, document.title, window.location.pathname);
}

window.addEventListener("DOMContentLoaded", () => {
    handleHash();

    // Prefill from storage if present
    const savedAccess = getStored("spotify_access_token");
    if (savedAccess && !$("accessTokenInput").value) {
        $("accessTokenInput").value = savedAccess;
        $("authStatus").textContent = "Access token loaded from storage.";
    }

    const savedName = getStored("display_name");
    if (savedName && !$("displayNameInput").value) {
        $("displayNameInput").value = savedName;
    }
});

// -------- AUTH / SPOTIFY --------
function loginWithSpotify() {
    window.location.href = `${BACKEND_URL}/auth/login`;
}

function saveAccessToken() {
    const token = $("accessTokenInput").value.trim();
    if (!token) {
        alert("Paste a Spotify access token first.");
        return;
    }
    setStored("spotify_access_token", token);
    $("authStatus").textContent = "Access token saved.";
}

async function loadCurrentTrack() {
    const token = getAccessToken();
    if (!token) {
        alert("Missing Spotify access token.");
        return;
    }
    $("currentTrackLabel").textContent = "Loading recent track…";

    try {
        const res = await fetch(
            `${BACKEND_URL}/spotify/me?access_token=${encodeURIComponent(token)}`
        );
        if (!res.ok) {
            const txt = await res.text();
            $("currentTrackLabel").textContent = "Failed to load profile / track.";
            console.error("spotify/me error:", txt);
            return;
        }
        const data = await res.json();

        if (data.display_name) {
            $("displayNameInput").value = data.display_name;
            setStored("display_name", data.display_name);
        }

        if (data.now_playing) {
            const np = data.now_playing;
            $("currentTrackLabel").textContent =
                `${np.track_name} — ${np.artist_name} (${np.album_name})`;
        } else {
            $("currentTrackLabel").textContent = "No recent tracks found.";
        }
    } catch (err) {
        console.error(err);
        $("currentTrackLabel").textContent = "Error talking to backend.";
    }
}

// -------- PLAYLISTS --------
async function loadPlaylists() {
    const token = getAccessToken();
    if (!token) {
        alert("Missing Spotify access token.");
        return;
    }
    const listEl = $("playlistsList");
    listEl.innerHTML = `<p class="placeholder-text">Loading playlists…</p>`;

    try {
        const res = await fetch(
            `${BACKEND_URL}/spotify/playlists?access_token=${encodeURIComponent(token)}`
        );
        if (!res.ok) {
            const txt = await res.text();
            listEl.innerHTML = `<p class="placeholder-text">Failed to load playlists.</p>`;
            console.error("playlists error:", txt);
            return;
        }
        const data = await res.json();
        const items = data.items || [];

        if (!items.length) {
            listEl.innerHTML = `<p class="placeholder-text">No playlists found.</p>`;
            return;
        }

        const lines = items.map((pl) => {
            const owner = pl.owner && pl.owner.display_name ? pl.owner.display_name : "Unknown";
            return `<p>${pl.name} — ${pl.tracks?.total ?? 0} tracks (by ${owner})</p>`;
        });
        listEl.innerHTML = lines.join("");
    } catch (err) {
        console.error(err);
        listEl.innerHTML = `<p class="placeholder-text">Error loading playlists.</p>`;
    }
}

// -------- PASSPORT / COUNTRIES / STATS / ARTISTS BY COUNTRY --------
async function loadPassportCountries() {
    const token = getAccessToken();
    if (!token) {
        alert("Missing Spotify access token.");
        return;
    }

    const countriesEl = $("countriesList");
    const artistsEl = $("artistsByCountryList");
    countriesEl.innerHTML = `<p class="placeholder-text">Building passport from top artists…</p>`;
    artistsEl.innerHTML = `<p class="placeholder-text">Loading artists by country…</p>`;

    try {
        const res = await fetch(
            `${BACKEND_URL}/passport/from_token?access_token=${encodeURIComponent(token)}`
        );
        if (!res.ok) {
            const txt = await res.text();
            countriesEl.innerHTML = `<p class="placeholder-text">Failed to load passport.</p>`;
            artistsEl.innerHTML = `<p class="placeholder-text">Failed to load passport.</p>`;
            console.error("passport/from_token error:", txt);
            return;
        }
        const data = await res.json();
        lastPassportSnapshot = data;

        renderPassportCountries(data);
        renderArtistsByCountry(data);
        updatePassportStats(data);

        // Fill # of countries for Achievements auto
        const cc = data.country_counts || {};
        const distinct = Object.keys(cc).length;
        $("countryCountInput").value = String(distinct);
    } catch (err) {
        console.error(err);
        countriesEl.innerHTML = `<p class="placeholder-text">Error loading passport.</p>`;
        artistsEl.innerHTML = `<p class="placeholder-text">Error loading passport.</p>`;
    }
}

function renderPassportCountries(data) {
    const el = $("countriesList");
    const cc = data.country_counts || {};
    const rp = data.region_percentages || {};
    const total = data.total_artists || 0;

    if (!Object.keys(cc).length) {
        el.innerHTML = `<p class="placeholder-text">No artists found for passport snapshot.</p>`;
        return;
    }

    let html = "";
    html += `<p>Passport snapshot: <strong>${total}</strong> artists across <strong>${Object.keys(cc).length}</strong> countries.</p>`;

    html += `<div class="divider soft"></div>`;
    html += `<p><strong>Countries:</strong></p>`;
    for (const [country, count] of Object.entries(cc)) {
        html += `<p>${country}: ${count} artist(s)</p>`;
    }

    html += `<div class="divider soft"></div>`;
    html += `<p><strong>By region:</strong></p>`;
    if (!Object.keys(rp).length) {
        html += `<p>Region data not available.</p>`;
    } else {
        for (const [region, frac] of Object.entries(rp)) {
            const pct = (frac * 100).toFixed(1);
            html += `<p>${region}: ${pct}%</p>`;
        }
    }

    el.innerHTML = html;
}

function renderArtistsByCountry(data) {
    const el = $("artistsByCountryList");
    const map = data.artists_by_country || {};

    if (!Object.keys(map).length) {
        el.innerHTML = `<p class="placeholder-text">No artist details returned.</p>`;
        return;
    }

    let html = "";
    for (const [country, artists] of Object.entries(map)) {
        html += `<div class="artists-country-group">`;
        html += `<div class="artists-country-title">${country}</div>`;
        html += `<ul class="artists-country-list">`;
        for (const name of artists) {
            html += `<li>${name}</li>`;
        }
        html += `</ul></div>`;
    }
    el.innerHTML = html;
}

function updatePassportStats(data) {
    const totalArtists = data.total_artists || 0;
    $("statTotalArtists").textContent = String(totalArtists);

    // Top artist (Spotify orders by "most listened")
    let topArtist = "—";
    if (Array.isArray(data.top_artists) && data.top_artists.length > 0) {
        topArtist = data.top_artists[0];
    }
    $("statTopArtist").textContent = topArtist;

    // Favorite region (max region_percentages)
    const rp = data.region_percentages || {};
    let favRegion = "—";
    let maxVal = 0;
    for (const [region, value] of Object.entries(rp)) {
        if (value > maxVal) {
            maxVal = value;
            favRegion = region;
        }
    }
    if (favRegion === "Unknown") {
        favRegion = "Mixed / Unknown";
    }
    $("statFavRegion").textContent = favRegion;
}

// -------- ACHIEVEMENTS --------
function loadAchievements() {
    const el = $("achievementsList");
    const raw = $("countryCountInput").value.trim();
    const n = raw ? parseInt(raw, 10) : 0;

    if (!n || n <= 0) {
        el.innerHTML = `<p class="placeholder-text">No countries yet – explore more music to unlock stamps!</p>`;
        return;
    }

    const items = [];

    if (n >= 1) {
        items.push({
            name: "First Stamp",
            desc: "You’ve visited your first musical country.",
        });
    }
    if (n >= 3) {
        items.push({
            name: "Regional Explorer",
            desc: "You’re starting to hop between regions.",
        });
    }
    if (n >= 5) {
        items.push({
            name: "Frequent Flyer",
            desc: "Your passport is filling up fast.",
        });
    }
    if (n >= 10) {
        items.push({
            name: "Globe Trotter",
            desc: "Double-digit country count achieved.",
        });
    }
    if (n >= 15) {
        items.push({
            name: "Cosmic Voyager",
            desc: "You’re basically orbiting the Tuniverse.",
        });
    }

    let html = "";
    for (const it of items) {
        html += `<div class="achievement-item"><strong>${it.name}</strong><br/><span>${it.desc}</span></div>`;
    }
    el.innerHTML = html;
}

// -------- COMMUNITY --------
async function shareToCommunity() {
    const feedEl = $("communityFeed");
    const message = $("communityMessageInput").value.trim();
    const displayName = $("displayNameInput").value.trim() || "Anonymous Voyager";
    const appToken = getStored("app_token");
    const snapshot = lastPassportSnapshot;

    if (!appToken) {
        alert("No app token found. Log in with Spotify first so the backend can know who you are.");
        return;
    }

    if (!snapshot) {
        alert("Load your passport first so we can attach it to the post.");
        return;
    }

    if (!message) {
        alert("Write a short message for the community.");
        return;
    }

    const payload = {
        app_token: appToken,
        display_name: displayName,
        message: message,
        passport: {
            country_counts: snapshot.country_counts || {},
            region_percentages: snapshot.region_percentages || {},
            total_artists: snapshot.total_artists || 0,
        },
    };

    try {
        const res = await fetch(`${BACKEND_URL}/community/share`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const txt = await res.text();
            console.error("community/share error:", txt);
            alert("Failed to share to community.");
            return;
        }
        $("communityMessageInput").value = "";
        await loadCommunityFeed();
    } catch (err) {
        console.error(err);
        alert("Error talking to community backend.");
        feedEl.innerHTML = `<p class="placeholder-text">Error posting to community.</p>`;
    }
}

async function loadCommunityFeed() {
    const feedEl = $("communityFeed");
    feedEl.innerHTML = `<p class="placeholder-text">Loading community feed…</p>`;

    try {
        const res = await fetch(`${BACKEND_URL}/community/feed`);
        if (!res.ok) {
            const txt = await res.text();
            console.error("community/feed error:", txt);
            feedEl.innerHTML = `<p class="placeholder-text">Failed to load feed.</p>`;
            return;
        }
        const data = await res.json();
        const posts = data.posts || data || [];

        if (!posts.length) {
            feedEl.innerHTML = `<p class="placeholder-text">No posts yet. Share your first passport!</p>`;
            return;
        }

        let html = "";
        for (const p of posts) {
            const name = p.display_name || "Anonymous";
            const msg = p.message || "";
            const created = p.created_at || "";
            const total = p.passport?.total_artists ?? null;
            const countryCounts = p.passport?.country_counts || {};
            const regions = p.passport?.region_percentages || {};

            let summary = "";
            const distinct = Object.keys(countryCounts).length;
            if (total != null) {
                summary = `${total} artist(s) across ${distinct} countries.`;
            } else {
                summary = `${distinct} countries.`;
            }

            let favRegion = "";
            let maxVal = 0;
            for (const [region, value] of Object.entries(regions)) {
                if (value > maxVal) {
                    maxVal = value;
                    favRegion = region;
                }
            }
            if (favRegion) {
                summary += ` Favorite region: ${favRegion}.`;
            }

            html += `
              <div class="community-post">
                <div class="community-post-header">
                  <span class="community-name">${name}</span>
                  <span class="community-time">${created}</span>
                </div>
                <div class="community-passport-summary">
                  <span class="badge-passport">Passport</span> ${summary}
                </div>
                <div class="community-message">${msg}</div>
              </div>
            `;
        }
        feedEl.innerHTML = html;
    } catch (err) {
        console.error(err);
        feedEl.innerHTML = `<p class="placeholder-text">Error loading community feed.</p>`;
    }
}
