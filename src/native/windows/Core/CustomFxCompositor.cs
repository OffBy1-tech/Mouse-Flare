using System;
using System.Collections.Generic;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace Mouseflare.Core
{
    /// <summary>
    /// Software pixel compositor for the custom-FX engine (issue #1).
    ///
    /// WPF's DrawingContext has no canvas-style blend modes or shadow blur, so
    /// designs using blendMode "lighter" / "screen" / "color-dodge" or
    /// glowBloom cannot be rendered with retained-mode drawing. This class
    /// reproduces the web renderer's semantics (customFxRenderer.ts):
    /// particles are rasterized once into cached sprites using the SAME vector
    /// shape code as the plain path, then composited per-pixel into a
    /// premultiplied-BGRA back buffer with the config's blend operator, and the
    /// buffer is handed to WPF as one Pbgra32 WriteableBitmap per frame.
    ///
    /// Alpha representation: premultiplied throughout. RenderTargetBitmap
    /// yields Pbgra32 sprites, the back buffer is premultiplied, and the
    /// WriteableBitmap is Pbgra32, so the final hand-off to WPF (which
    /// source-over-composites the bitmap onto the transparent overlay) is
    /// exact. Blending starts from a transparent buffer, matching the web
    /// canvas, where all four modes degenerate to plain painting against
    /// emptiness and differ only where particles overlap.
    ///
    /// Sprite color: sprites are COLORLESS. Color-cycling designs (rainbow
    /// modes) would otherwise defeat the cache — one rasterization per hue per
    /// frame melted GDI resources in the field (MILERR_WIN32ERROR out of
    /// RenderTargetBitmap after a long UI hang). Sprites are rasterized once
    /// in a marker color (pure red): the shape code draws its tintable parts
    /// in the particle color (→ the sprite's R channel) and its hard-coded
    /// white parts (glow-disc core, plasma-orb core, bubble fill/glint) in
    /// white (→ R == G == B). At stamp time each pixel is recomposed as
    /// tint * (R - G) + white * G, which reproduces the original rendering
    /// exactly (source-over inside the rasterizer preserves the decomposition)
    /// with no color quantization at all.
    /// </summary>
    internal sealed class CustomFxCompositor
    {
        // ---- Sprite cache -------------------------------------------------

        private sealed class Sprite
        {
            public int W, H;
            public byte[] Px = Array.Empty<byte>(); // premultiplied BGRA, marker-colored, full alpha
        }

        // Key: shape(4b) | quantized size(9b) | glow flag(1b) | quantized glow radius(9b).
        // Color deliberately excluded — see the class comment.
        private readonly Dictionary<long, Sprite> _cache = new();
        private const int MaxCacheEntries = 512;

        // Sprites are rasterized in this marker color; see class comment.
        private static readonly Color MarkerTint = Color.FromRgb(255, 0, 0);

        // Rasterization is the expensive, GDI-touching operation: bound it.
        private const int MaxSpriteSide = 384;        // device px, hard cap per sprite
        private const int RasterBudgetPerFrame = 6;   // new sprites per frame
        private const int TombstoneRetryFrames = 120; // ~2s before retrying a failed sprite
        private const int MaxSpriteFailures = 5;      // then disable the compositor
        private const double MaxGlowBlur = 20.0;      // logical pt; matches macOS/web

        private static readonly Sprite Tombstone = new();
        private readonly Dictionary<long, int> _tombstoneFrame = new();
        private int _frame;
        private int _rasterizedThisFrame;
        private int _spriteFailures;

        private static readonly string[] ShapeNames =
        {
            "circle", "glow-disc", "sparkle-star", "ring", "shard-crystal",
            "plasma-orb", "smoke-puff", "lightning-bolt", "bubble",
            "sakura-petal", "heart", "rune", "diamond",
        };

        private static int ShapeIndex(string shape)
        {
            for (int i = 0; i < ShapeNames.Length; i++)
            {
                if (ShapeNames[i] == shape) return i;
            }
            return 0; // circle
        }

        // Shapes whose rendering is rotationally symmetric can skip the
        // inverse-rotation sampling and take the fast axis-aligned blit.
        private static bool RotationInvariant(string shape) =>
            shape is "circle" or "glow-disc" or "ring" or "smoke-puff";

        private static long Key(int shapeIdx, int sizeQ, bool glow, int glowQ)
        {
            long key = shapeIdx & 0xF;
            key |= (long)(sizeQ & 0x1FF) << 4;
            if (glow) key |= 1L << 13;
            key |= (long)(glowQ & 0x1FF) << 14;
            return key;
        }

        /// <summary>1px buckets below 32 device px, 4px buckets above — keeps
        /// small particles smooth while bounding cache cardinality.</summary>
        private static int QuantizeSize(int v) =>
            v < 32 ? v : Math.Min(MaxSpriteSide, (v + 2) & ~3);

        // ---- Frame state --------------------------------------------------

        private struct Stamp
        {
            public Sprite Core;
            public Sprite? Glow;
            public double X, Y;       // device px, window-relative
            public double Rotation;   // radians
            public byte AlphaFactor;  // particle alpha 0..255
            public Color Tint;        // exact particle color, applied at blit time
            public bool Rotate;       // false => axis-aligned blit
        }

        private readonly List<Stamp> _stamps = new();
        private double _minX, _minY, _maxX, _maxY;

        // Back buffer: grow-only capacity, anchored each frame at the particle
        // cloud's AABB origin so memory stays proportional to the cloud, not
        // the (potentially multi-monitor) virtual screen.
        private byte[] _buf = Array.Empty<byte>();
        private int _capW, _capH;
        private int _prevUsedW, _prevUsedH;
        private WriteableBitmap? _bitmap;
        private const int MaxDim = 4096;

        /// <summary>True when this config needs per-pixel compositing.</summary>
        public static bool Needed(CustomFxConfig config) =>
            config.blendMode is "lighter" or "screen" or "color-dodge"
            || (config.glowBloom && config.glowRadius > 0);

        public void BeginFrame()
        {
            _frame++;
            _rasterizedThisFrame = 0;
            _stamps.Clear();
            _minX = _minY = double.MaxValue;
            _maxX = _maxY = double.MinValue;
        }

        public void Clear()
        {
            _stamps.Clear();
            // Force a full clear on the next Present — the buffer may hold
            // pixels from the previous config that would otherwise survive
            // outside the next frame's smaller used region.
            _prevUsedW = _capW;
            _prevUsedH = _capH;
        }

        /// <summary>Queues one particle. Coordinates/size in DIPs; converted to device px here.</summary>
        public void AddParticle(double x, double y, double size, double alpha, double rotation,
                                Color color, CustomFxConfig config, double dpiScale)
        {
            // Imported configs are unvalidated JSON and physics can run away
            // (e.g. drag > 1 grows positions without bound): refuse non-finite
            // or absurd inputs rather than letting them poison the frame AABB
            // and flow into int casts.
            if (!double.IsFinite(x) || !double.IsFinite(y) || Math.Abs(x) > 1e7 || Math.Abs(y) > 1e7) return;
            if (!double.IsFinite(size) || !double.IsFinite(alpha) || !double.IsFinite(rotation)) return;
            if (!double.IsFinite(dpiScale) || dpiScale <= 0) return;
            size = Math.Clamp(size, 0.2, 300);

            int sizeDev = Math.Clamp((int)Math.Round(size * dpiScale), 1, 200);
            int sizeQ = QuantizeSize(sizeDev);
            int shapeIdx = ShapeIndex(config.shape);

            // A null sprite means the per-frame rasterization budget is spent
            // or the sprite recently failed to rasterize: skip the particle
            // this frame — it will be cached (or retried) within a few frames.
            var core = GetSprite(Key(shapeIdx, sizeQ, glow: false, 0),
                () => RasterizeCore(config.shape, sizeQ));
            if (core == null) return;

            Sprite? glow = null;
            if (config.glowBloom && config.glowRadius > 0)
            {
                // Canvas: shadowBlur = glowRadius * (size / 6); the glow sprite
                // approximates the blurred silhouette with a radial falloff
                // reaching shape extent + 1.5 * blur. glowRadius comes straight
                // from user JSON — clamp before it sizes a sprite. Cap the
                // result at MaxGlowBlur logical points before scaling for DPI:
                // presets whose particles grow large otherwise ask for a blur
                // several times any other preset's, at no visible benefit.
                double blur = Math.Min(MaxGlowBlur,
                    Math.Clamp(config.glowRadius, 0.0, 100.0) * (size / 6.0)) * dpiScale;
                int glowRadius = Math.Clamp((int)Math.Round(sizeDev * 1.2 + blur * 1.5), 2, 400);
                int glowQ = QuantizeSize(glowRadius);
                glow = GetSprite(Key(shapeIdx, 0, glow: true, glowQ),
                    () => RasterizeGlow(glowQ));
                if (glow == null) return;
            }

            double dx = x * dpiScale, dy = y * dpiScale;
            double half = Math.Max(core.W, glow?.W ?? 0) / 2.0;
            // Rotated stamps sample within the sprite's own bounds, so the
            // sprite half-diagonal bounds the footprint either way.
            half = half * 1.4143 + 2;

            _minX = Math.Min(_minX, dx - half);
            _minY = Math.Min(_minY, dy - half);
            _maxX = Math.Max(_maxX, dx + half);
            _maxY = Math.Max(_maxY, dy + half);

            _stamps.Add(new Stamp
            {
                Core = core,
                Glow = glow,
                X = dx,
                Y = dy,
                Rotation = rotation,
                AlphaFactor = (byte)Math.Clamp((int)Math.Round(alpha * 255), 0, 255),
                Tint = color,
                Rotate = rotation != 0 && !RotationInvariant(config.shape),
            });
        }

        /// <summary>Composites all queued stamps and draws the result into the frame.</summary>
        public void Present(DrawingContext dc, CustomFxConfig config, double dpiScale)
        {
            if (_stamps.Count == 0) return;

            // AddParticle rejects non-finite/absurd inputs, so the AABB should
            // always be sane — but a skipped frame beats undefined int casts if
            // that invariant ever breaks. Clamp in double space first.
            if (!double.IsFinite(_minX) || !double.IsFinite(_minY) ||
                !double.IsFinite(_maxX) || !double.IsFinite(_maxY) ||
                _maxX <= _minX || _maxY <= _minY ||
                !double.IsFinite(dpiScale) || dpiScale <= 0)
            {
                _stamps.Clear();
                return;
            }

            int anchorX = (int)Math.Floor(_minX);
            int anchorY = (int)Math.Floor(_minY);
            int usedW = (int)Math.Clamp(Math.Ceiling(_maxX) - anchorX, 1, MaxDim);
            int usedH = (int)Math.Clamp(Math.Ceiling(_maxY) - anchorY, 1, MaxDim);

            EnsureCapacity(usedW, usedH);

            // Clear the union of last frame's and this frame's used regions so
            // no stale pixels survive in the area the bitmap will present.
            int clearW = Math.Min(_capW, Math.Max(_prevUsedW, usedW));
            int clearH = Math.Min(_capH, Math.Max(_prevUsedH, usedH));
            int stride = _capW * 4;
            for (int row = 0; row < clearH; row++)
            {
                Array.Clear(_buf, row * stride, clearW * 4);
            }

            int blend = config.blendMode switch
            {
                "lighter" => 1,
                "screen" => 2,
                "color-dodge" => 3,
                _ => 0,
            };

            foreach (var stamp in _stamps)
            {
                double sx = stamp.X - anchorX, sy = stamp.Y - anchorY;
                if (stamp.Glow != null)
                {
                    BlitAxisAligned(stamp.Glow, sx, sy, stamp.AlphaFactor, blend, stamp.Tint, usedW, usedH);
                }
                if (stamp.Rotate)
                {
                    BlitRotated(stamp.Core, sx, sy, stamp.Rotation, stamp.AlphaFactor, blend, stamp.Tint, usedW, usedH);
                }
                else
                {
                    BlitAxisAligned(stamp.Core, sx, sy, stamp.AlphaFactor, blend, stamp.Tint, usedW, usedH);
                }
            }

            _bitmap!.WritePixels(new Int32Rect(0, 0, clearW, clearH), _buf, stride, 0);
            _prevUsedW = usedW;
            _prevUsedH = usedH;

            dc.DrawImage(_bitmap, new Rect(
                anchorX / dpiScale, anchorY / dpiScale,
                _capW / dpiScale, _capH / dpiScale));
        }

        private void EnsureCapacity(int w, int h)
        {
            if (w <= _capW && h <= _capH && _bitmap != null) return;
            _capW = Math.Min(MaxDim, Math.Max(_capW, (w + 255) & ~255));
            _capH = Math.Min(MaxDim, Math.Max(_capH, (h + 255) & ~255));
            _buf = new byte[_capW * _capH * 4];
            _bitmap = new WriteableBitmap(_capW, _capH, 96, 96, PixelFormats.Pbgra32, null);
            _prevUsedW = _capW; // force a full clear on the next Present
            _prevUsedH = _capH;
        }

        // ---- Rasterization (sprites reuse the vector shape code) ----------

        /// <summary>
        /// Cache lookup with bounded rasterization. Returns null when the
        /// per-frame budget is spent or the sprite is tombstoned after a
        /// recent failure — callers skip that particle for the frame. After
        /// MaxSpriteFailures the compositor gives up: the exception propagates
        /// to the engine's guard, which falls back to plain rendering for the
        /// session and records the fault in the crash log.
        /// </summary>
        private Sprite? GetSprite(long key, Func<Sprite> create)
        {
            if (_cache.TryGetValue(key, out var sprite))
            {
                if (!ReferenceEquals(sprite, Tombstone)) return sprite;
                if (_frame - _tombstoneFrame.GetValueOrDefault(key) < TombstoneRetryFrames) return null;
                _cache.Remove(key);
                _tombstoneFrame.Remove(key);
            }

            if (_rasterizedThisFrame >= RasterBudgetPerFrame) return null;
            if (_cache.Count >= MaxCacheEntries)
            {
                _cache.Clear();
                _tombstoneFrame.Clear();
            }

            _rasterizedThisFrame++;
            try
            {
                sprite = create();
            }
            catch (Exception ex)
            {
                _spriteFailures++;
                _cache[key] = Tombstone;
                _tombstoneFrame[key] = _frame;
                if (_spriteFailures == 1)
                {
                    CrashLog.Write("CustomFxCompositor sprite rasterization failed (particle skipped, will retry)", ex);
                }
                if (_spriteFailures >= MaxSpriteFailures)
                {
                    throw new InvalidOperationException(
                        $"Sprite rasterization failed {_spriteFailures} times; disabling the compositor.", ex);
                }
                return null;
            }
            _cache[key] = sprite;
            return sprite;
        }

        private static Sprite RasterizeCore(string shape, int sizeDevPx)
        {
            int side = Math.Max(4, (int)Math.Ceiling(sizeDevPx * 1.6 * 2) + 4);
            double drawSize = sizeDevPx;
            if (side > MaxSpriteSide)
            {
                // Extreme size × DPI: render a proportionally smaller sprite
                // rather than asking the GDI layer for a giant allocation.
                drawSize = sizeDevPx * (MaxSpriteSide / (double)side);
                side = MaxSpriteSide;
            }
            var visual = new DrawingVisual();
            using (var dc = visual.RenderOpen())
            {
                dc.PushTransform(new TranslateTransform(side / 2.0, side / 2.0));
                CustomFxEngine.DrawShapeGeometry(dc, shape, drawSize, MarkerTint, 255);
                dc.Pop();
            }
            return Render(visual, side);
        }

        private static Sprite RasterizeGlow(int radiusDevPx)
        {
            int radius = Math.Min(radiusDevPx, (MaxSpriteSide - 2) / 2);
            int side = radius * 2 + 2;
            var visual = new DrawingVisual();
            using (var dc = visual.RenderOpen())
            {
                // Gaussian-ish falloff approximating canvas shadowBlur of the
                // particle silhouette.
                var c = MarkerTint;
                var gradient = new RadialGradientBrush();
                gradient.GradientStops.Add(new GradientStop(Color.FromArgb(217, c.R, c.G, c.B), 0));
                gradient.GradientStops.Add(new GradientStop(Color.FromArgb(115, c.R, c.G, c.B), 0.35));
                gradient.GradientStops.Add(new GradientStop(Color.FromArgb(38, c.R, c.G, c.B), 0.7));
                gradient.GradientStops.Add(new GradientStop(Color.FromArgb(0, c.R, c.G, c.B), 1));
                gradient.Freeze();
                dc.DrawEllipse(gradient, null, new Point(side / 2.0, side / 2.0), radius, radius);
            }
            return Render(visual, side);
        }

        private static Sprite Render(DrawingVisual visual, int side)
        {
            var target = new RenderTargetBitmap(side, side, 96, 96, PixelFormats.Pbgra32);
            target.Render(visual);
            var px = new byte[side * side * 4];
            target.CopyPixels(px, side * 4, 0);
            return new Sprite { W = side, H = side, Px = px };
        }

        // ---- Per-pixel blitting -------------------------------------------
        //
        // All pixels are premultiplied BGRA. `alphaFactor` scales the sprite
        // (globalAlpha in the web renderer): premultiplied scaling is a plain
        // multiply of all four channels. Tinting happens first — see the
        // class comment for the marker-color decomposition.
        //
        // Blend operators (verified against W3C compositing-1 in premultiplied
        // form; s = premultiplied source, d = premultiplied destination):
        //   over (source-over):  d' = s + d * (1 - sa)
        //   lighter (PD "plus"): d' = min(1, s + d)             (all channels)
        //   screen:              d' = s + d - s * d              (all channels;
        //       derives exactly from Co = cs(1-ab) + cb(1-as) + as*ab*B(Cb,Cs)
        //       with B = Cb + Cs - Cb*Cs)
        //   color-dodge: no premultiplied shortcut; computed un-premultiplied
        //       with B(Cb,Cs) = Cb==0 ? 0 : Cs>=1 ? 1 : min(1, Cb/(1-Cs)),
        //       ao = as + ab - as*ab.

        private unsafe void BlitAxisAligned(Sprite sprite, double cx, double cy,
                                            byte alphaFactor, int blend, Color tint, int usedW, int usedH)
        {
            if (alphaFactor == 0) return;
            int left = (int)Math.Round(cx - sprite.W / 2.0);
            int top = (int)Math.Round(cy - sprite.H / 2.0);
            int x0 = Math.Max(0, left), y0 = Math.Max(0, top);
            int x1 = Math.Min(usedW, left + sprite.W), y1 = Math.Min(usedH, top + sprite.H);
            if (x0 >= x1 || y0 >= y1) return;

            int stride = _capW * 4, srcStride = sprite.W * 4;
            byte tr = tint.R, tg = tint.G, tb = tint.B;
            fixed (byte* bufPtr = _buf, srcPtr = sprite.Px)
            {
                for (int y = y0; y < y1; y++)
                {
                    byte* dst = bufPtr + y * stride + x0 * 4;
                    byte* src = srcPtr + (y - top) * srcStride + (x0 - left) * 4;
                    for (int x = x0; x < x1; x++, dst += 4, src += 4)
                    {
                        BlendPixel(dst, src, alphaFactor, blend, tr, tg, tb);
                    }
                }
            }
        }

        private unsafe void BlitRotated(Sprite sprite, double cx, double cy, double rotation,
                                        byte alphaFactor, int blend, Color tint, int usedW, int usedH)
        {
            if (alphaFactor == 0) return;
            double halfDiag = Math.Sqrt(sprite.W * sprite.W + sprite.H * sprite.H) / 2 + 1;
            int x0 = Math.Max(0, (int)(cx - halfDiag)), y0 = Math.Max(0, (int)(cy - halfDiag));
            int x1 = Math.Min(usedW, (int)Math.Ceiling(cx + halfDiag)), y1 = Math.Min(usedH, (int)Math.Ceiling(cy + halfDiag));
            if (x0 >= x1 || y0 >= y1) return;

            double cos = Math.Cos(-rotation), sin = Math.Sin(-rotation);
            double halfW = sprite.W / 2.0, halfH = sprite.H / 2.0;
            int stride = _capW * 4, srcStride = sprite.W * 4;
            byte tr = tint.R, tg = tint.G, tb = tint.B;

            fixed (byte* bufPtr = _buf, srcPtr = sprite.Px)
            {
                for (int y = y0; y < y1; y++)
                {
                    byte* dst = bufPtr + y * stride + x0 * 4;
                    double relY = y + 0.5 - cy;
                    for (int x = x0; x < x1; x++, dst += 4)
                    {
                        double relX = x + 0.5 - cx;
                        // Inverse-rotate the destination pixel into sprite space
                        // (nearest-neighbor; sprites are small and the glow pass
                        // is soft, so NN artifacts are invisible at cursor scale).
                        int sx = (int)(relX * cos - relY * sin + halfW);
                        int sy = (int)(relX * sin + relY * cos + halfH);
                        if ((uint)sx >= (uint)sprite.W || (uint)sy >= (uint)sprite.H) continue;
                        BlendPixel(dst, srcPtr + sy * srcStride + sx * 4, alphaFactor, blend, tr, tg, tb);
                    }
                }
            }
        }

        private static unsafe void BlendPixel(byte* dst, byte* srcPx, byte alphaFactor, int blend,
                                              byte tr, byte tg, byte tb)
        {
            int spriteA = srcPx[3];
            if (spriteA == 0) return;

            // Tint: sprites are marker-colored (see class comment). The
            // tintable component is R - G, the hard-coded-white component is G
            // (== B); recompose with the exact particle color. All values are
            // premultiplied, and tintable + white <= R <= A keeps the result
            // premultiplied-valid.
            int white = srcPx[1];
            int tintable = srcPx[2] - white;
            if (tintable < 0) tintable = 0;
            int b0 = (tintable * tb + 127) / 255 + white;
            int g0 = (tintable * tg + 127) / 255 + white;
            int r0 = (tintable * tr + 127) / 255 + white;

            // Scale the premultiplied source by the particle alpha.
            int sb = (b0 * alphaFactor + 127) / 255;
            int sg = (g0 * alphaFactor + 127) / 255;
            int sr = (r0 * alphaFactor + 127) / 255;
            int sa = (spriteA * alphaFactor + 127) / 255;
            if (sa == 0 && sr == 0 && sg == 0 && sb == 0) return;

            switch (blend)
            {
                case 1: // lighter — Porter-Duff "plus" with clamp
                    dst[0] = (byte)Math.Min(255, dst[0] + sb);
                    dst[1] = (byte)Math.Min(255, dst[1] + sg);
                    dst[2] = (byte)Math.Min(255, dst[2] + sr);
                    dst[3] = (byte)Math.Min(255, dst[3] + sa);
                    break;

                case 2: // screen — s + d - s*d, exact in premultiplied space
                    dst[0] = (byte)(sb + dst[0] - (sb * dst[0] + 127) / 255);
                    dst[1] = (byte)(sg + dst[1] - (sg * dst[1] + 127) / 255);
                    dst[2] = (byte)(sr + dst[2] - (sr * dst[2] + 127) / 255);
                    dst[3] = (byte)(sa + dst[3] - (sa * dst[3] + 127) / 255);
                    break;

                case 3: // color-dodge — un-premultiplied W3C blend, then recompose
                {
                    double asA = sa / 255.0, abA = dst[3] / 255.0;
                    double ao = asA + abA - asA * abA;
                    if (ao <= 0) { dst[0] = dst[1] = dst[2] = dst[3] = 0; break; }
                    dst[0] = DodgeChannel(sb, sa, dst[0], dst[3], asA, abA);
                    dst[1] = DodgeChannel(sg, sa, dst[1], dst[3], asA, abA);
                    dst[2] = DodgeChannel(sr, sa, dst[2], dst[3], asA, abA);
                    dst[3] = (byte)Math.Clamp((int)Math.Round(ao * 255), 0, 255);
                    break;
                }

                default: // source-over
                {
                    int inv = 255 - sa;
                    dst[0] = (byte)Math.Min(255, sb + (dst[0] * inv + 127) / 255);
                    dst[1] = (byte)Math.Min(255, sg + (dst[1] * inv + 127) / 255);
                    dst[2] = (byte)Math.Min(255, sr + (dst[2] * inv + 127) / 255);
                    dst[3] = (byte)Math.Min(255, sa + (dst[3] * inv + 127) / 255);
                    break;
                }
            }
        }

        private static byte DodgeChannel(int sPremul, int saByte, int dPremul, int daByte, double asA, double abA)
        {
            double cs = saByte == 0 ? 0 : Math.Min(1.0, sPremul / (double)saByte);
            double cb = daByte == 0 ? 0 : Math.Min(1.0, dPremul / (double)daByte);
            double b = cb <= 0 ? 0 : cs >= 1 ? 1 : Math.Min(1.0, cb / (1 - cs));
            double co = cs * asA * (1 - abA) + cb * abA * (1 - asA) + asA * abA * b;
            return (byte)Math.Clamp((int)Math.Round(co * 255), 0, 255);
        }
    }
}
