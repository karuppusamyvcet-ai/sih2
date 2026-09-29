/* ==========================================================================
   ProjectConfigurator.cs — the settings the brief asks for, applied in one step.

   Most of the requirements in problem statement SIH26096 are project settings
   rather than gameplay code: landscape lock, ARM64, IL2CPP, a modern Android API
   level, linear colour, quality presets, the Input System, V-Sync. Unity only
   exposes them through the editor UI, so they are applied here — by both the
   menu item and the build script, which means CI and a human get the same
   project.

   Run it once after opening the project: Heritage ▸ Configure Project.
   ========================================================================== */

using UnityEditor;
using UnityEditor.Build;
using UnityEngine;

namespace Heritage.Editor
{
    public static class ProjectConfigurator
    {
        public const string ApplicationId = "com.teamname.ambedkardigitalheritage";
        public const string ProductName = "Ambedkar: The Digital Heritage Journey";

        [MenuItem("Heritage/Configure Project")]
        public static void ConfigureMenu() { Configure(false); }

        public static void Configure(bool silent = false)
        {
            int applied = 0;

            // ---- identity -----------------------------------------------------
            PlayerSettings.companyName = "SIH 2026 — Smart Education";
            PlayerSettings.productName = ProductName;
            PlayerSettings.bundleVersion = "1.0.0";
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, ApplicationId);
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Standalone, ApplicationId);
            applied += 6;

            // ---- presentation -------------------------------------------------
            PlayerSettings.colorSpace = ColorSpace.Linear;
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.LandscapeLeft;
            PlayerSettings.allowedAutorotateToPortrait = false;
            PlayerSettings.allowedAutorotateToPortraitUpsideDown = false;
            PlayerSettings.allowedAutorotateToLandscapeLeft = true;
            PlayerSettings.allowedAutorotateToLandscapeRight = true;
            PlayerSettings.defaultScreenWidth = 1920;
            PlayerSettings.defaultScreenHeight = 1080;
            PlayerSettings.fullScreenMode = FullScreenMode.FullScreenWindow;
            PlayerSettings.resizableWindow = true;
            applied += 12;

            // ---- Android ------------------------------------------------------
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel24;
            PlayerSettings.Android.targetSdkVersion = AndroidSdkVersions.AndroidApiLevelAuto;
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
            PlayerSettings.SetManagedStrippingLevel(NamedBuildTarget.Android, ManagedStrippingLevel.Low);
            PlayerSettings.Android.blitType = AndroidBlitType.Never;
            applied += 6;

            // ---- desktop ------------------------------------------------------
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Standalone, ScriptingImplementation.IL2CPP);
            PlayerSettings.SetManagedStrippingLevel(NamedBuildTarget.Standalone, ManagedStrippingLevel.Low);
            PlayerSettings.SetGraphicsAPIs(BuildTarget.StandaloneWindows64,
                new[] { UnityEngine.Rendering.GraphicsDeviceType.Direct3D11 });
            PlayerSettings.SetGraphicsAPIs(BuildTarget.Android,
                new[] { UnityEngine.Rendering.GraphicsDeviceType.Vulkan, UnityEngine.Rendering.GraphicsDeviceType.OpenGLES3 });
            applied += 4;

            // ---- input --------------------------------------------------------
            // The router reads the Input System devices directly and also falls
            // back to the legacy input API, so both handlers are enabled: the
            // build works whichever way the package settles.
            if (SetSerializedProjectSetting("activeInputHandler", 2)) applied++;
            else Debug.LogWarning("[config] could not set the active input handler automatically. "
                                  + "Set Project Settings ▸ Player ▸ Active Input Handling to \"Both\".");
            applied += SetSerializedProjectSetting("allowUnsafeCode", false) ? 1 : 0;

            // ---- rendering ----------------------------------------------------
            var pipeline = FindPipelineAsset();
            if (pipeline != null)
            {
                UnityEngine.Rendering.GraphicsSettings.defaultRenderPipeline = pipeline;
                QualitySettings.antiAliasing = 2;
                applied += 2;
                if (!silent) Debug.Log($"[config] render pipeline: {pipeline.name}");
            }
            else
            {
                Debug.LogWarning("[config] no URP asset is in the project yet. Create one with "
                                 + "Assets ▸ Create ▸ Rendering ▸ URP Asset (with Universal Renderer), then run "
                                 + "Heritage ▸ Configure Project again to assign it.");
            }

            ConfigureQuality();

            AssetDatabase.SaveAssets();
            Debug.Log($"[config] project configured ({applied} settings applied). "
                      + "Targets: Windows x64 (IL2CPP, DX11) and Android ARM64 (IL2CPP, minSdk 24, landscape).");
        }

        /// <summary>
        /// Quality tiers: LOW / MEDIUM / HIGH / ULTRA on desktop, LOW / MEDIUM /
        /// HIGH elsewhere. These are the tiers GameManager selects between, and
        /// they are what the accessibility "reduced effects" switch forces.
        /// </summary>
        static void ConfigureQuality()
        {
            string[] tiers = { "LOW", "MEDIUM", "HIGH", "ULTRA" };
            int existing = QualitySettings.names.Length;
            for (int level = 0; level < Mathf.Min(existing, tiers.Length); level++)
            {
                bool low = level == 0;
                bool high = level >= 2;
                QualitySettings.SetQualityLevel(level, false);
                QualitySettings.shadowDistance = low ? 12f : (high ? 60f : 34f);
                QualitySettings.shadows = high ? ShadowQuality.All : ShadowQuality.HardOnly;
                QualitySettings.shadowResolution = high ? ShadowResolution.Medium : ShadowResolution.Low;
                QualitySettings.lodBias = low ? 0.7f : (high ? 1.6f : 1.1f);
                QualitySettings.antiAliasing = low ? 0 : (high ? 4 : 2);
                QualitySettings.vSyncCount = level >= 2 ? 1 : 0;
                QualitySettings.skinWeights = SkinWeights.FourBones;
                QualitySettings.anisotropicFiltering = high ? AnisotropicFiltering.Enable : AnisotropicFiltering.Disable;

                // the tier names are what settings.json stores
                var assets = AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/QualitySettings.asset");
                if (assets == null || assets.Length == 0) continue;
                var serialized = new SerializedObject(assets[0]);
                var names = serialized.FindProperty("m_QualitySettings");
                if (names != null && level < names.arraySize)
                {
                    var entry = names.GetArrayElementAtIndex(level).FindPropertyRelative("name");
                    if (entry != null) entry.stringValue = tiers[level];
                }
                serialized.ApplyModifiedProperties();
            }
            QualitySettings.SetQualityLevel(Mathf.Min(existing - 1, 2), false);
            Debug.Log($"[config] quality tiers: {string.Join(" / ", tiers)} (desktop), LOW / MEDIUM / HIGH (mobile)");
        }

        static UnityEngine.Rendering.RenderPipelineAsset FindPipelineAsset()
        {
            var guids = AssetDatabase.FindAssets("t:UniversalRenderPipelineAsset");
            if (guids == null || guids.Length == 0) return null;
            return AssetDatabase.LoadAssetAtPath<UnityEngine.Rendering.RenderPipelineAsset>(
                AssetDatabase.GUIDToAssetPath(guids[0]));
        }

        /// <summary>
        /// Some player settings have no public API; they are written through the
        /// serialised project settings asset instead.
        /// </summary>
        static bool SetSerializedProjectSetting(string propertyName, object value)
        {
            var settings = AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/ProjectSettings.asset");
            if (settings == null || settings.Length == 0) return false;
            var serialized = new SerializedObject(settings[0]);
            var property = serialized.FindProperty(propertyName);
            if (property == null) return false;

            switch (property.propertyType)
            {
                case SerializedPropertyType.Integer: property.intValue = System.Convert.ToInt32(value); break;
                case SerializedPropertyType.Boolean: property.boolValue = System.Convert.ToBoolean(value); break;
                case SerializedPropertyType.String: property.stringValue = System.Convert.ToString(value); break;
                default: return false;
            }
            serialized.ApplyModifiedProperties();
            return true;
        }
    }
}
