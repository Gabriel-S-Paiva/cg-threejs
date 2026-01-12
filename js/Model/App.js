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
        
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (key === '1') this.cameraMode = 1;
            if (key === '2') this.cameraMode = 2;
            if (key === '3') this.cameraMode = 3;

            if (this.cameraMode === 2) {
                if (key === 'w') this.moveInput.y = -1;
                if (key === 's') this.moveInput.y = 1; 
                if (key === 'a') this.moveInput.x = -1;
                if (key === 'd') this.moveInput.x = 1;
            }
            if (this.cameraMode === 3) {
                if (key === 'w') this.moveInput.y = 1;
                if (key === 's') this.moveInput.y = -1; 
                if (key === 'a') this.moveInput.x = 1;
                if (key === 'd') this.moveInput.x = -1;
            }

            if (e.key === 's' || e.key === 'S') {
                if (this.cameraMode === 1) this.onShake();
            }
            if (e.key === 'd' || e.key === 'D') {
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

        // Microphone / voice trigger state
        this.audioContext = null;
        this.micEnabled = false;
        this.micStream = null;
        this.analyser = null;
        this.micSource = null;
        this.mediaRecorder = null;
        this.recordingChunks = [];
        this.micThreshold = 0.06; // RMS threshold to trigger recording
        this.minTriggerInterval = 1200; // ms between triggers
        this._lastTrigger = 0;
        this.micTarget = null; // target object to receive mic events (e.g., Child instance)

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

    // set object that should receive mic events (Child instance or Shell.pet)
    setMicTarget(target) {
        this.micTarget = target;
    }

    async enableMic() {
        if (this.micEnabled) return;
        try {
            this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e) {
            console.error('Mic permission denied', e);
            return;
        }

        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        this.micSource = this.audioContext.createMediaStreamSource(this.micStream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.3;
        this.micSource.connect(this.analyser);

        const data = new Float32Array(this.analyser.fftSize);
        const check = () => {
            if (!this.micEnabled) return;
            this.analyser.getFloatTimeDomainData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
            const rms = Math.sqrt(sum / data.length);
            const now = performance.now();
            if (rms > this.micThreshold && (now - this._lastTrigger) > this.minTriggerInterval) {
                this._lastTrigger = now;
                this._startShortRecording();
            }
            requestAnimationFrame(check);
        };
        this.micEnabled = true;
        check();
    }

    disableMic() {
        this.micEnabled = false;
        try {
            if (this.micStream) {
                this.micStream.getTracks().forEach(t => t.stop());
                this.micStream = null;
            }
            if (this.micSource) {
                try { this.micSource.disconnect(); } catch(e){}
                this.micSource = null;
            }
            if (this.analyser) {
                try { this.analyser.disconnect(); } catch(e){}
                this.analyser = null;
            }
        } catch(e){}
    }

    _startShortRecording(duration = 1400) {
        if (!this.micStream) return;
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') return;
        try {
            this.recordingChunks = [];
            this.mediaRecorder = new MediaRecorder(this.micStream);
            this.mediaRecorder.ondataavailable = (ev) => { if (ev.data && ev.data.size) this.recordingChunks.push(ev.data); };
            this.mediaRecorder.onstop = async () => {
                try {
                    const blob = new Blob(this.recordingChunks, { type: this.recordingChunks[0]?.type || 'audio/webm' });
                    if (this.micTarget) {
                        if (typeof this.micTarget.onMicAudio === 'function') {
                            this.micTarget.onMicAudio(blob);
                        } else if (typeof this.micTarget.setState === 'function') {
                            this.micTarget.setState('playing');
                        }
                    }
                    try {
                        const arrayBuffer = await blob.arrayBuffer();
                        const ac = this.audioContext || (this.audioContext = new (window.AudioContext || window.webkitAudioContext)());
                        const audioBuffer = await ac.decodeAudioData(arrayBuffer);
                        const src = ac.createBufferSource();
                        src.buffer = audioBuffer;
                        src.playbackRate.value = 1.8;
                        src.connect(ac.destination);
                        src.start();
                    } catch(e){}
                } catch(e){ console.error(e); }
            };
            this.mediaRecorder.start();
            setTimeout(()=> {
                if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                    this.mediaRecorder.stop();
                }
            }, duration);
        } catch (e) {
            console.error('MediaRecorder error', e);
        }
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
                const maxPitch = Math.PI / 2 - 0.05;
                this.cameraRotationX = THREE.MathUtils.clamp(this.cameraRotationX, -maxPitch, maxPitch);

                // First-person offsets — change these to move the camera relative to the head
                const fpX = -1.5; // +X is right
                const fpY = 0.20; // vertical offset
                const fpZ = -0.8; // forward/back offset (positive moves camera forward)
                const fpOffset = new THREE.Vector3(fpX, fpY, fpZ);
                const rotatedFp = fpOffset.clone().applyAxisAngle(new THREE.Vector3(0,1,0), this.cameraRotationY);
                this.camera.position.copy(headPos).add(rotatedFp);
                this.camera.rotation.order = 'YXZ';
                this.camera.rotation.y = this.cameraRotationY;
                this.camera.rotation.x = this.cameraRotationX;
                this.camera.rotation.z = 0;
            } else if (this.cameraMode === 3) {
                // Target the center of the head (Local 0, 4, 0), correcting for the pivot offset
                // The head geometry is centered at x=0 in local space, but the pivot is at x=2
                const headCenterLocal = new THREE.Vector3(0, 4, 0);
                const headCenterWorld = headCenterLocal.applyMatrix4(activeChild.matrixWorld);

                const maxPitch = Math.PI / 2 - 0.05;
                const pitch = THREE.MathUtils.clamp(this.cameraRotationX, -maxPitch, maxPitch);
                const yaw = this.cameraRotationY;
 
                // Camera Positioning
                const distance = 4.0; // Closer distance ("Lower Z" interpretation)
                const extraHeight = 0.5; // "Higher Y" offset relative to head center

                // Calculate direction vector from Pitch/Yaw
                const dir = new THREE.Vector3(
                    Math.sin(yaw) * Math.cos(pitch),
                    Math.sin(pitch),
                    Math.cos(yaw) * Math.cos(pitch)
                );
 
                // Position camera behind the head (Head - Direction * Distance)
                const camPos = headCenterWorld.clone().sub(dir.multiplyScalar(distance));
                camPos.y += extraHeight; 
                
                this.camera.position.copy(camPos);
                
                // Look strictly at the center of the head mesh
                this.camera.lookAt(headCenterWorld);
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