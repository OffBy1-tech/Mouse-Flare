using System;
using System.Numerics;
using System.Security.Cryptography;

namespace Mouseflare.Core
{
    /// <summary>
    /// Ed25519 signature VERIFICATION only (RFC 8032), implemented over
    /// System.Numerics.BigInteger with extended twisted-Edwards coordinates.
    ///
    /// Vendored because the .NET 8 BCL has no Ed25519. Verification handles
    /// only public data, so BigInteger's variable-time arithmetic is not a
    /// side-channel concern — this must never be extended to signing.
    /// </summary>
    public static class Ed25519
    {
        private static readonly BigInteger P = BigInteger.Pow(2, 255) - 19;
        private static readonly BigInteger L =
            BigInteger.Pow(2, 252) + BigInteger.Parse("27742317777372353535851937790883648493");
        private static readonly BigInteger D; // -121665/121666 mod p
        private static readonly BigInteger SqrtM1; // sqrt(-1) mod p
        private static readonly Point BasePoint;

        private readonly struct Point
        {
            public readonly BigInteger X, Y, Z, T;
            public Point(BigInteger x, BigInteger y, BigInteger z, BigInteger t)
            {
                X = x; Y = y; Z = z; T = t;
            }
        }

        static Ed25519()
        {
            D = Mod(-121665 * ModInverse(121666));
            SqrtM1 = BigInteger.ModPow(2, (P - 1) / 4, P);

            // Base point: y = 4/5, x recovered with even sign
            var by = Mod(4 * ModInverse(5));
            var bx = RecoverX(by, sign: 0)
                     ?? throw new InvalidOperationException("ed25519 base point recovery failed");
            BasePoint = new Point(bx, by, 1, Mod(bx * by));
        }

        /// <summary>Verifies a 64-byte signature by a 32-byte public key over message.</summary>
        public static bool Verify(byte[] signature, byte[] message, byte[] publicKey)
        {
            if (signature.Length != 64 || publicKey.Length != 32) return false;

            var rBytes = new byte[32];
            var sBytes = new byte[32];
            Array.Copy(signature, 0, rBytes, 0, 32);
            Array.Copy(signature, 32, sBytes, 0, 32);

            var s = FromLittleEndian(sBytes);
            if (s >= L) return false; // reject non-canonical scalars (malleability)

            Point r, a;
            try
            {
                r = Decompress(rBytes);
                a = Decompress(publicKey);
            }
            catch (ArgumentException)
            {
                return false;
            }

            // h = SHA-512(R || A || M) mod L
            byte[] hInput = new byte[64 + message.Length];
            Array.Copy(rBytes, 0, hInput, 0, 32);
            Array.Copy(publicKey, 0, hInput, 32, 32);
            Array.Copy(message, 0, hInput, 64, message.Length);
            var h = Mod(FromLittleEndian(SHA512.HashData(hInput)), L);

            // Check [S]B == R + [h]A
            var left = ScalarMult(s, BasePoint);
            var right = Add(r, ScalarMult(h, a));
            return PointsEqual(left, right);
        }

        // ---- curve arithmetic (extended coordinates, a = -1) ----

        private static Point Add(Point p1, Point p2)
        {
            // add-2008-hwcd-3
            var a = Mod((p1.Y - p1.X) * (p2.Y - p2.X));
            var b = Mod((p1.Y + p1.X) * (p2.Y + p2.X));
            var c = Mod(p1.T * 2 * D % P * p2.T);
            var dd = Mod(p1.Z * 2 * p2.Z);
            var e = Mod(b - a);
            var f = Mod(dd - c);
            var g = Mod(dd + c);
            var hh = Mod(b + a);
            return new Point(Mod(e * f), Mod(g * hh), Mod(f * g), Mod(e * hh));
        }

        private static Point Double(Point p1)
        {
            // dbl-2008-hwcd
            var a = Mod(p1.X * p1.X);
            var b = Mod(p1.Y * p1.Y);
            var c = Mod(2 * p1.Z * p1.Z);
            var hh = Mod(a + b);
            var xy = Mod(p1.X + p1.Y);
            var e = Mod(hh - xy * xy);
            var g = Mod(a - b);
            var f = Mod(c + g);
            return new Point(Mod(e * f), Mod(g * hh), Mod(f * g), Mod(e * hh));
        }

        private static Point ScalarMult(BigInteger scalar, Point point)
        {
            var result = new Point(0, 1, 1, 0); // identity
            var acc = point;
            var k = scalar;
            while (k > 0)
            {
                if (!k.IsEven) result = Add(result, acc);
                acc = Double(acc);
                k >>= 1;
            }
            return result;
        }

        private static bool PointsEqual(Point p1, Point p2)
        {
            // Compare projectively: X1/Z1 == X2/Z2 and Y1/Z1 == Y2/Z2
            return Mod(p1.X * p2.Z - p2.X * p1.Z) == 0
                && Mod(p1.Y * p2.Z - p2.Y * p1.Z) == 0;
        }

        private static Point Decompress(byte[] encoded)
        {
            var yBytes = (byte[])encoded.Clone();
            int sign = (yBytes[31] & 0x80) >> 7;
            yBytes[31] &= 0x7f;
            var y = FromLittleEndian(yBytes);
            if (y >= P) throw new ArgumentException("non-canonical y");
            var x = RecoverX(y, sign) ?? throw new ArgumentException("not on curve");
            return new Point(x, y, 1, Mod(x * y));
        }

        private static BigInteger? RecoverX(BigInteger y, int sign)
        {
            // x^2 = (y^2 - 1) / (d*y^2 + 1)
            var y2 = Mod(y * y);
            var x2 = Mod((y2 - 1) * ModInverse(Mod(D * y2 + 1)));
            if (x2 == 0)
            {
                return sign == 0 ? BigInteger.Zero : null;
            }
            var x = BigInteger.ModPow(x2, (P + 3) / 8, P);
            if (Mod(x * x - x2) != 0) x = Mod(x * SqrtM1);
            if (Mod(x * x - x2) != 0) return null;
            if ((x.IsEven ? 0 : 1) != sign) x = Mod(-x);
            return x;
        }

        // ---- helpers ----

        private static BigInteger Mod(BigInteger value) => Mod(value, P);

        private static BigInteger Mod(BigInteger value, BigInteger modulus)
        {
            var r = value % modulus;
            return r < 0 ? r + modulus : r;
        }

        private static BigInteger ModInverse(BigInteger value) => BigInteger.ModPow(Mod(value), P - 2, P);

        private static BigInteger FromLittleEndian(byte[] bytes) =>
            new BigInteger(bytes, isUnsigned: true, isBigEndian: false);
    }
}
