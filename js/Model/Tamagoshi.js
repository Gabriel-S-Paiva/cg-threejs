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
        // timer is in seconds
        this.timer = 0;
        this.hatchDelay = 16; // seconds until hatch
        this.buildUpStarted = false;
        this.buildSound = new Audio('../../assets/sound/buildup.mp3');
        this.buildSound.loop = true;
        this.buildSound.volume = 0.8;
        this.popSound = new Audio('../../assets/sound/pop.mp3');
        this.popSound.volume = 0.9;
        this.lastUpdateTime = performance.now();
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

            // stop build-up and play single pop
            try { this.buildSound.pause(); this.buildSound.currentTime = 0; } catch(e){}
            try { this.popSound.currentTime = 0; } catch(e){}
            this.popSound.play().catch(()=>{});
            this.buildUpStarted = false;
        }
    }
    
    update() {
        const now = performance.now();
        const dt = (now - (this.lastUpdateTime || now)) / 1000;
        this.lastUpdateTime = now;
        this.timer += dt;

        // start build-up 6 seconds before hatch
        if (!this.buildUpStarted && this.current_object !== this.child && this.timer >= this.hatchDelay - 6) {
            this.buildSound.play().catch(()=>{});
            this.buildUpStarted = true;
        }

        if (this.timer >= this.hatchDelay && this.current_object !== this.child) {
            this.hatchNow();
        }

        this.current_object.update?.();
    }
}