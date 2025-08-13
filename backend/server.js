const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createServer } = require('http');
const { Server } = require('socket.io');
const db = require('./database');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "https://catur-indonesia-f.vercel.app",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'catur_indonesia_secret_key_2025';

// Middleware
app.use(cors());
app.use(express.json());

// Middleware untuk verifikasi token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token akses diperlukan' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Token tidak valid' });
    }
    req.user = user;
    next();
  });
};

// Routes Authentication
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password, role = 'user' } = req.body;

    // Cek apakah username sudah ada
    const [existingUsers] = await db.query('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'Username atau email sudah terdaftar' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user baru
    const [result] = await db.query(
      'INSERT INTO users (username, email, password, role, points, games_played, wins) VALUES (?, ?, ?, ?, 0, 0, 0)',
      [username, email, hashedPassword, role]
    );

    res.status(201).json({ message: 'Registrasi berhasil', userId: result.insertId });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Cari user
    const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length === 0) {
      return res.status(400).json({ message: 'Username atau password salah' });
    }

    const user = users[0];

    // Verifikasi password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ message: 'Username atau password salah' });
    }

    // Buat token
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Hapus password dari response
    delete user.password;

    res.json({
      message: 'Login berhasil',
      token,
      user
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
});

// Routes untuk Profile
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, username, email, role, points, games_played, wins FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
});

app.put('/api/profile', authenticateToken, async (req, res) => {
  try {
    const { username, email } = req.body;

    await db.query(
      'UPDATE users SET username = ?, email = ? WHERE id = ?',
      [username, email, req.user.userId]
    );

    // Ambil data user terbaru setelah update
    const [users] = await db.query(
      'SELECT id, username, email, role, points, games_played, wins FROM users WHERE id = ?',
      [req.user.userId]
    );

    res.json({ 
      message: 'Profil berhasil diperbarui',
      user: users[0]
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
});

// Route baru untuk update poin user
app.put('/api/user/points', authenticateToken, async (req, res) => {
  try {
    const { points, gameType, isWin } = req.body;
    
    // Update poin, games_played, dan wins
    let updateQuery = 'UPDATE users SET points = points + ?, games_played = games_played + 1';
    let queryParams = [points, req.user.userId];
    
    if (isWin) {
      updateQuery += ', wins = wins + 1';
    }
    
    updateQuery += ' WHERE id = ?';
    
    await db.query(updateQuery, queryParams);

    // Ambil data user terbaru
    const [users] = await db.query(
      'SELECT id, username, email, role, points, games_played, wins FROM users WHERE id = ?',
      [req.user.userId]
    );

    res.json({
      message: 'Poin berhasil diperbarui',
      user: users[0]
    });
  } catch (error) {
    console.error('Update points error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
});

// Routes untuk Game
app.post('/api/game/start', authenticateToken, async (req, res) => {
  try {
    const { gameType } = req.body;
    const gameId = Date.now().toString();

    // Insert game baru
    await db.query(
      'INSERT INTO games (id, player1_id, game_type, status, created_at) VALUES (?, ?, ?, "waiting", NOW())',
      [gameId, req.user.userId, gameType]
    );

    res.json({
      gameId,
      gameType,
      status: 'waiting',
      message: 'Permainan berhasil dibuat'
    });
  } catch (error) {
    console.error('Start game error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
});

app.post('/api/game/move', authenticateToken, async (req, res) => {
  try {
    const { gameId, move } = req.body;

    // Insert move ke database
    await db.query(
      'INSERT INTO game_moves (game_id, player_id, move_notation, created_at) VALUES (?, ?, ?, NOW())',
      [gameId, req.user.userId, JSON.stringify(move)]
    );

    res.json({ message: 'Move berhasil disimpan' });
  } catch (error) {
    console.error('Game move error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
});

// Route untuk menyelesaikan game
app.post('/api/game/finish', authenticateToken, async (req, res) => {
  try {
    const { gameId, winnerId, gameType } = req.body;

    // Update status game
    await db.query(
      'UPDATE games SET status = "finished", winner_id = ?, finished_at = NOW() WHERE id = ?',
      [winnerId, gameId]
    );

    res.json({ message: 'Game selesai' });
  } catch (error) {
    console.error('Finish game error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
});

// Routes untuk Friends
app.get('/api/friends', authenticateToken, async (req, res) => {
  try {
    const [friends] = await db.query(`
      SELECT u.id, u.username, u.points 
      FROM users u 
      JOIN friendships f ON (u.id = f.friend_id OR u.id = f.user_id)
      WHERE (f.user_id = ? OR f.friend_id = ?) AND u.id != ? AND f.status = 'accepted'
    `, [req.user.userId, req.user.userId, req.user.userId]);

    res.json(friends);
  } catch (error) {
    console.error('Friends error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
});

app.post('/api/friends/add', authenticateToken, async (req, res) => {
  try {
    const { friendUsername } = req.body;

    // Cari friend berdasarkan username
    const [friends] = await db.query('SELECT id FROM users WHERE username = ?', [friendUsername]);
    if (friends.length === 0) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    const friendId = friends[0].id;

    // Cek apakah sudah berteman
    const [existingFriendship] = await db.query(
      'SELECT * FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
      [req.user.userId, friendId, friendId, req.user.userId]
    );

    if (existingFriendship.length > 0) {
      return res.status(400).json({ message: 'Sudah berteman atau permintaan sudah dikirim' });
    }

    // Tambah pertemanan
    await db.query(
      'INSERT INTO friendships (user_id, friend_id, status, created_at) VALUES (?, ?, "accepted", NOW())',
      [req.user.userId, friendId]
    );

    res.json({ message: 'Teman berhasil ditambahkan' });
  } catch (error) {
    console.error('Add friend error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
});

// Routes untuk Leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const [leaderboard] = await db.query(
      'SELECT id, username, points, games_played, wins FROM users ORDER BY points DESC LIMIT 50'
    );

    res.json(leaderboard);
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
});

// Socket.io untuk real-time game
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-game', (gameId) => {
    socket.join(gameId);
    console.log(`User ${socket.id} joined game ${gameId}`);
  });

  socket.on('make-move', (data) => {
    socket.to(data.gameId).emit('opponent-move', data.move);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Catur Indonesia API is running' });
});

// Start server
server.listen(PORT, () => {
  console.log(`🇮🇩 Catur Indonesia server running on port ${PORT}`);
});