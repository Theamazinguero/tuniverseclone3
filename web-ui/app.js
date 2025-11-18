// web-ui/app.js

// ----------------- CONFIG -----------------
const BACKEND_BASE = "http://127.0.0.1:8000";

// ----------------- GLOBAL STATE -----------------
var accessToken = null;          // Spotify access token
var appToken = null;             // Tuniverse app token (JWT)
var spotifyDisplayName = "";     // From Spotify profile / redirect
var lastPassportSnapshot = null; // JSON from /passport/from_token

// ----------------- SMALL HELPERS -----------------
function $(id) {
    return document.getElementById(id);
}

function setStatus(id, text) {
    var el = $(id);
    if (el) {
        el.textContent = text;
    }
}

function readAccessTokenFromUI() {
    var el = $("accessTokenInput");
    if (!el) return null;
    var val = (el.value || "").trim();
    return val || null;
}

function parseHashFragment() {
    if (!window.location.hash) return {};
    var hash = window.location.hash.substring(1); // remove #
    var params = new URLSearchParams(hash);
    var obj = {};
    params.forEach(function (v, k) {
        obj[k] = v;
    });
    return obj;
}

function saveTokensToStorage() {
    try {
        if (accessToken) {
            localStorage.setItem("tuniverse_access_token", accessToken);
        }
        if (appToken) {
            localStorage.setItem("tuniverse_app_token", appToken);
        }
        if (spotifyDisplayName) {
            localStorage.setItem("tuniverse_display_name", spotifyDisplayName);
        }
    } catch (e) {
        console.log("localStorage write failed (okay in private mode)", e);
    }
}

function loadTokensFromStorage() {
    try {
        var at = localStorage.getItem("tuniverse_access_token");
        var jt = localStorage.getItem("tuniverse_app_token");
        var dn = localStorage.getItem("tuniverse_display_name");
        if (at) accessToken = at;
        if (jt) appToken = jt;
        if (dn) spotifyDisplayName = dn;
    } catch (e) {
        console.log("localStorage read failed", e);
    }
}

// ----------------- AUTH / SPOTIFY -----------------
function loginWithSpotify() {
    // Simple redirect to backend OAuth entrypoint
    window.location.href = BACKEND_BASE + "/auth/login";
}

function saveAccessToken() {
    var val = readAccessTokenFromUI();
    if (!val) {
        alert("Paste a Spotify access token first.");
        return;
    }
    accessToken = val;
    saveTokensToStorage();
    setStatus("authStatus", "Access token saved.");
}

// Just a debug helper now, not used for community sharing logic
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
        var res = await fetch(
            BACKEND_BASE + "/spotify/me?access_token=" +
            encodeURIComponent(accessToken)
        );
        if (!res.ok) {
            console.error("spotify/me error", await res.text());
            setStatus("currentTrackLabel", "Failed to load recent track.");
            return;
        }
        var data = await res.json();
        var np = data.now_playing;
        if (!np) {
            setStatus("currentTrackLabel", "No recent tracks found.");
            return;
        }

        var label = np.track_name + " — " + np.artist_name;
        setStatus("currentTrackLabel", label);

        if (data.display_name) {
            spotifyDisplayName = data.display_name;
            var dnInput = $("displayNameInput");
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

    var list = $("playlistsList");
    if (list) list.textContent = "Loading playlists…";

    try {
        var res = await fetch(
            BACKEND_BASE + "/spotify/playlists?access_token=" +
            encodeURIComponent(accessToken)
        );
        if (!res.ok) {
            console.error("playlists error", await res.text());
            if (list) list.textContent = "Failed to load playlists.";
            return;
        }
        var data = await res.json();
        var items = data.items || [];

        if (!items.length) {
            if (list) list.textContent = "No playlists found.";
            return;
        }

        if (list) {
            list.innerHTML = "";
            items.forEach(function (pl) {
                var name = pl.name || "(no name)";
                var tracks = pl.tracks && typeof pl.tracks.total === "number"
                    ? pl.tracks.total
                    : 0;
                var owner = pl.owner && pl.owner.display_name
                    ? pl.owner.display_name
                    : "unknown";

                var p = document.createElement("p");
                p.textContent = name + " — " + tracks + " tracks (by " + owner + ")";
                list.appendChild(p);
            });
        }
    } catch (e) {
        console.error(e);
        if (list) list.textContent = "Error talking to backend.";
    }
}

// ----------------- PASSPORT (COUNTRIES) -----------------
async function loadPassportCountries() {
    if (!accessToken) {
        accessToken = readAccessTokenFromUI();
    }
    if (!accessToken) {
        alert("Need a Spotify access token. Login or paste one.");
        return;
    }

    var box = $("countriesList");
    if (box) {
        box.textContent = "Loading passport countries…";
    }

    try {
        var url = BACKEND_BASE +
            "/passport/from_token?access_token=" +
            encodeURIComponent(accessToken);

        var res = await fetch(url);
        if (!res.ok) {
            console.error("passport/from_token error", await res.text());
            lastPassportSnapshot = null;
            if (box) box.textContent = "Failed to load passport countries.";
            return;
        }

        var data = await res.json();
        lastPassportSnapshot = data; // <-- central for community + achievements
        console.log("[Tuniverse] lastPassportSnapshot:", data);

        var countryCounts = data.country_counts || {};
        var regionPercentages = data.region_percentages || {};
        var totalArtists = data.total_artists || 0;
        var countryKeys = Object.keys(countryCounts);
        var numCountries = countryKeys.length;

        if (box) {
            box.innerHTML = "";

            var summary = document.createElement("p");
            summary.textContent =
                "Passport snapshot: " + totalArtists +
                " artists across " + numCountries + " countries.";
            box.appendChild(summary);

            var ulCountries = document.createElement("ul");
            countryKeys
                .sort(function (a, b) { return countryCounts[b] - countryCounts[a]; })
                .forEach(function (country) {
                    var li = document.createElement("li");
                    li.textContent = country + ": " + countryCounts[country] + " artist(s)";
                    ulCountries.appendChild(li);
                });
            box.appendChild(ulCountries);

            var regTitle = document.createElement("p");
            regTitle.textContent = "By region:";
            box.appendChild(regTitle);

            var ulRegions = document.createElement("ul");
            Object.keys(regionPercentages)
                .sort(function (a, b) { return regionPercentages[b] - regionPercentages[a]; })
                .forEach(function (region) {
                    var pct = regionPercentages[region] * 100;
                    var liR = document.createElement("li");
                    liR.textContent = region + ": " + pct.toFixed(1) + "%";
                    ulRegions.appendChild(liR);
                });
            box.appendChild(ulRegions);
        }

        // Seed achievements input if empty
        var ccInput = $("countryCountInput");
        if (ccInput && !ccInput.value) {
            ccInput.value = String(numCountries);
        }

    } catch (e) {
        console.error(e);
        lastPassportSnapshot = null;
        if (box) box.textContent = "Error talking to backend.";
    }
}

// ----------------- ACHIEVEMENTS (BASED ON COUNTRY COUNT) -----------------
function buildAchievementsFromCountryCount(cnt) {
    var achievements = [];

    if (cnt >= 1) {
        achievements.push({
            label: "First Stamp",
            desc: "Visited at least 1 country with your listening."
        });
    }
    if (cnt >= 3) {
        achievements.push({
            label: "Frequent Flyer",
            desc: "Listening spans at least 3 countries."
        });
    }
    if (cnt >= 5) {
        achievements.push({
            label: "World Tour",
            desc: "Music passport has 5+ countries."
        });
    }
    if (cnt >= 8) {
        achievements.push({
            label: "Orbit Breaker",
            desc: "8+ countries. Your ears are everywhere."
        });
    }

    if (achievements.length === 0) {
        achievements.push({
            label: "Local Listener",
            desc: "So far your listening is focused on just one place. New stamps await."
        });
    }

    return achievements;
}

function loadAchievements() {
    var cnt = 0;
    var ccInput = $("countryCountInput");

    if (ccInput && ccInput.value) {
        cnt = parseInt(ccInput.value, 10) || 0;
    } else if (lastPassportSnapshot && lastPassportSnapshot.country_counts) {
        cnt = Object.keys(lastPassportSnapshot.country_counts).length;
    }

    var box = $("achievementsList");
    if (!box) return;

    box.innerHTML = "";

    var list = buildAchievementsFromCountryCount(cnt);
    list.forEach(function (a) {
        var div = document.createElement("div");
        div.className = "achievement-item";
        div.innerHTML =
            "<strong>" + a.label + "</strong><br><span>" + a.desc + "</span>";
        box.appendChild(div);
    });
}

// ----------------- COMMUNITY (PASSPORT-BASED SHARING) -----------------
async function shareToCommunity() {
    var dnInput = $("displayNameInput");
    var msgInput = $("communityMessageInput");

    var displayName = (dnInput && dnInput.value ? dnInput.value.trim() : "") ||
        spotifyDisplayName ||
        "Anonymous Astronaut";

    var message = msgInput && msgInput.value
        ? msgInput.value.trim()
        : "";

    // HARD REQUIREMENT: must have passport snapshot first
    if (!lastPassportSnapshot || !lastPassportSnapshot.country_counts) {
        alert("Load your Passport first (click 'Load Countries') before sharing.");
        console.warn("[Tuniverse] shareToCommunity blocked: no lastPassportSnapshot");
        return;
    }

    var countryCounts = lastPassportSnapshot.country_counts || {};
    var totalArtists = lastPassportSnapshot.total_artists || 0;
    var entries = Object.entries ? Object.entries(countryCounts) : [];
    var numCountries = entries.length;

    // Older browsers without Object.entries safeguard
    if (!entries.length) {
        for (var key in countryCounts) {
            if (Object.prototype.hasOwnProperty.call(countryCounts, key)) {
                entries.push([key, countryCounts[key]]);
            }
        }
        numCountries = entries.length;
    }

    // Top 3 countries
    entries.sort(function (a, b) { return b[1] - a[1]; });
    var top = entries.slice(0, 3);
    var topCountries = top.map(function (pair) {
        return pair[0] + " (" + pair[1] + ")";
    }).join(", ");

    var passportTitle =
        "Passport: " + numCountries + " countries from " + totalArtists + " artists";
    var passportSummary = topCountries || "No countries detected yet";

    // Primary country = highest count
    var primaryCountry = "Unknown";
    if (entries.length > 0) {
        primaryCountry = entries[0][0];
    }

    var payload = {
        display_name: displayName,
        message: message || "Shared my music passport.",
        track_name: passportTitle,     // using track_name field for passport title
        artist_name: passportSummary,  // using artist_name field for top countries
        country: primaryCountry
    };

    console.log("[Tuniverse] Sharing passport payload:", payload);

    try {
        var res = await fetch(BACKEND_BASE + "/community/share", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            console.error("community/share error", await res.text());
            alert("Failed to share passport to community.");
            return;
        }

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
    var box = $("communityFeed");
    if (!box) return;
    box.textContent = "Loading community feed…";

    try {
        var res = await fetch(BACKEND_BASE + "/community/feed");
        if (!res.ok) {
            console.error("community/feed error", await res.text());
            box.textContent = "Failed to load feed.";
            return;
        }

        var posts = await res.json();
        if (!Array.isArray(posts) || posts.length === 0) {
            box.textContent = "No posts yet.";
            return;
        }

        posts.sort(function (a, b) {
            var ta = new Date(a.created_at || 0).getTime();
            var tb = new Date(b.created_at || 0).getTime();
            return tb - ta;
        });

        box.innerHTML = "";
        posts.forEach(function (p) {
            var div = document.createElement("div");
            div.className = "community-post";

            var dn = p.display_name || "Anonymous";
            var msg = p.message || "";
            var tn = p.track_name || "";
            var an = p.artist_name || "";
            var when = p.created_at || "";
            var country = p.country || "Unknown";

            div.innerHTML =
                '<div class="community-post-header">' +
                '<span class="community-name">' + dn + "</span>" +
                '<span class="community-time">' + when + "</span>" +
                "</div>" +
                '<div class="community-passport-summary">' +
                '<span class="badge-passport">[PASSPORT]</span> ' +
                "<strong>" + tn + "</strong><br>" +
                "<span>" + an + "</span><br>" +
                '<span class="community-country">Primary country: ' + country + "</span>" +
                "</div>" +
                (msg
                    ? '<div class="community-message">' + msg + "</div>"
                    : "");

            box.appendChild(div);
        });
    } catch (e) {
        console.error(e);
        box.textContent = "Error talking to backend.";
    }
}

// ----------------- BOOTSTRAP -----------------
document.addEventListener("DOMContentLoaded", function () {
    // 1) Parse redirect hash from /auth/callback (Spotify)
    var hashData = parseHashFragment();
    if (hashData.access_token) {
        accessToken = hashData.access_token;
    }
    if (hashData.app_token) {
        appToken = hashData.app_token;
    }
    if (hashData.display_name) {
        try {
            spotifyDisplayName = decodeURIComponent(hashData.display_name);
        } catch (e) {
            spotifyDisplayName = hashData.display_name;
        }
    }

    // 2) Load from localStorage as fallback
    loadTokensFromStorage();

    // 3) Reflect tokens in UI
    if (accessToken) {
        setStatus("authStatus", "Access token received / loaded.");
        var atInput = $("accessTokenInput");
        if (atInput && !atInput.value) {
            atInput.value = accessToken;
        }
    } else {
        setStatus("authStatus", "Not logged in yet.");
    }

    if (spotifyDisplayName) {
        var dnInput = $("displayNameInput");
        if (dnInput && !dnInput.value) {
            dnInput.value = spotifyDisplayName;
        }
    }

    // 4) Clean hash from URL so it doesn’t stay ugly
    if (window.location.hash) {
        history.replaceState(null, "", window.location.pathname + window.location.search);
    }

    // Panel tab switching is handled by the script block inside index.html
});


