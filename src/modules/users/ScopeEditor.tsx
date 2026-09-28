import React from 'react';
import type { RoleName, Site } from '../../services/authSession';
import { SCOPED_ROLES, SHIPBOARD_ROLES } from '../../services/authService';

export interface ScopeValue {
  fleetWide: boolean;
  siteIds: string[];
}

interface ScopeEditorProps {
  role: RoleName;
  sites: Site[];
  value: ScopeValue;
  onChange: (value: ScopeValue) => void;
  idPrefix: string;
}

/** Client-side mirror of the backend scope rules, for immediate feedback. */
export function scopeProblem(role: RoleName, value: ScopeValue, sites: Site[]): string | null {
  if (!SCOPED_ROLES.includes(role)) return null;
  const types = value.siteIds.map((id) => sites.find((s) => s.site_id === id)?.site_type);
  if (SHIPBOARD_ROLES.includes(role)) {
    if (value.fleetWide) return 'Shipboard roles cannot be fleet-wide';
    if (types.some((t) => t !== 'vessel')) return 'Shipboard roles can only be assigned vessels';
    return null;
  }
  if (!value.fleetWide && value.siteIds.length === 0)
    return 'Choose fleet-wide or at least one site';
  return null;
}

export function defaultScope(role: RoleName): ScopeValue {
  return {
    fleetWide: SCOPED_ROLES.includes(role) && !SHIPBOARD_ROLES.includes(role),
    siteIds: [],
  };
}

/** Site-scope editor: shipboard roles pick vessels; shore roles choose fleet-wide or specific sites. */
export const ScopeEditor: React.FC<ScopeEditorProps> = ({
  role,
  sites,
  value,
  onChange,
  idPrefix,
}) => {
  if (!SCOPED_ROLES.includes(role)) {
    return <span className="decision-muted">No site scope for this role</span>;
  }
  const shipboard = SHIPBOARD_ROLES.includes(role);
  const selectable = sites.filter((s) => !shipboard || s.site_type === 'vessel');
  const toggle = (id: string) =>
    onChange({
      fleetWide: false,
      siteIds: value.siteIds.includes(id)
        ? value.siteIds.filter((x) => x !== id)
        : [...value.siteIds, id],
    });
  const problem = scopeProblem(role, value, sites);

  return (
    <div className="scope-editor" data-testid={`${idPrefix}-scope-editor`}>
      {!shipboard && (
        <label className="scope-check">
          <input
            type="checkbox"
            checked={value.fleetWide}
            onChange={(e) => onChange({ fleetWide: e.target.checked, siteIds: [] })}
          />
          Fleet-wide
        </label>
      )}
      {(shipboard || !value.fleetWide) && (
        <div className="scope-sites">
          {selectable.map((s) => (
            <label key={s.site_id} className="scope-check">
              <input
                type="checkbox"
                checked={value.siteIds.includes(s.site_id)}
                onChange={() => toggle(s.site_id)}
                aria-label={`${idPrefix} scope ${s.name}`}
              />
              {s.name}
              {s.site_type === 'terminal' && <span className="live-muted"> (terminal)</span>}
            </label>
          ))}
        </div>
      )}
      {problem && <div className="scope-problem">{problem}</div>}
      {!problem && shipboard && value.siteIds.length === 0 && (
        <div className="decision-muted" data-testid={`${idPrefix}-standby-note`}>
          No vessel: standby / on leave, with no approval authority until assigned or handed over.
        </div>
      )}
    </div>
  );
};
