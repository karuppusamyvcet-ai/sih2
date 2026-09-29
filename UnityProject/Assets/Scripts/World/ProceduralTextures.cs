/* ==========================================================================
   ProceduralTextures.cs — every surface in the museum, generated at runtime.

   No texture files ship with the build: marble, sandstone, walnut, paper,
   fabric, the tie's repeating motif, leather and the emissive screen panels are
   all drawn into Texture2D objects here. Two consequences that matter for a
   submission build:
     · the repository carries no binary art, so every pixel is auditable
     · the Android build has no texture streaming surprises, because the same
       generator runs on the device
   Readable in-world text (door labels, captions, the timeline wall) is drawn by
   TextMeshPro objects, not by rasterising glyphs here.
   ========================================================================== */

using UnityEngine;

namespace Heritage.World
{
    public static class ProceduralTextures
    {
        static readonly int CacheSeed = 20260929;

        public static Texture2D Marble(Color baseColor, Color veinColor, int size = 512)
        {
            var tex = New(size);
            float scale = 4.5f;
            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    float u = x / (float)size * scale;
                    float v = y / (float)size * scale;
                    float turbulence = Fractal(u, v, 4) * 0.6f;
                    float vein = Mathf.Abs(Mathf.Sin((u + v * 0.7f + turbulence) * 2.4f));
                    vein = Mathf.Pow(1f - vein, 9f);
                    float grain = Mathf.PerlinNoise(u * 22f, v * 22f) * 0.05f;
                    var colour = Color.Lerp(baseColor, veinColor, vein * 0.85f);
                    colour = Shift(colour, grain - 0.025f);
                    tex.SetPixel(x, y, colour);
                }
            }
            return Finish(tex);
        }

        public static Texture2D Sandstone(Color baseColor, Color mortar, int blocks = 6, int size = 512)
        {
            var tex = New(size);
            float block = size / (float)blocks;
            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    int row = Mathf.FloorToInt(y / block);
                    float offset = (row % 2 == 0) ? 0f : block * 0.5f;
                    float bx = Mathf.Repeat(x + offset, block);
                    float by = Mathf.Repeat(y, block);
                    bool joint = bx < 3f || by < 3f;
                    float speck = Mathf.PerlinNoise(x * 0.16f, y * 0.16f);
                    float grit = Mathf.PerlinNoise(x * 0.7f, y * 0.7f);
                    var colour = joint ? mortar : Shift(baseColor, (speck - 0.5f) * 0.12f + (grit - 0.5f) * 0.07f);
                    tex.SetPixel(x, y, colour);
                }
            }
            return Finish(tex);
        }

        public static Texture2D Wood(Color baseColor, int size = 512)
        {
            var tex = New(size);
            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    float u = x / (float)size;
                    float v = y / (float)size;
                    float rings = Mathf.Sin((u * 26f) + Fractal(u * 3f, v * 3f, 3) * 6f);
                    float grain = Mathf.PerlinNoise(u * 90f, v * 6f) * 0.1f;
                    var colour = Shift(baseColor, rings * 0.06f + grain - 0.05f);
                    tex.SetPixel(x, y, colour);
                }
            }
            return Finish(tex);
        }

        public static Texture2D Paper(Color baseColor, int size = 256)
        {
            var tex = New(size);
            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    float fibre = Mathf.PerlinNoise(x * 0.5f, y * 0.5f) * 0.06f;
                    float fleck = Mathf.PerlinNoise(x * 3f, y * 3f) > 0.93f ? -0.07f : 0f;
                    tex.SetPixel(x, y, Shift(baseColor, fibre + fleck - 0.03f));
                }
            }
            return Finish(tex);
        }

        public static Texture2D Fabric(Color baseColor, float strength = 0.06f, int size = 256)
        {
            var tex = New(size);
            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    float weave = ((x % 3 == 0) ? 1f : 0f) + ((y % 3 == 0) ? 1f : 0f);
                    float noise = Mathf.PerlinNoise(x * 1.7f, y * 1.7f) - 0.5f;
                    tex.SetPixel(x, y, Shift(baseColor, (weave - 1f) * strength + noise * strength * 0.6f));
                }
            }
            return Finish(tex);
        }

        /// <summary>The character's signature red patterned tie.</summary>
        public static Texture2D TiePattern(Color baseColor, Color a, Color b, int size = 256, int scale = 18)
        {
            var tex = New(size);
            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    int cx = x / scale, cy = y / scale;
                    bool accentA = (cx + cy) % 4 == 0;
                    bool accentB = (cx - cy) % 7 == 0;
                    var colour = accentA ? Color.Lerp(baseColor, a, 0.75f)
                        : accentB ? Color.Lerp(baseColor, b, 0.6f)
                        : baseColor;
                    tex.SetPixel(x, y, Shift(colour, (Mathf.PerlinNoise(x * 2f, y * 2f) - 0.5f) * 0.05f));
                }
            }
            return Finish(tex);
        }

        public static Texture2D Leather(Color baseColor, int size = 256)
        {
            var tex = New(size);
            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    float cell = Mathf.PerlinNoise(x * 0.35f, y * 0.35f);
                    float pores = Mathf.PerlinNoise(x * 2.4f, y * 2.4f) > 0.86f ? -0.09f : 0f;
                    tex.SetPixel(x, y, Shift(baseColor, (cell - 0.5f) * 0.1f + pores));
                }
            }
            return Finish(tex);
        }

        /// <summary>An emissive panel for kiosks, screens and the media wall.</summary>
        public static Texture2D Screen(Color background, Color accent, int size = 256)
        {
            var tex = New(size);
            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    float scan = (y % 4 == 0) ? 0.06f : 0f;
                    float vignette = 1f - Mathf.Clamp01(Vector2.Distance(new Vector2(x, y), new Vector2(size / 2f, size / 2f)) / (size * 0.72f));
                    var colour = Color.Lerp(background * 0.6f, background, vignette) + accent * scan * 0.4f;
                    if (x < 6 || y < 6 || x > size - 7 || y > size - 7) colour = Color.Lerp(colour, accent, 0.5f);
                    tex.SetPixel(x, y, colour);
                }
            }
            return Finish(tex);
        }

        /// <summary>A generated illustration for quiz image questions and panels.</summary>
        public static Texture2D Illustration(int kind, int size = 256)
        {
            var tex = New(size);
            var background = new Color(0.09f, 0.14f, 0.24f);
            var accent = new Color(0.79f, 0.64f, 0.15f);
            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    float u = x / (float)size, v = y / (float)size;
                    float g = Mathf.PerlinNoise(u * 6f + kind, v * 6f + kind);
                    var colour = background * (0.7f + g * 0.5f);
                    // a simple engraved motif per kind, so question images differ visibly
                    float motif = (kind % 4) switch
                    {
                        0 => Mathf.Abs(Mathf.Sin((u + v) * 12f)),                 // document lines
                        1 => Mathf.Abs(Mathf.Sin(u * 18f)) * Mathf.Sin(v * 6f),   // timeline bars
                        2 => Mathf.Abs(Vector2.Distance(new Vector2(u, v), new Vector2(0.5f, 0.42f)) - 0.22f), // wheel
                        _ => Mathf.Abs(Mathf.Sin(u * 10f) + Mathf.Sin(v * 10f)) * 0.5f
                    };
                    if (motif < 0.06f) colour = Color.Lerp(colour, accent, 0.6f);
                    if (u < 0.03f || v < 0.03f || u > 0.97f || v > 0.97f) colour = Color.Lerp(colour, accent, 0.35f);
                    tex.SetPixel(x, y, colour);
                }
            }
            return Finish(tex);
        }

        // ------------------------------------------------------------ helpers
        static Texture2D New(int size)
        {
            var tex = new Texture2D(size, size, TextureFormat.RGBA32, true)
            {
                wrapMode = TextureWrapMode.Repeat,
                filterMode = FilterMode.Bilinear,
                anisoLevel = 4
            };
            return tex;
        }

        static Texture2D Finish(Texture2D tex)
        {
            tex.Apply(true, false);
            return tex;
        }

        static Color Shift(Color c, float amount) => new Color(
            Mathf.Clamp01(c.r + amount), Mathf.Clamp01(c.g + amount), Mathf.Clamp01(c.b + amount), c.a);

        static float Fractal(float u, float v, int octaves)
        {
            float sum = 0f, amplitude = 1f, frequency = 1f, total = 0f;
            for (int i = 0; i < octaves; i++)
            {
                sum += Mathf.PerlinNoise(u * frequency + i * 3.7f, v * frequency + i * 1.9f) * amplitude;
                total += amplitude;
                amplitude *= 0.5f;
                frequency *= 2f;
            }
            return total > 0f ? sum / total : 0f;
        }

        /// <summary>A material library built from the museum palette in museum.json.</summary>
        public static MaterialLibrary BuildLibrary(Core.ContentDatabase content, string quality)
        {
            int scale = quality == "low" ? 128 : quality == "medium" ? 256 : 512;
            return new MaterialLibrary(scale, content);
        }
    }

    /// <summary>Every material the museum needs, named so props can request them by key.</summary>
    public class MaterialLibrary
    {
        public readonly Material Marble, Stone, Ceiling, Wood, Brass, Glass, Fabric, Paper, Screen,
            PaperWarm, Gold, DarkMetal, Leaf, Soil, Water, Cab;

        public MaterialLibrary(int size, Core.ContentDatabase content)
        {
            Marble = Lit("Marble", new Color(0.86f, 0.84f, 0.79f), 0.25f, 0.05f,
                ProceduralTextures.Marble(new Color(0.86f, 0.84f, 0.79f), new Color(0.66f, 0.63f, 0.58f), size));
            Stone = Lit("Stone", new Color(0.71f, 0.65f, 0.54f), 0.8f, 0f,
                ProceduralTextures.Sandstone(new Color(0.71f, 0.65f, 0.54f), new Color(0.58f, 0.53f, 0.44f), 6, size));
            Ceiling = Lit("Ceiling", new Color(0.17f, 0.18f, 0.2f), 0.9f, 0f);
            Wood = Lit("Wood", new Color(0.29f, 0.19f, 0.12f), 0.65f, 0f,
                ProceduralTextures.Wood(new Color(0.29f, 0.19f, 0.12f), size));
            Brass = Lit("Brass", new Color(0.72f, 0.56f, 0.26f), 0.34f, 0.75f);
            Gold = Lit("Gold", new Color(0.83f, 0.69f, 0.29f), 0.28f, 0.85f);
            DarkMetal = Lit("DarkMetal", new Color(0.15f, 0.16f, 0.18f), 0.5f, 0.55f);
            Glass = Transparent("Glass", new Color(0.78f, 0.87f, 0.92f, 0.18f), 0.06f, 0f);
            Fabric = Lit("Fabric", new Color(0.2f, 0.24f, 0.33f), 0.9f, 0f,
                ProceduralTextures.Fabric(new Color(0.2f, 0.24f, 0.33f), 0.06f, size));
            Paper = Lit("Paper", new Color(0.93f, 0.9f, 0.82f), 0.9f, 0f,
                ProceduralTextures.Paper(new Color(0.93f, 0.9f, 0.82f), size));
            PaperWarm = Lit("PaperWarm", new Color(0.85f, 0.78f, 0.62f), 0.92f, 0f,
                ProceduralTextures.Paper(new Color(0.85f, 0.78f, 0.62f), size));
            Screen = Emissive("Screen", new Color(0.05f, 0.07f, 0.12f), new Color(0.35f, 0.55f, 0.85f), 1.1f, size);
            Cab = Lit("ExhibitCabinet", new Color(0.13f, 0.14f, 0.16f), 0.55f, 0.1f,
                ProceduralTextures.Wood(new Color(0.13f, 0.14f, 0.16f), size));
            Leaf = Lit("Leaf", new Color(0.22f, 0.36f, 0.2f), 0.85f, 0f);
            Soil = Lit("Soil", new Color(0.26f, 0.2f, 0.15f), 0.95f, 0f);
            Water = Transparent("Water", new Color(0.24f, 0.42f, 0.55f, 0.55f), 0.08f, 0.1f);
        }

        static Material Lit(string name, Color colour, float smoothness, float metallic, Texture2D map = null)
        {
            var shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            var mat = new Material(shader) { name = name };
            mat.SetColor("_BaseColor", colour);
            mat.SetFloat("_Smoothness", smoothness);
            mat.SetFloat("_Metallic", metallic);
            if (map != null)
            {
                map.name = name + "_Albedo";
                mat.SetTexture("_BaseMap", map);
            }
            return mat;
        }

        static Material Transparent(string name, Color colour, float smoothness, float metallic)
        {
            var mat = Lit(name, colour, smoothness, metallic);
            mat.SetFloat("_Surface", 1f);          // transparent
            mat.SetFloat("_Blend", 0f);
            mat.SetOverrideTag("RenderType", "Transparent");
            mat.renderQueue = (int)UnityEngine.Rendering.RenderQueue.Transparent;
            mat.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.SrcAlpha);
            mat.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
            mat.SetInt("_ZWrite", 0);
            mat.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
            return mat;
        }

        static Material Emissive(string name, Color background, Color accent, float intensity, int size)
        {
            var mat = Lit(name, background, 0.4f, 0f, ProceduralTextures.Screen(background, accent, Mathf.Min(size, 256)));
            mat.EnableKeyword("_EMISSION");
            mat.SetColor("_EmissionColor", accent * intensity);
            mat.globalIlluminationFlags = MaterialGlobalIlluminationFlags.RealtimeEmissive;
            return mat;
        }
    }
}
