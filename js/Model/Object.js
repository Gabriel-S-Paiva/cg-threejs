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
    }
    
    loadModel() {
        const loader = new GLTFLoader();
        
        loader.load(
            this.modelPath,
            (gltf) => {
                this.model = gltf.scene;
                
                this.model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                
                this.boundingBox.setFromObject(this.model);
                
                this.add(this.model);
                
                if (this.physicsWorld) {
                    this.createPhysicsBody();
                }
            },
            undefined,
            (error) => {
            }
        );
    }
    
    setPhysicsWorld(world) {
        this.physicsWorld = world;
        
        if (this.model) {
            this.createPhysicsBody();
        }
    }
    
    createPhysicsBody() {
        if (!this.physicsWorld || !this.model) {
            return;
        }
        
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        this.getWorldPosition(worldPos);
        this.getWorldQuaternion(worldQuat);
        
        this.boundingBox.setFromObject(this.model);
        const size = new THREE.Vector3();
        this.boundingBox.getSize(size);
        
        const centerWorld = new THREE.Vector3();
        this.boundingBox.getCenter(centerWorld);
        
        const centerLocal = new THREE.Vector3();
        this.worldToLocal(centerWorld.clone());
        centerLocal.copy(this.worldToLocal(centerWorld.clone()));
        
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(worldPos.x, worldPos.y, worldPos.z)
            .setRotation({ x: worldQuat.x, y: worldQuat.y, z: worldQuat.z, w: worldQuat.w });
        
        this.rigidBody = this.physicsWorld.createRigidBody(bodyDesc);
        
        const colliderDesc = RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
            .setTranslation(centerLocal.x, centerLocal.y, centerLocal.z)
            .setRestitution(0.5)
            .setFriction(0.7);
        
        this.collider = this.physicsWorld.createCollider(colliderDesc, this.rigidBody);
    }
    
    cleanup() {
        if (this.physicsWorld && this.rigidBody) {
            this.physicsWorld.removeRigidBody(this.rigidBody);
            this.rigidBody = null;
            this.collider = null;
        }
    }
    
    update() {
        
    }
}
