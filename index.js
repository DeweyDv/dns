const fs = require('fs');
const http = require('http');
const httpProxy = require('http-proxy');
const express = require('express');
const bodyParser = require('body-parser');
const socketIO = require('socket.io');

var total_requests = 0;
var total_blocked_requests = 0;

const proxy = httpProxy.createProxyServer({});
let mapping = {};
const secretKey = '123';

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

const server = http.createServer(app);
const io = socketIO(server);

const loadDomainMappings = () => {
  fs.readFile('domains.txt', 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return;
    }
    try {
      mapping = JSON.parse(data);
      console.log('JSON domains loaded');
    } catch (error) {
      console.error(error);
    }
  });
};

setInterval(()=> {
  fs.readFile('total_requests.txt', 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return;
    }
    try {
      total_requests = data;
    } catch (error) {
      console.error(error);
    }
  });
  fs.readFile('total_blocked_requests.txt', 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return;
    }
    try {
      total_blocked_requests = data;
    } catch (error) {
      console.error(error);
    }
  });
}, 1000)

const saveDomainMappings = () => {
  fs.writeFile('domains.txt', JSON.stringify(mapping, null, 2), (err) => {
    if (err) {
      console.error('Error saving domain mapping file:', err);
    } else {
      console.log('Domain mappings saved successfully.');
    }
  });
};

const authenticateKey = (req, res, next) => {
  const key = req.query.key;
  if (!key || key !== secretKey) {
    return res.status(403).send('Authentication failed.');
  }
  res.cookie('auth_key', key, { maxAge: 900000, httpOnly: true }); // cookie test
  next();
};

const checkAuthentication = (req, res, next) => {
  const key = req.cookies.auth_key;
  if (!key || key !== secretKey) {
    return res.redirect('/');
  }
  next();
};

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/login.html');
});

app.get('/panel', checkAuthentication, (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/get-domains', checkAuthentication, (req, res) => {
  res.json(mapping);
});

loadDomainMappings();

io.on('connection', (socket) => {
  console.log('A client connected.');

  socket.on('authenticate', (key) => {
    if (key === secretKey) {
      socket.emit('authResult', 'success');
    } else {
      socket.emit('authResult', 'failed');
    }
  });

  socket.on('initialAuthentication', () => {
    socket.emit('initialDomains', mapping);
  });

  socket.on('addDomain', (data) => {
    const { host, target, rate_limit } = data;
    if (host && target && rate_limit) {
      mapping[host] = { target, rate_limit: parseInt(rate_limit) };
      saveDomainMappings();
      io.emit('domainAdded', mapping);
    }
  });

  socket.on('editDomain', (data) => {
    const { host, target, rate_limit } = data;
    if (host && target && rate_limit && mapping.hasOwnProperty(host)) {
      mapping[host] = { target, rate_limit: parseInt(rate_limit) };
      saveDomainMappings();
      io.emit('domainUpdated', mapping);
    }
  });

  socket.on('analytics', () => {
    socket.emit('x', total_requests, total_blocked_requests);
  })

  socket.on('deleteDomain', (host) => {
    if (host && mapping.hasOwnProperty(host)) {
      delete mapping[host];
      saveDomainMappings();
      io.emit('domainDeleted', host);
    }
  });

  socket.on('disconnect', () => {
    console.log('A client disconnected.');
  });
});

proxy.on('error', (err, req, res) => {
  console.error(err);
  res.writeHead(500, { 'Content-Type': 'text/plain' });
  res.end('Internal Server Error');
});

server.listen(3000, () => {
  console.log('Reverse proxy server listening on port 3000');
});
