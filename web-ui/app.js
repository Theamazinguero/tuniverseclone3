let currentTrack = null;
let passportCountries = [];

// ---------------- TEST HELPERS ----------------

function setTestTrack() {
    currentTrack = {
        trackName: "Test Song",
        artistName: "Test Artist",
        albumName: "Test Album",
        albumImageUrl: "https://via.placeholder.com/64"
    };

    document.getElementById("currentTrackLabel").textContent =
        `Track: ${currentTrack.trackName} by ${currentTrack.artistName}`;
}

function setTestPassportCountries() {
    passportCountries = [
        { code: "US" }, { code: "GB" }, { code: "JP" },
        { code: "FR" }, { code: "BR" }, { code: "DE" }, { code: "MX" }
    ];

    document.getElementById("passportSummaryLabel").textContent =
        `${passportCountries.length} countries loaded.`;
}


// ---------------- COMMUNITY SHARE ----------------

async function shareToCommunity() {
    const name = document.getElementById("displayNameInput").value.trim() || "Anonymous";

    if (!currentTrack) {
        alert("No track set.");
        return;
    }

    const message = document.getElementById("communityMessageInput").value.trim();

    const payload = {
        display_name: name,
        track_name: currentTrack.trackName,
        artist_name: currentTrack.artistName,
        album_name: currentTrack.albumName,
        album_image_url: currentTrack.albumImageUrl,
        message: message
    };

    await fetch("http://127.0.0.1:8000/community/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    loadCommunityFeed();
}


// ---------------- FEED ----------------

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
    const name = document.getElementById("displayNameInput").value.trim() || "Anonymous";

    const payload = {
        display_name: name,
        country_count: passportCountries.length
    };

    const res = await fetch("http://127.0.0.1:8000/community/achievements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
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
