export { assignmentRouter } from './assignment.routes.js';
export { registerAssignmentListeners } from './events.js';
export {
  ensureAssignmentForUser,
  getAssignmentResultForUser,
  getAssignmentStatus,
  type AssignmentResult,
} from './assignment.service.js';
