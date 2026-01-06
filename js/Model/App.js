import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export default class App{
    constructor(){
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
        this.camera.position.z = 5;

        this.renderer = new THREE.WebGLRenderer({antialias: true});
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        // enable shadow maps
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(this.renderer.domElement);
        
        const controls = new OrbitControls(this.camera, this.renderer.domElement);

        // Lights
        const ambient = new THREE.AmbientLight()
        this.scene.add(ambient)

        const direction = new THREE.DirectionalLight(0xffffff, 1);
        direction.position.set(5, 5, 5);
        direction.castShadow = true;
        // improve shadow quality and bounds
        direction.shadow.mapSize.set(2048, 2048);
        direction.shadow.camera.left = -10;
        direction.shadow.camera.right = 10;
        direction.shadow.camera.top = 10;
        direction.shadow.camera.bottom = -10;
        direction.shadow.camera.near = 0.5;
        direction.shadow.camera.far = 50;
        // reduce shadow acne / z-fighting
        direction.shadow.bias = -0.0005;
        this.scene.add(direction);

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