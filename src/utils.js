import * as THREE from '../libs/three.module.js';
import { STLLoader } from '../libs/STLLoader.js';
import { STLExporter } from '../libs/STLExporter.js';

const Utils = {
    splitFileName: function (name) {
        let dot = 0;
        let start = 0;
        for (dot = name.length - 1; name[dot] != '.' && dot > 0; dot--);
        for (start = dot; name[start] != '/' && start >= 0; start--);

        return {
            name: name.slice(start + 1, dot),
            ext: name.slice(dot + 1).toLowerCase()
        };
    },

    linkOrbitControls(controlA, controlB) {
        let lock = false; //Prevent infinite recursion when updating
    
        function copyState(controlA, controlB) {
            lock = true;
    
            controlB.target.copy(controlA.target);
            controlB.object.position.copy(controlA.object.position);
            controlB.object.rotation.copy(controlA.object.rotation);
            controlB.object.zoom = controlA.object.zoom;
    
            controlB.object.updateProjectionMatrix();
            controlB.update();
    
            lock = false;
        }
    
        controlA.addEventListener('change', () => {
            if (!lock) copyState(controlA, controlB);
        });
    
        controlB.addEventListener('change', () => {
            if (!lock) copyState(controlB, controlA);
        });
    },

    loadSTLGeometry(file) {
        let { name, ext } = Utils.splitFileName(file.name);
        ext = ext.toLowerCase();
        if (ext != 'stl') throw "Invalid file extension: " + ext;

        const url = URL.createObjectURL(file);

        return new Promise((resolve, reject) => {
            new STLLoader().load(
                url,
                // called when resource is loaded
                function (geometry) {
                    resolve(geometry);
                },
                // called when loading is in progresses
                function (xhr) {
                    // console.log((xhr.loaded / xhr.total * 100) + '% loaded');
                },
                // called when loading has errors
                function (error) {
                    reject(error);
                }
            );
        });
    },

    saveSTL(mesh, name) {
        const outputStr = new STLExporter().parse(mesh);

        const link = document.createElement('a');
        link.style.display = 'none';
        document.body.appendChild(link);

        const blob = new Blob([outputStr], { type: 'text/plain' });

        link.href = URL.createObjectURL(blob);
        link.download = name;
        link.click();

        link.remove();
    },

    refineGeometry(geometry, maxEdgeLength) {
        const pos = geometry.getAttribute('position');
        const verts = [...pos.array];
        const lenSq = maxEdgeLength*maxEdgeLength;

        function distSq(x1, y1, z1, x2, y2, z2) {
            return (x1-x2)*(x1-x2) + (y1-y2)*(y1-y2) + (z1-z2)*(z1-z2);
        }

        function checkTriangle(i, j, k) {
            const x1 = verts[i], y1 = verts[i+1], z1 = verts[i+2];
            const x2 = verts[j], y2 = verts[j+1], z2 = verts[j+2];
            const x3 = verts[k], y3 = verts[k+1], z3 = verts[k+2];
            const xm = (x1 + x2) / 2, ym = (y1 + y2) / 2, zm = (z1 + z2) / 2;
            verts[j+0] = xm;
            verts[j+1] = ym;
            verts[j+2] = zm;
            verts.push(
                xm, ym, zm,
                x2, y2, z2,
                x3, y3, z3
            );
        }

        let i = 0;
        while (i < verts.length) {
            const j = i + 3, k = i + 6;
            const d1 = distSq(verts[i], verts[i+1], verts[i+2], verts[j], verts[j+1], verts[j+2]);
            const d2 = distSq(verts[j], verts[j+1], verts[j+2], verts[k], verts[k+1], verts[k+2]);
            const d3 = distSq(verts[k], verts[k+1], verts[k+2], verts[i], verts[i+1], verts[i+2]);
            const maxD = Math.max(d1, d2, d3);
            if (maxD > lenSq) {
                if (d1 == maxD) checkTriangle(i, j, k);
                else if (d2 == maxD) checkTriangle(j, k, i);
                else if (d3 == maxD) checkTriangle(k, i, j);
            } else i += 9;
        }

        const newGeometry = new THREE.BufferGeometry();
        const attribute = new THREE.BufferAttribute(new Float32Array(verts), 3);
        newGeometry.setAttribute('position', attribute);

        newGeometry.computeVertexNormals();
        return newGeometry;
    },

    readFileString(file) {
        const reader = new FileReader()
        return new Promise((resolve, reject) => {
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = (error) => reject(error);
            reader.readAsText(file);
        });
    },

    download(filename, text) {
        const element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
        element.setAttribute('download', filename);
      
        element.style.display = 'none';
        document.body.appendChild(element);
      
        element.click();
      
        document.body.removeChild(element);
      }
}

export { Utils };