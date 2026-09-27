#!/usr/bin/env python3
"""Unpack an Afterburner-compressed Director file (.dcr / .cct) into a plain
PC movie/cast (.dxr / .cxt), laid out like the original CDs' files so
ShockwaveParser and drxtract read it the same way.

The 2006 English re-release (Gary Gadget: Building Cars, Viva Media) ships
its movies Shockwave-compressed, where every other release ships plain
Director 6 files. Afterburner keeps the chunks themselves intact, just
zlib-compressed and indexed differently:

    RIFX <len> FGDM|FGDC
      Fver  varint len, version info
      Fcdr  zlib: table of compression-type GUIDs
      ABMP  varint len, varint type, varint uncomp len, zlib:
              varint, varint, varint count,
              count x (id, offset, comp len, uncomp len, compression index, fourcc)
      FGEI  varint, then the chunk bodies; chunk 2 is the "initial load
            segment", a zlib stream of (varint id, body) for the small chunks

Chunk ids are what the movie's own tables (KEY*, CAS*, ...) refer to, so the
output memory map keeps every chunk at its original id. Integers in the input
are big-endian (RIFX), varints are MSB-first base-128. A few Director 7
differences from the Director 6 originals are smoothed over on the way out
(see pc_key_table, d6_member, pc_sound).

    unafterburn.py in.dcr out.dxr
"""

import struct
import sys
import zlib

ZLIB_GUID = bytes.fromhex('ac99e90400700b360000080007377a34')


class Reader:
    def __init__(self, data, pos=0):
        self.data = data
        self.pos = pos

    def eof(self):
        return self.pos >= len(self.data)

    def read(self, n):
        out = self.data[self.pos:self.pos + n]
        if len(out) != n:
            raise EOFError('read past end')
        self.pos += n
        return out

    def u8(self):
        return self.read(1)[0]

    def u16(self):
        return struct.unpack('>H', self.read(2))[0]

    def u32(self):
        return struct.unpack('>I', self.read(4))[0]

    def tag(self):
        return self.read(4).decode('latin-1')

    def varint(self):
        val = 0
        while True:
            b = self.u8()
            val = (val << 7) | (b & 0x7f)
            if not b & 0x80:
                return val


def inflate(data):
    return zlib.decompressobj().decompress(data)


def parse(data):
    r = Reader(data)
    if r.tag() != 'RIFX':
        raise ValueError('not a big-endian RIFX file')
    r.u32()
    codec = r.tag()
    if codec not in ('FGDM', 'FGDC'):
        raise ValueError('not an Afterburner file (codec %s)' % codec)

    if r.tag() != 'Fver':
        raise ValueError('missing Fver')
    fver_len = r.varint()
    start = r.pos
    fver_version = r.varint()
    imap_version = director_version = 0
    if fver_version >= 0x401:
        imap_version = r.varint()
        director_version = r.varint()
    r.pos = start + fver_len

    if r.tag() != 'Fcdr':
        raise ValueError('missing Fcdr')
    fcdr_len = r.varint()
    fcdr = Reader(inflate(r.read(fcdr_len)))
    guids = [fcdr.read(16) for _ in range(fcdr.u16())]

    if r.tag() != 'ABMP':
        raise ValueError('missing ABMP')
    abmp_len = r.varint()
    abmp_end = r.pos + abmp_len
    r.varint()  # compression type
    r.varint()  # uncompressed length
    abmp = Reader(inflate(r.read(abmp_end - r.pos)))
    abmp.varint()
    abmp.varint()
    chunks = {}
    for _ in range(abmp.varint()):
        cid = abmp.varint()
        offset = abmp.varint()
        comp_len = abmp.varint()
        uncomp_len = abmp.varint()
        comp_index = abmp.varint()
        tag = abmp.tag()
        chunks[cid] = dict(tag=tag, offset=offset, comp_len=comp_len,
                           uncomp_len=uncomp_len, guid=guids[comp_index])

    if r.tag() != 'FGEI':
        raise ValueError('missing FGEI')
    r.varint()
    body = r.pos

    bodies = {}
    ils = chunks.pop(2)
    ils_data = Reader(inflate(data[body:body + ils['comp_len']]))
    while not ils_data.eof():
        cid = ils_data.varint()
        bodies[cid] = ils_data.read(chunks[cid]['comp_len'])

    for cid, c in chunks.items():
        if cid in bodies:
            continue
        raw = data[body + c['offset']:body + c['offset'] + c['comp_len']]
        bodies[cid] = inflate(raw) if c['guid'] == ZLIB_GUID and c['comp_len'] else raw

    return dict(codec=codec, imap_version=imap_version, director_version=director_version,
                chunks=chunks, bodies=bodies)


# Movie-level KEY* links (owner 1024 + n is cast library n) that
# ShockwaveParser knows to skip. Director 7 adds more (FCOL, GRID, PUBL, VERS,
# XTRl, LctX), which it would attach to chunk #1024 instead; none of them
# matter for extracting cast members, so they are dropped. Owners >= 1024
# that are real CASt chunks (big casts have thousands) are member links.
KEY_LIBRARY_TYPES = {b'CAS*', b'Lctx', b'FXmp', b'Cinf', b'MCsL', b'Sord', b'VWCF', b'VWFI',
                     b'VWLB', b'VWSC', b'Fmap', b'SCRF', b'DRCF', b'VWFM', b'VWtk'}


def pc_key_table(body, members, present):
    """KEY* is in file byte order: rewrite it little-endian (tags reversed),
    as a PC file has it. members: the ids of the CASt chunks; present: every
    chunk id in the file (the export dropped some chunks KEY* still lists)."""
    header_len, entry_len, _, used = struct.unpack('>HHii', body[:12])
    keep = []
    for i in range(used):
        entry = body[header_len + i * entry_len:header_len + (i + 1) * entry_len]
        chunk, owner, tag = struct.unpack('>ii4s', entry[:12])
        if chunk not in present:
            continue
        if owner < 1024 or owner in members or tag in KEY_LIBRARY_TYPES:
            keep.append(struct.pack('<ii', chunk, owner) + tag[::-1])
    return struct.pack('<HHii', 12, 12, len(keep), len(keep)) + b''.join(keep)


D6_INFO_FIELDS = 17


def split_info(info):
    """A CASt info block: 0x20 header, u16 field count, count+1 u32 offsets
    (the last is the data length), data. Returns (header, [field bytes])."""
    if len(info) < 0x22:
        return info[:0x20].ljust(0x20, b'\0'), []
    count = struct.unpack('>H', info[0x20:0x22])[0]
    offsets = struct.unpack('>%dI' % (count + 1), info[0x22:0x22 + 4 * (count + 1)])
    data = info[0x22 + 4 * (count + 1):]
    return info[:0x20], [data[offsets[i]:offsets[i + 1]] for i in range(count)]


def join_info(header, fields):
    offsets = [0]
    for f in fields:
        offsets.append(offsets[-1] + len(f))
    # ShockwaveParser drops any field ending within 8 bytes of the chunk's end
    # (its bounds check leaves out the chunk header), so leave 8 spare bytes.
    return (header + struct.pack('>H', len(fields))
            + struct.pack('>%dI' % len(offsets), *offsets) + b''.join(fields) + bytes(8))


def d6_member(body):
    """Bring a Director 7 CASt to the Director 6 layout ShockwaveParser expects.

    CASt: u32 type, u32 info len, u32 specific len, info, specific.
    Director 7 shrank the info header from 0x20 bytes to 0x14 and appended
    fields to the list after the 17 Director 6 has; the extra fields go.
    """
    member_type, info_len, specific_len = struct.unpack('>III', body[:12])
    info = body[12:12 + info_len]
    specific = body[12 + info_len:]
    if info_len >= 4 and struct.unpack('>I', info[:4])[0] == 0x14:
        info = struct.pack('>I', 0x20) + info[4:20] + bytes(12) + info[20:]
        header, fields = split_info(info)
        info = join_info(header, fields[:D6_INFO_FIELDS])
    if member_type == 1 and len(specific) < 24:
        # A 1-bit bitmap's data ends before the depth and palette fields, and
        # ShockwaveParser reads them anyway, from whatever follows. It takes a
        # depth over 32 to mean 1-bit, so spell that out.
        specific = specific[:22] + bytes([0, 0x21]) + struct.pack('>hh', 0, 0)
    return struct.pack('>III', member_type, len(info), len(specific)) + info + specific


def member_name(body):
    """The name (info field 1; field 0 is script text) of a D6 layout CASt."""
    info_len = struct.unpack('>I', body[4:8])[0]
    _, fields = split_info(body[12:12 + info_len])
    if len(fields) < 2 or not fields[1]:
        return ''
    return fields[1][1:1 + fields[1][0]].decode('latin-1')


def with_member_name(body, name):
    """Set the name of a D6 layout CASt with no script text and no name.

    ShockwaveParser reads the name as a Pascal string at field 0's offset,
    which is where field 1 starts when field 0 (script text) is empty."""
    member_type, info_len, specific_len = struct.unpack('>III', body[:12])
    header, fields = split_info(body[12:12 + info_len])
    if info_len < 0x20:
        header = struct.pack('>I', 0x20) + bytes(28)
    fields = fields + [b''] * (2 - len(fields))
    fields[1] = bytes([len(name)]) + name.encode('latin-1')
    info = join_info(header, fields)
    return struct.pack('>III', member_type, len(info), specific_len) + info + body[12 + info_len:]


def restore_names(chunks, bodies, reference):
    """Shockwave export stripped many member names (all script names, some
    sounds); the game looks sounds up by name. `reference` maps member number
    to (type, name) from the same file on another release: where this one's
    member at that number is nameless and of the same type, borrow the name."""
    restored = 0
    for cid, c in chunks.items():
        if c['tag'] != 'CAS*':
            continue
        slots = struct.unpack('>%di' % (len(bodies[cid]) // 4), bodies[cid])
        for i, member in enumerate(slots):
            ref = reference.get(i + 1)
            if not member or member not in bodies or not ref or not ref[1]:
                continue
            body = bodies[member]
            _, fields = split_info(body[12:12 + struct.unpack('>I', body[4:8])[0]])
            no_script = not fields or not fields[0]
            if struct.unpack('>I', body[:4])[0] == ref[0] and no_script and not member_name(body):
                bodies[member] = with_member_name(body, ref[1])
                restored += 1
    return restored


def without_xtra_members(cast_list, bodies):
    """Empty the CAS* slots of Xtra members (type 15, new in Director 7; the
    re-release's start movie has one). ShockwaveParser stops at an unknown
    member type, and nothing in the game uses them."""
    slots = list(struct.unpack('>%di' % (len(cast_list) // 4), cast_list))
    for i, member in enumerate(slots):
        if member in bodies and struct.unpack('>I', bodies[member][:4])[0] > 14:
            slots[i] = 0
    return struct.pack('>%di' % len(slots), *slots)


def aiff_rate(rate):
    """An integer sample rate as an 80-bit IEEE extended float."""
    exponent = rate.bit_length() - 1
    return struct.pack('>HQ', 16383 + exponent, rate << (63 - exponent))


def pc_sound(body):
    """Rewrite a Mac 'snd ' resource as 16-bit mono in the one layout
    ShockwaveParser decodes.

    The originals' sounds are 8-bit sndH/sndS pairs, which ShockwaveParser
    handles; its 'snd ' path takes the samples from byte 78 (a format 2
    resource with an extended header at 14) but reads the sample rate, byte
    length and sample size from fixed offsets as if the header offset were
    8. So: format 2, extended header at 14, the header-offset field set to 8,
    and the byte length stored in the (otherwise unused) loop end.
    """
    if len(body) < 14:
        return body
    fmt = struct.unpack('>H', body[:2])[0]
    if fmt == 1:
        synths = struct.unpack('>H', body[2:4])[0]
        cmds_at = 4 + synths * 6
    else:
        cmds_at = 4
    header = struct.unpack('>I', body[cmds_at + 6:cmds_at + 10])[0]
    encode = body[header + 20]
    rate = struct.unpack('>H', body[header + 8:header + 10])[0]

    if encode == 0:  # standard header: 8-bit unsigned mono
        length = struct.unpack('>I', body[header + 4:header + 8])[0]
        raw = body[header + 22:header + 22 + length]
        mono = [(b - 128) << 8 for b in raw]
    elif encode == 0xff:  # extended header
        channels = struct.unpack('>I', body[header + 4:header + 8])[0]
        frames = struct.unpack('>I', body[header + 22:header + 26])[0]
        bits = struct.unpack('>H', body[header + 48:header + 50])[0]
        data = body[header + 64:]
        if bits == 16:
            samples = struct.unpack('>%dh' % (frames * channels), data[:frames * channels * 2])
        else:
            samples = [(b - 128) << 8 for b in data[:frames * channels]]
        mono = [sum(samples[i:i + channels]) // channels for i in range(0, len(samples), channels)]
    else:
        return body  # compressed; leave it alone

    pcm = struct.pack('>%dh' % len(mono), *mono)
    return (struct.pack('>HHHHHI', 2, 0, 1, 0x8051, 0, 8)
            + struct.pack('>IIIII', 0, 1, rate << 16, 0, len(pcm))
            + bytes([0xff, 0x3c]) + struct.pack('>I', len(mono)) + aiff_rate(rate)
            + struct.pack('>IIIH', 0, 0, 0, 16) + bytes(14)
            + pcm)


def write_to(movie, fp, reference=None):
    """A plain PC (little-endian XFIR) file: header, imap at 12, mmap, then
    every chunk. As in the original CDs' files, only the container, imap,
    mmap and KEY* are little-endian; chunk bodies stay big-endian.

    reference: optional {member number: (type, name)} for restore_names."""
    chunks, bodies = movie['chunks'], dict(movie['bodies'])
    for cid, c in chunks.items():
        if c['tag'] == 'CASt':
            bodies[cid] = d6_member(bodies[cid])
        elif c['tag'] == 'snd ':
            bodies[cid] = pc_sound(bodies[cid])
    if reference:
        restore_names(chunks, bodies, reference)
    for cid, c in chunks.items():
        if c['tag'] == 'CAS*':
            bodies[cid] = without_xtra_members(bodies[cid], bodies)
    members = {cid for cid, c in chunks.items() if c['tag'] == 'CASt'}
    for cid, c in chunks.items():
        if c['tag'] == 'KEY*':
            bodies[cid] = pc_key_table(bodies[cid], members, set(chunks))
    codec = 'MV93' if movie['codec'] == 'FGDM' else 'MC95'

    def tag(t):
        return t.encode('latin-1')[::-1]

    count = max(max(chunks), 2) + 1
    mmap_len = 24 + 20 * count
    imap_len = 24
    mmap_offset = 12 + 8 + imap_len

    entries = [None] * count
    offset = mmap_offset + 8 + mmap_len
    order = [cid for cid in sorted(chunks) if cid >= 3]
    for cid in order:
        entries[cid] = (chunks[cid]['tag'], len(bodies[cid]), offset)
        offset += 8 + len(bodies[cid]) + (len(bodies[cid]) & 1)
    file_len = offset

    entries[0] = ('RIFX', file_len - 8, 0)
    entries[1] = ('imap', imap_len, 12)
    entries[2] = ('mmap', mmap_len, mmap_offset)

    out = bytearray()
    out += tag('RIFX') + struct.pack('<I', file_len - 8) + tag(codec)
    out += tag('imap') + struct.pack('<I', imap_len)
    out += struct.pack('<iiiiii', 1, mmap_offset, movie['imap_version'], 0, 0, 0)

    out += tag('mmap') + struct.pack('<I', mmap_len)
    # header len, entry len, max chunks, used chunks, junk head, junk head 2, free head
    out += struct.pack('<HHiiiii', 24, 20, count, count, -1, -1, -1)
    for e in entries:
        if e is None:
            out += tag('free') + struct.pack('<iihhi', 0, 0, 12, 0, -1)
        else:
            t, length, off = e
            out += tag(t) + struct.pack('<iihhi', length, off, 0, 0, -1)

    for cid in order:
        body = bodies[cid]
        out += tag(chunks[cid]['tag']) + struct.pack('<I', len(body)) + body
        if len(body) & 1:
            out += b'\0'

    assert len(out) == file_len
    fp.write(out)


def write(movie, out_path):
    with open(out_path, 'wb') as f:
        write_to(movie, f)


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    with open(sys.argv[1], 'rb') as f:
        movie = parse(f.read())
    write(movie, sys.argv[2])


if __name__ == '__main__':
    main()
