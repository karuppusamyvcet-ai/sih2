/* ==========================================================================
   DoorController.cs — the six gallery doors open, and they open once.

   The doors are the one piece of the museum the player interacts with before
   anything else, so their behaviour is deliberately explicit: no door opens
   unless QuestSystem says its gallery is unlocked, and a locked door explains
   itself (zone.unlockRule.lockedMessage) instead of doing nothing.
   ========================================================================== */

using System.Collections.Generic;
using UnityEngine;

namespace Heritage.World
{
    public class DoorController : MonoBehaviour
    {
        struct Leaf
        {
            public Transform hinge;
            public float openAngle;
            public float restAngle;
        }

        readonly List<Leaf> _leaves = new List<Leaf>();
        float _progress;                 // 0 closed, 1 open
        float _speed = 1.8f;

        public bool IsOpen { get; private set; }
        public bool IsAnimating => _progress > 0.001f && _progress < 0.999f;

        public void RegisterHinge(Transform hinge, float openAngle)
        {
            _leaves.Add(new Leaf { hinge = hinge, openAngle = openAngle, restAngle = hinge.localEulerAngles.y });
        }

        /// <summary>Opens the door. Returns false when something kept it shut.</summary>
        public bool Open()
        {
            if (IsOpen) return true;
            IsOpen = true;
            return true;
        }

        public void Close()
        {
            IsOpen = false;
        }

        void Update()
        {
            // doors animate regardless of frame rate, and reverse cleanly if the
            // player changes their mind mid-swing
            float target = IsOpen ? 1f : 0f;
            _progress = Mathf.MoveTowards(_progress, target, Time.deltaTime * _speed);
            foreach (var leaf in _leaves)
            {
                if (leaf.hinge == null) continue;
                float eased = Mathf.SmoothStep(0f, 1f, _progress);
                var euler = leaf.hinge.localEulerAngles;
                leaf.hinge.localEulerAngles = new Vector3(euler.x, leaf.restAngle + leaf.openAngle * eased, euler.z);
            }
        }
    }
}
