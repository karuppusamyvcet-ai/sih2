/* ==========================================================================
   InteractionSystem.cs — "Press E to Interact", on both platforms.

   The museum publishes a list of Interactables (doors, vitrines, kiosks,
   stelae, plinths). This system decides which one the player is offering to
   use — in reach and roughly in front, or standing inside a walkable exhibit
   like the Mahad diorama — and reports it to the HUD so the prompt names the
   thing rather than saying "object".

   The Android INTERACT button and the E key both arrive here, so the prompt,
   the animation and the quest event are identical whichever one is used.
   ========================================================================== */

using System.Collections.Generic;
using Heritage.World;
using UnityEngine;

namespace Heritage.Gameplay
{
    public class InteractionSystem : MonoBehaviour
    {
        public MuseumBuilder museum;
        public PlayerController player;
        public InputRouter input;
        public float reach = PlayerController.InteractRange;
        public float facingCosine = 0.42f;          // about 65° either side
        public float walkableRadius = 1.4f;

        public Interactable Focused { get; private set; }
        public string PromptText { get; private set; }

        public System.Action<Interactable> onFocusChanged;
        public System.Action<Interactable> onTriggered;

        public void Configure(MuseumBuilder builder, PlayerController controller, InputRouter router)
        {
            museum = builder;
            player = controller;
            input = router;
        }

        public void Tick()
        {
            if (museum == null || player == null)
            {
                SetFocus(null);
                return;
            }

            Interactable best = null;
            float bestScore = float.MaxValue;
            Vector3 origin = player.Position;
            Vector3 forward = player.transform.forward;

            var list = museum.Interactables;
            for (int i = 0; i < list.Count; i++)
            {
                var candidate = list[i];
                if (candidate == null || candidate.focus == null) continue;
                Vector3 delta = candidate.focus.position - origin;
                float distance = delta.magnitude;
                bool walkable = distance <= walkableRadius && candidate.kind != "door";
                if (!walkable && distance > reach) continue;

                float alignment = distance < 0.0001f ? 1f : Vector3.Dot(forward, delta / distance);
                if (!walkable && alignment < facingCosine) continue;

                // walkable exhibits win outright; otherwise prefer what is centred
                float score = walkable ? distance * 0.25f : (1f - alignment) * 10f + distance;
                if (score < bestScore)
                {
                    bestScore = score;
                    best = candidate;
                }
            }

            SetFocus(best);
        }

        void SetFocus(Interactable candidate)
        {
            if (Focused == candidate) return;
            Focused = candidate;
            PromptText = candidate == null ? null : PromptFor(candidate);
            if (onFocusChanged != null) onFocusChanged(candidate);
        }

        public string PromptFor(Interactable target)
        {
            string verb;
            switch (target.interaction)
            {
                case "read": verb = "Read"; break;
                case "examine": verb = "Examine"; break;
                case "listen": verb = "Listen"; break;
                case "search": verb = "Search the archive"; break;
                case "ask": verb = "Ask the Archive Guide"; break;
                case "sit": verb = "Sit and reflect"; break;
                case "book": verb = "Open the book"; break;
                case "notes": verb = "Take notes"; break;
                default: verb = "Interact"; break;
            }
            if (target.kind == "door") return $"Open — {target.label}";
            if (target.kind == "exit") return target.label;
            return $"{verb} — {target.label}";
        }

        /// <summary>Runs when the interact key or button is pressed.</summary>
        public bool Trigger()
        {
            if (Focused == null) return false;
            var target = Focused;
            if (onTriggered != null) onTriggered(target);
            return true;
        }

        /// <summary>Used by the on-screen ARCHIVE/MAP buttons, which are not world objects.</summary>
        public static bool IsUiAction(Interactable target, string kind)
        {
            return target != null && target.kind == kind;
        }

        public IReadOnlyList<Interactable> All => museum != null ? (IReadOnlyList<Interactable>)museum.Interactables : new List<Interactable>();
    }
}
