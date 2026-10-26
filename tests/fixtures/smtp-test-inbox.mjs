import net from 'node:net';
import tls from 'node:tls';

// A loopback-only authenticated STARTTLS inbox. Never relays mail. Bodies remain
// in memory and are deliberately excluded from logs and the test report.
export async function startTestInbox({ key, cert, port = 2525 }) {
  const messages = [], sockets = new Set();
  let rejectNext = false;
  const context = tls.createSecureContext({ key, cert });
  function session(initial) {
    let socket = initial, buffer = '', secure = false, authenticated = false;
    let auth = 0, data = false, lines = [], recipient = null;
    sockets.add(socket); socket.on('close', () => sockets.delete(socket)); socket.on('error', () => {});
    const reply = value => socket.write(value + '\r\n');
    function receive(chunk) {
      buffer += chunk.toString();
      while (buffer.includes('\r\n')) {
        const end = buffer.indexOf('\r\n'), line = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        if (data) {
          if (line !== '.') { lines.push(line.replace(/^\.\./, '.')); continue; }
          data = false; messages.push({ recipient, raw: lines.join('\r\n'), secure, authenticated });
          lines = []; reply('250 captured locally'); continue;
        }
        if (auth) { auth--; if (!auth) { authenticated = true; reply('235 authenticated'); } else reply('334 UGFzc3dvcmQ6'); continue; }
        if (/^EHLO|^HELO/i.test(line)) { reply('250-localhost\r\n250-STARTTLS\r\n250 AUTH PLAIN LOGIN'); }
        else if (/^STARTTLS/i.test(line)) {
          reply('220 upgrade'); socket.removeListener('data', receive);
          socket = new tls.TLSSocket(socket, { isServer: true, secureContext: context }); secure = true;
          sockets.add(socket); socket.on('close', () => sockets.delete(socket)); socket.on('error', () => {}); socket.on('data', receive);
        }
        else if (/^AUTH PLAIN /i.test(line) && secure) { authenticated = true; reply('235 authenticated'); }
        else if (/^AUTH LOGIN/i.test(line) && secure) { auth = 2; reply('334 VXNlcm5hbWU6'); }
        else if (/^MAIL FROM:/i.test(line)) reply(secure && authenticated ? '250 sender accepted' : '530 TLS and authentication required');
        else if (/^RCPT TO:/i.test(line)) {
          const email = line.match(/<([^>]+)>/)?.[1]?.toLowerCase();
          if (!email?.endsWith('@example.test')) reply('550 test recipients only');
          else if (rejectNext) { rejectNext = false; reply('451 temporary test failure'); }
          else { recipient = email; reply('250 test recipient accepted'); }
        }
        else if (/^DATA$/i.test(line) && recipient) { data = true; lines = []; reply('354 message follows'); }
        else if (/^QUIT$/i.test(line)) { reply('221 goodbye'); socket.end(); }
        else if (/^RSET|^NOOP/i.test(line)) { recipient = null; reply('250 ok'); }
        else reply('500 unsupported test command');
      }
    }
    socket.on('data', receive); reply('220 localhost test inbox');
  }
  const server = net.createServer(session);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { messages, failNext: () => { rejectNext = true; }, close: async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise(resolve => server.close(resolve));
  } };
}

export function messageText(message) {
  const [headers, ...body] = message.raw.split('\r\n\r\n');
  const text = body.join('\r\n\r\n');
  return /Content-Transfer-Encoding: quoted-printable/i.test(headers)
    ? text.replace(/=\r\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    : /Content-Transfer-Encoding: base64/i.test(headers) ? Buffer.from(text, 'base64').toString() : text;
}
