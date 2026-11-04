import * as THREE from 'three';

const textureLoader = new THREE.TextureLoader();
const coverTexture = textureLoader.load('cover-5e.jpg');
coverTexture.colorSpace = THREE.SRGBColorSpace;

const width = 12.4;
const height = 17.7;
const depth = 3.1;

const geometry = new THREE.BoxGeometry(width, height, depth);

const purpleColor = 0x782e5f;
const pageColor = 0xf5f5f5;

const materials = [
    new THREE.MeshStandardMaterial({ color: pageColor, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: purpleColor, roughness: 0.4 }),
    new THREE.MeshStandardMaterial({ color: pageColor, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: pageColor, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ map: coverTexture, roughness: 0.3 }),
    new THREE.MeshStandardMaterial({ color: purpleColor, roughness: 0.4 }),
];

export const bookMesh = new THREE.Mesh(geometry, materials);
