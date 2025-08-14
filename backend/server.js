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
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
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

    // Validasi input
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Semua field harus diisi' });
    }

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

    if (!username || !password) {
      return res.status(400).json({ message: 'Username dan password harus diisi' });
    }

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

    if (!username || !email) {
      return res.status(400).json({ message: 'Username dan email harus diisi' });
    }

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

// Route untuk update poin user
app.put('/api/user/points', authenticateToken, async (req, res) => {
  try {
    const { points, gameType, isWin } = req.body;
    
    // Update poin, games_played, dan wins
    let updateQuery = 'UPDATE users SET points = points + ?, games_played = games_played + 1';
    let queryParams = [points];
    
    if (isWin) {
      updateQuery += ', wins = wins + 1';
    }
    
    updateQuery += ' WHERE id = ?';
    queryParams.push(req.user.userId);
    
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

app.get('/api/users/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.json([]);
    }

    const [users] = await db.query(
      'SELECT id, username, points FROM users WHERE username LIKE ? AND id != ? LIMIT 10',
      [`%${q}%`, req.user.userId]
    );

    res.json(users);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
});

app.post('/api/friends/add', authenticateToken, async (req, res) => {
  try {
    const { friendId } = req.body;

    if (!friendId) {
      return res.status(400).json({ message: 'Friend ID diperlukan' });
    }

    // Cek apakah user ada
    const [users] = await db.query('SELECT id FROM users WHERE id = ?', [friendId]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

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

// Variabel untuk menyimpan state game dan user online
let waitingPlayers = new Map();
let activeGames = new Map();
let onlineUsers = new Map();
let gameRequests = new Map();

// Socket.io untuk real-time game
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('userConnected', (userId) => {
    onlineUsers.set(userId, socket.id);
    socket.userId = userId;
  });

  socket.on('findGame', (data) => {
    const { gameType, userId } = data;
    
    if (gameType === 'random') {
      // Cari pemain yang menunggu
      for (let [waitingUserId, waitingSocket] of waitingPlayers) {
        if (waitingUserId !== userId) {
          // Match ditemukan
          const gameId = Date.now().toString();
          const gameState = {
            id: gameId,
            player1: waitingUserId,
            player2: userId,
            gameType: 'random',
            board: [
              ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
              ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'],
              [null, null, null, null, null, null, null, null],
              [null, null, null, null, null, null, null, null],
              [null, null, null, null, null, null, null, null],
              [null, null, null, null, null, null, null, null],
              ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'],
              ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖']
            ]
          };

          activeGames.set(gameId, gameState);
          waitingPlayers.delete(waitingUserId);

          // Kirim game state ke kedua pemain
          waitingSocket.emit('gameStarted', { ...gameState, playerColor: 'white' });
          socket.emit('gameStarted', { ...gameState, playerColor: 'black' });

          return;
        }
      }

      // Tidak ada pemain yang menunggu, tambahkan ke waiting list
      waitingPlayers.set(userId, socket);
    }
  });

  socket.on('gameRequest', (data) => {
    const { from, to, fromUsername } = data;
    const targetSocket = onlineUsers.get(to);
    
    if (targetSocket) {
      const requestId = Date.now().toString();
      gameRequests.set(requestId, { from, to, fromUsername });
      
      io.to(targetSocket).emit('gameRequest', {
        id: requestId,
        fromUsername,
        from
      });
    }
  });

  socket.on('acceptGameRequest', (requestId) => {
    const request = gameRequests.get(requestId);
    if (request) {
      const gameId = Date.now().toString();
      const gameState = {
        id: gameId,
        player1: request.from,
        player2: request.to,
        gameType: 'friend',
        board: [
          ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
          ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'],
          [null, null, null, null, null, null, null, null],
          [null, null, null, null, null, null, null, null],
          [null, null, null, null, null, null, null, null],
          [null, null, null, null, null, null, null, null],
          ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'],
          ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖']
        ]
      };

      activeGames.set(gameId, gameState);
      gameRequests.delete(requestId);

      const player1Socket = onlineUsers.get(request.from);
      const player2Socket = onlineUsers.get(request.to);

      if (player1Socket) {
        io.to(player1Socket).emit('gameStarted', { ...gameState, playerColor: 'white' });
      }
      if (player2Socket) {
        io.to(player2Socket).emit('gameStarted', { ...gameState, playerColor: 'black' });
      }
    }
  });

  socket.on('rejectGameRequest', (requestId) => {
    gameRequests.delete(requestId);
  });

  socket.on('makeMove', (data) => {
    const { gameId, move } = data;
    const game = activeGames.get(gameId);
    
    if (game) {
      // Update game state
      game.board = move.board;
      game.currentPlayer = game.currentPlayer === 'white' ? 'black' : 'white';
      
      // Kirim move ke lawan
      const player1Socket = onlineUsers.get(game.player1);
      const player2Socket = onlineUsers.get(game.player2);
      
      if (player1Socket) {
        io.to(player1Socket).emit('moveMade', {
          board: game.board,
          currentPlayer: game.currentPlayer
        });
      }
      if (player2Socket) {
        io.to(player2Socket).emit('moveMade', {
          board: game.board,
          currentPlayer: game.currentPlayer
        });
      }
    }
  });

  socket.on('userDisconnected', (userId) => {
    onlineUsers.delete(userId);
    waitingPlayers.delete(userId);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      waitingPlayers.delete(socket.userId);
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Catur Indonesia API is running' });
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'Catur Indonesia API', 
    version: '1.0.0',
    endpoints: {
      '/api/register': 'POST - Register user',
      '/api/login': 'POST - Login user',
      '/api/profile': 'GET - Get user profile',
      '/api/leaderboard': 'GET - Get leaderboard',
      '/health': 'GET - Health check'
    }
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🇮🇩 Catur Indonesia server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});