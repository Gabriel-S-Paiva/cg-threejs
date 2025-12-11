import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// SCENE CREATION
const scene = new THREE.Scene();

// CAMERA CREATION
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(3, 3, 5);
camera.lookAt(0, 0, 0);

// RENDERER CREATION
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor("#000000");
document.body.appendChild(renderer.domElement);

// CUBE CREATION
const geometry = new RoundedBoxGeometry();
const material = new THREE.MeshNormalMaterial();
const cube = new THREE.Mesh(geometry, material);
cube.position.set(0, 0, 0);

// CONTROLS CREATION
const controls = new OrbitControls(camera, renderer.domElement);

// SCENE ADITION
scene.add(cube);

// ANIMATION LOOP
renderer.setAnimationLoop(render);
function render() {
    // controls.update();
    renderer.render(scene, camera);
};
