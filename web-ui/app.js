// ================= CONFIG =================

const BACKEND_BASE_URL = "http://127.0.0.1:8000";
const TOKEN_STORAGE_KEY = "tuniverse_spotify_access_token";
const DISPLAY_NAME_STORAGE_KEY = "tuniverse_display_name";


// ================= GLOBAL STATE =================

let accessToken = null;         // Spotify access token
let currentTrack = null;        // Current track for community sharing
let passportCountries = [];     // For achievements


// ================= INIT: read hash / localStorage =================

window.addEventListener("DOMContentLoaded", () => {
  const hashData = parseHashFragment();
  const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  const storedDisplayName = localStorage.getItem(DISPLAY_NAME_STORAGE_KEY);

  // 1) Prefer fresh token from URL fragment after /auth/callback
  if (hashData && hashData.access_token) {
    accessToken = hashData.access_token;
    localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);

    if (hashData.display_name) {
      localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, hashData.display_name);
    }

    // Clean the URL so the token isn't visible
    window.history.replaceState({}, document.title, window.location.pathname);
  } else if (storedToken) {
    accessToken = storedToken;
  }

  // 2) Reflect into UI fields if they exist
  const tokenInput = document.getElementById("accessTokenInput");
  if (tokenInput && accessToken) {
    tokenInput.value = accessToken;
  }

  const displayInput = document.getElementById("displayNameInput");
  if (displayInput) {
    if (hashData && hashData.display_name) {
      displayInput.value = hashData.display_name;
    } else if (storedDisplayName) {
      displayInput.value = storedDisplayName;
    }
  }

  // 3) Optionally auto-load profile when we already have a token
  if (accessToken) {
    fetchSpotifyMe();  // fire and forget
  }
});

function parseHashFragment() {
  if (!window.location.hash) return null;
  const raw = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!raw) return null;

  const params = new URLSearchParams(raw);
  const result = {};
  for (const [k, v] of params.entries()) {
    result[k] = v;
  }
  return result;
}


// ================= AUTH / TOKEN HANDLING =================

function startSpotifyLogin() {
  // Full-page redirect to backend auth route
  window.location.href = `${BACKEND_BASE_URL}/auth/login`;
}

function saveAccessToken() {
  // Keep this as a debug option, but it's no longer required for normal usage
  const input = document.getElementById("accessTokenInput");
  const value = input.value.trim();
  if (!value) {
    alert("Paste a token first.");
    return;
  }
  accessToken = value;
  localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
  alert("Token saved.");
}

function logoutSpotify() {
  accessToken = null;
  currentTrack = null;
  passportCountries = [];
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(DISPLAY_NAME_STORAGE_KEY);

  const tokenInput = document.getElementById("accessTokenInput");
  if (tokenInput) tokenInput.value = "";

  const profileDiv = document.getElementById("profileInfo");
  const trackDiv = document.getElementById("currentTrackInfo");
  const passportSummary = document.getElementById("passportSummary");
  const passportList = document.getElementById("passportCountryList");
  const achievementsList = document.getElementById("achievementsList");

  if (profileDiv) profileDiv.innerHTML = "";
  if (trackDiv) trackDiv.innerHTML = "";
  if (passportSummary) passportSummary.innerHTML = "";
  if (passportList) passportList.innerHTML = "";
  if (achievementsList) achievementsList.innerHTML = "";
  alert("Logged out (client side).");
}

function ensureToken() {
  if (accessToken) return true;

  const tokenInput = document.getElementById("accessTokenInput");
  if (tokenInput && tokenInput.value.trim()) {
    accessToken = tokenInput.value.trim();
    localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
    return true;
  }

  alert("No access token. Click 'Login with Spotify' first.");
  return false;
}


// ================= 1) SPOTIFY: PROFILE & CURRENT TRACK =================

async function fetchSpotifyMe() {
  if (!ensureToken()) return;

  try {
    // Your backend expects the token as a query parameter (see get_me in spotify_auth.py)
    const url = `${BACKEND_BASE_URL}/spotify/me?access_token=${encodeURIComponent(accessToken)}`;

    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      console.error("Error from /spotify/me:", text);
      alert("Failed to load Spotify profile / current track.");
      return;
    }

    const data = await res.json();

    const profileDiv = document.getElementById("profileInfo");
    const trackDiv = document.getElementById("currentTrackInfo");

    const displayName =
      data.display_name || data.user?.display_name || "Unknown user";
    const userId = data.id || data.user?.id || "";

    // Persist display name for later sessions
    localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, displayName);

    if (profileDiv) {
      profileDiv.innerHTML = `
        <p><strong>Logged in as:</strong> ${displayName}${
          userId ? ` (${userId})` : ""
        }</p>
      `;
    }

    const np = data.now_playing || data.current_track || null;

    if (!np) {
      if (trackDiv) trackDiv.innerHTML = "<p>No track currently playing.</p>";
      currentTrack = null;
      return;
    }

    currentTrack = {
      trackName: np.track_name || np.name || "Unknown track",
      artistName:
        np.artist_name ||
        (Array.isArray(np.artists)
          ? np.artists.map((a) => a.name).join(", ")
          : "Unknown artist"),
      albumName: np.album_name || np.album || "Unknown album",
      albumImageUrl:
        np.album_image_url ||
        (np.album && np.album.images && np.album.images[0]?.url) ||
        null,
    };

    if (trackDiv) {
      trackDiv.innerHTML = `
        <div class="track-info">
          ${
            currentTrack.albumImageUrl
              ? `<img src="${currentTrack.albumImageUrl}" alt="Album cover" class="album-art" />`
              : ""
          }
          <div>
            <div class="track-name">${currentTrack.trackName}</div>
            <div class="artist-name">${currentTrack.artistName}</div>
            <div class="album-name">${currentTrack.albumName}</div>
          </div>
        </div>
      `;
    }
  } catch (err) {
    console.error("fetchSpotifyMe error:", err);
    alert("Network error calling /spotify/me.");
  }
}


// ================= 2) PASSPORT =================

async function loadPassport() {
  if (!ensureToken()) return;

  try {
    // We send the token both ways just to be safe:
    //   - as a query parameter
    //   - as an Authorization header
    const url = `${BACKEND_BASE_URL}/passport/from_token?access_token=${encodeURIComponent(
      accessToken
    )}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Error from /passport/from_token:", text);
      alert("Failed to load passport.");
      return;
    }

    const data = await res.json();

    // Assumed shape: { "countries": [ { "code": "US", "name": "United States" }, ... ] }
    passportCountries = data.countries || [];

    const summaryDiv = document.getElementById("passportSummary");
    const listEl = document.getElementById("passportCountryList");

    const uniqueNames = new Set(
      passportCountries.map(
        (c) => c.name || c.country_name || c.code || "Unknown"
      )
    );

    if (summaryDiv) {
      summaryDiv.innerHTML = `
        <p><strong>${uniqueNames.size}</strong> countries in your music passport.</p>
      `;
    }

    if (listEl) {
      listEl.innerHTML = "";
      uniqueNames.forEach((name) => {
        const li = document.createElement("li");
        li.textContent = name;
        listEl.appendChild(li);
      });
    }
  } catch (err) {
    console.error("loadPassport error:", err);
    alert("Network error calling /passport/from_token.");
  }
}


// ================= 3) COMMUNITY =================

async function shareToCommunity() {
  if (!currentTrack) {
    alert("No current track is set. Use 'Load Profile & Current Track' first.");
    return;
  }

  const displayNameInput = document.getElementById("displayNameInput");
  const messageInput = document.getElementById("communityMessageInput");

  const displayName =
    (displayNameInput && displayNameInput.value.trim()) || "Anonymous";
  const message = messageInput ? messageInput.value.trim() : "";

  // Persist display name
  localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, displayName);

  const payload = {
    display_name: displayName,
    track_name: currentTrack.trackName,
    artist_name: currentTrack.artistName,
    album_name: currentTrack.albumName,
    album_image_url: currentTrack.albumImageUrl,
    message: message,
  };

  try {
    const res = await fetch(`${BACKEND_BASE_URL}/community/share`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Share failed:", text);
      alert("Failed to share to community.");
      return;
    }

    if (messageInput) {
      messageInput.value = "";
    }

    await loadCommunityFeed();
  } catch (err) {
    console.error("shareToCommunity error:", err);
    alert("Network error while sharing to community.");
  }
}

async function loadCommunityFeed() {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/community/feed`);
    if (!res.ok) {
      const text = await res.text();
      console.error("Failed to load feed:", text);
      alert("Could not load community feed.");
      return;
    }

    const posts = await res.json();
    renderCommunityFeed(posts);
  } catch (err) {
    console.error("loadCommunityFeed error:", err);
    alert("Network error while loading community feed.");
  }
}

function renderCommunityFeed(posts) {
  const container = document.getElementById("communityFeed");
  if (!container) return;

  container.innerHTML = "";

  if (!posts.length) {
    container.innerHTML = "<p>No community posts yet. Be the first to share!</p>";
    return;
  }

  posts.forEach((post) => {
    const card = document.createElement("div");
    card.className = "community-post";

    const createdAt = new Date(post.created_at);

    card.innerHTML = `
      <div class="community-post-header">
        <strong>${post.display_name}</strong>
        <span class="community-post-date">${createdAt.toLocaleString()}</span>
      </div>
      <div class="community-post-body">
        <div class="track-info">
          ${
            post.album_image_url
              ? `<img src="${post.album_image_url}" alt="Album cover" class="album-art" />`
              : ""
          }
          <div>
            <div class="track-name">${post.track_name}</div>
            <div class="artist-name">${post.artist_name}</div>
            ${
              post.album_name
                ? `<div class="album-name">${post.album_name}</div>`
                : ""
            }
          </div>
        </div>
        ${
          post.message
            ? `<p class="community-message">${post.message}</p>`
            : ""
        }
      </div>
    `;

    container.appendChild(card);
  });
}


// ================= 4) ACHIEVEMENTS =================

async function loadAchievements() {
  const displayNameInput = document.getElementById("displayNameInput");
  const displayName =
    (displayNameInput && displayNameInput.value.trim()) || "Anonymous";

  // distinct country codes/names
  const unique = new Set(
    passportCountries.map(
      (c) => c.code || c.country_code || c.name || c.country_name
    )
  );
  const countryCount = unique.size;

  try {
    const res = await fetch(`${BACKEND_BASE_URL}/community/achievements`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        display_name: displayName,
        country_count: countryCount,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Failed to load achievements:", text);
      alert("Could not load achievements.");
      return;
    }

    const achievements = await res.json();
    renderAchievements(achievements);
  } catch (err) {
    console.error("loadAchievements error:", err);
    alert("Network error while loading achievements.");
  }
}

function renderAchievements(achievements) {
  const container = document.getElementById("achievementsList");
  if (!container) return;

  container.innerHTML = "";

  if (!achievements.length) {
    container.innerHTML = "<p>No achievements defined.</p>";
    return;
  }

  achievements.forEach((ach) => {
    const div = document.createElement("div");
    div.className =
      "achievement-card " + (ach.unlocked ? "unlocked" : "locked");

    div.innerHTML = `
      <div class="achievement-title">${ach.name}</div>
      <div class="achievement-desc">${ach.description}</div>
      <div class="achievement-status">
        ${ach.unlocked ? "✅ Unlocked" : "🔒 Locked"}
      </div>
    `;

    container.appendChild(div);
  });
}

