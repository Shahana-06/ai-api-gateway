/**
 * stubs.js
 *
 * Four fake upstream services running on ports 4001-4004.
 * Run with: node src/stubs.js
 *
 * In a real system these would be separate deployed services.
 * For this project they just return realistic-looking fake responses
 * so you can prove the gateway routes correctly.
 */

const express = require('express');

function createStub(name, port) {
  const app = express();
  app.use(express.json());

  app.all('*', (req, res) => {
    console.log(`[${name}] received ${req.method} ${req.path}`);
    res.json({
      service:   name,
      message:   `${name} service handled the request`,
      received:  req.body,
      timestamp: new Date().toISOString(),
    });
  });

  app.listen(port, () => {
    console.log(`[stub] ${name} running on port ${port}`);
  });
}

createStub('payments',      4001);
createStub('analytics',     4002);
createStub('auth',          4003);
createStub('notifications', 4004);