import * as THREE from 'three';
import { OrbitControls } from './jsm/controls/OrbitControls.js';
import Stats from './jsm/libs/stats.module.js';
import { bookMesh } from './book.js';

class SpinningBook {
    // The moments of the Griffith's E&M textbook about each axis
    // x is across the cover left to right
    // y is up the cover bottom to top
    // z is up through the cover
    I_x = 3.79;
    I_y = 1.92;
    I_z = 5.49;
    h = 0.005; // step size

    constructor(initialPosition, color, scene) {
        this.position = initialPosition;
        this.color = color;
        // This will be a bob showing current point in phase space
        const sphereGeometry = new THREE.SphereGeometry(0.5, 32, 32);
        const material = new THREE.MeshBasicMaterial(color);
        this.sphere = new THREE.Mesh(sphereGeometry, material);
        scene.add(this.sphere);

        // how long the trails will be
        this.maxPoints = 3000;
        // I made an efficiency trade off exchanging memory for compute time
        this.aBigNumber = 150000;
        this.currentPointCount = 0;
        // Our trail
        const trailGeometry = new THREE.BufferGeometry();
        const trailPositions = new Float32Array(this.aBigNumber * 3);
        trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));

        this.line = new THREE.Line(trailGeometry, material);
        // This helps when you zoom in; points in the trail don't disappear
        this.line.frustumCulled = false;
        scene.add(this.line);
    }

    // This function uses RK4 to calculate the next position
    calculateNextPosition(rk4) {
        return {
            x:
                this.position.x +
                (this.h * (rk4.k1.dx + 2 * rk4.k2.dx + 2 * rk4.k3.dx + rk4.k4.dx)) / 6,
            y:
                this.position.y +
                (this.h * (rk4.k1.dy + 2 * rk4.k2.dy + 2 * rk4.k3.dy + rk4.k4.dy)) / 6,
            z:
                this.position.z +
                (this.h * (rk4.k1.dz + 2 * rk4.k2.dz + 2 * rk4.k3.dz + rk4.k4.dz)) / 6,
        };
    }

    // This function finds the derivatives at a single point RK4 uses four points
    // ... well sort of only three but the midpoint it samples twice (*)
    getDerivatives(position) {
        return {
            dx: ((this.I_y - this.I_z) / this.I_x) * (position.z * position.y),
            dy: ((this.I_z - this.I_x) / this.I_y) * (position.x * position.z),
            dz: ((this.I_x - this.I_y) / this.I_z) * (position.y * position.x),
        };
    }

    // This uses getDerivatives on those four (three) points
    getRK4Vals() {
        // The derivatives at the initial point ...
        const k1 = this.getDerivatives(this.position);

        // ... inform where the second point which is ...
        const posK2 = {
            x: this.position.x + (this.h / 2) * k1.dx,
            y: this.position.y + (this.h / 2) * k1.dy,
            z: this.position.z + (this.h / 2) * k1.dz,
        };

        // ... and we calculate the next set of derivatives which ...
        const k2 = this.getDerivatives(posK2);

        // ... informs how we sample the second point a second time ...
        const posK3 = {
            x: this.position.x + (this.h / 2) * k2.dx,
            y: this.position.y + (this.h / 2) * k2.dy,
            z: this.position.z + (this.h / 2) * k2.dz,
        };

        const k3 = this.getDerivatives(posK3);

        // ... which informs us what the fourth point is
        // AND how we sample it.
        const posK4 = {
            x: this.position.x + this.h * k3.dx,
            y: this.position.y + this.h * k3.dy,
            z: this.position.z + this.h * k3.dz,
        };

        const k4 = this.getDerivatives(posK4);

        return { k1, k2, k3, k4 };
    }

    // This puts the logic together and is what animate will call
    update() {
        // get the RK4 values
        let rk4 = this.getRK4Vals();
        // use them to calculate next position
        this.position = this.calculateNextPosition(rk4);
        // update the trail with the new positon
        this.updateTrail(this.position);
        // set the sphere's position so three.js can render it
        this.sphere.position.set(this.position.x, this.position.y, this.position.z);
    }

    // updates ... the trail
    updateTrail(newPosition) {
        const points = this.line.geometry.attributes.position.array;

        // Trails should only get so long otherwise it clutters
        // When a trail is shorter than its max length just add
        // the point and change the "DrawRange" accordingly
        if (this.currentPointCount < this.maxPoints) {
            points[this.currentPointCount * 3] = newPosition.x;
            points[this.currentPointCount * 3 + 1] = newPosition.y;
            points[this.currentPointCount * 3 + 2] = newPosition.z;
            this.currentPointCount++;
            this.line.geometry.setDrawRange(0, this.currentPointCount);
            // when the point count is more than the max we have to change things up
        } else {
            // this was the computationally expensive thing I discarded and used more memory for instead
            /*for (let i = 0; i < (this.maxPoints - 1) * 3; i++) {
                points[i] = points[i + 3];
            }*/

            points[this.currentPointCount * 3] = newPosition.x;
            points[this.currentPointCount * 3 + 1] = newPosition.y;
            points[this.currentPointCount * 3 + 2] = newPosition.z;
            this.currentPointCount++;

            // have to change the range but maintain the maxPoints
            this.line.geometry.setDrawRange(
                this.currentPointCount - this.maxPoints,
                this.maxPoints
            );
        }

        // This tells three.js to update it
        this.line.geometry.attributes.position.needsUpdate = true;
    }
}

const scene = new THREE.Scene();

// changed the last two parameters so the trails won't disappear when zooming in or out
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.001, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Tried two ways to fix the "computer graphics 'z' isn't math 'z'" thing
// Should be obvious which one I prefered
//scene.rotation.x = -Math.PI / 2
camera.up.set(0, 0, 1);
const controls = new OrbitControls(camera, renderer.domElement);

// Added axes
scene.add(new THREE.AxesHelper(50));

// add book
scene.add(bookMesh);

// add phase space arrow
// Scale factor to push the arrow clear of the book's outer edges
const ARROW_SCALE = 4.0;

const dir = new THREE.Vector3(1, 0, 0);
const origin = new THREE.Vector3(0, 0, 0);
const initialLength = 4.0 * ARROW_SCALE;
const color = 0x00ffff;

const omegaArrow = new THREE.ArrowHelper(dir, origin, initialLength, color, 1.5, 0.8);
scene.add(omegaArrow);

//light stuff
// Add ambient light so everything is dimly lit
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

// Add a directional light (like a sun or desk lamp) to give it specular highlights and depth
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(5, 10, 7);
scene.add(directionalLight);

// Changed the positon
camera.position.set(20, 20, 20);
// Changed the focus
controls.target.set(0, 0, 0);
controls.update();

// Create our simulated rotating, rigid body
let book = new SpinningBook({ x: 4.0, y: 0.1, z: 0.0 }, { color: 0x00ffff }, scene);

window.addEventListener(
    'resize',
    function () {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        render();
    },
    false
);

const stats = Stats();
document.body.appendChild(stats.dom);

function animate() {
    requestAnimationFrame(animate);
    render();
    stats.update();

    // h and dt don't have to be the same
    let dt = 0.016;

    book.update();

    // This part is non abelian!
    // Motivates a switch to quaternions
    bookMesh.rotateX(book.position.x * dt);
    bookMesh.rotateY(book.position.y * dt);
    bookMesh.rotateZ(book.position.z * dt);

    // Update the arrow helper
    const omegaVec = new THREE.Vector3(book.position.x, book.position.y, book.position.z);
    const omegaMag = omegaVec.length();

    // Gemini code I don't follow yet
    if (omegaMag > 0.0001) {
        omegaArrow.setDirection(omegaVec.clone().normalize());
        // Scale the length dynamically with omega magnitude so it extends outside the book
        omegaArrow.setLength(omegaMag * ARROW_SCALE, 1.5, 0.8);
    }
}

function render() {
    renderer.render(scene, camera);
}

animate();
