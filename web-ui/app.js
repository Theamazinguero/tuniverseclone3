// web-ui/app.js

const BACKEND_BASE = "http://127.0.0.1:8000";

let accessToken = null;          // Spotify access token
let appToken = null;             // Tuniverse app token (JWT from backend)
let spotifyDisplayName = "";     // From Spotify profile / redirect
let lastPassportSnapshot = null; // JSON from /passport/from_token

// ---------- Helpers ----------

function $(id) {
    return document.getElementById(id);
}

function setStatus(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
}

function readAccessTokenFromUI() {
    const val = $("accessTokenInput")?.value?.trim();
    return val || null;
}

// Parse hash fragment from /auth/callback redirect
function parseHashFragment() {
    if (!window.location.hash) return {};
    const hash = window.location.hash.substring(1); // remove #
    const params = new URLSearchParams(hash);
    const obj = {};
    for (const [k, v] of params.entries()) {
        obj[k] = v;
    }
    return obj;
}

// Store tokens in localStorage (basic dev convenience)
function saveTokensToStorage() {
    if (accessToken) {
        localStorage.setItem("tuniverse_access_token", accessToken);
    }
    if (appToken) {
        localStorage.setItem("tuniverse_app_token", appToken);
    }
    if (spotifyDisplayName) {
        localStorage.setItem("tuniverse_display_name", spotifyDisplayName);
    }
}

function loadTokensFromStorage() {
    const at = localStorage.getItem("tuniverse_access_token");
    const jt = localStorage.getItem("tuniverse_app_token");
    const dn = localStorage.getItem("tuniverse_display_name");
    if (at) accessToken = at;
    if (jt) appToken = jt;
    if (dn) spotifyDisplayName = dn;
}

// ---------- Auth / Spotify ----------

function loginWithSpotify() {
    // Backend spotify_auth.py has /auth/login that handles redirect to Spotify
    window.location.href = `${BACKEND_BASE}/auth/login`;
}

function saveAccessToken() {
    const val = readAccessTokenFromUI();
    if (!val) {
        alert("Paste a Spotify access token first.");
        return;
    }
    accessToken = val;
    saveTokensToStorage();
    setStatus("authStatus", "Access token saved.");
}

async function loadCurrentTrack() {
    if (!accessToken) {
        accessToken = readAccessTokenFromUI();
    }
    if (!accessToken) {
        alert("Need a Spotify access token. Login or paste one.");
        return;
    }

    setStatus("currentTrackLabel", "Loading recent track…");

    try {
        const res = await fetch(
            `${BACKEND_BASE}/spotify/me?access_token=` + encodeURIComponent(accessToken)
        );
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.error("spotify/me error", err);
            setStatus("currentTrackLabel", "Failed to load recent track.");
            return;
        }
        const data = await res.json();
        // In our backend, we return a profile + possibly now_playing / recently played
        const np = data.now_playing;
        if (!np) {
            setStatus("currentTrackLabel", "No recent tracks found.");
            return;
        }

        const label = `${np.track_name} — ${np.artist_name}`;
        setStatus("currentTrackLabel", label);

        // Pre-fill display name if we got it
        if (data.display_name) {
            spotifyDisplayName = data.display_name;
            const dnInput = $("displayNameInput");
            if (dnInput && !dnInput.value) {
                dnInput.value = spotifyDisplayName;
            }
            saveTokensToStorage();
        }
    } catch (e) {
        console.error(e);
        setStatus("currentTrackLabel", "Error talking to backend.");
    }
}

async function loadPlaylists() {
    if (!accessToken) {
        accessToken = readAccessTokenFromUI();
    }
    if (!accessToken) {
        alert("Need a Spotify access token. Login or paste one.");
        return;
    }

    const list = $("playlistsList");
    if (list) list.textContent = "Loading playlists…";

    try {
        const res = await fetch(
            `${BACKEND_BASE}/spotify/playlists?access_token=` +
            encodeURIComponent(accessToken)
        );
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.error("playlists error", err);
            if (list) list.textContent = "Failed to load playlists.";
            return;
        }
        const data = await res.json();
        const items = data.items || [];

        if (!items.length) {
            if (list) list.textContent = "No playlists found.";
            return;
        }

        const lines = items.map(pl => {
            const name = pl.name || "(no name)";
            const tracks = pl.tracks?.total ?? 0;
            const owner = pl.owner?.display_name || "unknown";
            return `${name} — ${tracks} tracks (by ${owner})`;
        });

        if (list) {
            list.innerHTML = "";
            lines.forEach(line => {
                const p = document.createElement("p");
                p.textContent = line;
                list.appendChild(p);
            });
        }
    } catch (e) {
        console.error(e);
        if (list) list.textContent = "Error talking to backend.";
    }
}

// ---------- Passport (countries) ----------

async function loadPassportCountries() {
    if (!accessToken) {
        accessToken = readAccessTokenFromUI();
    }
    if (!accessToken) {
        alert("Need a Spotify access token. Login or paste one.");
        return;
    }

    const box = $("countriesList");
    if (box) {
        box.textContent = "Loading passport countries…";
    }

    try {
        const url =
            `${BACKEND_BASE}/passport/from_token?` +
            `access_token=${encodeURIComponent(accessToken)}`;

        const res = await fetch(url);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.error("passport/from_token error", err);
            if (box) box.textContent = "Failed to load passport countries.";
            return;
        }

        const data = await res.json();
        lastPassportSnapshot = data; // <-- store for community sharing & achievements

        const countryCounts = data.country_counts || {};
        const regionPercentages = data.region_percentages || {};
        const totalArtists = data.total_artists || 0;

        if (box) {
            box.innerHTML = "";

            const summary = document.createElement("p");
            const numCountries = Object.keys(countryCounts).length;
            summary.textContent = `Total artists considered: ${totalArtists}, across ${numCountries} countries.`;
            box.appendChild(summary);

            const ulCountries = document.createElement("ul");
            Object.entries(countryCounts)
                .sort((a, b) => b[1] - a[1])
                .forEach(([country, count]) => {
                    const li = document.createElement("li");
                    li.textContent = `${country}: ${count} artist(s)`;
                    ulCountries.appendChild(li);
                });
            box.appendChild(ulCountries);

            const regTitle = document.createElement("p");
            regTitle.textContent = "By region:";
            box.appendChild(regTitle);

            const ulRegions = document.createElement("ul");
            Object.entries(regionPercentages)
                .sort((a, b) => b[1] - a[1])
                .forEach(([region, pct]) => {
                    const li = document.createElement("li");
                    li.textContent = `${region}: ${(pct * 100).toFixed(1)}%`;
                    ulRegions.appendChild(li);
                });
            box.appendChild(ulRegions);
        }

        // Also gently update achievements input if empty
        const numCountries = Object.keys(countryCounts).length;
        const ccInput = $("countryCountInput");
        if (ccInput && !ccInput.value) {
            ccInput.value = String(numCountries);
        }

    } catch (e) {
        console.error(e);
        if (box) box.textContent = "Error talking to backend.";
    }
}

// ---------- Achievements (simple, based on country count) ----------

function buildAchievementsFromCountryCount(cnt) {
    const achievements = [];

    if (cnt >= 1) {
        achievements.push({
            id: "stamp_first_country",
            label: "First Stamp",
            desc: "Visited at least 1 country with your listening.",
        });
    }
    if (cnt >= 3) {
        achievements.push({
            id: "stamp_traveler",
            label: "Frequent Flyer",
            desc: "Listening spans at least 3 countries.",
        });
    }
    if (cnt >= 5) {
        achievements.push({
            id: "stamp_globetrotter",
            label: "World Tour",
            desc: "Music passport has 5+ countries.",
        });
    }
    if (cnt >= 8) {
        achievements.push({
            id: "stamp_supernova",
            label: "Orbit Breaker",
            desc: "8+ countries. Your ears are everywhere.",
        });
    }

    if (achievements.length === 0) {
        achievements.push({
            id: "stamp_seedling",
            label: "Local Listener",
            desc: "So far your listening is focused on just one place. New stamps await.",
        });
    }

    return achievements;
}

function loadAchievements() {
    let cnt = 0;

    const ccInput = $("countryCountInput");
    if (ccInput && ccInput.value) {
        cnt = parseInt(ccInput.value, 10) || 0;
    } else if (lastPassportSnapshot && lastPassportSnapshot.country_counts) {
        cnt = Object.keys(lastPassportSnapshot.country_counts).length;
    }

    const box = $("achievementsList");
    if (!box) return;

    box.innerHTML = "";

    const list = buildAchievementsFromCountryCount(cnt);
    list.forEach(a => {
        const div = document.createElement("div");
        div.className = "achievement-item";
        div.innerHTML = `<strong>${a.label}</strong><br><span>${a.desc}</span>`;
        box.appendChild(div);
    });
}

// ---------- Community (now based on Passport, not last track) ----------

async function shareToCommunity() {
    const dnInput = $("displayNameInput");
    const msgInput = $("communityMessageInput");

    const displayName = dnInput?.value?.trim() || spotifyDisplayName || "Anonymous Astronaut";
    const message = msgInput?.value?.trim() || "";

    if (!lastPassportSnapshot || !lastPassportSnapshot.country_counts) {
        alert("Load your Passport countries first (click 'Load Countries') before sharing.");
        return;
    }

    const countryCounts = lastPassportSnapshot.country_counts || {};
    const totalArtists = lastPassportSnapshot.total_artists || 0;
    const entries = Object.entries(countryCounts);
    const numCountries = entries.length;

    // Build human-friendly summary from passport
    const topCountries = entries
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([c, n]) => `${c} (${n})`)
        .join(", ");

    const track_name = `Passport: ${numCountries} countries from ${totalArtists} artists`;
    const artist_name = topCountries || "No countries detected yet";

    // Choose a "primary country" for backend's country field: highest count or Unknown
    let primaryCountry = "Unknown";
    if (entries.length > 0) {
        primaryCountry = entries.sort((a, b) => b[1] - a[1])[0][0];
    }

    const payload = {
        display_name: displayName,
        message: message || "Shared my music passport.",
        track_name: track_name,     // repurposed for passport summary title
        artist_name: artist_name,   // repurposed for top countries summary
        country: primaryCountry,    // used for simple filtering/grouping on backend
    };

    try {
        const res = await fetch(`${BACKEND_BASE}/community/share`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.error("community/share error", err);
            alert("Failed to share to community.");
            return;
        }

        // Clear message box a bit and refresh feed
        if (msgInput) {
            msgInput.value = "";
        }
        loadCommunityFeed();
    } catch (e) {
        console.error(e);
        alert("Error talking to backend while sharing.");
    }
}

async function loadCommunityFeed() {
    const box = $("communityFeed");
    if (!box) return;
    box.textContent = "Loading community feed…";

    try {
        const res = await fetch(`${BACKEND_BASE}/community/feed`);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.error("community/feed error", err);
            box.textContent = "Failed to load feed.";
            return;
        }

        const posts = await res.json();
        if (!Array.isArray(posts) || posts.length === 0) {
            box.textContent = "No posts yet.";
            return;
        }

        // Newest first (assuming backend already sorts, but we can enforce)
        posts.sort((a, b) => {
            const ta = new Date(a.created_at || 0).getTime();
            const tb = new Date(b.created_at || 0).getTime();
            return tb - ta;
        });

        box.innerHTML = "";
        posts.forEach(p => {
            const div = document.createElement("div");
            div.className = "community-post";

            const dn = p.display_name || "Anonymous";
            const msg = p.message || "";
            const tn = p.track_name || "";   // now passport summary title
            const an = p.artist_name || "";  // now top-countries summary
            const when = p.created_at || "";

            div.innerHTML = `
                <div class="community-post-header">
                    <span class="community-name">${dn}</span>
                    <span class="community-time">${when}</span>
                </div>
                <div class="community-passport-summary">
                    <strong>${tn}</strong><br>
                    <span>${an}</span>
                </div>
                ${msg ? `<div class="community-message">${msg}</div>` : ""}
            `;
            box.appendChild(div);
        });
    } catch (e) {
        console.error(e);
        box.textContent = "Error talking to backend.";
    }
}

// ---------- Bootstrap on page load ----------

document.addEventListener("DOMContentLoaded", () => {
    // 1) parse redirect hash from /auth/callback, if present
    const hashData = parseHashFragment();
    if (hashData.access_token) {
        accessToken = hashData.access_token;
    }
    if (hashData.app_token) {
        appToken = hashData.app_token;
    }
    if (hashData.display_name) {
        spotifyDisplayName = decodeURIComponent(hashData.display_name);
    }

    // 2) also load from localStorage as fallback
    loadTokensFromStorage();

    // 3) Reflect tokens in UI
    if (accessToken) {
        setStatus("authStatus", "Access token received / loaded.");
        const atInput = $("accessTokenInput");
        if (atInput && !atInput.value) {
            atInput.value = accessToken;
        }
    } else {
        setStatus("authStatus", "Not logged in yet.");
    }

    if (spotifyDisplayName) {
        const dnInput = $("displayNameInput");
        if (dnInput && !dnInput.value) {
            dnInput.value = spotifyDisplayName;
        }
    }

    // Clean hash from URL so it doesn't clutter
    if (window.location.hash) {
        history.replaceState(null, "", window.location.pathname + window.location.search);
    }

    // Feed visible panel defaults set up in index.html script
    // No automatic network calls here; user clicks buttons to load.
});

