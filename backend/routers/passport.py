"""
Backend Passport Coding
@Author: Tyler Tristan
@Version: 1.0
@Since: 10/03/2025
Usage:
Generate the user's customized music passport
Change Log:
Version 1.0 (10/03/2025):
Created backend code for the music passport
"""
# backend/routers/passport.py
# Music Passport endpoints:
#  - GET /passport/ping                 -> quick health check
#  - GET /passport/from_token           -> Live snapshot from Spotify Top Artists
#  - GET /passport/from_token_recent    -> Live snapshot from Recently Played
#  - GET /passport/{user_id}            -> DB-based summary (kept)

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Dict, Optional, List
import os
import time
import requests

from ..db import get_db
from .. import crud, models
from ..schemas import PassportSummaryOut

router = APIRouter(prefix="/passport", tags=["Music Passport"])

# ---------------- helpers ----------------

# Toggle MusicBrainz lookups via env
USE_MB = os.getenv("PASSPORT_USE_MB", "0") == "1"

# Map of country label -> region
# Supports both full names and 2-letter codes where possible.
COUNTRY_TO_REGION: Dict[str, str] = {
    # North America (names)
    "United States": "North America",
    "Canada": "North America",
    "Mexico": "North America",
    # North America (codes)
    "US": "North America",
    "CA": "North America",
    "MX": "North America",

    # Europe (names)
    "United Kingdom": "Europe",
    "Ireland": "Europe",
    "Germany": "Europe",
    "France": "Europe",
    "Spain": "Europe",
    "Italy": "Europe",
    "Netherlands": "Europe",
    "Sweden": "Europe",
    "Norway": "Europe",
    "Finland": "Europe",
    "Denmark": "Europe",
    "Poland": "Europe",
    "Portugal": "Europe",
    "Russia": "Europe",
    # Europe (codes)
    "GB": "Europe",
    "IE": "Europe",
    "DE": "Europe",
    "FR": "Europe",
    "ES": "Europe",
    "IT": "Europe",
    "NL": "Europe",
    "SE": "Europe",
    "NO": "Europe",
    "FI": "Europe",
    "DK": "Europe",
    "PL": "Europe",
    "PT": "Europe",
    "RU": "Europe",

    # Asia (names)
    "Japan": "Asia",
    "South Korea": "Asia",
    "China": "Asia",
    "India": "Asia",
    # Asia (codes)
    "JP": "Asia",
    "KR": "Asia",
    "CN": "Asia",
    "IN": "Asia",

    # Oceania
    "Australia": "Oceania",
    "New Zealand": "Oceania",
    "AU": "Oceania",
    "NZ": "Oceania",

    # South America
    "Brazil": "South America",
    "Argentina": "South America",
    "Chile": "South America",
    "Colombia": "South America",
    "BR": "South America",
    "AR": "South America",
    "CL": "South America",
    "CO": "South America",

    # Africa
    "South Africa": "Africa",
    "Nigeria": "Africa",
    "Egypt": "Africa",
    "ZA": "Africa",
    "NG": "Africa",
    "EG": "Africa",
}

# Some MusicBrainz "area" names are cities like "Ottawa", "Montréal".
# Map a few obvious ones back to countries so the passport looks sane.
CITY_TO_COUNTRY: Dict[str, str] = {
    "Ottawa": "CA",
    "Montréal": "CA",
    "Montreal": "CA",
    "Toronto": "CA",
    "Vancouver": "CA",
    "New York": "US",
    "Los Angeles": "US",
    "London": "GB",
    "Paris": "FR",
    "Tokyo": "JP",
}

def region_of(country: Optional[str]) -> Optional[str]:
    if not country:
        return None
    return COUNTRY_TO_REGION.get(country)

def rollup_regions(country_counts: Dict[str, int]) -> Dict[str, float]:
    total = sum(country_counts.values())
    if total == 0:
        return {}
    reg_counts: Dict[str, int] = {}
    for country, cnt in country_counts.items():
        reg = region_of(country)
        if not reg:
            reg = "Unknown"
        reg_counts[reg] = reg_counts.get(reg, 0) + cnt
    return {reg: cnt / total for reg, cnt in reg_counts.items()}

# Quick hardcoded seeds for some very popular artists
QUICK_COUNTRY_SEEDS: Dict[str, str] = {
    "Taylor Swift": "US",
    "Drake": "CA",
    "Bad Bunny": "PR",  # Puerto Rico
    "Adele": "GB",
    "BTS": "KR",
    "BLACKPINK": "KR",
    "Daft Punk": "FR",
    "Arctic Monkeys": "GB",
    "The Beatles": "GB",
    "Kendrick Lamar": "US",
    "YOASOBI": "JP",
    "IU": "KR",
    "Rammstein": "DE",
}

MB_COUNTRY_CACHE: Dict[str, Optional[str]] = {}

def normalize_country_label(raw: Optional[str]) -> str:
    """
    Normalize various forms of "country-ish" data:
    - City names (Ottawa, Montréal) -> mapped to a country code when possible
    - 2-letter codes -> uppercased and kept if recognized
    - Known country names -> kept
    Otherwise -> "Unknown"
    """
    if not raw:
        return "Unknown"

    label = raw.strip()

    # Map well-known cities -> country codes
    if label in CITY_TO_COUNTRY:
        label = CITY_TO_COUNTRY[label]

    # Uppercase 2-letter codes
    if len(label) == 2:
        label = label.upper()

    # If we recognize it as a key in COUNTRY_TO_REGION, keep it
    if label in COUNTRY_TO_REGION:
        return label

    # If it's a full name that we know (e.g., "Poland") we already handled it above.
    # Everything else is Unknown for now.
    return "Unknown"

def mb_lookup_country(artist_name: str) -> Optional[str]:
    """
    Ask MusicBrainz for the artist and try to get some notion of country.
    Returns the RAW label (code or name); we normalize later.
    """
    if not USE_MB:
        return None
    if artist_name in MB_COUNTRY_CACHE:
        return MB_COUNTRY_CACHE[artist_name]
    try:
        url = "https://musicbrainz.org/ws/2/artist"
        params = {"query": f'artist:"{artist_name}"', "limit": 1, "fmt": "json"}
        headers = {"User-Agent": "TuniverseDemo/1.0 (class project)"}
        r = requests.get(url, params=params, headers=headers, timeout=3.0)
        r.raise_for_status()
        data = r.json()
        if data.get("artists"):
            a = data["artists"][0]
            # Prefer MusicBrainz "country" field (usually a 2-letter code)
            if "country" in a:
                MB_COUNTRY_CACHE[artist_name] = a["country"]
                return a["country"]
            # Otherwise try area / begin-area names
            for key in ("area", "begin-area"):
                if isinstance(a.get(key), dict):
                    nm = a[key].get("name")
                    if nm:
                        MB_COUNTRY_CACHE[artist_name] = nm
                        return nm
    except Exception:
        pass
    MB_COUNTRY_CACHE[artist_name] = None
    return None

def infer_country_fast(artist_name: str) -> str:
    """
    Try to infer a normalized country label for this artist.
    """
    if artist_name in QUICK_COUNTRY_SEEDS:
        return normalize_country_label(QUICK_COUNTRY_SEEDS[artist_name])

    c = mb_lookup_country(artist_name)
    if c:
        return normalize_country_label(c)

    return "Unknown"

def spotify_get(path: str, access_token: str, params: Optional[Dict] = None):
    """
    Safe GET to Spotify that never raises; returns dict with 'error' on failure.
    """
    try:
        headers = {"Authorization": f"Bearer {access_token}"}
        url = f"https://api.spotify.com/v1{path}"
        r = requests.get(url, headers=headers, params=params or {}, timeout=8)
        try:
            data = r.json()
        except Exception:
            data = {"text": r.text or ""}
        if r.status_code >= 400:
            return {"error": r.status_code, **(data if isinstance(data, dict) else {})}
        return data if isinstance(data, dict) else {"error": "bad_json"}
    except requests.RequestException as e:
        return {"error": "network", "message": str(e)}

# ---------------- routes ----------------

@router.get("/ping")
def ping():
    return {"ok": True, "ts": time.strftime("%Y-%m-%dT%H:%M:%S")}

@router.get("/from_token")
def passport_from_token(
    access_token: str = Query(..., description="Spotify access token"),
    limit: int = Query(8, ge=1, le=20),
):
    """
    Build a passport snapshot from the user's top artists.
    Returns:
    - country_counts: {country_label -> count}
    - region_percentages: {region -> fraction}
    - total_artists
    - artists_by_country: {country_label -> [artist_name, ...]}
    """
    top = spotify_get("/me/top/artists", access_token, params={"limit": limit})
    if not isinstance(top, dict) or "items" not in top:
        raise HTTPException(status_code=400, detail=f"Could not fetch top artists: {top}")

    country_counts: Dict[str, int] = {}
    artists_by_country: Dict[str, List[str]] = {}
    total_artists = 0

    for artist in top["items"]:
        name = (artist or {}).get("name")
        if not name:
            continue
        total_artists += 1
        country = infer_country_fast(name)
        country_counts[country] = country_counts.get(country, 0) + 1
        artists_by_country.setdefault(country, []).append(name)

    # Deduplicate artist lists per country and sort for nicer display
    for c, names in artists_by_country.items():
        artists_by_country[c] = sorted(sorted(set(names)), key=str.lower)

    region_percentages = rollup_regions(country_counts)
    return {
        "id": "from_token_snapshot",
        "user_id": "from_token",
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "country_counts": country_counts,
        "region_percentages": region_percentages,
        "total_artists": total_artists,
        "artists_by_country": artists_by_country,
        "note": "Fast inference; limited for speed.",
    }

@router.get("/from_token_recent")
def passport_from_token_recent(
    access_token: str = Query(..., description="Spotify access token"),
    limit: int = Query(20, ge=1, le=50),
):
    """
    Build a passport snapshot from recently played tracks (deduped by artist).
    """
    recent = spotify_get("/me/player/recently-played", access_token, params={"limit": limit})
    if "error" in recent:
        raise HTTPException(status_code=400, detail=f"Could not fetch recently played: {recent}")

    items = recent.get("items", []) if isinstance(recent, dict) else []
    names: List[str] = []
    seen = set()

    for it in items:
        track = (it or {}).get("track") or {}
        for a in track.get("artists") or []:
            nm = a.get("name")
            if nm and nm not in seen:
                seen.add(nm)
                names.append(nm)

    # Limit how many artists we bother to look up
    names = names[:12]

    country_counts: Dict[str, int] = {}
    artists_by_country: Dict[str, List[str]] = {}

    for nm in names:
        country = infer_country_fast(nm)
        country_counts[country] = country_counts.get(country, 0) + 1
        artists_by_country.setdefault(country, []).append(nm)

    for c, arr in artists_by_country.items():
        artists_by_country[c] = sorted(sorted(set(arr)), key=str.lower)

    region_percentages = rollup_regions(country_counts)
    return {
        "id": "from_recent_snapshot",
        "user_id": "from_token_recent",
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "country_counts": country_counts,
        "region_percentages": region_percentages,
        "total_artists": len(names),
        "artists_by_country": artists_by_country,
        "note": "Built from recently played; fast inference.",
    }

@router.get("/{user_id}", response_model=PassportSummaryOut)
def get_passport(user_id: str, db: Session = Depends(get_db)):
    tracks: List[models.Track] = (
        db.query(models.Track)
          .join(models.Playlist)
          .filter(models.Playlist.user_id == user_id)
          .all()
    )

    artist_ids = set()
    for t in tracks:
        for aid in (t.artist_ids or []):
            artist_ids.add(aid)

    if artist_ids:
        artists: List[models.Artist] = (
            db.query(models.Artist)
              .filter(models.Artist.spotify_artist_id.in_(list(artist_ids)))
              .all()
        )
    else:
        artists = []

    country_counts: Dict[str, int] = {}
    for a in artists:
        # DB already has origin_country; normalize it a bit just in case
        c = normalize_country_label(a.origin_country or "Unknown")
        country_counts[c] = country_counts.get(c, 0) + 1

    total = len(artists)
    region_percentages = rollup_regions(country_counts)
    passport = crud.create_passport(db, user_id, country_counts, region_percentages, total)
    return passport


