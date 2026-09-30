"""Public sample commissions. No identities, live counts, or confidential values."""

ROOMS = [
    {"id": "solar-commons", "title": "A brighter kind of public space.",
     "organization": "Solar Commons", "category": "Design & build", "location": "Salvador, BR",
     "summary": "Design a modular, solar-powered gathering space for a neighborhood creative cooperative.",
     "minimum": 240000, "maximum": 800000, "currency": "BRL", "deadline": "2026-10-16T18:00:00Z",
     "duration": "6 weeks", "tags": ["Spatial design", "Clean energy"], "is_sample": True},
    {"id": "radio-futura", "title": "Give the next wave a voice.",
     "organization": "Rádio Futura", "category": "Sound & culture", "location": "Recife, BR",
     "summary": (
         "Create an original sonic identity and five audio signatures for an independent community radio."
     ),
     "minimum": 120000, "maximum": 450000, "currency": "BRL", "deadline": "2026-10-21T18:00:00Z",
     "duration": "3 weeks", "tags": ["Sound design", "Community radio"], "is_sample": True},
    {"id": "circular-objects", "title": "Nothing wasted. Everything reimagined.",
     "organization": "Oficina Circular", "category": "Objects & craft", "location": "São Paulo, BR",
     "summary": "Develop a small collection of repairable objects using reclaimed industrial material.",
     "minimum": 180000, "maximum": 600000, "currency": "BRL", "deadline": "2026-10-28T18:00:00Z",
     "duration": "4 weeks", "tags": ["Product design", "Circular materials"], "is_sample": True},
]


def find_room(room_id: str) -> dict | None:
    return next((room for room in ROOMS if room["id"] == room_id), None)
