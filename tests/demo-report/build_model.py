"""Builds demo-model.json for the Site visit report from the Demo project's live rows (pulled 2026-11-10 via SQL, compacted):
VISIT = this visit's ticks per device, AGG = every other check counted per floor/room/stage/done, plus the notes / snags / RFIs."""
import json, os
VISIT = open(os.path.join(os.path.dirname(__file__), 'visit.txt')).read().strip()
AGG = open(os.path.join(os.path.dirname(__file__), 'agg.txt')).read().strip()
ROOMS = "B2EN|1F|Bed 2 Ensuite;B34E|1F|Bed 3/4 Ensuite;B5EN|1F|Bed 5 Ensuite;BAR|GF|Bar Area;BED2|1F|Bed 2;BED3|1F|Bed 3;BED4|1F|Bed 4;BED5|1F|Bed 5;BRK|GF|Breakfast Area;CLK|GF|Cloaks;DIN|GF|Dining Area;EXT|GF|Exterior;GAR|GF|Garage;GYM|GF|Gym;HALL|GF|Entrance Hall;INH|GF|Inner Hall / Stairs;KIT|GF|Kitchen;LAND|1F|Landing;LAUN|1F|Laundry Room;LIV|GF|Living Area;LNG|GF|Lounge;MBED|1F|Master Bed;MDRS|1F|Master Dressing;MENS|1F|Master Ensuite;OFF|1F|Office;PLAY|GF|Playroom;PRAY|1F|Prayer Room;PRCH|GF|Porch;SITT|GF|Sitting Room (cinema);WC|1F|W.C.;WC1|GF|WC (gym);WC2|GF|WC (rear)"
code_by_name = {}
for r in ROOMS.split(';'):
    c, f, n = r.split('|'); code_by_name[(f, n)] = c
WHO = {'bryn': 'bryn@sonor.co.uk', 'mark': 'mark@sonor.co.uk'}
devs = {}
for row in VISIT.split(';'):
    k, fc, rn, name, nn, st, wh, tm = row.split('|')
    d = devs.setdefault(k, {'key': k, 'name': name or k, 'floor': fc or None, 'room_name': rn or None, 'room': code_by_name.get((fc, rn)), 'nn': int(nn) if nn else None, 'checks': [], 'notes': []})
    d['checks'].append({'stage': st, 'done': True, 'at': '2026-11-10T%s:00Z' % tm, 'by': WHO.get(wh, wh), 'key': 'v%d' % len(d['checks']), 'task_id': 't'})
# room-code stand-ins so fillPlaces can place the punch-only keys exactly as the live seam does
for r in ROOMS.split(';'):
    c, f, n = r.split('|'); devs.setdefault('_room_' + c, {'key': '_room_' + c, 'name': n, 'floor': f, 'room_name': n, 'room': c, 'nn': None, 'checks': [], 'notes': []})
i = 0
for row in AGG.split(';'):
    fc, rn, st, dn, n = row.split('|'); i += 1
    devs['agg%d' % i] = {'key': 'agg%d' % i, 'name': 'agg', 'floor': fc or None, 'room_name': rn or None, 'room': code_by_name.get((fc, rn)), 'nn': None, 'notes': [],
                         'checks': [{'stage': st, 'done': dn == '1', 'at': '2026-10-20T10:00:00Z' if dn == '1' else None, 'by': None, 'key': 'a%d' % j, 'task_id': 't'} for j in range(int(n))]}
model = json.load(open(os.path.join(os.path.dirname(__file__), 'rest.json')))
model['devices'] = list(devs.values())
json.dump(model, open(os.path.join(os.path.dirname(__file__), 'demo-model.json'), 'w'))
print(len(model['devices']), 'devices', sum(len(d['checks']) for d in model['devices']), 'checks')
