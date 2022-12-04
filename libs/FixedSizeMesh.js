import * as THREE from './three.module.js';

class FixedSizeMesh extends THREE.Mesh {
    constructor(geometry, material) {
        super(geometry, material);
        const scope = this;

        this.screenScale = new THREE.Vector3(1, 1, 1);

        this.onBeforeRender = function(renderer, scene, camera, geometry, material, group) {
            let cameraPos = new THREE.Vector3();
            let meshPos = new THREE.Vector3();

            camera.getWorldPosition(cameraPos);
            scope.getWorldPosition(meshPos);
            const dist = meshPos.distanceTo(cameraPos);

            scope.scale.copy(this.screenScale).multiplyScalar(dist);
            scope.updateMatrixWorld();
        };
    }
}


export { FixedSizeMesh };