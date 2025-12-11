import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export default class Shell extends THREE.Group{
    constructor() {
        // Calls parent constructor (creates a group)
        super();

        const geometry = new RoundedBoxGeometry();
        const material = new THREE.MeshNormalMaterial();
        const cube = new THREE.Mesh(geometry, material);
        cube.position.set(0, 0, 0);
        
        this.add(cube)
    }

    update() {
        this.rotation.y += 0.01; // Test update
    }
}