import * as THREE from 'three';

export default class App{
    constructor(){
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
        this.camera.position.z = 5;

        this.renderer = new THREE.WebGLRenderer();
        document.body.appendChild(this.renderer.domElement);
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        this.objects = [];

        this.animate = this.animate.bind(this);
        this.animate();
    }

    add(object) {
        this.scene.add(object);
        this.objects.push(object);
    }

    animate() {
        requestAnimationFrame(this.animate);
        this.objects.forEach(object => object.update?.())
        this.renderer.render(this.scene, this.camera)
    }
}