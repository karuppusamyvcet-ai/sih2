/* ==========================================================================
   CharacterAnimator.cs — the twenty-five clips from the specification.

   Each clip is a parametric pose (a function of time returning bone offsets),
   which is how the browser build animates the same character from the same
   numbers. Poses are *offsets from the A-pose bind* the factory sets, so the
   12° arm drop is preserved. Transitions are damped rather than cut, additive
   head/neck look-at is layered on top, and the seated clips move the root down
   and back.

   Clip list (character_spec.json → clipList):
   Idle_Breathe, Idle_Stand, Walk, Walk_Carry_Book, Run_FastWalk, Turn_Left,
   Turn_Right, Look_At_Exhibit, Point_At_Exhibit, Speak, Listen, Read_Standing,
   Examine_Manuscript, Interact_Press, Sit_Idle, Sit_Read, Door_Enter, Door_Exit,
   Greet, Think, Explain_Gesture, Take_Notes, Book_Open, Book_Close,
   Presentation_Lecture.
   ========================================================================== */

using System.Collections.Generic;
using UnityEngine;

namespace Heritage.Characters
{
    public struct AnimatorContext
    {
        public bool run;
        public float speed;
    }

    /// <summary>A pose is a set of bone offsets in degrees, plus root motion hints.</summary>
    public class Pose
    {
        public readonly Dictionary<string, Vector3> offsets = new Dictionary<string, Vector3>();
        public float rootY;
        public float bob;

        public Pose At(string bone, float x, float y, float z)
        {
            offsets[bone] = new Vector3(x, y, z);
            return this;
        }

        public Pose Root(float y) { rootY = y; return this; }
        public Pose Bob(float b) { bob = b; return this; }
    }

    public static class Clips
    {
        public delegate Pose Build(float t, AnimatorContext ctx);

        public static readonly string[] Names =
        {
            "Idle_Breathe", "Idle_Stand", "Walk", "Walk_Carry_Book", "Run_FastWalk",
            "Turn_Left", "Turn_Right", "Look_At_Exhibit", "Point_At_Exhibit", "Speak",
            "Listen", "Read_Standing", "Examine_Manuscript", "Interact_Press", "Sit_Idle",
            "Sit_Read", "Door_Enter", "Door_Exit", "Greet", "Think", "Explain_Gesture",
            "Take_Notes", "Book_Open", "Book_Close", "Presentation_Lecture"
        };

        public static readonly Dictionary<string, Build> All = new Dictionary<string, Build>
        {
            { "Idle_Breathe", (t, ctx) => new Pose()
                .At("Spine", 0.7f * Mathf.Sin(t * 1.1f), 0.5f * Mathf.Sin(t * 0.6f), 0)
                .At("Chest", -0.6f * Mathf.Sin(t * 1.1f + 0.4f), 0, 0)
                .At("Head", 0.5f * Mathf.Sin(t * 0.7f), 1.1f * Mathf.Sin(t * 0.32f), 0)
                .At("UpperArm_L", 0, 0, 0.8f * Mathf.Sin(t * 1.05f))
                .At("UpperArm_R", 0, 0, -0.8f * Mathf.Sin(t * 1.05f + 0.6f)) },

            { "Idle_Stand", (t, ctx) => new Pose()
                .At("Head", 0, 1.6f * Mathf.Sin(t * 0.28f), 0)
                .At("Spine", 0, 0.6f * Mathf.Sin(t * 0.2f), 0) },

            { "Walk", WalkCycle(7.2f, 24f, 30f, 18f, 14f, 8f, 1.5f, 0.018f) },

            { "Run_FastWalk", (t, ctx) =>
            {
                float p = t * 10.4f;
                return new Pose()
                    .At("UpperLeg_L", 38f * Mathf.Sin(p), 0, 0)
                    .At("UpperLeg_R", -38f * Mathf.Sin(p), 0, 0)
                    .At("LowerLeg_L", -Mathf.Max(0, 52f * Mathf.Sin(p - 0.6f)), 0, 0)
                    .At("LowerLeg_R", -Mathf.Max(0, -52f * Mathf.Sin(p - 0.6f)), 0, 0)
                    .At("Foot_L", 14f * Mathf.Sin(p + 0.5f), 0, 0)
                    .At("Foot_R", -14f * Mathf.Sin(p + 0.5f), 0, 0)
                    .At("UpperArm_L", -34f * Mathf.Sin(p), 0, 6f)
                    .At("UpperArm_R", 34f * Mathf.Sin(p), 0, -6f)
                    .At("LowerArm_L", -52f, 0, 0)
                    .At("LowerArm_R", -52f, 0, 0)
                    .At("Spine", 5f, 0, 0)
                    .At("Chest", 3f, 0, 0)
                    .At("Head", -3f, 0, 0)
                    .Bob(Mathf.Abs(Mathf.Sin(p)) * 0.035f);
            } },

            { "Walk_Carry_Book", (t, ctx) =>
            {
                float p = t * 6.6f;
                return new Pose()
                    .At("UpperLeg_L", 20f * Mathf.Sin(p), 0, 0)
                    .At("UpperLeg_R", -20f * Mathf.Sin(p), 0, 0)
                    .At("LowerLeg_L", -Mathf.Max(0, 26f * Mathf.Sin(p - 0.7f)), 0, 0)
                    .At("LowerLeg_R", -Mathf.Max(0, -26f * Mathf.Sin(p - 0.7f)), 0, 0)
                    .At("UpperArm_L", -62f, -18f, -34f)
                    .At("UpperArm_R", -62f, 18f, 34f)
                    .At("LowerArm_L", -72f, 0, -14f)
                    .At("LowerArm_R", -72f, 0, 14f)
                    .At("Spine", 2f, 0, 0)
                    .Bob(Mathf.Abs(Mathf.Sin(p)) * 0.014f);
            } },

            { "Turn_Left", (t, ctx) => new Pose()
                .At("Hips", 0, 18f, 0).At("Chest", 0, 14f, 0).At("Head", 0, 10f, 0) },

            { "Turn_Right", (t, ctx) => new Pose()
                .At("Hips", 0, -18f, 0).At("Chest", 0, -14f, 0).At("Head", 0, -10f, 0) },

            { "Look_At_Exhibit", (t, ctx) => new Pose()
                .At("Spine", -3f, 0, 0)
                .At("Chest", -4f, 0, 0)
                .At("Head", -9f, 0, 0)
                .At("UpperArm_L", -10f, 0, 2f)
                .At("UpperArm_R", -10f, 0, -2f) },

            { "Point_At_Exhibit", (t, ctx) => new Pose()
                .At("Spine", -2f, -8f, 0)
                .At("Chest", -3f, -6f, 0)
                .At("UpperArm_R", -78f, -16f, -8f)
                .At("LowerArm_R", -6f, 0, 0)
                .At("Hand_R", 0, 0, -8f)
                .At("UpperArm_L", 6f, 0, 0)
                .At("Head", -4f, -6f, 0) },

            { "Speak", (t, ctx) =>
            {
                float g = Mathf.Sin(t * 2.1f), g2 = Mathf.Sin(t * 3.3f + 1.2f);
                return new Pose()
                    .At("Spine", 1.2f * g, 2.4f * g, 0)
                    .At("Chest", 0.8f * g2, 0, 0)
                    .At("Head", 2f * g2, 4f * Mathf.Sin(t * 0.9f), 0)
                    .At("UpperArm_L", -16f - 10f * g, 0, 10f + 6f * g)
                    .At("UpperArm_R", -16f - 10f * g2, 0, -10f - 6f * g2)
                    .At("LowerArm_L", -46f - 16f * g, 0, 12f)
                    .At("LowerArm_R", -46f - 16f * g2, 0, -12f)
                    .At("Hand_L", 0, 0, 6f * g)
                    .At("Hand_R", 0, 0, -6f * g2);
            } },

            { "Listen", (t, ctx) => new Pose()
                .At("Spine", 2f, 3f, 0)
                .At("Chest", 1f, 2f, 0)
                .At("Head", 3f + 1.2f * Mathf.Sin(t * 0.8f), 6f, 2f)
                .At("UpperArm_L", 4f, 0, 4f)
                .At("UpperArm_R", -8f, 0, -6f)
                .At("LowerArm_R", -54f, 0, -10f) },

            { "Read_Standing", (t, ctx) => new Pose()
                .At("Spine", 6f, 0, 0)
                .At("Chest", 6f, 0, 0)
                .At("Head", 14f, 0, 0)
                .At("UpperArm_L", -58f, -12f, -30f)
                .At("UpperArm_R", -58f, 12f, 30f)
                .At("LowerArm_L", -66f, 0, -12f)
                .At("LowerArm_R", -66f, 0, 12f)
                .Bob(Mathf.Sin(t * 1.6f) * 0.002f) },

            { "Examine_Manuscript", (t, ctx) => new Pose()
                .At("Spine", 14f, 0, 0)
                .At("Chest", 10f, 0, 0)
                .At("Head", 20f, 3f * Mathf.Sin(t * 0.5f), 0)
                .At("UpperArm_L", -52f, -14f, -26f)
                .At("UpperArm_R", -58f, 14f, 30f)
                .At("LowerArm_L", -60f, 0, -10f)
                .At("LowerArm_R", -48f, 0, 6f)
                .At("UpperLeg_L", 4f, 0, 0)
                .At("UpperLeg_R", -3f, 0, 0) },

            { "Interact_Press", (t, ctx) =>
            {
                float reach = Mathf.Min(1f, t * 2.4f);
                return new Pose()
                    .At("Spine", -4f * reach, -6f * reach, 0)
                    .At("Chest", -3f * reach, 0, 0)
                    .At("UpperArm_R", -84f * reach, -10f * reach, -6f)
                    .At("LowerArm_R", -16f * reach, 0, 0)
                    .At("Hand_R", 10f * reach, 0, 0)
                    .At("UpperArm_L", 4f, 0, 0)
                    .At("Head", 4f * reach, -4f * reach, 0);
            } },

            { "Sit_Idle", (t, ctx) => Seated(t, true) },

            { "Sit_Read", (t, ctx) => Seated(t, false)
                .At("Spine", 10f, 0, 0)
                .At("Chest", 8f, 0, 0)
                .At("Head", 16f, 0, 0)
                .At("UpperArm_L", -56f, -10f, -22f)
                .At("UpperArm_R", -56f, 10f, 22f)
                .At("LowerArm_L", -64f, 0, -10f)
                .At("LowerArm_R", -64f, 0, 10f) },

            { "Door_Enter", (t, ctx) =>
            {
                float p = t * 6.4f;
                return new Pose()
                    .At("UpperLeg_L", 22f * Mathf.Sin(p), 0, 0)
                    .At("UpperLeg_R", -22f * Mathf.Sin(p), 0, 0)
                    .At("LowerLeg_L", -Mathf.Max(0, 26f * Mathf.Sin(p - 0.7f)), 0, 0)
                    .At("LowerLeg_R", -Mathf.Max(0, -26f * Mathf.Sin(p - 0.7f)), 0, 0)
                    .At("UpperArm_L", -14f * Mathf.Sin(p), 0, 6f)
                    .At("UpperArm_R", 14f * Mathf.Sin(p), 0, -6f)
                    .At("Spine", 3f, 0, 0)
                    .At("Head", -4f, 0, 0)
                    .Bob(Mathf.Abs(Mathf.Sin(p)) * 0.016f);
            } },

            { "Door_Exit", (t, ctx) =>
            {
                float p = t * 6.0f + 1.4f;
                return new Pose()
                    .At("UpperLeg_L", 20f * Mathf.Sin(p), 0, 0)
                    .At("UpperLeg_R", -20f * Mathf.Sin(p), 0, 0)
                    .At("Spine", 0, 6f, 0)
                    .At("Head", 0, 10f, 0)
                    .At("UpperArm_L", -12f * Mathf.Sin(p), 0, 4f)
                    .At("UpperArm_R", 12f * Mathf.Sin(p), 0, -4f)
                    .Bob(Mathf.Abs(Mathf.Sin(p)) * 0.014f);
            } },

            { "Greet", (t, ctx) =>
            {
                float wave = Mathf.Sin(t * 5.4f);
                return new Pose()
                    .At("UpperArm_R", -112f, 0, -16f)
                    .At("LowerArm_R", -46f + 16f * wave, 0, 10f * wave)
                    .At("Hand_R", 0, 0, 14f * wave)
                    .At("UpperArm_L", -8f, 0, 4f)
                    .At("Head", 3f, -6f, 0)
                    .At("Spine", 0, -5f, 0);
            } },

            { "Think", (t, ctx) => new Pose()
                .At("Spine", 3f, -4f, 0)
                .At("Chest", 2f, 0, 0)
                .At("Head", -6f + 2f * Mathf.Sin(t * 0.7f), -8f, -2f)
                .At("UpperArm_R", -64f, -20f, -28f)
                .At("LowerArm_R", -96f, 0, -16f)
                .At("Hand_R", 18f, 10f, 0)
                .At("UpperArm_L", 6f, 0, 6f)
                .At("LowerArm_L", -22f, 0, 0) },

            { "Explain_Gesture", (t, ctx) =>
            {
                float g = Mathf.Sin(t * 1.6f);
                return new Pose()
                    .At("Spine", 2f, 5f * g, 0)
                    .At("Chest", 1f, 0, 0)
                    .At("Head", 2f, 8f * g, 0)
                    .At("UpperArm_L", -46f - 14f * g, 0, 24f)
                    .At("LowerArm_L", -30f, 0, 24f)
                    .At("Hand_L", 0, 0, 18f * g)
                    .At("UpperArm_R", -30f + 12f * g, 0, -18f)
                    .At("LowerArm_R", -58f, 0, -14f);
            } },

            { "Take_Notes", (t, ctx) =>
            {
                float w = Mathf.Sin(t * 6.2f);
                return new Pose()
                    .At("Spine", 8f, 0, 0)
                    .At("Chest", 7f, 0, 0)
                    .At("Head", 17f, 2f, 0)
                    .At("UpperArm_L", -62f, -16f, -24f)
                    .At("LowerArm_L", -74f, 0, -12f)
                    .At("UpperArm_R", -54f, 14f, 20f)
                    .At("LowerArm_R", -70f + 5f * w, 0, 10f)
                    .At("Hand_R", 4f * w, 0, 0);
            } },

            { "Book_Open", (t, ctx) =>
            {
                float o = Mathf.Min(1f, t * 2.2f);
                return new Pose()
                    .At("Spine", 5f * o, 0, 0)
                    .At("Head", 10f * o, 0, 0)
                    .At("UpperArm_L", -56f * o, -14f * o, -26f * o)
                    .At("UpperArm_R", -56f * o, 14f * o, 26f * o)
                    .At("LowerArm_L", -62f * o, 0, -10f)
                    .At("LowerArm_R", -62f * o, 0, 10f);
            } },

            { "Book_Close", (t, ctx) =>
            {
                float o = 1f - Mathf.Min(1f, t * 2.6f);
                return new Pose()
                    .At("Spine", 5f * o, 0, 0)
                    .At("Head", 10f * o, 0, 0)
                    .At("UpperArm_L", -56f * o, 0, -26f * o)
                    .At("UpperArm_R", -56f * o, 0, 26f * o)
                    .At("LowerArm_L", -54f * o, 0, -10f)
                    .At("LowerArm_R", -54f * o, 0, 10f);
            } },

            { "Presentation_Lecture", (t, ctx) =>
            {
                float g = Mathf.Sin(t * 1.1f);
                return new Pose()
                    .At("Spine", 1f, -4f * g, 0)
                    .At("Chest", 1f, 0, 0)
                    .At("Head", 2f, -8f * g, 0)
                    .At("UpperArm_R", -58f - 10f * g, -8f, -14f)
                    .At("LowerArm_R", -24f, 0, 0)
                    .At("Hand_R", 0, 0, 6f * g)
                    .At("UpperArm_L", 8f, 0, 12f)
                    .At("LowerArm_L", -30f, 0, 8f);
            } },
        };

        static Build WalkCycle(float cadence, float stride, float knee, float arm, float elbow, float foot, float lean, float bob)
        {
            return (t, ctx) =>
            {
                float p = t * cadence;
                float amp = ctx.run ? 1.15f : 1f;
                return new Pose()
                    .At("UpperLeg_L", stride * amp * Mathf.Sin(p), 0, 0)
                    .At("UpperLeg_R", -stride * amp * Mathf.Sin(p), 0, 0)
                    .At("LowerLeg_L", -Mathf.Max(0, knee * amp * Mathf.Sin(p - 0.7f)), 0, 0)
                    .At("LowerLeg_R", -Mathf.Max(0, -knee * amp * Mathf.Sin(p - 0.7f)), 0, 0)
                    .At("Foot_L", foot * Mathf.Sin(p + 0.6f), 0, 0)
                    .At("Foot_R", -foot * Mathf.Sin(p + 0.6f), 0, 0)
                    .At("UpperArm_L", -arm * Mathf.Sin(p) * 0.9f, 0, 3f)
                    .At("UpperArm_R", arm * Mathf.Sin(p) * 0.9f, 0, -3f)
                    .At("LowerArm_L", -elbow - 8f * Mathf.Sin(p), 0, 0)
                    .At("LowerArm_R", -elbow - 8f * Mathf.Sin(p + Mathf.PI), 0, 0)
                    .At("Spine", lean, 4f * Mathf.Sin(p), 0)
                    .At("Chest", 0, 0, 2f * Mathf.Sin(p))
                    .At("Hips", 0, -3f * Mathf.Sin(p), 0)
                    .At("Head", 0, -2.5f * Mathf.Sin(p), 0)
                    .Bob(Mathf.Abs(Mathf.Sin(p)) * bob + (ctx.run ? 0.01f : 0));
            };
        }

        static Pose Seated(float t, bool idle)
        {
            var pose = new Pose()
                .Root(-0.47f)
                .At("UpperLeg_L", -84f, 4f, 0)
                .At("UpperLeg_R", -84f, -4f, 0)
                .At("LowerLeg_L", 80f, 0, 0)
                .At("LowerLeg_R", 80f, 0, 0)
                .At("Foot_L", 4f, 0, 0)
                .At("Foot_R", 4f, 0, 0);
            if (!idle) return pose;
            return pose
                .At("Spine", 4f + Mathf.Sin(t * 1.2f), 0, 0)
                .At("Chest", 2f, 0, 0)
                .At("Head", -2f + Mathf.Sin(t * 0.8f), 4f * Mathf.Sin(t * 0.3f), 0)
                .At("UpperArm_L", -24f, 0, 10f)
                .At("UpperArm_R", -24f, 0, -10f)
                .At("LowerArm_L", -56f, 0, 9f)
                .At("LowerArm_R", -56f, 0, -9f);
        }

        /// <summary>Clips that hold the book prop in the character's left hand.</summary>
        public static bool CarriesBook(string clip)
        {
            return clip == "Read_Standing" || clip == "Examine_Manuscript" || clip == "Walk_Carry_Book"
                || clip == "Sit_Read" || clip == "Take_Notes" || clip == "Book_Open" || clip == "Book_Close";
        }
    }

    public class CharacterAnimator : MonoBehaviour
    {
        public CharacterRig rig;

        public string current = "Idle_Breathe";
        public float blendSpeed = 5.5f;

        readonly Dictionary<string, Vector3> live = new Dictionary<string, Vector3>();
        readonly Dictionary<string, Quaternion> bind = new Dictionary<string, Quaternion>();
        float clipTime;
        float rootOffsetY;
        float lookYaw, lookPitch, lookWeight;
        bool carrying;

        public bool IsPlaying(string clip) { return current == clip; }

        public void Initialise(CharacterRig characterRig)
        {
            rig = characterRig;
            foreach (var pair in rig.bones)
            {
                bind[pair.Key] = pair.Value.localRotation;
                live[pair.Key] = Vector3.zero;
            }
        }

        /// <summary>Switch clip. Blends from the current pose unless restarted.</summary>
        public void Play(string name, float speed = 5.5f, bool restart = false)
        {
            if (!Clips.All.ContainsKey(name))
            {
                Debug.LogWarning($"[animator] unknown clip '{name}' — keeping {current}. "
                                 + "Add it to Clips.All or fix the caller.");
                return;
            }
            blendSpeed = speed;
            if (name == current && !restart) return;
            current = name;
            clipTime = 0f;
        }

        public void SetLook(float yawDegrees, float pitchDegrees, float weight)
        {
            lookYaw = yawDegrees;
            lookPitch = pitchDegrees;
            lookWeight += (weight - lookWeight) * 0.16f;
        }

        public void Tick(float dt, AnimatorContext ctx)
        {
            if (rig == null) return;
            clipTime += dt;
            var build = Clips.All[current];
            var target = build(clipTime, ctx);

            float targetRoot = target.rootY + target.bob;
            rootOffsetY += (targetRoot - rootOffsetY) * Mathf.Min(1f, dt * 6f);

            bool wantsBook = Clips.CarriesBook(current);
            if (wantsBook != carrying)
            {
                carrying = wantsBook;
                if (rig.book != null) rig.book.gameObject.SetActive(wantsBook);
            }

            float blend = Mathf.Min(1f, dt * blendSpeed);
            foreach (var pair in rig.bones)
            {
                Vector3 offset;
                if (!live.TryGetValue(pair.Key, out offset)) { offset = Vector3.zero; live[pair.Key] = offset; }
                Vector3 want;
                if (!target.offsets.TryGetValue(pair.Key, out want)) want = Vector3.zero;
                offset.x = Mathf.Lerp(offset.x, want.x, blend);
                offset.y = Mathf.Lerp(offset.y, want.y, blend);
                offset.z = Mathf.Lerp(offset.z, want.z, blend);
                live[pair.Key] = offset;
                pair.Value.localRotation = bind[pair.Key] * Quaternion.Euler(offset);
            }

            if (lookWeight > 0.01f)
            {
                var neck = rig.Bone("Neck");
                var head = rig.Bone("Head");
                if (neck != null) neck.localRotation *= Quaternion.Euler(0, lookYaw * 0.35f * lookWeight, 0);
                if (head != null)
                    head.localRotation *= Quaternion.Euler(lookPitch * 0.5f * lookWeight, lookYaw * 0.5f * lookWeight, 0);
            }

            var rootTransform = rig.root.transform;
            var local = rootTransform.localPosition;
            local.y += (rootOffsetY - local.y) * Mathf.Min(1f, dt * 8f);
            rootTransform.localPosition = local;
        }
    }
}
