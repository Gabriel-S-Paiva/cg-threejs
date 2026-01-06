import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CSG } from 'three-csg-ts';

import Button from './Button.js';
import Tamagoshi from './Tamagoshi.js';
import Egg from './Egg.js';

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
        const texture = new THREE.TextureLoader().load('../../assets/cardboard.avif')
        const material = new THREE.MeshToonMaterial({
            color:'#ffba4a',
            map: texture
        });
        const shellMesh = CSG.toMesh(resultCSG, outerMesh.matrix, material);
        // CSG can produce shared/incorrect normals; convert to non-indexed and recompute normals
        if (shellMesh.geometry && shellMesh.geometry.toNonIndexed) {
            shellMesh.geometry = shellMesh.geometry.toNonIndexed();
        }
        if (shellMesh.geometry && shellMesh.geometry.computeVertexNormals) {
            shellMesh.geometry.computeVertexNormals();
        }
        // thin CSG walls can produce incorrect shadowing on single-sided materials
        shellMesh.material.side = THREE.DoubleSide;
        if ('shadowSide' in shellMesh.material) shellMesh.material.shadowSide = THREE.DoubleSide;
        // enable shadows on the generated shell
        shellMesh.castShadow = true;
        shellMesh.receiveShadow = true;

        this.add(shellMesh);

        this.buttonLeft = new Button();
        this.buttonLeft.position.z = 0.5
        this.buttonLeft.position.y = -1.42
        this.buttonLeft.position.x = -0.8
        this.buttonLeft.scale.set(0.5, 0.5, 0.5);
        this.buttonLeft.onPress = () => {
            // Left button triggers eating
            if (this.pet.current_object && this.pet.current_object.setState) {
                this.pet.current_object.setState('eating');
            }
        };

        this.buttonMid = new Button();
        this.buttonMid.position.z = 0.5
        this.buttonMid.position.y = -1.42
        this.buttonMid.scale.set(0.5, 0.5, 0.5);
        this.buttonMid.onPress = () => {
            // Middle button triggers playing
            if (this.pet.current_object && this.pet.current_object.setState) {
                this.pet.current_object.setState('playing');
            }
        };

        this.buttonRight = new Button();
        this.buttonRight.position.z = 0.5
        this.buttonRight.position.y = -1.42
        this.buttonRight.position.x = 0.8
        this.buttonRight.scale.set(0.5, 0.5, 0.5);
        this.buttonRight.onPress = () => {
            // Right button triggers sleeping
            if (this.pet.current_object && this.pet.current_object.setState) {
                this.pet.current_object.setState('sleeping');
            }
        };        
        this.buttons = [this.buttonLeft,this.buttonMid,this.buttonRight]
        this.buttons.forEach(button => {
            this.add(button)
            // ensure button meshes cast/receive shadows
            button.traverse((c) => {
                if (c.isMesh) {
                    c.castShadow = true;
                    c.receiveShadow = true;
                }
            })
        })

        this.pet = new Tamagoshi()
        this.pet.position.y = -0.85
        this.pet.position.z = -0.6
        // ensure pet and its children cast/receive shadows
        this.pet.traverse((c) => {
            if (c.isMesh) {
                c.castShadow = true;
                c.receiveShadow = true;
            }
        })
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