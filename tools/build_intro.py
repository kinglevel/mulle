"""Extract the narrated intro from 10.DXR into a JSON score for mulle.js.

The original plays the intro from the "IntroStart" marker of 10.DXR after
you log in on the name screen, then jumps to movie 03 (the garage). mulle.js
never ported it. This reads the Director 6 data straight from the movie
(score, labels, film loops, sprite behaviours, AnimChart text members and
the frame scripts' bytecode) and writes a compact score that
src/scenes/intro.js plays back.

    python3 build_intro.py <10.DXR> <cst_out 10.DXR/metadata.json> <out.json>
"""
import json
import os
import re
import struct
import sys
import tempfile

sys.path.insert(0, os.path.dirname(__file__))
import d6score  # noqa: E402
import lingo_disasm  # noqa: E402
import riffdump  # noqa: E402

START_LABEL = 'IntroStart'
ANIM_BEHAVIOR = (2, 106)    # 00.CXT "Anim" behaviour (SpriteAnim)
CURSOR_BEHAVIOR = (2, 108)  # 00.CXT custom-cursor sprite; not drawn


# ---- Lingo value literals ([#a: 1, #b: [point(1, 2)]], "str", #sym) -------

def parse_lingo(text):
    tokens = re.findall(r'"[^"]*"|#\w+|-?\d+\.\d+|-?\d+|point|\w+|[\[\]\(\):,]', text)
    pos = 0

    def peek():
        return tokens[pos] if pos < len(tokens) else None

    def take(expect=None):
        nonlocal pos
        t = tokens[pos]
        if expect is not None and t != expect:
            raise ValueError('expected %s got %s' % (expect, t))
        pos += 1
        return t

    def value():
        t = peek()
        if t == '[':
            take('[')
            if peek() == ']':
                take(']')
                return []
            if peek() == ':':  # [:] empty proplist
                take(':')
                take(']')
                return {}
            first = value()
            if peek() == ':':
                take(':')
                out = {str(first).lower(): value()}
                while peek() == ',':
                    take(',')
                    k = value()
                    take(':')
                    out[str(k).lower()] = value()
                take(']')
                return out
            out = [first]
            while peek() == ',':
                take(',')
                out.append(value())
            take(']')
            return out
        if t == 'point':
            take('point')
            take('(')
            x = value()
            take(',')
            y = value()
            take(')')
            return {'point': [x, y]}
        take()
        if t.startswith('"'):
            return t[1:-1]
        if t.startswith('#'):
            return t[1:]
        if re.fullmatch(r'-?\d+', t):
            return int(t)
        if re.fullmatch(r'-?\d+\.\d+', t):
            return float(t)
        return t  # bare word (VOID etc.)

    return value()


def lower_keys(v):
    if isinstance(v, dict):
        return {k.lower(): lower_keys(x) for k, x in v.items()}
    if isinstance(v, list):
        return [lower_keys(x) for x in v]
    if isinstance(v, str):
        return v
    return v


# ---- chunk plumbing ---------------------------------------------------------

def chunk_members(bindir):
    """Map chunk id -> owning cast member number, via KEY_ and CAS_."""
    files = os.listdir(bindir)
    key = open(os.path.join(bindir, next(f for f in files if f.endswith('.KEY_'))), 'rb').read()
    cas = open(os.path.join(bindir, next(f for f in files if f.endswith('.CAS_'))), 'rb').read()
    _es, _es2, _cnt, used = struct.unpack('<HHII', key[:12])
    owner = {}
    for i in range(used):
        sid, cid, _fcc = struct.unpack('<II4s', key[12 + 12 * i:24 + 12 * i])
        owner[sid] = cid
    cast_ids = struct.unpack('>%dI' % (len(cas) // 4), cas)
    member_of_cast = {c: i + 1 for i, c in enumerate(cast_ids) if c}
    return {sid: member_of_cast.get(cid) for sid, cid in owner.items()}


def find(bindir, ext):
    return sorted(os.path.join(bindir, f) for f in os.listdir(bindir) if f.endswith('.' + ext))


def stxt(path):
    d = open(path, 'rb').read()
    hl, tl = struct.unpack('>II', d[:8])
    return d[hl:hl + tl].decode('mac_roman')


# ---- frame scripts -> small declarative ops --------------------------------

def classify_script(script):
    """Reduce a frame script to what the intro player needs to know."""
    op = {}
    for h in script.handlers:
        dis = script.disasm(h)
        text = '\n'.join(dis)
        name = h['name'].lower()
        if name == 'exitframe':
            if 'soundBusy' in text:
                ch = int(re.search(r'pushint8\s+(\d+)', text).group(1))
                op['type'] = 'waitSound'
                op['channel'] = ch
            elif re.search(r"pushcons\s+\d+\s+'(\w+)'", text) and 'go' in text:
                m = re.search(r"pushint8\s+(\d+)\s*\n.*pushcons\s+\d+\s+'(\w+)'", text)
                op['type'] = 'gotoMovie'
                op['frame'] = int(m.group(1))
                op['movie'] = m.group(2)
            elif 'thebuiltin' in text and 'frame' in text and 'extcall' in text and ' go' in text:
                op['type'] = 'hold'
            # anything else (preLoad) needs no playback
        elif name == 'cuepassed':
            m = re.search(r"pushcons\s+\d+\s+'([^']+)'", text)
            if m and ' add ' in text.replace('add  ', ' add '):
                op['cue'] = m.group(1)
                ch = re.search(r'getparam\s+\d+\s+whichChannel\s*\n\s*\d+\s+pushint8\s+(\d+)', text)
                op['cueChannel'] = int(ch.group(1)) if ch else 1
    return op or None


# ---- main -------------------------------------------------------------------

def build(movie, metadata_path, out_path):
    with tempfile.TemporaryDirectory() as tmp:
        riffdump.dump(movie, tmp)
        bindir = os.path.join(tmp, 'bin')
        owners = chunk_members(bindir)
        meta = json.load(open(metadata_path))['libraries'][0]['members']
        names = {int(k): (v.get('name') or '') for k, v in meta.items()}
        # Cast library 2 is the shared cast 00.CXT (see the movie's MCsL).
        shared_path = os.path.join(os.path.dirname(os.path.dirname(metadata_path)), '00.CXT', 'metadata.json')
        shared = json.load(open(shared_path))['libraries'][0]['members'] if os.path.exists(shared_path) else {}
        lib_names = {1: names, 2: {int(k): (v.get('name') or '') for k, v in shared.items()}}
        by_name = {}
        for num, nm in sorted(names.items()):
            if nm:
                by_name.setdefault(nm.lower(), num)

        labels = d6score.labels(find(bindir, 'VWLB')[0])
        start = next(f for f, n in labels.items() if n == START_LABEL)
        vwsc = find(bindir, 'VWSC')[0]
        info, frames = d6score.frames(vwsc)
        entries = d6score.entries(vwsc)
        scripts = lingo_disasm.load_scripts(bindir)

        charts = {}
        for path in find(bindir, 'STXT'):
            member = owners.get(int(os.path.basename(path).split('.')[0]))
            nm = names.get(member, '')
            if nm.lower().endswith('animchart'):
                charts[nm[:-len('animchart')].lower()] = lower_keys(parse_lingo(stxt(path)))

        def member_box(num):
            v = meta.get(str(num), {})
            return (v.get('imageRegX', 0), v.get('imageRegY', 0),
                    v.get('imageWidth', 0), v.get('imageHeight', 0))

        loops = {}
        for path in find(bindir, 'SCVW'):
            member = owners.get(int(os.path.basename(path).split('.')[0]))
            linfo, lframes = d6score.frames(path)
            seq = []
            for b in lframes:
                seq.append([s for c in range(6, linfo['nch'])
                            for s in [d6score.sprite(b, c * linfo['rec'])] if s])
            # A film loop is registered on the centre of the union of its
            # sprites' rects; offsets are relative to that.
            xs, ys = [], []
            for f in seq:
                for s in f:
                    rx, ry, w, h = member_box(s['member'])
                    xs += [s['x'] - rx, s['x'] - rx + w]
                    ys += [s['y'] - ry, s['y'] - ry + h]
            cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
            loops[member] = [[{'member': s['member'], 'dx': s['x'] - cx, 'dy': s['y'] - cy}
                              for s in f] for f in seq]

        spans, out_frames, used_members = {}, [], set()
        script_ops = {}
        end = len(frames)
        # The tempo persists until a frame changes it, so pick it up from frame 1.
        tempo = None
        for b in frames[:start - 1]:
            tempo = d6score.main_channels(b)['tempo'] or tempo
        for n in range(start, end + 1):
            b = frames[n - 1]
            main = d6score.main_channels(b)
            tempo = main['tempo'] or tempo
            if main['script'] and main['script'] not in script_ops:
                script_ops[main['script']] = classify_script(scripts[main['script']]) \
                    if main['script'] in scripts else None
            sprites = []
            for c in range(6, info['nch']):
                s = d6score.sprite(b, c * info['rec'])
                if not s:
                    continue
                idx = s['script']
                if idx not in spans:
                    span = {'behaviors': []}
                    bl = entries[idx + 1] if idx + 1 < len(entries) else b''
                    for k in range(0, len(bl), 8):
                        lib, mem, p = struct.unpack('>HHI', bl[k:k + 8])
                        params = entries[p].decode('mac_roman') if p and p < len(entries) else ''
                        span['behaviors'].append({'lib': lib, 'member': mem,
                                                  'params': lower_keys(parse_lingo(params)) if params else {}})
                    spans[idx] = span
                span = spans[idx]
                if any((bh['lib'], bh['member']) == CURSOR_BEHAVIOR for bh in span['behaviors']):
                    continue
                lib = s['castLib'] or 1
                if lib == 1:
                    if str(s['member']) not in meta and s['member'] not in loops:
                        continue  # empty cast slot: Director draws nothing
                    used_members.add(s['member'])
                elif lib == 2:
                    if str(s['member']) not in shared:
                        continue
                else:
                    raise SystemExit('frame %d ch%d: sprite from castLib %d not supported' % (n, c, lib))
                sprite = {'ch': c, 'span': idx, 'member': s['member'], 'x': s['x'], 'y': s['y']}
                if lib == 2:
                    sprite['movie'] = '00.CXT'  # shared cast, loaded globally by upstream
                sprites.append(sprite)
            snd = {}
            for key in ('sound1', 'sound2'):
                if main[key]:
                    lib, num = main[key]
                    name = lib_names.get(lib, {}).get(num)
                    if not name:
                        raise SystemExit('frame %d: cannot resolve %s castLib %d member %d' % (n, key, lib, num))
                    snd[key] = name
            out_frames.append({'n': n, 'tempo': tempo, 'script': main['script'],
                               'sprites': sprites, **snd})

        # Only keep behaviours the player implements, with members resolved.
        anim = {}
        for idx, span in spans.items():
            for bh in span['behaviors']:
                if (bh['lib'], bh['member']) == ANIM_BEHAVIOR:
                    p = dict(bh['params'])
                    ff = p.get('firstframe', '')
                    p['firstframe'] = by_name.get(str(ff).lower()) if ff else None
                    anim[idx] = p

        for f in out_frames:
            for s in f['sprites']:
                if s['span'] in anim:
                    s['anim'] = True

        score = {
            'movie': os.path.basename(movie),
            'labels': {str(k): v for k, v in labels.items()},
            'scripts': {str(k): v for k, v in script_ops.items() if v},
            'frames': out_frames,
            'anim': {str(k): v for k, v in anim.items()},
            'charts': charts,
            'loops': {str(k): v for k, v in loops.items()},
        }
        with open(out_path, 'w') as fp:
            json.dump(score, fp, separators=(',', ':'))

        loop_members = {s['member'] for fr in loops.values() for f in fr for s in f}
        chart_members = set()
        for p in anim.values():
            chart = charts.get(str(p.get('framelistmember', '')).lower(), {})
            for frames_ in chart.get('actions', {}).values():
                for x in frames_:
                    if isinstance(x, int) and p['firstframe']:
                        chart_members.add(p['firstframe'] + x - 1)
        print('intro: frames %d-%d, %d spans with Anim, members used: %s' % (
            start, end, len(anim), sorted((used_members | loop_members | chart_members) - set(loops))))


if __name__ == '__main__':
    build(*sys.argv[1:4])
