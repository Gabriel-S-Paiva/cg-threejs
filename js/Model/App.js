import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export default class App{
    constructor(){
        this.scene = new THREE.Scene();
        this.physicsWorld = null;
        this.initPhysics();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
        this.camera.position.z = 5;

        this.renderer = new THREE.WebGLRenderer({antialias: true});
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        // enable shadow maps
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(this.renderer.domElement);
        
        // Mouse interaction state
        this.isDragging = false;
        this.previousMousePosition = { x: 0, y: 0 };
        this.mouseVelocity = new THREE.Vector2();
        this.lastMouseMoveTime = 0;
        this.mouseMoveHistory = [];

        // Lights
        const ambient = new THREE.AmbientLight()
        this.scene.add(ambient)

        const direction = new THREE.DirectionalLight(0xffffff, 1);
        direction.position.set(5, 5, 5);
        direction.castShadow = true;
        // improve shadow quality and bounds
        direction.shadow.mapSize.set(2048, 2048);
        direction.shadow.camera.left = -10;
        direction.shadow.camera.right = 10;
        direction.shadow.camera.top = 10;
        direction.shadow.camera.bottom = -10;
        direction.shadow.camera.near = 0.5;
        direction.shadow.camera.far = 50;
        // reduce shadow acne / z-fighting
        direction.shadow.bias = -0.0005;
        this.scene.add(direction);

        // interactive buttons collected from added objects
        this.interactiveButtons = [];
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();

        this.objects = [];

        // Mouse interaction for rotation and buttons
        const canvas = this.renderer.domElement;
        
        canvas.addEventListener('pointerdown', (e) => {
            const rect = canvas.getBoundingClientRect();
            this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            this.raycaster.setFromCamera(this.pointer, this.camera);

            // Check for button clicks first
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
                    return; // Don't start dragging if clicking button
                }
            }
            
            // Start dragging for rotation
            this.isDragging = true;
            this.previousMousePosition = { x: e.clientX, y: e.clientY };
            this.mouseMoveHistory = [];
            this.lastMouseMoveTime = performance.now();
        });
        
        canvas.addEventListener('pointermove', (e) => {
            if (!this.isDragging) return;
            
            const deltaX = e.clientX - this.previousMousePosition.x;
            const deltaY = e.clientY - this.previousMousePosition.y;
            const now = performance.now();
            const dt = now - this.lastMouseMoveTime;
            
            // Rotate shell
            this.objects.forEach(obj => {
                if (obj.rotation) {
                    obj.rotation.y += deltaX * 0.01;
                    obj.rotation.x += deltaY * 0.01;
                }
            });
            
            // Track velocity for shake detection
            const velocity = Math.sqrt(deltaX * deltaX + deltaY * deltaY) / (dt || 1);
            this.mouseMoveHistory.push({ velocity, time: now });
            
            // Keep only last 10 movements
            if (this.mouseMoveHistory.length > 10) {
                this.mouseMoveHistory.shift();
            }
            
            // Detect shake (fast back-and-forth motion)
            if (this.mouseMoveHistory.length >= 5) {
                const recentVelocities = this.mouseMoveHistory.slice(-5);
                const avgVelocity = recentVelocities.reduce((sum, v) => sum + v.velocity, 0) / 5;
                
                if (avgVelocity > 3) { // Shake threshold
                    this.onShake();
                    this.mouseMoveHistory = []; // Reset to avoid multiple triggers
                }
            }
            
            this.previousMousePosition = { x: e.clientX, y: e.clientY };
            this.lastMouseMoveTime = now;
        });

        window.addEventListener('pointerup', () => {
            this.isDragging = false;
            this.interactiveButtons.forEach(b => b.setPressed(false));
        });

        // Shake detection
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
        
        // Keyboard shake trigger for testing (press 'S' key)
        window.addEventListener('keydown', (e) => {
            if (e.key === 's' || e.key === 'S') {
                this.onShake();
            }
        });

        this.animate();
    }

    async initPhysics() {
        await RAPIER.init();
        this.physicsWorld = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 });
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
        // Pass physics world to objects that need it
        if (object.setPhysicsWorld && this.physicsWorld) {
            object.setPhysicsWorld(this.physicsWorld);
        }
    }

    animate = () => {
        requestAnimationFrame(this.animate);
        if (this.physicsWorld) {
            this.physicsWorld.step();
        }
        this.objects.forEach(object => object.update?.())
        this.renderer.render(this.scene, this.camera)
    }
}