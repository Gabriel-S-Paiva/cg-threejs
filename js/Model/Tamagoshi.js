import * as THREE from 'three';
import Egg from './Egg';
import Child from './Child';

export default class Tamagoshi extends THREE.Group {
    constructor(){
        super()

        this.egg = new Egg()
        this.child = new Child()
        this.child.scale.set(0.2,0.2,0.2)
        // DON'T set position here - keep at 0,0,0 relative to parent
        this.child.position.set(0, 0, 0)
        this.current_object = this.egg
        this.timer = 0;
        this.camera = null; // Store camera reference
        this.physicsWorld = null; // Store physics world reference

        this.add(this.current_object)
    }
    
    setCamera(camera) {
        this.camera = camera;
        if (this.child && this.child.setCamera) {
            this.child.setCamera(camera);
        }
    }
    
    setPhysicsWorld(world) {
        this.physicsWorld = world;
        if (this.child && this.child.setPhysicsWorld) {
            this.child.setPhysicsWorld(world);
        }
    }
    
    hatchNow() {
        console.log('[Tamagoshi] Instant hatch triggered!');
        if (this.current_object !== this.child) {
            this.remove(this.current_object);
            
            // Reset child internal position tracking to center
            this.child.position.set(0, 0, 0);
            this.child.currentPosition.set(0, 0, 0);
            this.child.targetPosition.set(0, 0, 0);
            
            this.current_object = this.child;
            this.add(this.current_object);
            this.timer = 1000; // Set to threshold so it stays as child
            
            const worldPos = new THREE.Vector3();
            this.child.getWorldPosition(worldPos);
            console.log('[Tamagoshi] Child hatched - Local pos:', this.child.position, 'World pos:', worldPos);
        }
    }
    
    update() {
        const threshold = 1000;
        if (this.timer < threshold) {
            this.timer++;
        }

        if (this.timer >= threshold && this.current_object !== this.child) {
            console.log('[Tamagoshi] Timer hatch - switching from egg to child');
            
            this.remove(this.current_object);
            
            // Reset child position to ensure it spawns at correct location
            this.child.position.set(0, 0, 0);
            this.child.currentPosition.set(0, 0, 0);
            this.child.targetPosition.set(0, 0, 0);
            
            this.current_object = this.child;
            this.add(this.current_object);
            
            const worldPos = new THREE.Vector3();
            this.child.getWorldPosition(worldPos);
            console.log('[Tamagoshi] Child spawned - Local pos:', this.child.position, 'World pos:', worldPos);
        }

        this.current_object.update?.();
    }
}