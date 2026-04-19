import os
from datetime import datetime
from uuid import uuid4
from typing import List, Optional, Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import psycopg2
import psycopg2.extras


from pydantic import BaseModel

class UpdateAvatar(BaseModel):
    avatar_url: str


load_dotenv()

APP_MODE = os.getenv("APP_MODE", "real").lower()
USE_DUMMY_DATA = APP_MODE == "dummy"
DATABASE_URL = os.getenv("DATABASE_URL")

Visibility = Literal["private", "friends", "public"]
TripStatus = Literal["unstarted", "traveling", "closed"]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5176",
        "http://127.0.0.1:5176",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================
# database connection helpers
# =========================
def get_conn():
    if USE_DUMMY_DATA:
        return None

    if not DATABASE_URL:
        raise HTTPException(status_code=500, detail="DATABASE_URL is not set")

    return psycopg2.connect(DATABASE_URL)


def friendship_key(user_a: str, user_b: str):
    return tuple(sorted([user_a, user_b]))


def are_friends_dummy(user_a: str, user_b: str) -> bool:
    return friendship_key(user_a, user_b) in friendships_db


def are_friends_db(cur, user_a: str, user_b: str) -> bool:
    a, b = sorted([user_a, user_b])
    cur.execute(
        """
        SELECT 1
        FROM friendships
        WHERE user_a = %s AND user_b = %s
        LIMIT 1
        """,
        (a, b),
    )
    return cur.fetchone() is not None


def can_view_dummy(owner_id: str, viewer_id: Optional[str], visibility: str) -> bool:
    if viewer_id == owner_id:
        return True
    if visibility == "public":
        return True
    if visibility == "friends" and viewer_id and are_friends_dummy(owner_id, viewer_id):
        return True
    return False


def can_view_db(cur, owner_id: str, viewer_id: Optional[str], visibility: str) -> bool:
    if viewer_id == owner_id:
        return True
    if visibility == "public":
        return True
    if visibility == "friends" and viewer_id and are_friends_db(cur, owner_id, viewer_id):
        return True
    return False


# =========================
# dummy data
# =========================
users_db = {}
trips_db = {}
friend_requests_db = {}
friendships_db = set()

if USE_DUMMY_DATA:
    users_db = {
        "test-user-1": {
            "id": "test-user-1",
            "username": "tyler",
            "email": "tyler@test.com",
            "bio": "i like traveling",
            "avatar_url": "",
            "visibility": "public",
            "created_at": datetime.utcnow().isoformat(),
        },
        "test-user-2": {
            "id": "test-user-2",
            "username": "alex",
            "email": "alex@test.com",
            "bio": "planning trips and sharing routes",
            "avatar_url": "",
            "visibility": "public",
            "created_at": datetime.utcnow().isoformat(),
        },
    }

    trips_db = {
        "trip-1": {
            "id": "trip-1",
            "user_id": "test-user-1",
            "title": "Japan Trip",
            "description": "Kyoto to Fukuoka",
            "start_location_name": "Kyoto",
            "start_lat": 35.0116,
            "start_lng": 135.7681,
            "status": "traveling",
            "visibility": "public",
            "created_at": datetime.utcnow().isoformat(),
            "legs": [
                {
                    "id": "leg-1",
                    "trip_id": "trip-1",
                    "order_index": 0,
                    "location_name": "Osaka",
                    "lat": 34.6937,
                    "lng": 135.5023,
                    "start_time": "2026-04-01T10:00:00",
                    "caption": "first stop",
                    "media_urls": [],
                },
                {
                    "id": "leg-2",
                    "trip_id": "trip-1",
                    "order_index": 1,
                    "location_name": "Hakata",
                    "lat": 33.5902,
                    "lng": 130.4017,
                    "start_time": "2026-04-02T10:00:00",
                    "caption": "final stop",
                    "media_urls": [],
                },
            ],
        }
    }

    friend_requests_db = {
        "request-1": {
            "id": "request-1",
            "sender_id": "test-user-2",
            "receiver_id": "test-user-1",
            "sender_username": "alex",
            "receiver_username": "tyler",
            "status": "pending",
            "created_at": datetime.utcnow().isoformat(),
        }
    }

    friendships_db = set()


# =========================
# pydantic models
# =========================
class TripLegCreate(BaseModel):
    order_index: int
    location_name: str
    lat: float
    lng: float
    start_time: str
    caption: Optional[str] = ""
    media_urls: List[str] = []


class TripCreate(BaseModel):
    user_id: str
    title: str
    description: Optional[str] = ""
    start_location_name: str
    start_lat: float
    start_lng: float
    status: TripStatus
    visibility: Visibility
    legs: List[TripLegCreate]


class FriendRequestCreate(BaseModel):
    sender_id: str
    target_username: str


class FriendRequestUpdate(BaseModel):
    status: Literal["accepted", "declined"]


class UserProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    tagline: Optional[str] = None
    date_of_birth: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    cover_photo_url: Optional[str] = None
    website: Optional[str] = None


# =========================
# serialization helpers
# =========================
def serialize_profile_row(row):
    return {
        "id": str(row["id"]),
        "username": row["username"],
        "email": row.get("email"),
        "bio": row.get("bio") or "",
        "avatar_url": row.get("avatar_url") or "",
        "visibility": row.get("visibility") or "public",
        "created_at": row.get("created_at").isoformat() if row.get("created_at") else None,
    }


def fetch_trip_media_map(cur, leg_ids: List[str]):
    if not leg_ids:
        return {}

    cur.execute(
        """
        SELECT leg_id, media_url
        FROM trip_leg_media
        WHERE leg_id = ANY(%s::uuid[])
        ORDER BY id
        """,
        (leg_ids,),
    )
    rows = cur.fetchall()

    media_map = {}
    for row in rows:
        leg_id = str(row["leg_id"])
        media_map.setdefault(leg_id, []).append(row["media_url"])
    return media_map


def fetch_trip_by_id_db(cur, trip_id: str):
    cur.execute(
        """
        SELECT id, user_id, title, description,
               start_location_name, start_lat, start_lng,
               status, visibility, created_at
        FROM trips
        WHERE id = %s
        """,
        (trip_id,),
    )
    trip_row = cur.fetchone()
    if not trip_row:
        return None

    cur.execute(
        """
        SELECT id, trip_id, order_index, location_name, lat, lng, start_time, caption
        FROM trip_legs
        WHERE trip_id = %s
        ORDER BY order_index
        """,
        (trip_id,),
    )
    leg_rows = cur.fetchall()
    leg_ids = [str(row["id"]) for row in leg_rows]
    media_map = fetch_trip_media_map(cur, leg_ids)

    legs = []
    for leg in leg_rows:
        leg_id = str(leg["id"])
        legs.append(
            {
                "id": leg_id,
                "trip_id": str(leg["trip_id"]),
                "order_index": leg["order_index"],
                "location_name": leg["location_name"],
                "lat": float(leg["lat"]),
                "lng": float(leg["lng"]),
                "start_time": leg["start_time"].isoformat() if leg["start_time"] else "",
                "caption": leg["caption"] or "",
                "media_urls": media_map.get(leg_id, []),
            }
        )

    return {
        "id": str(trip_row["id"]),
        "user_id": str(trip_row["user_id"]),
        "title": trip_row["title"],
        "description": trip_row["description"] or "",
        "start_location_name": trip_row["start_location_name"] or "",
        "start_lat": float(trip_row["start_lat"]) if trip_row["start_lat"] is not None else 0.0,
        "start_lng": float(trip_row["start_lng"]) if trip_row["start_lng"] is not None else 0.0,
        "status": trip_row["status"],
        "visibility": trip_row["visibility"],
        "created_at": trip_row["created_at"].isoformat() if trip_row["created_at"] else None,
        "legs": legs,
    }


# =========================
# routes
# =========================
@app.get("/")
async def root():
    return {"message": "Hello World", "app_mode": APP_MODE}


@app.get("/markers")
async def get_markers():
    markers = [{"lat": 29.6516, "lng": -82.3248}, {"lat": 29, "lng": -82}]
    return {"markers": markers}


@app.get("/profiles/{user_id}")
async def get_profile(user_id: str, viewer_id: Optional[str] = None):
    if USE_DUMMY_DATA:
        profile = users_db.get(user_id)
        if not profile:
            raise HTTPException(status_code=404, detail="profile not found")
        if not can_view_dummy(user_id, viewer_id, profile["visibility"]):
            raise HTTPException(status_code=403, detail="not allowed to view profile")
        return profile

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, username, email, bio, avatar_url, visibility, created_at
                FROM users
                WHERE id = %s
                """,
                (user_id,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="profile not found")

            if not can_view_db(cur, user_id, viewer_id, row["visibility"]):
                raise HTTPException(status_code=403, detail="not allowed to view profile")

            return serialize_profile_row(row)
    finally:
        conn.close()


@app.get("/profiles/{user_id}/trips")
async def get_profile_trips(user_id: str, viewer_id: Optional[str] = None):
    if USE_DUMMY_DATA:
        profile = users_db.get(user_id)
        if not profile:
            raise HTTPException(status_code=404, detail="profile not found")

        visible = []
        for trip in trips_db.values():
            if trip["user_id"] == user_id and can_view_dummy(user_id, viewer_id, trip["visibility"]):
                visible.append(trip)
        return visible

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, visibility
                FROM users
                WHERE id = %s
                """,
                (user_id,),
            )
            owner = cur.fetchone()
            if not owner:
                raise HTTPException(status_code=404, detail="profile not found")

            cur.execute(
                """
                SELECT id
                FROM trips
                WHERE user_id = %s
                ORDER BY created_at DESC
                """,
                (user_id,),
            )
            trip_ids = [str(row["id"]) for row in cur.fetchall()]

            results = []
            for trip_id in trip_ids:
                trip = fetch_trip_by_id_db(cur, trip_id)
                if trip and can_view_db(cur, user_id, viewer_id, trip["visibility"]):
                    results.append(trip)

            return results
    finally:
        conn.close()


@app.get("/trips/{trip_id}")
async def get_trip(trip_id: str, viewer_id: Optional[str] = None):
    if USE_DUMMY_DATA:
        trip = trips_db.get(trip_id)
        if not trip:
            raise HTTPException(status_code=404, detail="trip not found")
        if not can_view_dummy(trip["user_id"], viewer_id, trip["visibility"]):
            raise HTTPException(status_code=403, detail="not allowed to view trip")
        return trip

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            trip = fetch_trip_by_id_db(cur, trip_id)
            if not trip:
                raise HTTPException(status_code=404, detail="trip not found")

            if not can_view_db(cur, trip["user_id"], viewer_id, trip["visibility"]):
                raise HTTPException(status_code=403, detail="not allowed to view trip")

            return trip
    finally:
        conn.close()


@app.post("/trips")
async def create_trip(trip: TripCreate):
    if USE_DUMMY_DATA:
        trip_id = str(uuid4())

        created_trip = {
            "id": trip_id,
            "user_id": trip.user_id,
            "title": trip.title,
            "description": trip.description,
            "start_location_name": trip.start_location_name,
            "start_lat": trip.start_lat,
            "start_lng": trip.start_lng,
            "status": trip.status,
            "visibility": trip.visibility,
            "created_at": datetime.utcnow().isoformat(),
            "legs": [],
        }

        for leg in trip.legs:
            created_trip["legs"].append(
                {
                    "id": str(uuid4()),
                    "trip_id": trip_id,
                    "order_index": leg.order_index,
                    "location_name": leg.location_name,
                    "lat": leg.lat,
                    "lng": leg.lng,
                    "start_time": leg.start_time,
                    "caption": leg.caption,
                    "media_urls": leg.media_urls,
                }
            )

        trips_db[trip_id] = created_trip
        return {"id": trip_id}

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT id FROM users WHERE id = %s", (trip.user_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="user not found")

            cur.execute(
                """
                INSERT INTO trips (
                    user_id, title, description,
                    start_location_name, start_lat, start_lng,
                    status, visibility
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    trip.user_id,
                    trip.title,
                    trip.description,
                    trip.start_location_name,
                    trip.start_lat,
                    trip.start_lng,
                    trip.status,
                    trip.visibility,
                ),
            )
            trip_id = str(cur.fetchone()["id"])

            for leg in trip.legs:
                cur.execute(
                    """
                    INSERT INTO trip_legs (
                        trip_id, order_index, location_name,
                        lat, lng, start_time, caption
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (
                        trip_id,
                        leg.order_index,
                        leg.location_name,
                        leg.lat,
                        leg.lng,
                        leg.start_time if leg.start_time else None,
                        leg.caption,
                    ),
                )
                leg_id = str(cur.fetchone()["id"])

                for media_url in leg.media_urls:
                    cur.execute(
                        """
                        INSERT INTO trip_leg_media (leg_id, media_url)
                        VALUES (%s, %s)
                        """,
                        (leg_id, media_url),
                    )

            conn.commit()
            return {"id": trip_id}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@app.put("/trips/{trip_id}")
async def update_trip(trip_id: str, trip: TripCreate):
    if USE_DUMMY_DATA:
        if trip_id not in trips_db:
            raise HTTPException(status_code=404, detail="trip not found")

        updated_trip = {
            "id": trip_id,
            "user_id": trip.user_id,
            "title": trip.title,
            "description": trip.description,
            "start_location_name": trip.start_location_name,
            "start_lat": trip.start_lat,
            "start_lng": trip.start_lng,
            "status": trip.status,
            "visibility": trip.visibility,
            "created_at": trips_db[trip_id].get("created_at"),
            "legs": [],
        }

        for leg in trip.legs:
            updated_trip["legs"].append(
                {
                    "id": str(uuid4()),
                    "trip_id": trip_id,
                    "order_index": leg.order_index,
                    "location_name": leg.location_name,
                    "lat": leg.lat,
                    "lng": leg.lng,
                    "start_time": leg.start_time,
                    "caption": leg.caption,
                    "media_urls": leg.media_urls,
                }
            )

        trips_db[trip_id] = updated_trip
        return updated_trip

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT id FROM trips WHERE id = %s", (trip_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="trip not found")

            cur.execute(
                """
                UPDATE trips
                SET user_id = %s,
                    title = %s,
                    description = %s,
                    start_location_name = %s,
                    start_lat = %s,
                    start_lng = %s,
                    status = %s,
                    visibility = %s
                WHERE id = %s
                """,
                (
                    trip.user_id,
                    trip.title,
                    trip.description,
                    trip.start_location_name,
                    trip.start_lat,
                    trip.start_lng,
                    trip.status,
                    trip.visibility,
                    trip_id,
                ),
            )

            cur.execute("SELECT id FROM trip_legs WHERE trip_id = %s", (trip_id,))
            old_leg_ids = [str(row["id"]) for row in cur.fetchall()]

            if old_leg_ids:
                cur.execute("DELETE FROM trip_leg_media WHERE leg_id = ANY(%s::uuid[])", (old_leg_ids,))
            cur.execute("DELETE FROM trip_legs WHERE trip_id = %s", (trip_id,))

            for leg in trip.legs:
                cur.execute(
                    """
                    INSERT INTO trip_legs (
                        trip_id, order_index, location_name,
                        lat, lng, start_time, caption
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (
                        trip_id,
                        leg.order_index,
                        leg.location_name,
                        leg.lat,
                        leg.lng,
                        leg.start_time if leg.start_time else None,
                        leg.caption,
                    ),
                )
                leg_id = str(cur.fetchone()["id"])

                for media_url in leg.media_urls:
                    cur.execute(
                        """
                        INSERT INTO trip_leg_media (leg_id, media_url)
                        VALUES (%s, %s)
                        """,
                        (leg_id, media_url),
                    )

            conn.commit()

            refreshed = fetch_trip_by_id_db(cur, trip_id)
            if not refreshed:
                raise HTTPException(status_code=404, detail="trip not found after update")
            return refreshed
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@app.get("/friends/{user_id}")
async def get_friends(user_id: str):
    if USE_DUMMY_DATA:
        results = []
        for a, b in friendships_db:
            friend_id = b if a == user_id else a if b == user_id else None
            if friend_id and friend_id in users_db:
                friend = users_db[friend_id]
                results.append(
                    {
                        "id": friend["id"],
                        "username": friend["username"],
                        "avatar_url": friend.get("avatar_url", ""),
                    }
                )
        return results

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT u.id, u.username, u.avatar_url
                FROM friendships f
                JOIN users u
                  ON u.id = CASE
                      WHEN f.user_a = %s THEN f.user_b
                      WHEN f.user_b = %s THEN f.user_a
                  END
                WHERE f.user_a = %s OR f.user_b = %s
                """,
                (user_id, user_id, user_id, user_id),
            )
            rows = cur.fetchall()
            return [
                {
                    "id": str(row["id"]),
                    "username": row["username"],
                    "avatar_url": row.get("avatar_url") or "",
                }
                for row in rows
            ]
    finally:
        conn.close()


@app.get("/friend-requests/{user_id}")
async def get_friend_requests(user_id: str):
    if USE_DUMMY_DATA:
        return [
            req
            for req in friend_requests_db.values()
            if req["receiver_id"] == user_id and req["status"] == "pending"
        ]

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT fr.id, fr.sender_id, fr.receiver_id, fr.status, fr.created_at,
                       s.username AS sender_username,
                       r.username AS receiver_username
                FROM friend_requests fr
                JOIN users s ON s.id = fr.sender_id
                JOIN users r ON r.id = fr.receiver_id
                WHERE fr.receiver_id = %s AND fr.status = 'pending'
                ORDER BY fr.created_at DESC
                """,
                (user_id,),
            )
            rows = cur.fetchall()
            return [
                {
                    "id": str(row["id"]),
                    "sender_id": str(row["sender_id"]),
                    "receiver_id": str(row["receiver_id"]),
                    "sender_username": row["sender_username"],
                    "receiver_username": row["receiver_username"],
                    "status": row["status"],
                    "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                }
                for row in rows
            ]
    finally:
        conn.close()


@app.post("/friend-requests")
async def create_friend_request(payload: FriendRequestCreate):
    if USE_DUMMY_DATA:
        sender = users_db.get(payload.sender_id)
        if not sender:
            raise HTTPException(status_code=404, detail="sender not found")

        receiver = None
        for user in users_db.values():
            if user["username"] == payload.target_username:
                receiver = user
                break

        if not receiver:
            raise HTTPException(status_code=404, detail="target user not found")

        if receiver["id"] == payload.sender_id:
            raise HTTPException(status_code=400, detail="cannot friend yourself")

        request_id = str(uuid4())
        friend_requests_db[request_id] = {
            "id": request_id,
            "sender_id": payload.sender_id,
            "receiver_id": receiver["id"],
            "sender_username": sender["username"],
            "receiver_username": receiver["username"],
            "status": "pending",
            "created_at": datetime.utcnow().isoformat(),
        }
        return friend_requests_db[request_id]

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT id, username FROM users WHERE id = %s",
                (payload.sender_id,),
            )
            sender = cur.fetchone()
            if not sender:
                raise HTTPException(status_code=404, detail="sender not found")

            cur.execute(
                "SELECT id, username FROM users WHERE username = %s",
                (payload.target_username,),
            )
            receiver = cur.fetchone()
            if not receiver:
                raise HTTPException(status_code=404, detail="target user not found")

            if str(receiver["id"]) == payload.sender_id:
                raise HTTPException(status_code=400, detail="cannot friend yourself")

            a, b = sorted([payload.sender_id, str(receiver["id"])])
            cur.execute(
                """
                SELECT 1 FROM friendships
                WHERE user_a = %s AND user_b = %s
                LIMIT 1
                """,
                (a, b),
            )
            if cur.fetchone():
                raise HTTPException(status_code=400, detail="already friends")

            cur.execute(
                """
                SELECT 1
                FROM friend_requests
                WHERE (
                    sender_id = %s AND receiver_id = %s
                ) OR (
                    sender_id = %s AND receiver_id = %s
                )
                AND status = 'pending'
                LIMIT 1
                """,
                (payload.sender_id, receiver["id"], receiver["id"], payload.sender_id),
            )
            if cur.fetchone():
                raise HTTPException(status_code=400, detail="request already pending")

            cur.execute(
                """
                INSERT INTO friend_requests (sender_id, receiver_id, status)
                VALUES (%s, %s, 'pending')
                RETURNING id, created_at
                """,
                (payload.sender_id, receiver["id"]),
            )
            inserted = cur.fetchone()
            conn.commit()

            return {
                "id": str(inserted["id"]),
                "sender_id": payload.sender_id,
                "receiver_id": str(receiver["id"]),
                "sender_username": sender["username"],
                "receiver_username": receiver["username"],
                "status": "pending",
                "created_at": inserted["created_at"].isoformat() if inserted["created_at"] else None,
            }
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@app.patch("/friend-requests/{request_id}")
async def update_friend_request(request_id: str, update: FriendRequestUpdate):
    if USE_DUMMY_DATA:
        req = friend_requests_db.get(request_id)
        if not req:
            raise HTTPException(status_code=404, detail="request not found")

        req["status"] = update.status

        if update.status == "accepted":
            friendships_db.add(friendship_key(req["sender_id"], req["receiver_id"]))

        return req

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, sender_id, receiver_id, status
                FROM friend_requests
                WHERE id = %s
                """,
                (request_id,),
            )
            req = cur.fetchone()
            if not req:
                raise HTTPException(status_code=404, detail="request not found")

            cur.execute(
                """
                UPDATE friend_requests
                SET status = %s
                WHERE id = %s
                """,
                (update.status, request_id),
            )

            if update.status == "accepted":
                a, b = sorted([str(req["sender_id"]), str(req["receiver_id"])])
                cur.execute(
                    """
                    INSERT INTO friendships (user_a, user_b)
                    VALUES (%s, %s)
                    ON CONFLICT (user_a, user_b) DO NOTHING
                    """,
                    (a, b),
                )

            conn.commit()

            cur.execute(
                """
                SELECT fr.id, fr.sender_id, fr.receiver_id, fr.status, fr.created_at,
                       s.username AS sender_username,
                       r.username AS receiver_username
                FROM friend_requests fr
                JOIN users s ON s.id = fr.sender_id
                JOIN users r ON r.id = fr.receiver_id
                WHERE fr.id = %s
                """,
                (request_id,),
            )
            row = cur.fetchone()

            return {
                "id": str(row["id"]),
                "sender_id": str(row["sender_id"]),
                "receiver_id": str(row["receiver_id"]),
                "sender_username": row["sender_username"],
                "receiver_username": row["receiver_username"],
                "status": row["status"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            }
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@app.get("/user-profiles/{user_id}")
async def get_user_profile(user_id: str):
    """Get user profile data from user_profiles table"""
    if USE_DUMMY_DATA:
        raise HTTPException(status_code=501, detail="user profiles not implemented in dummy mode")

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT user_id, display_name, tagline, date_of_birth,
                       city, country, cover_photo_url, website
                FROM user_profiles
                WHERE user_id = %s
                """,
                (user_id,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="user profile not found")

            return {
                "user_id": str(row["user_id"]),
                "display_name": row.get("display_name") or "",
                "tagline": row.get("tagline") or "",
                "date_of_birth": row["date_of_birth"].isoformat() if row.get("date_of_birth") else None,
                "city": row.get("city") or "",
                "country": row.get("country") or "",
                "cover_photo_url": row.get("cover_photo_url") or "",
                "website": row.get("website") or "",
            }
    finally:
        conn.close()


@app.put("/user-profiles/{user_id}")
async def update_user_profile(user_id: str, profile: UserProfileUpdate):
    """Update user profile data"""
    if USE_DUMMY_DATA:
        raise HTTPException(status_code=501, detail="user profiles not implemented in dummy mode")

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Build dynamic update query based on provided fields
            update_fields = []
            values = []

            if profile.display_name is not None:
                update_fields.append("display_name = %s")
                values.append(profile.display_name)
            if profile.tagline is not None:
                update_fields.append("tagline = %s")
                values.append(profile.tagline)
            if profile.date_of_birth is not None:
                update_fields.append("date_of_birth = %s")
                values.append(profile.date_of_birth if profile.date_of_birth else None)
            if profile.city is not None:
                update_fields.append("city = %s")
                values.append(profile.city)
            if profile.country is not None:
                update_fields.append("country = %s")
                values.append(profile.country)
            if profile.cover_photo_url is not None:
                update_fields.append("cover_photo_url = %s")
                values.append(profile.cover_photo_url)
            if profile.website is not None:
                update_fields.append("website = %s")
                values.append(profile.website)

            if not update_fields:
                raise HTTPException(status_code=400, detail="no fields to update")

            values.append(user_id)
            query = f"""
                UPDATE user_profiles
                SET {', '.join(update_fields)}
                WHERE user_id = %s
                RETURNING user_id, display_name, tagline, date_of_birth,
                          city, country, cover_photo_url, website
            """

            cur.execute(query, values)
            row = cur.fetchone()

            if not row:
                raise HTTPException(status_code=404, detail="user profile not found")

            conn.commit()

            return {
                "user_id": str(row["user_id"]),
                "display_name": row.get("display_name") or "",
                "tagline": row.get("tagline") or "",
                "date_of_birth": row["date_of_birth"].isoformat() if row.get("date_of_birth") else None,
                "city": row.get("city") or "",
                "country": row.get("country") or "",
                "cover_photo_url": row.get("cover_photo_url") or "",
                "website": row.get("website") or "",
            }
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

@app.get("/feed/{viewer_id}")
async def get_feed(viewer_id: str):
    if USE_DUMMY_DATA:
        visible = []
        for trip in trips_db.values():
            if can_view_dummy(trip["user_id"], viewer_id, trip["visibility"]):
                trip_copy = dict(trip)
                author = users_db.get(trip["user_id"])
                trip_copy["author_username"] = author["username"] if author else "unknown"
                trip_copy["author_avatar_url"] = author.get("avatar_url", "") if author else ""
                visible.append(trip_copy)

        visible.sort(key=lambda t: t.get("created_at", ""), reverse=True)
        return visible[:10]

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id
                FROM trips
                ORDER BY created_at DESC
                LIMIT 50
                """
            )
            trip_ids = [str(row["id"]) for row in cur.fetchall()]

            results = []
            for trip_id in trip_ids:
                trip = fetch_trip_by_id_db(cur, trip_id)
                if trip and can_view_db(cur, trip["user_id"], viewer_id, trip["visibility"]):
                    cur.execute(
                        """
                        SELECT u.username,
                            u.avatar_url,
                            up.display_name
                        FROM users u
                        LEFT JOIN user_profiles up
                        ON up.user_id = u.id
                        WHERE u.id = %s
                        """,
                        (trip["user_id"],),
                    )
                    author = cur.fetchone()

                    trip["author_username"] = (
                        author["display_name"]
                        if author and author.get("display_name")
                        else author["username"]
                        if author
                        else "unknown"
                    )
                    trip["author_avatar_url"] = author["avatar_url"] if author and author["avatar_url"] else ""
                    trip["author_id"] = trip["user_id"]

                    results.append(trip)

                if len(results) >= 10:
                    break

            return results
    finally:
        conn.close()



@app.patch("/profiles/{user_id}/avatar")
async def update_avatar(user_id: str, payload: UpdateAvatar):
    if USE_DUMMY_DATA:
        if user_id not in users_db:
            raise HTTPException(status_code=404, detail="user not found")

        users_db[user_id]["avatar_url"] = payload.avatar_url
        return users_db[user_id]

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                UPDATE users
                SET avatar_url = %s
                WHERE id = %s
                """,
                (payload.avatar_url, user_id),
            )
            conn.commit()

            cur.execute(
                """
                SELECT id, username, email, bio, avatar_url, visibility, created_at
                FROM users
                WHERE id = %s
                """,
                (user_id,),
            )
            row = cur.fetchone()

            if not row:
                raise HTTPException(status_code=404, detail="user not found")

            return serialize_profile_row(row)
    finally:
        conn.close()

@app.get("/map/{viewer_id}")
async def get_map_trips(viewer_id: str):
    if USE_DUMMY_DATA:
        results = []

        for trip in trips_db.values():
            if not can_view_dummy(trip["user_id"], viewer_id, trip["visibility"]):
                continue

            trip_copy = dict(trip)

            if trip["user_id"] == viewer_id:
                trip_copy["viewer_relation"] = "own"
            elif are_friends_dummy(trip["user_id"], viewer_id):
                trip_copy["viewer_relation"] = "friend"
            else:
                trip_copy["viewer_relation"] = "public"

            results.append(trip_copy)

        return results

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id
                FROM trips
                ORDER BY created_at DESC
                LIMIT 300
                """
            )
            trip_ids = [str(row["id"]) for row in cur.fetchall()]

            results = []
            for trip_id in trip_ids:
                trip = fetch_trip_by_id_db(cur, trip_id)
                if not trip:
                    continue

                if not can_view_db(cur, trip["user_id"], viewer_id, trip["visibility"]):
                    continue

                if trip["user_id"] == viewer_id:
                    trip["viewer_relation"] = "own"
                elif are_friends_db(cur, trip["user_id"], viewer_id):
                    trip["viewer_relation"] = "friend"
                else:
                    trip["viewer_relation"] = "public"

                results.append(trip)

            return results
    finally:
        conn.close()