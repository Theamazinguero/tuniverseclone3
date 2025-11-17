// ================= GLOBAL STATE =================

// Current track for community sharing
let currentTrack = null;

// Passport countries for achievements
let passportCountries = [];


// ================= 1) SPOTIFY: PROFILE & CURRENT TRACK =================

async function fetchSpotifyMe() {
  const token = document.getElementById("accessTokenInput").value.trim();
  if (!token) {
    alert("Paste your Spotify access token first.");
    return;
  }

  try {
    const res = await fetch("http://127.0.0.1:8000/spotify/me", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Error from /spotify/me:", text);
      alert("Failed to load Spotify profile / current track.");
      return;
    }

    const data = await res.json();
    // Adjust these lines if your backend returns differently.
    // Example assumption:
    // {
    //   "display_name": "...",
    //   "id": "...",
    //   "now_playing": {
    //      "track_name": "...",
    //      "artist_name": "...",
    //      "album_name": "...",
    //      "album_image_url": "..."
    //   }
    // }

    const profileDiv = document.getElementById("profileInfo");
    const trackDiv = document.getElementById("currentTrackInfo");

    const displayName = data.display_name || data.user?.display_name || "Unknown user";
    const userId = data.id || data.user?.id || "";

    profileDiv.innerHTML = `
      <p><strong>Logged in as:</strong> ${displayName}${userId ? ` (${userId})` : ""}</p>
    `;

    const np = data.now_playing || data.current_track || null;

    if (!np) {
      trackDiv.innerHTML = "<p>No track currently playing.</p>";
      currentTrack = null;
      return;
    }

    currentTrack = {
      trackName: np.track_name || np.name || "Unknown track",
      artistName: np.artist_name || (Array.isArray(np.artists) ? np.artists.map(a => a.name).join(", ") : "Unknown artist"),
      albumName: np.album_name || np.album || "Unknown album",
      albumImageUrl: np.album_image_url || (np.album && np.album.images && np.album.images[0]?.url) || null
    };

    trackDiv.innerHTML = `
      <div class="track-info">
        ${currentTrack.albumImageUrl
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
  } catch (err) {
    console.error("fetchSpotifyMe error:", err);
    alert("Network error calling /spotify/me.");
  }
}


// ================= 2) PASSPORT =================

async function loadPassport() {
  const token = document.getElementById("accessTokenInput").value.trim();
  if (!token) {
    alert("Paste your Spotify access token first.");
    return;
  }

  try {
    const res = await fetch("http://127.0.0.1:8000/passport/from_token", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Error from /passport/from_token:", text);
      alert("Failed to load passport.");
      return;
    }

    const data = await res.json();

    // Adjust this according to your backend's response shape.
    // We'll assume: { "countries": [ { "code": "US", "name": "United States" }, ... ] }
    passportCountries = data.countries || [];

    const summaryDiv = document.getElementById("passportSummary");
    const listEl = document.getElementById("passportCountryList");

    const uniqueNames = new Set(
      passportCountries.map(c => c.name || c.country_name || c.code || "Unknown")
    );

    summaryDiv.innerHTML = `
      <p><strong>${uniqueNames.size}</strong> countries in your music passport.</p>
    `;

    listEl.innerHTML = "";
    uniqueNames.forEach(name => {
      const li = document.createElement("li");
      li.textContent = name;
      listEl.appendChild(li);
    });
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

  const displayName = displayNameInput.value.trim() || "Anonymous";
  const message = messageInput.value.trim();

  const payload = {
    display_name: displayName,
    track_name: currentTrack.trackName,
    artist_name: currentTrack.artistName,
    album_name: currentTrack.albumName,
    album_image_url: currentTrack.albumImageUrl,
    message: message
  };

  try {
    const res = await fetch("http://127.0.0.1:8000/community/share", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Share failed:", text);
      alert("Failed to share to community.");
      return;
    }

    // Clear message box
    messageInput.value = "";

    // Reload feed so we see our new post
    await loadCommunityFeed();
  } catch (err) {
    console.error("shareToCommunity error:", err);
    alert("Network error while sharing to community.");
  }
}

async function loadCommunityFeed() {
  try {
    const res = await fetch("http://127.0.0.1:8000/community/feed");
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
  container.innerHTML = "";

  if (!posts.length) {
    container.innerHTML = "<p>No community posts yet. Be the first to share!</p>";
    return;
  }

  posts.forEach(post => {
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
          ${post.album_image_url
            ? `<img src="${post.album_image_url}" alt="Album cover" class="album-art" />`
            : ""
          }
          <div>
            <div class="track-name">${post.track_name}</div>
            <div class="artist-name">${post.artist_name}</div>
            ${post.album_name ? `<div class="album-name">${post.album_name}</div>` : ""}
          </div>
        </div>
        ${post.message ? `<p class="community-message">${post.message}</p>` : ""}
      </div>
    `;

    container.appendChild(card);
  });
}


// ================= 4) ACHIEVEMENTS =================

async function loadAchievements() {
  const displayName = document.getElementById("displayNameInput").value.trim() || "Anonymous";

  // use distinct country names/codes
  const unique = new Set(
    passportCountries.map(c => c.code || c.country_code || c.name || c.country_name)
  );
  const countryCount = unique.size;

  try {
    const res = await fetch("http://127.0.0.1:8000/community/achievements", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        display_name: displayName,
        country_count: countryCount
      })
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
  container.innerHTML = "";

  if (!achievements.length) {
    container.innerHTML = "<p>No achievements defined.</p>";
    return;
  }

  achievements.forEach(ach => {
    const div = document.createElement("div");
    div.className = "achievement-card " + (ach.unlocked ? "unlocked" : "locked");

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
