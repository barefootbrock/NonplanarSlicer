import * as THREE from '../libs/three.module.js';


class Transform3D {
    constructor() {

    }

    evaluate(X) {
        throw new Error("Evaluate is not implemented");
    }

    jacobian(X, h=1e-8) {
        //Evaluate jacobian at point X
        const Y = this.evaluate(X);
        const _temp = new THREE.Vector3();

        _temp.copy(X).x += h;
        const dx = this.evaluate(_temp).sub(Y).multiplyScalar(1/h); //dF/dx

        _temp.copy(X).y += h;
        const dy = this.evaluate(_temp).sub(Y).multiplyScalar(1/h); //dF/dy

        _temp.copy(X).z += h;
        const dz = this.evaluate(_temp).sub(Y).multiplyScalar(1/h); //dF/dz

        return new THREE.Matrix3().set(
            dx.x, dy.x, dz.x,
            dx.y, dy.y, dz.y,
            dx.z, dy.z, dz.z,
        );
    }

    inverse(Y, X0=null, eps=1e-8) {
        //Compute X such that |F(X)-Y| < eps
        //using newton's nethod
        const Xg = (X0 == null) ? new THREE.Vector3() : _tempV3.copy(X0).clone();
        const epsSq = eps*eps;

        for (let i = 0; i < 16; i++) {
            const Yg = this.evaluate(Xg).sub(Y);
            // console.log(Xg.x, Xg.y, Xg.z, Yg.lengthSq());
            if (Yg.lengthSq() < epsSq) return Xg;

            //Newton's step
            Xg.sub(Yg.applyMatrix3(this.jacobian(Xg).invert())); //Xg = Xg - F'(Xg)^-1 * F(Xg)
        }

        throw new Error("Inverse failed to converge after 16 iterations");
    }
}

class IdentityTransform extends Transform3D {
    evaluate(X) {
        //F(X) = X
        return new THREE.Vector3(X.x, X.y, X.z);
    }
}

class ConicalTransform extends Transform3D {
    constructor(angle) {
        super();
        this.angle = angle;
        this.slope = Math.tan(angle * Math.PI / 180);
    }

    evaluate(X) {
        //F(x, y, z) = (x, y, z + sqrt(x^2 + y^2))
        return new THREE.Vector3(
            X.x, X.y,
            Math.sqrt(X.x*X.x + X.y*X.y) * this.slope + X.z
        );
    }
}

class ParabolicTransform extends Transform3D {
    evaluate(X) {
        //F(x, y, z) = (x, y, z + x^2 + y^2)
        return new THREE.Vector3(
            X.x, X.y,
            X.x*X.x + X.y*X.y + X.z
        );
    }
}

export {Transform3D, IdentityTransform, ConicalTransform, ParabolicTransform};