import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CSG } from 'three-csg-ts';
import RAPIER from '@dimforge/rapier3d-compat';

import Button from './Button.js';
import Tamagoshi from './Tamagoshi.js';
import Object from './Object.js';

export default class Shell extends THREE.Group{
    constructor() {
        // Calls parent constructor (creates a group)
        super();

        // Create the outer geometry (scaled 4x)
        const outerGeometry = new RoundedBoxGeometry(12, 16, 12, 3);
        const outerMesh = new THREE.Mesh(outerGeometry);
        outerMesh.position.z = -4;
        outerMesh.updateMatrix();

        // Create the inner geometry (scaled 4x)
        const innerGeometry = new RoundedBoxGeometry(10.4, 10.4, 12, 3);
        const innerMesh = new THREE.Mesh(innerGeometry);
        innerMesh.position.z = -1.6;
        innerMesh.position.y = 1.8;
        innerMesh.updateMatrix();

        // Perform the subtraction (outer - inner)
        const csgOuter = CSG.fromMesh(outerMesh);
        const csgInner = CSG.fromMesh(innerMesh);
        const resultCSG = csgOuter.subtract(csgInner);

        // Create the final mesh
        const texture = new THREE.TextureLoader().load('../../assets/textures/cardboard.avif')
        const material = new THREE.MeshPhysicalMaterial({
            color:'#ffba4a',
            map: texture
        });
        const shellMesh = CSG.toMesh(resultCSG, outerMesh.matrix, material);
        // CSG can produce shared/incorrect normals; convert to non-indexed and recompute normals
        if (shellMesh.geometry && shellMesh.geometry.toNonIndexed) {
            shellMesh.geometry = shellMesh.geometry.toNonIndexed();
        }
        if (shellMesh.geometry && shellMesh.geometry.computeVertexNormals) {
            shellMesh.geometry.computeVertexNormals();
        }
        // thin CSG walls can produce incorrect shadowing on single-sided materials
        shellMesh.material.side = THREE.DoubleSide;
        if ('shadowSide' in shellMesh.material) shellMesh.material.shadowSide = THREE.DoubleSide;
        // enable shadows on the generated shell
        shellMesh.castShadow = true;
        shellMesh.receiveShadow = true;

        this.add(shellMesh);
        
        // Add inner lining with different textures for floor, walls, and ceiling
        const loader = new THREE.TextureLoader();
        const wallTexture = loader.load('../../assets/textures/cardboard.avif');
        const floorTexture = loader.load('../../assets/textures/cardboard.avif');
        const ceilingTexture = loader.load('../../assets/textures/cardboard.avif');
        
        // Create materials array for BoxGeometry: [right, left, top, bottom, front, back]
        const innerMaterials = [
            new THREE.MeshPhysicalMaterial({ map: wallTexture, side: THREE.BackSide, roughness: 0.8 }), // +X (right wall)
            new THREE.MeshPhysicalMaterial({ map: wallTexture, side: THREE.BackSide, roughness: 0.8 }), // -X (left wall)
            new THREE.MeshPhysicalMaterial({ map: ceilingTexture, side: THREE.BackSide, roughness: 0.8 }), // +Y (ceiling)
            new THREE.MeshPhysicalMaterial({ map: floorTexture, side: THREE.BackSide, roughness: 0.8 }), // -Y (floor)
            new THREE.MeshPhysicalMaterial({ map: wallTexture, side: THREE.BackSide, roughness: 0.8 }), // +Z (front wall)
            new THREE.MeshPhysicalMaterial({ map: wallTexture, side: THREE.BackSide, roughness: 0.8 })  // -Z (back wall)
        ];
        
        // Create inner lining box matching the inner cavity dimensions (slightly smaller to avoid overflow)
        const innerLiningGeo = new THREE.BoxGeometry(10.2, 10.2, 9.5);
        const innerLining = new THREE.Mesh(innerLiningGeo, innerMaterials);
        innerLining.position.z = -2.8;
        innerLining.position.y = 1.8;
        innerLining.castShadow = false;
        innerLining.receiveShadow = true;
        this.add(innerLining);
        
        // Add transparent glass window at the front (scaled 4x)
        const windowGeometry = new RoundedBoxGeometry(10.2, 10.2, 0.2, 3);
        const windowMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.3,
            metalness: 0.1,
            roughness: 0.1,
            transmission: 0.9,
            thickness: 0.5,
            envMapIntensity: 1,
            clearcoat: 1,
            clearcoatRoughness: 0.1
        });
        this.windowMesh = new THREE.Mesh(windowGeometry, windowMaterial);
        this.windowMesh.position.z = 1.8;
        this.windowMesh.position.y = 1.8;
        this.windowMesh.castShadow = false;
        this.windowMesh.receiveShadow = false;
        this.add(this.windowMesh);
        
        // Store physics colliders for window bounds
        this.physicsColliders = [];
        this.windowCollider = null;

        this.buttonLeft = new Button();
        this.buttonLeft.position.z = 2.0
        this.buttonLeft.position.y = -5.68
        this.buttonLeft.position.x = -3.2
        this.buttonLeft.scale.set(2.0, 2.0, 2.0);
        this.buttonLeft.onPress = () => {
            // If egg, hatch instantly; otherwise trigger eating
            if (this.pet.current_object === this.pet.egg) {
                this.pet.hatchNow();
            } else if (this.pet.current_object && this.pet.current_object.setState) {
                this.pet.current_object.setState('eating');
            }
        };

        this.buttonMid = new Button();
        this.buttonMid.position.z = 2.0
        this.buttonMid.position.y = -5.68
        this.buttonMid.scale.set(2.0, 2.0, 2.0);
        this.buttonMid.onPress = () => {
            // If egg, hatch instantly; otherwise trigger playing
            if (this.pet.current_object === this.pet.egg) {
                this.pet.hatchNow();
            } else if (this.pet.current_object && this.pet.current_object.setState) {
                this.pet.current_object.setState('playing');
            }
        };

        this.buttonRight = new Button();
        this.buttonRight.position.z = 2.0
        this.buttonRight.position.y = -5.68
        this.buttonRight.position.x = 3.2
        this.buttonRight.scale.set(2.0, 2.0, 2.0);
        this.buttonRight.onPress = () => {
            // If egg, hatch instantly; otherwise trigger sleeping
            if (this.pet.current_object === this.pet.egg) {
                this.pet.hatchNow();
            } else if (this.pet.current_object && this.pet.current_object.setState) {
                this.pet.current_object.setState('sleeping');
            }
        };        
        this.buttons = [this.buttonLeft,this.buttonMid,this.buttonRight]
        this.buttons.forEach(button => {
            this.add(button)
            // ensure button meshes cast/receive shadows
            button.traverse((c) => {
                if (c.isMesh) {
                    c.castShadow = true;
                    c.receiveShadow = true;
                }
            })
        })

        this.pet = new Tamagoshi()
        this.pet.position.y = -3.4
        this.pet.position.z = -2.4
        // ensure pet and its children cast/receive shadows
        this.pet.traverse((c) => {
            if (c.isMesh) {
                c.castShadow = true;
                c.receiveShadow = true;
            }
        })
        this.add(this.pet)
        
        // ADD OBJECTS
        this.chair = new Object();
        this.chair.position.set(2.5, -3.2, -6);
        this.chair.rotation.y = - Math.PI / 8
        this.chair.scale.set(0.015, 0.015, 0.015);
        this.add(this.chair);

        this.chandelier = new Object('../../assets/models/chandelier.glb');
        this.chandelier.position.set(4,-3.2,-4.2);
        this.chandelier.scale.set(1,1,1)
        this.add(this.chandelier)
        // LIGHT CHANDELIER
        this.chandelierLight = new THREE.PointLight(0xfff6e0, 8, 15, 1);
        this.chandelierLight.position.set(0, 5.5, 0);
        this.chandelierLight.castShadow = false;
        this.chandelierLight.shadow.bias = -0.02;
        this.chandelierLight.shadow.mapSize.set(1024, 1024);
        this.chandelier.add(this.chandelierLight);

        this.table = new Object('../../assets/models/sidetable.glb');
        this.table.position.set(-2.7, -3.4, -6.1);
        this.table.scale.set(4,4,6);
        this.table.rotation.y = - Math.PI / 2 + Math.PI / 8
        this.add(this.table)

        this.tedy = new Object('../../assets/models/tedy.glb')
        this.tedy.position.set(-4, -3.4, -4)
        this.tedy.scale.set(3, 3, 3)
        this.tedy.rotation.y = Math.PI / 6;
        this.tedy.rotation.x = - Math.PI / 16;
        this.add(this.tedy)

        this.pc = new Object('../../assets/models/pc.glb')
        this.pc.position.set(-2.7, -0.3, -6.1);
        this.pc.scale.set(1.5, 1.5 ,1.5);
        this.pc.rotation.y = Math.PI / 8
        this.add(this.pc)
    }

    setPhysicsWorld(world) {
        this.physicsWorld = world;
        console.log('[Shell] Physics world set:', world ? 'SUCCESS' : 'FAILED');
        // Set physics world on Tamagoshi which will propagate to child
        if (this.pet && this.pet.setPhysicsWorld) {
            this.pet.setPhysicsWorld(world);
        }
        
        // Set physics world on chair
        if (this.chair && this.chair.setPhysicsWorld) {
            this.chair.setPhysicsWorld(world);
        }
        if (this.chandelier && this.chandelier.setPhysicsWorld) {
            this.chandelier.setPhysicsWorld(world);
        }
        
        // Create invisible physics walls to contain ragdoll
        this.createBoundaryWalls();
    }
    
    createBoundaryWalls() {
        if (!this.physicsWorld) return;
        
        console.log('[Shell] Creating boundary walls for ragdoll containment');
        console.log('[Shell] Shell world position:', this.position);
        
        // Get the shell's world position to offset walls correctly
        const shellWorldPos = new THREE.Vector3();
        this.getWorldPosition(shellWorldPos);
        console.log('[Shell] Shell world position:', shellWorldPos);
        
        // Interior dimensions of the shell (10.4x10.4x12 inner box, scaled 4x)
        // Inner box center is at y: 1.8, z: -1.6 relative to shell
        // Match exact inner box dimensions to contain character properly
        const width = 5.2;   // Half of 10.4 (inner box width, scaled 4x)
        const height = 5.2;  // Half of 10.4 (inner box height, scaled 4x)
        const depth = 6.0;   // Half of 12 (inner box depth, scaled 4x)
        const wallThickness = 3;
        
        // Shell inner box is centered at y: 1.8, z: -1.6 (scaled 4x)
        // Pet is at y: -3.4, z: -2.4 relative to shell (scaled 4x)
        // So effective center for containment is y: -1.6, z: -4.0 in world space
        
        const centerY = shellWorldPos.y + 1.8;  // Shell inner box Y center (scaled 4x)
        const centerZ = shellWorldPos.z - 1.6;   // Shell inner box Z center (scaled 4x)
        
        // Create collider for window mesh (glass) so ragdoll bounces off it
        const windowWorldPos = new THREE.Vector3();
        this.windowMesh.getWorldPosition(windowWorldPos);
        const windowWallDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(windowWorldPos.x, windowWorldPos.y, windowWorldPos.z);
        const windowWallBody = this.physicsWorld.createRigidBody(windowWallDesc);
        const windowCollider = RAPIER.ColliderDesc.cuboid(5.1, 5.1, 0.1)
            .setRestitution(0.8)
            .setFriction(0.1);
        this.windowCollider = this.physicsWorld.createCollider(windowCollider, windowWallBody);
        this.physicsColliders.push(windowWallBody);
        console.log('[Shell] Window collider at:', windowWorldPos.x, windowWorldPos.y, windowWorldPos.z);
        
        // Front wall (glass window)
        const frontWallDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(shellWorldPos.x, centerY, centerZ + depth + wallThickness);
        const frontWallBody = this.physicsWorld.createRigidBody(frontWallDesc);
        const frontCollider = RAPIER.ColliderDesc.cuboid(width, height, wallThickness)
            .setRestitution(0.7)
            .setFriction(0.2);
        this.physicsWorld.createCollider(frontCollider, frontWallBody);
        this.physicsColliders.push(frontWallBody);
        console.log('[Shell] Front wall at:', shellWorldPos.x, centerY, centerZ + depth);
        
        // Back wall
        const backWallDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(shellWorldPos.x, centerY, centerZ - depth - wallThickness);
        const backWallBody = this.physicsWorld.createRigidBody(backWallDesc);
        const backCollider = RAPIER.ColliderDesc.cuboid(width, height, wallThickness)
            .setRestitution(0.7)
            .setFriction(0.2);
        this.physicsWorld.createCollider(backCollider, backWallBody);
        this.physicsColliders.push(backWallBody);
        console.log('[Shell] Back wall at:', shellWorldPos.x, centerY, centerZ - depth);
        
        // Left wall
        const leftWallDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(shellWorldPos.x - width - wallThickness, centerY, centerZ);
        const leftWallBody = this.physicsWorld.createRigidBody(leftWallDesc);
        const leftCollider = RAPIER.ColliderDesc.cuboid(wallThickness, height, depth)
            .setRestitution(0.7)
            .setFriction(0.2);
        this.physicsWorld.createCollider(leftCollider, leftWallBody);
        this.physicsColliders.push(leftWallBody);
        console.log('[Shell] Left wall at:', shellWorldPos.x - width, centerY, centerZ);
        
        // Right wall
        const rightWallDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(shellWorldPos.x + width + wallThickness, centerY, centerZ);
        const rightWallBody = this.physicsWorld.createRigidBody(rightWallDesc);
        const rightCollider = RAPIER.ColliderDesc.cuboid(wallThickness, height, depth)
            .setRestitution(0.7)
            .setFriction(0.2);
        this.physicsWorld.createCollider(rightCollider, rightWallBody);
        this.physicsColliders.push(rightWallBody);
        console.log('[Shell] Right wall at:', shellWorldPos.x + width, centerY, centerZ);
        
        // Top wall
        const topWallDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(shellWorldPos.x, centerY + height + wallThickness, centerZ);
        const topWallBody = this.physicsWorld.createRigidBody(topWallDesc);
        const topCollider = RAPIER.ColliderDesc.cuboid(width, wallThickness, depth)
            .setRestitution(0.7)
            .setFriction(0.2);
        this.physicsWorld.createCollider(topCollider, topWallBody);
        this.physicsColliders.push(topWallBody);
        console.log('[Shell] Top wall at:', shellWorldPos.x, centerY + height, centerZ);
        
        // Bottom wall
        const bottomWallDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(shellWorldPos.x, centerY - height - wallThickness, centerZ);
        const bottomWallBody = this.physicsWorld.createRigidBody(bottomWallDesc);
        const bottomCollider = RAPIER.ColliderDesc.cuboid(width, wallThickness, depth)
            .setRestitution(0.7)
            .setFriction(0.2);
        this.physicsWorld.createCollider(bottomCollider, bottomWallBody);
        this.physicsColliders.push(bottomWallBody);
        console.log('[Shell] Bottom wall at:', shellWorldPos.x, centerY - height, centerZ);
        
        console.log('[Shell] Created', this.physicsColliders.length, 'boundary walls');
    }
    
    setCamera(camera) {
        this.camera = camera;
        console.log('[Shell] Camera set:', camera ? 'SUCCESS' : 'FAILED');
        if (this.pet && this.pet.setCamera) {
            this.pet.setCamera(camera);
        }
    }

    update() {
        this.buttons.forEach(button => {
            button.update?.()
        });
        this.pet.update?.()
        this.chair.update?.()
        //this.rotation.y += 0.01;
    }
}