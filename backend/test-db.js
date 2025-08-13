const pool = require('./database');

(async () => {
  try {
    const [rows] = await pool.execute('SELECT id, username, email FROM users LIMIT 5');
    console.log('✅ Koneksi berhasil!');
    console.log('📌 Data user:', rows);
  } catch (err) {
    console.error('❌ Gagal konek ke database:', err.message);
  } finally {
    process.exit();
  }
})();
