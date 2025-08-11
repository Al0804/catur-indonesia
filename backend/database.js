const mysql = require('mysql2/promise');

// Konfigurasi database
const dbConfig = {
  host: process.env.DB_HOST || 'localhost1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'catur_indonesia',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Buat connection pool
const pool = mysql.createPool(dbConfig);

// Fungsi untuk inisialisasi database dan tabel
async function initializeDatabase() {
  try {
    // Buat database jika belum ada
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password
    });

    await connection.execute(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
    await connection.end();

    console.log('✅ Database berhasil dibuat/tersedia');

    // Buat tabel-tabel yang diperlukan
    await createTables();
    
    console.log('✅ Semua tabel berhasil dibuat');
  } catch (error) {
    console.error('❌ Error inisialisasi database:', error);
  }
}

async function createTables() {
  // Tabel users
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role ENUM('user', 'admin') DEFAULT 'user',
      points INT DEFAULT 0,
      games_played INT DEFAULT 0,
      wins INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Tabel games
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS games (
      id VARCHAR(50) PRIMARY KEY,
      player1_id INT NOT NULL,
      player2_id INT NULL,
      game_type ENUM('random', 'friend', 'bot') NOT NULL,
      status ENUM('waiting', 'playing', 'finished') DEFAULT 'waiting',
      winner_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      finished_at TIMESTAMP NULL,
      FOREIGN KEY (player1_id) REFERENCES users(id),
      FOREIGN KEY (player2_id) REFERENCES users(id),
      FOREIGN KEY (winner_id) REFERENCES users(id)
    )
  `);

  // Tabel game_moves
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS game_moves (
      id INT AUTO_INCREMENT PRIMARY KEY,
      game_id VARCHAR(50) NOT NULL,
      player_id INT NOT NULL,
      move_notation TEXT NOT NULL,
      move_number INT NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (game_id) REFERENCES games(id),
      FOREIGN KEY (player_id) REFERENCES users(id)
    )
  `);

  // Tabel friendships
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS friendships (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      friend_id INT NOT NULL,
      status ENUM('pending', 'accepted', 'blocked') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (friend_id) REFERENCES users(id),
      UNIQUE KEY unique_friendship (user_id, friend_id)
    )
  `);

  // Insert admin user default jika belum ada
  try {
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    await pool.execute(`
      INSERT IGNORE INTO users (username, email, password, role, points, games_played, wins) 
      VALUES ('admin', 'admin@caturindonesia.com', ?, 'admin', 9999, 100, 85)
    `, [hashedPassword]);

    // Insert beberapa user dummy untuk testing
    const dummyUsers = [
      ['player1', 'player1@test.com', await bcrypt.hash('player123', 10), 'user', 1500, 45, 30],
      ['player2', 'player2@test.com', await bcrypt.hash('player123', 10), 'user', 1200, 35, 20],
      ['player3', 'player3@test.com', await bcrypt.hash('player123', 10), 'user', 1800, 60, 42],
      ['grandmaster', 'gm@test.com', await bcrypt.hash('gm123', 10), 'user', 2500, 120, 95]
    ];

    for (const user of dummyUsers) {
      await pool.execute(`
        INSERT IGNORE INTO users (username, email, password, role, points, games_played, wins) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, user);
    }

    console.log('✅ User default berhasil dibuat');
  } catch (error) {
    console.error('Error membuat user default:', error);
  }
}

// Panggil inisialisasi database saat module dimuat
initializeDatabase();

module.exports = pool;