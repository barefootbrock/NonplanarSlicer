import { FixedSizeMesh } from './FixedSizeMesh.js';
import * as THREE from './three.module.js';

class AdaptiveGridHelper extends THREE.Group {

    constructor(controlls, divisions = 10, cameraScale = 1, color = 0x888888, underColor = null) {
        super();
        const scope = this;

        this.controls = controlls;
        this.camera = this.controls.object;
        this.cameraScale = cameraScale;
        this.shaderRadius = { value: 1 };
        this.divisions = divisions

        this.color = new THREE.Color(color);
        this.underColor = underColor || color;

        function editShader(shader) {
            shader.uniforms.radius = scope.shaderRadius;
            shader.vertexShader = "varying vec3 vUv;\n" +
                shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace(
                "}",
                "  vUv = position;\n" +
                "}"
            );

            shader.fragmentShader = "varying vec3 vUv;\n"
                + "uniform float radius;\n"
                + shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace(
                "}",
                "  gl_FragColor.a *= clamp(1.0 - sqrt(vUv.x*vUv.x + vUv.z*vUv.z) / radius, 0.0, 1.0);\n" +
                "}"
            );
        }

        this.grid1 = new THREE.GridHelper(divisions, 10 * divisions, color);
        this.grid1.material.color.setHex(color);
        this.grid1.material.vertexColors = false;
        this.grid1.material.transparent = true;
        this.grid1.material.onBeforeCompile = editShader;
        this.grid1.material.needsUpdate = true;
        this.grid1.setRotationFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
        // this.grid1.renderOrder = 0;
        this.add(this.grid1);

        this.grid2 = new THREE.GridHelper(divisions, divisions, color);
        this.grid2.material.color.setHex(color);
        // this.grid2.material.depthFunc = THREE.AlwaysDepth;
        this.grid2.material.vertexColors = false;
        this.grid2.material.transparent = true;
        this.grid2.material.onBeforeCompile = editShader;
        this.grid2.material.needsUpdate = true;
        this.grid2.setRotationFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
        // this.grid2.renderOrder = 0;
        this.add(this.grid2);

        const geometry = new THREE.SphereGeometry(0.02, 4, 2);
        const material = new THREE.MeshBasicMaterial({ wireframe: true, fog: false, toneMapped: false });
        this.origin = new FixedSizeMesh(geometry, material);
        this.add(this.origin);

        this.update();
    }

    update() {
        let dist = Math.abs(this.controls.target.y);
        dist += this.controls.target.distanceTo(this.camera.position);
        dist *= this.cameraScale;

        //round to power of 10
        const scale = Math.pow(10, Math.floor(Math.log10(dist)));
        this.shaderRadius.value = this.divisions / 20 * dist / scale;

        this.grid1.scale.set(scale, scale, scale);
        this.grid1.position.set(
            Math.round(this.controls.target.x / scale) * scale,
            Math.round(this.controls.target.y / scale) * scale,
            0
        );

        this.grid2.scale.set(scale, scale, scale);
        this.grid2.position.set(
            Math.round(this.controls.target.x / scale) * scale,
            Math.round(this.controls.target.y / scale) * scale,
            0
        );

        // const originDist = this.camera.position.length();
        // this.origin.scale.set(originDist, originDist, originDist);

        //fade out when looking straight on
        const pos = new THREE.Vector3();
        const up = new THREE.Vector3(0, 0, 1);
        pos.copy(this.camera.position).normalize();
        const fade = Math.min(Math.abs(up.dot(pos) * 10), 1);

        //fade smaller grides 
        this.grid1.material.opacity = (1 - Math.log10(dist / scale)) * fade;
        this.grid2.material.opacity = fade;

        //different top and bottom colors
        if (this.camera.position.y > 0) {
            this.grid1.material.color.set(this.color);
            this.grid2.material.color.set(this.color);
        } else {
            this.grid1.material.color.set(this.underColor);
            this.grid2.material.color.set(this.underColor);
        }
    }
}


export { AdaptiveGridHelper };