from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Hello World"}

@app.get("/markers")
async def get_markers():
    markers = [{"lat": 29.6516, "lng": -82.3248}, {"lat": 29, "lng": -82}]
    return {"markers": markers}