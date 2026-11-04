// The standard web image exposes personal suggestions without a separate service.
import { spawn } from 'node:child_process';
import { createDatevServer } from './server.mjs';

const relay = createDatevServer({});
relay.listen(8766, '127.0.0.1', () => {
  const caddy = spawn(
    'caddy',
    ['run', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile'],
    { stdio: 'inherit' },
  );
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => caddy.kill(signal));
  caddy.once('exit', (code, signal) => {
    relay.close();
    relay.closeAllConnections();
    process.exitCode = code ?? (signal === 'SIGTERM' ? 0 : 1);
  });
});
