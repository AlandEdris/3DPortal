import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  LightingPreset,
  RenderMode,
  BackgroundMode,
  CameraViewPreset,
  ModelItem,
} from '../types/model';
import { analyzeModel, MaterialDetail, SceneNode } from '../utils/modelAnalyzer';

interface Viewer3DProps {
  currentModel: ModelItem | null;
  lighting: LightingPreset;
  renderMode: RenderMode;
  background: BackgroundMode;
  customBgColor?: string;
  autoRotate: boolean;
  autoRotateSpeed: number;
  showGrid: boolean;
  showShadows: boolean;
  showBoundingBox: boolean;
  cameraFov: number;
  isOrthographic: boolean;
  cameraPresetTrigger?: { preset: CameraViewPreset; timestamp: number } | null;
  resetViewTrigger?: number;
  zoomTrigger?: { delta: number; timestamp: number } | null;
  // Animation props
  activeAnimationIndex: number;
  isPlayingAnimation: boolean;
  animationSpeed: number;
  animationProgress: number; // 0 to 1
  onAnimationTimeUpdate?: (progress: number, currentTime: number, duration: number) => void;
  // Analysis callbacks
  onModelAnalyzed?: (metrics: ModelItem['metrics'], hierarchy: SceneNode, materials: MaterialDetail[]) => void;
  onCaptureThumbnail?: (dataUrl: string) => void;
  // Node focus / visibility overrides
  hiddenNodeIds: Set<string>;
  focusedNodeId?: string | null;
  materialOverrides: Record<string, { colorHex?: string; roughness?: number; metalness?: number; wireframe?: boolean }>;
}

export const Viewer3D: React.FC<Viewer3DProps> = ({
  currentModel,
  lighting,
  renderMode,
  background,
  customBgColor,
  autoRotate,
  autoRotateSpeed,
  showGrid,
  showShadows,
  showBoundingBox,
  cameraFov,
  isOrthographic,
  cameraPresetTrigger,
  resetViewTrigger,
  zoomTrigger,
  activeAnimationIndex,
  isPlayingAnimation,
  animationSpeed,
  animationProgress,
  onAnimationTimeUpdate,
  onModelAnalyzed,
  onCaptureThumbnail,
  hiddenNodeIds,
  focusedNodeId,
  materialOverrides,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Dynamic prop refs to avoid stale closures in the continuous requestAnimationFrame loop
  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;
  const autoRotateSpeedRef = useRef(autoRotateSpeed);
  autoRotateSpeedRef.current = autoRotateSpeed;
  const isPlayingAnimationRef = useRef(isPlayingAnimation);
  isPlayingAnimationRef.current = isPlayingAnimation;
  const animationSpeedRef = useRef(animationSpeed);
  animationSpeedRef.current = animationSpeed;
  const activeAnimationIndexRef = useRef(activeAnimationIndex);
  activeAnimationIndexRef.current = activeAnimationIndex;
  const isOrthographicRef = useRef(isOrthographic);
  isOrthographicRef.current = isOrthographic;
  const onAnimationTimeUpdateRef = useRef(onAnimationTimeUpdate);
  onAnimationTimeUpdateRef.current = onAnimationTimeUpdate;

  // Three.js instances
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const persCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const orthoCameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const lightsGroupRef = useRef<THREE.Group | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const shadowPlaneRef = useRef<THREE.Mesh | null>(null);
  const bboxHelperRef = useRef<THREE.BoxHelper | null>(null);

  // Animation Mixer
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const animationActionsRef = useRef<THREE.AnimationAction[]>([]);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());

  // Cached original materials
  const originalMaterialsRef = useRef<Map<string, THREE.Material | THREE.Material[]>>(new Map());

  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modelBounds, setModelBounds] = useState<{ center: THREE.Vector3; radius: number } | null>(null);

  // 1. Initialize Scene, Renderer, Cameras, and Controls
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    rendererRef.current = renderer;

    // Cameras
    const aspect = width / height;
    const persCamera = new THREE.PerspectiveCamera(cameraFov, aspect, 0.05, 1000000);
    persCamera.position.set(3, 2.5, 4);
    persCameraRef.current = persCamera;

    const orthoSize = 4;
    const orthoCamera = new THREE.OrthographicCamera(
      -orthoSize * aspect,
      orthoSize * aspect,
      orthoSize,
      -orthoSize,
      0.05,
      1000000
    );
    orthoCamera.position.set(3, 2.5, 4);
    orthoCameraRef.current = orthoCamera;

    // Controls - Unrestricted infinite zoom
    const controls = new OrbitControls(persCamera, canvasRef.current);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = Infinity; // Allow zooming out as much as user wants without limits
    controls.minDistance = 0.001; // Allow close inspection
    controls.zoomSpeed = 1.15;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // Lights Container
    const lightsGroup = new THREE.Group();
    lightsGroup.name = '__helper_lights';
    scene.add(lightsGroup);
    lightsGroupRef.current = lightsGroup;

    // Model Container
    const modelGroup = new THREE.Group();
    scene.add(modelGroup);
    modelGroupRef.current = modelGroup;

    // Grid Helper
    const grid = new THREE.GridHelper(10, 20, 0x52525b, 0x27272a);
    grid.position.y = 0;
    grid.name = '__helper_grid';
    scene.add(grid);
    gridHelperRef.current = grid;

    // Soft Shadow Plane
    const shadowGeo = new THREE.PlaneGeometry(16, 16);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.35 });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.receiveShadow = true;
    shadowPlane.position.y = 0.001;
    shadowPlane.name = '__helper_shadow';
    scene.add(shadowPlane);
    shadowPlaneRef.current = shadowPlane;

    // Resize handling
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newWidth, height: newHeight } = entry.contentRect;
        if (newWidth > 0 && newHeight > 0) {
          const newAspect = newWidth / newHeight;

          if (persCameraRef.current) {
            persCameraRef.current.aspect = newAspect;
            persCameraRef.current.updateProjectionMatrix();
          }

          if (orthoCameraRef.current) {
            const size = 4;
            orthoCameraRef.current.left = -size * newAspect;
            orthoCameraRef.current.right = size * newAspect;
            orthoCameraRef.current.top = size;
            orthoCameraRef.current.bottom = -size;
            orthoCameraRef.current.updateProjectionMatrix();
          }

          renderer.setSize(newWidth, newHeight);
        }
      }
    });
    resizeObserver.observe(container);

    // Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const delta = clockRef.current.getDelta();

      // Update animation mixer
      if (mixerRef.current && isPlayingAnimationRef.current) {
        mixerRef.current.update(delta * animationSpeedRef.current);

        const currentAction = animationActionsRef.current[activeAnimationIndexRef.current];
        if (currentAction && onAnimationTimeUpdateRef.current) {
          const clip = currentAction.getClip();
          const duration = clip.duration;
          const time = currentAction.time % duration;
          onAnimationTimeUpdateRef.current(time / duration, time, duration);
        }
      }

      // Update controls
      if (controlsRef.current) {
        controlsRef.current.autoRotate = autoRotateRef.current;
        controlsRef.current.autoRotateSpeed = autoRotateSpeedRef.current;
        controlsRef.current.update();
      }

      // Active camera
      const activeCamera = isOrthographicRef.current ? orthoCameraRef.current : persCameraRef.current;
      if (activeCamera && sceneRef.current && rendererRef.current) {
        rendererRef.current.render(sceneRef.current, activeCamera);
      }
    };
    animate();

    // Context lost handling
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      console.warn('WebGL context lost. Pausing rendering.');
    };
    const handleContextRestored = () => {
      console.info('WebGL context restored.');
    };
    const canvas = canvasRef.current;
    canvas.addEventListener('webglcontextlost', handleContextLost, false);
    canvas.addEventListener('webglcontextrestored', handleContextRestored, false);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  // Sync autoRotate and autoRotateSpeed immediately with OrbitControls
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
      controlsRef.current.autoRotateSpeed = autoRotateSpeed;
      controlsRef.current.update();
    }
  }, [autoRotate, autoRotateSpeed]);

  // 2. Setup Lighting Presets
  useEffect(() => {
    if (!lightsGroupRef.current) return;
    const lg = lightsGroupRef.current;

    // Clear existing lights
    while (lg.children.length > 0) {
      lg.remove(lg.children[0]);
    }

    switch (lighting) {
      case 'studio': {
        // High-end balanced studio lighting
        const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
        keyLight.position.set(5, 8, 6);
        keyLight.castShadow = showShadows;
        keyLight.shadow.mapSize.width = 2048;
        keyLight.shadow.mapSize.height = 2048;
        keyLight.shadow.bias = -0.0001;
        lg.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0xdbeafe, 1.2);
        fillLight.position.set(-6, 4, -4);
        lg.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0xfff7ed, 1.6);
        rimLight.position.set(0, 7, -7);
        lg.add(rimLight);

        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x3f3f46, 0.8);
        lg.add(hemiLight);
        break;
      }
      case 'cyber': {
        // Vibrant neon cyberpunk style
        const cyanKey = new THREE.DirectionalLight(0x06b6d4, 3.2);
        cyanKey.position.set(6, 6, 5);
        cyanKey.castShadow = showShadows;
        lg.add(cyanKey);

        const magentaRim = new THREE.DirectionalLight(0xec4899, 2.8);
        magentaRim.position.set(-5, 4, -5);
        lg.add(magentaRim);

        const amberAccent = new THREE.PointLight(0xf59e0b, 2.5, 20);
        amberAccent.position.set(0, -2, 4);
        lg.add(amberAccent);

        const darkHemi = new THREE.HemisphereLight(0x1e1b4b, 0x050510, 0.6);
        lg.add(darkHemi);
        break;
      }
      case 'sunset': {
        // Golden hour warm dusk lighting
        const sun = new THREE.DirectionalLight(0xf97316, 3.5);
        sun.position.set(8, 4, 6);
        sun.castShadow = showShadows;
        lg.add(sun);

        const skyAmbient = new THREE.HemisphereLight(0x7c3aed, 0x431407, 1.0);
        lg.add(skyAmbient);

        const bounce = new THREE.DirectionalLight(0xfde047, 1.0);
        bounce.position.set(-4, -2, -4);
        lg.add(bounce);
        break;
      }
      case 'darkroom': {
        // Dramatic low-key spotlight
        const spot = new THREE.SpotLight(0xffffff, 4.5, 30, Math.PI / 6, 0.4, 1);
        spot.position.set(0, 9, 3);
        spot.castShadow = showShadows;
        lg.add(spot);

        const softRim = new THREE.DirectionalLight(0x94a3b8, 0.6);
        softRim.position.set(-5, 2, -5);
        lg.add(softRim);

        const ambient = new THREE.AmbientLight(0x18181b, 0.3);
        lg.add(ambient);
        break;
      }
      case 'daylight': {
        // Crisp sun with open sky reflection
        const sun = new THREE.DirectionalLight(0xfffaed, 2.8);
        sun.position.set(4, 10, 4);
        sun.castShadow = showShadows;
        lg.add(sun);

        const sky = new THREE.HemisphereLight(0xbae6fd, 0x71717a, 1.2);
        lg.add(sky);
        break;
      }
    }
  }, [lighting, showShadows]);

  // 3. Background styling
  useEffect(() => {
    if (!rendererRef.current) return;
    const renderer = rendererRef.current;

    switch (background) {
      case 'obsidian':
        renderer.setClearColor(0x09090b, 1);
        break;
      case 'slate':
        renderer.setClearColor(0x18181b, 1);
        break;
      case 'white':
        renderer.setClearColor(0xfafafa, 1);
        break;
      case 'navy':
        renderer.setClearColor(0x030712, 1);
        break;
      case 'transparent':
        renderer.setClearColor(0x000000, 0);
        break;
    }

    if (customBgColor && background !== 'transparent') {
      try {
        renderer.setClearColor(new THREE.Color(customBgColor), 1);
      } catch {
        // Ignore color parse errors
      }
    }
  }, [background, customBgColor]);

  // 4. Update Grid & Shadows
  useEffect(() => {
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = showGrid;
    }
    if (shadowPlaneRef.current) {
      shadowPlaneRef.current.visible = showShadows;
    }
  }, [showGrid, showShadows]);

  // 5. Update Camera FOV and Type
  useEffect(() => {
    if (persCameraRef.current) {
      persCameraRef.current.fov = cameraFov;
      persCameraRef.current.updateProjectionMatrix();
    }
    if (controlsRef.current) {
      const activeCamera = isOrthographic ? orthoCameraRef.current : persCameraRef.current;
      if (activeCamera) {
        controlsRef.current.object = activeCamera;
        controlsRef.current.update();
      }
    }
  }, [cameraFov, isOrthographic]);

  // 6. Camera Frame Helper Function
  const frameModel = useCallback((bounds: { center: THREE.Vector3; radius: number }) => {
    if (!controlsRef.current || !persCameraRef.current || !bounds) return;

    const { center, radius } = bounds;
    controlsRef.current.target.copy(center);
    controlsRef.current.maxDistance = Infinity; // Completely unrestricted zoom out
    controlsRef.current.minDistance = 0.001;

    if (persCameraRef.current) {
      persCameraRef.current.far = 1000000;
      persCameraRef.current.updateProjectionMatrix();
    }

    const fov = persCameraRef.current.fov * (Math.PI / 180);
    // 1.85 provides generous, comfortable breathing space around the model so it isn't zoomed in too close
    const distance = Math.abs(radius / Math.sin(fov / 2)) * 1.85;

    // Isometric-angled camera placement
    const dir = new THREE.Vector3(1.2, 0.85, 1.4).normalize();
    const newPos = center.clone().add(dir.multiplyScalar(distance));
    persCameraRef.current.position.copy(newPos);
    persCameraRef.current.lookAt(center);

    if (orthoCameraRef.current && containerRef.current) {
      const aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      const size = radius * 2.0;
      orthoCameraRef.current.left = -size * aspect;
      orthoCameraRef.current.right = size * aspect;
      orthoCameraRef.current.top = size;
      orthoCameraRef.current.bottom = -size;
      orthoCameraRef.current.far = 1000000;
      orthoCameraRef.current.position.copy(newPos);
      orthoCameraRef.current.lookAt(center);
      orthoCameraRef.current.updateProjectionMatrix();
    }

    // Scale lighting container to illuminate large aircraft models properly
    if (lightsGroupRef.current) {
      const lightScale = Math.max(radius / 5, 1);
      lightsGroupRef.current.scale.set(lightScale, lightScale, lightScale);
      lightsGroupRef.current.position.copy(center);
    }

    controlsRef.current.update();
  }, []);

  // 7. Load GLB Model
  useEffect(() => {
    if (!currentModel?.fileUrl || !modelGroupRef.current || !sceneRef.current) {
      if (modelGroupRef.current) {
        while (modelGroupRef.current.children.length > 0) {
          modelGroupRef.current.remove(modelGroupRef.current.children[0]);
        }
      }
      if (bboxHelperRef.current && sceneRef.current) {
        sceneRef.current.remove(bboxHelperRef.current);
        bboxHelperRef.current.dispose();
        bboxHelperRef.current = null;
      }
      setIsLoading(false);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);
    setLoadError(null);

    // Clean previous model
    const mg = modelGroupRef.current;
    while (mg.children.length > 0) {
      const child = mg.children[0];
      mg.remove(child);
    }

    if (bboxHelperRef.current) {
      sceneRef.current.remove(bboxHelperRef.current);
      bboxHelperRef.current.dispose();
      bboxHelperRef.current = null;
    }

    if (mixerRef.current) {
      mixerRef.current.stopAllAction();
      mixerRef.current = null;
      animationActionsRef.current = [];
    }

    originalMaterialsRef.current.clear();

    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    loader.setDRACOLoader(dracoLoader);

    loader.load(
      currentModel.fileUrl,
      (gltf) => {
        if (isCancelled) return;
        const root = gltf.scene;

        // Traverse to enable shadows and cache original materials
        root.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            if (mesh.material) {
              originalMaterialsRef.current.set(mesh.uuid, mesh.material);
            }
          }
        });

        // Compute Bounding Box & Center
        const box = new THREE.Box3().setFromObject(root);
        const center = new THREE.Vector3();
        box.getCenter(center);

        const sphere = new THREE.Sphere();
        box.getBoundingSphere(sphere);
        const radius = sphere.radius || 1;

        // Reposition model so bottom sits flat on ground grid (Y=0)
        const minY = box.min.y;
        root.position.y = -minY;
        center.y -= minY;

        mg.add(root);

        // Update ground grid position/scale based on model footprint
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.z, 2);
        if (gridHelperRef.current) {
          const gridSize = Math.max(Math.ceil(maxDim * 3), 6);
          gridHelperRef.current.scale.set(gridSize / 10, 1, gridSize / 10);
        }

        // Bounding Box Helper
        const bbox = new THREE.BoxHelper(root, 0x38bdf8);
        bbox.name = '__helper_bbox';
        bbox.visible = showBoundingBox;
        sceneRef.current?.add(bbox);
        bboxHelperRef.current = bbox;

        const boundsData = { center, radius };
        setModelBounds(boundsData);
        frameModel(boundsData);

        // Animations Setup
        if (gltf.animations && gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(root);
          mixerRef.current = mixer;
          animationActionsRef.current = gltf.animations.map((clip) => {
            const action = mixer.clipAction(clip);
            action.clampWhenFinished = false;
            action.loop = THREE.LoopRepeat;
            return action;
          });

          // Play active animation
          const initialAction = animationActionsRef.current[activeAnimationIndex] || animationActionsRef.current[0];
          if (initialAction && isPlayingAnimation) {
            initialAction.play();
          }
        }

        // Analyze and notify
        const { metrics, hierarchy, materials } = analyzeModel(root, gltf.animations);
        onModelAnalyzed?.(metrics, hierarchy, materials);

        // Capture snapshot thumbnail only if model does not already have one
        if (!currentModel.thumbnailUrl) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (rendererRef.current && sceneRef.current && persCameraRef.current) {
                const activeCamera = isOrthographic ? orthoCameraRef.current : persCameraRef.current;
                if (activeCamera) {
                  rendererRef.current.render(sceneRef.current, activeCamera);
                  const thumb = rendererRef.current.domElement.toDataURL('image/jpeg', 0.7);
                  onCaptureThumbnail?.(thumb);
                }
              }
            });
          });
        }

        setIsLoading(false);
      },
      undefined,
      (err) => {
        if (isCancelled) return;
        console.error('Error loading GLB:', err);
        setLoadError('Failed to parse GLB file. Ensure file is a valid standard binary GLB or GLTF.');
        setIsLoading(false);
      }
    );

    return () => {
      isCancelled = true;
    };
  }, [currentModel?.fileUrl]);

  // 8. Handle Render Modes (Wireframe, Normals, X-Ray, Clay, Shaded)
  useEffect(() => {
    if (!modelGroupRef.current) return;

    const clayMaterial = new THREE.MeshStandardMaterial({
      color: 0xdddddd,
      roughness: 0.85,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    const normalMaterial = new THREE.MeshNormalMaterial({
      side: THREE.DoubleSide,
    });

    const xrayMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      metalness: 0.1,
      roughness: 0.1,
      transparent: true,
      opacity: 0.45,
      transmission: 0.6,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    modelGroupRef.current.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        let original = originalMaterialsRef.current.get(mesh.uuid);

        if (!original && mesh.material) {
          originalMaterialsRef.current.set(mesh.uuid, mesh.material);
          original = mesh.material;
        }

        if (!original) return;

        if (renderMode === 'shaded') {
          mesh.material = original;
        } else if (renderMode === 'wireframe') {
          if (Array.isArray(original)) {
            mesh.material = original.map((m) => {
              const clone = m.clone();
              (clone as any).wireframe = true;
              return clone;
            });
          } else {
            const clone = original.clone();
            (clone as any).wireframe = true;
            mesh.material = clone;
          }
        } else if (renderMode === 'clay') {
          mesh.material = clayMaterial;
        } else if (renderMode === 'normals') {
          mesh.material = normalMaterial;
        } else if (renderMode === 'xray') {
          mesh.material = xrayMaterial;
        }
      }
    });
  }, [renderMode]);

  // 9. Handle Bounding Box visibility
  useEffect(() => {
    if (bboxHelperRef.current) {
      bboxHelperRef.current.visible = showBoundingBox;
    }
  }, [showBoundingBox]);

  // 10. Handle Reset View Trigger
  useEffect(() => {
    if (resetViewTrigger) {
      if (modelBounds) {
        frameModel(modelBounds);
      } else if (modelGroupRef.current && modelGroupRef.current.children.length > 0) {
        const box = new THREE.Box3().setFromObject(modelGroupRef.current);
        const center = new THREE.Vector3();
        box.getCenter(center);
        const sphere = new THREE.Sphere();
        box.getBoundingSphere(sphere);
        frameModel({ center, radius: Math.max(sphere.radius, 1) });
      }
    }
  }, [resetViewTrigger, modelBounds, frameModel]);

  // 11. Handle Camera View Presets (Front, Back, Top, Isometric, etc.)
  useEffect(() => {
    if (!cameraPresetTrigger || !controlsRef.current || !persCameraRef.current) return;

    // Get bounds from state or compute dynamically from modelGroupRef
    let center = modelBounds?.center;
    let radius = modelBounds?.radius;

    if (!center || !radius) {
      if (modelGroupRef.current && modelGroupRef.current.children.length > 0) {
        const box = new THREE.Box3().setFromObject(modelGroupRef.current);
        center = new THREE.Vector3();
        box.getCenter(center);
        const sphere = new THREE.Sphere();
        box.getBoundingSphere(sphere);
        radius = Math.max(sphere.radius, 1);
      } else {
        center = new THREE.Vector3(0, 0, 0);
        radius = 3;
      }
    }

    const controls = controlsRef.current;
    const camera = persCameraRef.current;

    controls.target.copy(center);

    const fov = camera.fov * (Math.PI / 180);
    const distance = Math.abs(radius / Math.sin(fov / 2)) * 1.85;

    let targetOffset = new THREE.Vector3();
    camera.up.set(0, 1, 0);

    switch (cameraPresetTrigger.preset) {
      case 'iso':
        targetOffset.set(1, 0.75, 1).normalize().multiplyScalar(distance);
        break;
      case 'front':
        targetOffset.set(0, 0, distance);
        break;
      case 'back':
        targetOffset.set(0, 0, -distance);
        break;
      case 'top':
        targetOffset.set(0, distance, 0.0001);
        camera.up.set(0, 0, -1);
        break;
      case 'bottom':
        targetOffset.set(0, -distance, 0.0001);
        camera.up.set(0, 0, 1);
        break;
      case 'left':
        targetOffset.set(-distance, 0, 0);
        break;
      case 'right':
        targetOffset.set(distance, 0, 0);
        break;
    }

    const newPos = center.clone().add(targetOffset);
    camera.position.copy(newPos);
    camera.lookAt(center);

    if (orthoCameraRef.current) {
      orthoCameraRef.current.position.copy(newPos);
      orthoCameraRef.current.up.copy(camera.up);
      orthoCameraRef.current.lookAt(center);
      orthoCameraRef.current.updateProjectionMatrix();
    }

    controls.update();
  }, [cameraPresetTrigger, modelBounds]);

  // 12. Handle Animation Play / Pause / Clip change / Scrubber
  useEffect(() => {
    const actions = animationActionsRef.current;
    if (actions.length === 0) return;

    actions.forEach((act, idx) => {
      if (idx === activeAnimationIndex) {
        if (isPlayingAnimation) {
          if (!act.isRunning()) {
            act.reset();
            act.play();
          }
          act.paused = false;
        } else {
          act.paused = true;
        }
      } else {
        act.stop();
      }
    });
  }, [activeAnimationIndex, isPlayingAnimation]);

  // Scrubber progress update
  useEffect(() => {
    const action = animationActionsRef.current[activeAnimationIndex];
    if (action && !isPlayingAnimation) {
      const clip = action.getClip();
      action.time = clip.duration * animationProgress;
      mixerRef.current?.update(0);
    }
  }, [animationProgress, activeAnimationIndex, isPlayingAnimation]);

  // 13. Handle Scene Node Visibility and Focus
  useEffect(() => {
    if (!modelGroupRef.current) return;

    modelGroupRef.current.traverse((obj) => {
      if (hiddenNodeIds.has(obj.uuid)) {
        obj.visible = false;
      } else {
        obj.visible = true;
      }
    });

    if (focusedNodeId && controlsRef.current && persCameraRef.current) {
      const targetObj = modelGroupRef.current.getObjectByProperty('uuid', focusedNodeId);
      if (targetObj) {
        const box = new THREE.Box3().setFromObject(targetObj);
        const center = new THREE.Vector3();
        box.getCenter(center);
        const sphere = new THREE.Sphere();
        box.getBoundingSphere(sphere);
        const radius = Math.max(sphere.radius, 0.5);

        controlsRef.current.target.copy(center);
        const fov = persCameraRef.current.fov * (Math.PI / 180);
        const distance = Math.abs(radius / Math.sin(fov / 2)) * 1.5;
        const dir = persCameraRef.current.position.clone().sub(center).normalize();
        persCameraRef.current.position.copy(center.clone().add(dir.multiplyScalar(distance)));
        controlsRef.current.update();
      }
    }
  }, [hiddenNodeIds, focusedNodeId]);

  // 14. Handle Live Material Overrides
  useEffect(() => {
    if (!modelGroupRef.current) return;

    modelGroupRef.current.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((mat) => {
          if (mat && materialOverrides[mat.uuid]) {
            const override = materialOverrides[mat.uuid];
            const std = mat as THREE.MeshStandardMaterial;
            if (override.colorHex && std.color) {
              std.color.set(override.colorHex);
            }
            if (override.roughness !== undefined && std.roughness !== undefined) {
              std.roughness = override.roughness;
            }
            if (override.metalness !== undefined && std.metalness !== undefined) {
              std.metalness = override.metalness;
            }
            if (override.wireframe !== undefined) {
              std.wireframe = override.wireframe;
            }
            std.needsUpdate = true;
          }
        });
      }
    });
  }, [materialOverrides]);

  // 14. Handle Interactive Zoom In / Zoom Out Triggers
  useEffect(() => {
    if (!zoomTrigger || !controlsRef.current) return;
    const controls = controlsRef.current;
    const target = controls.target;
    const camera = controls.object;
    const offset = camera.position.clone().sub(target);
    // delta > 0 = zoom out (increase distance), delta < 0 = zoom in (decrease distance)
    const factor = zoomTrigger.delta > 0 ? 1.45 : 0.7;
    camera.position.copy(target.clone().add(offset.multiplyScalar(factor)));
    controls.update();
  }, [zoomTrigger]);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden select-none bg-neutral-950">
      <canvas ref={canvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing outline-none" />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-neutral-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-3 z-30 transition-opacity">
          <div className="w-10 h-10 border-2 border-neutral-700 border-t-sky-400 rounded-full animate-spin" />
          <p className="text-sm font-medium text-neutral-300">Processing 3D Geometry...</p>
        </div>
      )}

      {/* Error Banner */}
      {loadError && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 max-w-md w-11/12 bg-red-950/90 border border-red-800/80 rounded-lg p-4 text-center z-30 shadow-xl">
          <p className="text-sm text-red-200 font-medium">{loadError}</p>
        </div>
      )}
    </div>
  );
};
