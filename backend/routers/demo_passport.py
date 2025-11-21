"""
@Author: Tyler Tristan
@Version: 1.0
@Since: 10/3/2025

Usage:
    Demo Music Passport router for Tuniverse backend.
    Provides:
        • A mock /demo_passport/{user_id} endpoint
        • Static sample country and region data
        • A placeholder share_link for UI testing

Change Log:
    Version 1.0 (11/3/2025): Added demo passport endpoint returning mock data
                             for frontend development and testing.
"""





from fastapi import APIRouter

router = APIRouter(prefix="/demo_passport", tags=["Demo"])

@router.get("/{user_id}")
def get_demo_passport(user_id: str):
    """Returns mock Music Passport data for demo purposes."""
    return {
        "user_id": user_id,
        "total_artists": 10,
        "country_counts": {
            "USA": 4,
            "UK": 3,
            "Japan": 2,
            "Brazil": 1
        },
        "region_percentages": {
            "North America": 0.4,
            "Europe": 0.3,
            "Asia": 0.2,
            "South America": 0.1
        },
        "share_link": "https://example.com/static/images/placeholder_passport.png"
    }
