import * as THREE from 'three';

export default class Button extends THREE.Group {
    constructor() {
        super();

        const ringGeometry = new THREE.TorusGeometry(0.5, 0.05);
        const ringMaterial = new THREE.MeshNormalMaterial();
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);

        const buttonGeometry = new THREE.TorusGeometry(0.4, 0.05);
        const buttonMaterial = new THREE.MeshNormalMaterial();
        const button = new THREE.Mesh(buttonGeometry, buttonMaterial);
        button.position.z = 0.18;

        const coverGeometry = new THREE.CircleGeometry(0.4);
        const coverMaterial = new THREE.MeshNormalMaterial();
        const cover = new THREE.Mesh(coverGeometry, coverMaterial);
        cover.position.z = 0.05;
        button.add(cover);

        const bodyGeometry = new THREE.CylinderGeometry(0.45, 0.45, 0.2);
        const bodyMaterial = new THREE.MeshNormalMaterial();
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.rotation.x = Math.PI / 2;
        body.position.z = -0.1;
        button.add(body);

        this.add(ring);
        this.add(button);

        this.button = button;
        this.pressed = false;
    }

    setPressed(state) {
        this.pressed = !!state;
    }

    update() {
        const targetZ = this.pressed ? 0.05 : 0.18;
        this.button.position.z += (targetZ - this.button.position.z) * 0.2;
    }
}