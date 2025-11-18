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

# backend/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# main.py lives inside the "backend" package, so we import from .routers
from .routers import (
    admin,
    artists,
    community,
    compare,
    demo_passport,
    passport,
    playlists,
    spotify,
    users,
)

app = FastAPI()

# Allow frontend (localhost:5500) to call the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers
for router in [
    admin.router,
    artists.router,
    community.router,
    compare.router,
    demo_passport.router,
    passport.router,
    playlists.router,
    spotify.router,
    users.router,
]:
    app.include_router(router)


@app.get("/")
def root():
    return {"status": "Tuniverse backend running"}


