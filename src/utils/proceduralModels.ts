import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { ModelItem } from '../types/model';
import { analyzeModel } from './modelAnalyzer';

/**
 * Creates an animated Cyber Drone Object3D
 */
function createDroneScene(): { group: THREE.Group; animations: THREE.AnimationClip[] } {
  const group = new THREE.Group();
  group.name = 'Cyber_Stealth_Drone';

  // Materials
  const chassisMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.85,
    roughness: 0.25,
    name: 'Carbon_Chassis',
  });

  const neonTealMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    emissive: 0x06b6d4,
    emissiveIntensity: 1.5,
    metalness: 0.2,
    roughness: 0.2,
    name: 'Teal_Photonic_Core',
  });

  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.9,
    roughness: 0.3,
    name: 'Titanium_Armature',
  });

  const rotorMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.6,
    roughness: 0.4,
    name: 'Composite_Rotor',
  });

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.95,
    roughness: 0.15,
    name: 'Gold_Telemetry_Accent',
  });

  // Main fuselage
  const fuselageGeom = new THREE.ConeGeometry(0.8, 2.2, 8);
  fuselageGeom.rotateX(Math.PI / 2);
  const fuselage = new THREE.Mesh(fuselageGeom, chassisMat);
  fuselage.name = 'Fuselage_Body';
  fuselage.scale.set(1, 0.4, 1);
  group.add(fuselage);

  // Cockpit glass
  const canopyGeom = new THREE.SphereGeometry(0.45, 16, 16);
  canopyGeom.scale(0.8, 0.5, 1.4);
  const canopy = new THREE.Mesh(canopyGeom, neonTealMat);
  canopy.position.set(0, 0.18, 0.2);
  canopy.name = 'Sensor_Canopy';
  group.add(canopy);

  // Gold accent band
  const bandGeom = new THREE.TorusGeometry(0.55, 0.04, 8, 24);
  bandGeom.rotateX(Math.PI / 2);
  const band = new THREE.Mesh(bandGeom, goldMat);
  band.position.set(0, 0, -0.3);
  group.add(band);

  // 4 Rotor arms & rotors
  const armOffsets = [
    { x: 1.1, z: 0.8, name: 'FR' },
    { x: -1.1, z: 0.8, name: 'FL' },
    { x: 1.1, z: -0.8, name: 'RR' },
    { x: -1.1, z: -0.8, name: 'RL' },
  ];

  const rotors: THREE.Group[] = [];

  armOffsets.forEach((pos, idx) => {
    // Arm strut
    const armGeom = new THREE.CylinderGeometry(0.05, 0.06, 1.3, 8);
    const arm = new THREE.Mesh(armGeom, metalMat);
    arm.name = `Arm_Strut_${pos.name}`;
    arm.position.set(pos.x * 0.5, 0, pos.z * 0.5);
    arm.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(pos.x, 0, pos.z).normalize()
    );
    group.add(arm);

    // Motor Pod
    const podGeom = new THREE.CylinderGeometry(0.18, 0.16, 0.25, 16);
    const pod = new THREE.Mesh(podGeom, chassisMat);
    pod.name = `Motor_Pod_${pos.name}`;
    pod.position.set(pos.x, 0.05, pos.z);
    group.add(pod);

    // Rotor spinning hub
    const rotorHub = new THREE.Group();
    rotorHub.name = `Rotor_Hub_${pos.name}`;
    rotorHub.position.set(pos.x, 0.2, pos.z);

    const bladeGeom = new THREE.BoxGeometry(0.9, 0.02, 0.12);
    const blade1 = new THREE.Mesh(bladeGeom, rotorMat);
    rotorHub.add(blade1);

    const blade2 = blade1.clone();
    blade2.rotation.y = Math.PI / 2;
    rotorHub.add(blade2);

    group.add(rotorHub);
    rotors.push(rotorHub);
  });

  // Thruster nozzles
  const nozzleGeom = new THREE.CylinderGeometry(0.12, 0.22, 0.4, 16);
  const nozzleLeft = new THREE.Mesh(nozzleGeom, metalMat);
  nozzleLeft.rotateX(Math.PI / 2);
  nozzleLeft.position.set(0.3, 0, -1.1);
  group.add(nozzleLeft);

  const nozzleRight = nozzleLeft.clone();
  nozzleRight.position.set(-0.3, 0, -1.1);
  group.add(nozzleRight);

  // Animations: Rotor spin & drone hovering bob
  const times = [0, 0.5, 1, 1.5, 2];
  const positionValues = [
    0, 0, 0,
    0, 0.15, 0,
    0, 0, 0,
    0, -0.15, 0,
    0, 0, 0
  ];
  const hoverTrack = new THREE.VectorKeyframeTrack('.position', times, positionValues);

  // Spin rotation for rotors
  const spinTimes = [0, 0.25, 0.5, 0.75, 1];
  const q0 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0);
  const q1 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  const q2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  const q3 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 1.5 * Math.PI);
  const q4 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 2 * Math.PI);

  const spinValues = [
    q0.x, q0.y, q0.z, q0.w,
    q1.x, q1.y, q1.z, q1.w,
    q2.x, q2.y, q2.z, q2.w,
    q3.x, q3.y, q3.z, q3.w,
    q4.x, q4.y, q4.z, q4.w,
  ];

  const tracks: THREE.KeyframeTrack[] = [hoverTrack];
  rotors.forEach((rotor) => {
    tracks.push(
      new THREE.QuaternionKeyframeTrack(`${rotor.name}.quaternion`, spinTimes, spinValues)
    );
  });

  const clip = new THREE.AnimationClip('Hover_And_Flight_Turbine', 2, tracks);

  return { group, animations: [clip] };
}

/**
 * Creates Cyberpunk Mech Helmet Object3D
 */
function createHelmetScene(): { group: THREE.Group; animations: THREE.AnimationClip[] } {
  const group = new THREE.Group();
  group.name = 'Cyber_Tactical_Helmet';

  const shellMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    metalness: 0.9,
    roughness: 0.2,
    name: 'Armor_Plating',
  });

  const visorMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.8,
    metalness: 0.95,
    roughness: 0.1,
    name: 'Gold_HUD_Visor',
  });

  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x374151,
    metalness: 0.5,
    roughness: 0.6,
    name: 'Textured_Kevlar',
  });

  const sensorMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xb91c1c,
    emissiveIntensity: 1.2,
    metalness: 0.1,
    roughness: 0.1,
    name: 'Targeting_Optic',
  });

  // Crown dome
  const domeGeom = new THREE.SphereGeometry(1, 24, 20, 0, Math.PI * 2, 0, Math.PI * 0.65);
  domeGeom.scale(0.9, 1.1, 1.1);
  const dome = new THREE.Mesh(domeGeom, shellMat);
  dome.name = 'Cranial_Armor';
  group.add(dome);

  // Visor screen
  const visorGeom = new THREE.CylinderGeometry(0.85, 0.88, 0.5, 24, 1, false, Math.PI * 0.25, Math.PI * 0.5);
  visorGeom.rotateY(Math.PI);
  const visor = new THREE.Mesh(visorGeom, visorMat);
  visor.position.set(0, 0.25, 0.35);
  visor.name = 'Visor_Display';
  group.add(visor);

  // Cheek guards
  const cheekGeom = new THREE.BoxGeometry(0.3, 0.6, 0.8);
  const leftCheek = new THREE.Mesh(cheekGeom, shellMat);
  leftCheek.position.set(-0.85, 0.05, 0.2);
  leftCheek.rotation.y = -0.2;
  group.add(leftCheek);

  const rightCheek = new THREE.Mesh(cheekGeom, shellMat);
  rightCheek.position.set(0.85, 0.05, 0.2);
  rightCheek.rotation.y = 0.2;
  group.add(rightCheek);

  // Chin piece / rebreather
  const chinGeom = new THREE.CylinderGeometry(0.4, 0.5, 0.45, 12);
  const chin = new THREE.Mesh(chinGeom, carbonMat);
  chin.position.set(0, -0.25, 0.7);
  chin.rotation.x = 0.4;
  chin.name = 'Atmospheric_Rebreather';
  group.add(chin);

  // Dual ventilation filters
  const ventGeom = new THREE.CylinderGeometry(0.18, 0.18, 0.3, 16);
  ventGeom.rotateZ(Math.PI / 2);
  const leftVent = new THREE.Mesh(ventGeom, carbonMat);
  leftVent.position.set(-0.7, -0.15, 0.45);
  group.add(leftVent);

  const rightVent = new THREE.Mesh(ventGeom, carbonMat);
  rightVent.position.set(0.7, -0.15, 0.45);
  group.add(rightVent);

  // Optic targeting lens on forehead
  const lensGeom = new THREE.CylinderGeometry(0.1, 0.12, 0.15, 16);
  lensGeom.rotateX(Math.PI / 2);
  const lens = new THREE.Mesh(lensGeom, sensorMat);
  lens.position.set(0.35, 0.75, 0.75);
  lens.name = 'Laser_Telemetry_Pod';
  group.add(lens);

  // Audio antennas
  const antennaGeom = new THREE.CylinderGeometry(0.02, 0.03, 1.0, 8);
  const antenna = new THREE.Mesh(antennaGeom, shellMat);
  antenna.position.set(-0.9, 0.8, -0.2);
  antenna.rotation.z = -0.25;
  group.add(antenna);

  return { group, animations: [] };
}

/**
 * Creates 6-Axis Industrial Robotic Manipulator
 */
function createRobotArmScene(): { group: THREE.Group; animations: THREE.AnimationClip[] } {
  const group = new THREE.Group();
  group.name = 'Industrial_Robotic_Arm';

  const industrialOrange = new THREE.MeshStandardMaterial({
    color: 0xea580c,
    metalness: 0.6,
    roughness: 0.35,
    name: 'Industrial_Coating_Orange',
  });

  const jointDark = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    metalness: 0.8,
    roughness: 0.4,
    name: 'Heavy_Alloy_Joints',
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe5e7eb,
    metalness: 0.98,
    roughness: 0.1,
    name: 'Hydraulic_Chrome',
  });

  // Base platform
  const baseGeom = new THREE.CylinderGeometry(0.9, 1.1, 0.3, 24);
  const base = new THREE.Mesh(baseGeom, jointDark);
  base.name = 'Floor_Mount_Pedestal';
  group.add(base);

  // Swivel Turntable
  const swivel = new THREE.Group();
  swivel.name = 'Swivel_Turret';
  swivel.position.y = 0.25;
  group.add(swivel);

  const turretGeom = new THREE.CylinderGeometry(0.65, 0.65, 0.4, 20);
  const turret = new THREE.Mesh(turretGeom, industrialOrange);
  swivel.add(turret);

  // Lower arm link
  const lowerArmJoint = new THREE.Group();
  lowerArmJoint.name = 'Lower_Arm_Joint';
  lowerArmJoint.position.set(0, 0.3, 0);
  swivel.add(lowerArmJoint);

  const lowerLinkGeom = new THREE.BoxGeometry(0.35, 1.8, 0.45);
  const lowerLink = new THREE.Mesh(lowerLinkGeom, industrialOrange);
  lowerLink.position.set(0, 0.9, 0);
  lowerArmJoint.add(lowerLink);

  // Hydraulic cylinder on lower arm
  const cylinderGeom = new THREE.CylinderGeometry(0.08, 0.08, 1.2, 12);
  const cylinder = new THREE.Mesh(cylinderGeom, chromeMat);
  cylinder.position.set(0.25, 0.8, 0);
  lowerArmJoint.add(cylinder);

  // Upper elbow joint
  const elbowJoint = new THREE.Group();
  elbowJoint.name = 'Elbow_Joint';
  elbowJoint.position.set(0, 1.8, 0);
  lowerArmJoint.add(elbowJoint);

  const elbowGeom = new THREE.CylinderGeometry(0.28, 0.28, 0.5, 16);
  elbowGeom.rotateZ(Math.PI / 2);
  const elbow = new THREE.Mesh(elbowGeom, jointDark);
  elbowJoint.add(elbow);

  // Forearm link
  const forearmGeom = new THREE.BoxGeometry(0.28, 1.5, 0.35);
  const forearm = new THREE.Mesh(forearmGeom, industrialOrange);
  forearm.position.set(0, 0.75, 0);
  elbowJoint.add(forearm);

  // Wrist & Claw Gripper
  const wrist = new THREE.Group();
  wrist.name = 'Wrist_Tool_Flange';
  wrist.position.set(0, 1.5, 0);
  elbowJoint.add(wrist);

  const wristHubGeom = new THREE.CylinderGeometry(0.22, 0.22, 0.2, 16);
  const wristHub = new THREE.Mesh(wristHubGeom, jointDark);
  wrist.add(wristHub);

  // Gripper claws
  const clawGeom = new THREE.BoxGeometry(0.06, 0.35, 0.15);
  const clawLeft = new THREE.Mesh(clawGeom, chromeMat);
  clawLeft.position.set(-0.12, 0.25, 0);
  clawLeft.name = 'Gripper_Jaw_Left';
  wrist.add(clawLeft);

  const clawRight = new THREE.Mesh(clawGeom, chromeMat);
  clawRight.position.set(0.12, 0.25, 0);
  clawRight.name = 'Gripper_Jaw_Right';
  wrist.add(clawRight);

  // Articulation animation
  const times = [0, 1.5, 3, 4.5, 6];
  
  // Turret rotation
  const q0 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -0.5);
  const q1 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.6);
  const q2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -0.5);
  const swivelTrack = new THREE.QuaternionKeyframeTrack('Swivel_Turret.quaternion', [0, 3, 6], [
    q0.x, q0.y, q0.z, q0.w,
    q1.x, q1.y, q1.z, q1.w,
    q2.x, q2.y, q2.z, q2.w,
  ]);

  // Lower arm pitch
  const p0 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.2);
  const p1 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.3);
  const lowerTrack = new THREE.QuaternionKeyframeTrack('Lower_Arm_Joint.quaternion', [0, 3, 6], [
    p0.x, p0.y, p0.z, p0.w,
    p1.x, p1.y, p1.z, p1.w,
    p0.x, p0.y, p0.z, p0.w,
  ]);

  // Elbow pitch
  const e0 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.4);
  const e1 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.5);
  const elbowTrack = new THREE.QuaternionKeyframeTrack('Elbow_Joint.quaternion', [0, 3, 6], [
    e0.x, e0.y, e0.z, e0.w,
    e1.x, e1.y, e1.z, e1.w,
    e0.x, e0.y, e0.z, e0.w,
  ]);

  const clip = new THREE.AnimationClip('Pick_And_Place_Cycle', 6, [swivelTrack, lowerTrack, elbowTrack]);

  return { group, animations: [clip] };
}

/**
 * Converts a Three.js scene + animations into a real standard binary GLB ArrayBuffer
 */
export async function exportToGLBArrayBuffer(
  object: THREE.Object3D,
  animations: THREE.AnimationClip[] = []
): Promise<ArrayBuffer> {
  const exporter = new GLTFExporter();
  return new Promise((resolve, reject) => {
    exporter.parse(
      object,
      (result) => {
        if (result instanceof ArrayBuffer) {
          resolve(result);
        } else {
          // If JSON returned, convert to blob array buffer
          const jsonString = JSON.stringify(result);
          const blob = new Blob([jsonString], { type: 'application/json' });
          blob.arrayBuffer().then(resolve).catch(reject);
        }
      },
      (error) => reject(error),
      {
        binary: true,
        animations,
        embedImages: true,
      }
    );
  });
}

/**
 * Initializes the default curated sample models and returns ModelItems
 */
export async function generateSampleModels(): Promise<ModelItem[]> {
  const samples = [
    {
      id: 'sample-drone',
      name: 'Cyber_Stealth_Drone.glb',
      generator: createDroneScene,
    },
    {
      id: 'sample-helmet',
      name: 'Tactical_Combat_Helmet.glb',
      generator: createHelmetScene,
    },
    {
      id: 'sample-robot',
      name: 'Industrial_6Axis_Robot.glb',
      generator: createRobotArmScene,
    },
  ];

  const modelItems: ModelItem[] = [];

  for (const s of samples) {
    const { group, animations } = s.generator();
    const arrayBuffer = await exportToGLBArrayBuffer(group, animations);
    const blob = new Blob([arrayBuffer], { type: 'model/gltf-binary' });
    const fileUrl = URL.createObjectURL(blob);
    const { metrics } = analyzeModel(group, animations);

    modelItems.push({
      id: s.id,
      name: s.name,
      size: blob.size,
      fileUrl,
      fileBlob: blob,
      createdAt: Date.now(),
      isSample: true,
      metrics,
    });
  }

  return modelItems;
}
