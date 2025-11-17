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
    country_count: int


class Achievement(BaseModel):
    id: str
    name: str
    description: str
    unlocked: bool


# ---------- IN-MEMORY STORE ----------

COMMUNITY_FEED: List[FeedItem] = []


# ---------- COMMUNITY ROUTES ----------

@router.post("/share", response_model=FeedItem)
def share_to_community(payload: ShareRequest):
    if not payload.track_name or not payload.artist_name:
        raise HTTPException(status_code=400, detail="Missing track or artist")

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

    COMMUNITY_FEED.insert(0, post)
    return post


@router.get("/feed", response_model=List[FeedItem])
def get_community_feed(limit: int = 50):
    return COMMUNITY_FEED[:limit]


# ---------- ACHIEVEMENTS ----------

@router.post("/achievements", response_model=List[Achievement])
def get_achievements(payload: AchievementsRequest):
    display_name = payload.display_name.strip()
    country_count = payload.country_count

    # Count user posts
    post_count = sum(1 for p in COMMUNITY_FEED if p.display_name == display_name)

    achievements: List[Achievement] = []

    def ach(id, name, desc, unlocked):
        achievements.append(
            Achievement(id=id, name=name, description=desc, unlocked=unlocked)
        )

    # Country achievements
    ach("first_country", "First Country", "Visit your first country.", country_count >= 1)
    ach("traveler_5", "World Traveler I", "Visit 5 countries.", country_count >= 5)
    ach("traveler_10", "World Traveler II", "Visit 10 countries.", country_count >= 10)

    # Community achievements
    ach("first_post", "Community Starter", "Make your first post.", post_count >= 1)
    ach("five_posts", "Social Listener", "Make 5 posts.", post_count >= 5)

    return achievements
