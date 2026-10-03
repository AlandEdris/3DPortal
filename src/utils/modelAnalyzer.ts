import * as THREE from 'three';
import { ModelMetrics } from '../types/model';

export interface SceneNode {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  children: SceneNode[];
  isMesh: boolean;
  triangleCount?: number;
}

export interface MaterialDetail {
  id: string;
  name: string;
  colorHex: string;
  metalness: number;
  roughness: number;
  opacity: number;
  wireframe: boolean;
}

export function analyzeModel(
  root: THREE.Object3D,
  animations: THREE.AnimationClip[] = []
): {
  metrics: ModelMetrics;
  hierarchy: SceneNode;
  materials: MaterialDetail[];
} {
  let triangles = 0;
  let vertices = 0;
  let meshCount = 0;
  const uniqueMaterials = new Set<THREE.Material>();
  const uniqueTextures = new Set<THREE.Texture>();

  // Calculate bounding box
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);

  const materialsList: MaterialDetail[] = [];

  function recordMaterial(mat: THREE.Material) {
    if (!uniqueMaterials.has(mat)) {
      uniqueMaterials.add(mat);
      const standardMat = mat as THREE.MeshStandardMaterial;
      const colorHex = standardMat.color ? '#' + standardMat.color.getHexString() : '#cccccc';
      materialsList.push({
        id: mat.uuid,
        name: mat.name || `Material ${materialsList.length + 1}`,
        colorHex,
        metalness: standardMat.metalness ?? 0.5,
        roughness: standardMat.roughness ?? 0.5,
        opacity: standardMat.opacity ?? 1,
        wireframe: standardMat.wireframe ?? false,
      });

      if (standardMat.map) uniqueTextures.add(standardMat.map);
      if (standardMat.normalMap) uniqueTextures.add(standardMat.normalMap);
      if (standardMat.roughnessMap) uniqueTextures.add(standardMat.roughnessMap);
      if (standardMat.metalnessMap) uniqueTextures.add(standardMat.metalnessMap);
      if (standardMat.emissiveMap) uniqueTextures.add(standardMat.emissiveMap);
    }
  }

  function traverseNode(obj: THREE.Object3D): SceneNode {
    const isMesh = (obj as THREE.Mesh).isMesh === true;
    let nodeTris = 0;

    if (isMesh) {
      meshCount++;
      const mesh = obj as THREE.Mesh;
      const geom = mesh.geometry;
      if (geom) {
        if (geom.index) {
          nodeTris = geom.index.count / 3;
          triangles += nodeTris;
        } else if (geom.attributes.position) {
          nodeTris = geom.attributes.position.count / 3;
          triangles += nodeTris;
        }
        if (geom.attributes.position) {
          vertices += geom.attributes.position.count;
        }
      }

      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(recordMaterial);
      } else if (mesh.material) {
        recordMaterial(mesh.material);
      }
    }

    const children: SceneNode[] = [];
    for (const child of obj.children) {
      // Ignore helper objects or lights attached dynamically
      if (!child.name.startsWith('__helper_')) {
        children.push(traverseNode(child));
      }
    }

    return {
      id: obj.uuid,
      name: obj.name || `${obj.type} (${obj.id})`,
      type: obj.type,
      visible: obj.visible,
      children,
      isMesh,
      triangleCount: Math.round(nodeTris),
    };
  }

  const hierarchy = traverseNode(root);

  const animationNames = animations.map((clip, index) => clip.name || `Animation ${index + 1}`);

  const metrics: ModelMetrics = {
    triangles: Math.round(triangles),
    vertices,
    meshes: meshCount,
    materials: uniqueMaterials.size,
    textures: uniqueTextures.size,
    animations: animations.length,
    dimensions: {
      x: parseFloat(size.x.toFixed(2)),
      y: parseFloat(size.y.toFixed(2)),
      z: parseFloat(size.z.toFixed(2)),
    },
    animationNames,
  };

  return { metrics, hierarchy, materials: materialsList };
}
