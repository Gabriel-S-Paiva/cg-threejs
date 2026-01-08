import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import RAPIER from '@dimforge/rapier3d-compat';

export default class Object extends THREE.Group {
    constructor(modelPath = '../../assets/models/sofachair.glb') {
        super();
        
        this.modelPath = modelPath;
        this.physicsWorld = null;
        this.rigidBody = null;
        this.collider = null;
        this.model = null;
        this.boundingBox = new THREE.Box3();
        
        this.loadModel();
        
        console.log('[Object] Constructor initialized');
    }
    
    loadModel() {
        const loader = new GLTFLoader();
        
        loader.load(
            this.modelPath,
            (gltf) => {
                this.model = gltf.scene;
                
                // Enable shadows on model
                this.model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                
                // Calculate bounding box for collision
                this.boundingBox.setFromObject(this.model);
                
                this.add(this.model);
                
                // Create physics body if world is already set
                if (this.physicsWorld) {
                    this.createPhysicsBody();
                }
                
                console.log('[Object] Model loaded:', this.modelPath);
                console.log('[Object] Bounding box:', this.boundingBox);
            },
            (progress) => {
                console.log('[Object] Loading progress:', (progress.loaded / progress.total * 100).toFixed(2) + '%');
            },
            (error) => {
                console.error('[Object] Error loading model:', error);
            }
        );
    }
    
    setPhysicsWorld(world) {
        this.physicsWorld = world;
        console.log('[Object] Physics world set:', world ? 'SUCCESS' : 'FAILED');
        
        // Create physics body if model is already loaded
        if (this.model) {
            this.createPhysicsBody();
        }
    }
    
    createPhysicsBody() {
        if (!this.physicsWorld || !this.model) {
            console.warn('[Object] Cannot create physics body: missing world or model');
            return;
        }
        
        // Get world position and rotation
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        this.getWorldPosition(worldPos);
        this.getWorldQuaternion(worldQuat);
        
        // Calculate dimensions from bounding box
        this.boundingBox.setFromObject(this.model);
        const size = new THREE.Vector3();
        this.boundingBox.getSize(size);
        
        // Calculate center offset relative to the group's position
        // Since setFromObject computes world AABB, we need to convert the center to local space
        // effectively, getting the offset of the model geometry from the Group's origin
        const centerWorld = new THREE.Vector3();
        this.boundingBox.getCenter(centerWorld);
        
        // CORRECTION: We need the offset in unscaled local space (physics space)
        // Previous worldToLocal was affected by the Group's scale (0.015), effectively multiplying the offset distance by 66.
        // We want: (CenterWorld - GroupPos) rotated into GroupFrame.
        const groupPos = new THREE.Vector3();
        this.getWorldPosition(groupPos);
        const groupQuat = new THREE.Quaternion();
        this.getWorldQuaternion(groupQuat);

        const centerLocal = centerWorld.clone().sub(groupPos);
        centerLocal.applyQuaternion(groupQuat.clone().invert());

        console.log(`[Object] Creating collision box for ${this.modelPath}`);
        console.log(`[Object] Size: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`);
        console.log(`[Object] Center Local Offset (Corrected): ${centerLocal.x.toFixed(2)}, ${centerLocal.y.toFixed(2)}, ${centerLocal.z.toFixed(2)}`);
        
        // Create fixed rigid body (static object) at the Group's world position
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(worldPos.x, worldPos.y, worldPos.z)
            .setRotation({ x: worldQuat.x, y: worldQuat.y, z: worldQuat.z, w: worldQuat.w });
        
        this.rigidBody = this.physicsWorld.createRigidBody(bodyDesc);
        
        // Create cuboid collider using exact dimensions
        // The collider is positioned relative to the rigid body using centerLocal
        const colliderDesc = RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
            .setTranslation(centerLocal.x, centerLocal.y, centerLocal.z)
            .setRestitution(0.5)
            .setFriction(0.7);
        
        this.collider = this.physicsWorld.createCollider(colliderDesc, this.rigidBody);
        
        console.log('[Object] Physics body created successfully');
    }
    
    cleanup() {
        if (this.physicsWorld && this.rigidBody) {
            this.physicsWorld.removeRigidBody(this.rigidBody);
            this.rigidBody = null;
            this.collider = null;
            console.log('[Object] Physics body removed');
        }
    }
    
    update() {
        
    }
}
