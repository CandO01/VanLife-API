import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

import http from 'node:http';
import getVanData from './getDataFromDataSet.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';


const PORT = process.env.PORT || 8254;
const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY

const MONGODB_URI = process.env.MONGODB_URI;

if(!MONGODB_URI){
  console.error('❌ MONGODB_URI is not defined in .env file');
  process.exit(1);
}

const client = new MongoClient(MONGODB_URI)
let usersCollection;

client.connect()
    .then(()=>{
      console.log('✅ Connected to MongoDB')
      const db = client.db('solar_drive');
      usersCollection = db.collection('users')
    })
    .catch(err=>{
      console.error('❌ Failed to connect to MongoDB', err);
      process.exit(1);
    })

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type'
    })
    res.end()
    return
  }

  const vanLife = await getVanData();

  // ========== GET Routes ==========
  // GET /api/vans
  if (req.url === '/api/vans' && req.method === 'GET') {
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(vanLife));
  }

  // GET /api/vans/:id
  else if (req.url.startsWith('/api/vans/') && req.method === 'GET') {
    const vanId = req.url.split('/').pop();
    const found = vanLife.find(van => van.id === vanId);

    if (found) {
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(found));
    } else {
      res.statusCode = 404
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Van not found' }));
    }
  }

  // GET /api/host/vans
  else if (req.url === '/api/host/vans' && req.method === 'GET') {
    const hostVans = vanLife.filter(van => van.hostId);
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(hostVans));
  }

  // GET /api/host/vans/:id
  else if (req.url.startsWith('/api/host/vans/') && req.method === 'GET') {
    const hostVanId = req.url.split('/').pop();
    const hostVan = vanLife.find(van => van.id === hostVanId && van.hostId);

    if (hostVan) {
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(hostVan));
    } else {
      res.statusCode = 404
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Host van not found' }));
    }
  }

  // ===Payment using flutterwave======
else if (req.url.startsWith('/api/flutterwave/init') && req.method === 'POST') {
  let body = '';
  req.on('data', chunk => body += chunk.toString());
  req.on('end', async () => {
    try {
      const { email, vanId } = JSON.parse(body);

     console.log("Incoming vanId:", vanId);
      const vanLife = await getVanData();
      console.log("Available vans:", vanLife.map(v => v.id));

      const van = vanLife.find(v => String(v.id) === String(vanId));

      if (!van) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Van not found' }));
        return;
      }

      // 2️⃣ Get price from server
      const amount = van.price; // assuming dataset has 'price' field

      // 3️⃣ Generate unique transaction ref
      const tx_ref = crypto.randomBytes(8).toString('hex');

      // 4️⃣ Initialize payment
      const response = await fetch('https://api.flutterwave.com/v3/payments', {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          tx_ref,
          amount,
          currency: 'USD',
          customer: { email },
          payment_type: 'card',
          redirect_url: 'https://bus-life.netlify.app/payment-success',
        })
      });

      const data = await response.json();
      console.log(data)

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        message: 'Payment initialized successfully',
        paymentUrl: data.data.link,
        tx_ref: data.data.tx_ref
      }));
      return;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to initialize payment' }));
    }
  });
}

// =======GET request for payment verification ======//
else if (req.url.startsWith('/api/flutterwave/verify/') && req.method === 'GET') {
  const transactionId = req.url.split('/').pop();
  try {
    const response = await fetch(`https://api.flutterwave.com/v3/transactions/${transactionId}/verify`, {
      headers: { 
        "Authorization": `Bearer ${FLUTTERWAVE_SECRET_KEY}`
      }
    });
    const data = await response.json();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Verification failed' }));
  }
}


  // ========== POST Route: /Register ==========
   else if(req.url === '/signup' && req.method === 'POST'){
      let body ='';
      req.on('data', chunk => body +=chunk.toString());
      req.on('end', async()=>{
        try {
          const { name, phone, email, password, confirm } = JSON.parse(body);

          if(!name || !phone || !email || !password || !confirm){
            throw new Error('All fields are required')
          }

          if(password !== confirm){
             res.writeHead(400, { 'Content-Type': 'application/json' });
             res.end(JSON.stringify({ message: 'Password do not match!' }));
             return;
          }

          const existingUsers = await usersCollection.findOne({ email });
          if(existingUsers){
            res.writeHead(409, {'Content-Type':'application/json'});
            res.end(JSON.stringify({ message: 'User already exist' }));
            return;
          }

          const passwordHashed = await bcrypt.hash(password, 10)
          await usersCollection.insertOne({ name, phone, email, password: passwordHashed });

          res.writeHead(200, {'Content-Type':'application/json'});
          res.end(JSON.stringify({ 
            message: 'Thank you for signing up successfully!!!',
            user: name,
            email: email,
            phone: phone 
          }));

        } catch (error) {
          res.writeHead(500, {'Content-Type':'application/json'});
          res.end(JSON.stringify({ error: error.message }));
        }
      });
   }

  //  =======POST: Route Login ======//

   else if(req.url === '/login' && req.method === 'POST'){
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', async()=>{
        try {
          const { email, password } = JSON.parse(body);

          if(!email || !password){
              throw new Error('Email and Password required')
          }

          const user = await usersCollection.findOne({ email });
          if(!user){
           res.writeHead(401, {'Content-Type':'application/json'});
           res.end(JSON.stringify({ message: 'Invalid email or password' }))
          }

          const isMatch = await bcrypt.compare(password, user.password)
          if(!isMatch){
            res.writeHead(401, {' Content-Type':'application/json'});
            res.end(JSON.stringify({ message: 'Invalid email or password' }));
          }

          res.writeHead(200, {'Content-Type':'application/json'});
          res.end(JSON.stringify({ 
            message: 'Login successfully!!!',
            user: user.name
          }));
        } catch (error) {
          res.writeHead(500, {'Content-Type':'application/json'});
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

// else if (req.method === 'POST' && req.url === '/login') {
  //   let body = '';

  //   req.on('data', chunk => {
  //     body += chunk.toString();
  //   });

  //   req.on('end', () => {
  //     try {
  //       const { email, password } = JSON.parse(body);

  //       if (!email || !password) {
  //         throw new Error('Email and password are required');
  //       }

  //       fs.readFile(usersPath, 'utf8', (err, data) => {
  //         if (err) {
  //           res.writeHead(500, { 'Content-Type': 'application/json' });
  //           res.end(JSON.stringify({ error: 'Server error reading users' }));
  //           return;
  //         }

  //         const users = JSON.parse(data);
  //         const user = users.find(u => u.email === email && u.password === password);

  //         if (user) {
  //           res.writeHead(200, { 'Content-Type': 'application/json' });
  //           res.end(JSON.stringify({ message: 'Login successful', redirect: '/host' }));
  //         } else {
  //           res.writeHead(401, { 'Content-Type': 'application/json' });
  //           res.end(JSON.stringify({ error: 'Invalid email or password' }));
  //         }
  //       });
  //     } catch (err) {
  //       res.writeHead(400, { 'Content-Type': 'application/json' });
  //       res.end(JSON.stringify({ error: err.message }));
  //     }
  //   });
  // }
