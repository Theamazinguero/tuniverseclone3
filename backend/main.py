"""
Main Code Runner
@Author: Emily Villareal
@Version: 1.0
@Since: 10/03/2025
Usage:
Main to run all the code
Change Log:
Version 1.0 (10/03/2025):
Created main to run backend code
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl
from typing import List, Optional
from datetime import datetime
from uuid import uuid4

# Prefix means all routes start with /community
router = APIRouter(prefix="/community")


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


# --- COMMUNITY ROUTES ---

@router.post("/share", response_model=FeedItem)
def share_to_community(payload: ShareRequest):
    """
    Create a new community post from the current track.
    We DO NOT store Spotify tokens here. Only display name + track metadata.
    """
    if not payload.track_name or not payload.artist_name:
        raise HTTPException(
            sta

