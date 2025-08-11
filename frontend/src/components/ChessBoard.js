import React, { useState, useEffect } from 'react';

const ChessBoard = ({ gameState, onMove, currentPlayer, isPlayerTurn, gameResult }) => {
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [possibleMoves, setPossibleMoves] = useState([]);
  
  // Inisialisasi papan catur 8x8
  const initialBoard = [
    ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
    ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'],
    ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖']
  ];

  const [board, setBoard] = useState(gameState?.board || initialBoard);

  useEffect(() => {
    if (gameState?.board) {
      setBoard(gameState.board);
    }
  }, [gameState]);

  // Reset selected square ketika game selesai
  useEffect(() => {
    if (gameResult) {
      setSelectedSquare(null);
      setPossibleMoves([]);
    }
  }, [gameResult]);

  // Fungsi untuk menentukan warna buah catur
  const getPieceColor = (piece) => {
    const whitePieces = ['♙', '♖', '♘', '♗', '♕', '♔'];
    const blackPieces = ['♟', '♜', '♞', '♝', '♛', '♚'];
    
    if (whitePieces.includes(piece)) return 'white';
    if (blackPieces.includes(piece)) return 'black';
    return null;
  };

  // Fungsi untuk validasi gerakan berdasarkan jenis buah (diperbaiki)
  const isValidMove = (fromRow, fromCol, toRow, toCol, piece) => {
    // Pastikan tidak keluar dari papan
    if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) return false;
    
    // Tidak bisa stay di tempat yang sama
    if (fromRow === toRow && fromCol === toCol) return false;
    
    // Tidak bisa memakan buah sendiri
    const targetPiece = board[toRow][toCol];
    if (targetPiece && getPieceColor(piece) === getPieceColor(targetPiece)) {
      return false;
    }

    const rowDiff = Math.abs(toRow - fromRow);
    const colDiff = Math.abs(toCol - fromCol);

    switch (piece) {
      case '♙': // Pion putih
        // Gerakan maju dua langkah dari posisi awal
        if (fromRow === 6 && toRow === 4 && fromCol === toCol && !board[5][toCol] && !board[4][toCol]) return true;
        // Gerakan maju satu langkah
        if (toRow === fromRow - 1 && fromCol === toCol && !targetPiece) return true;
        // Memakan diagonal
        if (toRow === fromRow - 1 && Math.abs(toCol - fromCol) === 1 && targetPiece && getPieceColor(targetPiece) === 'black') return true;
        return false;
      
      case '♟': // Pion hitam
        // Gerakan maju dua langkah dari posisi awal
        if (fromRow === 1 && toRow === 3 && fromCol === toCol && !board[2][toCol] && !board[3][toCol]) return true;
        // Gerakan maju satu langkah
        if (toRow === fromRow + 1 && fromCol === toCol && !targetPiece) return true;
        // Memakan diagonal
        if (toRow === fromRow + 1 && Math.abs(toCol - fromCol) === 1 && targetPiece && getPieceColor(targetPiece) === 'white') return true;
        return false;
      
      case '♖':
      case '♜': // Benteng
        if (fromRow !== toRow && fromCol !== toCol) return false;
        return isPathClear(fromRow, fromCol, toRow, toCol);
      
      case '♗':
      case '♝': // Gajah
        if (rowDiff !== colDiff) return false;
        return isPathClear(fromRow, fromCol, toRow, toCol);
      
      case '♘':
      case '♞': // Kuda
        return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);
      
      case '♕':
      case '♛': // Ratu
        if (fromRow !== toRow && fromCol !== toCol && rowDiff !== colDiff) return false;
        return isPathClear(fromRow, fromCol, toRow, toCol);
      
      case '♔':
      case '♚': // Raja
        return rowDiff <= 1 && colDiff <= 1;
      
      default:
        return false;
    }
  };

  // Fungsi untuk mengecek apakah jalur kosong (diperbaiki)
  const isPathClear = (fromRow, fromCol, toRow, toCol) => {
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

  // Fungsi untuk mendapatkan semua gerakan yang mungkin
  const getPossibleMoves = (row, col, piece) => {
    const moves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (isValidMove(row, col, r, c, piece)) {
          moves.push([r, c]);
        }
      }
    }
    return moves;
  };

  const handleSquareClick = (row, col) => {
    // Tidak bisa bergerak jika game sudah selesai
    if (gameResult) return;
    
    // Hanya izinkan gerakan jika giliran pemain
    if (!isPlayerTurn && gameState?.gameType === 'bot') return;
    
    if (selectedSquare) {
      const [selectedRow, selectedCol] = selectedSquare;
      const piece = board[selectedRow][selectedCol];
      
      // Cek apakah gerakan valid
      if (isValidMove(selectedRow, selectedCol, row, col, piece)) {
        // Buat salinan papan baru
        const newBoard = board.map(row => [...row]);
        newBoard[row][col] = newBoard[selectedRow][selectedCol];
        newBoard[selectedRow][selectedCol] = null;
        
        // Update state lokal terlebih dahulu untuk responsivitas
        setBoard(newBoard);
        setSelectedSquare(null);
        setPossibleMoves([]);
        
        // Kirim gerakan ke parent component
        if (onMove) {
          onMove({
            from: [selectedRow, selectedCol],
            to: [row, col],
            board: newBoard,
            piece: piece
          });
        }
      } else {
        // Jika gerakan tidak valid, pilih kotak baru jika ada buah yang bisa dimainkan
        if (board[row][col] && getPieceColor(board[row][col]) === currentPlayer) {
          setSelectedSquare([row, col]);
          setPossibleMoves(getPossibleMoves(row, col, board[row][col]));
        } else {
          setSelectedSquare(null);
          setPossibleMoves([]);
        }
      }
    } else if (board[row][col]) {
      // Hanya izinkan memilih buah sesuai giliran
      if (getPieceColor(board[row][col]) === currentPlayer) {
        setSelectedSquare([row, col]);
        setPossibleMoves(getPossibleMoves(row, col, board[row][col]));
      }
    }
  };

  const getSquareColor = (row, col) => {
    const isLight = (row + col) % 2 === 0;
    const isSelected = selectedSquare && selectedSquare[0] === row && selectedSquare[1] === col;
    const isPossibleMove = possibleMoves.some(move => move[0] === row && move[1] === col);
    
    if (isSelected) return 'bg-yellow-400';
    if (isPossibleMove) return 'bg-green-300';
    return isLight ? 'bg-amber-100' : 'bg-amber-600';
  };

  return (
    <div className="chess-board-container">
      <div className="game-info">
        <h3>Giliran: {currentPlayer === 'white' ? 'Putih' : 'Hitam'}</h3>
        {gameState?.gameType === 'bot' && !gameResult && (
          <p>{isPlayerTurn ? 'Giliran Anda' : 'Bot sedang berpikir...'}</p>
        )}
        {gameResult && (
          <div className={`game-status ${gameResult.isPlayerWin ? 'winner' : 'loser'}`}>
            <h3>{gameResult.message}</h3>
          </div>
        )}
      </div>
      <div className="chess-board">
        {board.map((row, rowIndex) => (
          <div key={rowIndex} className="chess-row">
            {row.map((piece, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`chess-square ${getSquareColor(rowIndex, colIndex)} ${gameResult ? 'game-over' : ''}`}
                onClick={() => handleSquareClick(rowIndex, colIndex)}
              >
                <span className="chess-piece">{piece}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChessBoard;