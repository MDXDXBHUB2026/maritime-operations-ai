import { Actor, Department, OrganizationalUnit } from '../../domain/enterprise';
import {
  INITIAL_ACTORS,
  INITIAL_DEPARTMENTS,
  INITIAL_ORGANIZATIONAL_UNITS,
} from '../../data/enterprise';

export interface IOrganizationService {
  getDepartments(): Department[];
  getDepartment(id: string): Department | undefined;
  getUnits(departmentId?: string): OrganizationalUnit[];
  getActors(departmentId?: string): Actor[];
  getActor(id: string): Actor | undefined;
  getDirectReports(actorId: string): Actor[];
}

export const OrganizationService: IOrganizationService = {
  getDepartments: () => INITIAL_DEPARTMENTS,

  getDepartment: (id) => INITIAL_DEPARTMENTS.find((d) => d.id === id),

  getUnits: (departmentId) => {
    if (!departmentId) return INITIAL_ORGANIZATIONAL_UNITS;
    return INITIAL_ORGANIZATIONAL_UNITS.filter((u) => u.departmentId === departmentId);
  },

  getActors: (departmentId) => {
    if (!departmentId) return INITIAL_ACTORS;
    return INITIAL_ACTORS.filter((a) => a.departmentId === departmentId);
  },

  getActor: (id) => INITIAL_ACTORS.find((a) => a.id === id),

  getDirectReports: (actorId) => {
    return INITIAL_ACTORS.filter((a) => a.reportsTo === actorId);
  },
};
