import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export default class App{
    constructor(){
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
        this.camera.position.z = 5;

        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);
        
        const controls = new OrbitControls(this.camera, this.renderer.domElement);

        // Lights
        const ambient = new THREE.AmbientLight()
        this.scene.add(ambient)

        const direction = new THREE.DirectionalLight()
        direction.position.set(0,-1,6)
        direction.castShadow = true;
        this.scene.add(direction)

        // interactive buttons collected from added objects
        this.interactiveButtons = [];
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();

        this.objects = [];

        // ! Improve Sintax
        const canvas = this.renderer.domElement;
        canvas.addEventListener('pointerdown', (e) => {
            const rect = canvas.getBoundingClientRect();
            this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            this.raycaster.setFromCamera(this.pointer, this.camera);

            const targets = this.interactiveButtons.map(b => b.button).filter(Boolean);
            const intersects = this.raycaster.intersectObjects(targets, true);
            if (intersects.length) {
                const hit = intersects[0].object;
                const btn = this.interactiveButtons.find(b => {
                    let obj = hit;
                    while (obj) {
                        if (obj === b.button) return true;
                        obj = obj.parent;
                    }
                    return false;
                });
                if (btn) btn.setPressed(true);
            }
        });

        window.addEventListener('pointerup', () => {
            this.interactiveButtons.forEach(b => b.setPressed(false));
        });

        this.animate();
    }

    add(object) {
        this.scene.add(object);
        if(object.buttons) {
            this.interactiveButtons.push(...object.buttons)
        }
        this.objects.push(object);
    }

    animate = () => {
        requestAnimationFrame(this.animate);
        this.objects.forEach(object => object.update?.())
        this.renderer.render(this.scene, this.camera)
    }
}