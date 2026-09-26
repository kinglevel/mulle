"""Minimal Director 5/6 Lingo bytecode disassembler.

Reads the raw Lnam (name table) and Lscr (compiled script) chunks that
drxtract dumps into bin/, and prints each handler as annotated bytecode.
Layouts follow ProjectorRays' reverse-engineered format notes.

    python3 lingo_disasm.py <bin dir> [castMember ...]
"""
import glob
import os
import struct
import sys

OPS = {
    0x01: 'ret', 0x02: 'retfactory', 0x03: 'pushzero', 0x04: 'mul', 0x05: 'add', 0x06: 'sub',
    0x07: 'div', 0x08: 'mod', 0x09: 'inv', 0x0a: 'joinstr', 0x0b: 'joinpadstr', 0x0c: 'lt',
    0x0d: 'lteq', 0x0e: 'nteq', 0x0f: 'eq', 0x10: 'gt', 0x11: 'gteq', 0x12: 'and', 0x13: 'or',
    0x14: 'not', 0x15: 'containsstr', 0x16: 'contains0str', 0x17: 'getchunk', 0x18: 'hilitechunk',
    0x19: 'ontospr', 0x1a: 'intospr', 0x1b: 'getfield', 0x1c: 'starttell', 0x1d: 'endtell',
    0x1e: 'pushlist', 0x1f: 'pushproplist', 0x21: 'swap',
    0x41: 'pushint8', 0x42: 'pusharglistnoret', 0x43: 'pusharglist', 0x44: 'pushcons',
    0x45: 'pushsymb', 0x46: 'pushvarref', 0x48: 'getglobal2', 0x49: 'getglobal', 0x4a: 'getprop',
    0x4b: 'getparam', 0x4c: 'getlocal', 0x4d: 'setglobal2', 0x4f: 'setglobal', 0x50: 'setprop',
    0x51: 'setparam', 0x52: 'setlocal', 0x53: 'jmp', 0x54: 'endrepeat', 0x55: 'jmpifz',
    0x56: 'localcall', 0x57: 'extcall', 0x58: 'objcallv4', 0x59: 'put', 0x5a: 'putchunk',
    0x5b: 'deletechunk', 0x5c: 'get', 0x5d: 'set', 0x5f: 'getmovieprop', 0x60: 'setmovieprop',
    0x61: 'getobjprop', 0x62: 'setobjprop', 0x63: 'tellcall', 0x64: 'peek', 0x65: 'pop',
    0x66: 'thebuiltin', 0x67: 'objcall', 0x6d: 'pushchunkvarref', 0x6e: 'pushint16',
    0x6f: 'pushint32', 0x70: 'getchainedprop', 0x71: 'pushfloat32', 0x72: 'gettoplevelprop',
    0x73: 'newobj',
}
# Operand is an index into the name table for these.
NAMED = {'pushsymb', 'getglobal', 'getglobal2', 'setglobal', 'setglobal2', 'getprop', 'setprop',
         'extcall', 'getobjprop', 'setobjprop', 'objcall', 'getmovieprop', 'setmovieprop',
         'thebuiltin', 'getchainedprop', 'gettoplevelprop', 'newobj', 'pushvarref', 'objcallv4'}


def load_names(bindir):
    path = glob.glob(os.path.join(bindir, '*.Lnam'))[0]
    d = open(path, 'rb').read()
    _u0, _u1, _l1, _l2, off, cnt = struct.unpack('>iiIIHH', d[:20])
    names, p = [], off
    for _ in range(cnt):
        n = d[p]
        names.append(d[p + 1:p + 1 + n].decode('mac_roman'))
        p += 1 + n
    return names


def i16s(d, off, count):
    return list(struct.unpack('>%dh' % count, d[off:off + 2 * count])) if count else []


class Script:
    def __init__(self, path, names):
        self.path = path
        self.names = names
        d = self.d = open(path, 'rb').read()
        (cast_id,) = struct.unpack('>i', d[44:48])
        self.cast_id = cast_id & 0xffff  # high word is the cast library
        p = 50
        (self.hv_count, self.hv_off, self.hv_size, self.prop_count, self.prop_off,
         self.glob_count, self.glob_off, self.h_count, self.h_off, self.lit_count, self.lit_off,
         self.litdata_count, self.litdata_off) = struct.unpack('>HIIHIHIHIHIII', d[p:p + 42])
        self.props = [self.name(i) for i in i16s(d, self.prop_off, self.prop_count)]
        self.globals = [self.name(i) for i in i16s(d, self.glob_off, self.glob_count)]
        self.literals = []
        for i in range(self.lit_count):
            t, o = struct.unpack('>II', d[self.lit_off + 8 * i:self.lit_off + 8 * i + 8])
            if t == 4:
                self.literals.append(o)
            else:
                q = self.litdata_off + o
                (ln,) = struct.unpack('>I', d[q:q + 4])
                raw = d[q + 4:q + 4 + ln]
                if t == 1:
                    self.literals.append(repr(raw.rstrip(b'\0').decode('mac_roman')))
                elif t == 9 and ln == 8:
                    self.literals.append(struct.unpack('>d', raw)[0])
                else:
                    self.literals.append('<lit t%d %s>' % (t, raw.hex()))
        self.handlers = []
        for i in range(self.h_count):
            q = self.h_off + 42 * i
            (nid, _vec, clen, coff, argc, argoff, locc, locoff, _gc, _go, _u1, _u2,
             _lc, _lo) = struct.unpack('>hHIIHIHIHIIHHI', d[q:q + 42])
            self.handlers.append(dict(
                name=self.name(nid), code=d[coff:coff + clen],
                args=[self.name(x) for x in i16s(d, argoff, argc)],
                locals=[self.name(x) for x in i16s(d, locoff, locc)]))

    def name(self, i):
        return self.names[i] if 0 <= i < len(self.names) else '#%d' % i

    def disasm(self, h):
        code, p, out = h['code'], 0, []
        while p < len(code):
            op = code[p]
            base = op if op < 0x40 else 0x40 + op % 0x40
            size = 0 if op < 0x40 else 1 if op < 0x80 else 2 if op < 0xc0 else 4
            arg = int.from_bytes(code[p + 1:p + 1 + size], 'big', signed=False) if size else None
            mn = OPS.get(base, 'op_%02x' % base)
            note = ''
            if mn in NAMED:
                note = self.name(arg)
            elif mn == 'pushcons':
                i = arg // 8
                note = str(self.literals[i] if i < len(self.literals) else '?')
            elif mn in ('getparam', 'setparam'):
                i = arg // 8  # D5+ scales variable operands by 8
                note = h['args'][i] if i < len(h['args']) else '?'
            elif mn in ('getlocal', 'setlocal'):
                i = arg // 8
                note = h['locals'][i] if i < len(h['locals']) else '?'
            elif mn == 'localcall':
                note = self.handlers[arg]['name'] if arg < len(self.handlers) else '?'
            elif mn in ('jmp', 'jmpifz'):
                note = '-> %d' % (p + arg)
            elif mn == 'endrepeat':
                note = '-> %d' % (p - arg)
            elif mn in ('pushint8', 'pushint16', 'pushint32') and size:
                arg = int.from_bytes(code[p + 1:p + 1 + size], 'big', signed=True)
            out.append('  %4d %-18s %-6s %s' % (p, mn, '' if arg is None else arg, note))
            p += 1 + size
        return out

    def dump(self):
        lines = ['== member %d  (%s)' % (self.cast_id, os.path.basename(self.path))]
        if self.props:
            lines.append('  property ' + ', '.join(self.props))
        if self.globals:
            lines.append('  global ' + ', '.join(self.globals))
        for h in self.handlers:
            lines.append(' on %s %s   -- locals: %s' % (h['name'], ', '.join(h['args']), ', '.join(h['locals'])))
            lines += self.disasm(h)
        return '\n'.join(lines)


def load_scripts(bindir):
    names = load_names(bindir)
    return {s.cast_id: s for s in (Script(p, names) for p in glob.glob(os.path.join(bindir, '*.Lscr')))}


if __name__ == '__main__':
    scripts = load_scripts(sys.argv[1])
    wanted = [int(x) for x in sys.argv[2:]] or sorted(scripts)
    for m in wanted:
        if m in scripts:
            print(scripts[m].dump())
        else:
            print('== member %d: no script' % m)
