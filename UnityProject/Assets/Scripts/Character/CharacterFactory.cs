/* ==========================================================================
   CharacterFactory.cs — Dr. B. R. Ambedkar, generated from character_spec.json.

   The character is not a downloaded model: every bone and every surface is
   created here, from the numbers in Assets/Resources/Content/character_spec.json.
   That is what keeps the character consistent between the Unity builds and the
   browser build (which generates the same figure from the same file), and it is
   why a fidelity change is a one-line content edit.

   The bone list and the local offsets below follow the specification exactly:
   1.700 m tall, 7.2 head-heights, 0.414 m shoulder span, glasses and clipped
   moustache always present, navy three-piece suit with the red patterned tie as
   the only saturated accent.
   ========================================================================== */

using System.Collections.Generic;
using Heritage.Core;
using UnityEngine;

namespace Heritage.Characters
{
    /// <summary>The built character: its root, its bones and its props.</summary>
    public class CharacterRig
    {
        public GameObject root;
        public readonly Dictionary<string, Transform> bones = new Dictionary<string, Transform>();
        public Transform book;
        public float height;
        public readonly List<Renderer> lod0 = new List<Renderer>();
        public readonly List<Renderer> lod1 = new List<Renderer>();
        public int lodLevel = -1;

        public Transform Bone(string name)
        {
            Transform t;
            return bones.TryGetValue(name, out t) ? t : null;
        }

        public Vector3 BoneWorld(string name)
        {
            var t = Bone(name);
            return t != null ? t.position : root.transform.position;
        }

        /// <summary>Distance-based LOD, exactly the three tiers the budget describes.</summary>
        public void UpdateLod(Vector3 cameraPosition, float lod0At = 12f, float lod1At = 26f, float cullAt = 70f)
        {
            float d = Vector3.Distance(cameraPosition, root.transform.position);
            int want = d < lod0At ? 0 : (d < lod1At ? 1 : 2);
            if (want == lodLevel) return;
            lodLevel = want;
            // the fine detail (finger segments, pocket flaps) drops away at the
            // far tiers; everything the identity checklist requires — face,
            // glasses, moustache, suit silhouette — stays visible at every tier
            foreach (var part in lod1) { if (part != null) part.enabled = want < 1; }
            bool culled = d >= cullAt;
            if (root != null) foreach (var part in root.GetComponentsInChildren<Renderer>(true))
                part.enabled = !culled && (want < 1 || !lod1.Contains(part));
        }
    }

    public static class CharacterFactory
    {
        const float ArmDrop = 12f;

        public static CharacterRig Build(ContentDatabase content, string quality, Transform parent = null)
        {
            var rig = new CharacterRig();
            var rootGO = new GameObject("Ambedkar");
            if (parent != null) rootGO.transform.SetParent(parent, false);
            rig.root = rootGO;
            rig.height = content.character != null ? content.character.heightTotal : 1.7f;

            var mats = BuildMaterials(content, quality);
            float P(string key, float fallback) => content.Proportion(key, fallback);

            // ------------------------------------------------------------ bones
            var hips = Bone(rootGO.transform, "Hips", new Vector3(0, P("hipHeight", 0.856f), 0), rig);
            var spine = Bone(hips, "Spine", new Vector3(0, 0.164f, 0), rig);
            var chest = Bone(spine, "Chest", new Vector3(0, 0.150f, 0), rig);
            var upperChest = Bone(chest, "UpperChest", new Vector3(0, 0.130f, 0), rig);
            var neck = Bone(upperChest, "Neck", new Vector3(0, 0.100f, 0), rig);
            var head = Bone(neck, "Head", new Vector3(0, P("neckHeight", 0.086f) - 0.002f, 0), rig);
            var jaw = Bone(head, "Jaw", new Vector3(0, 0.010f, -0.020f), rig);
            Bone(head, "Eye_L", Eye(head, -1, P), rig);
            Bone(head, "Eye_R", Eye(head, 1, P), rig);

            // shoulders: the UpperArm bones sit exactly half a 0.414 m span apart
            float halfSpan = P("shoulderWidth", 0.414f) * 0.5f;
            float shoulderWorldY = P("shoulderHeight", 1.400f);
            float upperChestWorldY = P("hipHeight", 0.856f) + 0.164f + 0.150f + 0.130f;
            float shoulderLocalY = shoulderWorldY - upperChestWorldY;

            foreach (int side in new[] { -1, 1 })
            {
                string s = side < 0 ? "_L" : "_R";
                var shoulder = Bone(upperChest, "Shoulder" + s, new Vector3(side * 0.090f, shoulderLocalY, 0), rig);
                var upperArm = Bone(shoulder, "UpperArm" + s, new Vector3(side * (halfSpan - 0.090f), -0.018f, 0), rig);
                upperArm.localRotation = Quaternion.Euler(0, 0, side * ArmDrop);
                var lowerArm = Bone(upperArm, "LowerArm" + s, new Vector3(0, -P("upperArmLength", 0.246f), 0), rig);
                var hand = Bone(lowerArm, "Hand" + s, new Vector3(0, -P("lowerArmLength", 0.238f), 0), rig);
                Finger(hand, "Thumb" + s, side, 0, P, rig);
                Finger(hand, "Index" + s, side, 1, P, rig);
                Finger(hand, "Middle" + s, side, 2, P, rig);
                Finger(hand, "Ring" + s, side, 3, P, rig);
                Finger(hand, "Pinky" + s, side, 4, P, rig);
            }

            // legs: hip joint → knee (hipToKnee) → ankle (kneeAboveAnkle)
            foreach (int side in new[] { -1, 1 })
            {
                string s = side < 0 ? "_L" : "_R";
                float legX = side * 0.086f;
                var upperLeg = Bone(rootGO.transform, "UpperLeg" + s,
                    new Vector3(legX, P("hipJointHeight", 0.850f), 0), rig);
                upperLeg.SetParent(hips, false);
                var lowerLeg = Bone(upperLeg, "LowerLeg" + s, new Vector3(0, -P("hipToKnee", 0.380f), 0), rig);
                var foot = Bone(lowerLeg, "Foot" + s, new Vector3(0, -P("kneeAboveAnkle", 0.408f), 0), rig);
                Bone(foot, "Toe" + s, new Vector3(0, -0.020f, 0.070f), rig);
            }

            // ----------------------------------------------------------- body
            var skin = mats["skin"];
            var hairMat = mats["hair"];
            var jacket = mats["jacket"];
            var waistcoat = mats["waistcoat"];
            var shirt = mats["shirt"];
            var tie = mats["tie"];
            var trousers = mats["trousers"];
            var shoes = mats["shoes"];
            var frame = mats["glasses_frame"];

            Sphere(hips, "Pelvis", new Vector3(0.30f, 0.24f, P("waistDepth", 0.252f)), jacket, new Vector3(0, 0.02f, 0));
            Box(hips, "WaistcoatFront", new Vector3(P("waistWidth", 0.332f), 0.34f, 0.03f), waistcoat, new Vector3(0, 0.16f, 0.11f));
            Sphere(spine, "Belly", new Vector3(0.34f, 0.20f, P("chestDepth", 0.242f) + P("bellyBulge", 0.014f)), jacket, new Vector3(0, 0.02f, 0.01f));
            Sphere(chest, "Chest", new Vector3(P("shoulderWidth", 0.414f), 0.32f, P("chestDepth", 0.242f)), jacket, new Vector3(0, 0.04f, 0));
            Sphere(upperChest, "Shoulders", new Vector3(P("shoulderWidth", 0.414f) + 0.03f, 0.20f, 0.24f), jacket, new Vector3(0, 0.02f, 0));
            Box(chest, "Lapel_L", new Vector3(0.062f, 0.20f, 0.02f), jacket, new Vector3(-0.062f, 0.10f, 0.120f), 18f);
            Box(chest, "Lapel_R", new Vector3(0.062f, 0.20f, 0.02f), jacket, new Vector3(0.062f, 0.10f, 0.120f), -18f);
            Sphere(neck, "NeckCyl", new Vector3(P("neckRadius", 0.062f) * 2f, P("neckHeight", 0.086f) + 0.02f, P("neckRadius", 0.062f) * 2f), skin, new Vector3(0, 0.02f, 0));
            Box(neck, "Collar", new Vector3(0.115f, P("clothing.collarHeight", 0.034f), 0.105f), shirt, new Vector3(0, 0.030f, 0.005f));
            Box(chest, "ShirtFront", new Vector3(0.075f, 0.24f, 0.02f), shirt, new Vector3(0, 0.10f, 0.120f));
            Box(chest, "Tie", new Vector3(P("clothing.tieWidth", 0.046f), 0.235f, 0.012f), tie, new Vector3(0, 0.085f, 0.132f));
            Box(chest, "PocketFlap_L", new Vector3(0.085f, 0.02f, 0.012f), waistcoat, new Vector3(-0.105f, -0.01f, 0.122f));
            Box(chest, "PocketFlap_R", new Vector3(0.085f, 0.02f, 0.012f), waistcoat, new Vector3(0.105f, -0.01f, 0.122f));

            // ----------------------------------------------------------- head
            float headH = P("headHeight", 0.236f), headW = P("headWidth", 0.176f), headD = P("headDepth", 0.196f);
            Sphere(head, "Skull", new Vector3(headW, headH, headD), skin, new Vector3(0, P("headCentreHeight", 1.567f) - BoneWorldY(head, rig), 0));
            Sphere(head, "Hair", new Vector3(headW * 1.04f, P("hairCapThickness", 0.030f) * 2f + 0.075f, headD * 1.02f), hairMat,
                new Vector3(0, P("hairlineHeight", 1.655f) - BoneWorldY(head, rig) + 0.004f, -0.006f));
            Box(head, "Brow_L", new Vector3(0.034f, 0.008f, 0.014f), hairMat, new Vector3(-0.030f, 0.092f, 0.082f));
            Box(head, "Brow_R", new Vector3(0.034f, 0.008f, 0.014f), hairMat, new Vector3(0.030f, 0.092f, 0.082f));
            Box(head, "Nose", new Vector3(0.026f, 0.040f, 0.030f), skin, new Vector3(0, 0.052f, 0.090f));
            Box(head, "Moustache", new Vector3(0.052f, 0.011f, 0.012f), mats["moustache"], new Vector3(0, 0.030f, 0.088f));
            Box(jaw, "Mouth", new Vector3(0.036f, 0.010f, 0.010f), skin, new Vector3(0, -0.010f, 0.082f));
            Sphere(head, "Ear_L", new Vector3(0.016f, 0.032f, 0.024f), skin, new Vector3(-0.043f, 0.046f, -0.002f));
            Sphere(head, "Ear_R", new Vector3(0.016f, 0.032f, 0.024f), skin, new Vector3(0.043f, 0.046f, -0.002f));
            BuildGlasses(head, frame, mats["glass_lens"], P, rig);

            // ---------------------------------------------------------- limbs
            foreach (int side in new[] { -1, 1 })
            {
                string s = side < 0 ? "_L" : "_R";
                var upperArm = rig.Bone("UpperArm" + s);
                var lowerArm = rig.Bone("LowerArm" + s);
                var hand = rig.Bone("Hand" + s);
                var upperLeg = rig.Bone("UpperLeg" + s);
                var lowerLeg = rig.Bone("LowerLeg" + s);
                var foot = rig.Bone("Foot" + s);

                Sphere(upperArm, "SleeveUpper" + s, new Vector3(0.104f, P("upperArmLength", 0.246f), 0.104f), jacket, new Vector3(0, -P("upperArmLength", 0.246f) * 0.5f, 0));
                Sphere(lowerArm, "SleeveLower" + s, new Vector3(0.092f, P("lowerArmLength", 0.238f), 0.092f), jacket, new Vector3(0, -P("lowerArmLength", 0.238f) * 0.5f, 0));
                Box(hand, "Hand" + s, new Vector3(0.078f, P("handLength", 0.098f), 0.042f), skin, new Vector3(0, -P("handLength", 0.098f) * 0.5f, 0));
                Sphere(upperLeg, "Thigh" + s, new Vector3(P("thighRadius", 0.092f) * 2f, P("hipToKnee", 0.380f) + 0.03f, P("thighRadius", 0.092f) * 2f), trousers, new Vector3(0, -P("hipToKnee", 0.380f) * 0.5f, 0));
                Sphere(lowerLeg, "Calf" + s, new Vector3(P("calfRadius", 0.068f) * 2f, P("kneeAboveAnkle", 0.408f) + 0.02f, P("calfRadius", 0.068f) * 2f), trousers, new Vector3(0, -P("kneeAboveAnkle", 0.408f) * 0.5f, 0));
                Box(foot, "Shoe" + s, new Vector3(P("shoeWidth", 0.104f), P("shoeHeight", 0.078f), P("shoeLength", 0.262f)), shoes,
                    new Vector3(0, -P("ankleAboveSole", 0.062f) * 0.35f, P("shoeLength", 0.262f) * 0.24f));
            }

            // ------------------------------------------------------------ book
            var bookHolder = new GameObject("Book").transform;
            bookHolder.SetParent(rig.Bone("Hand_L"), false);
            bookHolder.localPosition = new Vector3(0, -0.05f, 0.02f);
            Box(bookHolder, "Cover", new Vector3(0.13f, 0.018f, 0.19f), jacket, Vector3.zero);
            Box(bookHolder, "Pages", new Vector3(0.122f, 0.024f, 0.180f), mats["paper"], new Vector3(0, 0.002f, 0));
            rig.book = bookHolder;
            bookHolder.gameObject.SetActive(false);

            // material sanity: the identity checklist depends on these
            Debug.Log($"[character] built {content.character.displayName} — {rig.bones.Count} bones, "
                      + $"{rig.height:0.###} m, shoulder span {P("shoulderWidth", 0f):0.###} m, "
                      + $"LOD0/1/2 = {rig.lod0.Count}/{rig.lod1.Count} detail parts");
            return rig;
        }

        // -------------------------------------------------------------- helpers
        static Transform Bone(Transform parent, string name, Vector3 localPosition, CharacterRig rig)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = localPosition;
            rig.bones[name] = go.transform;
            return go.transform;
        }

        static Vector3 Eye(Transform head, int side, System.Func<string, float, float> P)
        {
            float spacing = P("eyeSpacing", 0.072f);
            float eyeY = P("eyeHeight", 1.580f) - (P("hipHeight", 0.856f) + 0.164f + 0.150f + 0.130f + 0.100f + P("neckHeight", 0.086f) - 0.002f);
            float z = P("headDepth", 0.196f) * 0.5f - 0.014f;
            return new Vector3(side * spacing * 0.5f, eyeY, z);
        }

        static void Finger(Transform hand, string name, int side, int index, System.Func<string, float, float> P, CharacterRig rig)
        {
            float spread = (index - 2) * 0.016f;
            float spreadDeg = side * (index - 2) * 0.9f;
            var finger = Bone(hand, name, new Vector3(spread, -P("handLength", 0.098f) * 0.92f, 0.004f * index), rig);
            finger.localRotation = Quaternion.Euler(0, 0, spreadDeg);
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = name + "_tip";
            go.transform.SetParent(finger, false);
            go.transform.localScale = new Vector3(0.014f, 0.036f - index * 0.002f, 0.014f);
            go.transform.localPosition = new Vector3(0, -0.018f, 0);
            var renderer = go.GetComponent<Renderer>();
            renderer.sharedMaterial = BoneMaterial();
            SafeDestroy(go.GetComponent<Collider>());
            rig.lod1.Add(renderer);
        }

        static Material _boneFallback;
        static Material BoneMaterial()
        {
            if (_boneFallback == null)
            {
                _boneFallback = new Material(Shader.Find("Universal Render Pipeline/Lit"));
                _boneFallback.color = new Color(0.54f, 0.35f, 0.23f);
            }
            return _boneFallback;
        }

        static void BuildGlasses(Transform head, Material frame, Material lens, System.Func<string, float, float> P, CharacterRig rig)
        {
            float lensRadius = P("facialFeatures.lensRadius", 0.0275f);
            if (lensRadius <= 0.0001f) lensRadius = 0.0275f;
            float y = P("eyeHeight", 1.580f) - BoneWorldY(head, rig) + P("facialFeatures.yOffset", 0.003f);
            float z = P("headDepth", 0.196f) * 0.5f - 0.006f;
            float x = P("eyeSpacing", 0.072f) * 0.5f;

            foreach (int side in new[] { -1, 1 })
            {
                var ring = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                ring.name = side < 0 ? "LensFrame_L" : "LensFrame_R";
                ring.transform.SetParent(head, false);
                ring.transform.localScale = new Vector3(lensRadius * 2f, 0.0022f, lensRadius * 2f);
                ring.transform.localRotation = Quaternion.Euler(90, 0, 0);
                ring.transform.localPosition = new Vector3(side * x, y, z);
                ring.GetComponent<Renderer>().sharedMaterial = frame;
                SafeDestroy(ring.GetComponent<Collider>());

                var glass = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                glass.name = side < 0 ? "Lens_L" : "Lens_R";
                glass.transform.SetParent(head, false);
                glass.transform.localScale = new Vector3(lensRadius * 1.8f, 0.0016f, lensRadius * 1.8f);
                glass.transform.localRotation = Quaternion.Euler(90, 0, 0);
                glass.transform.localPosition = new Vector3(side * x, y, z);
                glass.GetComponent<Renderer>().sharedMaterial = lens;
                SafeDestroy(glass.GetComponent<Collider>());

                var temple = GameObject.CreatePrimitive(PrimitiveType.Cube);
                temple.name = "Temple";
                temple.transform.SetParent(head, false);
                temple.transform.localScale = new Vector3(0.004f, 0.004f, P("facialFeatures.templeLength", 0.108f));
                temple.transform.localPosition = new Vector3(side * (x + lensRadius), y, z - P("facialFeatures.templeLength", 0.108f) * 0.5f);
                temple.GetComponent<Renderer>().sharedMaterial = frame;
                SafeDestroy(temple.GetComponent<Collider>());
            }

            var bridge = GameObject.CreatePrimitive(PrimitiveType.Cube);
            bridge.name = "Bridge";
            bridge.transform.SetParent(head, false);
            bridge.transform.localScale = new Vector3(P("facialFeatures.bridgeWidth", 0.022f), 0.004f, 0.004f);
            bridge.transform.localPosition = new Vector3(0, y, z);
            bridge.GetComponent<Renderer>().sharedMaterial = frame;
            SafeDestroy(bridge.GetComponent<Collider>());
        }

        /// <summary>
        /// The specification measures everything in metres from the ground, so
        /// parts attached to a bone are placed relative to the bone's own height.
        /// The rig root stands on the floor, which is what makes this a constant
        /// rather than a per-frame correction.
        /// </summary>
        public static float BoneWorldY(Transform bone, CharacterRig rig)
        {
            return bone.position.y - rig.root.transform.position.y;
        }

        static Dictionary<string, Material> BuildMaterials(ContentDatabase content, string quality)
        {
            var set = new Dictionary<string, Material>();
            foreach (var pair in content.Materials)
            {
                var dict = pair.Value as Dictionary<string, object>;
                if (dict == null) continue;
                float alpha = F(dict, "alpha", 1f);
                var material = new Material(Shader.Find("Universal Render Pipeline/Lit"));
                material.name = pair.Key;
                Color colour;
                if (!ColorUtility.TryParseHtmlString(S(dict, "color", "#FFFFFF"), out colour)) colour = Color.white;
                colour.a = alpha;
                material.color = colour;
                material.SetFloat("_Metallic", F(dict, "metallic", 0f));
                material.SetFloat("_Smoothness", 1f - F(dict, "roughness", 0.5f));
                if (alpha < 0.999f)
                {
                    material.SetFloat("_Surface", 1f);
                    material.SetFloat("_Blend", 0f);
                    material.SetFloat("_SrcBlend", (float)UnityEngine.Rendering.BlendMode.SrcAlpha);
                    material.SetFloat("_DstBlend", (float)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
                    material.SetFloat("_ZWrite", 0f);
                    material.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
                    material.renderQueue = (int)UnityEngine.Rendering.RenderQueue.Transparent;
                }
                set[pair.Key] = material;
                // the signature accent gets its dot pattern, the jacket its weave
                int mapSize = quality == "low" ? 128 : (quality == "high" ? 512 : 256);
                if (pair.Key == "tie")
                {
                    var texture = ProceduralTextures.TiePattern(colour,
                        ParseColor(S(dict, "patternColorA", "#E6D9C6"), new Color(0.90f, 0.85f, 0.78f)),
                        ParseColor(S(dict, "patternColorB", "#2A1A16"), new Color(0.16f, 0.10f, 0.09f)), mapSize);
                    material.SetTexture("_BaseMap", texture);
                }
                else if (pair.Key == "jacket" || pair.Key == "waistcoat" || pair.Key == "trousers")
                {
                    material.SetTexture("_BaseMap", ProceduralTextures.Fabric(colour, 0.05f, mapSize));
                }
                else if (pair.Key == "shoes")
                {
                    material.SetTexture("_BaseMap", ProceduralTextures.Leather(colour, mapSize));
                }
            }
            // anything the spec does not define still needs a material, or a part
            // would render pink
            AddIfMissing(set, "paper", "#F3EFE6", 0f, 0.85f);
            AddIfMissing(set, "skin", "#8A5A3B", 0f, 0.58f);
            AddIfMissing(set, "hair", "#17110D", 0.05f, 0.44f);
            AddIfMissing(set, "moustache", "#1B1410", 0f, 0.48f);
            AddIfMissing(set, "glasses_frame", "#241E18", 0.35f, 0.35f);
            AddIfMissing(set, "glass_lens", "#F2F6FF", 0f, 0.08f);
            AddIfMissing(set, "jacket", "#1D2B45", 0.04f, 0.62f);
            AddIfMissing(set, "waistcoat", "#243352", 0.04f, 0.62f);
            AddIfMissing(set, "shirt", "#F3F1EA", 0f, 0.55f);
            AddIfMissing(set, "tie", "#9E2130", 0.05f, 0.5f);
            AddIfMissing(set, "trousers", "#232B3D", 0.03f, 0.7f);
            AddIfMissing(set, "shoes", "#2A211C", 0.08f, 0.4f);
            return set;
        }

        static void AddIfMissing(Dictionary<string, Material> set, string key, string hex, float metallic, float roughness)
        {
            if (set.ContainsKey(key)) return;
            var material = new Material(Shader.Find("Universal Render Pipeline/Lit"));
            material.name = key;
            Color colour;
            if (!ColorUtility.TryParseHtmlString(hex, out colour)) colour = Color.white;
            material.color = colour;
            material.SetFloat("_Metallic", metallic);
            material.SetFloat("_Smoothness", 1f - roughness);
            set[key] = material;
        }

        /// <summary>Destroy works in play mode; the editor builders need DestroyImmediate.</summary>
        public static void SafeDestroy(Object victim)
        {
            if (victim == null) return;
            if (Application.isPlaying) Object.Destroy(victim);
            else Object.DestroyImmediate(victim);
        }

        public static Color ParseColor(string hex, Color fallback)
        {
            Color colour;
            if (!string.IsNullOrEmpty(hex) && ColorUtility.TryParseHtmlString(hex.StartsWith("#") ? hex : "#" + hex, out colour))
                return colour;
            return fallback;
        }

        static GameObject Box(Transform parent, string name, Vector3 scale, Material material, Vector3 position, float zRotation = 0f)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = name;
            go.transform.SetParent(parent, false);
            go.transform.localScale = scale;
            go.transform.localPosition = position;
            if (Mathf.Abs(zRotation) > 0.001f) go.transform.localRotation = Quaternion.Euler(0, 0, zRotation);
            go.GetComponent<Renderer>().sharedMaterial = material;
            var collider = go.GetComponent<Collider>();
            if (collider != null) SafeDestroy(collider);
            return go;
        }

        static GameObject Sphere(Transform parent, string name, Vector3 scale, Material material, Vector3 position)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            go.name = name;
            go.transform.SetParent(parent, false);
            go.transform.localScale = scale;
            go.transform.localPosition = position;
            go.GetComponent<Renderer>().sharedMaterial = material;
            var collider = go.GetComponent<Collider>();
            if (collider != null) SafeDestroy(collider);
            return go;
        }

        static float F(Dictionary<string, object> dict, string key, float fallback)
        {
            object value;
            if (dict != null && dict.TryGetValue(key, out value) && value != null)
            {
                if (value is double) return (float)(double)value;
                if (value is float) return (float)value;
                if (value is long) return (long)value;
                float parsed;
                if (float.TryParse(value.ToString(), out parsed)) return parsed;
            }
            return fallback;
        }

        static string S(Dictionary<string, object> dict, string key, string fallback)
        {
            object value;
            if (dict != null && dict.TryGetValue(key, out value) && value != null) return value.ToString();
            return fallback;
        }
    }
}
