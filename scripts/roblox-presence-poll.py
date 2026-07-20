#!/usr/bin/env python3
"""Poll unauthenticated Roblox APIs and output JSON for the public-data demo."""
import argparse
import json
import urllib.request
from datetime import datetime, timezone

USERS = [
    {"id": 9829738831, "username": "amenomori2"},
    {"id": 7874713562, "username": "amenomori1668"},
]

INVENTORY_ASSET_TYPES = ",".join([
    "Hat", "Shirt", "Pants", "TShirt", "Gear", "HairAccessory",
    "FaceAccessory", "NeckAccessory", "ShoulderAccessory", "FrontAccessory",
    "BackAccessory", "WaistAccessory", "TShirtAccessory", "ShirtAccessory",
    "PantsAccessory", "JacketAccessory", "SweaterAccessory", "ShortsAccessory",
    "DressSkirtAccessory",
])

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

def inventory_item(item):
    return {
        "assetId": item.get("assetId"),
        "name": item.get("name") or item.get("assetName"),
        "type": item.get("assetType"),
        "acquired": item.get("created"),
    }

def avatar_details(response):
    if not isinstance(response, dict):
        return None
    assets = response.get("assets")
    emotes = response.get("emotes")
    return {
        "type": response.get("playerAvatarType"),
        "scales": obj(response.get("scales")),
        "bodyColors": obj(response.get("bodyColors")),
        "assets": [
            {
                "id": item.get("id"),
                "name": item.get("name"),
                "type": obj(item.get("assetType")).get("name"),
            }
            for item in assets if isinstance(item, dict)
        ] if isinstance(assets, list) else None,
        "emotes": [
            {"name": item.get("assetName"), "assetId": item.get("assetId"), "type": "Emote"}
            for item in emotes if isinstance(item, dict)
        ] if isinstance(emotes, list) else None,
    }

def merge_missing(current, previous):
    """Fill failed/missing sub-responses from the last deployed snapshot."""
    if current is None:
        return previous, previous is not None
    if isinstance(current, dict) and isinstance(previous, dict):
        if not current and previous:
            return previous, True
        merged = dict(current)
        used = False
        for key, old_value in previous.items():
            if key not in merged:
                merged[key] = old_value
                used = True
            else:
                merged[key], filled = merge_missing(merged[key], old_value)
                used = used or filled
        return merged, used
    if isinstance(current, list) and isinstance(previous, list):
        identity_keys = ("id", "assetId", "rootPlaceId", "name")
        key = next((candidate for candidate in identity_keys
                    if any(isinstance(item, dict) and item.get(candidate) is not None for item in current)), None)
        if not key:
            return current, False
        previous_by_id = {
            item.get(key): item for item in previous
            if isinstance(item, dict) and type(item.get(key)) in (int, str)
        }
        merged = []
        used = False
        for item in current:
            item_id = item.get(key) if isinstance(item, dict) else None
            old_item = previous_by_id.get(item_id) if type(item_id) in (int, str) else None
            if old_item is not None:
                item, filled = merge_missing(item, old_item)
                used = used or filled
            merged.append(item)
        return merged, used
    return current, False

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
    inventories = {}
    collectibles = {}
    avatar_configurations = {}
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
                "roleId": obj(item.get("role")).get("id"),
                "rank": obj(item.get("role")).get("rank"),
            }
            for item in memberships if isinstance(item, dict)
        ] if memberships is not None else None

        history = fetch_data(f"https://users.roblox.com/v1/users/{uid}/username-history?limit=10&sortOrder=Desc")
        username_history[uid] = [
            item.get("name") for item in history
            if isinstance(item, dict) and item.get("name")
        ] if history is not None else None

        inventory_url = (
            f"https://inventory.roblox.com/v2/users/{uid}/inventory"
            f"?assetTypes={INVENTORY_ASSET_TYPES}&sortOrder=Desc&limit=100"
        )
        inventory_response = fetch_or(inventory_url, None)
        if isinstance(inventory_response, dict):
            can_view = True
        else:
            visibility = fetch_or(
                f"https://inventory.roblox.com/v1/users/{uid}/can-view-inventory", None
            )
            can_view = visibility.get("canView") if isinstance(visibility, dict) else None
        inventory_data = inventory_response.get("data") if isinstance(inventory_response, dict) else None
        inventories[uid] = {
            "visible": can_view,
            "items": [
                inventory_item(item) for item in inventory_data if isinstance(item, dict)
            ] if isinstance(inventory_data, list) else None,
            "truncated": bool(inventory_response.get("nextPageCursor"))
            if isinstance(inventory_response, dict) else False,
        }

        collectible_data = fetch_data(
            f"https://inventory.roblox.com/v1/users/{uid}/assets/collectibles?sortOrder=Desc&limit=100"
        )
        collectibles[uid] = [
            {
                **inventory_item(item),
                "serialNumber": item.get("serialNumber"),
                "recentAveragePrice": item.get("recentAveragePrice"),
            }
            for item in collectible_data if isinstance(item, dict)
        ] if collectible_data is not None else None

        avatar_configurations[uid] = avatar_details(fetch_or(
            f"https://avatar.roblox.com/v1/users/{uid}/avatar", None
        ))

    # ── Enrich public groups with details, roles, games, and icons ──
    group_ids = sorted({
        item.get("id")
        for memberships in groups.values() if isinstance(memberships, list)
        for item in memberships if isinstance(item, dict) and isinstance(item.get("id"), int)
    })
    group_icons = {}
    if group_ids:
        icon_response = fetch_or(
            "https://thumbnails.roblox.com/v1/groups/icons?groupIds="
            + ",".join(str(group_id) for group_id in group_ids)
            + "&size=150x150&format=Png&isCircular=false",
            {"data": []},
        )
        icon_items = icon_response.get("data") if isinstance(icon_response, dict) else None
        if isinstance(icon_items, list):
            group_icons = {
                item.get("targetId"): item.get("imageUrl")
                for item in icon_items if isinstance(item, dict) and isinstance(item.get("targetId"), int)
            }

    group_enrichment = {}
    for group_id in group_ids:
        details = fetch_or(f"https://groups.roblox.com/v1/groups/{group_id}", None)
        roles_response = fetch_or(f"https://groups.roblox.com/v1/groups/{group_id}/roles", None)
        role_items = roles_response.get("roles") if isinstance(roles_response, dict) else None
        role_counts = {
            item.get("id"): item.get("memberCount")
            for item in role_items if isinstance(item, dict) and isinstance(item.get("id"), int)
        } if isinstance(role_items, list) else {}
        games = fetch_data(
            f"https://games.roblox.com/v2/groups/{group_id}/games?accessFilter=Public&sortOrder=Desc&limit=10"
        )
        group_enrichment[group_id] = {
            "description": details.get("description") if isinstance(details, dict) else None,
            "owner": obj(details.get("owner")).get("username") if isinstance(details, dict) else None,
            "publicEntryAllowed": details.get("publicEntryAllowed") if isinstance(details, dict) else None,
            "shout": obj(details.get("shout")).get("body") if isinstance(details, dict) else None,
            "iconUrl": group_icons.get(group_id),
            "roleCounts": role_counts,
            "experiences": [
                experience(item) for item in games if isinstance(item, dict)
            ] if games is not None else None,
        }

    for memberships in groups.values():
        if not isinstance(memberships, list):
            continue
        for membership in memberships:
            enrichment = group_enrichment.get(membership.get("id"), {})
            membership.update({key: value for key, value in enrichment.items() if key != "roleCounts"})
            membership["roleMembers"] = obj(enrichment.get("roleCounts")).get(membership.get("roleId"))

    # ── Enrich every surfaced experience in three batch requests ──
    experience_lists = [experiences, favorite_experiences]
    for enrichment in group_enrichment.values():
        experience_lists.append({"group": enrichment.get("experiences")})
    experience_items = [
        item
        for collection in experience_lists
        for items in collection.values() if isinstance(items, list)
        for item in items if isinstance(item, dict)
    ]
    universe_ids = sorted({item.get("id") for item in experience_items if isinstance(item.get("id"), int)})
    if universe_ids:
        joined_ids = ",".join(str(universe_id) for universe_id in universe_ids)
        details = fetch_data(f"https://games.roblox.com/v1/games?universeIds={joined_ids}")
        votes = fetch_data(f"https://games.roblox.com/v1/games/votes?universeIds={joined_ids}")
        icons = fetch_data(
            "https://thumbnails.roblox.com/v1/games/icons?universeIds=" + joined_ids
            + "&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false"
        )
        detail_map = {item.get("id"): item for item in details or [] if isinstance(item, dict)}
        vote_map = {item.get("id"): item for item in votes or [] if isinstance(item, dict)}
        icon_map = {item.get("targetId"): item for item in icons or [] if isinstance(item, dict)}
        for item in experience_items:
            universe_id = item.get("id")
            detail = detail_map.get(universe_id, {})
            vote = vote_map.get(universe_id, {})
            icon = icon_map.get(universe_id, {})
            item.update({
                "playing": detail.get("playing"),
                "favorites": detail.get("favoritedCount"),
                "maxPlayers": detail.get("maxPlayers"),
                "genre": detail.get("genre"),
                "copyingAllowed": detail.get("copyingAllowed"),
                "apiAccessAllowed": detail.get("studioAccessToApisAllowed"),
                "upVotes": vote.get("upVotes"),
                "downVotes": vote.get("downVotes"),
                "iconUrl": icon.get("imageUrl"),
            })

    # ── Sample public Economy metadata for currently equipped catalog assets ──
    inventory_types = set(INVENTORY_ASSET_TYPES.split(","))
    equipped_assets = [
        item
        for avatar in avatar_configurations.values() if isinstance(avatar, dict)
        for item in avatar.get("assets") or []
        if isinstance(item, dict) and item.get("type") in inventory_types and isinstance(item.get("id"), int)
    ]
    asset_metadata = {}
    for asset_id in sorted({item["id"] for item in equipped_assets}):
        details = fetch_or(f"https://economy.roblox.com/v2/assets/{asset_id}/details", None)
        if not isinstance(details, dict):
            continue
        asset_metadata[asset_id] = {
            "creator": obj(details.get("Creator")).get("Name"),
            "creatorType": obj(details.get("Creator")).get("CreatorType"),
            "price": details.get("PriceInRobux"),
            "sales": details.get("Sales"),
            "forSale": details.get("IsForSale"),
            "limited": details.get("IsLimited") or details.get("IsLimitedUnique"),
        }
    for item in equipped_assets:
        item["metadata"] = asset_metadata.get(item.get("id"))
    for inventory in inventories.values():
        for item in inventory.get("items") or []:
            if item.get("assetId") in asset_metadata:
                item["metadata"] = asset_metadata[item["assetId"]]

    result = {
        "users": USERS,
        "presences": presences,
        "avatars": avatars,
        "profiles": profiles,
        "experiences": experiences,
        "favoriteExperiences": favorite_experiences,
        "groups": groups,
        "usernameHistory": username_history,
        "inventories": inventories,
        "collectibles": collectibles,
        "avatarConfigurations": avatar_configurations,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }

    return result

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--fallback", help="Previous snapshot used only for failed sub-endpoints")
    args = parser.parse_args()
    snapshot = main()
    fallback_used = False
    if args.fallback:
        try:
            with open(args.fallback, encoding="utf-8") as fallback_file:
                previous_snapshot = json.load(fallback_file)
            snapshot, fallback_used = merge_missing(snapshot, previous_snapshot)
        except (OSError, json.JSONDecodeError):
            pass
    snapshot["fallbackUsed"] = fallback_used
    print(json.dumps(snapshot))
