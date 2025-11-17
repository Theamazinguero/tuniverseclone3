let currentTrack = null;

// ---------------- LOAD CURRENT TRACK ----------------

async function loadCurrentTrack() {
    const token = document.getElementById("accessTokenInput").value.trim();

    if (!token) {
        alert("Paste your Spotify token first.");
        return;
    }

    const res = await fetch("http://127.0.0.1:8000/spotify/currently_playing", {
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });

    const data = await res.json();

    if (!data.playing) {
        document.getElementById("currentTrackLabel").textContent =
            "Nothing is currently playing.";
        return;
    }

    currentTrack = data;

    document.getElementById("currentTrackLabel").textContent =
        `${data.track_name} — ${data.artist_name}`;
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

    await fetch("http://127.0.0.1:8000/community/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    loadCommunityFeed();
}


// ---------------- COMMUNITY FEED ----------------

async function loadCommunityFeed() {
    const res = await fetch("http://127.0.0.1:8000/community/feed");
    const posts = await res.json();

    const container = document.getElementById("communityFeed");
    container.innerHTML = "";

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

    const res = await fetch("http://127.0.0.1:8000/community/achievements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            display_name: displayName,
            country_count: countryCount
        })
    });

    const achievements = await res.json();

    const container = document.getElementById("achievementsList");
    container.innerHTML = "";

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
