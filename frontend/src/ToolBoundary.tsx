import { Component, type ReactNode } from "react";
import Dialog from "./Dialog";
export default class ToolBoundary extends Component<
  { children: ReactNode; onClose: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <Dialog title="Replay tool unavailable" onClose={this.props.onClose}>
          <p>
            This tool could not start. Close it to keep using the replay, or
            reload Pitwall to download the current version.
          </p>
          <div className="lab-actions">
            <button
              className="save-button"
              onClick={() => window.location.reload()}
            >
              Reload Pitwall
            </button>
            <button className="lab-button" onClick={this.props.onClose}>
              Return to replay
            </button>
          </div>
        </Dialog>
      );
    return this.props.children;
  }
}
