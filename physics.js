// src/physics.js
import * as CANNON from "cannon-es";
import * as THREE from "three";
export function setupPhysics() {
    const world = new CANNON.World();
    world.gravity.set(0, -9.82, 0);
    return world;
}

export function createPhysicsFromModel(world, model, mass = 1) {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const shape = new CANNON.Box(
        new CANNON.Vec3(size.x / 2, size.y / 2.6, size.z / 2)
    );
    const body = new CANNON.Body({
        mass: mass,
        shape: shape,
    });
    body.position.copy(center);
    // body.position.y = size.y / 2;
    // world.addBody(body);

    model.userData.physicsBody = body;
    return body;
}
export function createPhysicsPlane(world, model) {
    const groundShape = new CANNON.Box(new CANNON.Vec3(50, 1, 50));
    const body = new CANNON.Body({
        mass: 0, // 바닥은 고정된 물체이므로 질량이 0이어야 합니다.
        shape: groundShape,
    });
    body.position.set(0, -1, 0);
    // body.position.y += 0.3;
    // body.quaternion.copy(model.quaternion); // 바닥을 수평으로 설정
    world.addBody(body);

    return body;
}

export function createPhysicsBox(world, model, mass = 1) {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const shape = new CANNON.Box(
        new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)
    );
    const body = new CANNON.Body({
        mass: mass,
        shape: shape,
    });
    body.position.copy(model.position);
    world.addBody(body);

    return body;
}
