/* ==========================================================================
   Props.cs — every object in the museum, generated from primitives.

   The repository ships no binary art: a vitrine, a kiosk, a bookshelf, a stupa
   and a colonnade are all built here from cubes, spheres and cylinders, then
   dressed with the procedural materials. Sizes come from the content
   (exhibits.json → size, museum.json → setDressing.size), which is why moving
   or resizing an exhibit is a JSON edit.

   Exhibit kinds arrive from exhibits.json. Unknown kinds are reported loudly and
   fall back to the closest family, so a content edit can never produce an
   invisible exhibit without saying so.
   ========================================================================== */

using System.Collections.Generic;
using Heritage.Core;
using UnityEngine;

namespace Heritage.World
{
    public static class Props
    {
        // ------------------------------------------------------------ hub props
        public static Transform ReceptionDesk(Transform parent, MaterialLibrary m, Vector3 size)
        {
            Box(parent, "Desk", new Vector3(size.x, size.y * 0.9f, size.z), m.Wood, new Vector3(0, size.y * 0.45f, 0));
            Box(parent, "DeskTop", new Vector3(size.x * 1.06f, 0.08f, size.z * 1.15f), m.Stone, new Vector3(0, size.y * 0.9f, 0));
            for (int i = -1; i <= 1; i += 2)
                Box(parent, "DeskSide", new Vector3(0.14f, size.y * 0.88f, size.z), m.DarkMetal,
                    new Vector3(i * size.x * 0.48f, size.y * 0.44f, 0));
            return parent;
        }

        public static Transform Station(Transform parent, MaterialLibrary m, Vector3 size, string caption)
        {
            Box(parent, "StationBody", new Vector3(size.x * 0.86f, size.y * 0.55f, size.z), m.Cab, new Vector3(0, size.y * 0.28f, 0));
            var screen = Box(parent, "StationScreen", new Vector3(size.x * 0.78f, size.y * 0.36f, 0.05f), m.Screen,
                new Vector3(0, size.y * 0.62f, size.z * 0.5f));
            Box(parent, "StationBase", new Vector3(size.x, 0.08f, size.z * 1.1f), m.Brass, new Vector3(0, 0.04f, 0));
            if (!string.IsNullOrEmpty(caption))
            {
                var label = Text(parent, caption, new Vector3(0, size.y * 0.94f, size.z * 0.5f), 0.16f, m.Paper.color);
                label.rectTransform.sizeDelta = new Vector3(size.x * 1.4f, 0.4f);
            }
            return screen.transform;
        }

        public static Transform Bookshelf(Transform parent, MaterialLibrary m, Vector3 size, float fillLevel)
        {
            Box(parent, "ShelfBody", new Vector3(size.x, size.y, size.z), m.Wood, new Vector3(0, size.y * 0.5f, 0));
            int shelves = 4;
            float filled = Mathf.Clamp(fillLevel <= 0f ? 1f : fillLevel, 0.15f, 1f);
            for (int shelf = 0; shelf < shelves; shelf++)
            {
                float y = size.y * (0.16f + shelf * 0.24f);
                Box(parent, "ShelfBoard", new Vector3(size.x * 0.96f, 0.05f, size.z * 0.95f), m.Wood, new Vector3(0, y, 0));
                int books = Mathf.RoundToInt(14 * filled);
                for (int i = 0; i < books; i++)
                {
                    float t = books == 1 ? 0.5f : i / (float)(books - 1);
                    float x = Mathf.Lerp(-size.x * 0.42f, size.x * 0.42f, t);
                    float h = size.y * (0.11f + ((i * 7) % 5) * 0.008f);
                    var book = Box(parent, "Book", new Vector3(0.07f, h, size.z * 0.62f),
                        (i % 3 == 0) ? m.PaperWarm : (i % 3 == 1 ? m.Fabric : m.Wood),
                        new Vector3(x, y + h * 0.5f + 0.03f, 0.02f));
                    book.transform.localRotation = Quaternion.Euler(0, 0, ((i % 5) - 2) * 1.4f);
                }
            }
            return parent;
        }

        public static Transform DisplayCase(Transform parent, MaterialLibrary m, Vector3 size)
        {
            Box(parent, "CaseBase", new Vector3(size.x, size.y * 0.42f, size.z), m.Wood, new Vector3(0, size.y * 0.21f, 0));
            var glass = Box(parent, "CaseGlass", new Vector3(size.x * 0.96f, size.y * 0.5f, size.z * 0.96f), m.Glass,
                new Vector3(0, size.y * 0.67f, 0));
            Box(parent, "CaseCrown", new Vector3(size.x * 1.06f, 0.08f, size.z * 1.06f), m.Brass, new Vector3(0, size.y * 0.94f, 0));
            var paper = Box(glass.transform, "Document", new Vector3(size.x * 0.4f, 0.02f, size.z * 0.42f), m.Paper, new Vector3(0, -size.y * 0.2f, 0));
            paper.transform.localRotation = Quaternion.Euler(0, 12f, 0);
            return glass.transform;
        }

        public static Transform Table(Transform parent, MaterialLibrary m, Vector3 size)
        {
            Box(parent, "TableTop", new Vector3(size.x, 0.12f, size.z), m.Wood, new Vector3(0, size.y, 0));
            for (int i = -1; i <= 1; i += 2)
                Box(parent, "TableLeg", new Vector3(size.x * 0.06f, size.y, size.z * 0.8f), m.DarkMetal,
                    new Vector3(i * size.x * 0.42f, size.y * 0.5f, 0));
            var surface = Box(parent, "TableSurface", new Vector3(size.x * 0.92f, 0.03f, size.z * 0.86f), m.PaperWarm,
                new Vector3(0, size.y + 0.07f, 0));
            return surface.transform;
        }

        public static Transform PanelWall(Transform parent, MaterialLibrary m, Vector3 size, string caption)
        {
            Box(parent, "PanelBacking", new Vector3(size.x, size.y, size.z * 0.6f), m.DarkMetal, new Vector3(0, size.y * 0.5f, 0));
            var face = Box(parent, "PanelFace", new Vector3(size.x * 0.94f, size.y * 0.82f, 0.05f), m.PaperWarm,
                new Vector3(0, size.y * 0.5f, size.z * 0.3f));
            if (!string.IsNullOrEmpty(caption))
            {
                var label = Text(face.transform, caption, new Vector3(0, size.y * 0.18f, -size.z * 0.2f), 0.22f,
                    new Color(0.12f, 0.11f, 0.10f));
                label.rectTransform.sizeDelta = new Vector3(size.x * 0.8f, size.y * 0.5f);
            }
            return face.transform;
        }

        public static Transform ScreenWall(Transform parent, MaterialLibrary m, Vector3 size)
        {
            var screen = Box(parent, "ScreenWall", new Vector3(size.x, size.y, size.z), m.Screen, new Vector3(0, size.y * 0.5f, 0));
            Box(parent, "ScreenFrame", new Vector3(size.x * 1.03f, 0.1f, size.z * 1.3f), m.DarkMetal, new Vector3(0, 0.05f, 0));
            return screen.transform;
        }

        public static Transform AudioPillar(Transform parent, MaterialLibrary m, Vector3 size)
        {
            Box(parent, "Pillar", new Vector3(size.x, size.y, size.z), m.Stone, new Vector3(0, size.y * 0.5f, 0));
            var grille = Box(parent, "Grille", new Vector3(size.x * 0.8f, size.y * 0.3f, 0.06f), m.DarkMetal,
                new Vector3(0, size.y * 0.78f, size.z * 0.5f));
            return grille.transform;
        }

        public static Transform Diorama(Transform parent, MaterialLibrary m, Vector3 size, ContentDatabase content)
        {
            Box(parent, "DioramaPlinth", new Vector3(size.x, 0.5f, size.z), m.Stone, new Vector3(0, 0.25f, 0));
            Box(parent, "DioramaGround", new Vector3(size.x * 0.94f, 0.08f, size.z * 0.94f), m.Soil, new Vector3(0, 0.54f, 0));
            // a small crowd of figures, one of them speaking from a raised platform
            var platform = Box(parent, "Platform", new Vector3(size.x * 0.3f, 0.6f, size.z * 0.3f), m.Wood,
                new Vector3(0, 0.8f, -size.z * 0.2f));
            Figure(platform.transform, m, new Vector3(0, 0.3f, 0), 0.95f, m.Fabric);
            for (int i = 0; i < 9; i++)
            {
                float angle = i / 9f * Mathf.PI * 2f;
                var holder = new GameObject("CrowdFigure").transform;
                holder.SetParent(parent, false);
                holder.localPosition = new Vector3(Mathf.Cos(angle) * size.x * 0.3f, 0.62f, Mathf.Sin(angle) * size.z * 0.3f);
                Figure(holder, m, Vector3.zero, 0.85f, i % 2 == 0 ? m.Fabric : m.PaperWarm);
            }
            return platform.transform;
        }

        public static Transform Dais(Transform parent, MaterialLibrary m, Vector3 size)
        {
            for (int step = 0; step < 3; step++)
            {
                Box(parent, "DaisStep", new Vector3(size.x * (1f - step * 0.16f), 0.22f, size.z * (1f - step * 0.13f)), m.Marble,
                    new Vector3(0, 0.11f + step * 0.22f, 0));
            }
            var podium = Box(parent, "Podium", new Vector3(size.x * 0.34f, 0.9f, size.z * 0.2f), m.Wood, new Vector3(0, 1.2f, 0));
            Box(podium.transform, "PodiumTop", new Vector3(0.9f, 0.06f, 0.54f), m.Brass, new Vector3(0, 0.5f, 0));
            return podium.transform;
        }

        public static Transform CentralMonument(Transform parent, MaterialLibrary m, Vector3 size)
        {
            Box(parent, "Plinth", new Vector3(size.x, 0.5f, size.z), m.Stone, new Vector3(0, 0.25f, 0));
            var obelisk = Box(parent, "Obelisk", new Vector3(size.x * 0.42f, 4.4f, size.z * 0.42f), m.Marble, new Vector3(0, 2.7f, 0));
            Box(parent, "ObeliskCap", new Vector3(size.x * 0.52f, 0.28f, size.z * 0.52f), m.Gold, new Vector3(0, 5.0f, 0));
            return obelisk.transform;
        }

        public static Transform TimelineWall(Transform parent, MaterialLibrary m, ContentDatabase content, Vector3 size)
        {
            Box(parent, "TimelineBacking", new Vector3(size.x, size.y, size.z), m.DarkMetal, new Vector3(0, size.y * 0.5f, 0));
            Box(parent, "TimelineRule", new Vector3(size.x * 0.96f, 0.06f, size.z * 1.1f), m.Gold, new Vector3(0, size.y * 0.5f, size.z * 0.3f));
            int count = Mathf.Min(12, content.timeline != null && content.timeline.events != null ? content.timeline.events.Length : 0);
            for (int i = 0; i < count; i++)
            {
                var ev = content.timeline.events[i];
                float x = count == 1 ? 0f : Mathf.Lerp(-size.x * 0.44f, size.x * 0.44f, i / (float)(count - 1));
                bool above = i % 2 == 0;
                Box(parent, "Marker", new Vector3(0.1f, 0.34f, 0.1f), m.Brass,
                    new Vector3(x, size.y * 0.5f + (above ? 0.22f : -0.22f), size.z * 0.5f));
                var label = Text(parent, ev.year.ToString(), new Vector3(x, size.y * 0.5f + (above ? 0.55f : -0.55f), size.z * 0.5f),
                    0.24f, m.Gold.color);
                label.name = "TimelineLabel_" + ev.id;
            }
            return parent;
        }

        public static Transform ArchiveCabinet(Transform parent, MaterialLibrary m, Vector3 size)
        {
            Box(parent, "Cabinet", new Vector3(size.x, size.y, size.z), m.Cab, new Vector3(0, size.y * 0.5f, 0));
            for (int i = 0; i < 6; i++)
            {
                int row = i / 2, col = i % 2;
                var drawer = Box(parent, "Drawer", new Vector3(size.x * 0.42f, size.y * 0.24f, 0.06f), m.DarkMetal,
                    new Vector3(size.x * (col == 0 ? -0.24f : 0.24f), size.y * (0.18f + row * 0.28f), size.z * 0.52f));
                Box(drawer.transform, "Handle", new Vector3(0.24f, 0.05f, 0.05f), m.Brass, new Vector3(0, 0, 0.05f));
            }
            return parent;
        }

        public static Transform InformationStele(Transform parent, MaterialLibrary m, Vector3 size, ExhibitDef def)
        {
            Box(parent, "Stele", new Vector3(size.x, size.y, size.z), m.Stone, new Vector3(0, size.y * 0.5f, 0));
            var panel = Box(parent, "StelePanel", new Vector3(size.x * 0.8f, size.y * 0.55f, 0.05f), m.PaperWarm,
                new Vector3(0, size.y * 0.6f, size.z * 0.55f));
            if (def != null && def.panel != null && !string.IsNullOrEmpty(def.panel.title))
            {
                var label = Text(panel.transform, def.panel.title, new Vector3(0, 0, -0.04f), 0.14f, new Color(0.12f, 0.11f, 0.1f));
                label.rectTransform.sizeDelta = new Vector3(size.x * 0.7f, size.y * 0.4f);
            }
            return panel.transform;
        }

        public static Transform Planter(Transform parent, MaterialLibrary m, Vector3 size)
        {
            Box(parent, "PlanterPot", new Vector3(size.x, size.y, size.z), m.Stone, new Vector3(0, size.y * 0.5f, 0));
            Box(parent, "PlanterSoil", new Vector3(size.x * 0.9f, 0.06f, size.z * 0.9f), m.Soil, new Vector3(0, size.y, 0));
            var canopy = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            canopy.name = "Foliage";
            canopy.transform.SetParent(parent, false);
            canopy.transform.localScale = new Vector3(size.x * 1.1f, size.y * 1.8f, size.z * 1.1f);
            canopy.transform.localPosition = new Vector3(0, size.y * 2f, 0);
            canopy.GetComponent<Renderer>().sharedMaterial = m.Leaf;
            return canopy.transform;
        }

        public static Transform BenchRing(Transform parent, MaterialLibrary m, Vector3 size)
        {
            Box(parent, "BenchSeat", new Vector3(size.x, 0.12f, size.z), m.Wood, new Vector3(0, 0.46f, 0));
            for (int i = -1; i <= 1; i += 2)
                Box(parent, "BenchLeg", new Vector3(0.12f, 0.44f, size.z * 0.8f), m.DarkMetal, new Vector3(i * size.x * 0.4f, 0.22f, 0));
            return parent;
        }

        public static Transform LabelRail(Transform parent, MaterialLibrary m, ContentDatabase content, Vector3 size)
        {
            Box(parent, "Rail", new Vector3(size.x, 0.12f, size.z), m.DarkMetal, new Vector3(0, size.y * 0.5f, 0));
            if (content.museum == null || content.museum.doors == null) return parent;
            foreach (var door in content.museum.doors)
            {
                var holder = new GameObject("DoorLabel_" + door.doorId).transform;
                holder.SetParent(parent, false);
                holder.localPosition = new Vector3(door.x, 0, door.z - 0.4f);
                var text = Text(holder, $"{door.index}. {door.label}", Vector3.zero, 0.34f,
                    MuseumBuilder.ParseColor(door.accent, Color.white));
                text.rectTransform.sizeDelta = new Vector3(door.width + 1.6f, 0.8f);
            }
            return parent;
        }

        // -------------------------------------------------------- memorial props
        public static void MemorialScene(Transform parent, MaterialLibrary m, MemorialSite site, ContentDatabase content)
        {
            var p = content.SceneParams(site.id);
            float plaza = Value(p, "plazaSize", 34f);
            Ground(parent, m, plaza * 1.4f, plaza * 1.4f);

            switch (site.sceneStyle)
            {
                case "garden_memorial": Garden(parent, m, p, plaza); break;
                case "house_library": HouseLibrary(parent, m, p); break;
                case "plaza_memorial": Plaza(parent, m, p, plaza); break;
                case "stupa_complex": Stupa(parent, m, p); break;
                case "colonial_house_memorial": HouseLibrary(parent, m, p); Plaza(parent, m, p, plaza * 0.7f); break;
                case "colonnade_park": Colonnade(parent, m, p); break;
                case "lakefront_monument": Lakefront(parent, m, p, plaza); break;
                case "institution_atrium": Atrium(parent, m, p); break;
                default:
                    Debug.LogWarning($"[props] memorial scene style '{site.sceneStyle}' ({site.id}) has no builder — "
                                     + "add it to Props.MemorialScene and to memorials.json");
                    Plaza(parent, m, p, plaza);
                    break;
            }

            var notice = new GameObject("ReconstructionNotice");
            notice.transform.SetParent(parent, false);
            notice.transform.localPosition = new Vector3(0, 2.8f, -plaza * 0.62f);
            var text = notice.AddComponent<TMPro.TextMeshPro>();
            text.text = $"{site.name} — {content.memorials.reconstructionLabel}";
            text.fontSize = 0.42f;
            text.color = new Color(0.83f, 0.69f, 0.29f);
            text.rectTransform.sizeDelta = new Vector3(18f, 1.6f);
        }

        public static Transform Plinth(Transform parent, MaterialLibrary m, Vector3 at, string caption)
        {
            var holder = At(parent, at);
            Box(holder, "PlinthBase", new Vector3(1.5f, 0.7f, 1.5f), m.Stone, new Vector3(0, 0.35f, 0));
            var top = Box(holder, "PlinthTop", new Vector3(1.7f, 0.08f, 1.7f), m.Marble, new Vector3(0, 0.74f, 0));
            var plate = Box(holder, "PlinthPlate", new Vector3(1.3f, 0.36f, 0.05f), m.DarkMetal, new Vector3(0, 1.0f, 0.72f));
            var label = Text(plate.transform, caption, new Vector3(0, 0, -0.05f), 0.16f, new Color(0.92f, 0.88f, 0.78f));
            label.rectTransform.sizeDelta = new Vector3(1.2f, 0.3f);
            return top.transform;
        }

        static void Ground(Transform parent, MaterialLibrary m, float width, float depth)
        {
            var ground = GameObject.CreatePrimitive(PrimitiveType.Cube);
            ground.name = "Ground";
            ground.transform.SetParent(parent, false);
            ground.transform.localScale = new Vector3(width, 0.2f, depth);
            ground.transform.localPosition = new Vector3(0, -0.1f, 0);
            ground.GetComponent<Renderer>().sharedMaterial = m.Soil;
        }

        static void Garden(Transform parent, MaterialLibrary m, Dictionary<string, float> p, float plaza)
        {
            int beds = Mathf.RoundToInt(Value(p, "gardenBeds", 6f));
            for (int i = 0; i < beds; i++)
            {
                float angle = i / (float)beds * Mathf.PI * 2f;
                var bed = new GameObject("GardenBed").transform;
                bed.SetParent(parent, false);
                bed.localPosition = new Vector3(Mathf.Cos(angle) * plaza * 0.38f, 0, Mathf.Sin(angle) * plaza * 0.38f);
                Box(bed, "BedSoil", new Vector3(2.6f, 0.24f, 2.6f), m.Soil, new Vector3(0, 0.12f, 0));
                Geo.Foliage(bed, m, new Vector3(0, 0.4f, 0), 1.6f);
            }
            int steps = Mathf.RoundToInt(Value(p, "stepCount", 3f));
            for (int i = 0; i < steps; i++)
                Box(parent, "Step", new Vector3(plaza * 0.5f, 0.2f, 1.1f), m.Stone, new Vector3(0, 0.1f + i * 0.2f, -plaza * 0.3f - i * 1.05f));
            if (Value(p, "waterChannel", 0f) > 0.5f)
                Box(parent, "WaterChannel", new Vector3(3f, 0.12f, plaza * 0.5f), m.Water, new Vector3(0, 0.12f, 2f));
            float obelisk = Value(p, "obeliskHeight", 6f);
            Box(parent, "Obelisk", new Vector3(1.2f, obelisk, 1.2f), m.Marble, new Vector3(0, obelisk * 0.5f + 0.4f, 0));
        }

        static void HouseLibrary(Transform parent, MaterialLibrary m, Dictionary<string, float> p)
        {
            float w = Value(p, "houseWidth", 14f), d = Value(p, "houseDepth", 11f);
            int storeys = Mathf.RoundToInt(Value(p, "storeys", 2f));
            float h = 3.4f * storeys;
            Box(parent, "House", new Vector3(w, h, d), m.PaperWarm, new Vector3(0, h * 0.5f, 0));
            Box(parent, "HouseRoof", new Vector3(w * 1.06f, 0.5f, d * 1.06f), m.Wood, new Vector3(0, h + 0.25f, 0));
            for (int floor = 0; floor < storeys; floor++)
                for (int i = 0; i < 3; i++)
                    Box(parent, "Window", new Vector3(1.4f, 1.5f, 0.14f), m.Screen,
                        new Vector3(-w * 0.28f + i * w * 0.28f, 1.6f + floor * 3.4f, -d * 0.5f - 0.05f));
            float veranda = Value(p, "verandaDepth", 2.2f);
            Box(parent, "Veranda", new Vector3(w * 0.9f, 0.25f, veranda), m.Stone, new Vector3(0, 0.12f, d * 0.5f + veranda * 0.5f));
            Bookshelf(At(parent, new Vector3(0, 0, d * 0.32f)), m, new Vector3(w * 0.6f, 2.6f, 0.5f), 1f);
        }

        static void Plaza(Transform parent, MaterialLibrary m, Dictionary<string, float> p, float plaza)
        {
            Box(parent, "PlazaDeck", new Vector3(plaza, 0.16f, plaza * 0.8f), m.Stone, new Vector3(0, 0.08f, 0));
            int columns = Mathf.RoundToInt(Value(p, "columns", 10f));
            float radius = Value(p, "canopyRadius", plaza * 0.34f);
            for (int i = 0; i < columns; i++)
            {
                float angle = i / (float)columns * Mathf.PI * 2f;
                Box(parent, "PlazaColumn", new Vector3(0.6f, 6f, 0.6f), m.Marble,
                    new Vector3(Mathf.Cos(angle) * radius, 3f, Mathf.Sin(angle) * radius * 0.9f));
            }
            int steps = Mathf.RoundToInt(Value(p, "stepCount", 4f));
            for (int i = 0; i < steps; i++)
                Box(parent, "Step", new Vector3(plaza * 0.5f, 0.2f, 1.2f), m.Stone, new Vector3(0, 0.1f + i * 0.2f, plaza * 0.42f + i * 1.1f));
        }

        static void Stupa(Transform parent, MaterialLibrary m, Dictionary<string, float> p)
        {
            float radius = Value(p, "domeRadius", 9f);
            float domeHeight = Value(p, "domeHeight", radius * 1.6f);
            int flights = Mathf.RoundToInt(Value(p, "stairFlights", 4f));
            Box(parent, "StupaBase", new Vector3(radius * 2.8f, 0.9f, radius * 2.8f), m.Stone, new Vector3(0, 0.45f, 0));
            for (int i = 0; i < flights; i++)
                Box(parent, "StupaStep", new Vector3(radius * (2.4f - i * 0.35f), 0.28f, radius * (2.4f - i * 0.35f)), m.Marble,
                    new Vector3(0, 1.0f + i * 0.28f, 0));
            var dome = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            dome.name = "StupaDome";
            dome.transform.SetParent(parent, false);
            dome.transform.localScale = new Vector3(radius * 2f, domeHeight, radius * 2f);
            dome.transform.localPosition = new Vector3(0, 1.0f + flights * 0.28f + domeHeight * 0.35f, 0);
            dome.GetComponent<Renderer>().sharedMaterial = m.Marble;
            Box(parent, "Harmika", new Vector3(1.8f, 1.3f, 1.8f), m.Gold,
                new Vector3(0, 1.0f + flights * 0.28f + domeHeight * 0.75f, 0));
            for (int i = 0; i < 8; i++)
            {
                float angle = i / 8f * Mathf.PI * 2f;
                Box(parent, "Gate", new Vector3(0.5f, 2.8f, 0.5f), m.Stone,
                    new Vector3(Mathf.Cos(angle) * radius * 1.7f, 1.4f, Mathf.Sin(angle) * radius * 1.7f));
            }
        }

        static void Colonnade(Transform parent, MaterialLibrary m, Dictionary<string, float> p)
        {
            int count = Mathf.RoundToInt(Value(p, "colonnadeColumns", 40f));
            int spans = Mathf.Max(1, Mathf.RoundToInt(Value(p, "colonnadeSpans", 2f)));
            float channel = Value(p, "channelLength", 60f);
            int perSide = Mathf.Max(2, count / (spans * 2));
            for (int i = 0; i < perSide; i++)
            {
                float z = Mathf.Lerp(-channel * 0.5f, channel * 0.5f, i / (float)(perSide - 1));
                for (int side = -1; side <= 1; side += 2)
                    Box(parent, "Column", new Vector3(0.8f, 8f, 0.8f), m.Stone, new Vector3(side * 7f, 4f, z));
            }
            Box(parent, "Entablature", new Vector3(17f, 1.1f, channel), m.Marble, new Vector3(0, 8.5f, 0));
            float stupaRadius = Value(p, "centralStupaRadius", 6f);
            var dome = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            dome.name = "CentralStupa";
            dome.transform.SetParent(parent, false);
            dome.transform.localScale = new Vector3(stupaRadius * 2f, stupaRadius * 1.4f, stupaRadius * 2f);
            dome.transform.localPosition = new Vector3(0, stupaRadius * 0.7f, 0);
            dome.GetComponent<Renderer>().sharedMaterial = m.Marble;
        }

        static void Lakefront(Transform parent, MaterialLibrary m, Dictionary<string, float> p, float plaza)
        {
            float lakeWidth = Value(p, "lakeWidth", 90f);
            Box(parent, "Promenade", new Vector3(plaza, 0.3f, 12f), m.Stone, new Vector3(0, 0.15f, 5f));
            Box(parent, "Lake", new Vector3(lakeWidth, 0.3f, 60f), m.Water, new Vector3(0, 0.1f, -26f));
            int steps = Mathf.RoundToInt(Value(p, "steps", 4f));
            for (int i = 0; i < steps; i++)
                Box(parent, "Steps", new Vector3(plaza * 0.6f, 0.22f, 1.1f), m.Stone, new Vector3(0, 0.35f + i * 0.22f, -1f - i * 1.05f));
            float pedestal = Value(p, "pedestalHeight", 6f);
            float statue = Value(p, "statueHeight", 30f);
            Box(parent, "Pedestal", new Vector3(4f, pedestal, 4f), m.Stone, new Vector3(0, pedestal * 0.5f, -6f));
            Box(parent, "StatueSilhouette", new Vector3(1.6f, statue, 1.6f), m.Marble,
                new Vector3(0, pedestal + statue * 0.5f, -6f));
        }

        static void Atrium(Transform parent, MaterialLibrary m, Dictionary<string, float> p)
        {
            float w = Value(p, "atriumWidth", 26f), d = Value(p, "atriumDepth", 22f), h = Value(p, "height", 14f);
            Box(parent, "AtriumFloor", new Vector3(w, 0.2f, d), m.Marble, new Vector3(0, 0.1f, 0));
            for (int i = -2; i <= 2; i++)
            {
                Box(parent, "AtriumColumn", new Vector3(1f, h, 1f), m.Stone, new Vector3(i * w * 0.2f, h * 0.5f, -d * 0.45f));
                Box(parent, "AtriumColumn", new Vector3(1f, h, 1f), m.Stone, new Vector3(i * w * 0.2f, h * 0.5f, d * 0.45f));
            }
            int lights = Mathf.RoundToInt(Value(p, "skyLights", 6f));
            for (int i = 0; i < lights; i++)
                Box(parent, "Skylight", new Vector3(w * 0.12f, 0.3f, d * 0.5f), m.Screen,
                    new Vector3(-w * 0.35f + i * (w * 0.7f / Mathf.Max(1, lights - 1)), h - 0.4f, 0));
            int tables = Mathf.RoundToInt(Value(p, "readingTables", 8f));
            for (int i = 0; i < tables; i++)
                Table(At(parent, new Vector3(-w * 0.3f + (i % 4) * w * 0.2f, 0, d * 0.15f + (i / 4) * 4f)), m, new Vector3(2.2f, 0.76f, 1.2f));
        }

        static float Value(Dictionary<string, float> map, string key, float fallback)
        {
            float found;
            if (map != null && map.TryGetValue(key, out found)) return found;
            return fallback;
        }

        // -------------------------------------------------------------- helpers
        public static Transform At(Transform parent, Vector3 localPosition)
        {
            var holder = new GameObject("Prop").transform;
            holder.SetParent(parent, false);
            holder.localPosition = localPosition;
            return holder;
        }

        static void Figure(Transform parent, MaterialLibrary m, Vector3 localPosition, float height, Material cloth)
        {
            var body = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            body.name = "Figure";
            body.transform.SetParent(parent, false);
            body.transform.localScale = new Vector3(height * 0.28f, height * 0.42f, height * 0.28f);
            body.transform.localPosition = localPosition + Vector3.up * height * 0.5f;
            body.GetComponent<Renderer>().sharedMaterial = cloth;
            var head = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            head.name = "FigureHead";
            head.transform.SetParent(parent, false);
            head.transform.localScale = Vector3.one * height * 0.19f;
            head.transform.localPosition = localPosition + Vector3.up * height * 0.93f;
            head.GetComponent<Renderer>().sharedMaterial = m.Brass;
        }

        static GameObject Box(Transform parent, string name, Vector3 scale, Material material, Vector3 localPosition)
        {
            var box = GameObject.CreatePrimitive(PrimitiveType.Cube);
            box.name = name;
            box.transform.SetParent(parent, false);
            box.transform.localScale = scale;
            box.transform.localPosition = localPosition;
            box.GetComponent<Renderer>().sharedMaterial = material;
            return box;
        }

        static TMPro.TextMeshPro Text(Transform parent, string value, Vector3 localPosition, float size, Color colour)
        {
            var holder = new GameObject("Text");
            holder.transform.SetParent(parent, false);
            holder.transform.localPosition = localPosition;
            var text = holder.AddComponent<TMPro.TextMeshPro>();
            text.text = value;
            text.fontSize = size;
            text.color = colour;
            text.enableWordWrapping = true;
            return text;
        }
    }

    /// <summary>Small geometry helpers shared by the hub and gallery builders.</summary>
    public static class Geo
    {
        public static void Foliage(Transform parent, MaterialLibrary m, Vector3 localPosition, float size)
        {
            var canopy = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            canopy.name = "Foliage";
            canopy.transform.SetParent(parent, false);
            canopy.transform.localScale = new Vector3(size, size * 0.8f, size);
            canopy.transform.localPosition = localPosition;
            canopy.GetComponent<Renderer>().sharedMaterial = m.Leaf;
        }
    }
}
