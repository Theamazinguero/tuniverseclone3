
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


