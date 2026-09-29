/* ==========================================================================
   SceneBuilder.cs — bakes the museum into a scene.

   The game builds its world at runtime from the content JSON, so a scene file
   is never required; this editor step exists so the museum can be walked in the
   editor without pressing play, and so the player build has a scene to open.

   It deliberately uses the *same* MuseumBuilder the runtime uses, which is why
   the editor view and the build cannot drift apart: one implementation, two
   entry points.

   Re-run Heritage ▸ Build Museum Scene after any content change — it rebuilds
   the scene from scratch rather than patching it.
   ========================================================================== */

using System.Collections.Generic;
using Heritage.Core;
using Heritage.World;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Heritage.Editor
{
    public static class SceneBuilder
    {
        public const string ScenePath = "Assets/Scenes/MuseumHub.unity";
        const string SceneFolder = "Assets/Scenes";

        [MenuItem("Heritage/Build Museum Scene")]
        public static void BuildMuseumScene()
        {
            var content = ContentDatabase.Load();
            if (content == null || content.museum == null)
            {
                Debug.LogError("[scene] museum.json did not load — run Tools/validate_content.py before building");
                return;
            }

            if (!AssetDatabase.IsValidFolder(SceneFolder))
            {
                System.IO.Directory.CreateDirectory(SceneFolder);
                AssetDatabase.Refresh();
            }

            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            var museum = new GameObject("Museum");
            var builder = museum.AddComponent<MuseumBuilder>();
            builder.Initialise(content, "high");
            builder.BuildHub();

            var camera = new GameObject("PreviewCamera").AddComponent<Camera>();
            camera.tag = "MainCamera";
            camera.transform.position = new Vector3(0, 2.2f, -14f);
            camera.transform.rotation = Quaternion.Euler(6f, 0f, 0f);
            camera.fieldOfView = 60f;

            var light = new GameObject("SceneLight").AddComponent<Light>();
            light.type = LightType.Directional;
            light.intensity = 0.7f;
            light.transform.rotation = Quaternion.Euler(50f, -30f, 0);

            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
            RenderSettings.ambientLight = new Color(0.30f, 0.29f, 0.27f);

            EditorSceneManager.MarkSceneDirty(scene);
            EditorSceneManager.SaveScene(scene, ScenePath);
            RegisterInBuildSettings();
            AssetDatabase.SaveAssets();

            Debug.Log($"[scene] {ScenePath} rebuilt: {builder.Interactables.Count} interactables, "
                      + $"{content.museum.doors.Length} doors");
        }

        static void RegisterInBuildSettings()
        {
            var scenes = new List<EditorBuildSettingsScene>(EditorBuildSettings.scenes);
            foreach (var entry in scenes)
                if (entry.path == ScenePath) return;
            scenes.Insert(0, new EditorBuildSettingsScene(ScenePath, true));
            EditorBuildSettings.scenes = scenes.ToArray();
            Debug.Log($"[scene] {ScenePath} added as the first scene in Build Settings");
        }
    }
}
