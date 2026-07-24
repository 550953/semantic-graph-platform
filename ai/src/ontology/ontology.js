/**
 * Ontology Engine — Default First, Configure Second, Extend Third
 */

export const DEFAULT_PROFILE = {
  id: 'default-v1',
  name: 'Platform Default Profile',
  version: '1.0.0',
  nodeTypes: [
    { id: 'domain', label: 'Domain', layer: 'Knowledge' },
    { id: 'core', label: 'Core', layer: 'Knowledge' },
    { id: 'service', label: 'Service', layer: 'Implementation' },
    { id: 'role', label: 'Role', layer: 'Resource' },
    { id: 'note', label: 'Note', layer: 'Knowledge' },
    { id: 'step', label: 'Step', layer: 'Project' },
    { id: 'act', label: 'Activity', layer: 'Project' }
  ],
  edgeTypes: [
    { id: 'relates', label: 'relates' },
    { id: 'owns', label: 'owns' },
    { id: 'implements', label: 'implements' },
    { id: 'depends', label: 'depends' },
    { id: 'reviews', label: 'reviews' }
  ],
  workItemTypes: [
    'Task', 'Defect', 'ReviewComment', 'Risk', 'TechnicalDebt',
    'ChangeRequest', 'Improvement', 'KnowledgeDefect'
  ],
  roles: [
    'Заказчик', 'Owner', 'Исполнитель', 'Рецензент', 'Аудитор',
    'Экономист', 'Технолог', 'Разработчик', 'Инженер ИИ', 'Руководитель'
  ],
  actorTypes: ['Human', 'AIAgent', 'Service', 'ExternalSystem'],
  layers: ['Knowledge', 'Implementation', 'Project', 'Resource'],
  interestScopeRules: {
    expandHops: 1,
    includeWorkItems: true,
    includeReviews: true
  },
  aiAgents: [
    { id: 'graph-copilot', name: 'Graph Copilot', type: 'AIAgent' }
  ],
  extensions: [] // additive only
};

export function loadProfile(stored) {
  if (!stored) return structuredClone(DEFAULT_PROFILE);
  // Merge additive extensions
  const base = structuredClone(DEFAULT_PROFILE);
  if (stored.extensions?.length) {
    base.extensions = stored.extensions;
    for (const ext of stored.extensions) {
      if (ext.nodeTypes) base.nodeTypes.push(...ext.nodeTypes);
      if (ext.roles) base.roles.push(...ext.roles);
      if (ext.workItemTypes) base.workItemTypes.push(...ext.workItemTypes);
    }
  }
  if (stored.name) base.name = stored.name;
  return base;
}

export function extendProfile(current, extension) {
  const profile = loadProfile(current);
  profile.extensions = profile.extensions || [];
  profile.extensions.push({
    id: extension.id || `ext-${Date.now()}`,
    at: new Date().toISOString(),
    ...extension
  });
  return profile;
}
