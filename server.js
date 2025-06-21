import http from 'node:http';
import getVanData from './getDataFromDataSet.js';

const PORT = 8254;

const server = http.createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const vanLife = await getVanData();

  // Route: GET /api/vans
  if (req.url === '/api/vans' && req.method === 'GET') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(vanLife));
  }

  //Route: GET /api/host/vans
  else if(req.url ==='/api/host/vans' && req.method==='GET'){
        const hostVans = vanLife.filter(van=>van.hostId)
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(hostVans))
  }

  // Route: GET /api/vans/:id
  else if (req.url.startsWith('/api/vans/') && req.method === 'GET') {
    const vanId = req.url.split('/').pop();
    const filteredData = vanLife.filter(van => van.id === vanId);

    if (filteredData) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(filteredData)); // Send only the matched van
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Van not found' }));
    }
  }
  //Route: GET /api/host/vans/:id
  else if(req.url.startsWith('/api/host/vans') && req.method==='GET'){
      const hostVanId = req.url.split('').pop()
      const hostVans = vanLife.filter(van=>van.id === hostVanId && van.hostId)
      if(hostVans){
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(hostVans))
      }
      else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'VanId not found' }));
    }
  }

  // If route not matched
  else {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Route not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`This is from server: ${PORT}`);
});
