/**
 * nodeIO.ts — Core utilities for resolving node inputs / outputs.
 *
 * Every node in NODE_LIBRARY declares an `outputs` array describing what Python
 * variables it produces.  Some outputs are dynamic: their actual key comes from
 * a field value (e.g. the AI Completion node's output key is whatever the user
 * typed into the "Output Variable" field).  This file resolves those dynamics
 * and traverses the graph so any component can ask "what variables are
 * available *before* node X runs?"
 */

import type { NodeConfig, WorkflowNodeData, CustomField } from './types';
import type { Node, Edge } from '@xyflow/react';

type WFNode = Node<WorkflowNodeData>;

// ─────────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ResolvedOutput {
  /** Python variable name, e.g. "df", "invoice_data" */
  key: string;
  /** Human-readable label, e.g. "DataFrame", "AI Result" */
  label: string;
  /** Data type token */
  type: string;
  /** Where did this output come from? */
  source: 'built-in' | 'custom';
}

export interface AvailableVariable extends ResolvedOutput {
  nodeId: string;
  nodeName: string;
  nodeIconName: string;
  nodeColor: string;
  nodeBg: string;
  nodeBorder: string;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Type colour palette (used for chips in the UI)
// ─────────────────────────────────────────────────────────────────────────────

export const VAR_TYPE_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  dataframe: { bg: '#eef2ff', text: '#4338ca', border: '#c7d2fe', dot: '#6366f1' },
  string:    { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', dot: '#3b82f6' },
  number:    { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', dot: '#22c55e' },
  boolean:   { bg: '#fffbeb', text: '#b45309', border: '#fde68a', dot: '#f59e0b' },
  json:      { bg: '#faf5ff', text: '#7e22ce', border: '#e9d5ff', dot: '#8b5cf6' },
  list:      { bg: '#fdf2f8', text: '#9d174d', border: '#fbcfe8', dot: '#ec4899' },
  email:     { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe', dot: '#2563eb' },
  any:       { bg: '#f9fafb', text: '#4b5563', border: '#e5e7eb', dot: '#9ca3af' },
};

export function varTypeColor(type: string) {
  return VAR_TYPE_COLORS[type] ?? VAR_TYPE_COLORS.any;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Core: resolve outputs for one node
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given a node's config + current field values, return the list of variables
 * that node will produce when it runs.
 *
 * Dynamic keys: if `out.fromField` is set, the actual Python variable name
 * comes from `fields[fromField]` instead of `out.key`.
 */
export function computeNodeOutputs(
  config: NodeConfig,
  fields?: Record<string, string | number | boolean>,
  customFields?: CustomField[],
): ResolvedOutput[] {
  const results: ResolvedOutput[] = [];

  for (const o of config.outputs ?? []) {
    const key = o.fromField && fields?.[o.fromField]
      ? String(fields[o.fromField])
      : o.key;
    if (key) {
      results.push({ key, label: o.label, type: o.type, source: 'built-in' });
    }
  }

  // Custom fields defined by the user at node level are also variables
  for (const cf of customFields ?? []) {
    const k = String(cf.key ?? '').trim();
    if (k) {
      results.push({ key: k, label: cf.label || k, type: cf.type, source: 'custom' });
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Graph traversal: find all upstream node IDs
// ─────────────────────────────────────────────────────────────────────────────

function getUpstreamIds(nodeId: string, edges: Edge[]): Set<string> {
  const visited = new Set<string>();
  const queue: string[] = [nodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of edges) {
      if (edge.target === current && !visited.has(edge.source)) {
        visited.add(edge.source);
        queue.push(edge.source);
      }
    }
  }

  return visited;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Public API: get all variables available before nodeId runs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns every variable produced by nodes that run *before* `nodeId`,
 * complete with node name / colour for rendering in the UI.
 */
export function getAvailableVariables(
  nodeId: string,
  allNodes: WFNode[],
  edges: Edge[],
): AvailableVariable[] {
  const upstreamIds = getUpstreamIds(nodeId, edges);
  const variables: AvailableVariable[] = [];

  for (const node of allNodes) {
    if (!upstreamIds.has(node.id)) continue;
    const outputs = computeNodeOutputs(
      node.data.nodeConfig,
      node.data.fields,
      node.data.customFields,
    );
    for (const o of outputs) {
      variables.push({
        ...o,
        nodeId: node.id,
        nodeName: node.data.label || node.data.nodeConfig.label,
        nodeIconName: node.data.nodeConfig.iconName,
        nodeColor: node.data.nodeConfig.color,
        nodeBg: node.data.nodeConfig.bgColor,
        nodeBorder: node.data.nodeConfig.borderColor,
      });
    }
  }

  return variables;
}
