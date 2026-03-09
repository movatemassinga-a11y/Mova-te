import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database('movate.db');

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS drivers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    access_key TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('Moto', 'Txopela', 'Taxi')),
    status TEXT DEFAULT 'offline'
  );

  CREATE TABLE IF NOT EXISTS rides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_name TEXT NOT NULL,
    client_phone TEXT,
    pickup TEXT NOT NULL,
    destination TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, accepted, finished, danger
    driver_id INTEGER,
    final_price REAL,
    admin_fee REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(driver_id) REFERENCES drivers(id)
  );

  CREATE TABLE IF NOT EXISTS offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ride_id INTEGER NOT NULL,
    driver_id INTEGER NOT NULL,
    price REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(ride_id) REFERENCES rides(id),
    FOREIGN KEY(driver_id) REFERENCES drivers(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ride_id INTEGER NOT NULL,
    sender_role TEXT NOT NULL, -- 'client', 'driver'
    text TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(ride_id) REFERENCES rides(id)
  );
`);

// Migration: Add client_phone if it doesn't exist
try {
  db.prepare('ALTER TABLE rides ADD COLUMN client_phone TEXT').run();
} catch (e) {
  // Column already exists or other error
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  app.use(express.json());

  // Admin Login
  app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'Shadowalker' && password === '245599movate') {
      res.json({ success: true, role: 'admin' });
    } else {
      res.status(401).json({ success: false, message: 'Credenciais inválidas' });
    }
  });

  // Driver Login
  app.post('/api/driver/login', (req, res) => {
    const { phone, access_key } = req.body;
    const driver = db.prepare('SELECT * FROM drivers WHERE phone = ? AND access_key = ?').get(phone, access_key);
    if (driver) {
      res.json({ success: true, driver });
    } else {
      res.status(401).json({ success: false, message: 'Credenciais inválidas' });
    }
  });

  // Admin: Register Driver
  app.post('/api/admin/drivers', (req, res) => {
    const { name, phone, access_key, category } = req.body;
    try {
      const info = db.prepare('INSERT INTO drivers (name, phone, access_key, category) VALUES (?, ?, ?, ?)').run(name, phone, access_key, category);
      res.json({ success: true, id: info.lastInsertRowid });
    } catch (err) {
      res.status(400).json({ success: false, message: 'Erro ao registrar motorista (telefone já existe?)' });
    }
  });

  app.get('/api/admin/drivers', (req, res) => {
    const drivers = db.prepare(`
      SELECT d.*, 
             (SELECT SUM(admin_fee) FROM rides WHERE driver_id = d.id AND status = 'finished') as total_commission,
             (SELECT COUNT(*) FROM rides WHERE driver_id = d.id AND status = 'finished') as total_rides
      FROM drivers d
    `).all();
    res.json(drivers);
  });

  app.get('/api/admin/driver-rides/:driverId', (req, res) => {
    const rides = db.prepare(`
      SELECT r.*, d.name as driver_name 
      FROM rides r 
      JOIN drivers d ON r.driver_id = d.id
      WHERE r.driver_id = ?
      ORDER BY r.created_at DESC
    `).all(req.params.driverId);
    res.json(rides);
  });

  app.get('/api/admin/rides', (req, res) => {
    const rides = db.prepare(`
      SELECT r.*, d.name as driver_name 
      FROM rides r 
      LEFT JOIN drivers d ON r.driver_id = d.id
      ORDER BY r.created_at DESC
    `).all();
    res.json(rides);
  });

  app.get('/api/admin/messages/:rideId', (req, res) => {
    const messages = db.prepare('SELECT * FROM messages WHERE ride_id = ? ORDER BY timestamp ASC').all(req.params.rideId);
    res.json(messages);
  });

  app.get('/api/admin/offers/:rideId', (req, res) => {
    const offers = db.prepare(`
      SELECT o.*, d.name as driver_name, d.category as driver_category
      FROM offers o
      JOIN drivers d ON o.driver_id = d.id
      WHERE o.ride_id = ?
      ORDER BY o.created_at DESC
    `).all(req.params.rideId);
    res.json(offers);
  });

  app.get('/api/client/rides/:clientName', (req, res) => {
    const rides = db.prepare(`
      SELECT r.*, d.name as driver_name 
      FROM rides r 
      LEFT JOIN drivers d ON r.driver_id = d.id
      WHERE r.client_name = ?
      ORDER BY r.created_at DESC
    `).all(req.params.clientName);
    res.json(rides);
  });

  app.get('/api/driver/rides/:driverId', (req, res) => {
    const rides = db.prepare(`
      SELECT r.*, d.name as driver_name 
      FROM rides r 
      LEFT JOIN drivers d ON r.driver_id = d.id
      WHERE r.driver_id = ? OR (r.status = 'pending' AND r.category = (SELECT category FROM drivers WHERE id = ?))
      ORDER BY r.created_at DESC
    `).all(req.params.driverId, req.params.driverId);
    res.json(rides);
  });

  // WebSocket Logic
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_ride', ({ ride_id }) => {
      socket.join(`ride_${ride_id}`);
      console.log(`Socket ${socket.id} joined ride_${ride_id}`);
    });

    socket.on('request_ride', (rideData) => {
      const { client_name, client_phone, pickup, destination, category } = rideData;
      const info = db.prepare('INSERT INTO rides (client_name, client_phone, pickup, destination, category) VALUES (?, ?, ?, ?, ?)').run(client_name, client_phone, pickup, destination, category);
      const ride = { id: info.lastInsertRowid, ...rideData, status: 'pending' };
      io.emit('new_ride_request', ride);
      socket.emit('ride_created', ride);
    });

    socket.on('driver_offer', (data) => {
      const { ride_id, driver_id, price } = data;
      db.prepare('INSERT INTO offers (ride_id, driver_id, price) VALUES (?, ?, ?)').run(ride_id, driver_id, price);
      const offer = db.prepare(`
        SELECT o.*, d.name as driver_name, d.category as driver_category
        FROM offers o
        JOIN drivers d ON o.driver_id = d.id
        WHERE o.id = (SELECT last_insert_rowid())
      `).get();
      io.emit('new_offer', offer);
    });

    socket.on('client_accept', (data) => {
      const { ride_id, offer_id } = data;
      const offer = db.prepare('SELECT * FROM offers WHERE id = ?').get(offer_id);
      const final_price = offer.price;
      const admin_fee = final_price * 0.10;
      db.prepare("UPDATE rides SET status = 'accepted', driver_id = ?, final_price = ?, admin_fee = ? WHERE id = ?").run(offer.driver_id, final_price, admin_fee, ride_id);
      const updatedRide = db.prepare(`
        SELECT r.*, d.name as driver_name, d.phone as driver_phone
        FROM rides r 
        JOIN drivers d ON r.driver_id = d.id 
        WHERE r.id = ?
      `).get(ride_id);
      io.emit('ride_accepted', updatedRide);
    });

    socket.on('finish_ride', (data) => {
      const { ride_id } = data;
      db.prepare("UPDATE rides SET status = 'finished' WHERE id = ?").run(ride_id);
      io.emit('ride_finished', { ride_id });
    });

    socket.on('cancel_ride', (data) => {
      const { ride_id } = data;
      db.prepare("UPDATE rides SET status = 'canceled' WHERE id = ?").run(ride_id);
      io.emit('ride_canceled', { ride_id });
    });

    socket.on('report_danger', (data) => {
      const { ride_id, driver_id } = data;
      db.prepare("UPDATE rides SET status = 'danger' WHERE id = ?").run(ride_id);
      io.emit('admin_danger_alert', { ride_id, driver_id });
    });

    socket.on('send_message', (data) => {
      const { ride_id, sender_role, text } = data;
      const info = db.prepare('INSERT INTO messages (ride_id, sender_role, text) VALUES (?, ?, ?)').run(ride_id, sender_role, text);
      const messageId = info.lastInsertRowid;
      io.to(`ride_${ride_id}`).emit('new_message', { 
        id: messageId,
        ride_id, 
        sender_role, 
        text, 
        timestamp: new Date().toISOString() 
      });
    });

    socket.on('disconnect', () => {
      console.log('User disconnected');
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
