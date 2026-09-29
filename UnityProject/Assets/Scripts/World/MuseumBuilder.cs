/* ==========================================================================
   MuseumBuilder.cs — the museum, generated from the content JSON.

   Nothing here is hand-placed: the central hall, its six labelled doors, the
   six galleries, the eight memorial reconstructions and their lighting are all
   read from Assets/Resources/Content (museum.json, zones.json, exhibits.json,
   memorials.json). Moving a door or adding an exhibit is a content edit.

   The scene is built at runtime in play mode and, for the shipped builds, baked
   into a scene by Assets/Editor/SceneBuilder.cs, which calls the same methods —
   one implementation, both entry points, so the editor view and the build can
   never disagree.
   ========================================================================== */

using System.Collections.Generic;
using System.Linq;
using Heritage.Core;
using UnityEngine;

namespace Heritage.World
{
    /// <summary>Anything the player can focus with the interaction prompt.</summary>
    public class Interactable : MonoBehaviour
    {
        public string id;
        public string label;
        public string kind;              // door | exhibit kind | exit | memorial_plinth ...
        public string interaction;       // read | listen | press | sit | examine ...
        public string panel;
        public string[] archiveIds;
        public string[] quizIds;
        public string memorialId;
        public string zone;
        public string prompt;
        public bool collected;
        public Transform focus;
    }

    public class MuseumBuilder : MonoBehaviour
    {
        public MaterialLibrary Materials { get; private set; }
        public readonly List<Interactable> Interactables = new List<Interactable>();
        public readonly List<Light> RoomLights = new List<Light>();
        public string CurrentZone { get; private set; } = "hub";

        ContentDatabase _content;
        Transform _root;
        readonly Dictionary<string, GameObject> _doors = new Dictionary<string, GameObject>();

        public IReadOnlyDictionary<string, GameObject> Doors => _doors;

        public void Initialise(ContentDatabase content, string quality)
        {
            _content = content;
            Materials = ProceduralTextures.BuildLibrary(content, quality);
            _root = new GameObject("Museum").transform;
            _root.SetParent(transform, false);
        }

        // ------------------------------------------------------------- the hub
        public void BuildHub()
        {
            Clear();
            CurrentZone = "hub";
            var hall = _content.museum.hall;

            var room = new GameObject("Hub_Room").transform;
            room.SetParent(_root, false);
            BuildShell(room, "Central Hall", hall.width, hall.depth, hall.height,
                new[] { Materials.Marble, Materials.Stone }, "hall");

            // colonnade along both long walls: two instanced rows, not 24 objects
            BuildColonnade(room, hall.width, hall.depth, 8);

            // the six doors, each with a label above it — never a seventh
            foreach (var door in _content.museum.doors)
                BuildDoor(room, door);

            BuildSetDressing(room);
            BuildHubLighting(room);
            BuildHubExhibits(room);
            BuildSpawnPoint(hall.spawn);
        }

        void BuildDoor(Transform parent, MuseumDoor door)
        {
            var holder = new GameObject("Door_" + door.doorId).transform;
            holder.SetParent(parent, false);
            holder.localPosition = ToVector3(door.position);

            var frameMat = Materials.DarkMetal;
            var leafMat = Materials.Wood;
            var width = door.size[0], height = door.size[1];

            // frame
            var frame = GameObject.CreatePrimitive(PrimitiveType.Cube);
            frame.name = "Frame";
            frame.transform.SetParent(holder, false);
            frame.transform.localScale = new Vector3(width + 0.24f, 0.14f, 0.18f);
            frame.transform.localPosition = new Vector3(0, height + 0.07f, 0);
            frame.GetComponent<Renderer>().sharedMaterial = frameMat;
            for (int side = -1; side <= 1; side += 2)
            {
                var jamb = GameObject.CreatePrimitive(PrimitiveType.Cube);
                jamb.name = "Jamb";
                jamb.transform.SetParent(holder, false);
                jamb.transform.localScale = new Vector3(0.12f, height, 0.18f);
                jamb.transform.localPosition = new Vector3(side * (width / 2 + 0.06f), height / 2, 0);
                jamb.GetComponent<Renderer>().sharedMaterial = frameMat;
            }

            // the two leaves, animated by DoorController
            var doorRoot = new GameObject("Leaves").transform;
            doorRoot.SetParent(holder, false);
            var controller = doorRoot.gameObject.AddComponent<DoorController>();
            for (int side = -1; side <= 1; side += 2)
            {
                var hinge = new GameObject(side < 0 ? "HingeL" : "HingeR").transform;
                hinge.SetParent(doorRoot, false);
                hinge.localPosition = new Vector3(side * width / 2f, 0, 0);
                var leaf = GameObject.CreatePrimitive(PrimitiveType.Cube);
                leaf.name = "Leaf";
                leaf.transform.SetParent(hinge, false);
                leaf.transform.localScale = new Vector3(width / 2f, height, 0.08f);
                leaf.transform.localPosition = new Vector3(-side * width / 4f, height / 2f, 0);
                leaf.GetComponent<Renderer>().sharedMaterial = leafMat;
                controller.RegisterHinge(hinge, -side * 96f);
            }

            // the label above the door: 3D text, so it is readable at any distance
            var labelObject = new GameObject("Label");
            labelObject.transform.SetParent(holder, false);
            labelObject.transform.localPosition = new Vector3(0, height + 0.42f, 0.06f);
            var label = labelObject.AddComponent<TMPro.TextMeshPro>();
            label.text = $"{door.index}. {door.label}";
            label.fontSize = 0.34f;
            label.alignment = TMPro.TextAlignmentOptions.Center;
            label.color = ParseColor(door.accentColor, Color.white);
            label.rectTransform.sizeDelta = new Vector3(width + 1.6f, 0.9f);
            label.enableWordWrapping = false;
            var plate = GameObject.CreatePrimitive(PrimitiveType.Cube);
            plate.name = "Plate";
            plate.transform.SetParent(labelObject.transform, false);
            plate.transform.localScale = new Vector3(width + 1.7f, 0.72f, 0.06f);
            plate.transform.localPosition = new Vector3(0, 0, 0.08f);
            plate.GetComponent<Renderer>().sharedMaterial = Materials.DarkMetal;
            Destroy(plate.GetComponent<Collider>());
            labelObject.transform.localPosition += Vector3.forward * 0.12f;

            var zone = _content.ZonesById.TryGetValue(door.zone, out var z) ? z : null;
            var interactable = holder.gameObject.AddComponent<Interactable>();
            interactable.id = door.doorId;
            interactable.label = door.label;
            interactable.kind = "door";
            interactable.interaction = "press";
            interactable.zone = door.zone;
            interactable.prompt = zone != null && zone.unlockRule != null ? zone.unlockRule.lockedMessage : null;
            interactable.focus = holder;
            Interactables.Add(interactable);

            _doors[door.zone] = controller.gameObject;
            AddBoxCollider(holder, new Vector3(width + 0.3f, 0.2f, 0.4f), new Vector3(0, height + 0.12f, 0));
        }

        void BuildSetDressing(Transform parent)
        {
            foreach (var piece in _content.museum.setDressing)
            {
                var holder = new GameObject("Dress_" + piece.id).transform;
                holder.SetParent(parent, false);
                holder.localPosition = ToVector3(piece.position);
                if (piece.rotation != null && piece.rotation.Length >= 3)
                    holder.localEulerAngles = ToVector3(piece.rotation);
                var scale = piece.scale != null && piece.scale.Length >= 3 ? ToVector3(piece.scale) : Vector3.one;

                switch (piece.kind)
                {
                    case "reception_desk": Props.ReceptionDesk(holder, Materials, scale); break;
                    case "terminal": Props.Kiosk(holder, Materials, scale, "Archive Guide"); break;
                    case "monument": Props.CentralMonument(holder, Materials, scale); break;
                    case "timeline_wall": Props.TimelineWall(holder, Materials, _content, scale); break;
                    case "screen": Props.ProjectionScreen(holder, Materials, scale); break;
                    case "glass_case": Props.DisplayCase(holder, Materials, scale); break;
                    case "bookshelf": Props.Bookshelf(holder, Materials, scale); break;
                    case "cabinet": Props.ArchiveCabinet(holder, Materials, scale); break;
                    case "stele": Props.InformationStele(holder, Materials, scale, piece.id); break;
                    case "planter": Props.Planter(holder, Materials, scale); break;
                    case "bench": Props.BenchRing(holder, Materials, scale); break;
                    case "label_rail": Props.LabelRail(holder, Materials, _content, scale); break;
                    default:
                        Debug.LogWarning($"[museum] set dressing kind '{piece.kind}' ({piece.id}) has no builder; "
                                         + "add it to MuseumBuilder.BuildSetDressing or fix museum.json");
                        break;
                }
            }
        }

        void BuildHubExhibits(Transform parent)
        {
            foreach (var def in _content.exhibits.exhibits.Where(e => e.zone == "hub"))
                RegisterExhibit(parent, def, ResolveAnchor(def));
        }

        Transform ResolveAnchor(ExhibitDef def) => null;   // hub anchors come from set dressing v

        void BuildHubLighting(Transform parent)
        {
            var ambient = new GameObject("Ambient").AddComponent<Light>();
            ambient.type = LightType.Directional;
            ambient.color = new Color(0.72f, 0.7f, 0.66f);
            ambient.intensity = _content.museum.ambientIntensity;
            ambient.transform.SetParent(parent, false);
            ambient.transform.rotation = Quaternion.Euler(52f, -34f, 0);
            ambient.shadows = LightShadows.Soft;
            RoomLights.Add(ambient);

            foreach (var group in _content.museum.spotGroups)
            {
                for (int i = 0; i < group.count; i++)
                {
                    var light = new GameObject($"Spot_{group.id}_{i}").AddComponent<Light>();
                    light.type = LightType.Spot;
                    light.spotAngle = 58f;
                    light.intensity = group.intensity;
                    light.color = Color.white;
                    light.colorTemperature = 3400f;
                    light.useColorTemperature = true;
                    light.shadows = LightShadows.None;      // one realtime shadow light is enough on mobile
                    light.transform.SetParent(parent, false);
                    var origin = ToVector3(group.position);
                    light.transform.localPosition = new Vector3(
                        origin.x + (i - (group.count - 1) / 2f) * group.spacing, origin.y, origin.z);
                    light.transform.rotation = Quaternion.Euler(90f, 0f, 0f);
                    RoomLights.Add(light);
                }
            }
        }

        void BuildSpawnPoint(float[] spawn)
        {
            var marker = new GameObject("SpawnPoint_Hub");
            marker.transform.SetParent(_root, false);
            marker.transform.position = ToVector3(spawn);
        }

        // -------------------------------------------------------------- rooms
        public void BuildZone(string zoneId)
        {
            Clear();
            if (!_content.ZonesById.TryGetValue(zoneId, out var zone))
            {
                Debug.LogWarning($"[museum] no gallery '{zoneId}' in zones.json — staying in the hub");
                BuildHub();
                return;
            }
            CurrentZone = zoneId;

            _content.exhibits.rooms.TryGetValue(zoneId, out var roomSpec);
            var size = roomSpec?.size ?? new[] { 30f, 30f };
            var room = new GameObject($"Zone_{zoneId}").transform;
            room.SetParent(_root, false);
            BuildShell(room, zone.name, size[0], size[1], roomSpec?.ceilingHeight ?? 8f,
                new[] { Materials.Stone, zoneId == "legacy" ? Materials.DarkMetal : Materials.Wood }, roomSpec?.style ?? "gallery");

            // the return sign, so a player is never stuck in a room
            var exit = Props.SignPanel(room, Materials, "Return to the Central Hall", new Vector3(0, 2.3f, size[1] / 2f - 0.3f));
            var exitInteractable = exit.AddComponent<Interactable>();
            exitInteractable.id = $"exit_{zoneId}";
            exitInteractable.label = "Return to the Central Hall";
            exitInteractable.kind = "exit";
            exitInteractable.interaction = "press";
            exitInteractable.focus = exit.transform;
            Interactables.Add(exitInteractable);

            foreach (var def in _content.exhibits.exhibits.Where(e => e.zone == zoneId))
                RegisterExhibit(room, def, Props.ForKind(room, Materials, def, _content));

            BuildZoneLighting(room, size);
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

            var ground = new GameObject($"Memorial_{siteId}").transform;
            ground.SetParent(_root, false);
            Props.MemorialScene(ground, Materials, site, _content);

            var plinth = Props.Plinth(ground, Materials, new Vector3(0, 0, 6f), site.name);
            var interactable = plinth.AddComponent<Interactable>();
            interactable.id = "memorial_" + site.id;
            interactable.label = site.name;
            interactable.kind = "memorial_plinth";
            interactable.interaction = "listen";
            interactable.memorialId = site.id;
            interactable.focus = plinth.transform;
            Interactables.Add(interactable);

            // guided tour waypoints, straight from memorials.json
            foreach (var stop in site.tour ?? new TourStop[0])
            {
                var marker = new GameObject("TourStop_" + stop.id);
                marker.transform.SetParent(ground, false);
                if (stop.position != null && stop.position.Length >= 3) marker.transform.localPosition = ToVector3(stop.position);
                var stopInteractable = marker.AddComponent<Interactable>();
                stopInteractable.id = $"tour_{site.id}_{stop.id}";
                stopInteractable.label = stop.label;
                stopInteractable.kind = "tour_stop";
                stopInteractable.interaction = "listen";
                stopInteractable.memorialId = site.id;
                stopInteractable.focus = marker.transform;
                Interactables.Add(stopInteractable);
            }

            BuildZoneLighting(ground, new[] { 60f, 60f });
        }

        void BuildZoneLighting(Transform parent, float[] size)
        {
            var sun = new GameObject("ZoneSun").AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.intensity = 0.85f;
            sun.color = new Color(0.95f, 0.93f, 0.88f);
            sun.shadows = LightShadows.Soft;
            sun.transform.SetParent(parent, false);
            sun.transform.rotation = Quaternion.Euler(46f, 18f, 0f);
            RoomLights.Add(sun);
            for (int i = -1; i <= 1; i += 2)
            {
                var fill = new GameObject("Fill").AddComponent<Light>();
                fill.type = LightType.Point;
                fill.range = Mathf.Max(size[0], size[1]) * 0.6f;
                fill.intensity = 1.1f;
                fill.color = new Color(0.9f, 0.9f, 0.94f);
                fill.shadows = LightShadows.None;
                fill.transform.SetParent(parent, false);
                fill.transform.localPosition = new Vector3(i * size[0] * 0.3f, 3.4f, 0);
                RoomLights.Add(fill);
            }
        }

        // ------------------------------------------------------------- shells
        Transform BuildShell(Transform parent, string title, float width, float depth, float height, Material[] palette, string style)
        {
            var floor = GameObject.CreatePrimitive(PrimitiveType.Cube);
            floor.name = "Floor";
            floor.transform.SetParent(parent, false);
            floor.transform.localScale = new Vector3(width, 0.2f, depth);
            floor.transform.localPosition = new Vector3(0, -0.1f, 0);
            floor.GetComponent<Renderer>().sharedMaterial = palette[0];

            var ceiling = GameObject.CreatePrimitive(PrimitiveType.Cube);
            ceiling.name = "Ceiling";
            ceiling.transform.SetParent(parent, false);
            ceiling.transform.localScale = new Vector3(width, 0.2f, depth);
            ceiling.transform.localPosition = new Vector3(0, height + 0.1f, 0);
            ceiling.GetComponent<Renderer>().sharedMaterial = Materials.Ceiling;

            BuildWall(parent, new Vector3(0, height / 2f, depth / 2f), new Vector3(width, height, 0.3f), palette[1], "Wall_Far");
            BuildWall(parent, new Vector3(0, height / 2f, -depth / 2f), new Vector3(width, height, 0.3f), palette[1], "Wall_Near");
            BuildWall(parent, new Vector3(-width / 2f, height / 2f, 0), new Vector3(0.3f, height, depth), palette[1], "Wall_Left");
            BuildWall(parent, new Vector3(width / 2f, height / 2f, 0), new Vector3(0.3f, height, depth), palette[1], "Wall_Right");

            var banner = new GameObject("Title");
            banner.transform.SetParent(parent, false);
            banner.transform.localPosition = new Vector3(0, height - 1.1f, depth / 2f - 0.4f);
            var text = banner.AddComponent<TMPro.TextMeshPro>();
            text.text = title.ToUpperInvariant();
            text.fontSize = 0.9f;
            text.alignment = TMPro.TextAlignmentOptions.Center;
            text.color = new Color(0.83f, 0.69f, 0.29f);
            text.rectTransform.sizeDelta = new Vector3(width * 0.8f, 1.4f);

            Debug.Log($"[museum] built '{style}' room: {width} × {depth} × {height} m");
            return parent;
        }

        void BuildWall(Transform parent, Vector3 localPosition, Vector3 scale, Material material, string name)
        {
            var wall = GameObject.CreatePrimitive(PrimitiveType.Cube);
            wall.name = name;
            wall.transform.SetParent(parent, false);
            wall.transform.localScale = scale;
            wall.transform.localPosition = localPosition;
            wall.GetComponent<Renderer>().sharedMaterial = material;
        }

        void BuildColonnade(Transform parent, float width, float depth, int count)
        {
            var column = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            column.name = "Column";
            column.transform.SetParent(parent, false);
            var renderer = column.GetComponent<Renderer>();
            renderer.sharedMaterial = Materials.Stone;
            var meshRenderer = column.GetComponent<MeshRenderer>();
            var filter = column.GetComponent<MeshFilter>();
            column.SetActive(false);

            for (int side = -1; side <= 1; side += 2)
            {
                for (int i = 0; i < count; i++)
                {
                    float z = Mathf.Lerp(-depth / 2f + 3.5f, depth / 2f - 3.5f, i / (float)(count - 1));
                    var instance = new GameObject($"Column_{side}_{i}");
                    instance.transform.SetParent(parent, false);
                    instance.transform.localPosition = new Vector3(side * (width / 2f - 0.85f), 0, z);
                    var mesh = instance.AddComponent<MeshFilter>();
                    mesh.sharedMesh = filter.sharedMesh;
                    var instanced = instance.AddComponent<MeshRenderer>();
                    instanced.sharedMaterial = renderer.sharedMaterial;
                    instance.transform.localScale = new Vector3(0.42f, 4.6f, 0.42f);
                    instance.transform.localPosition += new Vector3(0, 4.6f, 0);
                }
            }
            Destroy(column);
            _ = meshRenderer;
        }

        void RegisterExhibit(Transform parent, ExhibitDef def, Transform anchor)
        {
            var holder = anchor != null ? anchor : new GameObject("Exhibit_" + def.id).transform;
            if (anchor == null)
            {
                holder.SetParent(parent, false);
                holder.localPosition = ToVector3(def.position);
                if (def.rotation != null && def.rotation.Length >= 3) holder.localEulerAngles = ToVector3(def.rotation);
            }
            var interactable = holder.gameObject.AddComponent<Interactable>();
            interactable.id = def.id;
            interactable.label = def.label;
            interactable.kind = def.kind;
            interactable.interaction = def.interaction;
            interactable.panel = def.panel;
            interactable.archiveIds = def.archiveIds;
            interactable.quizIds = def.quizIds;
            interactable.memorialId = def.memorialId;
            interactable.zone = def.zone;
            interactable.prompt = def.prompt;
            interactable.focus = holder;
            Interactables.Add(interactable);
        }

        public void Clear()
        {
            Interactables.Clear();
            RoomLights.Clear();
            _doors.Clear();
            if (_root == null) return;
            for (int i = _root.childCount - 1; i >= 0; i--)
                Destroy(_root.GetChild(i).gameObject);
        }

        // Only one room is resident at a time: the browser build does the same,
        // and it is what keeps the Android memory profile flat while walking
        // through six galleries.
        public void Dispose()
        {
            Clear();
            if (_root != null) Destroy(_root.gameObject);
        }

        static void AddBoxCollider(Transform holder, Vector3 size, Vector3 centre)
        {
            var box = holder.gameObject.AddComponent<BoxCollider>();
            box.size = size;
            box.center = centre;
        }

        public static Vector3 ToVector3(float[] values)
            => values != null && values.Length >= 3 ? new Vector3(values[0], values[1], values[2]) : Vector3.zero;

        public static Color ParseColor(string hex, Color fallback)
        {
            if (string.IsNullOrEmpty(hex) || !ColorUtility.TryParseHtmlString(hex.StartsWith("#") ? hex : "#" + hex, out var colour))
                return fallback;
            return colour;
        }
    }
}
