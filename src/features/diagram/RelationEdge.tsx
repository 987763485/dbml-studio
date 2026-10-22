import {
  getBezierPath,
  getSmoothStepPath,
  Position,
  type EdgeProps,
} from '@xyflow/react';
import { useAppStore } from '../../stores/appStore';
import { relationLabel, refEndpointText } from '../../core/model';
import type { RelationFlowEdge } from './flowTypes';

function direction(position: Position): [number, number] {
  if (position === Position.Right) return [1, 0];
  if (position === Position.Left) return [-1, 0];
  if (position === Position.Top) return [0, -1];
  return [0, 1];
}

function isMany(relation: string): boolean {
  return relation === '*' || relation.endsWith('*') || relation.includes('*');
}

interface EndpointMarkerProps {
  x: number;
  y: number;
  position: Position;
  relation: string;
  optional: boolean;
  color: string;
}

function EndpointMarker({
  x,
  y,
  position,
  relation,
  optional,
  color,
}: EndpointMarkerProps) {
  const [dx, dy] = direction(position);
  const px = -dy;
  const py = dx;
  const many = isMany(relation);
  const baseX = x;
  const baseY = y;
  const outward = 10;

  return (
    <g className="edge-marker" style={{ stroke: color }} fill="none" pointerEvents="none">
      {many ? (
        <>
          <path
            d={`M ${baseX + px * -5} ${baseY + py * -5} L ${baseX + dx * outward} ${
              baseY + dy * outward
            }`}
          />
          <path
            d={`M ${baseX + px * 5} ${baseY + py * 5} L ${baseX + dx * outward} ${
              baseY + dy * outward
            }`}
          />
          <path d={`M ${baseX} ${baseY} L ${baseX + dx * outward} ${baseY + dy * outward}`} />
        </>
      ) : (
        <path
          d={`M ${baseX + dx * 7 + px * -4.5} ${baseY + dy * 7 + py * -4.5} L ${
            baseX + dx * 7 + px * 4.5
          } ${baseY + dy * 7 + py * 4.5}`}
        />
      )}
      {optional && (
        <circle
          cx={baseX + dx * (many ? 17 : 14)}
          cy={baseY + dy * (many ? 17 : 14)}
          r={2.8}
          fill="var(--panel)"
        />
      )}
    </g>
  );
}

export function RelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<RelationFlowEdge>) {
  const edgeStyle = useAppStore((state) => state.edgeStyle);
  const showRelationLabels = useAppStore((state) => state.showRelationLabels);
  const selection = useAppStore((state) => state.selection);

  const params = {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: 0.28,
  };
  const [path, labelX, labelY] =
    edgeStyle === 'orthogonal'
      ? getSmoothStepPath({ ...params, borderRadius: 10, offset: 24 })
      : getBezierPath(params);

  const selectedEdge = Boolean(selected);
  const active = Boolean(data?.active) || selectedEdge;
  const dimmed = Boolean(data?.dimmed);
  const color = active ? 'var(--accent)' : data?.ref.color || 'var(--edge)';
  const inactive = data?.ref.inactive ?? false;
  const showLabel = Boolean(data) && (showRelationLabels || active || selectedEdge);
  const label = data ? relationLabel(data.ref) : '';
  const chipWidth = Math.max(54, label.length * 6.5 + 16);
  const isSelectedRef =
    selection?.type === 'ref' && selection.edgeId === id;

  return (
    <>
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        className="edge-hit"
        pointerEvents="stroke"
      />
      <path
        d={path}
        fill="none"
        className={`relation-edge-path ${active || isSelectedRef ? 'active' : ''} ${
          inactive ? 'inactive' : ''
        }`}
        style={{
          stroke: color,
          strokeWidth: active || isSelectedRef ? 1.9 : 1.35,
          opacity: dimmed ? 0.2 : inactive ? 0.55 : 1,
        }}
      >
        <title>
          {data
            ? `${refEndpointText(data.ref.left)}  ${data.ref.op}  ${refEndpointText(
                data.ref.right,
              )}${
                data.ref.onDelete ? ` · ON DELETE ${data.ref.onDelete.toUpperCase()}` : ''
              }`
            : ''}
        </title>
      </path>

      {data && (
        <>
          <EndpointMarker
            x={sourceX}
            y={sourceY}
            position={sourcePosition}
            relation={data.sourceRelation}
            optional={data.sourceOptional}
            color={color}
          />
          <EndpointMarker
            x={targetX}
            y={targetY}
            position={targetPosition}
            relation={data.targetRelation}
            optional={data.targetOptional}
            color={color}
          />
        </>
      )}

      {showLabel && (
        <g
          className={`edge-chip ${active || isSelectedRef ? 'active' : ''}`}
          transform={`translate(${labelX}, ${labelY})`}
          style={{ opacity: dimmed ? 0.25 : 1 }}
          pointerEvents="none"
        >
          <rect x={-chipWidth / 2} y={-9} width={chipWidth} height={18} rx={9} />
          <text textAnchor="middle" y={3.2}>
            {label}
          </text>
        </g>
      )}
    </>
  );
}
