/**
 * FSM Engine — universal lifecycle for Work Items and other objects.
 * Not bank-specific: Task, Defect, Review, any business object.
 */

const MACHINES = {
  Task: {
    initial: 'open',
    states: {
      open: { on: { START: 'in_progress', CANCEL: 'cancelled' } },
      in_progress: { on: { DONE: 'done', BLOCK: 'blocked', CANCEL: 'cancelled' } },
      blocked: { on: { UNBLOCK: 'in_progress', CANCEL: 'cancelled' } },
      done: { on: { REOPEN: 'open' } },
      cancelled: { on: { REOPEN: 'open' } }
    }
  },
  Defect: {
    initial: 'open',
    states: {
      open: { on: { CONFIRM: 'confirmed', REJECT: 'rejected' } },
      confirmed: { on: { FIX: 'in_progress' } },
      in_progress: { on: { RESOLVE: 'resolved', REOPEN: 'confirmed' } },
      resolved: { on: { CLOSE: 'closed', REOPEN: 'confirmed' } },
      rejected: { on: { REOPEN: 'open' } },
      closed: { on: { REOPEN: 'open' } }
    }
  },
  ReviewComment: {
    initial: 'open',
    states: {
      open: { on: { ACCEPT: 'accepted', REJECT: 'rejected', WORK: 'in_progress' } },
      in_progress: { on: { ACCEPT: 'accepted', REJECT: 'rejected' } },
      accepted: { on: {} },
      rejected: { on: { REOPEN: 'open' } }
    }
  },
  ChangeRequest: {
    initial: 'open',
    states: {
      open: { on: { APPROVE: 'approved', REJECT: 'rejected' } },
      approved: { on: { START: 'in_progress' } },
      in_progress: { on: { DONE: 'done' } },
      done: { on: {} },
      rejected: { on: { REOPEN: 'open' } }
    }
  },
  KnowledgeDefect: {
    initial: 'open',
    states: {
      open: { on: { TRIAGE: 'triaged' } },
      triaged: { on: { FIX: 'in_progress', DEFER: 'deferred' } },
      in_progress: { on: { RESOLVE: 'resolved' } },
      resolved: { on: { CLOSE: 'closed' } },
      deferred: { on: { REOPEN: 'open' } },
      closed: { on: {} }
    }
  },
  Risk: {
    initial: 'open',
    states: {
      open: { on: { MITIGATE: 'mitigating', ACCEPT: 'accepted' } },
      mitigating: { on: { CLOSE: 'closed' } },
      accepted: { on: { CLOSE: 'closed' } },
      closed: { on: {} }
    }
  },
  TechnicalDebt: {
    initial: 'open',
    states: {
      open: { on: { SCHEDULE: 'scheduled', WONTFIX: 'wontfix' } },
      scheduled: { on: { START: 'in_progress' } },
      in_progress: { on: { DONE: 'done' } },
      done: { on: {} },
      wontfix: { on: { REOPEN: 'open' } }
    }
  },
  Improvement: {
    initial: 'open',
    states: {
      open: { on: { START: 'in_progress', DEFER: 'deferred' } },
      in_progress: { on: { DONE: 'done' } },
      deferred: { on: { REOPEN: 'open' } },
      done: { on: {} }
    }
  }
};

export function getMachine(type) {
  return MACHINES[type] || MACHINES.Task;
}

export function getAllowedTransitions(type, currentStatus) {
  const m = getMachine(type);
  const state = m.states[currentStatus] || m.states[m.initial];
  return Object.keys(state.on || {});
}

export function transition(type, currentStatus, event) {
  const m = getMachine(type);
  const state = m.states[currentStatus];
  if (!state) return { ok: false, error: `Unknown status: ${currentStatus}` };
  const next = state.on?.[event];
  if (!next) {
    return {
      ok: false,
      error: `Event ${event} not allowed from ${currentStatus}`,
      allowed: Object.keys(state.on || {})
    };
  }
  return { ok: true, from: currentStatus, to: next, event };
}

export function listMachines() {
  return Object.entries(MACHINES).map(([type, m]) => ({
    type,
    initial: m.initial,
    states: Object.keys(m.states),
    transitions: Object.fromEntries(
      Object.entries(m.states).map(([s, cfg]) => [s, Object.keys(cfg.on || {})])
    )
  }));
}
