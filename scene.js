// src/scene.js
import * as CANNON from "cannon-es";
import * as THREE from "three";
import { loadModel } from "./modelLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import CannonDebugger from "cannon-es-debugger";

import {
    setupPhysics,
    createPhysicsFromModel,
    createPhysicsPlane,
    createPhysicsBox,
} from "./physics.js";
let scene, camera, renderer, controls, vehicle;
let car, carBody;
let initialRotation;
let floor, floorBody;
const sizeX = 64;
const sizeZ = 64;
let matrix = [];
let world = setupPhysics();
let model = [];
let cannonDebugger;
init();

async function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 5, 5);
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    cannonDebugger = new CannonDebugger(scene, world, {
        color: 0x00ff00,
    });
    addLight();
    await addCar();
    addFloor();
    addSunLight();
    // addBox();
    animate();
}
const keyState = {};
window.addEventListener("keydown", function (event) {
    keyState[event.key] = true;
});

window.addEventListener("keyup", function (event) {
    keyState[event.key] = false;
});
function animate() {
    requestAnimationFrame(animate);
    followCar();

    cannonDebugger.update();
    world.step(1 / 60);

    model.forEach((model) => {
        if (model && model?.userData.physicsBody) {
            model.position.copy(model.userData.physicsBody.position);
            model.quaternion.copy(model.userData.physicsBody.quaternion);
        }
    });
    car.position.copy(vehicle.chassisBody.position);
    car.position.y += -0.2;
    car.quaternion.copy(vehicle.chassisBody.quaternion);
    car.quaternion.multiply(initialRotation);

    if (vehicle.chassisBody.position.y < -10) {
        scene.remove(car);
        if (car.geometry) car.geometry.dispose();
        if (car.material) {
            if (Array.isArray(car.material)) {
                car.material.forEach((material) => material.dispose());
            } else {
                car.material.dispose();
            }
        }
        addCar();
    }
    // controls.update();
    renderer.render(scene, camera);
}

function addLight() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambientLight);
}

function addSunLight() {
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(100, 100, 50);
    directionalLight.castShadow = true; // 그림자 활성화
    directionalLight.shadow.camera.top = 80;
    directionalLight.shadow.camera.bottom = -80;
    directionalLight.shadow.camera.left = -80;
    directionalLight.shadow.camera.right = 80;
    directionalLight.shadow.mapSize.width = 4000; // 그림자 맵 크기 설정
    directionalLight.shadow.mapSize.height = 4000;
    directionalLight.shadow.camera.near = 0.5; // 그림자 맵 카메라의 근접 평면
    directionalLight.shadow.camera.far = 200; // 그림자 맵 카메라의 원거리 평면
    // // 그림자 카메라 헬퍼
    scene.add(directionalLight);
    const helper = new THREE.CameraHelper(directionalLight.shadow.camera);
    scene.add(helper);
}

function addFloor() {
    let geometry = new THREE.PlaneGeometry(100, 100);
    let meterial = new THREE.MeshStandardMaterial({ color: 0x01c75a }); //0x7da961
    let floorM = new THREE.Mesh(geometry, meterial);
    floorM.rotation.x = -Math.PI / 2;
    floorM.receiveShadow = true;
    floor = floorM;
    floorBody = createPhysicsPlane(world, floorM, 0);
    scene.add(floorM);
}

function addBox() {
    let geometry = new THREE.BoxGeometry(1, 1, 1);
    let meterial = new THREE.MeshBasicMaterial({ color: 0x000 });
    let floor = new THREE.Mesh(geometry, meterial);
    floor.position.y = 3;
    floor.castShadow = true; // 그림자
    createPhysicsFromModel(world, floor, 1);
    model.push(floor);
    scene.add(floor);
}

async function addCar() {
    car = await loadModel("/assets/classic_car/classic_muscle_car.glb");
    car.scale.set(0.3, 0.3, 0.3);
    car.traverse((node) => {
        if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = false;
        }
    });
    initialRotation = new THREE.Quaternion();
    initialRotation.setFromEuler(new THREE.Euler(0, -Math.PI / 2, 0)); // 90도 회전 및 다른 조정
    carBody = createPhysicsFromModel(world, car, 100);
    const box = new THREE.Box3().setFromObject(car);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const shape = new CANNON.Box(
        new CANNON.Vec3(size.z / 2, size.y / 2.6, size.x / 2)
    );
    const chassisShape = new CANNON.Box(new CANNON.Vec3(2, 0.5, 1));
    const chassisBody = new CANNON.Body({ mass: 700 });
    chassisBody.addShape(shape);
    // chassisBody.addShape(chassisShape);
    // chassisBody.position.set(car.position);
    chassisBody.position.set(0, 4, 0);
    chassisBody.angularVelocity.set(0, 0.5, 0);

    vehicle = new CANNON.RaycastVehicle({
        chassisBody,
    });

    const wheelOptions = {
        radius: 0.22,
        directionLocal: new CANNON.Vec3(0, -1, 0),
        suspensionStiffness: 30,
        suspensionRestLength: 0.45,
        frictionSlip: 1.0,
        dampingRelaxation: 2.3,
        dampingCompression: 4.4,
        maxSuspensionForce: 100000,
        rollInfluence: 0.01,
        axleLocal: new CANNON.Vec3(0, 0, 1),
        chassisConnectionPointLocal: new CANNON.Vec3(-1, 1, 0),
        maxSuspensionTravel: 0.3,
        customSlidingRotationalSpeed: -30,
        useCustomSlidingRotationalSpeed: true,
    };
    console.log("addworld");
    wheelOptions.chassisConnectionPointLocal.set(-1, 0, 1);
    vehicle.addWheel(wheelOptions);

    wheelOptions.chassisConnectionPointLocal.set(-1, 0, -1);
    vehicle.addWheel(wheelOptions);

    wheelOptions.chassisConnectionPointLocal.set(1, 0, 1);
    vehicle.addWheel(wheelOptions);

    wheelOptions.chassisConnectionPointLocal.set(1, 0, -1);
    vehicle.addWheel(wheelOptions);

    vehicle.addToWorld(world);

    const wheelBodies = [];
    const wheelMaterial = new CANNON.Material("wheel");
    vehicle.wheelInfos.forEach((wheel) => {
        const cylinderShape = new CANNON.Cylinder(
            wheel.radius,
            wheel.radius,
            wheel.radius / 2,
            20
        );
        const wheelBody = new CANNON.Body({
            mass: 0,
            material: wheelMaterial,
        });
        wheelBody.type = CANNON.Body.KINEMATIC;
        wheelBody.collisionFilterGroup = 0; // turn off collisions
        const quaternion = new CANNON.Quaternion().setFromEuler(
            -Math.PI / 2,
            0,
            0
        );
        wheelBody.addShape(cylinderShape, new CANNON.Vec3(), quaternion);
        wheelBodies.push(wheelBody);
        world.addBody(wheelBody);
    });

    // Update the wheel bodies
    world.addEventListener("postStep", () => {
        for (let i = 0; i < vehicle.wheelInfos.length; i++) {
            vehicle.updateWheelTransform(i);
            const transform = vehicle.wheelInfos[i].worldTransform;
            const wheelBody = wheelBodies[i];
            wheelBody.position.copy(transform.position);
            wheelBody.quaternion.copy(transform.quaternion);
        }
    });

    for (let i = 0; i < sizeX; i++) {
        matrix.push([]);
        for (let j = 0; j < sizeZ; j++) {
            if (i === 0 || i === sizeX - 1 || j === 0 || j === sizeZ - 1) {
                const height = 3;
                matrix[i].push(height);
                continue;
            }

            const height =
                Math.cos((i / sizeX) * Math.PI * 5) *
                    Math.cos((j / sizeZ) * Math.PI * 5) *
                    2 +
                2;
            matrix[i].push(height);
        }
    }

    const groundMaterial = new CANNON.Material("ground");
    const heightfieldShape = new CANNON.Heightfield(matrix, {
        elementSize: 100 / sizeX,
    });
    const heightfieldBody = new CANNON.Body({
        mass: 0,
        material: groundMaterial,
    });
    heightfieldBody.addShape(heightfieldShape);
    heightfieldBody.position.set(
        // -((sizeX - 1) * heightfieldShape.elementSize) / 2,
        -(sizeX * heightfieldShape.elementSize) / 2,
        -1,
        // ((sizeZ - 1) * heightfieldShape.elementSize) / 2
        (sizeZ * heightfieldShape.elementSize) / 2
    );
    heightfieldBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    // world.addBody(heightfieldBody);
    // Define interactions between wheels and ground
    const wheel_ground = new CANNON.ContactMaterial(
        wheelMaterial,
        groundMaterial,
        {
            friction: 0.3,
            restitution: 0,
            contactEquationStiffness: 1000,
        }
    );
    world.addContactMaterial(wheel_ground);
    model.push(car);
    scene.add(car);
}

function followCar() {
    camera.position.set(car.position.x, car.position.y + 7, car.position.z + 7);
}

document.addEventListener("keydown", (event) => {
    const maxSteerVal = 0.5;
    const maxForce = 1000;
    const brakeForce = 1000000;

    switch (event.key) {
        case "w":
        case "ArrowUp":
            vehicle.applyEngineForce(-maxForce, 2);
            vehicle.applyEngineForce(-maxForce, 3);
            break;

        case "s":
        case "ArrowDown":
            vehicle.applyEngineForce(maxForce, 2);
            vehicle.applyEngineForce(maxForce, 3);
            break;

        case "a":
        case "ArrowLeft":
            vehicle.setSteeringValue(maxSteerVal, 0);
            vehicle.setSteeringValue(maxSteerVal, 1);
            break;

        case "d":
        case "ArrowRight":
            vehicle.setSteeringValue(-maxSteerVal, 0);
            vehicle.setSteeringValue(-maxSteerVal, 1);
            break;

        case "b":
            vehicle.setBrake(brakeForce, 0);
            vehicle.setBrake(brakeForce, 1);
            vehicle.setBrake(brakeForce, 2);
            vehicle.setBrake(brakeForce, 3);
            break;
    }
});

document.addEventListener("keyup", (event) => {
    switch (event.key) {
        case "w":
        case "ArrowUp":
            vehicle.applyEngineForce(0, 2);
            vehicle.applyEngineForce(0, 3);
            break;

        case "s":
        case "ArrowDown":
            vehicle.applyEngineForce(0, 2);
            vehicle.applyEngineForce(0, 3);
            break;

        case "a":
        case "ArrowLeft":
            vehicle.setSteeringValue(0, 0);
            vehicle.setSteeringValue(0, 1);
            break;

        case "d":
        case "ArrowRight":
            vehicle.setSteeringValue(0, 0);
            vehicle.setSteeringValue(0, 1);
            break;

        case "b":
            vehicle.setBrake(0, 0);
            vehicle.setBrake(0, 1);
            vehicle.setBrake(0, 2);
            vehicle.setBrake(0, 3);
            break;
    }
});
