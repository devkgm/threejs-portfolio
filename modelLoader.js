// src/models/modelLoader.js
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export async function loadModel(path, onProgress) {
    const loader = new GLTFLoader();
    return new Promise((resolve, reject) => {
        loader.load(
            path,
            (gltf) => {
                const model = gltf.scene;

                resolve(model);
            },
            onProgress,
            (err) => {
                reject(err);
            }
        );
    });
}
