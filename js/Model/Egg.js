import * as THREE from 'three';

export default class Egg extends THREE.Group {
    constructor(){
        super();
        
        const curve = new THREE.CubicBezierCurve(
            new THREE.Vector2(0.0, 0.0),
            new THREE.Vector2(0.6, 0.1),
            new THREE.Vector2(0.4, 0.9),
            new THREE.Vector2(0.0, 1.0)
        );

        const points = curve.getPoints(30);
        const geometry = new THREE.LatheGeometry(
            points, 
            64
        );
        const texture = new THREE.TextureLoader().load('../../assets/egg.png')
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        const material = new THREE.MeshPhysicalMaterial({
            map: texture
        });

        const egg = new THREE.Mesh(geometry, material);

        this.add(egg);
        this.switch = true
        this.bounces = 0
    }
    update() {
        const now = performance.now() / 1000;
        const oscillationDuration = 3;
        const pauseDuration = 5;
        const totalCycle = oscillationDuration + pauseDuration;
        const bouncesPerCycle = 3;
        const amplitude = Math.PI / 12;

        const t = now % totalCycle;

        // Oscilate then wait and reset
        if (t < oscillationDuration) {
            const phase = (t / oscillationDuration) * 2 * Math.PI * bouncesPerCycle;
            this.rotation.z = amplitude * Math.sin(phase);
        } else {
            this.rotation.z = 0; // pause, no rotation
        }
    }
}