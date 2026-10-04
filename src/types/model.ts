export interface ModelMetrics {
  triangles: number;
  vertices: number;
  meshes: number;
  materials: number;
  textures: number;
  animations: number;
  dimensions: {
    x: number;
    y: number;
    z: number;
  };
  animationNames: string[];
}

export interface ModelItem {
  id: string;
  name: string;
  size: number; // in bytes
  fileUrl: string;
  fileBlob?: Blob;
  thumbnailUrl?: string;
  createdAt: number;
  updatedAt?: number;
  createdBy?: string;
  createdById?: string;
  isSample?: boolean;
  isDefault?: boolean;
  serverSynced?: boolean;
  tags?: string[];
  metrics: ModelMetrics;
}

export interface ActivityLog {
  id: string;
  action: 'added' | 'modified' | 'deleted' | 'renamed';
  modelId: string;
  modelName: string;
  userEmail: string;
  userId?: string;
  timestamp: number;
  details?: string;
}

export type LightingPreset = 'studio' | 'cyber' | 'sunset' | 'darkroom' | 'daylight';
export type RenderMode = 'shaded' | 'wireframe' | 'xray' | 'normals' | 'clay';
export type BackgroundMode = 'obsidian' | 'slate' | 'white' | 'navy' | 'transparent';
export type CameraViewPreset = 'iso' | 'front' | 'back' | 'top' | 'bottom' | 'left' | 'right';
