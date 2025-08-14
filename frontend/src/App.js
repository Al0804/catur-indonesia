import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import ChessBoard from './components/ChessBoard';
import './App.css';

// Use production URL for InfinityFree
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const socket = io(API_URL, {
  transports: ['websocket', 'polling']
});

function App() {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('login');
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [registerData, setRegisterData] = useState({ username: '', email: '', password: '', role: 'user' });
  const [gameState, setGameState] = useState(null);
  const [friends, setFriends] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);
  const [profile, setProfile] = useState({ username: '', email: '', points: 0 });
  const [currentPlayer, setCurrentPlayer] = useState('white');
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [gameRequests, setGameRequests] = useState([]);
  const [gameResult, setGameResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchUserProfile();
    }

    // Socket listeners
    socket.on('gameRequest', (request) => {
      setGameRequests(prev => [...prev, request]);
    });

    socket.on('gameStarted', (game) => {
      setGameState(game);
      setCurrentPage('game');
      setCurrentPlayer('white');
      setIsPlayerTurn(game.playerColor === 'white');
      setGameResult(null);
    });

    socket.on('moveMade', (moveData) => {
      setGameState(prev => ({
        ...prev,
        board: moveData.board,
        currentPlayer: moveData.currentPlayer
      }));
      setCurrentPlayer(moveData.currentPlayer);
      setIsPlayerTurn(moveData.currentPlayer === gameState?.playerColor);
    });

    return () => {
      socket.off('gameRequest');
      socket.off('gameStarted');
      socket.off('moveMade');
    };
  }, [gameState?.playerColor]);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
      setProfile(response.data);
      setCurrentPage('dashboard');
      setError('');
    } catch (error) {
      console.error('Error fetching profile:', error);
      setError('Gagal memuat profil');
      localStorage.removeItem('token');
      setCurrentPage('login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      const response = await axios.get(`${API_URL}/health`);
      console.log('Server status:', response.data);
      
      const loginResponse = await axios.post(`${API_URL}/api/login`, loginData);
      localStorage.setItem('token', loginResponse.data.token);
      setUser(loginResponse.data.user);
      socket.emit('userConnected', loginResponse.data.user.id);
      setCurrentPage('dashboard');
    } catch (error) {
      console.error('Login error:', error);
      setError(error.response?.data?.message || 'Login gagal. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      await axios.post(`${API_URL}/api/register`, registerData);
      alert('Registrasi berhasil! Silakan login.');
      setCurrentPage('login');
      setRegisterData({ username: '', email: '', password: '', role: 'user' });
    } catch (error) {
      console.error('Register error:', error);
      setError(error.response?.data?.message || 'Registrasi gagal. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  // [Rest of the functions remain the same as in your original code]
  // ... (keeping all the game logic, bot AI, checkmate detection, etc.)

  // Fungsi untuk mengecek skakmat
  const isCheckmate = (board, playerColor) => {
    const kingPiece = playerColor === 'white' ? '♔' : '♚';
    let kingPosition = null;

    // Cari posisi raja
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (board[row][col] === kingPiece) {
          kingPosition = [row, col];
          break;
        }
      }
      if (kingPosition) break;
    }

    if (!kingPosition) return true; // Raja sudah tidak ada

    // Cek apakah raja dalam skak
    const isInCheck = isKingInCheck(board, kingPosition, playerColor);
    
    if (!isInCheck) return false; // Bukan skakmat jika raja tidak dalam skak

    // Cek apakah ada gerakan yang bisa menyelamatkan raja
    const pieces = playerColor === 'white' ? ['♙', '♖', '♘', '♗', '♕', '♔'] : ['♟', '♜', '♞', '♝', '♛', '♚'];
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (pieces.includes(piece)) {
          const possibleMoves = getPossibleMovesForPiece(board, row, col, piece);
          for (const move of possibleMoves) {
            // Simulasikan gerakan
            const newBoard = board.map(r => [...r]);
            newBoard[move[0]][move[1]] = newBoard[row][col];
            newBoard[row][col] = null;
            
            // Cari posisi raja setelah gerakan
            let newKingPosition = kingPosition;
            if (piece === kingPiece) {
              newKingPosition = move;
            }
            
            // Cek apakah raja masih dalam skak setelah gerakan
            if (!isKingInCheck(newBoard, newKingPosition, playerColor)) {
              return false; // Ada gerakan yang bisa menyelamatkan
            }
          }
        }
      }
    }
    
    return true; // Skakmat
  };

  // Fungsi untuk mengecek apakah raja dalam skak
  const isKingInCheck = (board, kingPosition, playerColor) => {
    const opponentColor = playerColor === 'white' ? 'black' : 'white';
    const opponentPieces = opponentColor === 'white' ? ['♙', '♖', '♘', '♗', '♕', '♔'] : ['♟', '♜', '♞', '♝', '♛', '♚'];
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (opponentPieces.includes(piece)) {
          if (isValidMoveForBot(board, row, col, kingPosition[0], kingPosition[1], piece)) {
            return true;
          }
        }
      }
    }
    return false;
  };

  // Bot AI logic (diperbaiki)
  const makeBotMove = (board, currentPlayerColor) => {
    const botColor = currentPlayerColor === 'white' ? 'white' : 'black';
    const possibleMoves = getAllPossibleMoves(board, botColor);
    
    if (possibleMoves.length === 0) return null;
    
    // AI sederhana: prioritaskan memakan buah lawan
    const captureMoves = possibleMoves.filter(move => board[move.to[0]][move.to[1]] !== null);
    const selectedMoves = captureMoves.length > 0 ? captureMoves : possibleMoves;
    
    const randomMove = selectedMoves[Math.floor(Math.random() * selectedMoves.length)];
    return randomMove;
  };

  const getAllPossibleMoves = (board, color) => {
    const moves = [];
    const pieces = color === 'white' ? ['♙', '♖', '♘', '♗', '♕', '♔'] : ['♟', '♜', '♞', '♝', '♛', '♚'];
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (pieces.includes(piece)) {
          const pieceMoves = getPossibleMovesForPiece(board, row, col, piece);
          moves.push(...pieceMoves.map(move => ({
            from: [row, col],
            to: move,
            piece
          })));
        }
      }
    }
    return moves;
  };

  const getPossibleMovesForPiece = (board, row, col, piece) => {
    const moves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (isValidMoveForBot(board, row, col, r, c, piece)) {
          moves.push([r, c]);
        }
      }
    }
    return moves;
  };

  const getPieceColor = (piece) => {
    const whitePieces = ['♙', '♖', '♘', '♗', '♕', '♔'];
    const blackPieces = ['♟', '♜', '♞', '♝', '♛', '♚'];
    
    if (whitePieces.includes(piece)) return 'white';
    if (blackPieces.includes(piece)) return 'black';
    return null;
  };

  const isValidMoveForBot = (board, fromRow, fromCol, toRow, toCol, piece) => {
    // Pastikan tidak keluar dari papan
    if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) return false;
    
    // Tidak bisa memakan buah sendiri
    const targetPiece = board[toRow][toCol];
    if (targetPiece && getPieceColor(piece) === getPieceColor(targetPiece)) {
      return false;
    }

    const rowDiff = Math.abs(toRow - fromRow);
    const colDiff = Math.abs(toCol - fromCol);

    switch (piece) {
      case '♙': // Pion putih
        if (fromRow === 6 && toRow === 4 && fromCol === toCol && !board[5][toCol] && !board[4][toCol]) return true;
        if (toRow === fromRow - 1 && fromCol === toCol && !targetPiece) return true;
        if (toRow === fromRow - 1 && Math.abs(toCol - fromCol) === 1 && targetPiece) return true;
        return false;
      
      case '♟': // Pion hitam
        if (fromRow === 1 && toRow === 3 && fromCol === toCol && !board[2][toCol] && !board[3][toCol]) return true;
        if (toRow === fromRow + 1 && fromCol === toCol && !targetPiece) return true;
        if (toRow === fromRow + 1 && Math.abs(toCol - fromCol) === 1 && targetPiece) return true;
        return false;
      
      case '♖':
      case '♜': // Benteng
        if (fromRow !== toRow && fromCol !== toCol) return false;
        return isPathClearForBot(board, fromRow, fromCol, toRow, toCol);
      
      case '♗':
      case '♝': // Gajah
        if (rowDiff !== colDiff) return false;
        return isPathClearForBot(board, fromRow, fromCol, toRow, toCol);
      
      case '♘':
      case '♞': // Kuda
        return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);
      
      case '♕':
      case '♛': // Ratu
        if (fromRow !== toRow && fromCol !== toCol && rowDiff !== colDiff) return false;
        return isPathClearForBot(board, fromRow, fromCol, toRow, toCol);
      
      case '♔':
      case '♚': // Raja
        return rowDiff <= 1 && colDiff <= 1;
      
      default:
        return false;
    }
  };

  const isPathClearForBot = (board, fromRow, fromCol, toRow, toCol) => {
    const rowDirection = toRow > fromRow ? 1 : toRow < fromRow ? -1 : 0;
    const colDirection = toCol > fromCol ? 1 : toCol < fromCol ? -1 : 0;
    
    let currentRow = fromRow + rowDirection;
    let currentCol = fromCol + colDirection;
    
    while (currentRow !== toRow || currentCol !== toCol) {
      if (board[currentRow][currentCol] !== null) return false;
      currentRow += rowDirection;
      currentCol += colDirection;
    }
    
    return true;
  };

  // Fungsi untuk update poin dan leaderboard (DIPERBAIKI)
  const updatePlayerPoints = async (isWin, gameType) => {
    try {
      const token = localStorage.getItem('token');
      let pointsEarned = 0;
      
      if (isWin) {
        pointsEarned = gameType === 'bot' ? 50 : 100;
      }
      
      const response = await axios.put(`${API_URL}/api/user/points`, {
        points: pointsEarned,
        gameType: gameType,
        isWin: isWin
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update state user dengan data terbaru dari server
      setUser(response.data.user);
      setProfile(response.data.user);
      
      console.log('Poin berhasil diupdate:', response.data.user);
      
      // Refresh leaderboard setelah update poin
      await fetchLeaderboard();
      
    } catch (error) {
      console.error('Error updating points:', error);
      // Fallback: update lokal jika API gagal
      const pointsEarned = isWin ? (gameType === 'bot' ? 50 : 100) : 0;
      const updatedUser = { 
        ...user, 
        points: (user.points || 0) + pointsEarned,
        games_played: (user.games_played || 0) + 1,
        wins: isWin ? (user.wins || 0) + 1 : (user.wins || 0)
      };
      setUser(updatedUser);
      setProfile(updatedUser);
    }
  };

  const handleMove = async (moveData) => {
    const newGameState = {
      ...gameState,
      board: moveData.board,
      currentPlayer: currentPlayer === 'white' ? 'black' : 'white'
    };

    setGameState(newGameState);
    
    // Cek skakmat setelah gerakan
    const nextPlayer = newGameState.currentPlayer;
    const isGameOver = isCheckmate(moveData.board, nextPlayer);
    
    if (isGameOver) {
      const winner = currentPlayer;
      const isPlayerWin = winner === gameState.playerColor;
      
      setGameResult({
        winner,
        isPlayerWin,
        message: isPlayerWin ? 'Selamat! Anda menang!' : 'Anda kalah!'
      });
      
      // Update poin setelah game selesai
      await updatePlayerPoints(isPlayerWin, gameState.gameType);
      
      // Simpan hasil game ke database jika bukan vs bot
      if (gameState.gameType !== 'bot') {
        try {
          const token = localStorage.getItem('token');
          await axios.post(`${API_URL}/api/game/finish`, {
            gameId: gameState.id,
            winnerId: isPlayerWin ? user.id : null,
            gameType: gameState.gameType
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch (error) {
          console.error('Error finishing game:', error);
        }
      }
      
      return;
    }

    setCurrentPlayer(newGameState.currentPlayer);

    // Jika vs bot dan bukan giliran pemain
    if (gameState.gameType === 'bot' && newGameState.currentPlayer !== gameState.playerColor) {
      setIsPlayerTurn(false);
      
      // Bot bergerak setelah delay
      setTimeout(async () => {
        const botMove = makeBotMove(moveData.board, newGameState.currentPlayer);
        if (botMove) {
          const botBoard = [...moveData.board];
          botBoard[botMove.to[0]][botMove.to[1]] = botBoard[botMove.from[0]][botMove.from[1]];
          botBoard[botMove.from[0]][botMove.from[1]] = null;
          
          // Cek skakmat setelah gerakan bot
          const isBotGameOver = isCheckmate(botBoard, gameState.playerColor);
          
          if (isBotGameOver) {
            setGameResult({
              winner: newGameState.currentPlayer,
              isPlayerWin: false,
              message: 'Bot menang! Coba lagi!'
            });
            setGameState(prev => ({ ...prev, board: botBoard }));
            
            // Update poin untuk kekalahan
            await updatePlayerPoints(false, gameState.gameType);
            return;
          }
          
          setGameState(prev => ({
            ...prev,
            board: botBoard,
            currentPlayer: gameState.playerColor
          }));
          setCurrentPlayer(gameState.playerColor);
          setIsPlayerTurn(true);
        }
      }, 1000);
    } else if (gameState.gameType !== 'bot') {
      // Kirim gerakan ke socket untuk multiplayer
      socket.emit('makeMove', {
        gameId: gameState.id,
        move: moveData
      });
    } else {
      setIsPlayerTurn(true);
    }
  };

  const startGame = async (gameType) => {
    if (gameType === 'bot') {
      // Langsung mulai game vs bot
      const newGameState = {
        id: Date.now(),
        gameType: 'bot',
        playerColor: 'white',
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
      setGameState(newGameState);
      setCurrentPlayer('white');
      setIsPlayerTurn(true);
      setGameResult(null);
      setCurrentPage('game');
    } else {
      // Untuk random dan friend, kirim request
      try {
        const token = localStorage.getItem('token');
        socket.emit('findGame', { gameType, userId: user.id, token });
        alert(`Mencari ${gameType === 'random' ? 'lawan random' : 'teman'}...`);
      } catch (error) {
        alert('Gagal memulai permainan: ' + error.message);
      }
    }
  };

  const sendGameRequest = (friendId) => {
    socket.emit('gameRequest', {
      from: user.id,
      to: friendId,
      fromUsername: user.username
    });
    alert('Permintaan permainan dikirim!');
  };

  const acceptGameRequest = (requestId) => {
    socket.emit('acceptGameRequest', requestId);
    setGameRequests(prev => prev.filter(req => req.id !== requestId));
  };

  const rejectGameRequest = (requestId) => {
    socket.emit('rejectGameRequest', requestId);
    setGameRequests(prev => prev.filter(req => req.id !== requestId));
  };

  const fetchFriends = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/friends`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFriends(response.data);
    } catch (error) {
      console.error('Error fetching friends:', error);
      // Fallback: tampilkan data dummy jika API tidak tersedia
      setFriends([
        { id: 1, username: 'player1', points: 1500 },
        { id: 2, username: 'player2', points: 1200 },
        { id: 3, username: 'player3', points: 1800 }
      ]);
    }
  };

  const searchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/users/search?q=${searchTerm}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAllUsers(response.data);
    } catch (error) {
      console.error('Error searching users:', error);
      // Fallback: tampilkan data dummy
      const dummyUsers = [
        { id: 4, username: 'chessmaster', points: 2000 },
        { id: 5, username: 'rookie123', points: 800 },
        { id: 6, username: 'grandmaster', points: 2500 }
      ].filter(user => user.username.toLowerCase().includes(searchTerm.toLowerCase()));
      setAllUsers(dummyUsers);
    }
  };

  const addFriend = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/api/friends/add`, 
        { friendId: userId }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Teman berhasil ditambahkan!');
      fetchFriends();
    } catch (error) {
      alert('Gagal menambahkan teman: ' + error.response?.data?.message || error.message);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/leaderboard`);
      setLeaderboard(response.data);
      console.log('Leaderboard updated:', response.data);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      // Fallback data dengan user terkini
      const fallbackData = [
        { id: 1, username: 'grandmaster', points: 2500 },
        { id: 2, username: 'chessking', points: 2200 },
        { id: 3, username: 'strategymaster', points: 2000 },
        { id: 4, username: 'player1', points: 1800 },
        { id: 5, username: 'rookie123', points: 1500 }
      ];
      
      // Tambahkan user saat ini jika belum ada
      if (user && !fallbackData.find(p => p.username === user.username)) {
        fallbackData.push({
          id: user.id,
          username: user.username,
          points: user.points || 0,
          games_played: user.games_played || 0,
          wins: user.wins || 0
        });
      }
      
      // Sort berdasarkan poin
      fallbackData.sort((a, b) => b.points - a.points);
      setLeaderboard(fallbackData);
    }
  };

  const updateProfile = async (updatedProfile) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(`${API_URL}/api/profile`, updatedProfile, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile(response.data.user);
      setUser(response.data.user);
      alert('Profil berhasil diperbarui!');
    } catch (error) {
      alert('Gagal memperbarui profil: ' + error.response?.data?.message || error.message);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    socket.emit('userDisconnected', user?.id);
    setUser(null);
    setCurrentPage('login');
  };

  const renderLogin = () => (
    <div className="auth-container">
      <div className="auth-card">
        <h2>🇮🇩 Catur Indonesia - Login</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="Username"
            value={loginData.username}
            onChange={(e) => setLoginData({...loginData, username: e.target.value})}
            required
            disabled={loading}
          />
          <input
            type="password"
            placeholder="Password"
            value={loginData.password}
            onChange={(e) => setLoginData({...loginData, password: e.target.value})}
            required
            disabled={loading}
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Login...' : 'Login'}
          </button>
        </form>
        <p>Belum punya akun? <button onClick={() => setCurrentPage('register')} disabled={loading}>Daftar</button></p>
      </div>
    </div>
  );

  const renderRegister = () => (
    <div className="auth-container">
      <div className="auth-card">
        <h2>🇮🇩 Catur Indonesia - Daftar</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleRegister}>
          <input
            type="text"
            placeholder="Username"
            value={registerData.username}
            onChange={(e) => setRegisterData({...registerData, username: e.target.value})}
            required
            disabled={loading}
          />
          <input
            type="email"
            placeholder="Email"
            value={registerData.email}
            onChange={(e) => setRegisterData({...registerData, email: e.target.value})}
            required
            disabled={loading}
          />
          <input
            type="password"
            placeholder="Password"
            value={registerData.password}
            onChange={(e) => setRegisterData({...registerData, password: e.target.value})}
            required
            disabled={loading}
          />
          <select
            value={registerData.role}
            onChange={(e) => setRegisterData({...registerData, role: e.target.value})}
            disabled={loading}
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <button type="submit" disabled={loading}>
            {loading ? 'Mendaftar...' : 'Daftar'}
          </button>
        </form>
        <p>Sudah punya akun? <button onClick={() => setCurrentPage('login')} disabled={loading}>Login</button></p>
      </div>
    </div>
  );

  // [Keep all other render functions the same as your original code]
  const renderNavigation = () => (
    <nav className="navigation">
      <div className="nav-brand">🇮🇩 Catur Indonesia</div>
      <div className="nav-links">
        <button onClick={() => setCurrentPage('dashboard')}>Dashboard</button>
        <button onClick={() => setCurrentPage('play')}>Main</button>
        <button onClick={() => { setCurrentPage('friends'); fetchFriends(); }}>Teman</button>
        <button onClick={() => setCurrentPage('tutorial')}>Tutorial</button>
        <button onClick={() => setCurrentPage('profile')}>Profil</button>
        <button onClick={() => { setCurrentPage('leaderboard'); fetchLeaderboard(); }}>Papan Skor</button>
        <button onClick={logout}>Keluar</button>
      </div>
      <div className="user-info">
        Halo, {user?.username}! (Poin: {user?.points || 0})
        {gameRequests.length > 0 && (
          <span className="notification-badge">{gameRequests.length}</span>
        )}
      </div>
    </nav>
  );

  const renderGameRequests = () => {
    if (gameRequests.length === 0) return null;
    
    return (
      <div className="game-requests">
        <h3>Permintaan Permainan</h3>
        {gameRequests.map(request => (
          <div key={request.id} className="game-request">
            <p>{request.fromUsername} mengundang Anda bermain catur</p>
            <button onClick={() => acceptGameRequest(request.id)}>Terima</button>
            <button onClick={() => rejectGameRequest(request.id)}>Tolak</button>
          </div>
        ))}
      </div>
    );
  };

  const renderDashboard = () => (
    <div className="dashboard">
      <h1>Selamat Datang di Catur Indonesia! 🇮🇩</h1>
      {renderGameRequests()}
      <div className="welcome-card">
        <h2>Halo, {user?.username}!</h2>
        <p>Selamat datang di platform catur terbesar Indonesia. Mari mulai permainan yang menantang!</p>
        <div className="stats">
          <div className="stat-item">
            <h3>Poin Anda</h3>
            <p>{user?.points || 0}</p>
          </div>
          <div className="stat-item">
            <h3>Permainan Dimainkan</h3>
            <p>{user?.games_played || 0}</p>
          </div>
          <div className="stat-item">
            <h3>Kemenangan</h3>
            <p>{user?.wins || 0}</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPlay = () => (
    <div className="play-section">
      <h1>Pilih Mode Permainan</h1>
      <div className="game-modes">
        <div className="game-mode-card" onClick={() => startGame('random')}>
          <h3>🎲 Lawan Random</h3>
          <p>Bermain melawan pemain acak</p>
        </div>
        <div className="game-mode-card" onClick={() => startGame('bot')}>
          <h3>🤖 Lawan Bot</h3>
          <p>Berlatih melawan komputer</p>
        </div>
        <div className="game-mode-card" onClick={() => startGame('friend')}>
          <h3>👥 Undang Teman</h3>
          <p>Bermain dengan teman</p>
        </div>
      </div>
    </div>
  );

  const renderGame = () => (
    <div className="game-container">
      <h2>Permainan Catur</h2>
      {gameResult && (
        <div className={`game-result ${gameResult.isPlayerWin ? 'win' : 'lose'}`}>
          <h3>{gameResult.message}</h3>
          {gameResult.isPlayerWin && <p>+{gameState.gameType === 'bot' ? 50 : 100} poin!</p>}
          <button onClick={() => setCurrentPage('dashboard')}>Kembali ke Dashboard</button>
          <button onClick={() => startGame(gameState.gameType)}>Main Lagi</button>
        </div>
      )}
      <ChessBoard 
        gameState={gameState} 
        onMove={handleMove}
        currentPlayer={currentPlayer}
        isPlayerTurn={isPlayerTurn}
        gameResult={gameResult}
      />
      <button onClick={() => setCurrentPage('dashboard')}>Kembali ke Dashboard</button>
    </div>
  );

  const renderFriends = () => (
    <div className="friends-section">
      <h1>Daftar Teman</h1>
      
      {/* Search Section */}
      <div className="search-section">
        <h3>Cari Pengguna Baru</h3>
        <div className="search-bar">
          <input
            type="text"
            placeholder="Masukkan username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button onClick={searchUsers}>Cari</button>
        </div>
        
        {allUsers.length > 0 && (
          <div className="search-results">
            <h4>Hasil Pencarian:</h4>
            {allUsers.map(user => (
              <div key={user.id} className="user-card">
                <h3>{user.username}</h3>
                <p>Poin: {user.points}</p>
                <button onClick={() => addFriend(user.id)}>Tambah Teman</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Friends List */}
      <div className="friends-list">
        <h3>Teman Anda</h3>
        {friends.length === 0 ? (
          <p>Anda belum memiliki teman. Cari dan tambahkan teman baru!</p>
        ) : (
          friends.map(friend => (
            <div key={friend.id} className="friend-card">
              <h3>{friend.username}</h3>
              <p>Poin: {friend.points}</p>
              <button onClick={() => sendGameRequest(friend.id)}>Undang Main</button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderTutorial = () => (
    <div className="tutorial-section">
      <h1>Tutorial Catur Indonesia</h1>
      <div className="tutorial-content">
        <h2>Cara Bermain Catur</h2>
        <p>Catur adalah permainan strategi untuk dua pemain yang dimainkan di atas papan berpetak 8x8.</p>
        
        <h3>Peraturan Dasar:</h3>
        <ul>
          <li>Setiap pemain memulai dengan 16 buah catur</li>
          <li>Tujuan: mengalahkan raja lawan (skakmat)</li>
          <li>Pemain dengan buah putih bergerak terlebih dahulu</li>
          <li>Setiap buah memiliki cara bergerak yang berbeda</li>
        </ul>

        <h3>Gerakan Buah Catur:</h3>
        <ul>
          <li><strong>Raja (♔/♚):</strong> Bergerak satu kotak ke segala arah</li>
          <li><strong>Ratu (♕/♛):</strong> Bergerak bebas horizontal, vertikal, dan diagonal</li>
          <li><strong>Benteng (♖/♜):</strong> Bergerak horizontal dan vertikal</li>
          <li><strong>Gajah (♗/♝):</strong> Bergerak diagonal</li>
          <li><strong>Kuda (♘/♞):</strong> Bergerak berbentuk L</li>
          <li><strong>Pion (♙/♟):</strong> Bergerak maju satu kotak, memakan diagonal</li>
        </ul>

        <h3>Gerakan Khusus:</h3>
        <ul>
          <li><strong>Rokade:</strong> Gerakan khusus raja dan benteng</li>
          <li><strong>En Passant:</strong> Cara khusus pion memakan pion lawan</li>
          <li><strong>Promosi Pion:</strong> Pion yang mencapai ujang papan dapat dipromosikan</li>
        </ul>

        <h3>Sistem Poin:</h3>
        <ul>
          <li>Menang vs Bot: +50 poin</li>
          <li>Menang vs Pemain: +100 poin</li>
        </ul>
      </div>
    </div>
  );

  const renderProfile = () => (
    <div className="profile-section">
      <h1>Profil Pengguna</h1>
      <div className="profile-form">
        <input
          type="text"
          placeholder="Username"
          value={profile.username}
          onChange={(e) => setProfile({...profile, username: e.target.value})}
        />
        <input
          type="email"
          placeholder="Email"
          value={profile.email}
          onChange={(e) => setProfile({...profile, email: e.target.value})}
        />
        <p>Poin: {profile.points}</p>
        <p>Permainan Dimainkan: {profile.games_played || 0}</p>
        <p>Kemenangan: {profile.wins || 0}</p>
        <button onClick={() => updateProfile(profile)}>Perbarui Profil</button>
      </div>
    </div>
  );

  const renderLeaderboard = () => (
    <div className="leaderboard-section">
      <h1>Papan Skor</h1>
      <button onClick={fetchLeaderboard} style={{marginBottom: '20px'}}>
        🔄 Refresh Leaderboard
      </button>
      <div className="leaderboard-list">
        {leaderboard.map((player, index) => (
          <div key={player.id} className={`leaderboard-item ${player.username === user?.username ? 'current-user' : ''}`}>
            <span className="rank">#{index + 1}</span>
            <span className="username">{player.username}</span>
            <span className="points">{player.points} poin</span>
            <span className="stats">
              ({player.games_played || 0} games, {player.wins || 0} wins)
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  if (loading && !user) {
    return (
      <div className="App">
        <div className="loading-container">
          <h2>🇮🇩 Catur Indonesia</h2>
          <p>Sedang memuat...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="App">
        {currentPage === 'login' && renderLogin()}
        {currentPage === 'register' && renderRegister()}
      </div>
    );
  }

  return (
    <div className="App">
      {renderNavigation()}
      <main className="main-content">
        {currentPage === 'dashboard' && renderDashboard()}
        {currentPage === 'play' && renderPlay()}
        {currentPage === 'game' && renderGame()}
        {currentPage === 'friends' && renderFriends()}
        {currentPage === 'tutorial' && renderTutorial()}
        {currentPage === 'profile' && renderProfile()}
        {currentPage === 'leaderboard' && renderLeaderboard()}
      </main>
    </div>
  );
}

export default App;