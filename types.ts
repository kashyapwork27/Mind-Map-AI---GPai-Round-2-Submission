export interface MindMapNode {
  name: string;
  children?: MindMapNode[];
}

export interface LogicDiagramNode {
  id: string;
  label: string;
  shape?: 'rect' | 'diamond' | 'ellipse';
  // Properties added by d3 simulation
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface LogicDiagramLink {
  source: string | LogicDiagramNode;
  target: string | LogicDiagramNode;
  label?: string;
}

export interface LogicDiagramData {
  nodes: LogicDiagramNode[];
  links: LogicDiagramLink[];
}
