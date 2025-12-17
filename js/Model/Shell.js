import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CSG } from 'three-csg-ts';

import Button from './Button.js';
import Tamagoshi from './Tamagoshi.js';

export default class Shell extends THREE.Group{
    constructor() {
        // Calls parent constructor (creates a group)
        super();

        // Create the outer geometry
        const outerGeometry = new RoundedBoxGeometry(3, 4, 3, 3);
        const outerMesh = new THREE.Mesh(outerGeometry);
        outerMesh.position.z = -1;
        outerMesh.updateMatrix();

        // Create the inner geometry
        const innerGeometry = new RoundedBoxGeometry(2.6, 2.6, 3, 3);
        const innerMesh = new THREE.Mesh(innerGeometry);
        innerMesh.position.z = -0.4;
        innerMesh.position.y = 0.45;
        innerMesh.updateMatrix();

        // Perform the subtraction (outer - inner)
        const csgOuter = CSG.fromMesh(outerMesh);
        const csgInner = CSG.fromMesh(innerMesh);
        const resultCSG = csgOuter.subtract(csgInner);

        // Create the final mesh
        const material = new THREE.MeshNormalMaterial();
        const shellMesh = CSG.toMesh(resultCSG, outerMesh.matrix, material);

        this.add(shellMesh); // Add the resulting mesh to the group

        this.buttonLeft = new Button();
        this.buttonLeft.position.z = 0.5
        this.buttonLeft.position.y = -1.42
        this.buttonLeft.position.x = -0.8
        this.buttonLeft.scale.set(0.5, 0.5, 0.5); 

        this.buttonMid = new Button();
        this.buttonMid.position.z = 0.5
        this.buttonMid.position.y = -1.42
        this.buttonMid.scale.set(0.5, 0.5, 0.5); 

        this.buttonRight = new Button();
        this.buttonRight.position.z = 0.5
        this.buttonRight.position.y = -1.42
        this.buttonRight.position.x = 0.8
        this.buttonRight.scale.set(0.5, 0.5, 0.5);        
        this.buttons = [this.buttonLeft,this.buttonMid,this.buttonRight]
        this.buttons.forEach(button => this.add(button))

        this.pet = new Tamagoshi()
        this.pet.position.y = -0.85
        this.pet.position.z = -0.6
        this.add(this.pet)
    }

    update() {
        this.buttons.forEach(button => {
            button.update?.()
        });
        this.pet.update?.()
        //this.rotation.y += 0.01;
    }
}