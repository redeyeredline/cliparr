// src/utils/isPortFree.js
import http from 'http';

/**
 * Returns true if the given port is already in use.
 * @param {number} port
 * @returns {Promise<boolean>}
 */
export function isPortInUse(port) {
  return new Promise((resolve) => {
    const tester = http.createServer();
    tester.once('error', () => resolve(true));
    tester.once('listening', () =>
      tester.close(() => resolve(false)),
    );
    tester.listen(port);
  });
}
