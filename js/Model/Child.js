import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

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
        
        if (this.state !== newState) {
            if (this.state === 'sleeping') {
                this.body.rotation.set(0, 0, 0);
                this.body.position.y = 0;
                this.leftLeg.rotation.x = 0;
                this.rightLeg.rotation.x = 0;
                this.leftHand.position.y = 2;
                this.rightHand.position.y = 2;
                this.leftHand.rotation.z = 0;
                this.rightHand.rotation.z = 0;
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
        const earPhase = now * 2 * Math.PI / 3;
        const earAmplitude = Math.PI / 32;
        this.leftEarPivot.rotation.z = (earAmplitude * Math.sin(earPhase)) - Math.PI / 2;
        this.rightEarPivot.rotation.z = (earAmplitude * -Math.sin(earPhase)) - Math.PI / 2;

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
            
            this.position.copy(this.currentPosition);
            
            const movementDirection = new THREE.Vector3().subVectors(this.currentPosition, previousPosition);
            if (movementDirection.length() > 0.001) {
                const targetAngle = Math.atan2(movementDirection.x, movementDirection.z);
                this.rotation.y = THREE.MathUtils.lerp(this.rotation.y, targetAngle, dt * 5);
            }
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
            const walkSpeed = this.currentPosition.distanceTo(this.targetPosition) * 2;
            const walkPhase = now * Math.PI * 4 * Math.max(walkSpeed, 0.5);
                        
            this.leftLeg.rotation.x = Math.sin(walkPhase) * 0.1;
            this.rightLeg.rotation.x = Math.sin(walkPhase + Math.PI) * 0.1;

            const armSpeed = 1.5;
            const horizontalPhase = now * armSpeed;
            
            this.leftHand.position.y = 2 + Math.sin(horizontalPhase) * 0.2;
            this.leftHand.rotation.z = Math.sin(horizontalPhase) * 0.3;
            
            this.rightHand.position.y = 2 + Math.sin(horizontalPhase + Math.PI) * 0.2;
            this.rightHand.rotation.z = Math.sin(horizontalPhase + Math.PI) * 0.3;
        } else {
            this.body.position.y = 0;
            this.leftLeg.rotation.x = 0;
            this.rightLeg.rotation.x = 0;
            
            this.leftHand.position.y = 2;
            this.rightHand.position.y = 2;
            this.leftHand.rotation.z = 0;
            this.rightHand.rotation.z = 0;
        }
    }

    updateEating(now, dt) {
        const earPhase = now * 2 * Math.PI / 3;
        const earAmplitude = Math.PI / 32;
        this.leftEarPivot.rotation.z = (earAmplitude * Math.sin(earPhase)) - Math.PI / 2;
        this.rightEarPivot.rotation.z = (earAmplitude * -Math.sin(earPhase)) - Math.PI / 2;

        const eatDuration = 4;
        const t = this.stateTime / eatDuration;

        if (t < 0.3) {
            const reachT = t / 0.3;
            this.rightHand.position.set(-2, 2, 1 * reachT);
        } else if (t < 0.6) {
            const bringT = (t - 0.3) / 0.3;
            this.rightHand.position.set(
                -2 + 2 * bringT,
                2 + 1 * bringT,
                2 - 0.3 * bringT
            );
        } else if (t < 0.8) {
            const eatT = (t - 0.6) / 0.2;
            this.rightHand.position.set(0, 3, 2.3);
            this.rightHand.rotation.z = Math.sin(eatT * Math.PI * 4) * 0.2;
        } else {
            const returnT = (t - 0.8) / 0.2;
            this.rightHand.position.set(
                0 - 2 * returnT,
                3 - 1 * returnT,
                1 - 0.3 * returnT
            );
        }

        this.leftHand.position.set(2, 2 + Math.sin(now * 2) * 0.1, 0);
        this.leftHand.rotation.z = 0;

        this.leftLeg.rotation.set(0, 0, 0);
        this.rightLeg.rotation.set(0, 0, 0);

        if (this.stateTime > eatDuration) {
            this.setState('idle');
        }
    }

    updatePlaying(now, dt) {
        const earPhase = now * 2 * Math.PI / 3;
        const earAmplitude = Math.PI / 32;
        this.leftEarPivot.rotation.z = (earAmplitude * Math.sin(earPhase)) - Math.PI / 2;
        this.rightEarPivot.rotation.z = (earAmplitude * -Math.sin(earPhase)) - Math.PI / 2;

        const jumpDuration = 1.2; 
        const totalPlayTime = this.maxJumps * jumpDuration + 1; 

        if (this.stateTime < this.maxJumps * jumpDuration) {
            const jumpPhase = (this.stateTime % jumpDuration) / jumpDuration;
            
            if (jumpPhase < 0.5) {
                const jumpT = jumpPhase * 2;
                this.body.position.y = Math.sin(jumpT * Math.PI) * 0.8;
            } else {
                this.body.position.y = 0;
            }

            const armPhase = this.stateTime * Math.PI * 2 / jumpDuration;
            this.leftHand.position.set(2, 2 + Math.sin(armPhase) * 0.5, 0);
            this.rightHand.position.set(-2, 2 + Math.sin(armPhase) * 0.5, 0);
            this.leftHand.rotation.z = Math.sin(armPhase) * 0.5;
            this.rightHand.rotation.z = Math.sin(armPhase) * -0.5;

            if (jumpPhase < 0.5) {
                this.leftLeg.rotation.x = -0.5;
                this.rightLeg.rotation.x = -0.5;
            } else {
                this.leftLeg.rotation.x = 0;
                this.rightLeg.rotation.x = 0;
            }
        } else {
            const cheerT = (this.stateTime - this.maxJumps * jumpDuration);
            const cheerPhase = cheerT * Math.PI * 4; 
            
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
        const transitionTime = 1;
        const t = Math.min(this.stateTime / transitionTime, 1);
        
        this.body.rotation.x = THREE.MathUtils.lerp(0, Math.PI / 2, t);
        this.body.position.y = THREE.MathUtils.lerp(0, -0.5, t);
        
        this.leftLeg.rotation.x = THREE.MathUtils.lerp(0, 0.5, t);
        this.rightLeg.rotation.x = THREE.MathUtils.lerp(0, 0.5, t);
        
        this.leftHand.position.set(2, THREE.MathUtils.lerp(2, 1, t), 0);
        this.rightHand.position.set(-2, THREE.MathUtils.lerp(2, 1, t), 0);
        this.leftHand.rotation.z = THREE.MathUtils.lerp(0, 0.5, t);
        this.rightHand.rotation.z = THREE.MathUtils.lerp(0, -0.5, t);

        this.leftEarPivot.rotation.z = THREE.MathUtils.lerp(-Math.PI / 2, -Math.PI / 3, t);
        this.rightEarPivot.rotation.z = THREE.MathUtils.lerp(-Math.PI / 2, -Math.PI / 3, t);

        if (this.stateTime > 30) { 
            if (Math.random() < 0.01) { 
                this.setState('idle');
            }
        }
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
