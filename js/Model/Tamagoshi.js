import * as THREE from 'three';
import Egg from './Egg';
import Child from './Child';

export default class Tamagoshi extends THREE.Group {
    constructor(){
        super()

        const egg = new Egg()
        this.current_object = egg
        this.add(egg)
    }
    update() {
        this.current_object.update?.()
    }
}