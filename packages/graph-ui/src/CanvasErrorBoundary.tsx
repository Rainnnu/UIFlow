import React from 'react';
export class CanvasErrorBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="failure" role="alert"><p>画布加载失败。</p><button onClick={() => window.location.reload()}>重新加载</button></div> : this.props.children; }
}
