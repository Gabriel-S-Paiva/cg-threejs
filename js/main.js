import App from './Model/App.js';
import Shell from './Model/Shell.js';
import Child from './Model/Child.js';

const app = new App();
//const shell = new Shell();
const child = new Child();

//app.add(shell);
app.add(child)