export async function buildContext({ store, actorId, selectedNodeIds = [], role }) {
  let nodeIds = new Set(selectedNodeIds || []);
  if (actorId) {
    const scope = await store.computeInterestScope(actorId);
    scope.nodeIds.forEach(id => nodeIds.add(id));
  }
  const ROLE_SEEDS = {
    econ: ['econ', 'cb', 'rep', 'ctrl', 'ods', 'ai', 'core'],
    aian: ['aian', 'ai', 'stand', 'valid', 'core'],
    mgmt: ['core', 'reg', 'ods', 'rep', 'ctrl', 'dom', 'proc', 'ai']
  };
  if (role && ROLE_SEEDS[role]) ROLE_SEEDS[role].forEach(id => nodeIds.add(id));
  nodeIds.add('core');

  const expanded = new Set(nodeIds);
  for (const id of [...nodeIds]) {
    const neighbors = await store.getNeighbors(id);
    neighbors.forEach(n => expanded.add(n));
  }

  const [subgraph, workItems, reviews] = await Promise.all([
    store.getSubgraph([...expanded]),
    store.getWorkItems(),
    store.getReviews()
  ]);

  return {
    nodeIds: [...expanded],
    nodes: subgraph.nodes,
    edges: subgraph.edges,
    workItems: workItems.filter(w => w.relatedNodeIds?.some(id => expanded.has(id))),
    reviews: reviews.filter(r => expanded.has(r.scope?.artifactId)),
    actorId: actorId || null,
    role: role || null
  };
}
