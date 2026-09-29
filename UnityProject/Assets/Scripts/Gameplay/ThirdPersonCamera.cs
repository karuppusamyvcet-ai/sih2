/* ==========================================================================
   ThirdPersonCamera.cs — the camera the player actually steers.

   Third person, over the shoulder of the character: the brief's requirement.
   Obstacle avoidance is a sphere cast from the pivot to the desired position,
   so the camera slides in when a wall or a vitrine is behind the player instead
   of clipping through it. Mouse, touch drag and the right stick all feed the
   same yaw/pitch pair, and the pitch is clamped so the camera can never end up
   under the floor.
   ========================================================================== */

using UnityEngine;

namespace Heritage.Gameplay
{
    public class ThirdPersonCamera : MonoBehaviour
    {
        public Transform target;                 // the character root
        public Transform pivotOverride;          // usually a point at chest height
        public float distance = 3.4f;
        public float minDistance = 1.4f;
        public float maxDistance = 5.2f;
        public float height = 1.42f;
        public float minPitch = -32f;
        public float maxPitch = 58f;
        public float sensitivity = 2.6f;
        public float followSmoothing = 12f;
        public LayerMask collisionMask = ~0;
        public bool inspecting;

        float _yaw = 180f;
        float _pitch = 12f;
        Vector3 _smoothedPivot;
        float _currentDistance;

        public float Yaw => _yaw;
        public Quaternion PlanarRotation => Quaternion.Euler(0f, _yaw, 0f);

        public void Initialise(Transform characterRoot, float startYaw)
        {
            target = characterRoot;
            _yaw = startYaw;
            _pitch = 12f;
            _currentDistance = distance;
            _smoothedPivot = Pivot();
            Apply();
        }

        public void Orbiting(Vector2 look)
        {
            _yaw += look.x * sensitivity;
            _pitch = Mathf.Clamp(_pitch - look.y * sensitivity, minPitch, maxPitch);
        }

        public void Zoom(float delta) { distance = Mathf.Clamp(distance + delta, minDistance, maxDistance); }

        /// <summary>Used by the demo mode and the cinematic intro, which drive the camera themselves.</summary>
        public void SetOrbit(float yaw, float pitch, float newDistance)
        {
            _yaw = yaw;
            _pitch = Mathf.Clamp(pitch, minPitch, maxPitch);
            distance = Mathf.Clamp(newDistance, minDistance, maxDistance);
        }

        public void Tick(float dt, Vector2 look, float zoomDelta)
        {
            if (target == null) return;
            if (!inspecting)
            {
                Orbiting(look);
                Zoom(zoomDelta);
            }

            Vector3 pivot = Pivot();
            _smoothedPivot = Vector3.Lerp(_smoothedPivot, pivot, Mathf.Min(1f, dt * followSmoothing));
            Apply();
        }

        Vector3 Pivot() => target.position + Vector3.up * height;

        void Apply()
        {
            var rotation = Quaternion.Euler(_pitch, _yaw, 0f);
            Vector3 wanted = _smoothedPivot - rotation * Vector3.forward * distance;

            // obstacle avoidance: pull the camera in front of anything between it
            // and the pivot, with a small radius so thin props are respected
            RaycastHit hit;
            Vector3 direction = (wanted - _smoothedPivot).normalized;
            float reach = Vector3.Distance(wanted, _smoothedPivot);
            if (Physics.SphereCast(_smoothedPivot, 0.24f, direction, out hit, reach, collisionMask, QueryTriggerInteraction.Ignore))
            {
                if (hit.transform != target && !hit.transform.IsChildOf(target))
                    reach = Mathf.Max(minDistance * 0.6f, hit.distance - 0.08f);
            }
            _currentDistance = Mathf.Lerp(_currentDistance, reach, 0.5f);

            transform.position = _smoothedPivot - rotation * Vector3.forward * _currentDistance;
            transform.rotation = Quaternion.LookRotation(_smoothedPivot - transform.position, Vector3.up);
        }
    }
}
