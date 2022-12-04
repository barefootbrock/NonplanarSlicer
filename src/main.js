import * as THREE from '../libs/three.module.js';
import { OrbitControls } from '../libs/OrbitControls.js';
import { AdaptiveGridHelper } from '../libs/AdaptiveGridHelper.js';
import { TransformControls } from '../libs/TransformControls.js';
import { Utils } from './utils.js';
import * as math from './math.js';
import { GcodeMaterial, MeshMaterial } from './materials.js';
import { extractPoints, parseLine, refineMoves, splitLines, transformPoints } from './parser.js';


let scene1, scene2;

let transform = new math.IdentityTransform();


function createScene(wrapper) {
    const scene = new THREE.Scene();

    const pointLight = new THREE.PointLight(0xffffff, 0.6);

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2000);
    scene.add(camera);
    camera.position.set(0, -48, 20);
    camera.up.set(0, 0, 1);
    camera.lookAt(0, 0, 0);
    camera.add(pointLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.4);
    scene.add(hemiLight);

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(100, 100);
    renderer.setClearColor(new THREE.Color(0xffffff), 1);
    wrapper.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.maxDistance = 500;
    controls.minDistance = 2;
    controls.addEventListener('change', () => state.needsRender = true);

    const gridHelper = new AdaptiveGridHelper(
        controls,
        20, 2.5,
        0x888888, 0x888888
    );
    scene.add(gridHelper);

    const geometry = new THREE.PlaneGeometry(50, 50, 25, 25);
    const material = new THREE.MeshStandardMaterial({
        color: 0xffbd33,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.2
    });
    const plane = new THREE.Mesh(geometry, material);
    plane.name = "slice";
    plane.renderOrder = 999;
    scene.add(plane);

    function resize() {
        const width = $(wrapper).width();
        const height = $(wrapper).height();

        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);

        state.needsRender = true;
    }

    function render() {
        gridHelper.update();
        renderer.render(scene, camera);
        state.needsRender = false;
    }

    const state = {
        wrapper,
        scene,
        camera,
        renderer,
        controls,
        gridHelper,
        needsRender: false,
        resize,
        render
    }

    resize();

    return state;
}

function transformGeometry(geometry, func) {
    const pos = geometry.getAttribute('position');
    const temp = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
        temp.set(pos.getX(i), pos.getY(i), pos.getZ(i))
        const result = func(temp, i);
        pos.setXYZ(i, result.x, result.y, result.z);
    }

    if (geometry.hasAttribute('normal')) {
        geometry.computeVertexNormals();
    }
}

function updateSlice() {
    const slice1 = scene1.scene.getObjectByName('slice');
    const slice2 = scene2.scene.getObjectByName('slice');

    if (slice2.position.z < 0) slice2.position.z = 0;

    slice1.geometry.copy(slice2.geometry);
    slice1.geometry.applyMatrix4(slice2.matrix);
    transformGeometry(slice1.geometry, (v) => transform.evaluate(v));
    slice1.geometry.computeVertexNormals();

    const mesh1 = scene1.scene.getObjectByName('STL');
    if (mesh1) mesh1.material.slice.value = slice2.position.z;

    const line1 = scene1.scene.getObjectByName('GCODE');
    if (line1) line1.material.slice.value = slice2.position.z;

    const mesh2 = scene2.scene.getObjectByName('STL');
    if (mesh2) mesh2.material.slice.value = slice2.position.z;

    const line2 = scene2.scene.getObjectByName('GCODE');
    if (line2) line2.material.slice.value = slice2.position.z;

    scene1.needsRender = true;
    scene2.needsRender = true;
}

function animate() {
    requestAnimationFrame(animate);

    if (scene1.needsRender) scene1.render();
    if (scene2.needsRender) scene2.render();
}

function initViewport() {
    scene1 = createScene($("#modelView .scene")[0]);
    scene2 = createScene($("#slicerView .scene")[0]);

    Utils.linkOrbitControls(scene1.controls, scene2.controls);

    const sliceControl = new TransformControls(scene2.camera, scene2.renderer.domElement);
    sliceControl.attach(scene2.scene.getObjectByName('slice'));
    scene2.scene.add(sliceControl);
    sliceControl.showX = false;
    sliceControl.showY = false;

    sliceControl.addEventListener('mouseDown', (evt) => {
        scene2.controls.enabled = false;
    });
    sliceControl.addEventListener('mouseUp', (evt) => {
        scene2.controls.enabled = true;
    });
    sliceControl.addEventListener('objectChange', () => {
        updateSlice();
    });
    sliceControl.addEventListener('change', () => {
        scene2.needsRender = true;
    });

    window.addEventListener('resize', () => {
        scene1.resize();
        scene2.resize();
    });
}

function initStlUI() {
    $("#stlFile").change(async function () {
        if (this.files.length == 0) return;

        const file = this.files[0];
        const geometry = await Utils.loadSTLGeometry(file);
        const material = new MeshMaterial({ side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = "STL";

        scene1.scene.add(mesh);
        scene1.needsRender = true;
    }).val(null);

    $("#refineSTL").click(async function () {
        const mesh = scene1.scene.getObjectByName("STL");
        if (!mesh) {
            alert("No STL loaded!");
            return;
        }

        const maxEdgeLength = Number(prompt("Max edge length (0 to skip refinement)", 0) || 0);
        if (maxEdgeLength > 0) {
            const geometry = mesh.geometry;
            const count = geometry.getAttribute('position').count / 3;

            const newGeometry = Utils.refineGeometry(geometry, maxEdgeLength);
            geometry.copy(newGeometry);
            scene1.needsRender = true;

            const newCount = newGeometry.getAttribute('position').count / 3;
            alert("Added " + (newCount - count) + " faces.\nThe STL now has " + newCount + " faces");
        }
    });

    $("#sliceShape").change(async function () {
        const selection = this.value;
        if (selection == "planar") {
            transform = new math.IdentityTransform();

        } else if (selection == "conicalUp") {
            const angle = Number(prompt("Cone Angle"));
            transform = new math.ConicalTransform(angle);

        } else if (selection == "conicalDown") {
            const angle = Number(prompt("Cone Angle"));
            transform = new math.ConicalTransform(-angle);
        }

        updateSlice();
    }).val('planar').change();

    $("#transformSTL").click(async function () {
        const mesh = scene1.scene.getObjectByName("STL");
        if (!mesh) {
            alert("No STL loaded!");
            return;
        }

        const oldMesh = scene2.scene.getObjectByName("STL");
        if (oldMesh) scene2.scene.remove(oldMesh);

        const newGeometry = mesh.geometry.clone();
        newGeometry.applyMatrix4(mesh.matrix);
        transformGeometry(newGeometry, (v) => transform.inverse(v));

        const material = new MeshMaterial({ side: THREE.DoubleSide });
        const newMesh = new THREE.Mesh(newGeometry, material);
        newMesh.name = "STL";

        mesh.geometry.setAttribute('slicerPos', newGeometry.getAttribute('position'));
        newMesh.geometry.setAttribute('slicerPos', newGeometry.getAttribute('position'));

        scene2.scene.add(newMesh);

        scene1.needsRender = true;
        scene2.needsRender = true;
    });

    $("#downloadSTL").click(async function () {
        const mesh = scene2.scene.getObjectByName("STL");
        if (!mesh) {
            alert("Please transform the STL first");
            return;
        }

        Utils.saveSTL(mesh, "transformed.stl");
    });
}

function initGcodeUI() {
    let gcode = "";
    let newGcode = "";
    let startOffset = 0;
    let endOffset = 0;

    function updateColors(geometry) {
        const color = geometry.getAttribute('color');

        for (let i = 0; i < color.count; i++) {
            if (i < startOffset || i >= color.count - endOffset) {
                color.setXYZ(i, 0.8, 0.8, 0.8);
            } else {
                color.setXYZ(i, 0, 0.5, 0);
            }
        }

        color.needsUpdate = true;
    }

    function transformGcode(lines, transform, firstLine, lastLine) {
        let X, Y, Z, E, F;
        let lastX, lastY, lastZ;
        const newLines = [];
        let count = 0;
        
        lines.map((line) => {
            const data = parseLine(line);
            if (!isMove(data)) {
                newLines.push(line);
                return;
            }
    
            if (data.X !== undefined) X = data.X;
            if (data.Y !== undefined) Y = data.Y;
            if (data.Z !== undefined) Z = data.Z;
            E = data.E || 0;
            F = data.F;
            count++;
    
            if (count - 1 < firstLine || count - 1 > lastLine) {
                newLines.push(line);
                lastX = X;
                lastY = Y;
                lastZ = Z;
                return;
            }
    
            const dist = Math.sqrt((X-lastX)*(X-lastX) + (Y-lastY)*(Y-lastY) + (Z-lastZ)*(Z-lastZ));
            const segments = Math.ceil(dist / maxLineLength);
    
            for (let i = 1; i <= segments; i++) {
                newLines.push(G01(
                    lastX + (X - lastX) / segments * i,
                    lastY + (Y - lastY) / segments * i,
                    lastZ + (Z - lastZ) / segments * i,
                    E / segments,
                    (i == 1) ? F : undefined
                ));
            }
    
            lastX = X;
            lastY = Y;
            lastZ = Z;
        });
    
        return newLines;
    }

    $("#gcodeFile").change(async function () {
        if (this.files.length == 0) return;

        const file = this.files[0];
        const text = await Utils.readFileString(file);
        gcode = splitLines(text);

        const points = new Float32Array(extractPoints(gcode));
        const colors = new Float32Array(points.length);

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('slicerPos', geometry.getAttribute('position'));
        updateColors(geometry);

        const material = new GcodeMaterial({
            color: 0xffffff,
            vertexColors: true
        });
        const line = new THREE.Line(geometry, material);
        line.name = 'GCODE';

        scene2.scene.add(line);
        scene2.needsRender = true;

        const mesh1 = scene1.scene.getObjectByName("STL");
        if (mesh1) {
            mesh1.material.transparent = true;
            mesh1.material.opacity = 0.4;
        }

        const mesh2 = scene2.scene.getObjectByName("STL");
        if (mesh2) {
            mesh2.material.transparent = true;
            mesh2.material.opacity = 0.4;
        }
    }).val(null);

    $("#startOffset").change(function () {
        startOffset = Number(this.value);
        const lines = scene2.scene.getObjectByName('GCODE');
        if (lines) {
            updateColors(lines.geometry);
            scene2.needsRender = true;
        }
    }).val(0);

    $("#endOffset").change(function () {
        endOffset = Number(this.value);
        const lines = scene2.scene.getObjectByName('GCODE');
        if (lines) {
            updateColors(lines.geometry);
            scene2.needsRender = true;
        }
    }).val(0);

    $("#centerGCODE").click(async function () {
        const lines = scene2.scene.getObjectByName('GCODE');
        if (!lines) return;

        const position = lines.geometry.getAttribute('position');

        const box = new THREE.Box3();
        const temp = new THREE.Vector3();
        for (let i = startOffset; i < position.count - endOffset; i++) {
            temp.set(position.getX(i), position.getY(i), position.getZ(i));
            box.expandByPoint(temp);
        }

        box.getCenter(temp);
        lines.position.set(0, 0, 0).sub(temp);

        const mesh = scene2.scene.getObjectByName("STL");
        if (mesh) {
            mesh.geometry.computeBoundingBox();
            mesh.geometry.boundingBox.getCenter(temp);
            lines.position.add(temp);
        }

        lines.position.z = 0;

        scene2.needsRender = true;
    });

    $("#refineGCODE").click(async function () {
        const linesObj = scene2.scene.getObjectByName('GCODE');
        if (!linesObj) return;
        const geometry = linesObj.geometry;
        const pointCount = geometry.getAttribute('position').count;

        const maxLength = prompt("Max segment length:", 1);
        if (Number(maxLength)) {
            const origLength = gcode.length;
            gcode = refineMoves(gcode, maxLength, startOffset, pointCount - endOffset);
            // console.log(gcode.join('\n'))

            alert("Added " + (gcode.length - origLength) + " new lines of GCODE");

            const points = new Float32Array(extractPoints(gcode));
            const colors = new Float32Array(points.length);
            
            geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            geometry.setAttribute('slicerPos', geometry.getAttribute('position'));
            updateColors(geometry);

            scene2.needsRender = true;
        }
    });

    $("#transformGCODE").click(async function () {
        const linesObj = scene2.scene.getObjectByName('GCODE');
        if (!linesObj) return;
        const geometry = linesObj.geometry;
        const pointCount = geometry.getAttribute('position').count;
        const vec3 = new THREE.Vector3();

        newGcode = transformPoints(gcode, (X, Y, Z, E) => {
            vec3.set(X, Y, Z);
            vec3.add(linesObj.position);
            const newPoint = transform.evaluate(vec3);
            newPoint.sub(linesObj.position);

            const det = transform.jacobian(vec3).determinant();

            return {
                X: newPoint.x,
                Y: newPoint.y,
                Z: newPoint.z,
                E: E * det
            }
        }, startOffset, pointCount - endOffset);

        const points = new Float32Array(extractPoints(newGcode));
        const colors = new Float32Array(points.length);
        
        const geometry2 = new THREE.BufferGeometry();
        geometry2.setAttribute('position', new THREE.BufferAttribute(points, 3));
        geometry2.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry2.setAttribute('slicerPos', geometry.getAttribute('position'));
        updateColors(geometry2);

        const material = new GcodeMaterial({
            color: 0xffffff,
            vertexColors: true
        });
        const line = new THREE.Line(geometry2, material);
        line.name = 'GCODE';
        line.position.copy(linesObj.position);

        const oldLines = scene1.scene.getObjectByName('GCODE');
        if (oldLines) scene1.scene.remove(oldLines);

        scene1.scene.add(line);
        scene1.needsRender = true;
    });

    $("#downloadGCODE").click(() => {
        Utils.download("back-transformed.gcode", newGcode.join('\n'));
    });
}

export default function init() {
    initViewport();
    initStlUI();
    initGcodeUI();
    animate();
}