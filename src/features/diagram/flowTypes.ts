import type { Edge, Node } from '@xyflow/react';
import type { RefModel, TableModel } from '../../core/model';

export interface TableNodeData extends Record<string, unknown> {
  table: TableModel;
  dimmed: boolean;
}

export type TableFlowNode = Node<TableNodeData, 'table'>;

export interface RelationEdgeData extends Record<string, unknown> {
  ref: RefModel;
  active: boolean;
  dimmed: boolean;
  sourceRelation: string;
  targetRelation: string;
  sourceOptional: boolean;
  targetOptional: boolean;
}

export type RelationFlowEdge = Edge<RelationEdgeData, 'relation'>;
