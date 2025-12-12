import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CSG } from 'three-csg-ts';

export default class Shell extends THREE.Group{
    constructor() {
        // Calls parent constructor (creates a group)
        super();

        // Create the outer geometry
        const outerGeometry = new RoundedBoxGeometry(2, 2, 2, 0.2);
        const outerMesh = new THREE.Mesh(outerGeometry);

        // Create the inner geometry
        const innerGeometry = new RoundedBoxGeometry(1.6, 1.6, 2, 0.2);
        const innerMesh = new THREE.Mesh(innerGeometry);
        innerMesh.position.z = -0.5; // Offset to create an open face

        // Perform the subtraction (outer - inner)
        const csgOuter = CSG.fromMesh(outerMesh);
        const csgInner = CSG.fromMesh(innerMesh);
        const resultCSG = csgOuter.subtract(csgInner);

        // Create the final mesh
        const material = new THREE.MeshNormalMaterial();
        const shellMesh = CSG.toMesh(resultCSG, outerMesh.matrix, material);

        this.add(shellMesh); // Add the resulting mesh to the group
    }

    update() {
        this.rotation.y += 0.01; // Test update
    }
}