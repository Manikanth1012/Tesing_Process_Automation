import React from 'react';

export default function ProcessFlow() {
  return (
    <div style={{ margin: '-1.5rem -1.5rem -1.5rem', height: '100vh', overflow: 'hidden' }}>
      <iframe
        src="/tamt-process-flow.html"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block', background: '#070c18' }}
        title="TAMT Process Flow"
      />
    </div>
  );
}
