"""Decode a Director 5/6 score (VWSC chunk) and frame labels (VWLB).

drxtract reads the score with the Director 4 sprite layout, which garbles
D6 movies like Mulle Meck's. This decodes the delta-compressed frame stream
into full per-frame channel buffers and parses sprites with the D5/D6 layout.
"""
import json
import struct
import sys


def labels(path):
    d = open(path, 'rb').read()
    n = struct.unpack('>H', d[:2])[0]
    ents = [struct.unpack('>HH', d[2 + 4 * i:6 + 4 * i]) for i in range(n)]
    base = 2 + 4 * n
    tlen = struct.unpack('>I', d[base:base + 4])[0]
    txt = d[base + 4:base + 4 + tlen]
    out = {}
    for i, (frame, off) in enumerate(ents):
        end = ents[i + 1][1] if i + 1 < n else tlen
        out[frame] = txt[off:end].decode('mac_roman')
    return out


def entries(path):
    """D6 VWSC is a container: header, offset table, then entry blobs.
    Entry 0 is the frame stream, entry 1 the sprite-span order, and the rest
    sprite spans and their behaviour lists."""
    d = open(path, 'rb').read()
    _total, _ver, _hdr, count, listsize, _maxlen = struct.unpack('>iiiiii', d[:24])
    offs = struct.unpack('>%di' % listsize, d[24:24 + 4 * listsize])
    base = 24 + 4 * listsize
    return [d[base + offs[i]:base + offs[i + 1]] for i in range(count)]


def frames(path):
    d = entries(path)[0]
    _size, hdr, nframes, fver, rec, nch, _disp = struct.unpack('>iiihhhh', d[:20])
    buf = bytearray(nch * rec)
    p = hdr
    out = []
    # D6 leaves numFrames at 0; walk the stream to its declared size instead.
    while p + 2 <= min(_size, len(d)):
        fsize = struct.unpack('>H', d[p:p + 2])[0]
        end = p + fsize
        q = p + 2
        while q < end:
            ln, off = struct.unpack('>HH', d[q:q + 4])
            buf[off:off + ln] = d[q + 4:q + 4 + ln]
            q += 4 + ln
        out.append(bytes(buf))
        p = end
    return dict(nframes=len(out), rec=rec, nch=nch, fver=fver), out


def u16(b, o):
    return struct.unpack('>H', b[o:o + 2])[0]


def s16(b, o):
    return struct.unpack('>h', b[o:o + 2])[0]


def main_channels(b):
    """D6 main channels are six 24-byte records: 0 frame script, 1 tempo,
    2 transition, 3 sound 2, 4 sound 1, 5 palette. Cast references are
    (castLib u16, member u16) at the start of each record."""
    def member(ch):
        return u16(b, ch * 24 + 2) or None

    def ref(ch):
        m = member(ch)
        return (u16(b, ch * 24), m) if m else None
    return {
        'script': member(0),
        'tempo': b[24 + 5] or None,  # fps; 0 = unchanged
        'transition': member(2),
        'sound2': ref(3),  # (castLib, member)
        'sound1': ref(4),
    }


def sprite(b, o):
    member = u16(b, o + 6)
    if not member:
        return None
    return {
        'type': b[o], 'ink': b[o + 1] & 0x3f,
        'castLib': u16(b, o + 4), 'member': member,
        'script': u16(b, o + 10),
        'y': s16(b, o + 12), 'x': s16(b, o + 14),
        'h': s16(b, o + 16), 'w': s16(b, o + 18),
        'blend': b[o + 21],
    }


if __name__ == '__main__':
    info, fr = frames(sys.argv[1])
    print(json.dumps(info), file=sys.stderr)
