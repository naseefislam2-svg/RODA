import { StrictMode, Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/manrope';
import '@fontsource-variable/space-grotesk';
import './styles.css';
import App from './App';
class AppBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <main className="recovery-screen"><img src="/mark.svg" width="52" alt="RODA"/><h1>Let’s find our footing.</h1><p>The workspace could not load. Your saved local data has not been cleared.</p><button className="button dark" onClick={() => location.reload()}>Reload RODA</button></main> : this.props.children; }
}
createRoot(document.getElementById('root')!).render(<StrictMode><AppBoundary><App/></AppBoundary></StrictMode>);
