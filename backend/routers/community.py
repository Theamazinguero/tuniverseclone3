from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl
from typing import List, Optional
from datetime import datetime
from uuid import uuid4

router = APIRouter(prefix="/community", tags=["community"])


# ---------- MODELS ----------

class ShareRequest(BaseModel):
    display_name: str
    track_name: str
    artist_name: str
    album_name: Optional[str] = None
    album_image_url: Optional[HttpUrl] = None
    message: Optional[str] = None


class FeedItem(BaseModel):
    id: str
    display_name: str
    track_name: str
    artist_name: str
    album_name: Optional[str]
    album_image_url: Optional[HttpUrl]
    message: Optional[str]
    created_at: datetime


class AchievementsRequest(BaseModel):
    display_name: str
    country_count: int  # distinct countries in the user's passport


class Achievement(BaseModel):
    id: str
    name: str
    description: str
    unlocked: bool


# ---------- IN-MEMORY STORE ----------

# Resets whenever the server restarts
COMMUNITY_FEED: List[FeedItem] = []


# ---------- COMMUNITY ROUTES ----------

@router.post("/share", response_model=FeedItem)
def share_to_community(payload: ShareRequest):
    """
    Create a new community post from the current track.
    We DO NOT store Spotify tokens here. Only metadata.
    """
    if not payload.track_name or not payload.artist_name:
        raise HTTPException(
            status_code=400,
            detail="track_name and artist_name are required",
        )

    post = FeedItem(
        id=str(uuid4()),
        display_name=payload.display_name.strip(),
        track_name=payload.track_name.strip(),
        artist_name=payload.artist_name.strip(),
        album_name=payload.album_name.strip() if payload.album_name else None,
        album_image_url=payload.album_image_url,
        message=(payload.message or "").strip() or None,
        created_at=datetime.utcnow(),
    )

    # newest first
    COMMUNITY_FEED.insert(0, post)
    return post


@router.get("/feed", response_model=List[FeedItem])
def get_community_feed(limit: int = 50):
    """
    Return recent community posts, newest first.
    """
    return COMMUNITY_FEED[:limit]


# ---------- ACHIEVEMENTS / STAMPS ROUTE ----------

@router.post("/achievements", response_model=List[Achievement])
def get_achievements(payload: AchievementsRequest):
    """
    Compute achievements based on:
    - number of countries in user's passport (sent from frontend)
    - number of community posts by this display_name
    """
    display_name = payload.display_name.strip()
    country_count = max(0, payload.country_count)

    # count posts by this user
    post_count = sum(1 for p in COMMUNITY_FEED if p.display_name == display_name)

    achievements: List[Achievement] = []

    def add_achievement(id_: str, name: str, description: str, condition: bool):
        achievements.append(
            Achievement(
                id=id_,
                name=name,
                description=description,
                unlocked=condition,
            )
        )

    # Country-based stamps
    add_achievement(
        "first_country",
        "First Country Stamp",
        "Visit your first country in your music passport.",
        country_count >= 1,
    )

    add_achievement(
        "world_traveler_1",
        "World Traveler I",
        "Visit 5 different countries in your music passport.",
        country_count >= 5,
    )

    add_achievement(
        "world_traveler_2",
        "World Traveler II",
        "Visit 10+ different countries in your music passport.",
        country_count >= 10,
    )

    # Community-based stamps
    add_achievement(
        "community_starter",
        "Community Starter",
        "Share your first post to the community.",
        post_count >= 1,
    )

    add_achievement(
        "social_listener",
        "Social Listener",
        "Share 5+ posts to the community.",
        post_count >= 5,
    )

    return achievements
