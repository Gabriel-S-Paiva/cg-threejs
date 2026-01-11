import App from './Model/App.js';
import Shell from './Model/Shell.js';

const app = new App();
const shell = new Shell();

app.add(shell);
// Background soundtrack handling
const bgSound = new Audio('../assets/sound/bg-music.mp3');
bgSound.loop = true;
bgSound.volume = 0.5;

// restore muted state from last session
const savedMuted = localStorage.getItem('bgMuted');
bgSound.muted = savedMuted === 'true';

function updateMuteButtonUI(){
    const btn = document.getElementById('muteBtn');
    if(!btn) return;
    btn.setAttribute('aria-pressed', bgSound.muted ? 'true' : 'false');
    const icon = btn.querySelector('.material-symbols-outlined');
    if(icon) icon.textContent = bgSound.muted ? 'volume_off' : 'volume_up';
}

function attemptPlay(){
    bgSound.play().then(()=>{
        updateMuteButtonUI();
    }).catch(()=>{
        const resume = () => {
            bgSound.play().catch(()=>{});
            updateMuteButtonUI();
            document.removeEventListener('click', resume);
            document.removeEventListener('keydown', resume);
        };
        document.addEventListener('click', resume);
        document.addEventListener('keydown', resume);
    });
}

attemptPlay();

const muteBtn = document.getElementById('muteBtn');
if(muteBtn){
    updateMuteButtonUI();
    muteBtn.addEventListener('click', ()=>{
        bgSound.muted = !bgSound.muted;
        localStorage.setItem('bgMuted', bgSound.muted);
        updateMuteButtonUI();
    });
}