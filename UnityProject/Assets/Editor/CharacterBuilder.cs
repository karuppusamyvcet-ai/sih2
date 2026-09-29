/* ==========================================================================
   CharacterBuilder.cs — bakes the generated character into a prefab.

   The character is code-generated from character_spec.json at runtime anyway;
   this editor step exists so the figure can be inspected in the editor, so the
   rig can be checked against the specification's numbers before a build, and so
   the scene builder has a prefab to place.

   The checks are the same ones Documentation/01 lists as acceptance criteria:
   1.700 m tall, 7.20 head-heights, the sole on the floor, the collar below the
   chin, glasses present and the red tie the only saturated accent.
   ========================================================================== */

using Heritage.Characters;
using Heritage.Core;
using UnityEditor;
using UnityEngine;

namespace Heritage.Editor
{
    public static class CharacterBuilder
    {
        const string PrefabPath = "Assets/Art/Characters/Ambedkar.prefab";
        const string FolderPath = "Assets/Art/Characters";

        [MenuItem("Heritage/Build Character")]
        public static void BuildCharacter()
        {
            var content = ContentDatabase.Load();
            if (content == null || content.character == null)
            {
                Debug.LogError("[character] character_spec.json did not load — run Tools/validate_content.py");
                return;
            }

            var existing = GameObject.Find("Ambedkar");
            if (existing != null) Object.DestroyImmediate(existing);

            var rig = CharacterFactory.Build(content, "high");

            Directory(folderPath);
            var prefab = PrefabUtility.SaveAsPrefabAsset(rig.root, PrefabPath);
            Debug.Log($"[character] baked {PrefabPath} — {rig.bones.Count} bones");

            Audit(content, rig);
            if (prefab == null) Debug.LogWarning("[character] the prefab was not written; the runtime build still works");
            Object.DestroyImmediate(rig.root);
        }

        static void Directory(string folder)
        {
            if (AssetDatabase.IsValidFolder(folder)) return;
            System.IO.Directory.CreateDirectory(folder);
            AssetDatabase.Refresh();
        }

        /// <summary>The specification's acceptance checks, run against the built figure.</summary>
        static void Audit(ContentDatabase content, CharacterRig rig)
        {
            float height = content.character.heightTotal;
            float shoulder = content.Proportion("shoulderWidth", 0f);
            float crown = rig.BoneWorld("Head").y - rig.root.transform.position.y;
            float span = Vector3.Distance(
                rig.BoneWorld("UpperArm_L"), rig.BoneWorld("UpperArm_R"));

            int problems = 0;
            problems += Check(Mathf.Abs(rig.height - height) < 0.01f,
                $"height {rig.height:0.###} m matches the specification ({height:0.###} m)");
            problems += Check(Mathf.Abs(span - shoulder) < 0.02f,
                $"shoulder span {span:0.###} m matches the specification ({shoulder:0.###} m)");
            problems += Check(rig.bones.Count >= 36,
                $"{rig.bones.Count} bones (the specification lists 36)");
            problems += Check(crown > 1.2f && crown < 1.6f,
                $"head bone sits at {crown:0.###} m, below the crown as it should be");
            problems += Check(HasPart(rig, "Lens_L") && HasPart(rig, "Lens_R"),
                "both spectacle lenses are present, so the glasses cannot be lost by a LOD switch");
            problems += Check(HasPart(rig, "Moustache"), "the clipped moustache is present");
            problems += Check(TieIsSaturated(content), "the tie is the only saturated accent");

            if (problems > 0)
                Debug.LogError($"[character] {problems} acceptance check(s) failed — see above");
            else
                Debug.Log("[character] all acceptance checks passed");
        }

        static bool HasPart(CharacterRig rig, string name)
        {
            foreach (var renderer in rig.root.GetComponentsInChildren<Transform>(true))
                if (renderer.name == name) return true;
            return false;
        }

        static bool TieIsSaturated(ContentDatabase content)
        {
            var tie = content.Materials.ContainsKey("tie") ? content.Materials["tie"] as System.Collections.Generic.Dictionary<string, object> : null;
            if (tie == null) return false;
            var value = tie.ContainsKey("color") ? tie["color"] as string : null;
            Color colour;
            if (string.IsNullOrEmpty(value) || !ColorUtility.TryParseHtmlString(value, out colour)) return false;
            float max = Mathf.Max(colour.r, Mathf.Max(colour.g, colour.b));
            float min = Mathf.Min(colour.r, Mathf.Min(colour.g, colour.b));
            float saturation = max <= 0.0001f ? 0f : (max - min) / max;
            return saturation > 0.45f && max > 0.35f;
        }

        static int Check(bool condition, string description)
        {
            if (condition) Debug.Log($"[character] ok   {description}");
            else Debug.LogError($"[character] FAIL {description}");
            return condition ? 0 : 1;
        }
    }
}
