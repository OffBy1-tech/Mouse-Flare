using System;

namespace Mouseflare.Core
{
    /// <summary>
    /// Minimal BLAKE2b-512 (RFC 7693), vendored because minisign signatures are
    /// made over the BLAKE2b-512 digest of the file and the .NET BCL has no
    /// BLAKE2. Unkeyed, fixed 64-byte output — exactly the minisign prehash case.
    /// (Mirrors the Swift implementation in src/native/macos/Sources/Blake2b.swift.)
    /// </summary>
    public static class Blake2b
    {
        private static readonly ulong[] Iv =
        {
            0x6a09e667f3bcc908UL, 0xbb67ae8584caa73bUL,
            0x3c6ef372fe94f82bUL, 0xa54ff53a5f1d36f1UL,
            0x510e527fade682d1UL, 0x9b05688c2b3e6c1fUL,
            0x1f83d9abfb41bd6bUL, 0x5be0cd19137e2179UL,
        };

        private static readonly int[][] Sigma =
        {
            new[] { 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15 },
            new[] { 14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3 },
            new[] { 11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4 },
            new[] { 7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8 },
            new[] { 9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13 },
            new[] { 2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9 },
            new[] { 12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11 },
            new[] { 13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10 },
            new[] { 6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5 },
            new[] { 10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0 },
            new[] { 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15 },
            new[] { 14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3 },
        };

        public static byte[] Hash512(byte[] message)
        {
            var h = (ulong[])Iv.Clone();
            h[0] ^= 0x0000000001010040UL; // unkeyed, 64-byte digest

            const int blockSize = 128;
            var buffer = new byte[blockSize];
            ulong offsetLow = 0;

            int remaining = message.Length;
            int cursor = 0;

            while (remaining > blockSize)
            {
                Array.Copy(message, cursor, buffer, 0, blockSize);
                offsetLow += blockSize;
                Compress(h, buffer, offsetLow, isFinal: false);
                cursor += blockSize;
                remaining -= blockSize;
            }

            Array.Clear(buffer, 0, blockSize);
            Array.Copy(message, cursor, buffer, 0, remaining);
            offsetLow += (ulong)remaining;
            Compress(h, buffer, offsetLow, isFinal: true);

            var output = new byte[64];
            for (int i = 0; i < 8; i++)
            {
                BitConverter.GetBytes(h[i]).CopyTo(output, i * 8); // little-endian on all supported platforms
            }
            return output;
        }

        private static void Compress(ulong[] h, byte[] block, ulong offsetLow, bool isFinal)
        {
            var m = new ulong[16];
            for (int i = 0; i < 16; i++)
            {
                m[i] = BitConverter.ToUInt64(block, i * 8);
            }

            var v = new ulong[16];
            Array.Copy(h, v, 8);
            Array.Copy(Iv, 0, v, 8, 8);
            v[12] ^= offsetLow;
            if (isFinal) v[14] = ~v[14];

            void G(int a, int b, int c, int d, ulong x, ulong y)
            {
                v[a] = v[a] + v[b] + x;
                v[d] = Rotr(v[d] ^ v[a], 32);
                v[c] = v[c] + v[d];
                v[b] = Rotr(v[b] ^ v[c], 24);
                v[a] = v[a] + v[b] + y;
                v[d] = Rotr(v[d] ^ v[a], 16);
                v[c] = v[c] + v[d];
                v[b] = Rotr(v[b] ^ v[c], 63);
            }

            for (int round = 0; round < 12; round++)
            {
                var s = Sigma[round];
                G(0, 4, 8, 12, m[s[0]], m[s[1]]);
                G(1, 5, 9, 13, m[s[2]], m[s[3]]);
                G(2, 6, 10, 14, m[s[4]], m[s[5]]);
                G(3, 7, 11, 15, m[s[6]], m[s[7]]);
                G(0, 5, 10, 15, m[s[8]], m[s[9]]);
                G(1, 6, 11, 12, m[s[10]], m[s[11]]);
                G(2, 7, 8, 13, m[s[12]], m[s[13]]);
                G(3, 4, 9, 14, m[s[14]], m[s[15]]);
            }

            for (int i = 0; i < 8; i++)
            {
                h[i] ^= v[i] ^ v[i + 8];
            }
        }

        private static ulong Rotr(ulong value, int bits) => (value >> bits) | (value << (64 - bits));
    }
}
