import * as THREE from 'three';
export default class Child extends THREE.Group {
    constructor() {
        super();
        const helper = new THREE.AxesHelper(3)

        const earGeometry = new THREE.CapsuleGeometry(1,1,8,24)
        const earMaterial = new THREE.MeshNormalMaterial();
        const earLeft = new THREE.Mesh(earGeometry,earMaterial);
        earLeft.scale.set(0.75,1,0.7)
        const leftPivot = new THREE.Object3D()
        leftPivot.rotation.z = -Math.PI/2
        leftPivot.position.y = 1
        earLeft.position.y = 1.5
        leftPivot.add(earLeft)
        const earRight = new THREE.Mesh(earGeometry,earMaterial);
        earRight.scale.set(0.75,1,0.7)
        const rightPivot = new THREE.Object3D()
        rightPivot.rotateZ(-Math.PI/2)
        rightPivot.position.y = 3
        earRight.position.y = 1.5
        rightPivot.add(earRight)

        const headCurve = new THREE.CubicBezierCurve(
            new THREE.Vector2( 0, 0),
            new THREE.Vector2( 2, 0),
            new THREE.Vector2( 2, 4),
            new THREE.Vector2( 0, 4)
        )
        const headPoints = headCurve.getPoints(30)

        const headGeometry = new THREE.LatheGeometry(headPoints, 24)
        const headMaterial = new THREE.MeshNormalMaterial();
        const head = new THREE.Mesh(headGeometry,headMaterial);
        head.rotation.z = Math.PI/2
        head.position.x =2
        head.position.y = 4
        head.add(leftPivot,rightPivot)

        const bodyCurve = new THREE.CubicBezierCurve(
            new THREE.Vector2( 0, 0.06),
            new THREE.Vector2(-2.4, 0.6),
            new THREE.Vector2(-0.9, 2.5),
            new THREE.Vector2(-0.6, 3)
        )
        const bodyPoints = bodyCurve.getPoints(30)
        const bodyGeometry = new THREE.LatheGeometry(bodyPoints, 24)
        const bodyMaterial = new THREE.MeshNormalMaterial();
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);

        const legMaterial = new THREE.MeshNormalMaterial();
        const leftLeg = new THREE.Mesh(bodyGeometry,legMaterial)
        leftLeg.scale.set(0.4,0.4,0.4)
        leftLeg.position.y = -0.5
        leftLeg.position.x = 0.8
        const rightLeg = new THREE.Mesh(bodyGeometry,legMaterial)
        rightLeg.scale.set(0.4,0.4,0.4)
        rightLeg.position.y = -0.5
        rightLeg.position.x = -0.8

        const handGeometry = new THREE.SphereGeometry(0.5)
        const handMaterial = new THREE.MeshNormalMaterial()
        const leftHand = new THREE.Mesh(handGeometry,handMaterial)
        leftHand.position.y = 2
        leftHand.position.x = 2
        const rightHand = new THREE.Mesh(handGeometry,handMaterial)
        rightHand.position.y = 2
        rightHand.position.x = -2

        body.add(head,leftLeg,rightLeg,leftHand,rightHand)
        this.add(body)

        this.earLeft = leftPivot
        this.earRight = rightPivot
    }
    update(){
        const now = performance.now() / 1000;
        const oscillationDuration = 3;
        const totalCycle = oscillationDuration;
        const amplitude = Math.PI / 32;

        const t = now % totalCycle;            // 0..10, repeats

        const phase = (t / oscillationDuration) * 2 * Math.PI;
        this.earLeft.rotation.z = (amplitude * Math.sin(phase)) - Math.PI/2;
        this.earRight.rotation.z = (amplitude * -Math.sin(phase)) - Math.PI/2;
    }
 }