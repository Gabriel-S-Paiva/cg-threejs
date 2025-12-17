import App from './Model/App.js';
import Shell from './Model/Shell.js';
import Child from './Model/Child.js';

const app = new App();
const shell = new Shell();

app.add(shell);