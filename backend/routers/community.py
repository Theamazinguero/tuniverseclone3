"""
@Author: Tyler Tristan
@Version: 1.0
@Since: 10/3/2025

Usage:
    Community router for Tuniverse backend.
    Provides endpoints for:
        • Accepting community posts shared from the web UI
        • Storing posts in an in-memory feed (newest first)
        • Returning the community feed to clients

Change Log:
    Version 1.0 (10/3/2025): Implemented basic in-memory community feed
                              with /share and /feed endpoints.
"""


# backend/routers/community.py

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Header
from pydantic import BaseModel, Field

router = APIRouter(
    prefix="/community",
    tags=["community"],
)


class CommunityPostIn(BaseModel):
    """
    Incoming post from the web UI.
    Matches the front-end payload in app.js:

        {
            display_name: string,
            message: string,
            passport_summary: string (can contain HTML)
        }
    """
    display_name: str = Field(..., max_length=80)
    message: str = Field(..., max_length=500)
    passport_summary: Optional[str] = Field(None, max_length=4000)


class CommunityPostOut(CommunityPostIn):
    """
    What we return to the client and store in memory.
    """
    id: int
    created_at: str


# super simple in-memory store (fine for the class project)
COMMUNITY_FEED: List[CommunityPostOut] = []


@router.post("/share", response_model=CommunityPostOut)
async def share_post(
    post: CommunityPostIn,
    x_app_token: Optional[str] = Header(default=None, alias="X-App-Token"),
):
    """
    Accept a post from the UI and stash it in memory.
    X-App-Token is accepted but not enforced for now.
    """
    display_name = (post.display_name or "").strip() or "Anonymous traveler"
    message = (post.message or "").strip()
    passport_summary = post.passport_summary or ""

    if not message:
        message = "[empty message]"

    created_at = datetime.now(timezone.utc).isoformat()
    new_post = CommunityPostOut(
        id=len(COMMUNITY_FEED) + 1,
        display_name=display_name,
        message=message,
        passport_summary=passport_summary,
        created_at=created_at,
    )

    COMMUNITY_FEED.insert(0, new_post)
    return new_post


@router.get("/feed", response_model=List[CommunityPostOut])
async def get_feed():
    """
    Return the community feed, newest-first.
    """
    return COMMUNITY_FEED
