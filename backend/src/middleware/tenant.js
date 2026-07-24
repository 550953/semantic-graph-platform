import { validateWorkspaceAccess } from '../utils/helpers.js';

export function requireWorkspaceAccess(req, res, next) {
  const targetWs = req.params.wsId || req.headers['x-workspace-id'] || req.body?.workspace_id;
  
  if (!targetWs) {
    return next(); // Нет целевого workspace - пропускаем
  }
  
  if (!validateWorkspaceAccess(req, targetWs)) {
    return res.status(403).json({ error: 'Access denied to this workspace' });
  }
  
  next();
}