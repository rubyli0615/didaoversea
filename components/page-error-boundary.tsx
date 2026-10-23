"use client";

import { Component, type ReactNode } from "react";

// Isolate failed lazy imports / view rendering; never reload the entire app automatically.
export class PageErrorBoundary extends Component<{ children: ReactNode; resetKey: string; onBack: () => void; message?:string; backLabel?:string }, { failed: boolean; resetKey: string }> {
  state = { failed: false, resetKey: this.props.resetKey };
  static getDerivedStateFromError() { return { failed: true }; }
  static getDerivedStateFromProps(props: { resetKey: string }, state: { resetKey: string }) {
    return props.resetKey !== state.resetKey ? { failed: false, resetKey: props.resetKey } : null;
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return <section className="page-load-error" role="alert"><h2>此页面暂时无法打开</h2><p>{this.props.message??"可能是网络中断或旧页面的资源文件已失效。导航仍可使用，网站不会自动刷新。"}</p><div><button className="secondary-button" onClick={this.props.onBack}>{this.props.backLabel??"返回工作台总览"}</button><button className="primary-button" onClick={()=>window.location.reload()}>手动刷新网页</button></div></section>;
  }
}
