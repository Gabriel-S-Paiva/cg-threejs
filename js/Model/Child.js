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
        
        console.log('[Child] Constructor initialized');
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

        const texture = new THREE.TextureLoader().load('../../assets/face.png', () => {
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
        this.setState('idle');
    }

    createRagdollBodies() {
        if (!this.physicsWorld) return;
        
        const worldPos = new THREE.Vector3();
        this.getWorldPosition(worldPos);
        
        const scale = 0.8; 
        
        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(worldPos.x, worldPos.y, worldPos.z)
            .setLinearDamping(0.5) 
            .setAngularDamping(0.5); 
        this.bodyRigidBody = this.physicsWorld.createRigidBody(bodyDesc);
        
        const bodyCollider = RAPIER.ColliderDesc.ball(0.25 * scale, scale)
            .setRestitution(0.7)  
            .setFriction(0.3);  
        this.physicsWorld.createCollider(bodyCollider, this.bodyRigidBody);
        
        const impulse = {
            x: (Math.random() - 0.5) * 0.4, 
            y: Math.random() * 0.5 + 0.2, 
            z: (Math.random() - 0.5) * 0.4  
        };
        this.bodyRigidBody.applyImpulse(impulse, true);
        
        this.rigidBodies.push(this.bodyRigidBody);
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
    }

    updateRagdoll() {
        if (!this.bodyRigidBody) return;
        
        const pos = this.bodyRigidBody.translation();
        const rot = this.bodyRigidBody.rotation();
        
        const parentWorldPos = new THREE.Vector3();
        this.parent.getWorldPosition(parentWorldPos);
        
        this.position.set(
            pos.x - parentWorldPos.x,
            pos.y - parentWorldPos.y,
            pos.z - parentWorldPos.z
        );
        this.body.quaternion.set(rot.x, rot.y, rot.z, rot.w);
        this.currentPosition.copy(this.position);
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
              
                this.targetPosition.set(
                    (Math.random() - 0.5) * 6.4, 
                    0, 
                    (Math.random() - 0.5) * 3.2 
                );
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
