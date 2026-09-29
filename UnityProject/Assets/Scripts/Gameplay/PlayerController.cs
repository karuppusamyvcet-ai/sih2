/* ==========================================================================
   PlayerController.cs — walking the museum as Dr. Ambedkar.

   Movement is deliberately calm: a walk, a purposeful stride when the player
   holds run, and no combat, jumping or violence anywhere in the design. The
   controller owns four states — free, focused (an exhibit is in reach),
   engaged (a panel is open, input is suspended) and seated — and it tells the
   animator which clip belongs to each, so the character on screen always
   matches what the player can actually do.
   ========================================================================== */

using Heritage.Characters;
using UnityEngine;

namespace Heritage.Gameplay
{
    [RequireComponent(typeof(CharacterController))]
    public class PlayerController : MonoBehaviour
    {
        public const float WalkSpeed = 2.6f;
        public const float RunSpeed = 4.6f;
        public const float InteractRange = 2.7f;
        public const float TurnRate = 620f;

        public CharacterAnimator animator;
        public Camera viewCamera;
        public Transform head;

        public bool frozen;
        public float speed { get; private set; }

        CharacterController _controller;
        Vector3 _velocity;

        public Vector3 Position => transform.position;
        public bool Moving => speed > 0.05f;

        void Awake()
        {
            _controller = GetComponent<CharacterController>();
            if (viewCamera == null) viewCamera = Camera.main;
            if (head == null) head = transform;
        }

        public void Configure(CharacterController controller, CharacterAnimator characterAnimator, Camera camera)
        {
            _controller = controller;
            animator = characterAnimator;
            viewCamera = camera;
        }

        public void Teleport(Vector3 position, float yaw)
        {
            _controller.enabled = false;
            transform.position = position;
            transform.rotation = Quaternion.Euler(0, yaw, 0);
            _controller.enabled = true;
            _velocity = Vector3.zero;
        }

        /// <summary>
        /// Called every frame by the GameManager with the polled input. Focus and
        /// interaction are handled by InteractionSystem, which knows the museum.
        /// </summary>
        public void Tick(float dt, InputRouter input)
        {
            if (frozen)
            {
                speed = 0f;
                if (animator != null && !animator.IsPlaying("Idle_Stand")) animator.Play("Idle_Breathe");
                return;
            }

            Vector3 forward = Vector3.forward, right = Vector3.right;
            if (viewCamera != null)
            {
                forward = viewCamera.transform.forward;
                forward.y = 0f;
                forward.Normalize();
                right = viewCamera.transform.right;
                right.y = 0f;
                right.Normalize();
            }

            Vector3 desired = (forward * input.move.y + right * input.move.x);
            if (desired.sqrMagnitude > 1f) desired.Normalize();

            float target = input.run ? RunSpeed : WalkSpeed;
            speed = Mathf.MoveTowards(speed, desired.magnitude * target, dt * 9f);

            if (desired.sqrMagnitude > 0.0004f)
            {
                var wanted = Quaternion.LookRotation(desired, Vector3.up);
                transform.rotation = Quaternion.RotateTowards(transform.rotation, wanted, dt * TurnRate);
            }

            if (_controller.isGrounded) _velocity.y = -1.5f;
            else _velocity.y += -18f * dt;

            Vector3 motion = transform.forward * speed + Vector3.up * _velocity.y;
            _controller.Move(motion * dt);

            DriveAnimator(input);
        }

        void DriveAnimator(InputRouter input)
        {
            if (animator == null) return;
            var context = new AnimatorContext { run = input.run, speed = speed };

            // state clips chosen by systems take priority while they are playing;
            // locomotion only claims the character when it is moving
            string wanted = "Idle_Breathe";
            if (speed > WalkSpeed + 0.25f) wanted = "Run_FastWalk";
            else if (speed > 0.12f) wanted = input.run ? "Walk_Carry_Book" : "Walk";

            if (!animator.IsPlaying(wanted) && IsLocomotion(animator.current)) animator.Play(wanted);
            animator.Tick(Time.deltaTime, context);
        }

        static bool IsLocomotion(string clip)
        {
            return clip == "Idle_Breathe" || clip == "Idle_Stand" || clip == "Walk"
                || clip == "Walk_Carry_Book" || clip == "Run_FastWalk";
        }
    }
}
