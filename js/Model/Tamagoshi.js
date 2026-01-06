import * as THREE from 'three';
import Egg from './Egg';
import Child from './Child';

export default class Tamagoshi extends THREE.Group {
    constructor(){
        super()

        this.egg = new Egg()
        this.child = new Child()
        this.child.scale.set(0.2,0.2,0.2)
        // Position child at same location as egg (centered in box)
        this.child.position.set(0, -0.85, -0.6)
        this.current_object = this.egg
        this.timer = 0;

        this.add(this.current_object)
    }
    update() {
        const threshold = 1000;
        if (this.timer < threshold) {
            this.timer++;
        }

        if (this.timer >= threshold && this.current_object !== this.child) {
            this.remove(this.current_object);
            this.current_object = this.child;
            this.add(this.current_object);
        }

        this.current_object.update?.();
    }
}