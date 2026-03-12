'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { WorkflowNodeData, TestStatus } from '../lib/types';
import { NodeIcon } from '../lib/icons';

type WFNodeProps = NodeProps<Node<WorkflowNodeData>>;

const CATEGORY_LABELS: Record<string, string> = {
  trigger: 'Trigger', flow: 'Flow', data: 'Data', transform: 'Transform',
  send: 'Send', external: 'External', ai: 'AI', code: 'Code', end: 'End',
};

const WorkflowNode = memo(({ data, selected }: WFNodeProps) => {
  const nodeData = data as WorkflowNodeData;
  const { nodeConfig, label, description } = nodeData;

  const isTrigger = nodeConfig.type === 'trigger';
  const isEnd = nodeConfig.type === 'end';
  const isSwitch = nodeConfig.isSwitchNode;
  const isCondition = nodeConfig.id === 'flow-if-else';
  const isLoop = nodeConfig.isLoopNode;
  const hasTryCatch = nodeConfig.hasTryCatch;
  const isAI = nodeConfig.type === 'ai';

  const switchCases: string[] = isSwitch
    ? String(nodeData.fields?.cases ?? 'Case A, Case B, Default')
        .split(',').map((c: string) => c.trim()).filter(Boolean)
    : [];

  const hasCustomFields = (nodeData.customFields || []).length > 0;
  const testStatus: TestStatus | undefined = nodeData.testState?.status;

  const handleStyle = {
    background: nodeConfig.borderColor,
    borderColor: 'white',
    borderWidth: 2,
    width: 10,
    height: 10,
  };

  return (
    <div
      style={{
        background: nodeConfig.bgColor,
        borderColor: selected ? nodeConfig.borderColor : `${nodeConfig.borderColor}55`,
        borderWidth: selected ? 2 : 1.5,
        borderStyle: 'solid',
        boxShadow: selected
          ? `0 0 0 3px ${nodeConfig.borderColor}25, 0 4px 14px rgba(0,0,0,0.14)`
          : '0 2px 8px rgba(0,0,0,0.07)',
        transform: selected ? 'scale(1.02)' : 'scale(1)',
        transition: 'all 0.15s ease',
        minWidth: isSwitch ? Math.max(200, switchCases.length * 72) : 185,
        maxWidth: 260,
        borderRadius: 12,
      }}
      className="cursor-pointer select-none"
    >
      {/* Top input handle */}
      {!isTrigger && (
        <Handle type="target" position={Position.Top} style={handleStyle} />
      )}

      {/* AI gradient top line */}
      {isAI && (
        <div
          className="h-0.5 rounded-t-xl"
          style={{ background: `linear-gradient(90deg, ${nodeConfig.borderColor}aa, transparent, ${nodeConfig.borderColor}aa)` }}
        />
      )}

      <div className="px-3 pt-2.5 pb-2.5">
        {/* Badge row */}
        <div className="flex items-center justify-between mb-1.5 gap-1">
          <div className="flex items-center gap-1 flex-wrap">
            <span
              className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full"
              style={{ color: nodeConfig.color, background: `${nodeConfig.borderColor}18` }}
            >
              {CATEGORY_LABELS[nodeConfig.type] || nodeConfig.type}
            </span>
            {isTrigger && <span className="text-[8px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded-full font-bold">START</span>}
            {isLoop   && <span className="text-[8px] bg-purple-100 text-purple-700 px-1 py-0.5 rounded-full font-bold">↺ LOOP</span>}
            {isAI     && <span className="text-[8px] bg-pink-100 text-pink-700 px-1 py-0.5 rounded-full font-bold">✦ AI</span>}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {hasCustomFields && (
              <span className="text-[8px] bg-gray-100 text-gray-500 px-1 py-0.5 rounded-full" title={`${nodeData.customFields!.length} custom fields`}>
                ⚙ {nodeData.customFields!.length}
              </span>
            )}
            {/* Test status dot */}
            {testStatus === 'success' && (
              <span title="Test passed" className="w-3 h-3 rounded-full bg-green-500 border-2 border-white shadow flex items-center justify-center">
                <span className="text-white text-[6px] font-black leading-none">✓</span>
              </span>
            )}
            {testStatus === 'error' && (
              <span title="Test failed" className="w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow flex items-center justify-center">
                <span className="text-white text-[6px] font-black leading-none">✗</span>
              </span>
            )}
            {testStatus === 'running' && (
              <span title="Running test..." className="w-3 h-3 rounded-full bg-orange-400 border-2 border-white shadow animate-pulse" />
            )}
          </div>
        </div>

        {/* Icon + label */}
        <div className="flex items-start gap-2">
          <div
            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5"
            style={{ background: `${nodeConfig.borderColor}20`, color: nodeConfig.color }}
          >
            <NodeIcon name={nodeConfig.iconName} size={14} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold leading-tight" style={{ color: nodeConfig.color }}>
              {label || nodeConfig.label}
            </div>
            {description && (
              <div className="text-[10px] text-gray-400 mt-0.5 leading-tight line-clamp-2">
                {description}
              </div>
            )}
          </div>
        </div>

        {/* Switch case preview chips */}
        {isSwitch && switchCases.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {switchCases.map((c, i) => (
              <span key={i} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md"
                style={{ background: `${nodeConfig.borderColor}15`, color: nodeConfig.color, border: `1px solid ${nodeConfig.borderColor}30` }}>
                {c}
              </span>
            ))}
          </div>
        )}

        {/* Try/Catch pill */}
        {hasTryCatch && (
          <div className="mt-2 flex gap-1.5">
            <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">✓ OK</span>
            <span className="text-[9px] bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded font-bold">✗ ERR</span>
          </div>
        )}

        {/* If/Else pill */}
        {isCondition && (
          <div className="mt-2 flex gap-1.5">
            <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">✓ TRUE</span>
            <span className="text-[9px] bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded font-bold">✗ FALSE</span>
          </div>
        )}
      </div>

      {/* Single bottom output */}
      {!isEnd && !isSwitch && !isCondition && !hasTryCatch && (
        <Handle type="source" position={Position.Bottom} style={handleStyle} />
      )}

      {/* If/Else dual output */}
      {isCondition && (
        <>
          <Handle type="source" position={Position.Bottom} id="true"
            style={{ ...handleStyle, left: '28%', background: '#10b981' }} />
          <Handle type="source" position={Position.Bottom} id="false"
            style={{ ...handleStyle, left: '72%', background: '#ef4444' }} />
        </>
      )}

      {/* Try/Catch dual output */}
      {hasTryCatch && (
        <>
          <Handle type="source" position={Position.Bottom} id="success"
            style={{ ...handleStyle, left: '28%', background: '#10b981' }} />
          <Handle type="source" position={Position.Bottom} id="error"
            style={{ ...handleStyle, left: '72%', background: '#ef4444' }} />
        </>
      )}

      {/* Switch dynamic outputs */}
      {isSwitch && switchCases.length > 0 && (
        <>
          <div className="flex justify-around pb-1.5 px-2 mt-0.5">
            {switchCases.map((c, i) => (
              <span key={i} className="text-[8px] font-medium text-gray-500 truncate text-center" style={{ maxWidth: `${100 / switchCases.length}%` }}>
                {c.length > 7 ? c.slice(0, 6) + '…' : c}
              </span>
            ))}
          </div>
          {switchCases.map((_, i) => (
            <Handle key={i} type="source" position={Position.Bottom} id={`case-${i}`}
              style={{ ...handleStyle, left: `${((i + 0.5) / switchCases.length) * 100}%` }}
            />
          ))}
        </>
      )}
    </div>
  );
});

WorkflowNode.displayName = 'WorkflowNode';
export default WorkflowNode;
