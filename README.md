# 🥚 3D Tamagotchi Experience

![Three.js](https://img.shields.io/badge/Three.js-black?style=for-the-badge&logo=three.js&logoColor=white)
![Rapier](https://img.shields.io/badge/Rapier_Physics-orange?style=for-the-badge)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![License](https://img.shields.io/badge/License-ISC-green?style=for-the-badge)

> A strictly interactive 3D pet simulation built for the **Computer Graphics** course using **Three.js** and **Rapier** physics.

This project simulates a virtual pet ("Tamagotchi") that hatches from an egg, grows, and interacts with a physics-based environment. It features advanced rendering, kinematic physics, audio reactivity, and multiple camera perspectives.

---

## ✨ Key Features

### 🎮 Gameplay Mechanics
- **Lifecycle System**: Begins with an egg that must be nurtured to hatch into a fully animated child character.
- **State Machine AI**: The character seamlessly transitions between states:
  - 🧍 **Idle**: Curious animations, looking around, and breathing.
  - 🍔 **Eating**: Grabbing food, chewing animations, and dynamic face texture swapping.
  - 🎾 **Playing**: Excited bouncing, waving, and celebrating.
  - 🛌 **Sleeping**: Finding a spot, jumping onto a chair, and resting.
  - 🤸 **Ragdoll**: Physics-driven collapse when the scene is "shaken".

### 🔧 Technical Highlights
- **Rapier Physics Integration**: Real-time rigid body dynamics for the character and environment limitations (walls/floor).
- **Audio Reactivity 🎤**:
  - The character "listens" to microphone input.
  - **Lip-Sync**: Mouth textures animate in sync with audio playback duration.
  - **Voice Mirroring**: Records short clips and plays them back with a pitch shift (chipmunk effect).
- **Dynamic Textures**: Face expressions change based on actions (eating, talking, ragdolling).
- **Procedural Animation**: Smooth logical movement, layered noise-based idle motions (ears, breathing), and IK-like limb placement.

### 🎥 Camera Modes
| Mode | Description | Controls |
| :--- | :--- | :--- |
| **1. Scene View** | Fixed orbit view of the room | Mouse Drag to rotate object |
| **2. First Person** | See through the pet's eyes | **WASD** to walk + Mouse look |
| **3. Third Person** | Follow cam behind the pet | **WASD** to walk + Mouse orbit |

---

## 🛠️ Tech Stack & Libraries

*   **[Three.js](https://threejs.org/)**: Core 3D rendering engine.
*   **[@dimforge/rapier3d-compat](https://rapier.rs/)**: High-performance WASM-based physics engine for collision and ragdoll dynamics.
*   **[Vite](https://vitejs.dev/)**: Next-generation frontend tooling for fast development.
*   **three-csg-ts**: Constructive Solid Geometry for advanced mesh operations.

---

## 🚀 Installation & Setup

1.  **Clone the repository**
    ```bash
    git clone https://github.com/Gabriel-S-Paiva/cg-threejs.git
    cd cg-threejs
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Run Development Server**
    ```bash
    npm run dev
    ```
    > Open the local URL provided by Vite (e.g., `http://localhost:5173`) in your browser.

---

## 🕹️ Controls

| Key / Action | Function |
| :--- | :--- |
| **1 / 2 / 3** | Switch Camera Modes (Scene / FPS / TPS) |
| **W / A / S / D** | Move Character (in Mode 2 & 3) |
| **S** | **Shake Scene** (Triggers Ragdoll physics) |
| **D** | Toggle **Debug Mode** (Physics lines) |
| **Mic Button** | Toggle Microphone capability |
| **Mute Button** | Toggle Background Music |
| **Mouse Click** | Interact with buttons / Lock cursor (in FPS/TPS) |
| **ESC** | Unlock Cursor |

---

## 🎓 Developer

**Gabriel Paiva**
*   **Institution**: ESMAD (Escola Superior de Media Artes e Design)
*   **Course**: Computação Gráfica (3D / Three.js)
*   **Year/Semester**: 2nd Year, 1st Semester

---

## 🎨 Credits & Assets

Special thanks to the creators of the assets used in this project:

### 📦 3D Models
*   `chandelier.gbl`: [DARSH - Crappy living room lamp + installed bulb](https://sketchfab.com/3d-models/crappy-living-room-lamp-installed-bulb-a3bcaf266345416db86ddfa0eaaaf5b1)
*   `ice_cream.gbl`: [DimenVision - Ice Cream](https://sketchfab.com/3d-models/ice-cream-71c7573078f444ca9b620e9d08af8179)
*   `pc.gbl`: [Sam - Laptop lowpoly 280 vertices.](https://sketchfab.com/3d-models/laptop-lowpoly-280-vertices-ee09aa6417cc4aaebede6e9ef90a0fa3)
*   `sidetable.gbl`: [MorisonDesign - SideTable](https://sketchfab.com/3d-models/sidetable-4d17b247556546b99c5dd46f3b67b781)
*   `sofachair.gbl`: [Bouyant-Keys - SofaChair](https://sketchfab.com/3d-models/sofachair-c75842bff5c24f278344dd111ed25dae)
*   `tedy.gbl`: [Kieran H - Low poly asset: Teddy Bear](https://sketchfab.com/3d-models/low-poly-asset-teddy-bear-83319efff3554750a08764fd7001c991)

### 🔊 Audio
*   `bg-music.mp3`: [RR_Rhythm - Fun Times!](https://pixabay.com/users/rr_rhythm-50988983/)
*   `pop.mp3`: [lucadialessandro - Tap Notification](https://pixabay.com/users/lucadialessandro-25927643/)
*   `buildup.mp3`: [SoundReality - Riser Wildfire](https://pixabay.com/users/soundreality-31074404/)
*   `bite.mp3`: [Makigai_MaiMai - Crunchy Bite](https://pixabay.com/users/makigai_maimai-46250777/)

### 🖼️ Textures
*   **Face Expressions** (Happy, Eating, Talking, Sad): *Gabriel Paiva*
*   **Environment Textures** (Floors, Walls): *textures.com & freepik*

---

> *Note: This project is for educational purposes.*