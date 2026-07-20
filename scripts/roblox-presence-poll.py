#!/usr/bin/env python3
"""Poll unauthenticated Roblox APIs and output JSON for the public-data demo."""
import json
import urllib.request
from datetime import datetime, timezone

USERS = [
    {"id": 9829738831, "username": "amenomori2"},
    {"id": 7874713562, "username": "amenomori1668"},
]

def fetch(url, data=None):
    req = urllib.request.Request(url, data=data,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "kieranmaynard-public-api-demo/1.0",
        })
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode())

def fetch_or(url, default):
    """Return a fallback when an optional public endpoint is unavailable."""
    try:
        return fetch(url)
    except Exception:
        return default

def fetch_data(url):
    """Return an endpoint's data list, or None when the endpoint failed."""
    response = fetch_or(url, None)
    data = response.get("data") if isinstance(response, dict) else None
    return data if isinstance(data, list) else None

def obj(value):
    return value if isinstance(value, dict) else {}

def experience(item):
    root_place = obj(item.get("rootPlace"))
    return {
        "id": item.get("id"),
        "rootPlaceId": root_place.get("id"),
        "name": item.get("name"),
        "description": item.get("description"),
        "created": item.get("created"),
        "updated": item.get("updated"),
        "visits": item.get("placeVisits"),
        "creator": obj(item.get("creator")).get("name"),
    }

def main():
    ids = ",".join(str(u["id"]) for u in USERS)
    uid_list = [u["id"] for u in USERS]

    # ── Presence ──
    try:
        pres_data = fetch("https://presence.roblox.com/v1/presence/users",
                          data=json.dumps({"userIds": uid_list}).encode())
    except Exception:
        pres_data = {"userPresences": []}
    presences = {}
    presence_items = pres_data.get("userPresences", []) if isinstance(pres_data, dict) else []
    if not isinstance(presence_items, list):
        presence_items = []
    for p in presence_items:
        if not isinstance(p, dict) or "userId" not in p or "userPresenceType" not in p:
            continue
        presences[p["userId"]] = {
            "type": p["userPresenceType"],
            "lastLocation": p.get("lastLocation"),
            "placeId": p.get("placeId"),
            "universeId": p.get("universeId"),
        }

    # ── Avatars (batched headshot) ──
    thumb = fetch_or(f"https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds={ids}&size=150x150&format=Png", {"data": []})
    thumbnail_items = thumb.get("data", []) if isinstance(thumb, dict) else []
    if not isinstance(thumbnail_items, list):
        thumbnail_items = []
    avatars = {
        img["targetId"]: img.get("imageUrl")
        for img in thumbnail_items
        if isinstance(img, dict) and isinstance(img.get("targetId"), int)
    }

    # ── Profiles, social graph, experiences, and groups (per user) ──
    profiles = {}
    experiences = {}
    favorite_experiences = {}
    groups = {}
    username_history = {}
    for u in USERS:
        uid = u["id"]
        prof = fetch_or(f"https://users.roblox.com/v1/users/{uid}", None)
        if isinstance(prof, dict):
            created = prof.get("created", "")
            age_days = None
            if created:
                try:
                    created_dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                    age_days = (datetime.now(timezone.utc) - created_dt).days
                except (AttributeError, TypeError, ValueError):
                    pass

            profiles[uid] = {
                "displayName": prof.get("displayName"),
                "description": prof.get("description", ""),
                "verified": prof.get("hasVerifiedBadge", False),
                "created": created[:10] if created else None,  # YYYY-MM-DD
                "ageDays": age_days,
                "friends": fetch_or(f"https://friends.roblox.com/v1/users/{uid}/friends/count", {}).get("count"),
                "followers": fetch_or(f"https://friends.roblox.com/v1/users/{uid}/followers/count", {}).get("count"),
                "following": fetch_or(f"https://friends.roblox.com/v1/users/{uid}/followings/count", {}).get("count"),
            }
        else:
            profiles[uid] = {}

        games = fetch_data(f"https://games.roblox.com/v2/users/{uid}/games?accessFilter=Public&sortOrder=Desc&limit=10")
        experiences[uid] = [
            experience(item) for item in games if isinstance(item, dict)
        ] if games is not None else None

        favorites = fetch_data(f"https://games.roblox.com/v2/users/{uid}/favorite/games?accessFilter=Public&sortOrder=Desc&limit=10")
        favorite_experiences[uid] = [
            experience(item) for item in favorites if isinstance(item, dict)
        ] if favorites is not None else None

        memberships = fetch_data(f"https://groups.roblox.com/v2/users/{uid}/groups/roles")
        groups[uid] = [
            {
                "id": obj(item.get("group")).get("id"),
                "name": obj(item.get("group")).get("name"),
                "members": obj(item.get("group")).get("memberCount"),
                "verified": obj(item.get("group")).get("hasVerifiedBadge", False),
                "role": obj(item.get("role")).get("name"),
                "rank": obj(item.get("role")).get("rank"),
            }
            for item in memberships if isinstance(item, dict)
        ] if memberships is not None else None

        history = fetch_data(f"https://users.roblox.com/v1/users/{uid}/username-history?limit=10&sortOrder=Desc")
        username_history[uid] = [
            item.get("name") for item in history
            if isinstance(item, dict) and item.get("name")
        ] if history is not None else None

    result = {
        "users": USERS,
        "presences": presences,
        "avatars": avatars,
        "profiles": profiles,
        "experiences": experiences,
        "favoriteExperiences": favorite_experiences,
        "groups": groups,
        "usernameHistory": username_history,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }

    print(json.dumps(result))

if __name__ == "__main__":
    main()
