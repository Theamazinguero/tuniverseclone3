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

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# backend is a package, so we use relative imports
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
from . import spotify_auth  # <-- this is backend/spotify_auth.py

app = FastAPI()

# CORS so the web-ui on localhost:5500 can talk to backend:8000
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # you can tighten this later
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers, including spotify_auth
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
    spotify_auth.router,  # <-- adds /auth/login, /auth/callback, /spotify/me, etc.
]:
    app.include_router(router)


@app.get("/")
def root():
    return {"status": "Tuniverse backend running"}
