import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CSG } from 'three-csg-ts';
import RAPIER from '@dimforge/rapier3d-compat';

import Button from './Button.js';
import Tamagoshi from './Tamagoshi.js';

export default class Shell extends THREE.Group{
    constructor() {
        // Calls parent constructor (creates a group)
        super();

        // Create the outer geometry
        const outerGeometry = new RoundedBoxGeometry(3, 4, 3, 3);
        const outerMesh = new THREE.Mesh(outerGeometry);
        outerMesh.position.z = -1;
        outerMesh.updateMatrix();

        // Create the inner geometry
        const innerGeometry = new RoundedBoxGeometry(2.6, 2.6, 3, 3);
        const innerMesh = new THREE.Mesh(innerGeometry);
        innerMesh.position.z = -0.4;
        innerMesh.position.y = 0.45;
        innerMesh.updateMatrix();

        // Perform the subtraction (outer - inner)
        const csgOuter = CSG.fromMesh(outerMesh);
        const csgInner = CSG.fromMesh(innerMesh);
        const resultCSG = csgOuter.subtract(csgInner);

        // Create the final mesh
        const texture = new THREE.TextureLoader().load('../../assets/cardboard.avif')
        const material = new THREE.MeshToonMaterial({
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
        
        // Add transparent glass window at the front
        const windowGeometry = new RoundedBoxGeometry(2.55, 2.55, 0.05, 3);
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
        this.windowMesh.position.z = 0.45;
        this.windowMesh.position.y = 0.45;
        this.windowMesh.castShadow = false;
        this.windowMesh.receiveShadow = false;
        this.add(this.windowMesh);
        
        // Store physics colliders for window bounds
        this.physicsColliders = [];

        this.buttonLeft = new Button();
        this.buttonLeft.position.z = 0.5
        this.buttonLeft.position.y = -1.42
        this.buttonLeft.position.x = -0.8
        this.buttonLeft.scale.set(0.5, 0.5, 0.5);
        this.buttonLeft.onPress = () => {
            // If egg, hatch instantly; otherwise trigger eating
            if (this.pet.current_object === this.pet.egg) {
                this.pet.hatchNow();
            } else if (this.pet.current_object && this.pet.current_object.setState) {
                this.pet.current_object.setState('eating');
            }
        };

        this.buttonMid = new Button();
        this.buttonMid.position.z = 0.5
        this.buttonMid.position.y = -1.42
        this.buttonMid.scale.set(0.5, 0.5, 0.5);
        this.buttonMid.onPress = () => {
            // If egg, hatch instantly; otherwise trigger playing
            if (this.pet.current_object === this.pet.egg) {
                this.pet.hatchNow();
            } else if (this.pet.current_object && this.pet.current_object.setState) {
                this.pet.current_object.setState('playing');
            }
        };

        this.buttonRight = new Button();
        this.buttonRight.position.z = 0.5
        this.buttonRight.position.y = -1.42
        this.buttonRight.position.x = 0.8
        this.buttonRight.scale.set(0.5, 0.5, 0.5);
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
        this.pet.position.y = -0.85
        this.pet.position.z = -0.6
        // ensure pet and its children cast/receive shadows
        this.pet.traverse((c) => {
            if (c.isMesh) {
                c.castShadow = true;
                c.receiveShadow = true;
            }
        })
        this.add(this.pet)
    }

    setPhysicsWorld(world) {
        this.physicsWorld = world;
        console.log('[Shell] Physics world set:', world ? 'SUCCESS' : 'FAILED');
        // Set physics world on Tamagoshi which will propagate to child
        if (this.pet && this.pet.setPhysicsWorld) {
            this.pet.setPhysicsWorld(world);
        }
        
        // Create invisible physics walls to contain ragdoll
        this.createBoundaryWalls();
    }
    
    createBoundaryWalls() {
        if (!this.physicsWorld) return;
        
        console.log('[Shell] Creating boundary walls for ragdoll containment');
        
        // Interior dimensions of the shell (2.6x2.6x3 inner box)
        const width = 1.3;  // Half of 2.6
        const height = 1.3; // Half of 2.6
        const depth = 0.3;  // Depth from center to front
        const wallThickness = 0.05;
        
        // Front wall (glass window) - offset by pet position
        const frontWallDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(0, -0.4, 0.35); // Adjusted for pet offset
        const frontWallBody = this.physicsWorld.createRigidBody(frontWallDesc);
        const frontCollider = RAPIER.ColliderDesc.cuboid(width, height, wallThickness)
            .setRestitution(0.3)
            .setFriction(0.5);
        this.physicsWorld.createCollider(frontCollider, frontWallBody);
        this.physicsColliders.push(frontWallBody);
        
        // Back wall
        const backWallDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(0, -0.4, -1.0); // Adjusted for pet offset
        const backWallBody = this.physicsWorld.createRigidBody(backWallDesc);
        const backCollider = RAPIER.ColliderDesc.cuboid(width, height, wallThickness);
        this.physicsWorld.createCollider(backCollider, backWallBody);
        this.physicsColliders.push(backWallBody);
        
        // Left wall
        const leftWallDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(-width, -0.4, -0.3);
        const leftWallBody = this.physicsWorld.createRigidBody(leftWallDesc);
        const leftCollider = RAPIER.ColliderDesc.cuboid(wallThickness, height, depth);
        this.physicsWorld.createCollider(leftCollider, leftWallBody);
        this.physicsColliders.push(leftWallBody);
        
        // Right wall
        const rightWallDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(width, -0.4, -0.3);
        const rightWallBody = this.physicsWorld.createRigidBody(rightWallDesc);
        const rightCollider = RAPIER.ColliderDesc.cuboid(wallThickness, height, depth);
        this.physicsWorld.createCollider(rightCollider, rightWallBody);
        this.physicsColliders.push(rightWallBody);
        
        // Top wall
        const topWallDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(0, 0.9, -0.3);
        const topWallBody = this.physicsWorld.createRigidBody(topWallDesc);
        const topCollider = RAPIER.ColliderDesc.cuboid(width, wallThickness, depth);
        this.physicsWorld.createCollider(topCollider, topWallBody);
        this.physicsColliders.push(topWallBody);
        
        // Bottom wall
        const bottomWallDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(0, -1.7, -0.3);
        const bottomWallBody = this.physicsWorld.createRigidBody(bottomWallDesc);
        const bottomCollider = RAPIER.ColliderDesc.cuboid(width, wallThickness, depth);
        this.physicsWorld.createCollider(bottomCollider, bottomWallBody);
        this.physicsColliders.push(bottomWallBody);
        
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
        //this.rotation.y += 0.01;
    }
}