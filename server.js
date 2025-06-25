import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import getVanData from './getDataFromDataSet.js';

const PORT = 8254;
const usersPath = path.resolve('./users.json'); // File with user credentials

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const vanLife = await getVanData();

  // ========== GET Routes ==========
  if (req.url === '/api/vans' && req.method === 'GET') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(vanLife));
  }

  else if (req.url.startsWith('/api/vans/') && req.method === 'GET') {
    const vanId = req.url.split('/').pop();
    const found = vanLife.find(van => van.id === vanId);

    if (found) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(found));
    } else {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Van not found' }));
    }
  }

  else if (req.url === '/api/host/vans' && req.method === 'GET') {
    const hostVans = vanLife.filter(van => van.hostId);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(hostVans));
  }

  else if (req.url.startsWith('/api/host/vans/') && req.method === 'GET') {
    const hostVanId = req.url.split('/').pop();
    const hostVan = vanLife.find(van => van.id === hostVanId && van.hostId);

    if (hostVan) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(hostVan));
    } else {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Host van not found' }));
    }
  }

  // ========== POST /login ==========
  else if (req.method === 'POST' && req.url === '/login') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const { email, password } = JSON.parse(body);

        if (!email || !password) {
          throw new Error('Email and password are required');
        }

        fs.readFile(usersPath, 'utf8', (err, data) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Server error reading users' }));
            return;
          }

          const users = JSON.parse(data || '[]');
          const user = users.find(u => u.email === email && u.password === password);

          if (user) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Login successful', redirect: '/host' }));
          } else {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid email or password' }));
          }
        });
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }

  // ========== POST /register ==========
  else if (req.method === 'POST' && req.url === '/register') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const { email, password } = JSON.parse(body);

        if (!email || !password) {
          throw new Error('Email and password are required');
        }

        fs.readFile(usersPath, 'utf8', (err, data) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Server error reading users' }));
            return;
          }

          const users = JSON.parse(data || '[]');
          const userExists = users.some(u => u.email === email);

          if (userExists) {
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'User already exists' }));
            return;
          }

          users.push({ email, password });

          fs.writeFile(usersPath, JSON.stringify(users, null, 2), err => {
            if (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Error saving user' }));
              return;
            }

            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'User registered successfully' }));
          });
        });
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }

  // ========== Catch-All ==========
  else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Route not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
