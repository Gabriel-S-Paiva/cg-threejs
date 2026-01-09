import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export default class App{
    constructor(){
        this.scene = new THREE.Scene();
        this.physicsWorld = null;
        this.debugEnabled = false;
        this.lines = null;
        this.initPhysics();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 800);
        this.camera.position.z = 20;

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
        direction.position.set(20, 20, 20);
        direction.castShadow = true;
        // improve shadow quality and bounds (scaled 4x)
        direction.shadow.mapSize.set(4096, 4096);
        direction.shadow.camera.left = -40;
        direction.shadow.camera.right = 40;
        direction.shadow.camera.top = 40;
        direction.shadow.camera.bottom = -40;
        direction.shadow.camera.near = 2.0;
        direction.shadow.camera.far = 200;
        // reduce shadow acne / z-fighting
        direction.shadow.bias = -0.001;
        direction.shadow.normalBias = 0.05;
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
                    console.log('[App] Mouse shake detected! Average velocity:', avgVelocity);
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
                console.log('[App] S key pressed - triggering shake');
                this.onShake();
            }
            if (e.key === 'd' || e.key === 'D') {
                this.debugEnabled = !this.debugEnabled;
                console.log('[App] Debug mode:', this.debugEnabled);
                if (!this.debugEnabled && this.lines) {
                    this.lines.visible = false;
                }
                
            }
        });
        
        // Window resize handler for responsiveness
        window.addEventListener('resize', () => {
            console.log('[App] Window resized');
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        this.animate();
    }

    async initPhysics() {
        console.log('[App] Initializing physics...');
        await RAPIER.init();
        this.physicsWorld = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 });
        console.log('[App] Physics world created:', this.physicsWorld);
        
        // Update all existing objects with physics world
        this.objects.forEach(object => {
            if (object.setPhysicsWorld) {
                console.log('[App] Setting physics world on existing object');
                object.setPhysicsWorld(this.physicsWorld);
            }
        });
    }

    onShake() {
        console.log('[App] Shake detected! Triggering ragdoll on pets...');
        this.objects.forEach(obj => {
            if (obj.pet && obj.pet.current_object && obj.pet.current_object.enterRagdoll) {
                console.log('[App] Calling enterRagdoll on pet');
                obj.pet.current_object.enterRagdoll();
            } else {
                console.log('[App] Object does not have enterRagdoll method', obj);
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
        // Pass camera reference to objects that need it
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
                     const material = new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, depthWrite: false }); // Disable depth test to see lines over meshes
                     this.lines = new THREE.LineSegments(geometry, material);
                     this.lines.renderOrder = 999; 
                     this.scene.add(this.lines);
                }
                
                this.lines.visible = true;
                this.lines.geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
                this.lines.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
            }
        }
        this.objects.forEach(object => object.update?.())
        this.renderer.render(this.scene, this.camera)
    }
}