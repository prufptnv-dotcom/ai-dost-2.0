# Production Runtime Boundary

`ProductionRuntimeIntegration.js` exposes `createProductionOperationExecutor`, the shared boundary for sensitive agent operations.

Use it at the execution layer for terminal, filesystem, patch, and other production-sensitive actions:

```js
const { createProductionOperationExecutor } = require('./security/ProductionRuntimeIntegration');

const { executeProductionOperation } = createProductionOperationExecutor({
  gatekeeper,
  workspaceManager,
  audit,
  limits,
  correlationId
});

await executeProductionOperation(operation, input, context, executor);
```

The boundary performs capability authorization, approval validation, workspace-path checks, bounded input/output/step enforcement, correlation propagation, and completion/failure auditing.

The legacy orchestrator remains behavior-compatible until each direct executor call is migrated to this boundary. Migration must be done at the central execution dispatch point rather than by duplicating checks in individual tools.
