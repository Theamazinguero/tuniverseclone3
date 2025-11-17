// --------- GLOBAL STATE ----------

// Track the current song for community sharing
let currentTrack = null;

// Track passport countries for achievements
// In real app: this comes from your backend /passport endpoint.
let passportCountries = [];


// ---------- TEST HELPERS ----------

// For quickly testing community sharing without Spotify wired in yet
function setTestTrack() {
    currentTrack = {
        trackName: "Test Song",
        artistName: "Test Artist",
        albumName: "Test Album",
        albumImageUrl: "https://via.placeholder.com/64"
    };

    const label = document.getElementById("currentTrackLabel");
    label.textContent = `Current track: ${currentTrack.trackName} by ${currentTrack.artistName}`;
}

// For quickly testing achievements without passport wired in yet
function setTestPassportCountries() {
    // Pretend the user has visited 7 countries
    passportCountries = [
        { code: "US", name: "United States" },
        { code: "GB", name: "United Kingdom" },
        { code: "JP", name: "Japan" },
        { code: "FR", name: "France" },
        { code: "BR", name: "Brazil" },
        { code: "DE", name: "Germany" },
        { code: "MX", name: "Mexico" }
    ];

    const label = document.getElementById("passportSummaryLabel");
    label.textContent = `Test passport: ${passportCountries.length} countries loaded.`;
}


// ---------- COMMUNITY SHARE ----------

async function shareToCommunity() {
    if (!currentTrack) {
        alert("No current track set. Use 'Set Test Track' or wire in your Spotify track first.");
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
        console.error("Error sharing to community:", err);
        alert("Network error while sharing to community.");
    }
}


// ---------- COMMUNITY FEED ----------

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
        console.error("Error loading community feed:", err);
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


// ---------- ACHIEVEMENTS / STAMPS ----------

// In the real app, you’d call your passport endpoint first to fill passportCountries,
// then call loadAchievements(). For now, setTestPassportCountries() gives fake data.

async function loadAchievements() {
    const displayName = document.getElementById("displayNameInput").value.trim() || "Anonymous";

    // Count distinct countries from passportCountries
    const unique = new Set(
        passportCountries.map(c => c.code || c.country_code || c.name)
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
        console.error("Error loading achievements:", err);
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
