import { Component } from 'react';
import type { ReactNode } from 'react';
import { ru } from '../i18n/ru.js';
/** Chunk/network failures get a safe screen; no component payload or credential is logged. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? (
      <main className="auth-shell">
        <h1>{ru.error}</h1>
        <button type="button" onClick={() => window.location.reload()}>
          {ru.retry}
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
