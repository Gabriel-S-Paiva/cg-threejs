import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export default class App{
    constructor(){
        this.scene = new THREE.Scene();
        this.physicsWorld = null;
        this.debugEnabled = false;
        this.lines = null;
        this.initPhysics();
        
        // Camera Modes: 1=Scene, 2=First Person, 3=Third Person
        this.cameraMode = 1;
        this.moveInput = { x: 0, y: 0 }; // x=sideways, y=forward/back
        this.cameraRotationY = 0; // Yaw
        this.cameraRotationX = 0; // Pitch

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 800);
        this.camera.position.z = 20;

        this.renderer = new THREE.WebGLRenderer({antialias: true});
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(this.renderer.domElement);

        
        
        // Mouse interaction state
        this.isDragging = false;
        this.previousMousePosition = { x: 0, y: 0 };
        this.mouseVelocity = new THREE.Vector2();
        this.lastMouseMoveTime = 0;
        this.mouseMoveHistory = [];

        const ambient = new THREE.AmbientLight()
        this.scene.add(ambient)

        const direction = new THREE.DirectionalLight(0xffffff, 1);
        direction.position.set(20, 20, 20);
        direction.castShadow = true;
        direction.shadow.mapSize.set(4096, 4096);
        direction.shadow.camera.left = -40;
        direction.shadow.camera.right = 40;
        direction.shadow.camera.top = 40;
        direction.shadow.camera.bottom = -40;
        direction.shadow.camera.near = 2.0;
        direction.shadow.camera.far = 200;
        direction.shadow.bias = -0.001;
        direction.shadow.normalBias = 0.05;
        this.scene.add(direction);

        this.interactiveButtons = [];
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();

        this.objects = [];

        const canvas = this.renderer.domElement;
        
        canvas.addEventListener('pointerdown', (e) => {
            if (this.cameraMode === 2 || this.cameraMode === 3) {
                canvas.requestPointerLock();
                return;
            }

            const rect = canvas.getBoundingClientRect();
            this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            this.raycaster.setFromCamera(this.pointer, this.camera);

            const targets = this.interactiveButtons.map(b => b.button).filter(Boolean);
            const intersects = this.raycaster.intersectObjects(targets, true);
            if (intersects.length) {
                const hit = intersects[0].object;
                const btn = this.interactiveButtons.find(b => {
                    let obj = hit;
                    while (obj) {
                        if (obj === b.button) return true;
                        obj = obj.parent;
                    }
                    return false;
                });
                if (btn) {
                    btn.setPressed(true);
                    return;
                }
            }
            
            this.isDragging = true;
            this.previousMousePosition = { x: e.clientX, y: e.clientY };
            this.mouseMoveHistory = [];
            this.lastMouseMoveTime = performance.now();

            const loader = new THREE.TextureLoader();
            loader.load('../../assets/background.png', (t)=> {
                t.encoding = THREE.sRGBEncoding;
                t.anisotropy = this.renderer.capabilities.getMaxAnisotropy;
                this.scene.background = t
            })
        });
        
        canvas.addEventListener('pointermove', (e) => {
            let deltaX = 0;
            let deltaY = 0;
            const now = performance.now();
            const dt = now - this.lastMouseMoveTime;
            
            if (this.cameraMode === 1) {
                 if (!this.isDragging) return;
                 deltaX = e.clientX - this.previousMousePosition.x;
                 deltaY = e.clientY - this.previousMousePosition.y;
            } else {
                 if (document.pointerLockElement !== canvas) return;
                 // Sensitivity adjusted for pointer lock (movement values are raw pixels)
                 deltaX = e.movementX; 
                 deltaY = e.movementY;
            }
            
            if (this.cameraMode === 1) {
                this.objects.forEach(obj => {
                    if (obj.rotation) {
                        obj.rotation.y += deltaX * 0.01;
                        obj.rotation.x += deltaY * 0.01;
                    }
                });
                
                const velocity = Math.sqrt(deltaX * deltaX + deltaY * deltaY) / (dt || 1);
                this.mouseMoveHistory.push({ velocity, time: now });
                
                if (this.mouseMoveHistory.length > 10) {
                    this.mouseMoveHistory.shift();
                }
                
                if (this.mouseMoveHistory.length >= 5) {
                    const recentVelocities = this.mouseMoveHistory.slice(-5);
                    const avgVelocity = recentVelocities.reduce((sum, v) => sum + v.velocity, 0) / 5;
                    
                    if (avgVelocity > 2) {
                        this.onShake();
                        this.mouseMoveHistory = [];
                    }
                }
            } else {
                // FPS/TPS Rotation
                const sensitivity = 0.002;
                this.cameraRotationY -= deltaX * sensitivity;
                this.cameraRotationX -= deltaY * sensitivity;
                // Clamp pitch
                this.cameraRotationX = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.cameraRotationX));
            }
            
            this.previousMousePosition = { x: e.clientX, y: e.clientY };
            this.lastMouseMoveTime = now;
        });

        window.addEventListener('pointerup', () => {
            this.isDragging = false;
            this.interactiveButtons.forEach(b => b.setPressed(false));
        });

        this.lastAcceleration = new THREE.Vector3();
        this.shakeThreshold = 15;
        window.addEventListener('devicemotion', (e) => {
            if (e.accelerationIncludingGravity) {
                const accel = new THREE.Vector3(
                    e.accelerationIncludingGravity.x || 0,
                    e.accelerationIncludingGravity.y || 0,
                    e.accelerationIncludingGravity.z || 0
                );
                const delta = accel.distanceTo(this.lastAcceleration);
                if (delta > this.shakeThreshold) {
                    this.onShake();
                }
                this.lastAcceleration.copy(accel);
            }
        });
        
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (key === '1') this.cameraMode = 1;
            if (key === '2') this.cameraMode = 2;
            if (key === '3') this.cameraMode = 3;

            if (this.cameraMode === 2) {
                if (key === 'w') this.moveInput.y = -1; // In 3D, usually -Z is forward
                if (key === 's') this.moveInput.y = 1; 
                if (key === 'a') this.moveInput.x = -1;
                if (key === 'd') this.moveInput.x = 1;
            }
            if (this.cameraMode === 3) {
                if (key === 'w') this.moveInput.y = 1; // In 3D, usually -Z is forward
                if (key === 's') this.moveInput.y = -1; 
                if (key === 'a') this.moveInput.x = 1;
                if (key === 'd') this.moveInput.x = -1;
            }

            if (e.key === 's' || e.key === 'S') {
                if (this.cameraMode === 1) this.onShake(); // Only shake in Scene mode? Or always? Prompt says "behaviour: ... on shake". Implies Scene Camera behavior.
            }
            if (e.key === 'd' || e.key === 'D') {
                // Conflict with WASD 'd'
                if (this.cameraMode === 1) {
                    this.debugEnabled = !this.debugEnabled;
                    if (!this.debugEnabled && this.lines) {
                        this.lines.visible = false;
                    }
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (this.cameraMode !== 1) {
                if (key === 'w' || key === 's') this.moveInput.y = 0;
                if (key === 'a' || key === 'd') this.moveInput.x = 0;
            }
        });
        
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        this.animate();
    }

    async initPhysics() {
        await RAPIER.init();
        this.physicsWorld = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 });
        
        this.objects.forEach(object => {
            if (object.setPhysicsWorld) {
                object.setPhysicsWorld(this.physicsWorld);
            }
        });
    }

    onShake() {
        this.objects.forEach(obj => {
            if (obj.pet && obj.pet.current_object && obj.pet.current_object.enterRagdoll) {
                obj.pet.current_object.enterRagdoll();
            }
        });
    }

    

    add(object) {
        this.scene.add(object);
        if(object.buttons) {
            this.interactiveButtons.push(...object.buttons)
        }
        this.objects.push(object);
        if (object.setPhysicsWorld && this.physicsWorld) {
            object.setPhysicsWorld(this.physicsWorld);
        }
        if (object.setCamera && this.camera) {
            object.setCamera(this.camera);
        }
    }

    animate = () => {
        requestAnimationFrame(this.animate);
        if (this.physicsWorld) {
            this.physicsWorld.step();

            if (this.debugEnabled) {
                const { vertices, colors } = this.physicsWorld.debugRender();
                
                if (!this.lines) {
                     const geometry = new THREE.BufferGeometry();
                     const material = new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, depthWrite: false });
                     this.lines = new THREE.LineSegments(geometry, material);
                     this.lines.renderOrder = 999; 
                     this.scene.add(this.lines);
                }
                
                this.lines.visible = true;
                this.lines.geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
                this.lines.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
            }
        }
        
        // --- Camera & Control Logic ---
        let activeChild = null;
        // Locate child: logic assumes objects[0] is Shell, Shell has pet (Tamagoshi), pet has child.
        if (this.objects.length > 0 && this.objects[0].pet) {
            const pet = this.objects[0].pet;
            // Check if hatched (current_object is child)
            if (pet.current_object === pet.child) {
                activeChild = pet.child;
            }
        }
        
        if (this.cameraMode === 1) {
            // Scene Camera: Fixed position, rotate objects (handled in pointermove)
            this.camera.position.set(0, 0, 20);
            this.camera.lookAt(0, 0, 0);
            if (activeChild) activeChild.isControlled = false;
        } 
        else if (activeChild) {
            // First/Third Person
            activeChild.isControlled = true;
            activeChild.updateControlled(0.016, this.moveInput, this.cameraRotationY);
            
            const headPos = activeChild.getHeadPosition();
            
            if (this.cameraMode === 2) {
                // First Person: clamp pitch to avoid flipping and use YXZ order
                const maxPitch = Math.PI / 2 - 0.05;
                this.cameraRotationX = THREE.MathUtils.clamp(this.cameraRotationX, -maxPitch, maxPitch);

                this.camera.position.copy(headPos);
                this.camera.rotation.order = 'YXZ';
                this.camera.rotation.y = this.cameraRotationY;
                this.camera.rotation.x = this.cameraRotationX;
                this.camera.rotation.z = 0;
            } else if (this.cameraMode === 3) {
                // Third Person: compute camera from yaw+pitch to prevent flip and X-offset
                const maxPitch = Math.PI / 2 - 0.05;
                const pitch = THREE.MathUtils.clamp(this.cameraRotationX, -maxPitch, maxPitch);
                const yaw = this.cameraRotationY;

                const distance = 5; // camera distance behind head
                const upOffset = 1.5; // vertical offset above head

                // Direction vector from yaw/pitch (camera forward direction)
                const dir = new THREE.Vector3(
                    Math.sin(yaw) * Math.cos(pitch),
                    Math.sin(pitch),
                    Math.cos(yaw) * Math.cos(pitch)
                );

                // Place camera behind the head along that direction and apply an upward offset
                const camPos = headPos.clone().sub(dir.multiplyScalar(distance)).add(new THREE.Vector3(0, upOffset, 0));
                this.camera.position.copy(camPos);
                this.camera.up.set(0, 1, 0);
                this.camera.lookAt(headPos);
            }
        } else {
             // Fallback if trying to use mode 2/3 but egg not hatched
             this.camera.position.set(0, 0, 20);
             this.camera.lookAt(0, 0, 0);
        }

        this.objects.forEach(object => object.update?.())
        this.renderer.render(this.scene, this.camera)
    }
}