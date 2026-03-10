import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import webpush from 'web-push';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database('movate.db');

try {
  db.prepare('ALTER TABLE drivers ADD COLUMN photo TEXT').run();
} catch (e) {}

try {
  db.prepare('ALTER TABLE rides ADD COLUMN settled INTEGER DEFAULT 0').run();
} catch (e) {}

// VAPID Keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || 'BJOzr0pI9wfDB1qAGofmejVn3uZJerEOKlpvy096xPIToYa1PupbfUorgX7d6oARc_exoO7xnHECcrMop87oHj4';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || 'BWhcHLRyQxipwD6VmS0D3eYODoKg3H1OBXan028S4OA';
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:movatemassinga@gmail.com';

webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS drivers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    access_key TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('Moto', 'Txopela', 'Taxi')),
    status TEXT DEFAULT 'offline',
    photo TEXT
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
    client_rating INTEGER,
    client_comment TEXT,
    driver_rating INTEGER,
    driver_comment TEXT,
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

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    driver_id INTEGER NOT NULL,
    subscription TEXT NOT NULL,
    UNIQUE(driver_id, subscription)
  );
`);

// Migration: Add client_phone if it doesn't exist
try {
  db.prepare('ALTER TABLE rides ADD COLUMN client_phone TEXT').run();
} catch (e) {}

try {
  db.prepare('ALTER TABLE rides ADD COLUMN client_rating INTEGER').run();
} catch (e) {}
try {
  db.prepare('ALTER TABLE rides ADD COLUMN client_comment TEXT').run();
} catch (e) {}
try {
  db.prepare('ALTER TABLE rides ADD COLUMN driver_rating INTEGER').run();
} catch (e) {}
try {
  db.prepare('ALTER TABLE rides ADD COLUMN driver_comment TEXT').run();
} catch (e) {}

try {
  db.prepare('ALTER TABLE offers ADD COLUMN counter_price REAL').run();
} catch (e) {}

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
    if (!phone || !access_key) {
      return res.status(400).json({ success: false, message: 'Telefone e chave são obrigatórios' });
    }
    const trimmedPhone = phone.trim();
    const trimmedKey = access_key.trim();
    const driver = db.prepare('SELECT * FROM drivers WHERE phone = ? AND access_key = ?').get(trimmedPhone, trimmedKey);
    if (driver) {
      res.json({ success: true, driver });
    } else {
      res.status(401).json({ success: false, message: 'CREDENCIAIS INVÁLIDAS' });
    }
  });

  // Admin: Register Driver
  app.post('/api/admin/drivers', (req, res) => {
    const { name, phone, access_key, category } = req.body;
    if (!name || !phone || !access_key || !category) {
      return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios' });
    }
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedKey = access_key.trim();
    try {
      const info = db.prepare('INSERT INTO drivers (name, phone, access_key, category) VALUES (?, ?, ?, ?)').run(trimmedName, trimmedPhone, trimmedKey, category);
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

  app.get('/api/admin/comments', (req, res) => {
    const comments = db.prepare(`
      SELECT r.id, r.client_name, r.client_rating, r.client_comment, r.created_at, d.name as driver_name
      FROM rides r
      JOIN drivers d ON r.driver_id = d.id
      WHERE r.client_comment IS NOT NULL OR r.client_rating IS NOT NULL
      ORDER BY r.created_at DESC
    `).all();
    res.json(comments);
  });

  app.post('/api/admin/reset-earnings', (req, res) => {
    db.prepare("UPDATE rides SET settled = 1 WHERE status = 'finished' AND settled = 0").run();
    res.json({ success: true });
  });

  app.delete('/api/admin/drivers/:id', (req, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM push_subscriptions WHERE driver_id = ?').run(id);
    db.prepare('DELETE FROM offers WHERE driver_id = ?').run(id);
    db.prepare('UPDATE rides SET driver_id = NULL, status = "danger" WHERE driver_id = ? AND status != "finished"').run(id);
    db.prepare('DELETE FROM drivers WHERE id = ?').run(id);
    res.json({ success: true });
  });

  app.delete('/api/admin/rides/:id', (req, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM messages WHERE ride_id = ?').run(id);
    db.prepare('DELETE FROM offers WHERE ride_id = ?').run(id);
    db.prepare('DELETE FROM rides WHERE id = ?').run(id);
    res.json({ success: true });
  });

  app.delete('/api/admin/rides', (req, res) => {
    db.prepare('DELETE FROM messages').run();
    db.prepare('DELETE FROM offers').run();
    db.prepare('DELETE FROM rides').run();
    res.json({ success: true });
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

  app.post('/api/push/subscribe', (req, res) => {
    const { driver_id, subscription } = req.body;
    try {
      db.prepare('INSERT OR IGNORE INTO push_subscriptions (driver_id, subscription) VALUES (?, ?)').run(driver_id, JSON.stringify(subscription));
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ success: false });
    }
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

  app.post('/api/driver/photo', (req, res) => {
    const { driver_id, photo } = req.body;
    db.prepare('UPDATE drivers SET photo = ? WHERE id = ?').run(photo, driver_id);
    res.json({ success: true });
  });

  app.get('/api/driver/offers/:driverId', (req, res) => {
    const offers = db.prepare(`
      SELECT o.*, d.name as driver_name, d.category as driver_category,
             (SELECT AVG(driver_rating) FROM rides WHERE driver_id = d.id AND driver_rating IS NOT NULL) as avg_rating
      FROM offers o
      JOIN drivers d ON o.driver_id = d.id
      WHERE o.driver_id = ?
    `).all(req.params.driverId);
    res.json(offers);
  });

  app.get('/api/driver/rides/:driverId', (req, res) => {
    const rides = db.prepare(`
      SELECT r.*, d.name as driver_name,
             (SELECT AVG(client_rating) FROM rides WHERE client_phone = r.client_phone AND client_rating IS NOT NULL) as client_avg_rating
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
      
      // Get client's average rating
      const clientStats = db.prepare(`
        SELECT AVG(client_rating) as avg_rating 
        FROM rides 
        WHERE client_phone = ? AND client_rating IS NOT NULL
      `).get(client_phone);

      const ride = { 
        id: info.lastInsertRowid, 
        ...rideData, 
        client_phone: undefined, // Hide phone from drivers
        client_avg_rating: clientStats?.avg_rating || null,
        status: 'pending' 
      };
      
      io.emit('new_ride_request', ride);
      socket.emit('ride_created', { ...ride, client_phone }); // Client sees their own phone

      // Send Push Notifications to drivers of this category
      const subscriptions = db.prepare(`
        SELECT ps.subscription 
        FROM push_subscriptions ps
        JOIN drivers d ON ps.driver_id = d.id
        WHERE d.category = ?
      `).all(category);

      const payload = JSON.stringify({
        title: 'Nova Solicitação!',
        body: `${client_name} precisa de um ${category} de ${pickup} para ${destination}.`,
        url: '/'
      });

      subscriptions.forEach(sub => {
        try {
          webpush.sendNotification(JSON.parse(sub.subscription), payload);
        } catch (err) {
          console.error('Error sending push notification:', err);
        }
      });
    });

    socket.on('driver_offer', (data) => {
      const { ride_id, driver_id, price } = data;
      // Check if offer already exists
      const existing = db.prepare('SELECT id FROM offers WHERE ride_id = ? AND driver_id = ?').get(ride_id, driver_id);
      if (existing) {
        db.prepare('UPDATE offers SET price = ?, counter_price = NULL WHERE id = ?').run(price, existing.id);
      } else {
        db.prepare('INSERT INTO offers (ride_id, driver_id, price) VALUES (?, ?, ?)').run(ride_id, driver_id, price);
      }
      
      const offer = db.prepare(`
        SELECT o.*, d.name as driver_name, d.category as driver_category, d.photo as driver_photo,
               (SELECT AVG(driver_rating) FROM rides WHERE driver_id = d.id AND driver_rating IS NOT NULL) as avg_rating
        FROM offers o
        JOIN drivers d ON o.driver_id = d.id
        WHERE o.ride_id = ? AND o.driver_id = ?
      `).get(ride_id, driver_id);
      io.emit('new_offer', offer);
    });

    socket.on('client_counter', (data) => {
      const { offer_id, counter_price } = data;
      db.prepare('UPDATE offers SET counter_price = ? WHERE id = ?').run(counter_price, offer_id);
      const offer = db.prepare(`
        SELECT o.*, d.name as driver_name, d.category as driver_category, d.photo as driver_photo,
               (SELECT AVG(driver_rating) FROM rides WHERE driver_id = d.id AND driver_rating IS NOT NULL) as avg_rating
        FROM offers o
        JOIN drivers d ON o.driver_id = d.id
        WHERE o.id = ?
      `).get(offer_id);
      io.emit('offer_updated', offer);
    });

    socket.on('driver_update_offer', (data) => {
      const { offer_id, price, accept_counter } = data;
      if (accept_counter) {
        db.prepare('UPDATE offers SET price = counter_price, counter_price = NULL WHERE id = ?').run(offer_id);
      } else {
        db.prepare('UPDATE offers SET price = ?, counter_price = NULL WHERE id = ?').run(price, offer_id);
      }
      const offer = db.prepare(`
        SELECT o.*, d.name as driver_name, d.category as driver_category, d.photo as driver_photo,
               (SELECT AVG(driver_rating) FROM rides WHERE driver_id = d.id AND driver_rating IS NOT NULL) as avg_rating
        FROM offers o
        JOIN drivers d ON o.driver_id = d.id
        WHERE o.id = ?
      `).get(offer_id);
      io.emit('offer_updated', offer);
    });

    socket.on('client_accept', (data) => {
      const { ride_id, offer_id } = data;
      const offer = db.prepare('SELECT * FROM offers WHERE id = ?').get(offer_id);
      const final_price = offer.price;
      const admin_fee = final_price * 0.10;
      db.prepare("UPDATE rides SET status = 'accepted', driver_id = ?, final_price = ?, admin_fee = ? WHERE id = ?").run(offer.driver_id, final_price, admin_fee, ride_id);
      
      const updatedRide = db.prepare(`
        SELECT r.*, d.name as driver_name,
               (SELECT AVG(client_rating) FROM rides WHERE client_phone = r.client_phone AND client_rating IS NOT NULL) as client_avg_rating
        FROM rides r 
        JOIN drivers d ON r.driver_id = d.id 
        WHERE r.id = ?
      `).get(ride_id);
      
      // We don't send driver_phone to the client anymore for privacy
      io.emit('ride_accepted', updatedRide);
    });

    socket.on('finish_ride', (data) => {
      const { ride_id } = data;
      db.prepare("UPDATE rides SET status = 'finished' WHERE id = ?").run(ride_id);
      io.emit('ride_finished', { ride_id });
    });

    socket.on('submit_feedback', (data) => {
      const { ride_id, role, rating, comment } = data;
      if (role === 'client') {
        db.prepare("UPDATE rides SET client_rating = ?, client_comment = ? WHERE id = ?").run(rating, comment, ride_id);
      } else {
        db.prepare("UPDATE rides SET driver_rating = ?, driver_comment = ? WHERE id = ?").run(rating, comment, ride_id);
      }
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
