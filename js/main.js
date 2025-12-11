import * as THREE from 'three';
import App from './Model/App.js';
import Shell from './Model/Shell.js';

const app = new App();
const cube = new Shell();


app.add(cube)