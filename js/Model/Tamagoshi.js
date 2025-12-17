import * as THREE from 'three';
import Egg from './Egg';
import Child from './Child';

export default class Tamagoshi extends THREE.Group {
    constructor(){
        super()

        const egg = new Egg()
        const child = new Child()
        child.scale.set(0.2,0.2,0.2)
        child.position.y = 0.075
        this.current_object = child

        this.add(child)
    }
    update() {
        this.current_object.update?.()
    }
}