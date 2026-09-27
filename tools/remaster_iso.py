#!/usr/bin/env python3
"""Turn a UDF-only, Shockwave-compressed game disc into the plain ISO 9660
image with a /MOVIES folder of .DXR/.CXT files that upstream's build.py reads.

Only the English re-release needs this (see udf_extract.py and
unafterburn.py). Every Director file in the disc's Movies folder is carried
over under its classic name: 02.dcr -> 02.DXR, 00.cct -> 00.CXT, and an
uncompressed tempPlug.cst -> TEMPPLUG.CXT.

With --reference, member names that the Shockwave export stripped are
restored from the same movie on another release (the Swedish original shares
the English numbering); mulle.js finds sounds by name.

Needs pycdlib and ShockwaveParser (the mulle.js venv has both).

    remaster_iso.py [--reference sv.iso] in.iso out.iso
"""

import contextlib
import io
import os
import sys
import tempfile

import pycdlib
from shockwaveparser import ShockwaveParser

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from udf_extract import UDF  # noqa: E402
import unafterburn  # noqa: E402

# The re-release renamed a movie; build.py wants the original name.
RENAMES = {'LBSTARTVIVA': 'LBSTART'}

EXTENSIONS = {'.dcr': '.DXR', '.dxr': '.DXR', '.dir': '.DXR',
              '.cct': '.CXT', '.cxt': '.CXT', '.cst': '.CXT'}


def find_movies(root):
    for folder, dirs, _ in os.walk(root):
        for d in dirs:
            if d.lower() == 'movies':
                return os.path.join(folder, d)
    raise SystemExit('no Movies folder on the disc')


def reference_names(iso, name, tmp):
    """{member number: (type, name)} for /MOVIES/<name> on a reference ISO."""
    path = os.path.join(tmp, 'reference-' + name)
    try:
        iso.get_file_from_iso(path, iso_path='/MOVIES/' + name)
    except pycdlib.pycdlibexception.PyCdlibInvalidInput:
        return None
    parser = ShockwaveParser.ShockwaveParser(path)
    with contextlib.redirect_stdout(io.StringIO()):
        parser.read()
    names = {}
    for library in parser.castLibraries:
        for num, member in library.get('members', {}).items():
            names[num] = (member.get('castType'), member.get('name'))
    return names


def main():
    args = sys.argv[1:]
    reference = None
    if args[:1] == ['--reference']:
        reference = pycdlib.PyCdlib()
        reference.open(args[1])
        args = args[2:]
    if len(args) != 2:
        sys.exit(__doc__)
    src, dst = args

    iso = pycdlib.PyCdlib()
    iso.new(interchange_level=4, vol_ident='MULLE')
    iso.add_directory('/MOVIES')

    with tempfile.TemporaryDirectory() as tmp:
        UDF(src).extract(tmp)
        movies = find_movies(tmp)
        for name in sorted(os.listdir(movies)):
            stem, ext = os.path.splitext(name)
            if ext.lower() not in EXTENSIONS:
                continue
            with open(os.path.join(movies, name), 'rb') as f:
                data = f.read()
            out_name = RENAMES.get(stem.upper(), stem.upper()) + EXTENSIONS[ext.lower()]
            if data[8:12] in (b'FGDM', b'FGDC'):
                names = reference_names(reference, out_name, tmp) if reference else None
                buf = io.BytesIO()
                unafterburn.write_to(unafterburn.parse(data), buf, names)
                data = buf.getvalue()
            iso.add_fp(io.BytesIO(data), len(data), '/MOVIES/' + out_name)
            print('  %s -> MOVIES/%s' % (name, out_name))
        iso.write(dst)
    iso.close()


if __name__ == '__main__':
    main()
