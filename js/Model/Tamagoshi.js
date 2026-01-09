import * as THREE from 'three';
import Egg from './Egg';
import Child from './Child';

export default class Tamagoshi extends THREE.Group {
    constructor(){
        super()

        this.egg = new Egg()
        this.egg.scale.set(4.0, 4.0, 4.0)
        this.child = new Child()
        this.child.scale.set(0.8,0.8,0.8)
        this.current_object = this.egg
        this.timer = 0;
        this.camera = null;
        this.physicsWorld = null;

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
        if (this.current_object !== this.child) {
            this.remove(this.current_object);

            this.child.position.set(0, 0, 0);
            this.child.currentPosition.set(0, 0, 0);
            this.child.targetPosition.set(0, 0, 0);

            this.child.resetTimer();
            
            this.current_object = this.child;
            this.add(this.current_object);
            this.timer = 1000;
        }
    }
    
    update() {
        const threshold = 1000;
        if (this.timer < threshold) {
            this.timer++;
        }
        if (this.timer >= threshold && this.current_object !== this.child) {
            this.hatchNow();
        }

        this.current_object.update?.();
    }
}