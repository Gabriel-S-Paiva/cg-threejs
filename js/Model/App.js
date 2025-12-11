import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export default class App{
    constructor(){
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
        this.camera.position.z = 5;

        this.renderer = new THREE.WebGLRenderer();
        document.body.appendChild(this.renderer.domElement);
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        const controls = new OrbitControls(this.camera, this.renderer.domElement);

        this.objects = [];

        this.animate();
    }

    add(object) {
        this.scene.add(object);
        this.objects.push(object);
    }

    animate = () => {
        requestAnimationFrame(this.animate);
        this.objects.forEach(object => object.update?.())
        this.renderer.render(this.scene, this.camera)
    }
}