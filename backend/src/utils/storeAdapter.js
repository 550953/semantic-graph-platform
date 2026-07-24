import { getDb, jparse } from './helper.js';

export function createStoreAdapter(workspaceId) {
  const db = getDb();
  
  return {
    getNodes: () => db.prepare('SELECT * FROM nodes WHERE workspace_id = ?').all(workspaceId).map(n => ({
      id: n.id, label: n.label, kind: n.kind, layer: n.layer, tab: n.tab,
      nodeKind: n.node_kind, description: n.description
    })),
    
    getEdges: () => db.prepare('SELECT * FROM edges WHERE workspace_id = ?').all(workspaceId),
    
    getNode: (id) => {
      const n = db.prepare('SELECT * FROM nodes WHERE id = ?').get(id);
      return n ? { id: n.id, label: n.label, kind: n.kind, layer: n.layer, tab: n.tab, description: n.description } : null;
    },
    
    getWorkItems: () => db.prepare('SELECT * FROM work_items WHERE workspace_id = ?').all(workspaceId).map(w => ({
      id: w.id, type: w.type, title: w.title, status: w.status,
      relatedNodeIds: jparse(w.related_node_ids_json, []), actorIds: jparse(w.actor_ids_json, [])
    })),
    
    getReviews: () => db.prepare('SELECT * FROM reviews WHERE workspace_id = ?').all(workspaceId).map(r => ({
      id: r.id, scope: jparse(r.scope_json, {}), text: r.text
    })),
    
    getNeighbors(nodeId) {
      const related = new Set([nodeId]);
      const edges = this.getEdges();
      for (const e of edges) {
        if (e.source === nodeId) related.add(e.target);
        if (e.target === nodeId) related.add(e.source);
      }
      return [...related];
    },
    
    computeInterestScope(aid) {
      const actor = db.prepare('SELECT * FROM actors WHERE id = ?').get(aid);
      if (!actor) return { actorId: aid, nodeIds: [], workItemIds: [], roles: [] };
      const wis = this.getWorkItems().filter(w => w.actorIds.includes(aid));
      const nodeIds = new Set();
      wis.forEach(w => w.relatedNodeIds.forEach(id => nodeIds.add(id)));
      [...nodeIds].forEach(id => this.getNeighbors(id).forEach(n => nodeIds.add(n)));
      return { actorId: aid, nodeIds: [...nodeIds], workItemIds: wis.map(w => w.id), roles: jparse(actor.roles_json, []) };
    },
    
    getSubgraph(ids) {
      const set = new Set(ids);
      return {
        nodes: this.getNodes().filter(n => set.has(n.id)),
        edges: this.getEdges().filter(e => set.has(e.source) && set.has(e.target))
      };
    }
  };
}