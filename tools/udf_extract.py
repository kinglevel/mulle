#!/usr/bin/env python3
"""Extract every file from a UDF disc image, including write-once discs that
address their metadata through a Virtual Allocation Table.

The English release (Gary Gadget: Building Cars, 2006) is a burned CD-R:
UDF only, no ISO 9660 volume, and a virtual partition, which pycdlib (and
p7zip) can't read. This reads just enough of ECMA-167 / OSTA UDF to walk the
directory tree:

    AVDP @ sector 256 -> volume descriptors -> partition start, partition maps,
    file set descriptor -> root directory ICB -> file entries + FIDs

A virtual partition's block n lives at physical block VAT[n]; the VAT is the
file whose entry is the last recorded sector on the disc.

    udf_extract.py image.iso out_dir
"""

import os
import struct
import sys

SECTOR = 2048

TAG_PD, TAG_LVD, TAG_TD = 5, 6, 8
TAG_FSD, TAG_FID, TAG_FE, TAG_EFE = 256, 257, 261, 266


class UDF:
    def __init__(self, path):
        self.f = open(path, 'rb')
        self.f.seek(0, 2)
        self.sectors = self.f.tell() // SECTOR
        self.vat = None
        self._read_volume()

    def sector(self, n, count=1):
        self.f.seek(n * SECTOR)
        return self.f.read(count * SECTOR)

    @staticmethod
    def tag_id(data):
        return struct.unpack('<H', data[:2])[0]

    def _read_volume(self):
        avdp = self.sector(256)
        if self.tag_id(avdp) != 2:
            raise ValueError('no UDF anchor at sector 256')
        length, loc = struct.unpack('<II', avdp[16:24])
        self.partition_start = None
        self.maps = []
        for i in range(length // SECTOR):
            d = self.sector(loc + i)
            tid = self.tag_id(d)
            if tid == TAG_PD:
                self.partition_start = struct.unpack('<I', d[188:192])[0]
            elif tid == TAG_LVD:
                map_len, n_maps = struct.unpack('<II', d[264:272])
                self.fsd_ad = d[248:264]
                maps = d[440:440 + map_len]
                pos = 0
                for _ in range(n_maps):
                    mtype, mlen = maps[pos], maps[pos + 1]
                    ident = maps[pos + 5:pos + 28] if mtype == 2 else b''
                    self.maps.append('virtual' if b'Virtual' in ident else 'physical' if mtype == 1 else ident)
                    pos += mlen
            elif tid == TAG_TD:
                break
        if self.partition_start is None:
            raise ValueError('no partition descriptor')
        for kind in self.maps:
            if kind not in ('physical', 'virtual'):
                raise ValueError('unsupported partition map %r' % kind)
        if 'virtual' in self.maps:
            self._read_vat()

    def _read_vat(self):
        # The VAT's file entry is the last recorded block, possibly followed
        # by a few run-out sectors; search back a little.
        for s in range(self.sectors - 1, max(self.sectors - 300, 0), -1):
            d = self.sector(s)
            if self.tag_id(d) not in (TAG_FE, TAG_EFE):
                continue
            data = self._file_data(d, partition=0)
            file_type = d[27]
            if file_type == 248:  # UDF 2.0 VAT: header, then entries
                header_len = struct.unpack('<H', data[:2])[0]
                table = data[header_len:]
            elif data[-36:-4].find(b'*UDF Virtual Alloc Tbl') >= 0:  # UDF 1.5: entries, regid, prev
                table = data[:-36]
            else:
                continue
            self.vat = struct.unpack('<%dI' % (len(table) // 4), table[:len(table) // 4 * 4])
            return
        raise ValueError('virtual partition without a VAT')

    def block(self, partition, lbn):
        if self.maps[partition] == 'virtual':
            lbn = self.vat[lbn]
        return self.partition_start + lbn

    def read_icb(self, partition, lbn):
        d = self.sector(self.block(partition, lbn))
        if self.tag_id(d) not in (TAG_FE, TAG_EFE):
            raise ValueError('expected a file entry at %d:%d' % (partition, lbn))
        return d

    def _file_data(self, entry, partition):
        tid = self.tag_id(entry)
        flags = struct.unpack('<H', entry[34:36])[0]
        size = struct.unpack('<Q', entry[56:64])[0]
        if tid == TAG_FE:
            l_ea, l_ad = struct.unpack('<II', entry[168:176])
            ad_start = 176 + l_ea
        else:
            l_ea, l_ad = struct.unpack('<II', entry[208:216])
            ad_start = 216 + l_ea
        ads = entry[ad_start:ad_start + l_ad]
        ad_type = flags & 7

        if ad_type == 3:  # data embedded in the entry
            return ads[:size]

        out = bytearray()
        pos = 0
        while pos < len(ads) and len(out) < size:
            if ad_type == 0:
                length, lbn = struct.unpack('<II', ads[pos:pos + 8])
                part = partition
                pos += 8
            elif ad_type == 1:
                length, lbn, part = struct.unpack('<IIH', ads[pos:pos + 10])
                pos += 16
            else:
                raise ValueError('unsupported allocation descriptor type %d' % ad_type)
            kind, length = length >> 30, length & 0x3FFFFFFF
            if length == 0:
                break
            count = (length + SECTOR - 1) // SECTOR
            if kind == 1:  # allocated but not recorded: zeros
                out += bytes(count * SECTOR)
            elif self.maps[part] == 'virtual':
                for i in range(count):
                    out += self.sector(self.block(part, lbn + i))
            else:
                out += self.sector(self.block(part, lbn), count)
            out = out[:len(out) - count * SECTOR + length]
        return bytes(out[:size])

    def read_file(self, partition, lbn):
        return self._file_data(self.read_icb(partition, lbn), partition)

    @staticmethod
    def _name(raw):
        if not raw:
            return ''
        if raw[0] == 8:
            return raw[1:].decode('latin-1')
        if raw[0] == 16:
            return raw[1:].decode('utf-16-be')
        raise ValueError('bad compressed unicode id %d' % raw[0])

    def listdir(self, partition, lbn):
        data = self.read_file(partition, lbn)
        pos = 0
        while pos + 38 <= len(data):
            if self.tag_id(data[pos:]) != TAG_FID:
                break
            chars = data[pos + 18]
            l_fi = data[pos + 19]
            _, icb_lbn, icb_part = struct.unpack('<IIH', data[pos + 20:pos + 30])
            l_iu = struct.unpack('<H', data[pos + 36:pos + 38])[0]
            name_at = pos + 38 + l_iu
            name = self._name(data[name_at:name_at + l_fi])
            pos += (38 + l_iu + l_fi + 3) & ~3
            if chars & 0x08 or chars & 0x04:  # parent, or deleted
                continue
            yield name, bool(chars & 0x02), icb_part, icb_lbn

    def root(self):
        _, lbn, part = struct.unpack('<IIH', self.fsd_ad[:10])
        fsd = self.sector(self.block(part, lbn))
        if self.tag_id(fsd) != TAG_FSD:
            raise ValueError('no file set descriptor')
        _, root_lbn, root_part = struct.unpack('<IIH', fsd[400:410])
        return root_part, root_lbn

    def extract(self, out_dir, partition=None, lbn=None):
        if partition is None:
            partition, lbn = self.root()
        os.makedirs(out_dir, exist_ok=True)
        for name, is_dir, part, icb in self.listdir(partition, lbn):
            target = os.path.join(out_dir, name)
            if is_dir:
                self.extract(target, part, icb)
            else:
                with open(target, 'wb') as f:
                    f.write(self.read_file(part, icb))


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    UDF(sys.argv[1]).extract(sys.argv[2])


if __name__ == '__main__':
    main()
