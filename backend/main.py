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

from backend.routers import community
from backend.routers import spotify   # <-- REQUIRED NOW

app = FastAPI()

# CORS needed so frontend can call backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(community.router)
app.include_router(spotify.router)


@app.get("/")
def root():
    return {"status": "Tuniverse backend running"}

