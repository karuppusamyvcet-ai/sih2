/* ==========================================================================
   Props.cs — the museum's furniture and the eight memorial scenes.

   Every prop is generated from primitives so the repository carries no binary
   art. Each factory returns the transform other systems attach to (a kiosk's
   screen, a plinth's reading panel), which is how MuseumBuilder wires
   interactables onto real geometry instead of onto empty objects.
   ========================================================================== */

using System.Collections.Generic;
using Heritage.Core;
using UnityEngine;

namespace Heritage.World
{
    public static class Props
    {
        // ---------------------------------------------------------------- hub
        public static Transform ReceptionDesk(Transform parent, MaterialLibrary m, Vector3 scale)
        {
            var desk = Box(parent, "Desk", new Vector3(4.4f, 1.08f, 1.1f) * scale.x, m.Wood, new Vector3(0, 0.54f, 0));
            Box(parent, "DeskTop", new Vector3(4.7f, 0.08f, 1.3f) * scale.x, m.Stone, new Vector3(0, 1.12f, 0));
            for (int i = -1; i <= 1; i += 2)
                Box(parent, "DeskSide", new Vector3(0.14f, 1.06f, 1.1f), m.DarkMetal, new Vector3(i * 2.2f * scale.x, 0.53f, 0));
            return desk.transform;
        }

        public static Transform Kiosk(Transform parent, MaterialLibrary m, Vector3 scale, string caption)
        {
            Box(parent, "KioskBody", new Vector3(0.78f, 1.05f, 0.5f) * scale.x, m.DarkMetal, new Vector3(0, 0.52f, 0));
            var screen = Box(parent, "KioskScreen", new Vector3(0.72f, 0.5f, 0.04f) * scale.x, m.Screen, new Vector3(0, 1.22f, 0.03f));
            Box(parent, "KioskBase", new Vector3(0.9f, 0.08f, 0.62f) * scale.x, m.Brass, new Vector3(0, 0.04f, 0));
            return screen.transform;
        }

        public static Transform CentralMonument(Transform parent, MaterialLibrary m, Vector3 scale)
        {
            Box(parent, "Plinth", new Vector3(2.6f, 0.5f, 2.6f) * scale.x, m.Stone, new Vector3(0, 0.25f, 0));
            var obelisk = Box(parent, "Obelisk", new Vector3(1.1f, 4.4f, 1.1f) * scale.x, m.Marble, new Vector3(0, 2.7f, 0));
            Box(parent, "ObeliskCap", new Vector3(1.35f, 0.28f, 1.35f) * scale.x, m.Gold, new Vector3(0, 5.0f, 0));
            return obelisk.transform;
        }

        public static Transform TimelineWall(Transform parent, MaterialLibrary m, ContentDatabase content, Vector3 scale)
        {
            Box(parent, "TimelineBacking", new Vector3(11f, 3.4f, 0.22f) * scale.x, m.DarkMetal, new Vector3(0, 2.4f, 0));
            var line = Box(parent, "TimelineRule", new Vector3(10.4f, 0.06f, 0.26f) * scale.x, m.Gold, new Vector3(0, 2.4f, 0.06f));
            int count = Mathf.Min(12, content.timeline?.events?.Length ?? 0);
            for (int i = 0; i < count; i++)
            {
                var ev = content.timeline.events[i];
                float x = Mathf.Lerp(-4.9f, 4.9f, i / (float)Mathf.Max(1, count - 1));
                bool above = i % 2 == 0;
                Box(parent, "Marker", new Vector3(0.1f, 0.34f, 0.1f) * scale.x, m.Brass,
                    new Vector3(x, above ? 2.62f : 2.18f, 0.1f));
                var label = Text(parent, $"{ev.year}", new Vector3(x, above ? 2.95f : 1.88f, 0.16f), 0.24f, m.Gold.color);
                label.name = "TimelineLabel_" + ev.id;
            }
            return line.transform;
        }

        public static Transform ProjectionScreen(Transform parent, MaterialLibrary m, Vector3 scale)
        {
            var screen = Box(parent, "ProjectionScreen", new Vector3(7.2f, 4f, 0.1f) * scale.x, m.Screen, new Vector3(0, 2.4f, 0.05f));
            Box(parent, "ScreenBracket", new Vector3(7.5f, 0.14f, 0.24f) * scale.x, m.DarkMetal, new Vector3(0, 0.36f, 0.08f));
            return screen.transform;
        }

        public static Transform DisplayCase(Transform parent, MaterialLibrary m, Vector3 scale)
        {
            Box(parent, "CaseBase", new Vector3(1.1f, 0.86f, 0.72f) * scale.x, m.Wood, new Vector3(0, 0.43f, 0));
            var glass = Box(parent, "CaseGlass", new Vector3(1.05f, 0.62f, 0.68f) * scale.x, m.Glass, new Vector3(0, 1.16f, 0));
            glass.transform.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            Box(parent, "CaseCrown", new Vector3(1.2f, 0.08f, 0.82f) * scale.x, m.Brass, new Vector3(0, 1.5f, 0));
            var paper = Box(glass.transform, "Document", new Vector3(0.42f, 0.02f, 0.3f), m.Paper, new Vector3(0, -0.22f, 0));
            paper.transform.localRotation = Quaternion.Euler(0, 12f, 0);
            return glass.transform;
        }

        public static Transform Bookshelf(Transform parent, MaterialLibrary m, Vector3 scale)
        {
            Box(parent, "ShelfBody", new Vector3(2.6f, 2.5f, 0.42f) * scale.x, m.Wood, new Vector3(0, 1.25f, 0));
            for (int shelf = 0; shelf < 4; shelf++)
            {
                float y = 0.5f + shelf * 0.62f;
                Box(parent, "ShelfBoard", new Vector3(2.5f, 0.05f, 0.4f) * scale.x, m.Wood, new Vector3(0, y, 0));
                int books = 14;
                for (int i = 0; i < books; i++)
                {
                    float x = Mathf.Lerp(-1.15f, 1.15f, i / (float)(books - 1)) * scale.x;
                    float h = 0.3f + ((i * 7) % 5) * 0.02f;
                    var book = Box(parent, "Book", new Vector3(0.07f, h, 0.26f) * scale.x,
                        (i % 3 == 0) ? m.PaperWarm : (i % 3 == 1 ? m.Fabric : m.Wood), new Vector3(x, y + h / 2f + 0.03f, 0.02f));
                    book.transform.localRotation = Quaternion.Euler(0, 0, ((i % 5) - 2) * 1.4f);
                }
            }
            return parent;
        }

        public static Transform ArchiveCabinet(Transform parent, MaterialLibrary m, Vector3 scale)
        {
            Box(parent, "Cabinet", new Vector3(1.7f, 2.1f, 1.5f) * scale.x, m.Cab, new Vector3(0, 1.05f, 0));
            for (int i = 0; i < 6; i++)
            {
                int row = i / 2, col = i % 2;
                var drawer = Box(parent, "Drawer", new Vector3(0.72f, 0.5f, 0.06f) * scale.x, m.DarkMetal,
                    new Vector3(-0.42f + col * 0.84f, 0.34f + row * 0.6f, 0.78f));
                Box(drawer.transform, "Handle", new Vector3(0.24f, 0.05f, 0.05f), m.Brass, new Vector3(0, 0, 0.05f));
            }
            return parent;
        }

        public static Transform InformationStele(Transform parent, MaterialLibrary m, Vector3 scale, string id)
        {
            Box(parent, "Stele", new Vector3(0.9f, 1.9f, 0.24f) * scale.x, m.Stone, new Vector3(0, 0.95f, 0));
            var panel = Box(parent, "StelePanel", new Vector3(0.74f, 1.1f, 0.05f) * scale.x, m.PaperWarm, new Vector3(0, 1.15f, 0.14f));
            panel.name = "StelePanel_" + id;
            return panel.transform;
        }

        public static Transform Planter(Transform parent, MaterialLibrary m, Vector3 scale)
        {
            Box(parent, "PlanterPot", new Vector3(1.5f, 0.62f, 1.5f) * scale.x, m.Stone, new Vector3(0, 0.31f, 0));
            Box(parent, "PlanterSoil", new Vector3(1.36f, 0.06f, 1.36f) * scale.x, m.Soil, new Vector3(0, 0.6f, 0));
            var canopy = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            canopy.name = "Foliage";
            canopy.transform.SetParent(parent, false);
            canopy.transform.localScale = new Vector3(1.5f, 1.1f, 1.5f) * scale.x;
            canopy.transform.localPosition = new Vector3(0, 1.25f, 0);
            canopy.GetComponent<Renderer>().sharedMaterial = m.Leaf;
            return canopy.transform;
        }

        public static Transform BenchRing(Transform parent, MaterialLibrary m, Vector3 scale)
        {
            Box(parent, "BenchSeat", new Vector3(3.2f, 0.12f, 0.62f) * scale.x, m.Wood, new Vector3(0, 0.46f, 0));
            for (int i = -1; i <= 1; i += 2)
                Box(parent, "BenchLeg", new Vector3(0.12f, 0.44f, 0.5f), m.DarkMetal, new Vector3(i * 1.35f * scale.x, 0.22f, 0));
            return parent;
        }

        public static Transform LabelRail(Transform parent, MaterialLibrary m, ContentDatabase content, Vector3 scale)
        {
            Box(parent, "Rail", new Vector3(26f, 0.12f, 0.3f) * scale.x, m.DarkMetal, new Vector3(0, 5.4f, -0.1f));
            foreach (var door in content.museum.doors)
            {
                var text = Text(parent, $"{door.index}. {door.label}", new Vector3(door.position[0], 5.05f, door.position[2] - 0.35f),
                    0.34f, MuseumBuilder.ParseColor(door.accentColor, Color.white));
                text.name = "DoorLabel_" + door.doorId;
            }
            return parent;
        }

        // ----------------------------------------------------------- exhibits
        /// <summary>Builds the geometry for one exhibit and returns its focus point.</summary>
        public static Transform ForKind(Transform parent, MaterialLibrary m, ExhibitDef def, ContentDatabase content)
        {
            var at = MuseumBuilder.ToVector3(def.position);
            Transform created = null;
            switch (def.kind)
            {
                case "vitrine": created = DisplayCase(At(parent, at), m, Vector3.one); break;
                case "shelf": created = Bookshelf(At(parent, at), m, Vector3.one); break;
                case "kiosk": created = Kiosk(At(parent, at), m, Vector3.one, def.label); break;
                case "map_table": created = MapTable(parent, m, at, content); break;
                case "plinth": created = Plinth(parent, m, at, def.label); break;
                case "audiovisual": created = AudioPillar(parent, m, at); break;
                case "rights_wall": created = RightsWall(parent, m, at, content); break;
                case "achievement_wall": created = AchievementWall(parent, m, at, content); break;
                case "media_wall": created = ProjectionScreen(At(parent, at), m, Vector3.one); break;
                case "timeline_wall": created = TimelineWall(At(parent, at), m, content, Vector3.one); break;
                case "panel": created = SignPanel(At(parent, at), m, def.label, Vector3.zero); break;
                case "monument": created = CentralMonument(At(parent, at), m, Vector3.one); break;
                case "garden_memorial":
                case "stupa":
                case "colonnade":
                case "lakefront":
                    created = Plinth(parent, m, at, def.label); break;
                default:
                    Debug.LogWarning($"[props] exhibit kind '{def.kind}' ({def.id}) has no builder yet — "
                                     + "add it to Props.ForKind so the content stays authoritative");
                    created = Plinth(parent, m, at, def.label);
                    break;
            }
            var holder = At(parent, at);
            holder.name = "Exhibit_" + def.id;
            return created != null ? created : holder;
        }

        public static Transform Plinth(Transform parent, MaterialLibrary m, Vector3 at, string caption)
        {
            var holder = At(parent, at);
            Box(holder, "PlinthBase", new Vector3(1.5f, 0.7f, 1.5f), m.Stone, new Vector3(0, 0.35f, 0));
            var top = Box(holder, "PlinthTop", new Vector3(1.7f, 0.08f, 1.7f), m.Marble, new Vector3(0, 0.74f, 0));
            var plate = Box(holder, "PlinthPlate", new Vector3(1.2f, 0.34f, 0.05f), m.DarkMetal, new Vector3(0, 1.0f, 0.72f));
            var label = Text(plate.transform, caption, new Vector3(0, 0, -0.04f), 0.16f, new Color(0.92f, 0.88f, 0.78f));
            label.rectTransform.sizeDelta = new Vector3(1.1f, 0.3f);
            return top.transform;
        }

        public static Transform MapTable(Transform parent, MaterialLibrary m, Vector3 at, ContentDatabase content)
        {
            var holder = At(parent, at);
            Box(holder, "MapTable", new Vector3(3.4f, 0.14f, 2.4f), m.Wood, new Vector3(0, 0.86f, 0));
            for (int i = -1; i <= 1; i += 2)
                Box(holder, "MapLeg", new Vector3(0.16f, 0.86f, 2.1f), m.DarkMetal, new Vector3(i * 1.5f, 0.43f, 0));
            var surface = Box(holder, "MapSurface", new Vector3(3.1f, 0.03f, 2.1f), m.PaperWarm, new Vector3(0, 0.94f, 0));
            int sites = content.memorials?.sites?.Length ?? 0;
            for (int i = 0; i < sites; i++)
            {
                var site = content.memorials.sites[i];
                var pin = Box(holder, "Pin", new Vector3(0.08f, 0.16f, 0.08f), m.Gold,
                    new Vector3(Mathf.Lerp(-1.3f, 1.3f, i / (float)Mathf.Max(1, sites - 1)), 1.02f, Mathf.Sin(i) * 0.6f));
                pin.name = "Pin_" + site.id;
            }
            return surface.transform;
        }

        public static Transform AudioPillar(Transform parent, MaterialLibrary m, Vector3 at)
        {
            var holder = At(parent, at);
            Box(holder, "Pillar", new Vector3(0.62f, 1.7f, 0.62f), m.Stone, new Vector3(0, 0.85f, 0));
            var grille = Box(holder, "Grille", new Vector3(0.5f, 0.5f, 0.06f), m.DarkMetal, new Vector3(0, 1.35f, 0.32f));
            return grille.transform;
        }

        public static Transform RightsWall(Transform parent, MaterialLibrary m, Vector3 at, ContentDatabase content)
        {
            var holder = At(parent, at);
            Box(holder, "RightsWall", new Vector3(9f, 4.4f, 0.26f), m.DarkMetal, new Vector3(0, 2.2f, 0));
            int count = Mathf.Min(12, content.RecordsById.Values.Count(r => r.zone == "law_constitution"));
            int index = 0;
            foreach (var record in content.RecordsById.Values)
            {
                if (record.zone != "law_constitution" || index >= count) continue;
                var tile = Box(holder, "Tiles", new Vector3(1.3f, 0.62f, 0.08f), m.PaperWarm,
                    new Vector3(Mathf.Lerp(-3.4f, 3.4f, index / (float)Mathf.Max(1, count - 1)),
                        3.1f - (index % 2) * 0.9f, 0.16f));
                tile.name = "RightsTile_" + record.id;
                index++;
            }
            return holder;
        }

        public static Transform AchievementWall(Transform parent, MaterialLibrary m, Vector3 at, ContentDatabase content)
        {
            var holder = At(parent, at);
            Box(holder, "Wall", new Vector3(8f, 4.2f, 0.24f), m.DarkMetal, new Vector3(0, 2.1f, 0));
            int count = content.achievements?.achievements?.Length ?? 0;
            for (int i = 0; i < count && i < 16; i++)
            {
                int row = i / 8, col = i % 8;
                var badge = Box(holder, "Badge", new Vector3(0.6f, 0.6f, 0.08f), m.Brass,
                    new Vector3(Mathf.Lerp(-3.2f, 3.2f, col / 7f), 3.0f - row * 0.95f, 0.16f));
                badge.name = "Badge_" + content.achievements.achievements[i].id;
            }
            return holder;
        }

        public static Transform SignPanel(Transform parent, MaterialLibrary m, string text, Vector3 at)
        {
            var holder = At(parent, at);
            Box(holder, "SignBacking", new Vector3(2.4f, 0.8f, 0.12f), m.DarkMetal, Vector3.zero);
            var surface = Box(holder, "SignFace", new Vector3(2.24f, 0.66f, 0.04f), m.PaperWarm, new Vector3(0, 0, 0.08f));
            var label = Text(surface.transform, text, new Vector3(0, 0, -0.03f), 0.2f, new Color(0.1f, 0.09f, 0.08f));
            label.rectTransform.sizeDelta = new Vector3(2.1f, 0.6f);
            return holder;
        }

        // --------------------------------------------------------- memorials
        /// <summary>
        /// The eight memorial reconstructions, chosen by sceneStyle in
        /// memorials.json. Each one is labelled in-scene as a digital
        /// reconstruction — the brief's rule that no generated scene may pass
        /// for an authentic photograph of the site.
        /// </summary>
        public static void MemorialScene(Transform parent, MaterialLibrary m, MemorialSite site, ContentDatabase content)
        {
            var parameters = site.sceneParams ?? new Dictionary<string, float>();
            float width = parameters.TryGetValue("width", out var w) ? w : 46f;
            float depth = parameters.TryGetValue("depth", out var d) ? d : 46f;
            float height = parameters.TryGetValue("height", out var h) ? h : 12f;

            Ground(parent, m, width, depth);
            switch (site.sceneStyle)
            {
                case "garden_memorial": Garden(parent, m, width, depth); break;
                case "house_library": HouseLibrary(parent, m); break;
                case "plaza_memorial": Plaza(parent, m); break;
                case "stupa_complex": Stupa(parent, m, parameters); break;
                case "colonial_house_memorial": HouseLibrary(parent, m); Plaza(parent, m); break;
                case "colonnade_park": Colonnade(parent, m, parameters); break;
                case "lakefront_monument": Lakefront(parent, m, width, depth); break;
                case "institution_atrium": Atrium(parent, m, height); break;
                default:
                    Debug.LogWarning($"[memorial] scene style '{site.sceneStyle}' ({site.id}) has no builder");
                    Plaza(parent, m);
                    break;
            }

            var board = new GameObject("ReconstructionNotice");
            board.transform.SetParent(parent, false);
            board.transform.localPosition = new Vector3(0, 2.6f, depth * 0.36f);
            var text = board.AddComponent<TMPro.TextMeshPro>();
            text.text = $"{site.name} — {content.memorials.reconstructionLabel}";
            text.fontSize = 0.5f;
            text.alignment = TMPro.TextAlignmentOptions.Center;
            text.color = new Color(0.83f, 0.69f, 0.29f);
            text.rectTransform.sizeDelta = new Vector3(16f, 1.6f);
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

        static void Garden(Transform parent, MaterialLibrary m, float width, float depth)
        {
            for (int i = 0; i < 24; i++)
            {
                float angle = i / 24f * Mathf.PI * 2f;
                float radius = Mathf.Min(width, depth) * 0.42f;
                var tree = new GameObject("Tree");
                tree.transform.SetParent(parent, false);
                tree.transform.localPosition = new Vector3(Mathf.Cos(angle) * radius, 0, Mathf.Sin(angle) * radius);
                Box(tree.transform, "Trunk", new Vector3(0.22f, 2.6f, 0.22f), m.Wood, new Vector3(0, 1.3f, 0));
                var canopy = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                canopy.name = "Canopy";
                canopy.transform.SetParent(tree.transform, false);
                canopy.transform.localScale = new Vector3(2.1f, 1.5f, 2.1f);
                canopy.transform.localPosition = new Vector3(0, 3.1f, 0);
                canopy.GetComponent<Renderer>().sharedMaterial = m.Leaf;
            }
        }

        static void HouseLibrary(Transform parent, MaterialLibrary m)
        {
            Box(parent, "House", new Vector3(12f, 4.6f, 9f), m.PaperWarm, new Vector3(0, 2.3f, 0));
            Box(parent, "Roof", new Vector3(12.6f, 0.5f, 9.6f), m.Wood, new Vector3(0, 4.75f, 0));
            for (int i = 0; i < 3; i++)
                Box(parent, "Window", new Vector3(1.4f, 1.6f, 0.14f), m.Screen, new Vector3(-3.4f + i * 3.4f, 2.5f, -4.55f));
            Bookshelf(At(parent, new Vector3(0, 0, 3.4f)), m, Vector3.one);
        }

        static void Plaza(Transform parent, MaterialLibrary m)
        {
            Box(parent, "PlazaDeck", new Vector3(30f, 0.16f, 24f), m.Stone, new Vector3(0, 0.08f, 0));
            for (int i = 0; i < 10; i++)
            {
                float angle = i / 10f * Mathf.PI * 2f;
                Box(parent, "PlazaColumn", new Vector3(0.6f, 6f, 0.6f), m.Marble,
                    new Vector3(Mathf.Cos(angle) * 13f, 3f, Mathf.Sin(angle) * 11f));
            }
        }

        static void Stupa(Transform parent, MaterialLibrary m, Dictionary<string, float> parameters)
        {
            float domeRadius = parameters.TryGetValue("domeRadius", out var r) ? r : 9f;
            Box(parent, "StupaBase", new Vector3(domeRadius * 2.6f, 0.8f, domeRadius * 2.6f), m.Stone, new Vector3(0, 0.4f, 0));
            var dome = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            dome.name = "StupaDome";
            dome.transform.SetParent(parent, false);
            dome.transform.localScale = new Vector3(domeRadius * 2f, domeRadius * 1.6f, domeRadius * 2f);
            dome.transform.localPosition = new Vector3(0, 0.8f + domeRadius * 0.8f, 0);
            dome.GetComponent<Renderer>().sharedMaterial = m.Marble;
            Box(parent, "Harmika", new Vector3(1.6f, 1.2f, 1.6f), m.Gold, new Vector3(0, 0.8f + domeRadius * 1.6f + 0.6f, 0));
            for (int i = 0; i < 8; i++)
            {
                float angle = i / 8f * Mathf.PI * 2f;
                Box(parent, "Gate", new Vector3(0.4f, 2.6f, 0.4f), m.Stone,
                    new Vector3(Mathf.Cos(angle) * domeRadius * 1.9f, 1.3f, Mathf.Sin(angle) * domeRadius * 1.9f));
            }
        }

        static void Colonnade(Transform parent, MaterialLibrary m, Dictionary<string, float> parameters)
        {
            int count = parameters.TryGetValue("count", out var c) ? Mathf.RoundToInt(c) : 16;
            for (int i = 0; i < count; i++)
            {
                float z = Mathf.Lerp(-18f, 18f, i / (float)Mathf.Max(1, count - 1));
                for (int side = -1; side <= 1; side += 2)
                    Box(parent, "Column", new Vector3(0.8f, 8f, 0.8f), m.Stone, new Vector3(side * 7f, 4f, z));
            }
            Box(parent, "Entablature", new Vector3(17f, 1.1f, 38f), m.Marble, new Vector3(0, 8.5f, 0));
        }

        static void Lakefront(Transform parent, MaterialLibrary m, float width, float depth)
        {
            Box(parent, "Promenade", new Vector3(width * 0.7f, 0.3f, 10f), m.Stone, new Vector3(0, 0.15f, 6f));
            Box(parent, "Water", new Vector3(width, 0.3f, depth * 0.8f), m.Water, new Vector3(0, 0.1f, -depth * 0.35f));
            for (int i = -3; i <= 3; i++)
                Box(parent, "Steps", new Vector3(9f, 0.22f, 1.1f), m.Stone, new Vector3(0, 0.35f + (i + 3) * 0.22f, 2.4f - i * 1.05f));
        }

        static void Atrium(Transform parent, MaterialLibrary m, float height)
        {
            Box(parent, "AtriumFloor", new Vector3(34f, 0.2f, 30f), m.Marble, new Vector3(0, 0.1f, 0));
            for (int i = -2; i <= 2; i++)
            {
                Box(parent, "AtriumColumn", new Vector3(1f, height, 1f), m.Stone, new Vector3(i * 6f, height / 2f, -13f));
                Box(parent, "AtriumColumn", new Vector3(1f, height, 1f), m.Stone, new Vector3(i * 6f, height / 2f, 13f));
            }
            Box(parent, "AtriumSkylight", new Vector3(24f, 0.3f, 12f), m.Screen, new Vector3(0, height - 0.4f, 0));
        }

        // ------------------------------------------------------------ helpers
        static Transform At(Transform parent, Vector3 localPosition)
        {
            var holder = new GameObject("Prop").transform;
            holder.SetParent(parent, false);
            holder.localPosition = localPosition;
            return holder;
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
            text.alignment = TMPro.TextAlignmentOptions.Center;
            text.color = colour;
            return text;
        }
    }
}
