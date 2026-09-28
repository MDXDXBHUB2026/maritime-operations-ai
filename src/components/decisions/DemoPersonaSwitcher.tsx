import React, { useEffect, useState } from 'react';
import { useAuth } from '../../app/AuthContext';
import type { CurrentUser } from '../../services/authSession';
import { DecisionService } from '../../services/decisionService';
import { DEMO_PERSONAS, DemoPersona } from '../../services/localDecisionEngine';

/**
 * The person acting on decisions: the signed-in user in API mode, or the selected demo persona
 * in the static (browser-only) demo.
 */
export function useDecisionActor(): CurrentUser | null {
  const { user } = useAuth();
  const [persona, setPersona] = useState<CurrentUser>(() => DemoPersona.current());
  useEffect(() => DemoPersona.subscribe(setPersona), []);
  return DecisionService.isBackend() ? user : persona;
}

/** Static demo only: choose which role to act as, to exercise the approval rules. */
export const DemoPersonaSwitcher: React.FC = () => {
  const actor = useDecisionActor();
  if (DecisionService.isBackend()) return null;
  return (
    <div className="decision-demo-bar" data-testid="demo-persona">
      <label>
        Acting as (browser demo)
        <select
          value={actor?.user_id ?? ''}
          onChange={(e) => DemoPersona.set(e.target.value)}
          aria-label="Demo persona"
        >
          {DEMO_PERSONAS.map((p) => (
            <option key={p.user_id} value={p.user_id}>
              {p.role_label}
            </option>
          ))}
        </select>
      </label>
      <span className="decision-muted">
        No backend on this site: decisions and the audit trail are kept in this browser only. Demo
        roles are fleet-wide; sign-in, vessel scope and delegation need the backend.
      </span>
    </div>
  );
};
