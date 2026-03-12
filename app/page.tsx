'use client';

import dynamic from 'next/dynamic';

// Disable SSR for the canvas (React Flow requires browser APIs)
const WorkflowCanvas = dynamic(() => import('./components/WorkflowCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="text-center">
        <div className="text-4xl mb-3">⚙️</div>
        <p className="text-gray-500 text-sm font-medium">Loading FlowBuilder...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  return <WorkflowCanvas />;
}
