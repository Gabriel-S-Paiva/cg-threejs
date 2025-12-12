import * as THREE from 'three';
import App from './Model/App.js';
import Shell from './Model/Shell.js';
import Button from './Model/Button.js';

const app = new App();
const shell = new Shell();

app.add(shell);
