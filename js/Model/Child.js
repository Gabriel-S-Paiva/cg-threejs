import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export default class Child extends THREE.Group {
    constructor() {
        super();

        // Animation state machine
        this.state = 'idle'; // 'idle', 'eating', 'playing', 'sleeping'
        this.stateTime = 0;
        this.lastTime = performance.now() / 1000;
        
        // Movement parameters for idle
        this.targetPosition = new THREE.Vector3(0, 0, 0);
        this.currentPosition = new THREE.Vector3(0, 0, 0);
        this.movementSpeed = 0.5;
        this.nextMoveTime = Math.random() * 3 + 2;
        
        // Box bounds for random movement (shell interior is approximately 2.6x2.6x3)
        // Keep character within bounds considering its scale (0.2)
        // Only move in X and Z axis, not Y
        this.bounds = { x: 1, y: 0, z: 0.15 };
        
        // Camera and looking behavior
        this.camera = null;
        this.isLookingAtCamera = false;
        this.lookAtCameraTime = 0;
        this.nextCameraLookTime = Math.random() * 20 + 15; // Look at camera every 15-35 seconds
        this.lookAtCameraDuration = 2; // Look for 2 seconds

        const earGeometry = new THREE.CapsuleGeometry(1, 1, 8, 24);
        const earMaterial = new THREE.MeshPhysicalMaterial({ color: '#000' });

        // Left Ear
        const earLeft = new THREE.Mesh(earGeometry, earMaterial);
        earLeft.scale.set(0.75, 1, 0.7);
        this.leftEarPivot = new THREE.Object3D();
        this.leftEarPivot.rotation.z = -Math.PI / 2;
        this.leftEarPivot.position.y = 1;
        earLeft.position.y = 1.5;
        this.leftEarPivot.add(earLeft);

        // Right Ear
        const earRight = new THREE.Mesh(earGeometry, earMaterial);
        earRight.scale.set(0.75, 1, 0.7);
        this.rightEarPivot = new THREE.Object3D();
        this.rightEarPivot.rotation.z = -Math.PI / 2;
        this.rightEarPivot.position.y = 3;
        earRight.position.y = 1.5;
        this.rightEarPivot.add(earRight);

        // Head
        const headCurve = new THREE.CubicBezierCurve(
            new THREE.Vector2(0, 0),
            new THREE.Vector2(2, 0),
            new THREE.Vector2(2, 4),
            new THREE.Vector2(0, 4)
        );
        const headPoints = headCurve.getPoints(30);
        const headGeometry = new THREE.LatheGeometry(headPoints, 24);

        const texture = new THREE.TextureLoader().load('../../assets/gemini.png', () => {
            texture.colorSpace = THREE.SRGBColorSpace;
        });
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 1);
        texture.offset.set(0.78, 0);
        texture.rotation = Math.PI;

        const headMaterial = new THREE.MeshPhysicalMaterial({
            color: '#FFFFA7',
            map: texture,
        });
        this.head = new THREE.Mesh(headGeometry, headMaterial);
        this.head.rotation.z = Math.PI / 2;
        this.head.position.x = 2;
        this.head.position.y = 4;
        this.head.add(this.leftEarPivot, this.rightEarPivot);

        // Body
        const bodyCurve = new THREE.CubicBezierCurve(
            new THREE.Vector2(0, 0.06),
            new THREE.Vector2(-2.4, 0.6),
            new THREE.Vector2(-0.9, 2.5),
            new THREE.Vector2(-0.6, 3)
        );
        const bodyPoints = bodyCurve.getPoints(30);
        const bodyGeometry = new THREE.LatheGeometry(bodyPoints, 24);
        const bodyMaterial = new THREE.MeshPhysicalMaterial({ color: '#FFFFA7' });
        this.body = new THREE.Mesh(bodyGeometry, bodyMaterial);

        // Simple floating legs (no joints)
        const legMaterial = new THREE.MeshPhysicalMaterial({ color: '#FFFFA7' });
        
        this.leftLeg = new THREE.Mesh(bodyGeometry, legMaterial);
        this.leftLeg.scale.set(0.4, 0.4, 0.4);
        this.leftLeg.position.y = -0.5;
        this.leftLeg.position.x = 0.8;
        this.body.add(this.leftLeg);
        
        this.rightLeg = new THREE.Mesh(bodyGeometry, legMaterial);
        this.rightLeg.scale.set(0.4, 0.4, 0.4);
        this.rightLeg.position.y = -0.5;
        this.rightLeg.position.x = -0.8;
        this.body.add(this.rightLeg);

        // Simple floating hands (no joints)
        const handGeometry = new THREE.SphereGeometry(0.5);
        const handMaterial = new THREE.MeshPhysicalMaterial({ color: '#FFFFA7' });

        this.leftHand = new THREE.Mesh(handGeometry, handMaterial);
        this.leftHand.position.y = 2;
        this.leftHand.position.x = 2;
        this.body.add(this.leftHand);
        
        this.rightHand = new THREE.Mesh(handGeometry, handMaterial);
        this.rightHand.position.y = 2;
        this.rightHand.position.x = -2;
        this.body.add(this.rightHand);

        this.body.add(this.head);

        // Enable shadows
        this.body.traverse((c) => {
            if (c.isMesh) {
                c.castShadow = true;
                c.receiveShadow = true;
            }
        });

        this.add(this.body);

        // Animation-specific parameters
        this.animPhase = 0;
        this.jumpCount = 0;
        this.maxJumps = 5;
        
        // Physics and ragdoll state
        this.physicsWorld = null;
        this.rigidBodies = [];
        this.isRagdoll = false;
        this.ragdollTimeout = null;
        
        console.log('[Child] Constructor initialized');
    }

    setPhysicsWorld(world) {
        this.physicsWorld = world;
        console.log('[Child] Physics world set:', world ? 'SUCCESS' : 'FAILED - world is null');
    }
    
    setCamera(camera) {
        this.camera = camera;
        console.log('[Child] Camera reference set:', camera ? 'SUCCESS' : 'FAILED');
    }

    setState(newState) {
        if (this.isRagdoll) {
            console.log('[Child] setState blocked - currently in ragdoll mode');
            return; // Can't change state during ragdoll
        }
        
        if (this.state !== newState) {
            console.log(`[Child] State change: ${this.state} -> ${newState}`);
            this.state = newState;
            this.stateTime = 0;
            this.animPhase = 0;
            this.isLookingAtCamera = false; // Reset camera look when changing state
            
            if (newState === 'idle') {
                this.body.rotation.set(0, 0, 0);
                this.body.position.y = 0;
            } else if (newState === 'eating') {
                this.currentPosition.set(0, 0, 0);
            } else if (newState === 'playing') {
                this.jumpCount = 0;
                this.currentPosition.set(0, 0, 0);
            } else if (newState === 'sleeping') {
                this.currentPosition.set(0, 0, 0);
            }
        }
    }

    enterRagdoll() {
        console.log('[Child] enterRagdoll called');
        console.log('[Child] isRagdoll:', this.isRagdoll, 'physicsWorld:', this.physicsWorld ? 'exists' : 'NULL');
        
        if (this.isRagdoll) {
            console.log('[Child] Already in ragdoll mode, skipping');
            return;
        }
        
        if (!this.physicsWorld) {
            console.error('[Child] Cannot enter ragdoll - physics world not set!');
            return;
        }
        
        console.log('[Child] Entering ragdoll mode from state:', this.state);
        this.isRagdoll = true;
        this.previousState = this.state;
        this.state = 'ragdoll';
        
        // Clear any existing timeout
        if (this.ragdollTimeout) clearTimeout(this.ragdollTimeout);
        
        // Create physics bodies for body parts
        this.createRagdollBodies();
        
        // Exit ragdoll after 3 seconds
        this.ragdollTimeout = setTimeout(() => this.exitRagdoll(), 3000);
    }

    exitRagdoll() {
        console.log('[Child] Exiting ragdoll mode');
        this.isRagdoll = false;
        this.cleanupRagdollBodies();
        this.setState('idle');
    }

    createRagdollBodies() {
        if (!this.physicsWorld) {
            console.error('[Child] Cannot create ragdoll bodies - no physics world');
            return;
        }
        
        console.log('[Child] Creating ragdoll bodies');
        
        // Get world position for accurate placement
        const worldPos = new THREE.Vector3();
        this.getWorldPosition(worldPos);
        console.log('[Child] World position:', worldPos);
        
        const scale = 0.2; // Character scale
        
        // Body
        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(
                worldPos.x,
                worldPos.y,
                worldPos.z
            )
            .setLinearDamping(2.0)
            .setAngularDamping(2.0);
        this.bodyRigidBody = this.physicsWorld.createRigidBody(bodyDesc);
        
        const bodyCollider = RAPIER.ColliderDesc.ball(0.3 * scale)
            .setRestitution(0.3)
            .setFriction(0.5);
        this.physicsWorld.createCollider(bodyCollider, this.bodyRigidBody);
        
        // Apply random impulse
        const impulse = {
            x: (Math.random() - 0.5) * 2,
            y: Math.random() * 1,
            z: (Math.random() - 0.5) * 2
        };
        console.log('[Child] Applying impulse:', impulse);
        this.bodyRigidBody.applyImpulse(impulse, true);
        
        this.rigidBodies.push(this.bodyRigidBody);
        console.log('[Child] Ragdoll body created successfully');
    }

    cleanupRagdollBodies() {
        if (!this.physicsWorld) {
            console.log('[Child] No physics world during cleanup');
            return;
        }
        
        console.log('[Child] Cleaning up ragdoll bodies:', this.rigidBodies.length);
        
        this.rigidBodies.forEach(rb => {
            if (rb && this.physicsWorld.bodies.contains(rb.handle)) {
                this.physicsWorld.removeRigidBody(rb);
            }
        });
        this.rigidBodies = [];
        this.bodyRigidBody = null;
        console.log('[Child] Ragdoll cleanup complete');
    }

    updateRagdoll() {
        if (!this.bodyRigidBody) return;
        
        const pos = this.bodyRigidBody.translation();
        const rot = this.bodyRigidBody.rotation();
        
        this.position.set(pos.x, pos.y, pos.z);
        this.body.quaternion.set(rot.x, rot.y, rot.z, rot.w);
        
        // Physics walls handle containment now, but still check for extreme cases
        const bounds = { x: 1.5, y: 1.5, z: 0.5 };
        if (Math.abs(pos.x) > bounds.x || Math.abs(pos.y) > bounds.y || Math.abs(pos.z) > bounds.z) {
            console.warn('[Child] Ragdoll exceeded safety bounds, resetting position');
            // Reset to center if somehow escapes
            this.bodyRigidBody.setTranslation({ x: 0, y: -0.85, z: -0.6 }, true);
            this.bodyRigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
            this.bodyRigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
        }
    }

    updateIdle(now, dt) {
        // Ear animation
        const earPhase = now * 2 * Math.PI / 3;
        const earAmplitude = Math.PI / 32;
        this.leftEarPivot.rotation.z = (earAmplitude * Math.sin(earPhase)) - Math.PI / 2;
        this.rightEarPivot.rotation.z = (earAmplitude * -Math.sin(earPhase)) - Math.PI / 2;

        // Camera looking behavior
        this.nextCameraLookTime -= dt;
        if (this.nextCameraLookTime <= 0 && !this.isLookingAtCamera) {
            this.isLookingAtCamera = true;
            this.lookAtCameraTime = 0;
            this.nextCameraLookTime = Math.random() * 20 + 15; // Reset timer for next look
            console.log('[Child] Started looking at camera');
        }
        
        if (this.isLookingAtCamera) {
            this.lookAtCameraTime += dt;
            if (this.lookAtCameraTime > this.lookAtCameraDuration) {
                this.isLookingAtCamera = false;
                console.log('[Child] Stopped looking at camera');
            }
        }

        // Random movement in box (but stop when looking at camera)
        if (!this.isLookingAtCamera) {
            this.nextMoveTime -= dt;
            if (this.nextMoveTime <= 0) {
                this.targetPosition.set(
                    (Math.random() - 0.5) * this.bounds.x * 2,
                    (Math.random() - 0.5) * this.bounds.y * 2,
                    (Math.random() - 0.5) * this.bounds.z * 2
                );
                this.nextMoveTime = Math.random() * 3 + 2;
            }

            // Smooth movement toward target
            const previousPosition = this.currentPosition.clone();
            this.currentPosition.lerp(this.targetPosition, dt * this.movementSpeed);
            this.position.copy(this.currentPosition);
            
            // Calculate movement direction and rotate character to face it
            const movementDirection = new THREE.Vector3().subVectors(this.currentPosition, previousPosition);
            if (movementDirection.length() > 0.001) {
                const targetAngle = Math.atan2(movementDirection.x, movementDirection.z);
                this.rotation.y = THREE.MathUtils.lerp(this.rotation.y, targetAngle, dt * 5);
            }
        } else {
            // Look at camera
            if (this.camera) {
                const worldPos = new THREE.Vector3();
                this.getWorldPosition(worldPos);
                const cameraDirection = new THREE.Vector3().subVectors(this.camera.position, worldPos);
                const targetAngle = Math.atan2(cameraDirection.x, cameraDirection.z);
                this.rotation.y = THREE.MathUtils.lerp(this.rotation.y, targetAngle, dt * 3);
            }
        }

        // Simple walking animation - bob up and down (only when moving)
        if (!this.isLookingAtCamera) {
            const walkSpeed = this.currentPosition.distanceTo(this.targetPosition) * 2;
            const walkPhase = now * Math.PI * 4 * Math.max(walkSpeed, 0.5);
            
            this.body.position.y = Math.abs(Math.sin(walkPhase)) * 0.1;
            
            // Feet move slightly
            this.leftLeg.rotation.x = Math.sin(walkPhase) * 0.2;
            this.rightLeg.rotation.x = Math.sin(walkPhase + Math.PI) * 0.2;

            // Floating hands swing gently
            const armSpeed = 1.5;
            const horizontalPhase = now * armSpeed;
            
            this.leftHand.position.y = 2 + Math.sin(horizontalPhase) * 0.2;
            this.leftHand.rotation.z = Math.sin(horizontalPhase) * 0.3;
            
            this.rightHand.position.y = 2 + Math.sin(horizontalPhase + Math.PI) * 0.2;
            this.rightHand.rotation.z = Math.sin(horizontalPhase + Math.PI) * 0.3;
        } else {
            // Standing still when looking at camera
            this.body.position.y = 0;
            this.leftLeg.rotation.x = 0;
            this.rightLeg.rotation.x = 0;
            
            // Arms in neutral position
            this.leftHand.position.y = 2;
            this.rightHand.position.y = 2;
            this.leftHand.rotation.z = 0;
            this.rightHand.rotation.z = 0;
        }
    }

    updateEating(now, dt) {
        // Ear animation continues
        const earPhase = now * 2 * Math.PI / 3;
        const earAmplitude = Math.PI / 32;
        this.leftEarPivot.rotation.z = (earAmplitude * Math.sin(earPhase)) - Math.PI / 2;
        this.rightEarPivot.rotation.z = (earAmplitude * -Math.sin(earPhase)) - Math.PI / 2;

        const eatDuration = 4; // Total eating cycle duration
        const t = this.stateTime / eatDuration;

        if (t < 0.3) {
            // Reach back
            const reachT = t / 0.3;
            this.rightHand.position.set(-2, 2, 1 * reachT);
        } else if (t < 0.6) {
            // Bring to mouth (front of head, not back)
            const bringT = (t - 0.3) / 0.3;
            this.rightHand.position.set(
                -2 + 4 * bringT,
                2 + 2 * bringT,
                1 - 1 * bringT
            );
        } else if (t < 0.8) {
            // Eating motion (at front of mouth)
            const eatT = (t - 0.6) / 0.2;
            this.rightHand.position.set(2, 4, 0);
            this.rightHand.rotation.z = Math.sin(eatT * Math.PI * 4) * 0.2;
        } else {
            // Return to neutral
            const returnT = (t - 0.8) / 0.2;
            this.rightHand.position.set(
                2 - 4 * returnT,
                4 - 2 * returnT,
                0
            );
        }

        // Left hand stays neutral with gentle sway
        this.leftHand.position.set(2, 2 + Math.sin(now * 2) * 0.1, 0);
        this.leftHand.rotation.z = 0;

        // Legs stay still
        this.leftLeg.rotation.set(0, 0, 0);
        this.rightLeg.rotation.set(0, 0, 0);

        if (this.stateTime > eatDuration) {
            this.setState('idle');
        }
    }

    updatePlaying(now, dt) {
        // Ear animation continues
        const earPhase = now * 2 * Math.PI / 3;
        const earAmplitude = Math.PI / 32;
        this.leftEarPivot.rotation.z = (earAmplitude * Math.sin(earPhase)) - Math.PI / 2;
        this.rightEarPivot.rotation.z = (earAmplitude * -Math.sin(earPhase)) - Math.PI / 2;

        const jumpDuration = 1.2; // Duration per jump
        const totalPlayTime = this.maxJumps * jumpDuration + 1; // +1 for cheer

        if (this.stateTime < this.maxJumps * jumpDuration) {
            // Jump rope animation
            const jumpPhase = (this.stateTime % jumpDuration) / jumpDuration;
            
            // Jump motion
            if (jumpPhase < 0.5) {
                const jumpT = jumpPhase * 2;
                this.body.position.y = Math.sin(jumpT * Math.PI) * 0.8;
            } else {
                this.body.position.y = 0;
            }

            // Arm rotation (rope motion)
            const armPhase = this.stateTime * Math.PI * 2 / jumpDuration;
            this.leftHand.position.set(2, 2 + Math.sin(armPhase) * 0.5, 0);
            this.rightHand.position.set(-2, 2 + Math.sin(armPhase) * 0.5, 0);
            this.leftHand.rotation.z = Math.sin(armPhase) * 0.5;
            this.rightHand.rotation.z = Math.sin(armPhase) * -0.5;

            // Leg tucking during jump
            if (jumpPhase < 0.5) {
                this.leftLeg.rotation.x = -0.5;
                this.rightLeg.rotation.x = -0.5;
            } else {
                this.leftLeg.rotation.x = 0;
                this.rightLeg.rotation.x = 0;
            }
        } else {
            // Cheer animation (jump with arms up)
            const cheerT = (this.stateTime - this.maxJumps * jumpDuration);
            const cheerPhase = cheerT * Math.PI * 4; // Fast bounce
            
            this.body.position.y = Math.abs(Math.sin(cheerPhase)) * 0.3;
            this.leftHand.position.set(2, 4, 0);
            this.rightHand.position.set(-2, 4, 0);
            this.leftHand.rotation.z = 0;
            this.rightHand.rotation.z = 0;
            
            this.leftLeg.rotation.x = 0;
            this.rightLeg.rotation.x = 0;
        }

        if (this.stateTime > totalPlayTime) {
            this.body.position.y = 0;
            this.setState('idle');
        }
    }

    updateSleeping(now, dt) {
        // Smooth transition to sleeping position
        const transitionTime = 1;
        const t = Math.min(this.stateTime / transitionTime, 1);
        
        // Lay down body rotation
        this.body.rotation.x = THREE.MathUtils.lerp(0, Math.PI / 2, t);
        this.body.position.y = THREE.MathUtils.lerp(0, -0.5, t);
        
        // Curl up
        this.leftLeg.rotation.x = THREE.MathUtils.lerp(0, 0.5, t);
        this.rightLeg.rotation.x = THREE.MathUtils.lerp(0, 0.5, t);
        
        this.leftHand.position.set(2, THREE.MathUtils.lerp(2, 1, t), 0);
        this.rightHand.position.set(-2, THREE.MathUtils.lerp(2, 1, t), 0);
        this.leftHand.rotation.z = THREE.MathUtils.lerp(0, 0.5, t);
        this.rightHand.rotation.z = THREE.MathUtils.lerp(0, -0.5, t);

        // Ears droop
        this.leftEarPivot.rotation.z = THREE.MathUtils.lerp(-Math.PI / 2, -Math.PI / 3, t);
        this.rightEarPivot.rotation.z = THREE.MathUtils.lerp(-Math.PI / 2, -Math.PI / 3, t);

        // Wake up after a long time (or can be triggered externally)
        if (this.stateTime > 30) { // 30 seconds
            if (Math.random() < 0.01) { // 1% chance per frame to wake up
                this.setState('idle');
            }
        }
    }

    update() {
        const now = performance.now() / 1000;
        const dt = now - this.lastTime;
        this.lastTime = now;
        this.stateTime += dt;

        if (this.isRagdoll) {
            this.updateRagdoll();
            return;
        }

        switch (this.state) {
            case 'idle':
                this.updateIdle(now, dt);
                break;
            case 'eating':
                this.updateEating(now, dt);
                break;
            case 'playing':
                this.updatePlaying(now, dt);
                break;
            case 'sleeping':
                this.updateSleeping(now, dt);
                break;
        }
    }
}