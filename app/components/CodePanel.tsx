'use client';

import { useState } from 'react';
import { Node, Edge } from '@xyflow/react';
import { WorkflowNodeData } from '../lib/types';
import { generatePythonCode, generateJavaScriptCode } from '../lib/codeGenerator';
import { Copy, RefreshCw, X, CheckCircle, Code2, FileCode } from 'lucide-react';

interface CodePanelProps {
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
  onClose: () => void;
}

type Lang = 'python' | 'javascript';

const LOADING_STEPS = [
  'Analysing workflow nodes…',
  'Resolving connections…',
  'Mapping data operations…',
  'Writing code…',
  'Formatting output…',
];

export default function CodePanel({ nodes, edges, onClose }: CodePanelProps) {
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>('python');
  const [loadStep, setLoadStep] = useState(0);

  const handleGenerate = async (targetLang: Lang = lang) => {
    setGenerating(true);
    setCode(null);
    setLoadStep(0);

    for (let i = 0; i < LOADING_STEPS.length; i++) {
      await new Promise(r => setTimeout(r, 200 + i * 120));
      setLoadStep(i);
    }

    const generated = targetLang === 'python'
      ? generatePythonCode(nodes as Node<WorkflowNodeData>[], edges)
      : generateJavaScriptCode(nodes as Node<WorkflowNodeData>[], edges);
    setCode(generated);
    setGenerating(false);
  };

  const handleCopy = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const switchLang = (l: Lang) => {
    setLang(l);
    if (code) handleGenerate(l);
  };

  const lines = code ? code.split('\n') : [];
  const lineCount = lines.length;
  const charCount = code?.length || 0;

  // Simple syntax colour hint
  const colorLine = (line: string, l: Lang): string => {
    if (l === 'python') {
      if (line.trimStart().startsWith('#')) return 'text-green-400';
      if (/^(\s*)(def |class |import |from |if |elif |else:|for |while |try:|except |with |return |raise |async |await )/.test(line)) return 'text-blue-400';
      if (/"""/.test(line)) return 'text-yellow-400';
    } else {
      if (line.trimStart().startsWith('//') || line.trimStart().startsWith('/*')) return 'text-green-400';
      if (/^\s*(const|let|var|function|async|await|return|if|else|for|while|try|catch|import|export|require)/.test(line)) return 'text-blue-400';
      if (/`|"[^"]*"|'[^']*'/.test(line)) return 'text-yellow-400';
    }
    return '';
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-800 flex-shrink-0">
        {/* Lang tabs */}
        <div className="flex items-center gap-1 bg-gray-900 rounded-lg p-0.5">
          <button
            onClick={() => switchLang('python')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
              lang === 'python' ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Code2 size={11} />
            Python
          </button>
          <button
            onClick={() => switchLang('javascript')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
              lang === 'javascript' ? 'bg-yellow-500 text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <FileCode size={11} />
            JavaScript
          </button>
        </div>

        {/* Stats */}
        {code && (
          <div className="hidden md:flex items-center gap-3 text-[10px] text-gray-500 ml-1">
            <span>{lineCount} lines</span>
            <span>·</span>
            <span>{charCount.toLocaleString()} chars</span>
            <span>·</span>
            <span>{nodes.length} nodes</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 ml-auto">
          {code && (
            <>
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all ${
                  copied ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {copied ? <CheckCircle size={11} /> : <Copy size={11} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={() => handleGenerate(lang)}
                className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors font-medium"
              >
                <RefreshCw size={11} />
                Regenerate
              </button>
            </>
          )}
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 p-1 rounded hover:bg-gray-800 transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Empty state */}
      {!code && !generating && (
        <div className="flex flex-col items-center justify-center flex-1 px-8">
          <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center mb-4 text-3xl">
            {lang === 'python' ? '🐍' : '⚡'}
          </div>
          <p className="text-[15px] font-bold text-white mb-1">Ready to generate</p>
          <p className="text-[12px] text-gray-400 text-center mb-6 leading-relaxed max-w-xs">
            Your workflow has <strong className="text-gray-200">{nodes.length} node{nodes.length !== 1 ? 's' : ''}</strong> across <strong className="text-gray-200">{new Set(nodes.map(n => n.data.nodeConfig?.type)).size} categories</strong>.
            Click to generate runnable {lang === 'python' ? 'Python' : 'Node.js'} code.
          </p>
          <button
            onClick={() => handleGenerate(lang)}
            disabled={nodes.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-bold rounded-xl transition-all shadow-lg shadow-orange-900/40 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
          >
            <span>✨</span>
            Generate {lang === 'python' ? 'Python' : 'JavaScript'} Code
          </button>
          {nodes.length === 0 && (
            <p className="text-[10px] text-gray-600 mt-3">Add nodes to the canvas first</p>
          )}
        </div>
      )}

      {/* Loading */}
      {generating && (
        <div className="flex flex-col items-center justify-center flex-1">
          <div className="text-4xl mb-5 animate-spin-custom">
            {lang === 'python' ? '🐍' : '⚡'}
          </div>
          <p className="text-[14px] font-bold text-white mb-4">Generating {lang} code…</p>
          <div className="space-y-2 w-72">
            {LOADING_STEPS.map((step, i) => (
              <div key={i} className={`flex items-center gap-2.5 transition-opacity ${i <= loadStep ? 'opacity-100' : 'opacity-20'}`}>
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${i < loadStep ? 'bg-green-500' : i === loadStep ? 'bg-orange-500' : 'bg-gray-600'}`} />
                <span className={`text-[11px] ${i <= loadStep ? 'text-gray-300' : 'text-gray-600'}`}>{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Code viewer */}
      {code && !generating && (
        <>
          {/* Status bar */}
          <div className="flex items-center gap-4 px-4 py-1.5 bg-gray-900 border-b border-gray-800 text-[9px] text-gray-500 flex-shrink-0">
            <span className="text-green-500 font-semibold flex items-center gap-1"><CheckCircle size={9} /> Generated</span>
            <span>{lineCount} lines · {charCount.toLocaleString()} chars</span>
            <span>·</span>
            <span>{nodes.length} nodes · {edges.length} edges</span>
            <span className="ml-auto">{lang === 'python' ? 'Python 3.9+' : 'Node.js 18+'}</span>
          </div>

          {/* Install hint */}
          <div className="px-4 py-2 bg-gray-900/50 border-b border-gray-800 flex-shrink-0">
            <p className="text-[9px] text-gray-500 font-mono">
              {lang === 'python'
                ? '$ pip install pandas openpyxl requests openai anthropic twilio watchdog flask python-dotenv'
                : '$ npm install axios dotenv'}
            </p>
          </div>

          {/* Code display */}
          <div className="flex-1 overflow-auto">
            <pre className="text-[11px] leading-relaxed p-4 min-h-full font-mono">
              {lines.map((line, i) => {
                const lineNum = String(i + 1).padStart(4, ' ');
                const colorClass = colorLine(line, lang);
                return (
                  <div key={i} className="flex hover:bg-gray-900/70 rounded group transition-colors">
                    <span className="select-none text-gray-700 mr-4 w-10 text-right flex-shrink-0 group-hover:text-gray-500 text-[10px] leading-relaxed">
                      {lineNum}
                    </span>
                    <span className={colorClass || 'text-gray-200'}>
                      {line || '\u00A0'}
                    </span>
                  </div>
                );
              })}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}
