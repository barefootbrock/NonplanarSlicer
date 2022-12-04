import * as THREE from '../libs/three.module.js';

class MeshMaterial extends THREE.MeshStandardMaterial {
    constructor(parameters) {
        super(parameters);

        this.slice = { value: 0 };

        this.onBeforeCompile = (shader) => {
            shader.uniforms.slice = this.slice;
    
            shader.vertexShader = "" +
                "attribute vec3 slicerPos;\n" +
                "varying float vSliceZ;\n" +
                shader.vertexShader.replace(
                    "}",
                    "  vSliceZ = slicerPos.z;\n" +
                    "}"
                );
    
            shader.fragmentShader = "" +
                "varying float vSliceZ;\n" +
                "uniform float slice;\n" +
                shader.fragmentShader.replace(
                    "}",
                    "  if (slice > 0.0 && vSliceZ > slice) discard;" +
                    "  if (slice > 0.0 && slice - vSliceZ < 0.5) " + 
                    "    gl_FragColor.rgb = mix(vec3(1.0, 0.0, 0.0), gl_FragColor.rgb, (slice - vSliceZ) * 2.0);" +
                    "}"
                );
            // console.log(shader.vertexShader)
            // console.log(shader.fragmentShader);
        };
    
        this.needsUpdate = true;
    }
}


class GcodeMaterial extends THREE.LineBasicMaterial {
    constructor(parameters) {
        super(parameters);

        this.slice = { value: 0 };

        this.onBeforeCompile = (shader) => {
            shader.uniforms.slice = this.slice;
    
            shader.vertexShader = "" +
                "attribute vec3 slicerPos;\n" +
                "varying float vSliceZ;\n" +
                shader.vertexShader.replace(
                    "}",
                    "  vSliceZ = slicerPos.z;\n" +
                    "}"
                );
    
            shader.fragmentShader = "" +
                "varying float vSliceZ;\n" +
                "uniform float slice;\n" +
                shader.fragmentShader.replace(
                    "}",
                    "  if (slice > 0.0 && vSliceZ > slice) discard;" +
                    "  if (slice > 0.0 && slice - vSliceZ < 0.5) " + 
                    "    gl_FragColor.rgb = mix(vec3(0.0, 0.0, 0.0), gl_FragColor.rgb, (slice - vSliceZ) * 2.0);" +
                    "}"
                );
            // console.log(shader.vertexShader)
            // console.log(shader.fragmentShader);
        };
    
        this.needsUpdate = true;
    }
}

export { MeshMaterial, GcodeMaterial };