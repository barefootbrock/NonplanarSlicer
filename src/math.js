import * as THREE from '../libs/three.module.js';


class Transform3D {
    constructor() {
        this.jacobian = (() => {
            const _Y = new THREE.Vector3();
            const _dX = new THREE.Vector3();
            const _dY = new THREE.Vector3();
            const _dZ = new THREE.Vector3();

            return (X, target, h=1e-8) => {
                //Evaluate jacobian at point X and put result in target
                _Y.copy(X);
                this.evaluate(_Y);

                _dX.copy(X).x += h;
                this.evaluate(_dX).sub(_Y).multiplyScalar(1/h); //dF/dx

                _dY.copy(X).y += h;
                this.evaluate(_dY).sub(_Y).multiplyScalar(1/h); //dF/dy

                _dZ.copy(X).z += h;
                this.evaluate(_dZ).sub(_Y).multiplyScalar(1/h); //dF/dz

                return target.set(
                    _dX.x, _dY.x, _dZ.x,
                    _dX.y, _dY.y, _dZ.y,
                    _dX.z, _dY.z, _dZ.z,
                );
            };
        })();

        this.inverse = (() => {
            const _Xg = new THREE.Vector3();
            const _Yg = new THREE.Vector3();
            const _jac = new THREE.Matrix3();

            return (Y, X0=null, eps=1e-8) => {
                //Compute X such that |F(X)-Y| < eps
                //using newton's nethod
                //and save result in Y
                if (X0 == null) _Xg.set(0, 0, 0);
                else _Xg.copy(X0);
                
                const epsSq = eps*eps;

                for (let i = 0; i < 16; i++) {
                    _Yg.copy(_Xg);
                    this.evaluate(_Yg).sub(Y);
                    
                    if (_Yg.lengthSq() < epsSq) return Y.copy(_Xg);

                    //Newton's step
                    this.jacobian(_Xg, _jac);
                    _Xg.sub(_Yg.applyMatrix3(_jac.invert())); //Xg = Xg - F'(Xg)^-1 * F(Xg)
                }

                throw new Error("Inverse failed to converge after 16 iterations");
            }
        })();
    }

    evaluate(X) {
        throw new Error("Evaluate is not implemented");
    }
}

class IdentityTransform extends Transform3D {
    evaluate(X) {
        //F(X) = X
        return X;
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
        return X.set(
            X.x, X.y,
            Math.sqrt(X.x*X.x + X.y*X.y) * this.slope + X.z
        );
    }
}

class ParabolicTransform extends Transform3D {
    evaluate(X) {
        //F(x, y, z) = (x, y, z + x^2 + y^2)
        return X.set(
            X.x, X.y,
            X.x*X.x + X.y*X.y + X.z
        );
    }
}

class CustomTransform extends Transform3D {
    //x' = f(x, y, z)
    //y' = g(x, y, z)
    //z' = h(x, y, z)
    constructor(f, g, h) {
        super();
        this.f = f;
        this.g = g;
        this.h = h;
    }

    evaluate(X) {
        const x = X.x, y = X.y, z = X.z;
        return X.set(
            this.f(x, y, z),
            this.g(x, y, z),
            this.h(x, y, z)
        );
    }
}

export {Transform3D, IdentityTransform, ConicalTransform, ParabolicTransform, CustomTransform};