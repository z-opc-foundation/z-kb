import os from 'node:os';
import { createServer } from 'vite';

// --dev-backend：强制走 dev 后端（忽略 shell 里导出的 KB_API_TARGET），用于本地登录联调
if (process.argv.includes('--dev-backend')) {
  delete process.env.KB_API_TARGET;
}

const port = 5173;
const server = await createServer({
  clearScreen: false,
  server: {
    host: '0.0.0.0',
    port,
    strictPort: true,
    allowedHosts: ['.cfuture.shop'],
  },
});

await server.listen();

const green = (value) => `\u001b[32m${value}\u001b[39m`;
const localAddress = `http://localhost:${port}`;
const networkAddress = getNetworkAddress();

console.log('\n  App listening at:\n');
console.log(`  > Local:   ${green(localAddress)}`);

if (networkAddress) {
  console.log(`  > Network: ${green(`http://${networkAddress}:${port}`)}`);
}

console.log('\n  Now you can open the browser with the addresses above.\n');

function getNetworkAddress() {
  const interfaces = os.networkInterfaces();

  for (const addresses of Object.values(interfaces)) {
    const address = addresses?.find((item) => item.family === 'IPv4' && !item.internal);
    if (address) {
      return address.address;
    }
  }
}
