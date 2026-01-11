import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import Object from './Object.js';

export default class Child extends THREE.Group {
    constructor() {
        super();

        this.state = 'idle';
        this.stateTime = 0;
        this.lastTime = performance.now() / 1000;
        
        this.targetPosition = new THREE.Vector3(0, 0, 0);
        this.currentPosition = new THREE.Vector3(0, 0, 0);
        this.movementSpeed = 0.5;
        this.nextMoveTime = Math.random() * 3 + 2;
        
        this.position.set(0, 0, 0);
        
        this.camera = null;
        this.isLookingAtCamera = false;
        this.lookAtCameraTime = 0;
        this.nextCameraLookTime = Math.random() * 20 + 15;
        this.lookAtCameraDuration = 2;

        this.initMesh();

        this.animPhase = 0;
        this.jumpCount = 0;
        this.maxJumps = 5;
        
        this.physicsWorld = null;
        this.rigidBodies = [];
        this.isRagdoll = false;
        this.ragdollTimeout = null;
        
        this.foodObject = null;
        // one-shot pop sound for eating completion
        this.popPlayed = false;
        this.popSound = new Audio('../../assets/sound/pop.mp3');
        this.popSound.volume = 0.9;
        // bite sound settings: use a fresh Audio per chew to allow rapid successive bites
        this.biteUrl = '../../assets/sound/bite.mp3';
        this.biteOffset = 1.0; // seconds to skip leading silence
        this.biteVolume = 0.9;
        this.lastChew = -1;
        this.activeBiteSounds = [];
        
        this.isControlled = false;
        this.characterBody = null;
        this.yaw = 0;
        this.pitch = 0;
    }

    initMesh() {
        const earGeometry = new THREE.CapsuleGeometry(1, 1, 8, 24);
        const earMaterial = new THREE.MeshPhysicalMaterial({ color: '#000' });

        const earLeft = new THREE.Mesh(earGeometry, earMaterial);
        earLeft.scale.set(0.75, 1, 0.7);
        this.leftEarPivot = new THREE.Object3D();
        this.leftEarPivot.rotation.z = -Math.PI / 2;
        this.leftEarPivot.position.y = 1;
        earLeft.position.y = 1.5;
        this.leftEarPivot.add(earLeft);

        const earRight = new THREE.Mesh(earGeometry, earMaterial);
        earRight.scale.set(0.75, 1, 0.7);
        this.rightEarPivot = new THREE.Object3D();
        this.rightEarPivot.rotation.z = -Math.PI / 2;
        this.rightEarPivot.position.y = 3;
        earRight.position.y = 1.5;
        this.rightEarPivot.add(earRight);

        const headCurve = new THREE.CubicBezierCurve(
            new THREE.Vector2(0, 0),
            new THREE.Vector2(2, 0),
            new THREE.Vector2(2, 4),
            new THREE.Vector2(0, 4)
        );
        const headPoints = headCurve.getPoints(30);
        const headGeometry = new THREE.LatheGeometry(headPoints, 24);

        const texture = new THREE.TextureLoader().load('../../assets/textures/face_happy.png', () => {
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

        this.body.traverse((c) => {
            if (c.isMesh) {
                c.castShadow = true;
                c.receiveShadow = true;
            }
        });

        this.add(this.body);
    }

    removeCharacterBody() {
        if (this.characterBody && this.physicsWorld) {
            this.physicsWorld.removeRigidBody(this.characterBody);
        }
        this.characterBody = null;
    }

    createCharacterBody() {
        if (!this.physicsWorld || this.characterBody || this.isRagdoll) return;

        const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(this.position.x, this.position.y, this.position.z)
            .setLinearDamping(2.0)
            .lockRotations();
         
        this.characterBody = this.physicsWorld.createRigidBody(rigidBodyDesc);
         
        // Capsule collider: height 4 roughly on Y axis. Radius ~1.
        // Capsule center at Y=2.
        const colliderDesc = RAPIER.ColliderDesc.capsule(1.5, 1.0)
            .setTranslation(0, -1, -2.5)
            .setFriction(0.2)
            .setRestitution(0.0);
            
        this.physicsWorld.createCollider(colliderDesc, this.characterBody);
    }

    setPhysicsWorld(world) {
        this.physicsWorld = world;
    }
    
    setCamera(camera) {
        this.camera = camera;
    }

    resetTimer() {
        this.lastTime = performance.now() / 1000;
        this.nextMoveTime = Math.random() * 3 + 2;
    }

    setState(newState) {
        if (this.isRagdoll) return;
        // reset pop flag and chew index when entering eating state
        if (newState === 'eating') {
            this.popPlayed = false;
            this.lastChew = -1;
        }
        
        if (this.state !== newState) {
            if (this.state === 'sleeping') {
                this.body.rotation.set(0, 0, 0);
                this.body.position.y = 0;
                this.leftLeg.rotation.x = 0;
                this.rightLeg.rotation.x = 0;
                this.leftHand.position.set(2, 2, 0);
                this.rightHand.position.set(-2, 2, 0);
                this.leftHand.rotation.z = 0;
                this.rightHand.rotation.z = 0;
                this.isGettingUp = false;
            }
            
            this.state = newState;
            this.stateTime = 0;
            this.animPhase = 0;
            this.isLookingAtCamera = false;
            
            if (newState === 'idle') {
                this.body.rotation.set(0, 0, 0);
                this.body.position.y = 0;
            }
        }
    }

    enterRagdoll() {
        if (this.isRagdoll || !this.physicsWorld) return;

        // Remove controlled body
        this.removeCharacterBody();
        
        this.isRagdoll = true;
        this.previousState = this.state;
        this.state = 'ragdoll';
        
        if (this.ragdollTimeout) clearTimeout(this.ragdollTimeout);
        
        this.createRagdollBodies();
        this.ragdollTimeout = setTimeout(() => this.exitRagdoll(), 5000);
    }

    exitRagdoll() {
        this.isRagdoll = false;
        this.cleanupRagdollBodies();

        this.head.position.set(2, 4, 0);
        this.head.rotation.set(0, 0, Math.PI / 2); // Original rotation
        
        this.leftHand.position.set(2, 2, 0);
        this.leftHand.rotation.set(0, 0, 0);
        
        this.rightHand.position.set(-2, 2, 0);
        this.rightHand.rotation.set(0, 0, 0);
        
        this.body.position.set(0,0,0);
        this.body.rotation.set(0,0,0);

        this.rotation.x = 0;
        this.rotation.z = 0;
        
        this.createCharacterBody();
        this.setState('idle');
    }

    createRagdollBodies() {
        if (!this.physicsWorld) return;
        
        const scale = 0.8;
        const groupPos = new THREE.Vector3();
        const groupQuat = new THREE.Quaternion();
        this.getWorldPosition(groupPos);
        this.getWorldQuaternion(groupQuat);

        const getMeshTransform = (mesh) => {
            const pos = new THREE.Vector3();
            const quat = new THREE.Quaternion();
            mesh.getWorldPosition(pos);
            mesh.getWorldQuaternion(quat);
            return { pos, quat };
        };

        const getLocalAnchor = (tBody, targetPoint) => {
             const offset = targetPoint.clone().sub(tBody.pos);
             const invRotation = tBody.quat.clone().invert();
             offset.applyQuaternion(invRotation);
             return offset;
        }

        const tBody = getMeshTransform(this.body);
        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(tBody.pos.x, tBody.pos.y, tBody.pos.z)
            .setRotation(tBody.quat)
            .setLinearDamping(0)
            .setAngularDamping(0)
            .setCcdEnabled(true);
        
        if (this.currentWorldVelocity) {
            bodyDesc.setLinvel(
                this.currentWorldVelocity.x, 
                this.currentWorldVelocity.y, 
                this.currentWorldVelocity.z
            );
        }

        this.bodyRigidBody = this.physicsWorld.createRigidBody(bodyDesc);
        
        const bodyCollider = RAPIER.ColliderDesc.capsule(2 * scale, 2.0 * scale)
            .setTranslation(0, 3* scale, 0)
            .setRestitution(0.9)
            .setFriction(0.2)
            .setDensity(1.5);
        this.physicsWorld.createCollider(bodyCollider, this.bodyRigidBody);
        this.rigidBodies.push(this.bodyRigidBody);
        
        const tLHand = getMeshTransform(this.leftHand);
        const lHandDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(tLHand.pos.x, tLHand.pos.y, tLHand.pos.z)
            .setRotation(tLHand.quat)
            .setLinearDamping(0.1)
            .setAngularDamping(5.0);
            
        if (this.currentWorldVelocity) {
            lHandDesc.setLinvel(
                this.currentWorldVelocity.x, 
                this.currentWorldVelocity.y, 
                this.currentWorldVelocity.z
            );
        }

        this.lHandRigidBody = this.physicsWorld.createRigidBody(lHandDesc);
        const lHandCollider = RAPIER.ColliderDesc.ball(0.5 * scale)
            .setDensity(0.5)
            .setRestitution(0.8);
        this.physicsWorld.createCollider(lHandCollider, this.lHandRigidBody);
        this.rigidBodies.push(this.lHandRigidBody);

        const shoulderOffsetLeft = new THREE.Vector3(0.6, 2.0, 0).multiplyScalar(scale).applyQuaternion(tBody.quat).add(tBody.pos);
        const lShoulderAnchorBody = getLocalAnchor(tBody, shoulderOffsetLeft);
        const lShoulderAnchorHand = getLocalAnchor(tLHand, shoulderOffsetLeft);

        const lHandJoint = RAPIER.JointData.spherical(
            { x: lShoulderAnchorBody.x, y: lShoulderAnchorBody.y, z: lShoulderAnchorBody.z },
            { x: lShoulderAnchorHand.x, y: lShoulderAnchorHand.y, z: lShoulderAnchorHand.z }
        );
        this.physicsWorld.createImpulseJoint(lHandJoint, this.bodyRigidBody, this.lHandRigidBody, false);


        const tRHand = getMeshTransform(this.rightHand);
        const rHandDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(tRHand.pos.x, tRHand.pos.y, tRHand.pos.z)
            .setRotation(tRHand.quat)
            .setLinearDamping(0.1)
            .setAngularDamping(5.0);
            
        if (this.currentWorldVelocity) {
            rHandDesc.setLinvel(
                this.currentWorldVelocity.x, 
                this.currentWorldVelocity.y, 
                this.currentWorldVelocity.z
            );
        }

        this.rHandRigidBody = this.physicsWorld.createRigidBody(rHandDesc);
        const rHandCollider = RAPIER.ColliderDesc.ball(0.5 * scale)
            .setDensity(0.5)
            .setRestitution(0.8);
        this.physicsWorld.createCollider(rHandCollider, this.rHandRigidBody);
        this.rigidBodies.push(this.rHandRigidBody);

        const shoulderOffsetRight = new THREE.Vector3(-0.6, 2.0, 0).multiplyScalar(scale).applyQuaternion(tBody.quat).add(tBody.pos);
        const rShoulderAnchorBody = getLocalAnchor(tBody, shoulderOffsetRight);
        const rShoulderAnchorHand = getLocalAnchor(tRHand, shoulderOffsetRight);

        const rHandJoint = RAPIER.JointData.spherical(
            { x: rShoulderAnchorBody.x, y: rShoulderAnchorBody.y, z: rShoulderAnchorBody.z },
            { x: rShoulderAnchorHand.x, y: rShoulderAnchorHand.y, z: rShoulderAnchorHand.z }
        );
        this.physicsWorld.createImpulseJoint(rHandJoint, this.bodyRigidBody, this.rHandRigidBody, false);

        const applyRandomImpulse = (rb, multiplier = 1.0) => {
           const mass = rb.mass();
           const mag = (300 + Math.random() * 300) * (mass > 0 ? mass * 0.1 : 1) * multiplier;
           const ang = Math.random() * Math.PI * 2;
           const up = (150 + Math.random() * 150) * (mass > 0 ? mass * 0.1 : 1) * multiplier;
           
           rb.applyImpulse({
               x: Math.cos(ang) * mag,
               y: up,
               z: Math.sin(ang) * mag
           }, true);
           
           rb.applyTorqueImpulse({
                x: (Math.random()-0.5) * mag * 0.5,
                y: (Math.random()-0.5) * mag * 0.5,
                z: (Math.random()-0.5) * mag * 0.5
           }, true);
        };

        applyRandomImpulse(this.bodyRigidBody, 1.0);
        
        applyRandomImpulse(this.lHandRigidBody, 0.5);
        applyRandomImpulse(this.rHandRigidBody, 0.5);
    }

    cleanupRagdollBodies() {
        if (!this.physicsWorld) return;
        
        this.rigidBodies.forEach(rb => {
            if (rb && this.physicsWorld.bodies.contains(rb.handle)) {
                this.physicsWorld.removeRigidBody(rb);
            }
        });
        this.rigidBodies = [];
        this.bodyRigidBody = null;
        this.lHandRigidBody = null;
        this.rHandRigidBody = null;
    }

    updateRagdoll() {
        if (!this.bodyRigidBody) return;
        
        const bPos = this.bodyRigidBody.translation();
        const bRot = this.bodyRigidBody.rotation();
        
        const worldPos = new THREE.Vector3(bPos.x, bPos.y, bPos.z);
        const worldQuat = new THREE.Quaternion(bRot.x, bRot.y, bRot.z, bRot.w);
        
        const localPos = this.worldToLocal(worldPos.clone());
        
        const parentWorldQuat = new THREE.Quaternion();
        this.getWorldQuaternion(parentWorldQuat);
        const localQuat = parentWorldQuat.invert().multiply(worldQuat.clone());
        
        this.body.position.copy(localPos);
        this.body.quaternion.copy(localQuat);
        
        const syncLimb = (mesh, rb) => {
             if (!rb || !mesh) return;
             const rPos = rb.translation();
             const rRot = rb.rotation();
             
             const rWorldPos = new THREE.Vector3(rPos.x, rPos.y, rPos.z);
             const rWorldQuat = new THREE.Quaternion(rRot.x, rRot.y, rRot.z, rRot.w);
             
             this.body.updateMatrixWorld(true);
             
             const lPos = this.body.worldToLocal(rWorldPos);
             
             const bodyWorldQuat = new THREE.Quaternion();
             this.body.getWorldQuaternion(bodyWorldQuat);
             const lQuat = bodyWorldQuat.invert().multiply(rWorldQuat);
             
             mesh.position.copy(lPos);
             mesh.quaternion.copy(lQuat);
        };
        
        syncLimb(this.leftHand, this.lHandRigidBody);
        syncLimb(this.rightHand, this.rHandRigidBody);

        this.currentPosition.copy(this.body.position);
    }

    updateIdle(now, dt) {
        // LAYERED EAR ANIMATION
        // Primary gentle sway: 3-second cycle
        const earPrimary = now * 2 * Math.PI / 3;
        // Secondary micro-flutter: 1.7-second cycle for liveliness
        const earSecondary = now * 2 * Math.PI / 1.7;
        // Amplitudes: primary is gentle, secondary is subtle
        const earAmpPrimary = Math.PI / 32;
        const earAmpSecondary = Math.PI / 128;
        
        // Asymmetric ear motion (left/right slightly different phases)
        this.leftEarPivot.rotation.z = 
            (earAmpPrimary * Math.sin(earPrimary) + earAmpSecondary * Math.sin(earSecondary)) - Math.PI / 2;
        this.rightEarPivot.rotation.z = 
            (earAmpPrimary * -Math.sin(earPrimary + 0.3) + earAmpSecondary * -Math.sin(earSecondary + 0.5)) - Math.PI / 2;

        // BREATHING - subtle idle breathing (5-second cycle)
        const breathPhase = now * 2 * Math.PI / 5;
        const breathAmp = 0.02; // Very subtle vertical motion
        this.body.position.y = Math.sin(breathPhase) * breathAmp;

        // HEAD MICRO-MOTION - tiny idle curiosity
        const headBob = now * 2 * Math.PI / 4;
        this.head.rotation.x = Math.sin(headBob) * 0.02;

        this.nextCameraLookTime -= dt;
        if (this.nextCameraLookTime <= 0 && !this.isLookingAtCamera) {
            this.isLookingAtCamera = true;
            this.lookAtCameraTime = 0;
            this.nextCameraLookTime = Math.random() * 20 + 15;
        }
        
        if (this.isLookingAtCamera) {
            this.lookAtCameraTime += dt;
            if (this.lookAtCameraTime > this.lookAtCameraDuration) {
                this.isLookingAtCamera = false;
            }
        }

        if (!this.isLookingAtCamera) {
            this.nextMoveTime -= dt;
            if (this.nextMoveTime <= 0) {
                let attempts = 0;
                let found = false;
                
                while (attempts < 10 && !found) {
                    const tx = (Math.random() - 0.5) * 6.4;
                    const tz = (Math.random() - 0.5) * 3.2;
                    
                    if (this.physicsWorld) {
                         const startLocal = new THREE.Vector3(this.currentPosition.x, 1.0, this.currentPosition.z);
                         const endLocal = new THREE.Vector3(tx, 1.0, tz);
                         
                         const startWorld = startLocal.clone().applyMatrix4(this.matrixWorld);
                         const endWorld = endLocal.clone().applyMatrix4(this.matrixWorld);
                         
                         const dir = new THREE.Vector3().subVectors(endWorld, startWorld);
                         const dist = dir.length();
                         
                         if (dist > 0.1) {
                             dir.normalize();
                             const ray = new RAPIER.Ray({x: startWorld.x, y: startWorld.y, z: startWorld.z}, {x: dir.x, y: dir.y, z: dir.z});
                             const hit = this.physicsWorld.castRay(ray, dist, true);
                             
                             if (!hit) {
                                 this.targetPosition.set(tx, 0, tz);
                                 found = true;
                             }
                         } else {
                             found = true;
                         }
                    } else {
                         this.targetPosition.set(tx, 0, tz);
                         found = true;
                    }
                    attempts++;
                }

                this.nextMoveTime = Math.random() * 3 + 2;
            }

            const previousPosition = this.currentPosition.clone();
            this.currentPosition.lerp(this.targetPosition, dt * this.movementSpeed);
            this.currentPosition.y = 0;
            // play a single bite sound once per chew (detect chew index transitions)
            try {
                const numChews = 6;
                const chewIndex = Math.floor(eatT * numChews);
                if (chewIndex !== this.lastChew && chewIndex < numChews) {
                    try { this.biteSound.currentTime = this.biteOffset; } catch(e){}
                    this.biteSound.play().catch(()=>{});
                    this.lastChew = chewIndex;
                }
            } catch (e) {}
        } else {
            if (this.camera) {
                const worldPos = new THREE.Vector3();
                this.getWorldPosition(worldPos);
                const cameraDirection = new THREE.Vector3().subVectors(this.camera.position, worldPos);
                const targetAngle = Math.atan2(cameraDirection.x, cameraDirection.z);
                this.rotation.y = THREE.MathUtils.lerp(this.rotation.y, targetAngle, dt * 3);
            }
        }

        if (!this.isLookingAtCamera) {
            // WALKING ANIMATION - organic leg motion
            const walkSpeed = this.currentPosition.distanceTo(this.targetPosition) * 2;
            const walkPhase = now * Math.PI * 4 * Math.max(walkSpeed, 0.5);
            
            // Legs swing with slight offset for natural gait
            this.leftLeg.rotation.x = Math.sin(walkPhase) * 0.12;
            this.rightLeg.rotation.x = Math.sin(walkPhase + Math.PI) * 0.12;

            // ARM MOTION - relaxed sway while walking
            // Primary sway: 1.5-second cycle
            const armPrimary = now * 2 * Math.PI / 1.5;
            // Secondary bounce from walking
            const armBounce = walkPhase * 0.5;
            
            // Asymmetric arm swing
            this.leftHand.position.y = 2 + Math.sin(armPrimary) * 0.15 + Math.abs(Math.sin(armBounce)) * 0.08;
            this.leftHand.rotation.z = Math.sin(armPrimary) * 0.25;
            
            this.rightHand.position.y = 2 + Math.sin(armPrimary + 1.2) * 0.15 + Math.abs(Math.sin(armBounce + Math.PI)) * 0.08;
            this.rightHand.rotation.z = Math.sin(armPrimary + 1.2) * 0.25;
        } else {
            // LOOKING AT CAMERA - curious pose with subtle life
            const curiousPhase = now * 2 * Math.PI / 3;
            
            this.body.position.y = Math.sin(breathPhase) * breathAmp; // Keep breathing
            this.leftLeg.rotation.x = 0;
            this.rightLeg.rotation.x = 0;
            
            // Hands show curiosity - gentle motion
            this.leftHand.position.y = 2 + Math.sin(curiousPhase) * 0.05;
            this.rightHand.position.y = 2 + Math.sin(curiousPhase + 0.5) * 0.05;
            this.leftHand.rotation.z = Math.sin(curiousPhase) * 0.1;
            this.rightHand.rotation.z = Math.sin(curiousPhase + 0.5) * -0.1;
        }
    }

    updateEating(now, dt) {
        // EARS - excited happy wiggle while eating
        const earExcited = now * 2 * Math.PI / 0.8; // Fast wiggle - 0.8s cycle
        const earGentle = now * 2 * Math.PI / 2.5; // Slow sway - 2.5s cycle
        const earAmpExcited = Math.PI / 24;
        const earAmpGentle = Math.PI / 48;
        
        this.leftEarPivot.rotation.z = 
            (earAmpExcited * Math.sin(earExcited) + earAmpGentle * Math.sin(earGentle)) - Math.PI / 2;
        this.rightEarPivot.rotation.z = 
            (earAmpExcited * -Math.sin(earExcited + 0.4) + earAmpGentle * -Math.sin(earGentle + 0.6)) - Math.PI / 2;

        const eatDuration = 4; // Simplified timing
        const t = this.stateTime / eatDuration;

        // Create food object at start if not exists
        if (!this.foodObject && t < 0.95) {
            this.foodObject = new Object('../../assets/models/ice_cream.glb');
            this.foodObject.scale.set(1, 1, 1); // Small food size
            this.foodObject.rotation.z = -Math.PI / 6
            this.rightHand.add(this.foodObject);
            this.foodObject.position.set(0, 1, 0); // Position relative to hand
        }

        // EATING SEQUENCE - singular motions
        if (t < 0.35) {
            // REACH to mouth - single smooth motion
            const reachT = t / 0.35;
            const eased = 1 - Math.pow(1 - reachT, 3); // Cubic ease-out
            
            this.rightHand.position.set(
                -2 + 2.1 * eased,
                2 + 0 * eased - 0.2 * Math.sin(reachT * Math.PI), // Arc path
                1.5 * Math.sin(reachT * Math.PI / 2) // Forward motion
            );
            this.rightHand.rotation.z = -0.2 + 0.4 * eased;
        } else if (t < 0.65) {
            // EATING at mouth - gentle chewing motion
            const eatT = (t - 0.35) / 0.3;
            const chewPhase = eatT * Math.PI * 6; // 6 chews
            // play a single bite sound once per chew (create a new Audio so bites can overlap)
            try {
                const numChews = 6;
                const chewIndex = Math.floor(eatT * numChews);
                if (chewIndex !== this.lastChew && chewIndex < numChews) {
                    const s = new Audio(this.biteUrl);
                    s.volume = this.biteVolume;
                    try { s.currentTime = this.biteOffset; } catch(e){}
                    try { s.playbackRate = 1 + eatT * 0.6; } catch(e){}
                    s.play().catch(()=>{});
                    // track active bite sounds so we can stop them on pop/cleanup
                    this.activeBiteSounds.push(s);
                    const cleanupFn = () => {
                        const i = this.activeBiteSounds.indexOf(s);
                        if (i !== -1) this.activeBiteSounds.splice(i, 1);
                        s.removeEventListener('ended', cleanupFn);
                    };
                    s.addEventListener('ended', cleanupFn);
                    this.lastChew = chewIndex;
                }
            } catch (e) {}
            
            this.rightHand.position.set(
                0.1 + Math.sin(chewPhase * 2) * 0.08,
                2 + Math.sin(chewPhase) * 0.1,
                1.5 + Math.sin(chewPhase) * 0.05
            );
            this.rightHand.rotation.z = 0.2 + Math.sin(chewPhase) * 0.12;
            
            // HEAD NODS with chewing
            this.head.rotation.x = Math.sin(chewPhase) * 0.08;
        } else {
            // clear lastChew when leaving chewing phase and stop any active bite sounds
            this.lastChew = -1;
            if (this.activeBiteSounds.length) {
                this.activeBiteSounds.forEach(s => { try { s.pause(); s.currentTime = 0; } catch(e){} });
                this.activeBiteSounds.length = 0;
            }
            if (this.foodObject) {
                this.rightHand.remove(this.foodObject);
                if (!this.popPlayed) {
                    try { this.popSound.currentTime = 0; } catch(e){}
                    this.popSound.play().catch(()=>{});
                    this.popPlayed = true;
                }
                this.foodObject = null;
            }
            // RETURN - single smooth motion back
            const returnT = (t - 0.65) / 0.35;
            const eased = Math.pow(returnT, 2); // Quadratic ease-in
            
            this.rightHand.position.set(
                0.1 - 2.1 * eased,
                2,
                1.5 * (1 - eased)
            );
            this.rightHand.rotation.z = 0.2 - 0.4 * eased;            
        }

        // LEFT HAND - supportive gentle motion
        const supportPhase = now * 2 * Math.PI / 2;
        this.leftHand.position.set(2, 2 + Math.sin(supportPhase) * 0.08, Math.sin(supportPhase * 0.5) * 0.1);
        this.leftHand.rotation.z = Math.sin(supportPhase) * 0.08;

        // BODY - happy bounce while eating
        const happyBounce = now * 2 * Math.PI / 1.2;
        this.body.position.y = Math.abs(Math.sin(happyBounce)) * 0.05;

        // LEGS - relaxed idle motion
        const legPhase = now * 2 * Math.PI / 3;
        this.leftLeg.rotation.x = Math.sin(legPhase) * 0.05;
        this.rightLeg.rotation.x = Math.sin(legPhase + 1) * 0.05;

        if (this.stateTime > eatDuration) {
            // Clean up food object
            if (this.foodObject) {
                this.rightHand.remove(this.foodObject);
                this.foodObject = null;
            }
            // reset chew index and stop any active bite sounds when eating ends
            this.lastChew = -1;
            if (this.activeBiteSounds.length) {
                this.activeBiteSounds.forEach(s => { try { s.pause(); s.currentTime = 0; } catch(e){} });
                this.activeBiteSounds.length = 0;
            }
            this.setState('idle');
        }
    }

    updatePlaying(now, dt) {
        // EARS - very excited bouncy motion
        const earBounce = now * 2 * Math.PI / 0.5; // Super fast - 0.5s cycle
        const earFlow = now * 2 * Math.PI / 2; // Underlying flow - 2s cycle
        const earAmpBounce = Math.PI / 20;
        const earAmpFlow = Math.PI / 40;
        
        this.leftEarPivot.rotation.z = 
            (earAmpBounce * Math.sin(earBounce) + earAmpFlow * Math.sin(earFlow)) - Math.PI / 2;
        this.rightEarPivot.rotation.z = 
            (earAmpBounce * -Math.sin(earBounce + 0.5) + earAmpFlow * -Math.sin(earFlow + 0.8)) - Math.PI / 2;

        const totalPlayTime = 6; // Total celebration time

        // CELEBRATION PHASE ONLY - happy wiggling and bouncing
        if (true) {
            // CELEBRATION PHASE - happy wiggling
            const celebrateT = this.stateTime;
            const cheerPhase = celebrateT * Math.PI * 3; 
            const wigglePhase = celebrateT * Math.PI * 6;
            
            // Bouncy celebration
            this.body.position.y = Math.abs(Math.sin(cheerPhase)) * 0.25;
            this.body.rotation.z = Math.sin(wigglePhase) * 0.08;
            
            // Arms raised in victory with wave
            const wavePhase = celebrateT * Math.PI * 4;
            this.leftHand.position.set(
                2 + Math.sin(wavePhase) * 0.3,
                3.8 + Math.sin(wavePhase * 2) * 0.2,
                0
            );
            this.rightHand.position.set(
                -2 + Math.sin(wavePhase + 1) * 0.3,
                3.8 + Math.sin(wavePhase * 2 + 1) * 0.2,
                0
            );
            this.leftHand.rotation.z = Math.sin(wavePhase) * 0.3;
            this.rightHand.rotation.z = Math.sin(wavePhase + 1) * -0.3;
            
            // Legs bounce
            this.leftLeg.rotation.x = Math.sin(cheerPhase) * 0.1;
            this.rightLeg.rotation.x = Math.sin(cheerPhase + 0.5) * 0.1;
            
            // Head happy nod
            this.head.rotation.x = Math.sin(cheerPhase * 1.5) * 0.08;
        }

        if (this.stateTime > totalPlayTime) {
            this.body.position.y = 0;
            this.body.rotation.x = 0;
            this.body.rotation.z = 0;
            this.head.rotation.x = 0;
            this.setState('idle');
        }
    }

    updateSleeping(now, dt) {
        // SITTING ON CHAIR - resting animation with jump
        const walkTime = 1.5; // Time to walk to chair
        const jumpTime = 0.8; // Time to jump onto chair
        const transitionTime = walkTime + jumpTime;
        const t = Math.min(this.stateTime / transitionTime, 1);
        
        // Chair position - stop before chair to jump
        const approachPos = new THREE.Vector3(1, 0, -1.5); // Stop 0.8 units before chair
        const chairPos = new THREE.Vector3(2.3, 0.6, -3.1); // Correct sitting position
        
        // PHASE 1: WALK TO APPROACH POSITION
        if (this.stateTime < walkTime) {
            const walkT = this.stateTime / walkTime;
            const walkEase = 1 - Math.pow(1 - walkT, 3);
            
            // Walking to approach position
            this.currentPosition.lerp(approachPos, walkEase);
            this.position.copy(this.currentPosition);
            
            // Face the chair direction
            const targetAngle = Math.atan2(approachPos.x - this.currentPosition.x, approachPos.z - this.currentPosition.z);
            this.rotation.y = THREE.MathUtils.lerp(this.rotation.y, targetAngle, dt * 3);
            
            // Walking animation
            const walkPhase = now * Math.PI * 4;
            this.leftLeg.rotation.x = Math.sin(walkPhase) * 0.12;
            this.rightLeg.rotation.x = Math.sin(walkPhase + Math.PI) * 0.12;
            
            this.body.position.y = 0;
            this.body.rotation.y = THREE.MathUtils.lerp(0, -Math.PI / 4, walkT);
        
        // PHASE 2: JUMP ONTO CHAIR
        } else if (this.stateTime < transitionTime) {
            const jumpT = (this.stateTime - walkTime) / jumpTime;
            const jumpEase = jumpT < 0.5 ? 2 * jumpT * jumpT : 1 - Math.pow(-2 * jumpT + 2, 2) / 2;
            
            // Move from approach position to chair with arc
            this.currentPosition.x = THREE.MathUtils.lerp(approachPos.x, chairPos.x, jumpEase);
            this.currentPosition.z = THREE.MathUtils.lerp(approachPos.z, chairPos.z, jumpEase);
            this.currentPosition.y = 0;
            this.position.copy(this.currentPosition);
            
            // Jump arc
            const jumpArc = Math.sin(jumpT * Math.PI) + 1.6;
            this.body.position.y = jumpArc;
            
            // Legs tuck during jump
            const tuckAmount = Math.sin(jumpT * Math.PI) * 0.6;
            this.leftLeg.rotation.x = tuckAmount;
            this.rightLeg.rotation.x = tuckAmount;
            
            // Arms up during jump
            this.leftHand.position.y = 2 + Math.sin(jumpT * Math.PI) * 0.8;
            this.rightHand.position.y = 2 + Math.sin(jumpT * Math.PI) * 0.8;
            
        // PHASE 3: SETTLE INTO SITTING
        } else {
            const settleT = Math.min((this.stateTime - transitionTime) / 0.5, 1);
            const settleEase = 1 - Math.pow(1 - settleT, 3);
            
            // Final position on chair
            this.currentPosition.copy(chairPos);
            this.position.copy(this.currentPosition);
            
            // Settle body height to sitting position (1.6 to match sitting pose)
            this.body.position.y = THREE.MathUtils.lerp(0.8, 1.6, settleEase);
            
            // Legs into sitting position (match final sitting pose)
            this.leftLeg.rotation.x = THREE.MathUtils.lerp(0.6, -Math.PI / 2, settleEase);
            this.leftLeg.position.y = THREE.MathUtils.lerp(0, 0.75, settleEase);
            this.leftLeg.position.z = THREE.MathUtils.lerp(0, 1.75, settleEase);
            this.rightLeg.rotation.x = THREE.MathUtils.lerp(0.6, -Math.PI / 2, settleEase);
            this.rightLeg.position.y = THREE.MathUtils.lerp(0, 0.75, settleEase);
            this.rightLeg.position.z = THREE.MathUtils.lerp(0, 1.75, settleEase);
            
            // Arms back down to sitting position
            this.leftHand.position.y = THREE.MathUtils.lerp(2.8, 1.8, settleEase);
            this.leftHand.position.z = THREE.MathUtils.lerp(0, 0.5, settleEase);
            this.rightHand.position.y = THREE.MathUtils.lerp(2.8, 1.8, settleEase);
            this.rightHand.position.z = THREE.MathUtils.lerp(0, 1.3, settleEase);
        }
        
        // SITTING POSE
        if (this.stateTime >= transitionTime + 0.5) {
            const sitTime = this.stateTime - transitionTime - 0.5;
            
            // Ensure on chair position
            const chairPos = new THREE.Vector3(2.3, 0.6, -3.1);
            this.currentPosition.copy(chairPos);
            this.position.copy(this.currentPosition);
            
            // Legs in sitting position
            this.leftLeg.rotation.x = - Math.PI / 2
            this.leftLeg.position.y =  0.75
            this.leftLeg.position.z = 1.75
            this.rightLeg.rotation.x = - Math.PI / 2
            this.rightLeg.position.y =  0.75
            this.rightLeg.position.z = 1.75
            
            // BREATHING - gentle resting breathing (6-second cycle)
            const breathCycle = sitTime * 2 * Math.PI / 6;
            const breathAmp = 0.04; // Subtle
            this.body.position.y = 1.6 + Math.sin(breathCycle) * breathAmp;
            this.body.rotation.y = -Math.PI / 4
            
            // HEAD - occasional look around (relaxed)
            const lookPhase = sitTime * 2 * Math.PI / 8;
            this.head.rotation.x = Math.sin(lookPhase * 0.5) * 0.05;
            
            // EARS - relaxed gentle sway
            const earRelax = sitTime * 2 * Math.PI / 4;
            this.leftEarPivot.rotation.z = -Math.PI / 2 + Math.sin(earRelax) * 0.05;
            this.rightEarPivot.rotation.z = -Math.PI / 2 + Math.sin(earRelax + 0.5) * 0.05;
            
            // HANDS - resting on lap/sides
            this.leftHand.position.set(1.7, 1.8, 0.8);
            this.rightHand.position.set(-1.7, 1.8 , 1.3);
        }
        
        // GETTING UP - check if should stand
        if (this.stateTime > 30) { 
            if (Math.random() < 0.01) {
                this.isGettingUp = true;
                this.getUpStartTime = this.stateTime;
            }
        }
        
        // GET UP SEQUENCE
        if (this.isGettingUp) {
            const getUpElapsed = this.stateTime - (this.getUpStartTime || this.stateTime);
            const getUpDuration = 1.5;
            const getUpT = Math.min(getUpElapsed / getUpDuration, 1);
            
            if (getUpT < 1) {
                const standEase = getUpT < 0.5 ? 2 * getUpT * getUpT : 1 - Math.pow(-2 * getUpT + 2, 2) / 2;
                
                const landPos = new THREE.Vector3(1, 0, -1.5);
                this.currentPosition.lerp(landPos, standEase);
                this.position.copy(this.currentPosition);
                
                this.leftLeg.rotation.x = THREE.MathUtils.lerp(-Math.PI / 2, 0, standEase);
                this.leftLeg.position.y = THREE.MathUtils.lerp(0.75, -0.5, standEase);
                this.leftLeg.position.z = THREE.MathUtils.lerp(1.75, 0, standEase);
                this.rightLeg.rotation.x = THREE.MathUtils.lerp(-Math.PI / 2, 0, standEase);
                this.rightLeg.position.y = THREE.MathUtils.lerp(0.75, -0.5, standEase);
                this.rightLeg.position.z = THREE.MathUtils.lerp(1.75, 0, standEase);
                
                this.body.position.y = THREE.MathUtils.lerp(1.6, 0, standEase);
                this.body.rotation.y = THREE.MathUtils.lerp(-Math.PI / 4, 0, standEase);
                
                this.leftHand.position.set(2, THREE.MathUtils.lerp(1.8, 2, standEase), THREE.MathUtils.lerp(0.5, 0, standEase));
                this.rightHand.position.set(-1.5, THREE.MathUtils.lerp(1.8, 2, standEase), THREE.MathUtils.lerp(1.3, 0, standEase));
                this.leftHand.rotation.z = THREE.MathUtils.lerp(0.2, 0, standEase);
                this.rightHand.rotation.z = THREE.MathUtils.lerp(-0.2, 0, standEase);
                
                this.leftEarPivot.rotation.z = -Math.PI / 2;
                this.rightEarPivot.rotation.z = -Math.PI / 2;
                
                this.head.rotation.x = THREE.MathUtils.lerp(0.05, 0, standEase);
                
            } else {
                // finalize standing pose & ensure idle movement resumes
                this.currentPosition.set(1, 0, -1.5);
                this.position.copy(this.currentPosition);
                this.targetPosition.copy(this.currentPosition);
                this.body.position.y = 0;
                // restore leg transforms to defaults (match initMesh)
                this.leftLeg.position.set(0.8, -0.5, 0);
                this.rightLeg.position.set(-0.8, -0.5, 0);
                this.leftLeg.rotation.x = 0;
                this.rightLeg.rotation.x = 0;
                this.isGettingUp = false;
                this.getUpStartTime = null;
                // reset timers so the idle movement logic will pick a new target soon
                this.resetTimer();
                this.setState('idle');
            }
        }
    }

    getHeadPosition() {
        const pos = new THREE.Vector3();
        if (this.head) {
            this.head.getWorldPosition(pos);
        } else {
            this.getWorldPosition(pos);
            pos.y += 4;
        }
        return pos;
    }
    
    updateControlled(dt, inputVector, cameraRotation) {
        if (!this.characterBody) return;

        const speed = 10.0;
                
        const velocity = new THREE.Vector3(inputVector.x, 0, inputVector.y);
        velocity.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotation);
        velocity.normalize().multiplyScalar(speed);
        
        const currentVel = this.characterBody.linvel();
        this.characterBody.setLinvel({ x: velocity.x, y: currentVel.y, z: velocity.z }, true);
        
        
        this.rotation.y = cameraRotation;
    }

    update() {
        const now = performance.now() / 1000;
        const dt = now - this.lastTime;
        this.lastTime = now;
        this.stateTime += dt;
        
        const worldPos = new THREE.Vector3();
        this.getWorldPosition(worldPos);
        if (this.previousWorldPos) {
            const timeStep = Math.max(dt, 0.001);
            this.currentWorldVelocity = worldPos.clone().sub(this.previousWorldPos).divideScalar(timeStep);
        } else {
            this.currentWorldVelocity = new THREE.Vector3(0, 0, 0);
        }
        this.previousWorldPos = worldPos;

        if (this.isRagdoll) {
            this.updateRagdoll();
            return;
        }

        if (this.isControlled) {
            if (this.physicsWorld && !this.characterBody) {
                this.createCharacterBody();
            }
        } else {
            if (this.characterBody) {
                this.removeCharacterBody();
            }
        }
        
        if (this.characterBody) {
            const t = this.characterBody.translation();
            const r = this.characterBody.rotation();
            this.position.set(t.x, t.y, t.z);
            if (!this.isControlled) {
                this.quaternion.set(r.x, r.y, r.z, r.w);
            }
        }

        if (this.isControlled) {
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
