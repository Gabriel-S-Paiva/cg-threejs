import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CSG } from 'three-csg-ts';
import RAPIER from '@dimforge/rapier3d-compat';

import Button from './Button.js';
import Tamagoshi from './Tamagoshi.js';
import Object from './Object.js';

export default class Shell extends THREE.Group{
    constructor() {
        super();

        const outerGeometry = new RoundedBoxGeometry(12, 16, 12, 3);
        const outerMesh = new THREE.Mesh(outerGeometry);
        outerMesh.position.z = -4;
        outerMesh.updateMatrix();

        const innerGeometry = new RoundedBoxGeometry(10.4, 10.4, 12, 3);
        const innerMesh = new THREE.Mesh(innerGeometry);
        innerMesh.position.z = -1.6;
        innerMesh.position.y = 1.8;
        innerMesh.updateMatrix();

        const csgOuter = CSG.fromMesh(outerMesh);
        const csgInner = CSG.fromMesh(innerMesh);
        const resultCSG = csgOuter.subtract(csgInner);

        const texture = new THREE.TextureLoader().load('../../assets/textures/cardboard.avif')
        const material = new THREE.MeshPhysicalMaterial({
            color:'#ffba4a',
            map: texture
        });
        const shellMesh = CSG.toMesh(resultCSG, outerMesh.matrix, material);
        if (shellMesh.geometry && shellMesh.geometry.toNonIndexed) {
            shellMesh.geometry = shellMesh.geometry.toNonIndexed();
        }
        if (shellMesh.geometry && shellMesh.geometry.computeVertexNormals) {
            shellMesh.geometry.computeVertexNormals();
        }
        shellMesh.material.side = THREE.DoubleSide;
        if ('shadowSide' in shellMesh.material) shellMesh.material.shadowSide = THREE.DoubleSide;
        shellMesh.castShadow = true;
        shellMesh.receiveShadow = true;

        this.add(shellMesh);
        
        const loader = new THREE.TextureLoader();
        const wallTexture = loader.load('../../assets/textures/wood.jpg');
        const floorTexture = loader.load('../../assets/textures/wood.jpg');
        const ceilingTexture = loader.load('../../assets/textures/wood.jpg');
        
        const innerMaterials = [
            new THREE.MeshPhysicalMaterial({ map: wallTexture, side: THREE.BackSide, roughness: 0.8 }),
            new THREE.MeshPhysicalMaterial({ map: wallTexture, side: THREE.BackSide, roughness: 0.8}),
            new THREE.MeshPhysicalMaterial({ map: ceilingTexture, side: THREE.BackSide, roughness: 0.8 }),
            new THREE.MeshPhysicalMaterial({ map: floorTexture, side: THREE.BackSide, roughness: 0.8 }),
            null,
            new THREE.MeshPhysicalMaterial({ map: wallTexture, side: THREE.BackSide, roughness: 0.8 })
        ];
        
        const innerLiningGeo = new THREE.BoxGeometry(10.2, 10.2, 9.5);
        const innerLining = new THREE.Mesh(innerLiningGeo, innerMaterials);
        innerLining.position.z = -2.8;
        innerLining.position.y = 1.8;
        innerLining.castShadow = false;
        innerLining.receiveShadow = true;
        this.add(innerLining);

        // Create an inward-facing background sphere inside the shell using assets/bg.png
        try {
            const bgLoader = new THREE.TextureLoader();
            const bgTex = bgLoader.load('../../assets/bg.jpg', (tex) => {
                // correct color space
                tex.encoding = THREE.sRGBEncoding;

                // equirectangular panorama on a sphere expects no repeating
                tex.wrapS = THREE.ClampToEdgeWrapping;
                tex.wrapT = THREE.ClampToEdgeWrapping;
                tex.repeat.set(1, 1);

                // avoid mipmap blurring for small/low-res source; use linear filtering
                tex.generateMipmaps = false;
                tex.minFilter = THREE.LinearFilter;
                tex.magFilter = THREE.LinearFilter;

                // set a reasonable anisotropy (can't access renderer here reliably)
                tex.anisotropy = 8;

                tex.needsUpdate = true;
            });

            // Larger radius and higher segments for smoother mapping
            const bgRadius = 60;
            const bgGeo = new THREE.SphereGeometry(bgRadius, 128, 64);
            const bgMat = new THREE.MeshBasicMaterial({
                map: bgTex,
                side: THREE.BackSide,
                toneMapped: false // prevent renderer tone mapping from altering the image
            });
            this.bgSphere = new THREE.Mesh(bgGeo, bgMat);
            // Position sphere to match the inner lining center
            this.bgSphere.position.set(0, 1.8, -2.8);
            this.bgSphere.rotation.y = Math.PI; // orient texture nicely
            this.bgSphere.castShadow = false;
            this.bgSphere.receiveShadow = false;
            this.add(this.bgSphere);
        } catch (e) {
            console.warn('Failed to create shell background sphere:', e);
        }
        
        const windowGeometry = new RoundedBoxGeometry(10.2, 10.2, 0.2, 3);
        const windowMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.3,
            metalness: 0.1,
            roughness: 0.1,
            transmission: 0.9,
            thickness: 0.5,
            envMapIntensity: 1,
            clearcoat: 1,
            clearcoatRoughness: 0.1
        });
        this.windowMesh = new THREE.Mesh(windowGeometry, windowMaterial);
        this.windowMesh.position.z = 1.8;
        this.windowMesh.position.y = 1.8;
        this.windowMesh.castShadow = false;
        this.windowMesh.receiveShadow = false;
        this.add(this.windowMesh);
        
        this.physicsColliders = [];
        this.windowCollider = null;

        this.buttonLeft = new Button();
        this.buttonLeft.position.z = 2.0
        this.buttonLeft.position.y = -5.68
        this.buttonLeft.position.x = -3.2
        this.buttonLeft.scale.set(2.0, 2.0, 2.0);
        this.buttonLeft.onPress = () => {
            if (this.pet.current_object === this.pet.egg) {
                this.pet.hatchNow();
            } else if (this.pet.current_object && this.pet.current_object.setState) {
                this.pet.current_object.setState('eating');
            }
        };

        this.buttonMid = new Button();
        this.buttonMid.position.z = 2.0
        this.buttonMid.position.y = -5.68
        this.buttonMid.scale.set(2.0, 2.0, 2.0);
        this.buttonMid.onPress = () => {
            if (this.pet.current_object === this.pet.egg) {
                this.pet.hatchNow();
            } else if (this.pet.current_object && this.pet.current_object.setState) {
                this.pet.current_object.setState('playing');
            }
        };

        this.buttonRight = new Button();
        this.buttonRight.position.z = 2.0
        this.buttonRight.position.y = -5.68
        this.buttonRight.position.x = 3.2
        this.buttonRight.scale.set(2.0, 2.0, 2.0);
        this.buttonRight.onPress = () => {
            if (this.pet.current_object === this.pet.egg) {
                this.pet.hatchNow();
            } else if (this.pet.current_object && this.pet.current_object.setState) {
                this.pet.current_object.setState('sleeping');
            }
        };        
        this.buttons = [this.buttonLeft,this.buttonMid,this.buttonRight]
        this.buttons.forEach(button => {
            this.add(button)
            button.traverse((c) => {
                if (c.isMesh) {
                    c.castShadow = true;
                    c.receiveShadow = true;
                }
            })
        })

        this.pet = new Tamagoshi()
        this.pet.position.y = -3.4
        this.pet.position.z = -2.4
        this.pet.traverse((c) => {
            if (c.isMesh) {
                c.castShadow = true;
                c.receiveShadow = true;
            }
        })
        this.add(this.pet)
        
        this.chair = new Object('../../assets/models/sofachair-v1.glb');
        this.chair.position.set(2.5, -3.2, -6);
        this.chair.rotation.y = - Math.PI / 8
        this.chair.scale.set(0.015, 0.015, 0.015);
        this.add(this.chair);

        this.chandelier = new Object('../../assets/models/chandelier.glb');
        this.chandelier.position.set(4,-3.2,-4.2);
        this.chandelier.scale.set(1,1,1)
        this.add(this.chandelier)
        this.chandelierLight = new THREE.PointLight(0xfff6e0, 8, 15, 1);
        this.chandelierLight.position.set(0, 5.5, 0);
        this.chandelierLight.castShadow = false;
        this.chandelierLight.shadow.bias = -0.02;
        this.chandelierLight.shadow.mapSize.set(1024, 1024);
        this.chandelier.add(this.chandelierLight);

        this.table = new Object('../../assets/models/sidetable.glb');
        this.table.position.set(-2.7, -3.4, -6.1);
        this.table.scale.set(4,4,6);
        this.table.rotation.y = - Math.PI / 2 + Math.PI / 8
        this.add(this.table)

        this.tedy = new Object('../../assets/models/tedy.glb')
        this.tedy.position.set(-4, -3.4, -4)
        this.tedy.scale.set(3, 3, 3)
        this.tedy.rotation.y = Math.PI / 6;
        this.tedy.rotation.x = - Math.PI / 16;
        this.add(this.tedy)

        this.pc = new Object('../../assets/models/pc.glb')
        this.pc.position.set(-2.7, -0.3, -6.1);
        this.pc.scale.set(1.5, 1.5 ,1.5);
        this.pc.rotation.y = Math.PI / 8
        this.add(this.pc)
    }

    setPhysicsWorld(world) {
        this.physicsWorld = world;
        if (this.pet && this.pet.setPhysicsWorld) {
            this.pet.setPhysicsWorld(world);
        }
        
        if (this.chair && this.chair.setPhysicsWorld) {
            this.chair.setPhysicsWorld(world);
        }
        if (this.chandelier && this.chandelier.setPhysicsWorld) {
            this.chandelier.setPhysicsWorld(world);
        }
        if (this.table && this.table.setPhysicsWorld) {
            this.table.setPhysicsWorld(world);
        }
        if (this.tedy && this.tedy.setPhysicsWorld) {
            this.tedy.setPhysicsWorld(world);
        }
        if (this.pc && this.pc.setPhysicsWorld) {
            this.pc.setPhysicsWorld(world);
        }
        
        this.createBoundaryWalls();
    }
    
    createBoundaryWalls() {
        if (!this.physicsWorld) return;
        
        this.wallBodies = [];
        
        const cx = 0, cy = 1.8, cz = -1.6;
        const w = 5.2;
        const h = 5.2;
        const d = 6.0;
        const th = 1.0;
        
        const walls = [
            { pos: new THREE.Vector3(0, 1.8, 1.8), size: [5.1, 5.1, 0.1] },
            { pos: new THREE.Vector3(cx, cy, cz - d - th), size: [w, h, th] },
            { pos: new THREE.Vector3(cx, cy, cz + d + th), size: [w, h, th] },
            { pos: new THREE.Vector3(cx - w - th, cy, cz), size: [th, h, d] },
            { pos: new THREE.Vector3(cx + w + th, cy, cz), size: [th, h, d] },
            { pos: new THREE.Vector3(cx, cy + h + th, cz), size: [w, th, d] },
            { pos: new THREE.Vector3(cx, cy - h - th, cz), size: [w, th, d] }
        ];
        
        this.updateMatrixWorld(true);

        walls.forEach(def => {
             const worldPos = def.pos.clone().applyMatrix4(this.matrixWorld);
             const worldQuat = new THREE.Quaternion().setFromRotationMatrix(this.matrixWorld);
             
             const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
                 .setTranslation(worldPos.x, worldPos.y, worldPos.z)
                 .setRotation(worldQuat);
                 
             const body = this.physicsWorld.createRigidBody(bodyDesc);
             
             const collider = RAPIER.ColliderDesc.cuboid(def.size[0], def.size[1], def.size[2])
                .setRestitution(0.8)
                .setFriction(0.2);
             this.physicsWorld.createCollider(collider, body);
             
             this.wallBodies.push({ body, localPos: def.pos });
        });
    }
    
    setCamera(camera) {
        this.camera = camera;
        if (this.pet && this.pet.setCamera) {
            this.pet.setCamera(camera);
        }
    }

    update() {
         if (this.wallBodies && this.wallBodies.length > 0) {
             const worldQuat = new THREE.Quaternion();
             this.getWorldQuaternion(worldQuat);
             
             this.wallBodies.forEach(wb => {
                 const worldPos = wb.localPos.clone().applyMatrix4(this.matrixWorld);
                 
                 wb.body.setNextKinematicTranslation(worldPos);
                 wb.body.setNextKinematicRotation(worldQuat);
             });
         }
         
        this.buttons.forEach(button => {
            button.update?.()
        });
        this.pet.update?.()
        this.chair.update?.()
    }

    // Reset shell to default transform/state (called when switching camera modes)
    resetDefault() {
        // Reset transform to origin
        this.position.set(0, 0, 0);
        this.rotation.set(0, 0, 0);
        this.updateMatrixWorld(true);

        // Reset buttons visual state
        if (this.buttons && Array.isArray(this.buttons)) {
            this.buttons.forEach(b => { if (typeof b.setPressed === 'function') b.setPressed(false); });
        }

        // Delegate reset to pet if available
        if (this.pet && typeof this.pet.resetDefault === 'function') {
            try { this.pet.resetDefault(); } catch(e) {}
        } else if (this.pet && this.pet.current_object && typeof this.pet.current_object.setState === 'function') {
            try { this.pet.current_object.setState('idle'); } catch(e) {}
        }

        // Update physics wall kinematic positions immediately
        if (this.wallBodies && this.wallBodies.length) {
            const worldQuat = new THREE.Quaternion();
            this.getWorldQuaternion(worldQuat);
            this.wallBodies.forEach(wb => {
                const worldPos = wb.localPos.clone().applyMatrix4(this.matrixWorld);
                try {
                    wb.body.setNextKinematicTranslation(worldPos);
                    wb.body.setNextKinematicRotation(worldQuat);
                } catch(e) {}
            });
        }

        // Update any other physics colliders attached to the shell
        if (this.physicsColliders && this.physicsColliders.length) {
            this.physicsColliders.forEach(pc => {
                try {
                    if (pc.localPos) {
                        const worldPos = pc.localPos.clone().applyMatrix4(this.matrixWorld);
                        const worldQuat = new THREE.Quaternion();
                        this.getWorldQuaternion(worldQuat);
                        pc.body.setNextKinematicTranslation(worldPos);
                        pc.body.setNextKinematicRotation(worldQuat);
                    } else if (pc.mesh) {
                        const worldPos = new THREE.Vector3();
                        const worldQuat = new THREE.Quaternion();
                        pc.mesh.getWorldPosition(worldPos);
                        pc.mesh.getWorldQuaternion(worldQuat);
                        pc.body.setNextKinematicTranslation(worldPos);
                        pc.body.setNextKinematicRotation(worldQuat);
                    }
                } catch(e) {}
            });
        }

        // Update window collider if present
        if (this.windowCollider && this.windowCollider.body && this.windowMesh) {
            try {
                const wPos = new THREE.Vector3();
                const wQuat = new THREE.Quaternion();
                this.windowMesh.getWorldPosition(wPos);
                this.windowMesh.getWorldQuaternion(wQuat);
                this.windowCollider.body.setNextKinematicTranslation(wPos);
                this.windowCollider.body.setNextKinematicRotation(wQuat);
            } catch(e) {}
        }
    }
}