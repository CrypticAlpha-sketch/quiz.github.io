const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const express = require('express');
const path = require('path');

// Expressアプリを作成（静的ファイル配信用）
const app = express();
const PORT = process.env.PORT || 8080;

// 静的ファイルを配信
app.use(express.static(path.join(__dirname)));

// HTMLページのルート
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// HTTPサーバーを作成
const server = require('http').createServer(app);

// WebSocketサーバーを作成
const wss = new WebSocket.Server({ 
    server: server,
    perMessageDeflate: false 
});

// ゲーム管理
const rooms = new Map();
const players = new Map();

// デフォルトの問題セット
const defaultQuestions = [
    {
        question: "日本の首都はどこですか？",
        choices: ["大阪", "東京", "京都"],
        correct: 1,
        category: "general"
    },
    {
        question: "富士山の高さは？",
        choices: ["3,776m", "3,676m", "3,876m"],
        correct: 0,
        category: "geography"
    },
    {
        question: "鎌倉幕府を開いたのは誰？",
        choices: ["源頼朝", "足利尊氏", "徳川家康"],
        correct: 0,
        category: "history"
    },
    {
        question: "水の化学式は？",
        choices: ["CO2", "H2O", "O2"],
        correct: 1,
        category: "science"
    },
    {
        question: "東京オリンピック2020の開催年は？",
        choices: ["2020年", "2021年", "2022年"],
        correct: 1,
        category: "sports"
    },
    {
        question: "ジブリ作品「千と千尋の神隠し」の監督は？",
        choices: ["宮崎駿", "高畑勲", "細田守"],
        correct: 0,
        category: "entertainment"
    }
];

// ルーム作成
function createRoom(hostPlayer) {
    const roomId = generateRoomId();
    const room = {
        id: roomId,
        host: hostPlayer.id,
        players: [hostPlayer],
        gameState: 'waiting',
        currentQuestion: 0,
        questions: [],
        scores: {},
        answers: []
    };
    
    rooms.set(roomId, room);
    console.log(`ルーム作成: ${roomId}`);
    return room;
}

// ルームID生成
function generateRoomId() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
}

// 問題をシャッフル
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// 全プレイヤーにメッセージ送信
function broadcastToRoom(roomId, message) {
    const room = rooms.get(roomId);
    if (!room) return;
    
    room.players.forEach(player => {
        if (player.ws && player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(JSON.stringify(message));
        }
    });
}

// プレイヤーにメッセージ送信
function sendToPlayer(playerId, message) {
    const player = players.get(playerId);
    if (player && player.ws && player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(JSON.stringify(message));
    }
}

// WebSocket接続処理
wss.on('connection', (ws) => {
    console.log('新しい接続が確立されました');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('受信メッセージ:', data);
            
            handleMessage(ws, data);
            
        } catch (error) {
            console.error('メッセージ解析エラー:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'メッセージの形式が正しくありません'
            }));
        }
    });
    
    ws.on('close', () => {
        console.log('接続が終了しました');
        handleDisconnect(ws);
    });
    
    ws.on('error', (error) => {
        console.error('WebSocketエラー:', error);
    });
});

// メッセージ処理（以前と同じ内容）
function handleMessage(ws, data) {
    switch (data.type) {
        case 'createRoom':
            handleCreateRoom(ws, data);
            break;
        case 'joinRoom':
            handleJoinRoom(ws, data);
            break;
        case 'leaveRoom':
            handleLeaveRoom(ws, data);
            break;
        case 'startGame':
            handleStartGame(ws, data);
            break;
        case 'selectAnswer':
            handleSelectAnswer(ws, data);
            break;
        case 'ready':
            handlePlayerReady(ws, data);
            break;
        default:
            console.log('未知のメッセージタイプ:', data.type);
    }
}

// ルーム作成処理
function handleCreateRoom(ws, data) {
    const playerId = uuidv4();
    const player = {
        id: playerId,
        name: data.playerName,
        ws: ws,
        ready: false
    };
    
    players.set(playerId, player);
    const room = createRoom(player);
    
    room.scores[playerId] = 0;
    
    sendToPlayer(playerId, {
        type: 'roomCreated',
        roomId: room.id,
        playerId: playerId,
        players: room.players.map(p => ({
            id: p.id,
            name: p.name,
            ready: p.ready
        }))
    });
}

// ルーム参加処理
function handleJoinRoom(ws, data) {
    const room = rooms.get(data.roomId);
    if (!room) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'ルームが見つかりません'
        }));
        return;
    }
    
    if (room.gameState !== 'waiting') {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'ゲーム進行中のため参加できません'
        }));
        return;
    }
    
    const playerId = uuidv4();
    const player = {
        id: playerId,
        name: data.playerName,
        ws: ws,
        ready: false
    };
    
    players.set(playerId, player);
    room.players.push(player);
    room.scores[playerId] = 0;
    
    broadcastToRoom(room.id, {
        type: 'playerJoined',
        playerId: playerId,
        playerName: data.playerName,
        players: room.players.map(p => ({
            id: p.id,
            name: p.name,
            ready: p.ready
        }))
    });
    
    sendToPlayer(playerId, {
        type: 'joinedRoom',
        roomId: room.id,
        playerId: playerId
    });
}

// プレイヤー準備完了
function handlePlayerReady(ws, data) {
    const player = players.get(data.playerId);
    if (player) {
        player.ready = !player.ready;
        
        const room = [...rooms.values()].find(r => 
            r.players.some(p => p.id === data.playerId)
        );
        
        if (room) {
            broadcastToRoom(room.id, {
                type: 'playerReady',
                playerId: data.playerId,
                ready: player.ready,
                players: room.players.map(p => ({
                    id: p.id,
                    name: p.name,
                    ready: p.ready
                }))
            });
        }
    }
}

// ゲーム開始処理
function handleStartGame(ws, data) {
    const room = rooms.get(data.roomId);
    if (!room) return;
    
    const player = players.get(data.playerId);
    if (!player || room.host !== player.id) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'ゲームを開始する権限がありません'
        }));
        return;
    }
    
    if (room.players.length < 2) {
        ws.send(JSON.stringify({
            type: 'error',
            message: '最低2人のプレイヤーが必要です'
        }));
        return;
    }
    
    room.questions = shuffleArray(defaultQuestions).slice(0, 6);
    room.gameState = 'playing';
    room.currentQuestion = 0;
    
    broadcastToRoom(room.id, {
        type: 'gameStart',
        questions: room.questions
    });
    
    setTimeout(() => {
        sendQuestion(room);
    }, 1000);
}

// 問題送信
function sendQuestion(room) {
    if (room.currentQuestion >= room.questions.length) {
        endGame(room);
        return;
    }
    
    room.answers = [];
    
    broadcastToRoom(room.id, {
        type: 'newQuestion',
        questionNumber: room.currentQuestion + 1,
        totalQuestions: room.questions.length,
        question: room.questions[room.currentQuestion]
    });
    
    setTimeout(() => {
        nextQuestion(room);
    }, 15000);
}

// 回答処理
function handleSelectAnswer(ws, data) {
    const room = rooms.get(data.roomId);
    if (!room || room.gameState !== 'playing') return;
    
    const player = players.get(data.playerId);
    if (!player) return;
    
    if (room.answers.some(answer => answer.playerId === data.playerId)) {
        return;
    }
    
    const question = room.questions[room.currentQuestion];
    const isCorrect = data.answerIndex === question.correct;
    
    const answerData = {
        playerId: data.playerId,
        playerName: player.name,
        answerIndex: data.answerIndex,
        correct: isCorrect,
        timestamp: Date.now()
    };
    
    room.answers.push(answerData);
    
    if (isCorrect) {
        const order = room.answers.filter(a => a.correct).length;
        let points = 0;
        switch (order) {
            case 1: points = 100; break;
            case 2: points = 80; break;
            case 3: points = 60; break;
            default: points = 40; break;
        }
        room.scores[data.playerId] += points;
    }
    
    broadcastToRoom(room.id, {
        type: 'answerResult',
        playerId: data.playerId,
        playerName: player.name,
        answerIndex: data.answerIndex,
        correct: isCorrect,
        currentAnswers: room.answers.map(a => ({
            playerName: a.playerName,
            correct: a.correct,
            order: room.answers.filter(ans => ans.correct && ans.timestamp <= a.timestamp).length
        }))
    });
    
    if (room.answers.length >= room.players.length) {
        setTimeout(() => {
            nextQuestion(room);
        }, 2000);
    }
}

// 次の問題
function nextQuestion(room) {
    room.currentQuestion++;
    if (room.currentQuestion >= room.questions.length) {
        endGame(room);
    } else {
        sendQuestion(room);
    }
}

// ゲーム終了
function endGame(room) {
    room.gameState = 'finished';
    
    const finalScores = Object.entries(room.scores)
        .map(([playerId, score]) => ({
            playerId,
            playerName: players.get(playerId)?.name || 'Unknown',
            score
        }))
        .sort((a, b) => b.score - a.score);
    
    broadcastToRoom(room.id, {
        type: 'gameEnd',
        scores: finalScores
    });
}

// 切断処理
function handleDisconnect(ws) {
    let disconnectedPlayer = null;
    for (const [playerId, player] of players.entries()) {
        if (player.ws === ws) {
            disconnectedPlayer = { id: playerId, ...player };
            players.delete(playerId);
            break;
        }
    }
    
    if (!disconnectedPlayer) return;
    
    for (const [roomId, room] of rooms.entries()) {
        const playerIndex = room.players.findIndex(p => p.id === disconnectedPlayer.id);
        if (playerIndex !== -1) {
            room.players.splice(playerIndex, 1);
            delete room.scores[disconnectedPlayer.id];
            
            if (room.players.length === 0) {
                rooms.delete(roomId);
                console.log(`ルーム削除: ${roomId}`);
            } else {
                broadcastToRoom(roomId, {
                    type: 'playerLeft',
                    playerId: disconnectedPlayer.id,
                    playerName: disconnectedPlayer.name,
                    players: room.players.map(p => ({
                        id: p.id,
                        name: p.name,
                        ready: p.ready
                    }))
                });
                
                if (room.host === disconnectedPlayer.id && room.players.length > 0) {
                    room.host = room.players[0].id;
                    broadcastToRoom(roomId, {
                        type: 'newHost',
                        hostId: room.host
                    });
                }
            }
            break;
        }
    }
}

// ルーム退出処理
function handleLeaveRoom(ws, data) {
    const player = players.get(data.playerId);
    if (!player) return;
    
    for (const [roomId, room] of rooms.entries()) {
        const playerIndex = room.players.findIndex(p => p.id === data.playerId);
        if (playerIndex !== -1) {
            room.players.splice(playerIndex, 1);
            delete room.scores[data.playerId];
            
            if (room.players.length === 0) {
                rooms.delete(roomId);
            } else {
                broadcastToRoom(roomId, {
                    type: 'playerLeft',
                    playerId: data.playerId,
                    playerName: player.name,
                    players: room.players.map(p => ({
                        id: p.id,
                        name: p.name,
                        ready: p.ready
                    }))
                });
                
                if (room.host === data.playerId && room.players.length > 0) {
                    room.host = room.players[0].id;
                    broadcastToRoom(roomId, {
                        type: 'newHost',
                        hostId: room.host
                    });
                }
            }
            break;
        }
    }
    
    players.delete(data.playerId);
}

// サーバー起動
server.listen(PORT, () => {
    console.log(`🚀 早押しクイズサーバーが起動しました`);
    console.log(`📡 ポート: ${PORT}`);
    console.log(`🌐 HTTPサーバー: http://localhost:${PORT}`);
    console.log(`🔌 WebSocketサーバー: ws://localhost:${PORT}`);
});

// 定期的な統計情報
setInterval(() => {
    console.log(`📊 統計 - アクティブルーム: ${rooms.size}, 接続プレイヤー: ${players.size}`);
}, 30000);
