import os
from datetime import datetime
from uuid import uuid4
from typing import List, Optional, Literal, Dict, Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import psycopg2
import psycopg2.extras

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
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
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


def is_admin_dummy(user_id: Optional[str]) -> bool:
    return user_id == "test-user-1"


def is_admin_db(cur, user_id: Optional[str]) -> bool:
    if not user_id:
        return False

    cur.execute(
        """
        SELECT COALESCE(is_admin, false) AS is_admin
        FROM users
        WHERE id = %s
        """,
        (user_id,),
    )
    row = cur.fetchone()
    return bool(row and row["is_admin"])


def is_suspended_db(cur, user_id: Optional[str]) -> bool:
    if not user_id:
        return False

    cur.execute(
        """
        SELECT COALESCE(is_suspended, false) AS is_suspended
        FROM users
        WHERE id = %s
        """,
        (user_id,),
    )
    row = cur.fetchone()
    return bool(row and row["is_suspended"])


def ensure_active_user_db(cur, user_id: Optional[str]):
    if user_id and is_suspended_db(cur, user_id):
        raise HTTPException(status_code=403, detail="user is suspended")


def require_admin_db(cur, actor_id: Optional[str]):
    if not actor_id or not is_admin_db(cur, actor_id):
        raise HTTPException(status_code=403, detail="admin access required")


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
    if viewer_id and is_admin_dummy(viewer_id):
        return True
    if viewer_id == owner_id:
        return True
    if visibility == "public":
        return True
    if visibility == "friends" and viewer_id and are_friends_dummy(owner_id, viewer_id):
        return True
    return False


def can_view_db(cur, owner_id: str, viewer_id: Optional[str], visibility: str) -> bool:
    if viewer_id and is_admin_db(cur, viewer_id):
        return True
    if viewer_id == owner_id:
        return True
    if visibility == "public":
        return True
    if visibility == "friends" and viewer_id and are_friends_db(cur, owner_id, viewer_id):
        return True
    return False


def can_view_trip_record_dummy(
    owner_id: str,
    viewer_id: Optional[str],
    visibility: str,
    is_hidden: bool = False,
) -> bool:
    if viewer_id and is_admin_dummy(viewer_id):
        return True
    if viewer_id == owner_id:
        return True
    if is_hidden:
        return False
    return can_view_dummy(owner_id, viewer_id, visibility)


def can_view_trip_record_db(
    cur,
    owner_id: str,
    viewer_id: Optional[str],
    visibility: str,
    is_hidden: bool = False,
) -> bool:
    if viewer_id and is_admin_db(cur, viewer_id):
        return True
    if viewer_id == owner_id:
        return True
    if is_hidden:
        return False
    return can_view_db(cur, owner_id, viewer_id, visibility)


# =========================
# dummy data
# =========================
users_db: Dict[str, Dict[str, Any]] = {}
trips_db: Dict[str, Dict[str, Any]] = {}
friend_requests_db: Dict[str, Dict[str, Any]] = {}
friendships_db = set()
comments_db: Dict[str, Dict[str, Any]] = {}
comment_likes_db = set()

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
            "is_admin": True,
            "is_suspended": False,
        },
        "test-user-2": {
            "id": "test-user-2",
            "username": "alex",
            "email": "alex@test.com",
            "bio": "planning trips and sharing routes",
            "avatar_url": "",
            "visibility": "public",
            "created_at": datetime.utcnow().isoformat(),
            "is_admin": False,
            "is_suspended": False,
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
            "is_hidden": False,
            "hidden_reason": None,
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
    comments_db = {}
    comment_likes_db = set()


# =========================
# pydantic models
# =========================
class UpdateAvatar(BaseModel):
    avatar_url: str


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


class CommentCreate(BaseModel):
    user_id: str
    body: str


class CommentLikePayload(BaseModel):
    user_id: str


class AdminTripHidePayload(BaseModel):
    actor_id: str
    is_hidden: bool
    hidden_reason: Optional[str] = None


class AdminUserSuspendPayload(BaseModel):
    actor_id: str
    is_suspended: bool


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
        "is_admin": bool(row.get("is_admin", False)),
        "is_suspended": bool(row.get("is_suspended", False)),
    }


def fetch_trip_like_meta_db(cur, trip_id: str, viewer_id: Optional[str]):
    cur.execute(
        """
        SELECT
            COALESCE((SELECT COUNT(*)::int FROM trip_likes WHERE trip_id = %s::uuid), 0) AS like_count,
            CASE
                WHEN %s IS NULL THEN false
                ELSE EXISTS(
                    SELECT 1
                    FROM trip_likes
                    WHERE trip_id = %s::uuid
                      AND user_id = %s::uuid
                )
            END AS liked_by_viewer
        """,
        (trip_id, viewer_id, trip_id, viewer_id),
    )
    row = cur.fetchone()
    return {
        "like_count": int(row["like_count"] or 0),
        "liked_by_viewer": bool(row["liked_by_viewer"]),
    }


def fetch_leg_like_meta_map_db(cur, leg_ids: List[str], viewer_id: Optional[str]):
    if not leg_ids:
        return {}

    cur.execute(
        """
        SELECT
            tl.id AS leg_id,
            COALESCE(ll.like_count, 0) AS like_count,
            CASE
                WHEN %s IS NULL THEN false
                ELSE EXISTS(
                    SELECT 1
                    FROM leg_likes lx
                    WHERE lx.leg_id = tl.id
                      AND lx.user_id = %s::uuid
                )
            END AS liked_by_viewer
        FROM trip_legs tl
        LEFT JOIN (
            SELECT leg_id, COUNT(*)::int AS like_count
            FROM leg_likes
            WHERE leg_id = ANY(%s::uuid[])
            GROUP BY leg_id
        ) ll
          ON ll.leg_id = tl.id
        WHERE tl.id = ANY(%s::uuid[])
        """,
        (viewer_id, viewer_id, leg_ids, leg_ids),
    )
    rows = cur.fetchall()

    meta_map = {}
    for row in rows:
        meta_map[str(row["leg_id"])] = {
            "like_count": int(row["like_count"] or 0),
            "liked_by_viewer": bool(row["liked_by_viewer"]),
        }
    return meta_map

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


def fetch_trip_by_id_db(cur, trip_id: str, viewer_id: Optional[str] = None):
    cur.execute(
        """
        SELECT id, user_id, title, description,
               start_location_name, start_lat, start_lng,
               status, visibility, created_at,
               COALESCE(is_hidden, false) AS is_hidden,
               hidden_reason
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
    leg_like_map = fetch_leg_like_meta_map_db(cur, leg_ids, viewer_id)
    trip_like_meta = fetch_trip_like_meta_db(cur, trip_id, viewer_id)

    legs = []
    for leg in leg_rows:
        leg_id = str(leg["id"])
        like_meta = leg_like_map.get(leg_id, {"like_count": 0, "liked_by_viewer": False})

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
                "like_count": like_meta["like_count"],
                "liked_by_viewer": like_meta["liked_by_viewer"],
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
        "is_hidden": bool(trip_row["is_hidden"]),
        "hidden_reason": trip_row["hidden_reason"],
        "like_count": trip_like_meta["like_count"],
        "liked_by_viewer": trip_like_meta["liked_by_viewer"],
        "legs": legs,
    }

def build_comment_response(row, viewer_id: Optional[str], viewer_is_admin: bool = False):
    author_display_name = row.get("author_display_name") or row.get("username") or "unknown"
    author_avatar_url = row.get("author_avatar_url") or ""
    author_id = str(row["author_id"])
    can_delete = bool(viewer_is_admin or (viewer_id and viewer_id == author_id))

    return {
        "id": str(row["id"]),
        "body": row["body"],
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
        "author_id": author_id,
        "author_display_name": author_display_name,
        "author_avatar_url": author_avatar_url,
        "like_count": int(row.get("like_count") or 0),
        "liked_by_viewer": bool(row.get("liked_by_viewer") or False),
        "trip_id": str(row["trip_id"]) if row.get("trip_id") else None,
        "leg_id": str(row["leg_id"]) if row.get("leg_id") else None,
        "trip_title": row.get("trip_title"),
        "leg_title": row.get("leg_title"),
        "can_delete": can_delete,
    }


def fetch_trip_comments_db(cur, trip_id: str, viewer_id: Optional[str]):
    viewer_is_admin = is_admin_db(cur, viewer_id)
    cur.execute(
        """
        SELECT
            c.id,
            c.body,
            c.created_at,
            c.updated_at,
            c.user_id AS author_id,
            c.trip_id,
            c.leg_id,
            u.username,
            u.avatar_url AS author_avatar_url,
            up.display_name AS author_display_name,
            t.title AS trip_title,
            NULL::text AS leg_title,
            COALESCE(
                (SELECT COUNT(*)::int FROM comment_likes cl WHERE cl.comment_id = c.id),
                0
            ) AS like_count,
            CASE
                WHEN %s IS NULL THEN false
                ELSE EXISTS(
                    SELECT 1
                    FROM comment_likes clv
                    WHERE clv.comment_id = c.id
                      AND clv.user_id = %s::uuid
                )
            END AS liked_by_viewer
        FROM comments c
        JOIN users u ON u.id = c.user_id
        LEFT JOIN user_profiles up ON up.user_id = u.id
        JOIN trips t ON t.id = c.trip_id
        WHERE c.trip_id = %s::uuid
        ORDER BY c.created_at DESC
        """,
        (viewer_id, viewer_id, trip_id),
    )
    rows = cur.fetchall()
    return [build_comment_response(row, viewer_id, viewer_is_admin) for row in rows]


def fetch_leg_comments_db(cur, leg_id: str, viewer_id: Optional[str]):
    viewer_is_admin = is_admin_db(cur, viewer_id)
    cur.execute(
        """
        SELECT
            c.id,
            c.body,
            c.created_at,
            c.updated_at,
            c.user_id AS author_id,
            c.trip_id,
            c.leg_id,
            u.username,
            u.avatar_url AS author_avatar_url,
            up.display_name AS author_display_name,
            t.title AS trip_title,
            tl.location_name AS leg_title,
            COALESCE(
                (SELECT COUNT(*)::int FROM comment_likes cl WHERE cl.comment_id = c.id),
                0
            ) AS like_count,
            CASE
                WHEN %s IS NULL THEN false
                ELSE EXISTS(
                    SELECT 1
                    FROM comment_likes clv
                    WHERE clv.comment_id = c.id
                      AND clv.user_id = %s::uuid
                )
            END AS liked_by_viewer
        FROM comments c
        JOIN users u ON u.id = c.user_id
        LEFT JOIN user_profiles up ON up.user_id = u.id
        JOIN trip_legs tl ON tl.id = c.leg_id
        JOIN trips t ON t.id = tl.trip_id
        WHERE c.leg_id = %s::uuid
        ORDER BY c.created_at DESC
        """,
        (viewer_id, viewer_id, leg_id),
    )
    rows = cur.fetchall()
    return [build_comment_response(row, viewer_id, viewer_is_admin) for row in rows]


def fetch_profile_comments_db(cur, profile_user_id: str, viewer_id: Optional[str]):
    viewer_is_admin = is_admin_db(cur, viewer_id)
    cur.execute(
        """
        SELECT
            c.id,
            c.body,
            c.created_at,
            c.updated_at,
            c.user_id AS author_id,
            c.trip_id,
            c.leg_id,
            u.username,
            u.avatar_url AS author_avatar_url,
            up.display_name AS author_display_name,
            COALESCE(t.title, lt.title) AS trip_title,
            tl.location_name AS leg_title,
            COALESCE(
                (SELECT COUNT(*)::int FROM comment_likes cl WHERE cl.comment_id = c.id),
                0
            ) AS like_count,
            CASE
                WHEN %s IS NULL THEN false
                ELSE EXISTS(
                    SELECT 1
                    FROM comment_likes clv
                    WHERE clv.comment_id = c.id
                      AND clv.user_id = %s::uuid
                )
            END AS liked_by_viewer,
            COALESCE(t.user_id, lt.user_id) AS target_owner_id,
            COALESCE(t.visibility, lt.visibility) AS target_visibility,
            COALESCE(t.is_hidden, lt.is_hidden, false) AS target_is_hidden
        FROM comments c
        JOIN users u ON u.id = c.user_id
        LEFT JOIN user_profiles up ON up.user_id = u.id
        LEFT JOIN trips t ON t.id = c.trip_id
        LEFT JOIN trip_legs tl ON tl.id = c.leg_id
        LEFT JOIN trips lt ON lt.id = tl.trip_id
        WHERE c.user_id = %s::uuid
        ORDER BY c.created_at DESC
        """,
        (viewer_id, viewer_id, profile_user_id),
    )
    rows = cur.fetchall()

    result = []
    for row in rows:
        target_owner_id = str(row["target_owner_id"]) if row.get("target_owner_id") else None
        target_visibility = row.get("target_visibility") or "public"
        target_is_hidden = bool(row.get("target_is_hidden") or False)

        if target_owner_id and can_view_trip_record_db(
            cur,
            target_owner_id,
            viewer_id,
            target_visibility,
            target_is_hidden,
        ):
            result.append(build_comment_response(row, viewer_id, viewer_is_admin))

    return result


def fetch_comment_target_context_db(cur, comment_id: str):
    cur.execute(
        """
        SELECT
            c.id,
            c.user_id AS author_id,
            c.trip_id,
            c.leg_id,
            COALESCE(t.user_id, lt.user_id) AS target_owner_id,
            COALESCE(t.visibility, lt.visibility) AS target_visibility,
            COALESCE(t.is_hidden, lt.is_hidden, false) AS target_is_hidden
        FROM comments c
        LEFT JOIN trips t ON t.id = c.trip_id
        LEFT JOIN trip_legs tl ON tl.id = c.leg_id
        LEFT JOIN trips lt ON lt.id = tl.trip_id
        WHERE c.id = %s::uuid
        """,
        (comment_id,),
    )
    return cur.fetchone()


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


@app.get("/admin/me/{user_id}")
async def get_admin_me(user_id: str):
    if USE_DUMMY_DATA:
        return {"is_admin": is_admin_dummy(user_id)}

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            return {"is_admin": is_admin_db(cur, user_id)}
    finally:
        conn.close()


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
                SELECT id, username, email, bio, avatar_url, visibility, created_at,
                       COALESCE(is_admin, false) AS is_admin,
                       COALESCE(is_suspended, false) AS is_suspended
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
            if trip["user_id"] == user_id and can_view_trip_record_dummy(
                user_id,
                viewer_id,
                trip["visibility"],
                bool(trip.get("is_hidden", False)),
            ):
                visible.append(trip)
        return visible

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id
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
                trip = fetch_trip_by_id_db(cur, trip_id, viewer_id)
                if not trip:
                    continue
                if can_view_trip_record_db(
                    cur,
                    trip["user_id"],
                    viewer_id,
                    trip["visibility"],
                    bool(trip.get("is_hidden", False)),
                ):
                    results.append(trip)

            return results
    finally:
        conn.close()


@app.get("/profiles/{user_id}/comments")
async def get_profile_comments(user_id: str, viewer_id: Optional[str] = None):
    if USE_DUMMY_DATA:
        viewer_is_admin = is_admin_dummy(viewer_id)
        results = []
        for comment in comments_db.values():
            if comment["user_id"] != user_id:
                continue
            results.append(
                {
                    "id": comment["id"],
                    "body": comment["body"],
                    "created_at": comment["created_at"],
                    "updated_at": comment["updated_at"],
                    "author_id": comment["user_id"],
                    "author_display_name": users_db.get(comment["user_id"], {}).get("username", "unknown"),
                    "author_avatar_url": users_db.get(comment["user_id"], {}).get("avatar_url", ""),
                    "like_count": sum(1 for like in comment_likes_db if like[0] == comment["id"]),
                    "liked_by_viewer": (comment["id"], viewer_id) in comment_likes_db,
                    "trip_id": comment.get("trip_id"),
                    "leg_id": comment.get("leg_id"),
                    "trip_title": comment.get("trip_title"),
                    "leg_title": comment.get("leg_title"),
                    "can_delete": bool(viewer_is_admin or viewer_id == comment["user_id"]),
                }
            )
        results.sort(key=lambda c: c["created_at"], reverse=True)
        return results

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            return fetch_profile_comments_db(cur, user_id, viewer_id)
    finally:
        conn.close()


@app.get("/trips/{trip_id}")
async def get_trip(trip_id: str, viewer_id: Optional[str] = None):
    if USE_DUMMY_DATA:
        trip = trips_db.get(trip_id)
        if not trip:
            raise HTTPException(status_code=404, detail="trip not found")
        if not can_view_trip_record_dummy(
            trip["user_id"],
            viewer_id,
            trip["visibility"],
            bool(trip.get("is_hidden", False)),
        ):
            raise HTTPException(status_code=403, detail="not allowed to view trip")
        return trip

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            trip = fetch_trip_by_id_db(cur, trip_id, viewer_id)
            if not trip:
                raise HTTPException(status_code=404, detail="trip not found")

            if not can_view_trip_record_db(
                cur,
                trip["user_id"],
                viewer_id,
                trip["visibility"],
                bool(trip.get("is_hidden", False)),
            ):
                raise HTTPException(status_code=403, detail="not allowed to view trip")

            return trip
    finally:
        conn.close()

class LikePayload(BaseModel):
    user_id: str


@app.post("/trips/{trip_id}/like")
async def like_trip(trip_id: str, payload: LikePayload):
    if USE_DUMMY_DATA:
        trip = trips_db.get(trip_id)
        if not trip:
            raise HTTPException(status_code=404, detail="trip not found")
        return {"ok": True}

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            trip = fetch_trip_by_id_db(cur, trip_id, payload.user_id)
            if not trip:
                raise HTTPException(status_code=404, detail="trip not found")

            if not can_view_trip_record_db(
                cur,
                trip["user_id"],
                payload.user_id,
                trip["visibility"],
                bool(trip.get("is_hidden", False)),
            ):
                raise HTTPException(status_code=403, detail="not allowed to like trip")

            cur.execute(
                """
                INSERT INTO trip_likes (trip_id, user_id)
                VALUES (%s, %s)
                ON CONFLICT (trip_id, user_id) DO NOTHING
                """,
                (trip_id, payload.user_id),
            )
            conn.commit()
            return {"ok": True}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@app.post("/trips/{trip_id}/unlike")
async def unlike_trip(trip_id: str, payload: LikePayload):
    if USE_DUMMY_DATA:
        return {"ok": True}

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM trip_likes
                WHERE trip_id = %s AND user_id = %s
                """,
                (trip_id, payload.user_id),
            )
            conn.commit()
            return {"ok": True}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@app.post("/legs/{leg_id}/like")
async def like_leg(leg_id: str, payload: LikePayload):
    if USE_DUMMY_DATA:
        return {"ok": True}

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    tl.id,
                    t.id AS trip_id,
                    t.user_id,
                    t.visibility,
                    COALESCE(t.is_hidden, false) AS is_hidden
                FROM trip_legs tl
                JOIN trips t ON t.id = tl.trip_id
                WHERE tl.id = %s::uuid
                """,
                (leg_id,),
            )
            leg_target = cur.fetchone()
            if not leg_target:
                raise HTTPException(status_code=404, detail="leg not found")

            if not can_view_trip_record_db(
                cur,
                str(leg_target["user_id"]),
                payload.user_id,
                leg_target["visibility"],
                bool(leg_target["is_hidden"]),
            ):
                raise HTTPException(status_code=403, detail="not allowed to like leg")

            cur.execute(
                """
                INSERT INTO leg_likes (leg_id, user_id)
                VALUES (%s, %s)
                ON CONFLICT (leg_id, user_id) DO NOTHING
                """,
                (leg_id, payload.user_id),
            )
            conn.commit()
            return {"ok": True}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@app.post("/legs/{leg_id}/unlike")
async def unlike_leg(leg_id: str, payload: LikePayload):
    if USE_DUMMY_DATA:
        return {"ok": True}

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM leg_likes
                WHERE leg_id = %s AND user_id = %s
                """,
                (leg_id, payload.user_id),
            )
            conn.commit()
            return {"ok": True}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()



@app.get("/trips/{trip_id}/comments")
async def get_trip_comments(trip_id: str, viewer_id: Optional[str] = None):
    if USE_DUMMY_DATA:
        trip = trips_db.get(trip_id)
        if not trip:
            raise HTTPException(status_code=404, detail="trip not found")
        if not can_view_trip_record_dummy(
            trip["user_id"],
            viewer_id,
            trip["visibility"],
            bool(trip.get("is_hidden", False)),
        ):
            raise HTTPException(status_code=403, detail="not allowed to view trip")
        viewer_is_admin = is_admin_dummy(viewer_id)
        results = []
        for comment in comments_db.values():
            if comment.get("trip_id") == trip_id:
                results.append(
                    {
                        "id": comment["id"],
                        "body": comment["body"],
                        "created_at": comment["created_at"],
                        "updated_at": comment["updated_at"],
                        "author_id": comment["user_id"],
                        "author_display_name": users_db.get(comment["user_id"], {}).get("username", "unknown"),
                        "author_avatar_url": users_db.get(comment["user_id"], {}).get("avatar_url", ""),
                        "like_count": sum(1 for like in comment_likes_db if like[0] == comment["id"]),
                        "liked_by_viewer": (comment["id"], viewer_id) in comment_likes_db,
                        "trip_id": trip_id,
                        "leg_id": None,
                        "trip_title": trip["title"],
                        "leg_title": None,
                        "can_delete": bool(viewer_is_admin or viewer_id == comment["user_id"]),
                    }
                )
        results.sort(key=lambda c: c["created_at"], reverse=True)
        return results

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            trip = fetch_trip_by_id_db(cur, trip_id, viewer_id)
            if not trip:
                raise HTTPException(status_code=404, detail="trip not found")
            if not can_view_trip_record_db(
                cur,
                trip["user_id"],
                viewer_id,
                trip["visibility"],
                bool(trip.get("is_hidden", False)),
            ):
                raise HTTPException(status_code=403, detail="not allowed to view trip")
            return fetch_trip_comments_db(cur, trip_id, viewer_id)
    finally:
        conn.close()


@app.post("/trips/{trip_id}/comments")
async def create_trip_comment(trip_id: str, payload: CommentCreate):
    if not payload.body.strip():
        raise HTTPException(status_code=400, detail="comment body is required")

    if USE_DUMMY_DATA:
        trip = trips_db.get(trip_id)
        if not trip:
            raise HTTPException(status_code=404, detail="trip not found")
        if not can_view_trip_record_dummy(
            trip["user_id"],
            payload.user_id,
            trip["visibility"],
            bool(trip.get("is_hidden", False)),
        ):
            raise HTTPException(status_code=403, detail="not allowed to comment on trip")

        comment_id = str(uuid4())
        comments_db[comment_id] = {
            "id": comment_id,
            "user_id": payload.user_id,
            "trip_id": trip_id,
            "leg_id": None,
            "body": payload.body.strip(),
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "trip_title": trip["title"],
            "leg_title": None,
        }
        return {"id": comment_id}

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            ensure_active_user_db(cur, payload.user_id)

            trip = fetch_trip_by_id_db(cur, trip_id, payload.user_id)
            if not trip:
                raise HTTPException(status_code=404, detail="trip not found")

            if not can_view_trip_record_db(
                cur,
                trip["user_id"],
                payload.user_id,
                trip["visibility"],
                bool(trip.get("is_hidden", False)),
            ):
                raise HTTPException(status_code=403, detail="not allowed to comment on trip")

            cur.execute(
                """
                INSERT INTO comments (user_id, trip_id, body)
                VALUES (%s, %s, %s)
                RETURNING id
                """,
                (payload.user_id, trip_id, payload.body.strip()),
            )
            row = cur.fetchone()
            conn.commit()
            return {"id": str(row["id"])}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@app.get("/legs/{leg_id}/comments")
async def get_leg_comments(leg_id: str, viewer_id: Optional[str] = None):
    if USE_DUMMY_DATA:
        target_trip = None
        for trip in trips_db.values():
            for leg in trip["legs"]:
                if leg["id"] == leg_id:
                    target_trip = trip
                    break
            if target_trip:
                break

        if not target_trip:
            raise HTTPException(status_code=404, detail="leg not found")

        if not can_view_trip_record_dummy(
            target_trip["user_id"],
            viewer_id,
            target_trip["visibility"],
            bool(target_trip.get("is_hidden", False)),
        ):
            raise HTTPException(status_code=403, detail="not allowed to view leg comments")

        viewer_is_admin = is_admin_dummy(viewer_id)
        results = []
        for comment in comments_db.values():
            if comment.get("leg_id") == leg_id:
                results.append(
                    {
                        "id": comment["id"],
                        "body": comment["body"],
                        "created_at": comment["created_at"],
                        "updated_at": comment["updated_at"],
                        "author_id": comment["user_id"],
                        "author_display_name": users_db.get(comment["user_id"], {}).get("username", "unknown"),
                        "author_avatar_url": users_db.get(comment["user_id"], {}).get("avatar_url", ""),
                        "like_count": sum(1 for like in comment_likes_db if like[0] == comment["id"]),
                        "liked_by_viewer": (comment["id"], viewer_id) in comment_likes_db,
                        "trip_id": target_trip["id"],
                        "leg_id": leg_id,
                        "trip_title": target_trip["title"],
                        "leg_title": next((l["location_name"] for l in target_trip["legs"] if l["id"] == leg_id), ""),
                        "can_delete": bool(viewer_is_admin or viewer_id == comment["user_id"]),
                    }
                )
        results.sort(key=lambda c: c["created_at"], reverse=True)
        return results

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    tl.id,
                    t.user_id,
                    t.visibility,
                    COALESCE(t.is_hidden, false) AS is_hidden
                FROM trip_legs tl
                JOIN trips t ON t.id = tl.trip_id
                WHERE tl.id = %s::uuid
                """,
                (leg_id,),
            )
            leg_target = cur.fetchone()
            if not leg_target:
                raise HTTPException(status_code=404, detail="leg not found")

            if not can_view_trip_record_db(
                cur,
                str(leg_target["user_id"]),
                viewer_id,
                leg_target["visibility"],
                bool(leg_target["is_hidden"]),
            ):
                raise HTTPException(status_code=403, detail="not allowed to view leg comments")

            return fetch_leg_comments_db(cur, leg_id, viewer_id)
    finally:
        conn.close()


@app.post("/legs/{leg_id}/comments")
async def create_leg_comment(leg_id: str, payload: CommentCreate):
    if not payload.body.strip():
        raise HTTPException(status_code=400, detail="comment body is required")

    if USE_DUMMY_DATA:
        target_trip = None
        target_leg = None
        for trip in trips_db.values():
            for leg in trip["legs"]:
                if leg["id"] == leg_id:
                    target_trip = trip
                    target_leg = leg
                    break
            if target_trip:
                break

        if not target_trip or not target_leg:
            raise HTTPException(status_code=404, detail="leg not found")

        if not can_view_trip_record_dummy(
            target_trip["user_id"],
            payload.user_id,
            target_trip["visibility"],
            bool(target_trip.get("is_hidden", False)),
        ):
            raise HTTPException(status_code=403, detail="not allowed to comment on leg")

        comment_id = str(uuid4())
        comments_db[comment_id] = {
            "id": comment_id,
            "user_id": payload.user_id,
            "trip_id": target_trip["id"],
            "leg_id": leg_id,
            "body": payload.body.strip(),
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "trip_title": target_trip["title"],
            "leg_title": target_leg["location_name"],
        }
        return {"id": comment_id}

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            ensure_active_user_db(cur, payload.user_id)

            cur.execute(
                """
                SELECT
                    tl.id,
                    t.id AS trip_id,
                    t.user_id,
                    t.visibility,
                    COALESCE(t.is_hidden, false) AS is_hidden
                FROM trip_legs tl
                JOIN trips t ON t.id = tl.trip_id
                WHERE tl.id = %s::uuid
                """,
                (leg_id,),
            )
            leg_target = cur.fetchone()
            if not leg_target:
                raise HTTPException(status_code=404, detail="leg not found")

            if not can_view_trip_record_db(
                cur,
                str(leg_target["user_id"]),
                payload.user_id,
                leg_target["visibility"],
                bool(leg_target["is_hidden"]),
            ):
                raise HTTPException(status_code=403, detail="not allowed to comment on leg")

            cur.execute(
                """
                INSERT INTO comments (user_id, leg_id, body)
                VALUES (%s, %s, %s)
                RETURNING id
                """,
                (payload.user_id, leg_id, payload.body.strip()),
            )
            row = cur.fetchone()
            conn.commit()
            return {"id": str(row["id"])}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@app.post("/comments/{comment_id}/like")
async def like_comment(comment_id: str, payload: CommentLikePayload):
    if USE_DUMMY_DATA:
        if comment_id not in comments_db:
            raise HTTPException(status_code=404, detail="comment not found")
        comment_likes_db.add((comment_id, payload.user_id))
        return {"ok": True}

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            ensure_active_user_db(cur, payload.user_id)

            comment_target = fetch_comment_target_context_db(cur, comment_id)
            if not comment_target:
                raise HTTPException(status_code=404, detail="comment not found")

            if not can_view_trip_record_db(
                cur,
                str(comment_target["target_owner_id"]),
                payload.user_id,
                comment_target["target_visibility"],
                bool(comment_target["target_is_hidden"]),
            ):
                raise HTTPException(status_code=403, detail="not allowed to like comment")

            cur.execute(
                """
                INSERT INTO comment_likes (comment_id, user_id)
                VALUES (%s, %s)
                ON CONFLICT (comment_id, user_id) DO NOTHING
                """,
                (comment_id, payload.user_id),
            )
            conn.commit()
            return {"ok": True}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@app.post("/comments/{comment_id}/unlike")
async def unlike_comment(comment_id: str, payload: CommentLikePayload):
    if USE_DUMMY_DATA:
        comment_likes_db.discard((comment_id, payload.user_id))
        return {"ok": True}

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            ensure_active_user_db(cur, payload.user_id)
            cur.execute(
                """
                DELETE FROM comment_likes
                WHERE comment_id = %s AND user_id = %s
                """,
                (comment_id, payload.user_id),
            )
            conn.commit()
            return {"ok": True}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@app.delete("/comments/{comment_id}")
async def delete_comment(comment_id: str, actor_id: str):
    if USE_DUMMY_DATA:
        comment = comments_db.get(comment_id)
        if not comment:
            raise HTTPException(status_code=404, detail="comment not found")
        if actor_id != comment["user_id"] and not is_admin_dummy(actor_id):
            raise HTTPException(status_code=403, detail="not allowed to delete comment")
        comments_db.pop(comment_id, None)
        comment_likes_db_copy = set(comment_likes_db)
        for like in comment_likes_db_copy:
            if like[0] == comment_id:
                comment_likes_db.discard(like)
        return {"ok": True}

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            ensure_active_user_db(cur, actor_id)

            comment_target = fetch_comment_target_context_db(cur, comment_id)
            if not comment_target:
                raise HTTPException(status_code=404, detail="comment not found")

            is_admin = is_admin_db(cur, actor_id)
            if actor_id != str(comment_target["author_id"]) and not is_admin:
                raise HTTPException(status_code=403, detail="not allowed to delete comment")

            cur.execute(
                """
                DELETE FROM comments
                WHERE id = %s::uuid
                """,
                (comment_id,),
            )
            conn.commit()
            return {"ok": True}
    except Exception:
        conn.rollback()
        raise
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
            "is_hidden": False,
            "hidden_reason": None,
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
            ensure_active_user_db(cur, trip.user_id)

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
            "is_hidden": trips_db[trip_id].get("is_hidden", False),
            "hidden_reason": trips_db[trip_id].get("hidden_reason"),
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
            ensure_active_user_db(cur, trip.user_id)

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
                cur.execute("DELETE FROM comments WHERE leg_id = ANY(%s::uuid[])", (old_leg_ids,))
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

            refreshed = fetch_trip_by_id_db(cur, trip_id, trip.user_id)
            if not refreshed:
                raise HTTPException(status_code=404, detail="trip not found after update")
            return refreshed
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@app.patch("/admin/trips/{trip_id}/hide")
async def admin_hide_trip(trip_id: str, payload: AdminTripHidePayload):
    if USE_DUMMY_DATA:
        require_admin = is_admin_dummy(payload.actor_id)
        if not require_admin:
            raise HTTPException(status_code=403, detail="admin access required")
        trip = trips_db.get(trip_id)
        if not trip:
            raise HTTPException(status_code=404, detail="trip not found")
        trip["is_hidden"] = payload.is_hidden
        trip["hidden_reason"] = payload.hidden_reason
        return trip

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            require_admin_db(cur, payload.actor_id)
            cur.execute(
                """
                UPDATE trips
                SET is_hidden = %s,
                    hidden_reason = %s
                WHERE id = %s
                RETURNING id
                """,
                (payload.is_hidden, payload.hidden_reason, trip_id),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="trip not found")
            conn.commit()
            trip = fetch_trip_by_id_db(cur, trip_id, payload.actor_id)
            return trip
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@app.delete("/admin/trips/{trip_id}")
async def admin_delete_trip(trip_id: str, actor_id: str):
    if USE_DUMMY_DATA:
        if not is_admin_dummy(actor_id):
            raise HTTPException(status_code=403, detail="admin access required")
        if trip_id not in trips_db:
            raise HTTPException(status_code=404, detail="trip not found")
        trip = trips_db.pop(trip_id)
        leg_ids = [leg["id"] for leg in trip["legs"]]
        for comment_id in list(comments_db.keys()):
            comment = comments_db[comment_id]
            if comment.get("trip_id") == trip_id or comment.get("leg_id") in leg_ids:
                comments_db.pop(comment_id, None)
        for like in list(comment_likes_db):
            if like[0] not in comments_db:
                comment_likes_db.discard(like)
        return {"ok": True}

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            require_admin_db(cur, actor_id)

            cur.execute("SELECT id FROM trips WHERE id = %s", (trip_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="trip not found")

            cur.execute("SELECT id FROM trip_legs WHERE trip_id = %s", (trip_id,))
            leg_ids = [str(row["id"]) for row in cur.fetchall()]

            if leg_ids:
                cur.execute("DELETE FROM comments WHERE leg_id = ANY(%s::uuid[])", (leg_ids,))
                cur.execute("DELETE FROM trip_leg_media WHERE leg_id = ANY(%s::uuid[])", (leg_ids,))

            cur.execute("DELETE FROM comments WHERE trip_id = %s", (trip_id,))
            cur.execute("DELETE FROM trip_legs WHERE trip_id = %s", (trip_id,))
            cur.execute("DELETE FROM trips WHERE id = %s", (trip_id,))

            conn.commit()
            return {"ok": True}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@app.patch("/admin/users/{user_id}/suspend")
async def admin_suspend_user(user_id: str, payload: AdminUserSuspendPayload):
    if USE_DUMMY_DATA:
        if not is_admin_dummy(payload.actor_id):
            raise HTTPException(status_code=403, detail="admin access required")
        if user_id not in users_db:
            raise HTTPException(status_code=404, detail="user not found")
        users_db[user_id]["is_suspended"] = payload.is_suspended
        return users_db[user_id]

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            require_admin_db(cur, payload.actor_id)
            cur.execute(
                """
                UPDATE users
                SET is_suspended = %s
                WHERE id = %s
                RETURNING id, username, email, bio, avatar_url, visibility, created_at,
                          COALESCE(is_admin, false) AS is_admin,
                          COALESCE(is_suspended, false) AS is_suspended
                """,
                (payload.is_suspended, user_id),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="user not found")
            conn.commit()
            return serialize_profile_row(row)
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
            ensure_active_user_db(cur, payload.sender_id)

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
    if USE_DUMMY_DATA:
        raise HTTPException(status_code=501, detail="user profiles not implemented in dummy mode")

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            ensure_active_user_db(cur, user_id)

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
            if can_view_trip_record_dummy(
                trip["user_id"],
                viewer_id,
                trip["visibility"],
                bool(trip.get("is_hidden", False)),
            ):
                trip_copy = dict(trip)
                author = users_db.get(trip["user_id"])
                trip_copy["author_username"] = author["username"] if author else "unknown"
                trip_copy["author_avatar_url"] = author.get("avatar_url", "") if author else ""
                trip_copy["author_id"] = trip_copy["user_id"]
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
                trip = fetch_trip_by_id_db(cur, trip_id, viewer_id)
                if trip and can_view_trip_record_db(
                    cur,
                    trip["user_id"],
                    viewer_id,
                    trip["visibility"],
                    bool(trip.get("is_hidden", False)),
                ):
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
            ensure_active_user_db(cur, user_id)

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
                SELECT id, username, email, bio, avatar_url, visibility, created_at,
                       COALESCE(is_admin, false) AS is_admin,
                       COALESCE(is_suspended, false) AS is_suspended
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

@app.get("/likes/{user_id}")
async def get_likes_page(user_id: str):
    if USE_DUMMY_DATA:
        return {"trips": [], "legs": [], "comments": []}

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # liked trips
            cur.execute(
                """
                SELECT tl.trip_id
                FROM trip_likes tl
                WHERE tl.user_id = %s::uuid
                ORDER BY tl.created_at DESC
                """,
                (user_id,),
            )
            liked_trip_ids = [str(row["trip_id"]) for row in cur.fetchall()]

            trips = []
            for trip_id in liked_trip_ids:
                trip = fetch_trip_by_id_db(cur, trip_id, user_id)
                if not trip:
                    continue
                if can_view_trip_record_db(
                    cur,
                    trip["user_id"],
                    user_id,
                    trip["visibility"],
                    bool(trip.get("is_hidden", False)),
                ):
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
                    trips.append(trip)

            # liked legs
            cur.execute(
                """
                SELECT
                    ll.leg_id,
                    tl.trip_id,
                    tl.location_name,
                    tl.caption,
                    tl.start_time,
                    tl.order_index,
                    t.title AS trip_title,
                    t.user_id,
                    t.visibility,
                    COALESCE(t.is_hidden, false) AS is_hidden
                FROM leg_likes ll
                JOIN trip_legs tl ON tl.id = ll.leg_id
                JOIN trips t ON t.id = tl.trip_id
                WHERE ll.user_id = %s::uuid
                ORDER BY ll.created_at DESC
                """,
                (user_id,),
            )
            leg_rows = cur.fetchall()

            leg_ids = [str(row["leg_id"]) for row in leg_rows]
            media_map = fetch_trip_media_map(cur, leg_ids)
            leg_like_map = fetch_leg_like_meta_map_db(cur, leg_ids, user_id)

            legs = []
            for row in leg_rows:
                if not can_view_trip_record_db(
                    cur,
                    str(row["user_id"]),
                    user_id,
                    row["visibility"],
                    bool(row["is_hidden"]),
                ):
                    continue

                leg_id = str(row["leg_id"])
                like_meta = leg_like_map.get(leg_id, {"like_count": 0, "liked_by_viewer": False})

                legs.append(
                    {
                        "id": leg_id,
                        "trip_id": str(row["trip_id"]),
                        "trip_title": row["trip_title"],
                        "location_name": row["location_name"],
                        "caption": row["caption"] or "",
                        "start_time": row["start_time"].isoformat() if row["start_time"] else "",
                        "order_index": row["order_index"],
                        "media_urls": media_map.get(leg_id, []),
                        "like_count": like_meta["like_count"],
                        "liked_by_viewer": like_meta["liked_by_viewer"],
                    }
                )

            # liked comments
            cur.execute(
                """
                SELECT
                    c.id,
                    c.body,
                    c.created_at,
                    c.updated_at,
                    c.user_id AS author_id,
                    c.trip_id,
                    c.leg_id,
                    u.username,
                    u.avatar_url AS author_avatar_url,
                    up.display_name AS author_display_name,
                    COALESCE(t.title, lt.title) AS trip_title,
                    tl.location_name AS leg_title,
                    COALESCE(
                        (SELECT COUNT(*)::int FROM comment_likes cl WHERE cl.comment_id = c.id),
                        0
                    ) AS like_count,
                    true AS liked_by_viewer,
                    COALESCE(t.user_id, lt.user_id) AS target_owner_id,
                    COALESCE(t.visibility, lt.visibility) AS target_visibility,
                    COALESCE(t.is_hidden, lt.is_hidden, false) AS target_is_hidden
                FROM comment_likes mycl
                JOIN comments c ON c.id = mycl.comment_id
                JOIN users u ON u.id = c.user_id
                LEFT JOIN user_profiles up ON up.user_id = u.id
                LEFT JOIN trips t ON t.id = c.trip_id
                LEFT JOIN trip_legs tl ON tl.id = c.leg_id
                LEFT JOIN trips lt ON lt.id = tl.trip_id
                WHERE mycl.user_id = %s::uuid
                ORDER BY mycl.created_at DESC
                """,
                (user_id,),
            )
            comment_rows = cur.fetchall()

            comments = []
            for row in comment_rows:
                if can_view_trip_record_db(
                    cur,
                    str(row["target_owner_id"]),
                    user_id,
                    row["target_visibility"],
                    bool(row["target_is_hidden"]),
                ):
                    comments.append(
                        {
                            "id": str(row["id"]),
                            "body": row["body"],
                            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                            "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
                            "author_id": str(row["author_id"]),
                            "author_display_name": row.get("author_display_name") or row.get("username") or "unknown",
                            "author_avatar_url": row.get("author_avatar_url") or "",
                            "like_count": int(row.get("like_count") or 0),
                            "liked_by_viewer": True,
                            "trip_id": str(row["trip_id"]) if row.get("trip_id") else None,
                            "leg_id": str(row["leg_id"]) if row.get("leg_id") else None,
                            "trip_title": row.get("trip_title"),
                            "leg_title": row.get("leg_title"),
                            "can_delete": False,
                        }
                    )

            return {
                "trips": trips,
                "legs": legs,
                "comments": comments,
            }
    finally:
        conn.close()


@app.get("/map/{viewer_id}")
async def get_map_trips(viewer_id: str):
    if USE_DUMMY_DATA:
        results = []

        for trip in trips_db.values():
            if not can_view_trip_record_dummy(
                trip["user_id"],
                viewer_id,
                trip["visibility"],
                bool(trip.get("is_hidden", False)),
            ):
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
                trip = fetch_trip_by_id_db(cur, trip_id, viewer_id)
                if not trip:
                    continue

                if not can_view_trip_record_db(
                    cur,
                    trip["user_id"],
                    viewer_id,
                    trip["visibility"],
                    bool(trip.get("is_hidden", False)),
                ):
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