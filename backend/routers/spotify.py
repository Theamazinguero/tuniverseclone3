"""
@Author: Max Henson
@Version: 1.0
@Since: 10/3/2025

Usage:
    Spotify router for Tuniverse backend.
    Provides endpoints that proxy the Spotify Web API:
        • /spotify/me – current user's Spotify profile
        • /spotify/currently_playing – user's currently playing track

    Uses:
        • Authorization: Bearer <spotify_access_token> header from the client
        • Helper _call_spotify() to wrap common request/validation logic

Change Log:
    Version 1.0 (11/3/2025): Implemented core Spotify integration with profile and
                             currently-playing endpoints for frontend use.
"""


# backend/routers/spotify.py

from fastapi import APIRouter, HTTPException, Header
from typing import Optional
import requests

router = APIRouter(prefix="/spotify", tags=["spotify"])

SPOTIFY_API_BASE = "https://api.spotify.com/v1"


def _call_spotify(
    path: str,
    authorization: str,
    params: Optional[dict] = None,
) -> dict:
    """
    Helper to call the Spotify Web API.
    Expects a full 'Authorization' header value, e.g. 'Bearer <token>'.
    """
    if not authorization:
        raise HTTPException(status_code=400, detail="Missing Authorization header")

    if not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=400,
            detail="Authorization header must start with 'Bearer '",
        )

    url = f"{SPOTIFY_API_BASE}{path}"

    resp = requests.get(
        url,
        headers={"Authorization": authorization},
        params=params or {},
        timeout=10,
    )

    # If Spotify says no, pass that back in a helpful way
    if resp.status_code != 200:
        raise HTTPException(
            status_code=400,
            detail=f"Spotify API error {resp.status_code}: {resp.text}",
        )

    return resp.json()


@router.get("/me")
def get_spotify_me(authorization: str = Header(...)):
    """
    Get the current user's Spotify profile.

    Call from frontend with:
      GET /spotify/me
      Header: Authorization: Bearer <spotify_access_token>
    """
    data = _call_spotify("/me", authorization)
    return data


@router.get("/currently_playing")
def get_currently_playing(authorization: str = Header(...)):
    """
    Get the user's currently playing track.

    Call from frontend with:
      GET /spotify/currently_playing
      Header: Authorization: Bearer <spotify_access_token>

    This is handy to fill `currentTrack` for community sharing.
    """
    # Spotify uses /me/player/currently-playing
    # If nothing is playing, Spotify returns 204 No Content.
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=400,
            detail="Authorization header must start with 'Bearer '",
        )

    url = f"{SPOTIFY_API_BASE}/me/player/currently-playing"
    resp = requests.get(
        url,
        headers={"Authorization": authorization},
        timeout=10,
    )

    if resp.status_code == 204:
        # Nothing playing
        return {"playing": False, "track": None}

    if resp.status_code != 200:
        raise HTTPException(
            status_code=400,
            detail=f"Spotify currently-playing error {resp.status_code}: {resp.text}",
        )

    data = resp.json()
    item = data.get("item") or {}

    track_name = item.get("name")
    artists = item.get("artists") or []
    artist_name = ", ".join(a.get("name", "") for a in artists if a.get("name"))
    album = item.get("album") or {}
    album_name = album.get("name")
    images = album.get("images") or []
    album_image_url = images[0]["url"] if images else None

    # Return a clean, frontend-friendly structure
    return {
        "playing": True,
        "track_name": track_name,
        "artist_name": artist_name,
        "album_name": album_name,
        "album_image_url": album_image_url,
        "raw": data,
    }
