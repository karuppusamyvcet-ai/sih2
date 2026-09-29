/* ==========================================================================
   MuseumBuilder.cs — the museum, generated from the content JSON.

   Nothing here is hand-placed. The hall and its colonnade and skylights come
   from museum.json → hall; the six labelled doors from museum.json → doors; the
   furniture from museum.json → setDressing; the galleries from exhibits.json →
   rooms and their exhibits; the eight memorial reconstructions from
   memorials.json. Moving a door, resizing an exhibit or adding a vitrine is a
   content edit.

   The scene is built at runtime in play mode and, for the shipped builds, baked
   into a scene by Assets/Editor/SceneBuilder.cs, which calls the same methods —
   one implementation, both entry points, so the editor view and the build can
   never disagree.
   ========================================================================== */

using System.Collections.Generic;
using Heritage.Core;
using UnityEngine;

namespace Heritage.World
{
    /// <summary>Anything the player can focus and use with the interact key.</summary>
    public class Interactable : MonoBehaviour
    {
        public string id;
        public string label;
        public string title;
        public string body;
        public string kind;              // door | exit | memorial_plinth | tour_stop | exhibit kind
        public string interaction;       // press | read | examine | sit | book | notes | listen | search | ask
        public string opensUI;           // archive | map | guide | objectives
        public string minigame;
        public string zone;
        public string memorialId;
        public string[] archiveIds;
        public string[] quizIds;
        public string[] conceptIds;
        public string[] memorialIds;
        public MediaItem[] media;
        public bool walkable;
        public Transform focus;
    }

    public class MuseumBuilder : MonoBehaviour
    {
        public MaterialLibrary Materials { get; private set; }
        public readonly List<Interactable> Interactables = new List<Interactable>();
        public readonly List<Light> RoomLights = new List<Light>();
        public Vector3 SpawnPoint { get; private set; }
        public float SpawnFacing { get; private set; }
        public string CurrentZone { get; private set; } = "hub";

        ContentDatabase _content;
        Transform _root;
        readonly Dictionary<string, DoorController> _doors = new Dictionary<string, DoorController>();

        public IReadOnlyDictionary<string, DoorController> Doors => _doors;

        public void Initialise(ContentDatabase content, string quality)
        {
            _content = content;
            Materials = ProceduralTextures.BuildLibrary(content, quality);
            _root = new GameObject("Museum").transform;
            _root.SetParent(transform, false);
            var spawn = content.museum != null && content.museum.spawnPoint != null ? content.museum.spawnPoint : null;
            SpawnPoint = ToVector3(spawn);
            SpawnFacing = content.museum != null ? content.museum.spawnFacing : 0f;
        }

        // ------------------------------------------------------------- the hub
        public void BuildHub()
        {
            Clear();
            CurrentZone = "hub";
            if (_content.museum == null)
            {
                Debug.LogError("[museum] museum.json did not load — the hub cannot be built. "
                               + "Check Assets/Resources/Content/museum.json");
                return;
            }

            var hall = _content.museum.hall;
            var room = new GameObject("Hub_Room").transform;
            room.SetParent(_root, false);
            BuildShell(room, "Central Hall", hall, new[] { Materials.Marble, Materials.Stone }, "grand_hall");

            if (hall.columns != null)
            {
                foreach (var column in hall.columns)
                {
                    var holder = Props.At(room, new Vector3(column.x, 0, column.z));
                    var shaft = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                    shaft.name = "Column";
                    shaft.transform.SetParent(holder, false);
                    shaft.transform.localScale = new Vector3(column.radius * 2f, column.height * 0.5f, column.radius * 2f);
                    shaft.transform.localPosition = new Vector3(0, column.height * 0.5f, 0);
                    shaft.GetComponent<Renderer>().sharedMaterial = Materials.Stone;
                    Box(holder, "Capital", new Vector3(column.radius * 2.6f, 0.3f, column.radius * 2.6f),
                        Materials.Brass, new Vector3(0, column.height + 0.15f, 0));
                }
            }

            foreach (var door in _content.museum.doors) BuildDoor(room, door);
            BuildSetDressing(room);
            BuildHubExhibits(room);
            BuildLighting(room, hall.width, hall.depth, hall.height);
        }

        void BuildDoor(Transform parent, MuseumDoor door)
        {
            var holder = new GameObject("Door_" + door.doorId).transform;
            holder.SetParent(parent, false);
            holder.localPosition = new Vector3(door.x, 0, door.z);

            float width = door.width, height = door.height;
            var frameMat = Materials.DarkMetal;

            Box(holder, "Lintel", new Vector3(width + 0.24f, 0.14f, 0.18f), frameMat, new Vector3(0, height + 0.07f, 0));
            for (int side = -1; side <= 1; side += 2)
                Box(holder, "Jamb", new Vector3(0.12f, height, 0.18f), frameMat, new Vector3(side * (width / 2f + 0.06f), height / 2f, 0));

            var doorRoot = new GameObject("Leaves").transform;
            doorRoot.SetParent(holder, false);
            var controller = doorRoot.gameObject.AddComponent<DoorController>();
            for (int side = -1; side <= 1; side += 2)
            {
                var hinge = new GameObject(side < 0 ? "HingeL" : "HingeR").transform;
                hinge.SetParent(doorRoot, false);
                hinge.localPosition = new Vector3(side * width / 2f, 0, 0);
                Box(hinge, "Leaf", new Vector3(width / 2f, height, 0.08f), Materials.Wood, new Vector3(-side * width / 4f, height / 2f, 0));
                controller.RegisterHinge(hinge, -side * 96f);
            }

            // the label above the door: real 3D text, readable from across the hall
            var plate = Box(holder, "LabelPlate", new Vector3(width + 1.7f, 0.72f, 0.06f), Materials.DarkMetal,
                new Vector3(0, height + 0.52f, 0.02f));
            var labelHolder = new GameObject("Label").transform;
            labelHolder.SetParent(holder, false);
            labelHolder.localPosition = new Vector3(0, height + 0.52f, -0.03f);
            var label = labelHolder.gameObject.AddComponent<TMPro.TextMeshPro>();
            label.text = $"{door.index}. {door.label}";
            label.fontSize = 0.34f;
            label.alignment = TMPro.TextAlignmentOptions.Center;
            label.color = ParseColor(door.accent, Color.white);
            label.rectTransform.sizeDelta = new Vector3(width + 1.6f, 0.9f);
            label.enableWordWrapping = false;
            plate.transform.localPosition = new Vector3(0, height + 0.52f, 0.02f);

            var zone = Zone(door.zone);
            var interactable = holder.gameObject.AddComponent<Interactable>();
            interactable.id = door.doorId;
            interactable.label = door.label;
            interactable.kind = "door";
            interactable.interaction = "press";
            interactable.title = string.IsNullOrEmpty(door.lockedMessage) ? door.label : door.lockedMessage;
            interactable.body = zone != null ? zone.description : door.label;
            interactable.zone = door.zone;
            interactable.focus = holder;
            Interactables.Add(interactable);

            _doors[door.zone] = controller;
            var collider = holder.gameObject.AddComponent<BoxCollider>();
            collider.size = new Vector3(width + 0.3f, 0.3f, 0.4f);
            collider.center = new Vector3(0, height + 0.12f, 0);
        }

        void BuildSetDressing(Transform parent)
        {
            if (_content.museum.setDressing == null) return;
            foreach (var piece in _content.museum.setDressing)
            {
                var holder = new GameObject("Dress_" + piece.id).transform;
                holder.SetParent(parent, false);
                holder.localPosition = new Vector3(piece.x, 0, piece.z);
                holder.localEulerAngles = new Vector3(0, piece.rotationY, 0);
                Vector3 size = piece.size != null && piece.size.Length >= 3 ? ToVector3(piece.size) : new Vector3(1.6f, 1.6f, 1.6f);

                switch (piece.type)
                {
                    case "reception_desk": Props.ReceptionDesk(holder, Materials, size); break;
                    case "guide_terminal": Props.Station(holder, Materials, size, "ARCHIVE GUIDE"); break;
                    case "archive_kiosk": Props.Station(holder, Materials, size, "DIGITAL ARCHIVE"); break;
                    case "glass_display_case": Props.DisplayCase(holder, Materials, size); break;
                    case "bookshelf": Props.Bookshelf(holder, Materials, size, piece.fillLevel); break;
                    case "info_stele": Props.InformationStele(holder, Materials, size, null); break;
                    case "planter": Props.Planter(holder, Materials, size); break;
                    case "bench": Props.BenchRing(holder, Materials, size); break;
                    case "central_monument": Props.CentralMonument(holder, Materials, size); break;
                    case "timeline_wall": Props.TimelineWall(holder, Materials, _content, size); break;
                    case "projection_screen": Props.ScreenWall(holder, Materials, size); break;
                    case "archive_cabinet": Props.ArchiveCabinet(holder, Materials, size); break;
                    case "label_rail": Props.LabelRail(holder, Materials, _content, size); break;
                    default:
                        Debug.LogWarning($"[museum] set dressing type '{piece.type}' ({piece.id}) has no builder; "
                                         + "add it to MuseumBuilder.BuildSetDressing or fix museum.json");
                        Props.DisplayCase(holder, Materials, size);
                        break;
                }
            }
        }

        void BuildHubExhibits(Transform parent)
        {
            foreach (var def in AllExhibits())
                if (def.zone == "hub") BuildExhibit(parent, def);
        }

        // -------------------------------------------------------------- rooms
        public void BuildZone(string zoneId)
        {
            Clear();
            var zone = Zone(zoneId);
            if (zone == null)
            {
                Debug.LogWarning($"[museum] no gallery '{zoneId}' in zones.json — staying in the hub");
                BuildHub();
                return;
            }
            CurrentZone = zoneId;

            RoomSpec room;
            _content.Rooms.TryGetValue(zoneId, out room);
            var roomRoot = new GameObject("Zone_" + zoneId).transform;
            roomRoot.SetParent(_root, false);

            var hall = ScaledHall(room, zone);
            BuildShell(roomRoot, zone.name, hall,
                new[] { zoneId == "legacy" ? Materials.Marble : Materials.Stone, zoneId == "manuscripts" ? Materials.Wood : Materials.PaperWarm },
                room != null ? room.style : "gallery");

            foreach (var def in AllExhibits())
                if (def.zone == zoneId) BuildExhibit(roomRoot, def);

            var exit = Props.PanelWall(Props.At(roomRoot, new Vector3(0, 0, hall.depth * 0.5f - 0.5f)), Materials,
                new Vector3(3.2f, 1.1f, 0.2f), "RETURN TO THE CENTRAL HALL");
            var exitInteractable = exit.gameObject.AddComponent<Interactable>();
            exitInteractable.id = "exit_" + zoneId;
            exitInteractable.label = "Return to the Central Hall";
            exitInteractable.kind = "exit";
            exitInteractable.interaction = "press";
            exitInteractable.focus = exit;
            Interactables.Add(exitInteractable);

            BuildLighting(roomRoot, hall.width, hall.depth, hall.height);
        }

        HallSpec ScaledHall(RoomSpec room, ZoneDef zone)
        {
            var hall = _content.museum != null ? _content.museum.hall : null;
            var spec = new HallSpec
            {
                width = room != null && room.width > 0f ? room.width : (hall != null ? hall.width * 0.7f : 30f),
                depth = room != null && room.depth > 0f ? room.depth : (hall != null ? hall.depth * 0.7f : 30f),
                height = room != null && room.height > 0f ? room.height : 8f,
                wallThickness = hall != null ? hall.wallThickness : 0.4f,
                wainscotHeight = hall != null ? hall.wainscotHeight : 1.2f,
                skylightStrips = 3,
                floorMaterial = hall != null ? hall.floorMaterial : "marble_cream",
                wallMaterial = hall != null ? hall.wallMaterial : "stone_sandstone",
                ceilingMaterial = hall != null ? hall.ceilingMaterial : "ceiling_coffered"
            };
            Debug.Log($"[museum] gallery '{zone.id}' ({zone.doorLabel}) is {spec.width} × {spec.depth} m, "
                      + $"style '{room?.style ?? "gallery"}'");
            return spec;
        }

        public void BuildMemorial(string siteId)
        {
            Clear();
            if (!_content.MemorialsById.TryGetValue(siteId, out var site))
            {
                Debug.LogWarning($"[museum] no memorial '{siteId}' in memorials.json");
                BuildHub();
                return;
            }
            CurrentZone = "memorial";

            var ground = new GameObject("Memorial_" + siteId).transform;
            ground.SetParent(_root, false);
            Props.MemorialScene(ground, Materials, site, _content);

            var plinth = Props.Plinth(ground, Materials, new Vector3(0, 0, 6f), site.name);
            var interactable = plinth.gameObject.AddComponent<Interactable>();
            interactable.id = site.archiveId;
            interactable.label = site.name;
            interactable.kind = "memorial_plinth";
            interactable.interaction = "listen";
            interactable.memorialId = site.id;
            interactable.title = site.name + " — " + site.city;
            interactable.body = site.narration;
            interactable.archiveIds = new[] { site.archiveId };
            interactable.focus = plinth;
            Interactables.Add(interactable);

            if (site.tour != null)
            {
                foreach (var stop in site.tour)
                {
                    var marker = new GameObject("TourStop_" + stop.id);
                    marker.transform.SetParent(ground, false);
                    marker.transform.localPosition = new Vector3(Random.Range(-6f, 6f), 0, Random.Range(-4f, 4f));
                    var stopInteractable = marker.AddComponent<Interactable>();
                    stopInteractable.id = site.id + "_" + stop.id;
                    stopInteractable.label = stop.label;
                    stopInteractable.title = stop.label;
                    stopInteractable.body = stop.text;
                    stopInteractable.kind = "tour_stop";
                    stopInteractable.interaction = "listen";
                    stopInteractable.memorialId = site.id;
                    stopInteractable.focus = marker.transform;
                    Interactables.Add(stopInteractable);
                }
            }

            BuildLighting(ground, 60f, 60f, 24f);
        }

        // ------------------------------------------------------------ exhibits
        public void BuildExhibit(Transform parent, ExhibitDef def)
        {
            var holder = new GameObject("Exhibit_" + def.id).transform;
            holder.SetParent(parent, false);
            holder.localPosition = ToVector3(def.position);
            holder.localEulerAngles = new Vector3(0, def.rotationY, 0);
            Vector3 size = def.size != null && def.size.Length >= 3 ? ToVector3(def.size) : new Vector3(1.6f, 1.6f, 0.8f);
            Transform focus = BuildExhibitGeometry(holder, def, size);

            var interactable = holder.gameObject.AddComponent<Interactable>();
            interactable.id = def.id;
            interactable.label = def.label;
            interactable.kind = def.kind;
            interactable.interaction = def.interaction;
            interactable.opensUI = def.opensUI;
            interactable.minigame = def.minigame;
            interactable.zone = def.zone;
            interactable.archiveIds = def.archiveIds;
            interactable.quizIds = def.quizIds;
            interactable.conceptIds = def.conceptIds;
            interactable.memorialIds = def.memorialIds;
            interactable.media = def.media;
            interactable.walkable = def.walkable;
            interactable.title = def.panel != null ? def.panel.title : def.label;
            interactable.body = def.panel != null ? def.panel.body : def.label;
            interactable.focus = focus != null ? focus : holder;
            Interactables.Add(interactable);
        }

        Transform BuildExhibitGeometry(Transform holder, ExhibitDef def, Vector3 size)
        {
            switch (def.kind)
            {
                case "timeline_wall":
                case "digital_timeline":
                    return Props.TimelineWall(holder, Materials, _content, size);
                case "guide_terminal": return Props.Station(holder, Materials, size, "ARCHIVE GUIDE");
                case "archive_kiosk":
                case "search_terminal": return Props.Station(holder, Materials, size, "DIGITAL ARCHIVE");
                case "quiz_kiosk": return Props.Station(holder, Materials, size, def.label);
                case "ai_terminal": return Props.Station(holder, Materials, size, "ARCHIVE GUIDE");
                case "minigame_station": return Props.Station(holder, Materials, size, def.label);
                case "scanning_station": return Props.Station(holder, Materials, size, "SCAN A MANUSCRIPT");
                case "magnifier_station": return Props.Station(holder, Materials, size, "MAGNIFIER");
                case "display_case":
                case "glass_display_case":
                case "vitrine": return Props.DisplayCase(holder, Materials, size);
                case "document_table":
                case "reading_table":
                case "reading_desk":
                case "constitution_table":
                case "map_table": return Props.Table(holder, Materials, size);
                case "panel":
                case "comparison_panel":
                case "article_wall":
                case "paired_extract":
                case "rights_wall": return Props.PanelWall(holder, Materials, size, def.label);
                case "media_wall":
                case "projection_screen":
                case "achievement_wall": return Props.ScreenWall(holder, Materials, size);
                case "audio_pillar": return Props.AudioPillar(holder, Materials, size);
                case "book_shelf":
                case "bookshelf": return Props.Bookshelf(holder, Materials, size, 1f);
                case "reconstruction_diorama": return Props.Diorama(holder, Materials, size, _content);
                case "final_challenge_dais":
                case "dais": return Props.Dais(holder, Materials, size);
                case "monument":
                case "plinth": return Props.Plinth(holder, Materials, Vector3.zero, def.label);
                default:
                    Debug.LogWarning($"[museum] exhibit kind '{def.kind}' ({def.id}) has no builder — "
                                     + "add it to MuseumBuilder.BuildExhibitGeometry or fix exhibits.json");
                    return Props.PanelWall(holder, Materials, size, def.label);
            }
        }

        IEnumerable<ExhibitDef> AllExhibits()
        {
            if (_content.exhibits != null && _content.exhibits.exhibits != null) return _content.exhibits.exhibits;
            return new ExhibitDef[0];
        }

        // ------------------------------------------------------------- shells
        Transform BuildShell(Transform parent, string title, HallSpec hall, Material[] palette, string style)
        {
            float width = hall.width, depth = hall.depth, height = hall.height;
            float thickness = hall.wallThickness > 0.01f ? hall.wallThickness : 0.4f;

            Box(parent, "Floor", new Vector3(width, 0.2f, depth), palette[0], new Vector3(0, -0.1f, 0));
            Box(parent, "Ceiling", new Vector3(width, 0.2f, depth), Materials.Ceiling, new Vector3(0, height + 0.1f, 0));
            Box(parent, "Wainscot", new Vector3(width * 0.99f, hall.wainscotHeight * 0.02f + 0.02f, depth * 0.99f),
                Materials.Wood, new Vector3(0, hall.wainscotHeight, 0));

            Box(parent, "Wall_Far", new Vector3(width, height, thickness), palette[1], new Vector3(0, height * 0.5f, depth * 0.5f));
            Box(parent, "Wall_Near", new Vector3(width, height, thickness), palette[1], new Vector3(0, height * 0.5f, -depth * 0.5f));
            Box(parent, "Wall_Left", new Vector3(thickness, height, depth), palette[1], new Vector3(-width * 0.5f, height * 0.5f, 0));
            Box(parent, "Wall_Right", new Vector3(thickness, height, depth), palette[1], new Vector3(width * 0.5f, height * 0.5f, 0));

            int strips = Mathf.Clamp(hall.skylightStrips, 0, 8);
            for (int i = 0; i < strips; i++)
            {
                float x = strips == 1 ? 0f : Mathf.Lerp(-width * 0.34f, width * 0.34f, i / (float)(strips - 1));
                Box(parent, "SkylightStrip", new Vector3(width * 0.1f, 0.12f, depth * 0.7f), Materials.Screen,
                    new Vector3(x, height - 0.06f, 0));
            }

            var banner = new GameObject("Title");
            banner.transform.SetParent(parent, false);
            banner.transform.localPosition = new Vector3(0, height - 1.1f, depth * 0.5f - 0.5f);
            var text = banner.AddComponent<TMPro.TextMeshPro>();
            text.text = title.ToUpperInvariant();
            text.fontSize = 0.9f;
            text.alignment = TMPro.TextAlignmentOptions.Center;
            text.color = new Color(0.83f, 0.69f, 0.29f);
            text.rectTransform.sizeDelta = new Vector3(width * 0.8f, 1.4f);

            Debug.Log($"[museum] built '{style}' room: {width} × {depth} × {height} m");
            return parent;
        }

        void BuildLighting(Transform parent, float width, float depth, float height)
        {
            var lighting = _content.MuseumLighting;
            var ambient = new GameObject("Ambient").AddComponent<Light>();
            ambient.type = LightType.Directional;
            ambient.color = ParseColor(MiniJson.GetString(lighting, "ambient", "#B8B4AC"), new Color(0.72f, 0.7f, 0.66f));
            ambient.intensity = MiniJson.GetFloat(lighting, "ambientIntensity", 0.55f);
            ambient.shadows = LightShadows.Soft;
            ambient.transform.SetParent(parent, false);
            ambient.transform.rotation = Quaternion.Euler(52f, -34f, 0);
            RoomLights.Add(ambient);

            bool bakedMobile = MiniJson.GetBool(lighting, "bakedOnMobile", true);
            int realtimeLimit = MiniJson.GetInt(lighting, "realtimeShadowLightsMobile", 1);
            var groups = MiniJson.GetArray(lighting, "spotGroups");
            if (groups == null)
            {
                var fill = new GameObject("Fill").AddComponent<Light>();
                fill.type = LightType.Point;
                fill.range = Mathf.Max(width, depth) * 0.6f;
                fill.intensity = 1.1f;
                fill.transform.SetParent(parent, false);
                fill.transform.localPosition = new Vector3(0, height * 0.45f, 0);
                RoomLights.Add(fill);
                return;
            }

            int shadowBudget = Application.isMobilePlatform ? Mathf.Max(0, realtimeLimit) : 4;
            foreach (var entry in groups)
            {
                var group = entry as Dictionary<string, object>;
                if (group == null) continue;
                int count = MiniJson.GetInt(group, "count", 1);
                float intensity = MiniJson.GetFloat(group, "intensity", 8f);
                float angle = MiniJson.GetFloat(group, "angleDeg", 34f);
                var positions = MiniJson.GetArray(group, "positions");
                var targets = MiniJson.GetArray(group, "targets");
                for (int i = 0; i < count; i++)
                {
                    var light = new GameObject($"Spot_{i}").AddComponent<Light>();
                    light.type = LightType.Spot;
                    light.spotAngle = Mathf.Clamp(angle * 2.2f, 30f, 120f);
                    light.intensity = Mathf.Clamp(intensity / 40f, 0.4f, 3f);
                    light.color = Color.white;
                    light.useColorTemperature = true;
                    light.colorTemperature = MiniJson.GetInt(lighting, "temperatureK", 3400);
                    light.shadows = shadowBudget-- > 0 && !(Application.isMobilePlatform && bakedMobile)
                        ? LightShadows.Soft : LightShadows.None;
                    light.transform.SetParent(parent, false);
                    var at = Vector3At(positions, i, new Vector3(0, height * 0.8f, 0));
                    var look = Vector3At(targets, i, new Vector3(0, 1.2f, 0));
                    light.transform.localPosition = at;
                    light.transform.localRotation = Quaternion.LookRotation((look - at).normalized, Vector3.up);
                    RoomLights.Add(light);
                }
            }
        }

        static Vector3 Vector3At(List<object> list, int index, Vector3 fallback)
        {
            if (list == null || index < 0 || index >= list.Count) return fallback;
            var inner = list[index] as List<object>;
            if (inner == null || inner.Count < 3) return fallback;
            return new Vector3(ToFloat(inner[0]), ToFloat(inner[1]), ToFloat(inner[2]));
        }

        static float ToFloat(object value)
        {
            if (value is double) return (float)(double)value;
            if (value is float) return (float)value;
            if (value is long) return (long)value;
            float parsed;
            return value != null && float.TryParse(value.ToString(), out parsed) ? parsed : 0f;
        }

        ZoneDef Zone(string id)
        {
            ZoneDef zone;
            return _content.ZonesById.TryGetValue(id, out zone) ? zone : null;
        }

        public IEnumerable<Interactable> InteractablesIn(string zoneId)
        {
            foreach (var item in Interactables)
                if (item.zone == zoneId) yield return item;
        }

        public void Clear()
        {
            Interactables.Clear();
            RoomLights.Clear();
            _doors.Clear();
            if (_root == null) return;
            for (int i = _root.childCount - 1; i >= 0; i--)
                SafeDestroy(_root.GetChild(i).gameObject);
        }

        /// <summary>
        /// Only one room is resident at a time: the previous room's geometry is
        /// released when a door is used, which is what keeps the memory profile
        /// flat on Android while walking through six galleries.
        /// </summary>
        public void Dispose()
        {
            Clear();
            if (_root != null) SafeDestroy(_root.gameObject);
        }

        static void SafeDestroy(Object victim)
        {
            if (victim == null) return;
            if (Application.isPlaying) Destroy(victim);
            else DestroyImmediate(victim);
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

        public static Vector3 ToVector3(float[] values)
            => values != null && values.Length >= 3 ? new Vector3(values[0], values[1], values[2]) : Vector3.zero;

        public static Color ParseColor(string hex, Color fallback)
        {
            Color colour;
            if (string.IsNullOrEmpty(hex) || !ColorUtility.TryParseHtmlString(hex.StartsWith("#") ? hex : "#" + hex, out colour))
                return fallback;
            return colour;
        }
    }
}
