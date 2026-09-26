"""Dump every chunk of a Director RIFX/XFIR file (incl. protected MC95 casts)
to <out>/bin/<id>.<fourcc>, the same layout drxtract produces.

    python3 riffdump.py <movie> <outdir>
"""
import os
import struct
import sys


def dump(path, outdir):
    d = open(path, 'rb').read()
    little = d[:4] == b'XFIR'
    e = '<' if little else '>'

    def tag(b):
        return (b[::-1] if little else b).decode('latin1')

    # imap sits right after the 12-byte RIFX header; it points at the mmap.
    assert tag(d[12:16]) == 'imap', tag(d[12:16])
    mmap_off = struct.unpack(e + 'I', d[24:28])[0]
    assert tag(d[mmap_off:mmap_off + 4]) == 'mmap'
    body = mmap_off + 8
    hlen, elen, _max, used = struct.unpack(e + 'HHii', d[body:body + 12])
    os.makedirs(os.path.join(outdir, 'bin'), exist_ok=True)
    n = 0
    for i in range(used):
        q = body + hlen + i * elen
        fourcc = tag(d[q:q + 4])
        size, off = struct.unpack(e + 'Ii', d[q + 4:q + 12])
        if fourcc in ('free', 'junk', 'RIFX', 'imap', 'mmap') or off <= 0:
            continue
        data = d[off + 8:off + 8 + size]
        safe = fourcc.replace('*', '_').replace(' ', '_')
        with open(os.path.join(outdir, 'bin', '%d.%s' % (i, safe)), 'wb') as fp:
            fp.write(data)
        n += 1
    return n


if __name__ == '__main__':
    print(dump(sys.argv[1], sys.argv[2]), 'chunks')
