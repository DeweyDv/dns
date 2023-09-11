const http = require('http');
const httpProxy = require('http-proxy');
const fs = require('fs');
var requests = 0;
function readMappingFromFile() {
  try {
    const data = fs.readFileSync('domains.txt', 'utf8');
    mapping = JSON.parse(data);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

setInterval(() => {
  fs.readFile('total_requests.txt', 'utf8', (err, data) => {
    if (err) {
      console.error(err);
    }
    let totalRequests = parseInt(data, 10);
    totalRequests += requests;
    requests = 0;
    fs.writeFile('total_requests.txt', totalRequests.toString(), 'utf8', (err) => {
      if (err) {
        console.error(err);
      }
    });
  });
}, 1000)

readMappingFromFile();
setInterval(readMappingFromFile, 3000);

const proxy = httpProxy.createProxyServer({});

const server = http.createServer((req, res) => {
  const { host, 'user-agent': userAgent } = req.headers;

  try {
    if (host && mapping.hasOwnProperty(host)) {
      const { target } = mapping[host];
      const userKey = `${host}-${userAgent}`;
      proxy.web(req, res, { target });
      requests++;
    } else {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Access Forbidden');
    }
  } catch (error) {
    console.error('Error occurred:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
});

proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err);
  res.writeHead(500, { 'Content-Type': 'text/plain' });
  res.end('Internal Server Error');
});

server.listen(80, () => {
  console.log('Reverse proxy server listening on port 80');
});