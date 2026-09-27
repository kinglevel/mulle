#!/usr/bin/env python3
"""Build server/public/parts-catalogue.json: every part a player can own,
with a name, a category and its stats.

The game's own data (parts.hash.json) has no names or categories: a part is
an id, sprites, a voice line and a bag of properties, and many parts are a
"master" that morphs into size/colour variants once mounted (MorphsTo), with
the properties on the variants. Upstream mulle.js names 93 parts in
part_names.json; the rest were named here by looking at their sprites, and a
few upstream names are corrected (NAMES below).

Categories come from what a part does (its properties, merged over its
variants), then where it mounts (Requires):

    engines, batteries, tanks, wheels, brakes, steering, gearboxes,
    bodywork (front/middle/back sections, #b1/#b2/#b4), seats, horns,
    lights, exhaust, accessories (the rest: flags, antennas, dashboards...)

    parts_catalogue.py games/sv/data server/public/parts-catalogue.json
"""

import json
import sys
from pathlib import Path

# Names for parts upstream leaves unnamed, and fixes to upstream's. English.
NAMES = {
    13: 'rusty truck cab', 23: 'yellow back', 35: 'ticket booth', 66: 'bumper bar',
    69: 'wicker demijohn', 90: 'fox-tail antenna', 112: 'orange dashboard',
    119: 'green beetle front', 120: 'stool', 126: 'wicker basket', 140: 'car tires',
    143: 'red-rim tires', 153: 'bicycle wheels', 155: 'sleeping bag', 158: 'garden shed',
    161: 'cowcatcher', 168: 'smiling boiler front', 172: 'round fuel tank',
    173: 'fire ladder', 174: 'ambulance front', 175: 'ambulance back',
    184: 'crate seat', 185: 'blue police light', 186: 'racing tires',
    189: 'butterfly chair', 190: 'ship vent', 195: 'bulb horn', 196: 'skis',
    199: 'hammock cab', 200: 'sled runners', 203: 'plastic jerry can', 208: 'police cab',
    209: 'police front', 210: 'police back', 211: 'small lamp', 216: 'motorcycle engine',
    219: 'light bar with siren', 220: 'exhaust pipe', 221: 'rocket middle',
    222: 'red jerry can', 227: 'rocket nose', 228: 'green pennant', 233: 'pedal plank',
    234: 'blue pennant', 235: 'dump-truck bed', 236: 'drum brakes', 239: 'disc brakes',
    245: 'monster tires', 248: 'chrome bumper', 251: 'washing-machine engine',
    254: 'log wheels', 257: 'whitewall tires', 260: 'small gearbox', 261: 'hand brake',
    265: 'car battery', 271: 'straight exhaust', 272: 'green gearbox',
    273: 'wooden-box battery', 278: 'vintage truck front', 279: 'taxi front',
    280: 'taxi sign', 281: 'taxi back', 282: 'taxi cab', 283: 'red engine',
    286: 'red pennant', 288: 'red gearbox', 289: 'trumpet horn', 290: 'pirate flag',
    291: 'runners', 294: 'green bench seat', 295: 'tiger-stripe couch',
    296: 'ribbon antenna', 297: 'roller skates', 300: 'green racer front',
    301: 'green racer back', 302: 'green racer middle',
}

# Property names are spelled inconsistently in the data (FuelVolume,
# Fuelvolume, …); this is the spelling the catalogue uses.
STATS = {
    'weight': 'weight', 'color': 'color', 'durability': 'durability', 'grip': 'grip',
    'funnyfactor': 'funnyFactor', 'strength': 'strength', 'loadcapacity': 'loadCapacity',
    'fuelvolume': 'fuelVolume', 'speed': 'speed', 'comfort': 'comfort',
    'enginetype': 'engineType', 'electricvolume': 'electricVolume',
    'fuelconsumption': 'fuelConsumption', 'lamps': 'lamps', 'horn': 'horn',
    'break': 'brake', 'horntype': 'hornType', 'steering': 'steering',
    'electricconsumption': 'electricConsumption', 'acceleration': 'acceleration',
    'pedals': 'pedals', 'exhaustpipe': 'exhaustPipe',
}

BODY_SLOTS = {'#b1': 'front', '#b2': 'middle', '#b4': 'back'}

# First matching stat decides the category; then the mounting slot.
BY_STAT = [('engineType', 'engines'), ('electricVolume', 'batteries'),
           ('fuelVolume', 'tanks'), ('grip', 'wheels'), ('durability', 'wheels'),
           ('brake', 'brakes'), ('steering', 'steering'), ('acceleration', 'gearboxes')]
AFTER_BODY = [('comfort', 'seats'), ('horn', 'horns'), ('lamps', 'lights'),
              ('exhaustPipe', 'exhaust')]


def stats_of(part):
    props = part['Properties'] if isinstance(part['Properties'], dict) else {}
    return {STATS.get(k.lower(), k): v for k, v in props.items()}


def slots_of(part):
    return part['Requires'] if isinstance(part['Requires'], list) else []


def category(pid, stats, slots):
    if pid == 1:
        return 'chassis'
    for stat, cat in BY_STAT:
        if stat in stats:
            return cat
    if set(slots) & set(BODY_SLOTS):
        return 'bodywork'
    for stat, cat in AFTER_BODY:
        if stat in stats:
            return cat
    if '#a19' in slots:
        return 'exhaust'
    return 'accessories'


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    data, out = Path(sys.argv[1]), Path(sys.argv[2])
    parts = json.loads((data / 'parts.hash.json').read_text())
    upstream = json.loads((data / 'part_names.json').read_text())

    catalogue = []
    for key, part in sorted(parts.items(), key=lambda kv: int(kv[0])):
        pid = int(key)
        if part['master']:  # a variant: listed under its master
            continue
        variants = [parts[str(v)] for v in (part['MorphsTo'] or []) if str(v) in parts]
        stats = stats_of(part)
        slots = list(slots_of(part))
        for v in variants:
            for k, x in stats_of(v).items():
                stats.setdefault(k, x)
            slots += [s for s in slots_of(v) if s not in slots]
        cat = category(pid, stats, slots)
        entry = {
            'id': pid,
            'name': NAMES.get(pid) or upstream.get(key) or 'part %d' % pid,
            'category': cat,
            'stats': stats,
            'slots': slots,
            'voice': part['description'],
            'variants': [{'id': v['partId'], 'stats': stats_of(v), 'slots': slots_of(v)}
                         for v in variants],
        }
        if cat == 'bodywork':
            entry['section'] = next(BODY_SLOTS[s] for s in slots if s in BODY_SLOTS)
        catalogue.append(entry)

    out.write_text(json.dumps({'parts': catalogue}, indent=1, ensure_ascii=False) + '\n')
    counts = {}
    for e in catalogue:
        counts[e['category']] = counts.get(e['category'], 0) + 1
    print('%d parts -> %s' % (len(catalogue), out), counts)


if __name__ == '__main__':
    main()
