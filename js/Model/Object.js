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
        
        // Calculate dimensions from bounding box (rounded to cube)
        const size = new THREE.Vector3();
        this.boundingBox.getSize(size);
        
        // Round to closest cube (use average of dimensions)
        const avgSize = (size.x + size.y + size.z) / 3;
        const halfExtents = avgSize / 2;
        
        console.log('[Object] Creating collision box with half extents:', halfExtents);
        
        // Create fixed rigid body (static object)
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(worldPos.x, worldPos.y, worldPos.z)
            .setRotation({ x: worldQuat.x, y: worldQuat.y, z: worldQuat.z, w: worldQuat.w });
        
        this.rigidBody = this.physicsWorld.createRigidBody(bodyDesc);
        
        // Create cuboid collider
        const colliderDesc = RAPIER.ColliderDesc.cuboid(halfExtents, halfExtents, halfExtents)
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
