#!/usr/bin/env python3
"""Poll Roblox Presence API and output JSON for static site consumption."""
import json, sys, urllib.request

USERS = [
    {"id": 9829738831, "username": "amenomori2"},
    {"id": 7874713562, "username": "amenomori1668"},
]

def fetch_json(url, data=None):
    req = urllib.request.Request(url, data=data,
        headers={"Content-Type": "application/json", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode())

def main():
    # Presence
    presence_data = fetch_json(
        "https://presence.roblox.com/v1/presence/users",
        data=json.dumps({"userIds": [u["id"] for u in USERS]}).encode()
    )
    presences = {}
    for p in presence_data.get("userPresences", []):
        presences[p["userId"]] = {
            "userPresenceType": p["userPresenceType"],
            "lastLocation": p.get("lastLocation"),
            "placeId": p.get("placeId"),
            "universeId": p.get("universeId"),
            "gameId": p.get("gameId"),
        }

    # Avatars (batched)
    ids = ",".join(str(u["id"]) for u in USERS)
    thumb_data = fetch_json(
        f"https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds={ids}&size=150x150&format=Png"
    )
    avatars = {}
    for img in thumb_data.get("data", []):
        avatars[img["targetId"]] = img.get("imageUrl")

    # Display names
    display_names = {}
    for u in USERS:
        try:
            user_data = fetch_json(f"https://users.roblox.com/v1/users/{u['id']}")
            dn = user_data.get("displayName", "")
            name = user_data.get("name", u["username"])
            display_names[u["id"]] = f"{dn} (@{name})" if dn and dn != name else f"@{name}"
        except Exception:
            display_names[u["id"]] = f"@{u['username']}"

    result = {
        "users": USERS,
        "presences": presences,
        "avatars": avatars,
        "displayNames": display_names,
        "updatedAt": None,  # filled below
    }

    from datetime import datetime, timezone
    result["updatedAt"] = datetime.now(timezone.utc).isoformat()

    print(json.dumps(result))

if __name__ == "__main__":
    main()
