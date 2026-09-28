import { ApiClient } from './apiClient';
import type { Delegation, RoleName, Site } from './authSession';

export interface CrewMember {
  user_id: string;
  display_name: string;
  role: RoleName;
  role_label: string;
  valid_from: string | null;
  valid_until: string | null;
  status: 'active' | 'scheduled' | 'ended';
}

export interface SiteCrew {
  site: Site;
  crew: CrewMember[];
}

export interface EligibleDelegate {
  user_id: string;
  display_name: string;
  role: RoleName;
  role_label: string;
}

export interface NewDelegation {
  delegate_user_id: string;
  site_id: string;
  domains: string[];
  valid_from?: string;
  valid_until: string;
  reason: string;
}

/** Crew rotation and delegation of approval authority (API mode). */
export const CrewService = {
  listCrew: () => ApiClient.get<SiteCrew[]>('/crew'),
  handover: (
    siteId: string,
    body: { role: RoleName; incoming_user_id: string; effective_at?: string; note?: string }
  ) => ApiClient.post<SiteCrew>(`/sites/${encodeURIComponent(siteId)}/handover`, body),
  listDelegations: () => ApiClient.get<Delegation[]>('/delegations'),
  eligibleDelegates: () => ApiClient.get<EligibleDelegate[]>('/delegations/eligible-delegates'),
  createDelegation: (body: NewDelegation) => ApiClient.post<Delegation>('/delegations', body),
  revokeDelegation: (id: string, reason: string) =>
    ApiClient.post<Delegation>(`/delegations/${encodeURIComponent(id)}/revoke`, { reason }),
};
