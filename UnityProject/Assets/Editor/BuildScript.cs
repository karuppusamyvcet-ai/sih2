/* ==========================================================================
   BuildScript.cs — the two deliverables, from the command line.

   Tools/build.sh and .github/workflows/build-unity.yml both call these
   methods, so the interactive menu and CI produce identical artefacts:

     Heritage.Editor.BuildScript.BuildWindows   → Builds/Windows/AmbedkarDigitalHeritage.exe
     Heritage.Editor.BuildScript.BuildAndroid   → Builds/Android/AmbedkarDigitalHeritage.apk

   The content is generated before the player is built (character and museum),
   and the result is verified to exist and to be plausibly sized: a build that
   quietly produced nothing fails here instead of reaching a submission.
   ========================================================================== */

using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace Heritage.Editor
{
    public static class BuildScript
    {
        const string WindowsDirectory = "Builds/Windows";
        const string AndroidDirectory = "Builds/Android";
        const string ProductName = "AmbedkarDigitalHeritage";

        [MenuItem("Heritage/Build Windows x64")]
        public static void BuildWindows()
        {
            ProjectConfigurator.Configure(silent: true);
            GenerateContent();

            var options = new BuildPlayerOptions
            {
                scenes = new[] { SceneBuilder.ScenePath },
                locationPathName = Path.Combine(WindowsDirectory, ProductName + ".exe"),
                target = BuildTarget.StandaloneWindows64,
                options = BuildOptions.None
            };

            Debug.Log($"[build] Windows x64 → {options.locationPathName}");
            Report(BuildPipeline.BuildPlayer(options), options.locationPathName);
        }

        [MenuItem("Heritage/Build Android ARM64")]
        public static void BuildAndroid()
        {
            ProjectConfigurator.Configure(silent: true);
            GenerateContent();

            var options = new BuildPlayerOptions
            {
                scenes = new[] { SceneBuilder.ScenePath },
                locationPathName = Path.Combine(AndroidDirectory, ProductName + ".apk"),
                target = BuildTarget.Android,
                options = BuildOptions.None
            };

            Debug.Log($"[build] Android ARM64 → {options.locationPathName}");
            Report(BuildPipeline.BuildPlayer(options), options.locationPathName);
        }

        [MenuItem("Heritage/Generate Content (character + scene)")]
        public static void GenerateContent()
        {
            CharacterBuilder.BuildCharacter();
            SceneBuilder.BuildMuseumScene();
        }

        static void Report(BuildReport report, string path)
        {
            if (report == null)
            {
                Fail($"Unity returned no build report for {path}");
                return;
            }

            var summary = report.summary;
            if (summary.result != BuildResult.Succeeded)
            {
                Fail($"{summary.result} after {summary.totalTime.TotalSeconds:0.#}s — "
                     + $"{summary.totalErrors} error(s). See the editor log.");
                return;
            }

            var file = new FileInfo(path);
            if (!file.Exists || file.Length < 1024 * 512)
            {
                Fail($"the build reported success but {path} is missing or implausibly small");
                return;
            }

            Debug.Log($"[build] {summary.result}: {path} ({file.Length / (1024f * 1024f):0.#} MB, "
                      + $"{summary.totalTime.TotalSeconds:0.#}s)");
        }

        static void Fail(string message)
        {
            Debug.LogError($"[build] {message}");
            if (Application.isBatchMode) EditorApplication.Exit(1);
            throw new BuildFailedException(message);
        }
    }
}
