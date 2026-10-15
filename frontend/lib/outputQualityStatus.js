export function extractOutputQualityStatus(message) {
  const match = String(message || '').match(/\*\*(SUCCEEDED|FAILED|UNVERIFIED|PARTIAL)\*\*\s*[—-]/i);
  return match ? match[1].toUpperCase() : null;
}

export function settlePlanTasks(tasks, message) {
  const status = extractOutputQualityStatus(message);
  if (!status || status === 'SUCCEEDED') return tasks.map((task) => ({ ...task, status: 'completed' }));
  return tasks.map((task, index) => ({
    ...task,
    status: index < tasks.length - 1 ? 'completed' : status === 'FAILED' ? 'error' : 'unverified',
  }));
}
