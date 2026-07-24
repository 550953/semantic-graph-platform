import { queryAll, queryOne, jparse } from './helper.js';

export function createStoreAdapter(workspaceId) {
  return {
    async getNodes() {
      const rows = await queryAll('SELECT * FROM nodes WHERE workspace_id = ?', [workspaceId]);
      return rows.map(n => ({
        id: n.id, label: n.label, kind: n.kind, layer: n.layer, tab: n.tab,
        nodeKind: n.node_kind, description: n.description
      }));
    },

    async getEdges() {
      return queryAll('SELECT * FROM edges WHERE workspace_id = ?', [workspaceId]);
    },

    async getNode(id) {
      const n = await queryOne('SELECT * FROM nodes WHERE id = ?', [id]);
      return n ? { id: n.id, label: n.label, kind: n.kind, layer: n.layer, tab: n.tab, description: n.description } : null;
    },

    async getWorkItems() {
      const rows = await queryAll('SELECT * FROM work_items WHERE workspace_id = ?', [workspaceId]);
      return rows.map(w => ({
        id: w.id, type: w.type, title: w.title, status: w.status,
        relatedNodeIds: jparse(w.related_node_ids_json, []),
        actorIds: jparse(w.actor_ids_json, [])
      }));
    },

    async getReviews() {
      const rows = await queryAll('SELECT * FROM reviews WHERE workspace_id = ?', [workspaceId]);
      return rows.map(r => ({ id: r.id, scope: jparse(r.scope_json, {}), text: r.text }));
    },

    async getNeighbors(nodeId) {
      const related = new Set([nodeId]);
      const edges = await this.getEdges();
      for (const e of edges) {
        if (e.source === nodeId) related.add(e.target);
        if (e.target === nodeId) related.add(e.source);
      }
      return [...related];
    },

    async computeInterestScope(aid) {
      const actor = await queryOne('SELECT * FROM actors WHERE id = ?', [aid]);
      if (!actor) return { actorId: aid, nodeIds: [], workItemIds: [], roles: [] };
      const wis = (await this.getWorkItems()).filter(w => w.actorIds.includes(aid));
      const nodeIds = new Set();
      wis.forEach(w => w.relatedNodeIds.forEach(id => nodeIds.add(id)));
      for (const id of [...nodeIds]) {
        const neighbors = await this.getNeighbors(id);
        neighbors.forEach(n => nodeIds.add(n));
      }
      return { actorId: aid, nodeIds: [...nodeIds], workItemIds: wis.map(w => w.id), roles: jparse(actor.roles_json, []) };
    },

    async getSubgraph(ids) {
      const set = new Set(ids);
      const [nodes, edges] = await Promise.all([this.getNodes(), this.getEdges()]);
      return {
        nodes: nodes.filter(n => set.has(n.id)),
        edges: edges.filter(e => set.has(e.source) && set.has(e.target))
      };
    }
  };
}
