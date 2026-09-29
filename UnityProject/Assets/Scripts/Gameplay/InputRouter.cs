/* ==========================================================================
   InputRouter.cs — one place where keyboard, mouse, gamepad and touch meet.

   The brief requires the Input System package, and the game is played with a
   mouse on PC and with on-screen buttons and a look-drag on Android. Rather
   than ship a generated action asset, the router reads the device APIs
   directly: that keeps the scheme visible in code, lets the same build run on
   desktop and mobile, and avoids a binary asset that could drift from the
   controls the documentation promises.

   The on-screen buttons do not bypass this class — they call the Set* methods,
   so a virtual INTERACT press is indistinguishable from the E key downstream.
   ========================================================================== */

using UnityEngine;

#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

namespace Heritage.Gameplay
{
    public class InputRouter : MonoBehaviour
    {
        public Vector2 move;
        public Vector2 look;
        public bool run;
        public bool interactHeld;
        public bool interactPressed;
        public bool archivePressed;
        public bool mapPressed;
        public bool guidePressed;
        public bool objectivesPressed;
        public bool pausePressed;
        public bool backPressed;
        public bool submitPressed;
        public bool cancelPressed;
        public bool skipPressed;
        public float pointerX;
        public float pointerY;
        public bool pointerDown;
        public bool pointerPressed;
        public bool usingTouch;

        Vector2 _virtualMove;
        bool _virtualRun;
        bool _virtualInteract;
        Vector2 _touchStart;
        bool _touchDragging;
        bool _touchConsumed;

        public void SetVirtualMove(Vector2 value) { _virtualMove = value; }
        public void SetVirtualRun(bool value) { _virtualRun = value; }
        public void SetVirtualInteract(bool held) { _virtualInteract = held; }
        public void PressVirtualInteract() { _virtualInteract = true; }

        public void Poll()
        {
            interactPressed = false;
            archivePressed = false;
            mapPressed = false;
            guidePressed = false;
            objectivesPressed = false;
            pausePressed = false;
            backPressed = false;
            submitPressed = false;
            cancelPressed = false;
            skipPressed = false;
            pointerPressed = false;

#if ENABLE_INPUT_SYSTEM
            ReadKeyboard();
            ReadMouse();
            ReadTouch();
            ReadGamepad();
#else
            ReadLegacy();
#endif

            move += _virtualMove;
            move.x = Mathf.Clamp(move.x, -1f, 1f);
            move.y = Mathf.Clamp(move.y, -1f, 1f);
            run |= _virtualRun;
            if (_virtualInteract)
            {
                interactHeld = true;
                interactPressed = true;
            }
        }

        /// <summary>Called by the on-screen buttons once their press is consumed.</summary>
        public void ReleaseVirtualInteract() { _virtualInteract = false; }

#if ENABLE_INPUT_SYSTEM
        void ReadKeyboard()
        {
            var keyboard = Keyboard.current;
            if (keyboard == null) return;
            float x = 0f, y = 0f;
            if (keyboard.aKey.isPressed || keyboard.leftArrowKey.isPressed) x -= 1f;
            if (keyboard.dKey.isPressed || keyboard.rightArrowKey.isPressed) x += 1f;
            if (keyboard.sKey.isPressed || keyboard.downArrowKey.isPressed) y -= 1f;
            if (keyboard.wKey.isPressed || keyboard.upArrowKey.isPressed) y += 1f;
            move += new Vector2(x, y);
            run |= keyboard.leftShiftKey.isPressed || keyboard.rightShiftKey.isPressed;
            interactHeld |= keyboard.eKey.isPressed || keyboard.spaceKey.isPressed;
            interactPressed |= keyboard.eKey.wasPressedThisFrame || keyboard.spaceKey.wasPressedThisFrame;
            archivePressed |= keyboard.tabKey.wasPressedThisFrame;
            mapPressed |= keyboard.mKey.wasPressedThisFrame;
            guidePressed |= keyboard.gKey.wasPressedThisFrame;
            objectivesPressed |= keyboard.jKey.wasPressedThisFrame;
            pausePressed |= keyboard.escapeKey.wasPressedThisFrame;
            backPressed |= keyboard.backspaceKey.wasPressedThisFrame;
            submitPressed |= keyboard.enterKey.wasPressedThisFrame || keyboard.numpadEnterKey.wasPressedThisFrame;
            cancelPressed |= keyboard.escapeKey.wasPressedThisFrame;
            skipPressed |= keyboard.spaceKey.wasPressedThisFrame || keyboard.enterKey.wasPressedThisFrame;
        }

        void ReadMouse()
        {
            var mouse = Mouse.current;
            if (mouse == null) return;
            pointerX = mouse.position.ReadValue().x;
            pointerY = mouse.position.ReadValue().y;
            pointerDown = mouse.leftButton.isPressed;
            pointerPressed = mouse.leftButton.wasPressedThisFrame;
            if (mouse.rightButton.isPressed)
            {
                look += mouse.delta.ReadValue() * 0.045f;
                Cursor.lockState = CursorLockMode.Locked;
                Cursor.visible = false;
            }
            else if (mouse.rightButton.wasReleasedThisFrame && !usingTouch)
            {
                Cursor.lockState = CursorLockMode.None;
                Cursor.visible = true;
            }
        }

        void ReadTouch()
        {
            var touch = Touchscreen.current;
            if (touch == null) return;
            var primary = touch.primaryTouch;
            if (primary.press.isPressed)
            {
                usingTouch = true;
                Vector2 position = primary.position.ReadValue();
                if (!_touchDragging && primary.press.wasPressedThisFrame)
                {
                    // a tap must not rotate the camera; only a drag does
                    _touchStart = position;
                    _touchDragging = true;
                    _touchConsumed = false;
                }
                else if (_touchDragging)
                {
                    Vector2 delta = primary.delta.ReadValue();
                    if (!_touchConsumed && Vector2.Distance(position, _touchStart) > 18f) _touchConsumed = true;
                    if (_touchConsumed) look += delta * 0.11f;
                }
            }
            else if (primary.press.wasReleasedThisFrame)
            {
                if (!_touchConsumed && _touchStart.y < Screen.height * 0.5f) interactPressed = true;
                _touchDragging = false;
            }
        }

        void ReadGamepad()
        {
            var pad = Gamepad.current;
            if (pad == null) return;
            move += pad.leftStick.ReadValue();
            look += pad.rightStick.ReadValue() * 2.2f;
            run |= pad.leftStickButton.isPressed || pad.rightTrigger.ReadValue() > 0.4f;
            interactPressed |= pad.buttonSouth.wasPressedThisFrame;
            interactHeld |= pad.buttonSouth.isPressed;
            pausePressed |= pad.startButton.wasPressedThisFrame;
            mapPressed |= pad.selectButton.wasPressedThisFrame;
        }
#else
        void ReadLegacy()
        {
            move += new Vector2(Input.GetAxisRaw("Horizontal"), Input.GetAxisRaw("Vertical"));
            run |= Input.GetKey(KeyCode.LeftShift);
            interactHeld |= Input.GetKey(KeyCode.E);
            interactPressed |= Input.GetKeyDown(KeyCode.E);
            archivePressed |= Input.GetKeyDown(KeyCode.Tab);
            mapPressed |= Input.GetKeyDown(KeyCode.M);
            guidePressed |= Input.GetKeyDown(KeyCode.G);
            objectivesPressed |= Input.GetKeyDown(KeyCode.J);
            pausePressed |= Input.GetKeyDown(KeyCode.Escape);
            backPressed |= Input.GetKeyDown(KeyCode.Backspace);
            submitPressed |= Input.GetKeyDown(KeyCode.Return);
            cancelPressed |= Input.GetKeyDown(KeyCode.Escape);
            skipPressed |= Input.GetKeyDown(KeyCode.Space);
            pointerDown = Input.GetMouseButton(0);
            pointerPressed = Input.GetMouseButtonDown(0);
            pointerX = Input.mousePosition.x;
            pointerY = Input.mousePosition.y;
            if (Input.GetMouseButton(1)) look += new Vector2(Input.GetAxis("Mouse X"), Input.GetAxis("Mouse Y")) * 3.2f;
        }
#endif
    }
}
