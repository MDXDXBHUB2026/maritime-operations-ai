import React, { useEffect, useState } from 'react';
import { AppConfig } from '../../services/config';
import { DecisionService } from '../../services/decisionService';
import { formatUtcClock, relativeTime, SimulationClock } from '../../services/simulationClock';
import { useNow } from '../../services/liveTelemetry';

type BackendState = 'checking' | 'online' | 'offline';

/** Top-bar status: ticking UTC clock, feed type, and (API mode) backend health. */
export const LiveStatusBar: React.FC = () => {
  const now = useNow(1000);
  const apiMode = AppConfig.dataMode === 'api';
  const [backend, setBackend] = useState<BackendState>('checking');
  const [provider, setProvider] = useState<string>('');

  useEffect(() => {
    if (!apiMode) return;
    let cancelled = false;
    const check = () =>
      DecisionService.health()
        .then((h) => {
          if (cancelled) return;
          setBackend(h.status === 'ok' ? 'online' : 'offline');
          setProvider(h.ai_provider);
        })
        .catch(() => {
          if (!cancelled) setBackend('offline');
        });
    check();
    const id = window.setInterval(check, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [apiMode]);

  return (
    <div className="live-status" data-testid="live-status">
      <span className="pill info" title="Telemetry is simulated from synthetic vessel baselines">
        <span className="live-dot" aria-hidden="true" /> SIMULATED LIVE FEED
      </span>
      {apiMode && (
        <span
          className={`pill ${backend === 'online' ? 'low' : backend === 'offline' ? 'critical' : 'medium'}`}
          title={provider ? `AI provider: ${provider}` : undefined}
        >
          BACKEND {backend.toUpperCase()}
        </span>
      )}
      <span className="live-clock" data-testid="live-clock">
        {formatUtcClock(now)}
      </span>
      <span
        className="live-muted"
        title="Synthetic dataset timestamps are shifted onto the current timeline"
      >
        Synthetic data · snapshot {relativeTime(SimulationClock.referenceMs, now)}
      </span>
    </div>
  );
};
