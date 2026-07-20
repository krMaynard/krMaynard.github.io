#!/usr/bin/env python3
"""Poll Roblox APIs and output JSON for static site consumption."""
import json, sys, urllib.request
from datetime import datetime, timezone

USERS = [
    {"id": 9829738831, "username": "amenomori2"},
    {"id": 7874713562, "username": "amenomori1668"},
]

def fetch(url, data=None):
    req = urllib.request.Request(url, data=data,
        headers={"Content-Type": "application/json", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode())

def main():
    ids = ",".join(str(u["id"]) for u in USERS)
    uid_list = [u["id"] for u in USERS]

    # ── Presence ──
    pres_data = fetch("https://presence.roblox.com/v1/presence/users",
                      data=json.dumps({"userIds": uid_list}).encode())
    presences = {}
    for p in pres_data.get("userPresences", []):
        presences[p["userId"]] = {
            "type": p["userPresenceType"],
            "lastLocation": p.get("lastLocation"),
            "placeId": p.get("placeId"),
            "universeId": p.get("universeId"),
        }

    # ── Avatars (batched headshot) ──
    thumb = fetch(f"https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds={ids}&size=150x150&format=Png")
    avatars = {img["targetId"]: img.get("imageUrl") for img in thumb.get("data", [])}

    # ── Profiles, friends, followers (per user) ──
    profiles = {}
    for u in USERS:
        uid = u["id"]
        try:
            prof = fetch(f"https://users.roblox.com/v1/users/{uid}")
            fcount = fetch(f"https://friends.roblox.com/v1/users/{uid}/friends/count")
            followers = fetch(f"https://friends.roblox.com/v1/users/{uid}/followers/count")
            following = fetch(f"https://friends.roblox.com/v1/users/{uid}/followings/count")

            created = prof.get("created", "")
            age_days = None
            if created:
                created_dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                age_days = (datetime.now(timezone.utc) - created_dt).days

            profiles[uid] = {
                "description": prof.get("description", ""),
                "created": created[:10] if created else None,  # YYYY-MM-DD
                "ageDays": age_days,
                "friends": fcount.get("count", 0),
                "followers": followers.get("count", 0),
                "following": following.get("count", 0),
            }
        except Exception:
            profiles[uid] = {}

    result = {
        "users": USERS,
        "presences": presences,
        "avatars": avatars,
        "profiles": profiles,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }

    print(json.dumps(result))

if __name__ == "__main__":
    main()
