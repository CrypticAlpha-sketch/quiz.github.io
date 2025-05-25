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

// デフォルトの問題セット（大幅に拡張）
const defaultQuestions = {
    general: [
        {
            question: "日本の首都はどこですか？",
            choices: ["大阪", "東京", "京都"],
            correct: 1,
            category: "general"
        },
        {
            question: "日本の通貨単位は？",
            choices: ["ウォン", "元", "円"],
            correct: 2,
            category: "general"
        },
        {
            question: "日本の国花は？",
            choices: ["桜", "菊", "梅"],
            correct: 0,
            category: "general"
        },
        {
            question: "日本の人口は約何人？",
            choices: ["1億人", "1億2000万人", "1億5000万人"],
            correct: 1,
            category: "general"
        },
        {
            question: "日本の面積は世界第何位？",
            choices: ["60位", "61位", "62位"],
            correct: 1,
            category: "general"
        }
    ],
    geography: [
        {
            question: "富士山の高さは？",
            choices: ["3,776m", "3,676m", "3,876m"],
            correct: 0,
            category: "geography"
        },
        {
            question: "日本で一番大きな湖は？",
            choices: ["霞ヶ浦", "琵琶湖", "洞爺湖"],
            correct: 1,
            category: "geography"
        },
        {
            question: "日本で一番長い川は？",
            choices: ["利根川", "信濃川", "石狩川"],
            correct: 1,
            category: "geography"
        },
        {
            question: "日本最北端の都道府県は？",
            choices: ["青森県", "北海道", "岩手県"],
            correct: 1,
            category: "geography"
        },
        {
            question: "日本最大の島は？",
            choices: ["北海道", "本州", "九州"],
            correct: 1,
            category: "geography"
        }
    ],
    history: [
        {
            question: "鎌倉幕府を開いたのは誰？",
            choices: ["源頼朝", "足利尊氏", "徳川家康"],
            correct: 0,
            category: "history"
        },
        {
            question: "明治維新は何年？",
            choices: ["1868年", "1858年", "1878年"],
            correct: 0,
            category: "history"
        },
        {
            question: "第二次世界大戦が終わった年は？",
            choices: ["1944年", "1945年", "1946年"],
            correct: 1,
            category: "history"
        },
        {
            question: "江戸幕府を開いたのは誰？",
            choices: ["徳川家康", "徳川秀忠", "徳川家光"],
            correct: 0,
            category: "history"
        },
        {
            question: "平安時代の都は？",
            choices: ["奈良", "京都", "鎌倉"],
            correct: 1,
            category: "history"
        }
    ],
    science: [
        {
            question: "水の化学式は？",
            choices: ["CO2", "H2O", "O2"],
            correct: 1,
            category: "science"
        },
        {
            question: "光の速度は約？",
            choices: ["30万km/秒", "3万km/秒", "300万km/秒"],
            correct: 0,
            category: "science"
        },
        {
            question: "地球から太陽までの距離は約？",
            choices: ["1億5000万km", "1000万km", "10億km"],
            correct: 0,
            category: "science"
        },
        {
            question: "酸素の化学記号は？",
            choices: ["O", "O2", "Ox"],
            correct: 0,
            category: "science"
        },
        {
            question: "重力加速度は約？",
            choices: ["9.8m/s²", "8.9m/s²", "10.2m/s²"],
            correct: 0,
            category: "science"
        }
    ],
    sports: [
        {
            question: "東京オリンピック2020の開催年は？",
            choices: ["2020年", "2021年", "2022年"],
            correct: 1,
            category: "sports"
        },
        {
            question: "サッカーのワールドカップは何年ごと？",
            choices: ["2年", "3年", "4年"],
            correct: 2,
            category: "sports"
        },
        {
            question: "野球で1イニングに投手が投げる最少球数は？",
            choices: ["3球", "6球", "9球"],
            correct: 0,
            category: "sports"
        },
        {
            question: "バスケットボールのゴールの高さは？",
            choices: ["3.05m", "3.15m", "3.25m"],
            correct: 0,
            category: "sports"
        },
        {
            question: "テニスの4大大会でないのは？",
            choices: ["ウィンブルドン", "全仏オープン", "マスターズ"],
            correct: 2,
            category: "sports"
        }
    ],
    entertainment: [
        {
            question: "ジブリ作品「千と千尋の神隠し」の監督は？",
            choices: ["宮崎駿", "高畑勲", "細田守"],
            correct: 0,
            category: "entertainment"
        },
        {
            question: "「鬼滅の刃」の主人公の名前は？",
            choices: ["竈門炭治郎", "我妻善逸", "嘴平伊之助"],
            correct: 0,
            category: "entertainment"
        },
        {
            question: "ポケモンの最初の御三家は？",
            choices: ["フシギダネ・ヒトカゲ・ゼニガメ", "チコリータ・ヒノアラシ・ワニノコ", "キモリ・アチャモ・ミズゴロウ"],
            correct: 0,
            category: "entertainment"
        },
        {
            question: "「ワンピース」の主人公は？",
            choices: ["ルフィ", "ゾロ", "サンジ"],
            correct: 0,
            category: "entertainment"
        },
        {
            question: "「となりのトトロ」に登場するキャラクターは？",
            choices: ["ネコバス", "魔女の宅急便", "ハウル"],
            correct: 0,
            category: "entertainment"
        }
    ]
};

// 問題プールから問題を選択
function selectQuestions(categories = null, count = 6) {
    let allQuestions = [];
    
    // カテゴリが指定されていない場合は全カテゴリから選択
    const selectedCategories = categories || Object.keys(defaultQuestions);
    
    // 指定されたカテゴリから問題を収集
    selectedCategories.forEach(category => {
        if (defaultQuestions[category]) {
            allQuestions = allQuestions.concat(defaultQuestions[category]);
        }
    });
    
    // 問題が不足している場合は全カテゴリから補完
    if (allQuestions.length < count) {
        Object.values(defaultQuestions).forEach(categoryQuestions => {
            allQuestions = allQuestions.concat(categoryQuestions);
        });
    }
    
    // 重複を除去してシャッフル
    const uniqueQuestions = allQuestions.filter((question, index, self) => 
        index === self.findIndex(q => q.question === question.question)
    );
    
    return shuffleArray(uniqueQuestions).slice(0, count);
}

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
        answers: [],
        questionTimer: null,
        countdownTimer: null,
        timeLeft: 15
    };
    
    rooms.set(roomId, room);
    console.log(`ルーム作成: ${roomId}, ホスト: ${hostPlayer.name}`);
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
    
    console.log(`ルーム${roomId}に送信:`, message.type);
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
        console.log(`プレイヤー${playerId}に送信:`, message.type);
        player.ws.send(JSON.stringify(message));
    }
}

// WebSocket接続処理
wss.on('connection', (ws) => {
    console.log('新しい接続が確立されました');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('受信メッセージ:', data.type, data);
            
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

// メッセージ処理
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
        case 'toggleReady': // ready → toggleReady に修正
            handlePlayerReady(ws, data);
            break;
        default:
            console.log('未知のメッセージタイプ:', data.type);
            ws.send(JSON.stringify({
                type: 'error',
                message: `未知のメッセージタイプ: ${data.type}`
            }));
    }
}

// ルーム作成処理
function handleCreateRoom(ws, data) {
    const playerId = uuidv4();
    const player = {
        id: playerId,
        name: data.playerName,
        ws: ws,
        ready: false,
        isHost: true
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
            ready: p.ready,
            isHost: p.id === room.host
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
        ready: false,
        isHost: false
    };
    
    players.set(playerId, player);
    room.players.push(player);
    room.scores[playerId] = 0;
    
    // 参加者に通知
    sendToPlayer(playerId, {
        type: 'joinedRoom',
        roomId: room.id,
        playerId: playerId,
        players: room.players.map(p => ({
            id: p.id,
            name: p.name,
            ready: p.ready,
            isHost: p.id === room.host
        }))
    });
    
    // 他のプレイヤーに通知
    broadcastToRoom(room.id, {
        type: 'playerJoined',
        playerId: playerId,
        playerName: data.playerName,
        players: room.players.map(p => ({
            id: p.id,
            name: p.name,
            ready: p.ready,
            isHost: p.id === room.host
        }))
    });
}

// プレイヤー準備完了
function handlePlayerReady(ws, data) {
    console.log('準備状態切り替え:', data);
    
    const player = players.get(data.playerId);
    if (!player) {
        console.log('プレイヤーが見つかりません:', data.playerId);
        return;
    }
    
    player.ready = !player.ready;
    console.log(`プレイヤー${player.name}の準備状態: ${player.ready}`);
    
    const room = [...rooms.values()].find(r => 
        r.players.some(p => p.id === data.playerId)
    );
    
    if (room) {
        broadcastToRoom(room.id, {
            type: 'playerUpdate', // playerReady → playerUpdate に修正
            playerId: data.playerId,
            ready: player.ready,
            players: room.players.map(p => ({
                id: p.id,
                name: p.name,
                ready: p.ready,
                isHost: p.id === room.host
            }))
        });
    }
}

// ゲーム開始処理
function handleStartGame(ws, data) {
    console.log('ゲーム開始リクエスト:', data);
    
    const room = rooms.get(data.roomId);
    if (!room) {
        console.log('ルームが見つかりません:', data.roomId);
        return;
    }
    
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
    
    // 問題の選択ロジックを改善
    let questions;
    
    if (data.questions && data.questions.length >= 6) {
        // クライアントから送られたカスタム問題がある場合
        console.log('カスタム問題を使用:', data.questions.length + '問');
        questions = shuffleArray(data.questions).slice(0, 6);
    } else if (data.categories && data.categories.length > 0) {
        // カテゴリが指定されている場合
        console.log('指定カテゴリから問題選択:', data.categories);
        questions = selectQuestions(data.categories, 6);
    } else {
        // デフォルト: 全カテゴリからランダム選択
        console.log('全カテゴリから問題選択');
        questions = selectQuestions(null, 6);
    }
    
    room.questions = questions;
    room.gameState = 'playing';
    room.currentQuestion = 0;
    
    console.log(`ゲーム開始 - ルーム${room.id}, ${room.questions.length}問`);
    console.log('選択された問題:', room.questions.map(q => q.question));
    
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
    
    console.log(`問題${room.currentQuestion + 1}を送信 - ルーム${room.id}`);
    
    room.answers = [];
    room.timeLeft = 15; // タイマー初期化
    
    broadcastToRoom(room.id, {
        type: 'newQuestion',
        questionNumber: room.currentQuestion + 1,
        totalQuestions: room.questions.length,
        question: room.questions[room.currentQuestion],
        timeLeft: room.timeLeft
    });
    
    // 問題のタイマーをクリア
    if (room.questionTimer) {
        clearTimeout(room.questionTimer);
    }
    if (room.countdownTimer) {
        clearInterval(room.countdownTimer);
    }
    
    // カウントダウンタイマー開始
    room.countdownTimer = setInterval(() => {
        room.timeLeft--;
        
        // 残り時間を全員に送信
        broadcastToRoom(room.id, {
            type: 'timerUpdate',
            timeLeft: room.timeLeft
        });
        
        if (room.timeLeft <= 0) {
            clearInterval(room.countdownTimer);
            console.log(`問題${room.currentQuestion + 1}の時間切れ - ルーム${room.id}`);
            endQuestion(room);
        }
    }, 1000);
    
    // 20秒後のフェイルセーフ
    room.questionTimer = setTimeout(() => {
        if (room.gameState === 'playing' && room.timeLeft > 0) {
            console.log(`問題${room.currentQuestion + 1}のフェイルセーフ発動 - ルーム${room.id}`);
            endQuestion(room);
        }
    }, 20000);
}

// 回答処理
function handleSelectAnswer(ws, data) {
    console.log('回答受信:', data);
    
    const room = rooms.get(data.roomId);
    if (!room || room.gameState !== 'playing') {
        console.log('回答処理失敗: ルームまたはゲーム状態が無効');
        return;
    }
    
    const player = players.get(data.playerId);
    if (!player) {
        console.log('回答処理失敗: プレイヤーが見つかりません');
        return;
    }
    
    // 重複回答チェック
    if (room.answers.some(answer => answer.playerId === data.playerId)) {
        console.log('重複回答をブロック:', player.name);
        return;
    }
    
    const question = room.questions[room.currentQuestion];
    const isCorrect = data.answerIndex === question.correct;
    
    const answerData = {
        playerId: data.playerId,
        playerName: player.name,
        answerIndex: data.answerIndex,
        correct: isCorrect,
        timeLeft: room.timeLeft, // サーバーサイドの時間を使用
        timestamp: Date.now()
    };
    
    room.answers.push(answerData);
    
    // ポイント計算（正解者のみ）
    let points = 0;
    if (isCorrect) {
        const correctAnswersCount = room.answers.filter(a => a.correct).length;
        switch (correctAnswersCount) {
            case 1: points = 100; break;
            case 2: points = 80; break;
            case 3: points = 60; break;
            default: points = 40; break;
        }
        room.scores[data.playerId] += points;
    }
    
    console.log(`${player.name}が回答: ${isCorrect ? '正解' : '不正解'} (+${points}pt)`);
    
    // 回答受信を全員に通知
    broadcastToRoom(room.id, {
        type: 'answerReceived',
        playerId: data.playerId,
        playerName: player.name,
        answerIndex: data.answerIndex,
        timeLeft: room.timeLeft,
        answerOrder: room.answers.length
    });
    
    // 全員が回答したら問題終了
    if (room.answers.length >= room.players.length) {
        console.log('全員回答完了 - 問題終了');
        if (room.questionTimer) {
            clearTimeout(room.questionTimer);
        }
        if (room.countdownTimer) {
            clearInterval(room.countdownTimer);
        }
        setTimeout(() => {
            endQuestion(room);
        }, 1000);
    }
}

// 問題終了処理
function endQuestion(room) {
    console.log(`問題${room.currentQuestion + 1}終了 - ルーム${room.id}`);
    
    // タイマーをクリア
    if (room.countdownTimer) {
        clearInterval(room.countdownTimer);
        room.countdownTimer = null;
    }
    if (room.questionTimer) {
        clearTimeout(room.questionTimer);
        room.questionTimer = null;
    }
    
    const question = room.questions[room.currentQuestion];
    
    // 結果をポイント付きで送信
    const results = room.answers.map(answer => {
        let points = 0;
        if (answer.correct) {
            const correctOrder = room.answers
                .filter(a => a.correct && a.timestamp <= answer.timestamp)
                .length;
            switch (correctOrder) {
                case 1: points = 100; break;
                case 2: points = 80; break;
                case 3: points = 60; break;
                default: points = 40; break;
            }
        }
        
        return {
            playerId: answer.playerId,
            playerName: answer.playerName,
            answer: answer.answerIndex,
            correct: answer.correct,
            timeLeft: answer.timeLeft,
            points: points
        };
    });
    
    broadcastToRoom(room.id, {
        type: 'questionEnd',
        question: question,
        results: results
    });
    
    // 3秒後に次の問題へ
    setTimeout(() => {
        nextQuestion(room);
    }, 3000);
}

// 次の問題
function nextQuestion(room) {
    room.currentQuestion++;
    console.log(`次の問題へ: ${room.currentQuestion + 1}/${room.questions.length}`);
    
    if (room.currentQuestion >= room.questions.length) {
        endGame(room);
    } else {
        // 次の問題通知
        broadcastToRoom(room.id, {
            type: 'nextQuestion',
            questionNumber: room.currentQuestion + 1
        });
        
        setTimeout(() => {
            sendQuestion(room);
        }, 1000);
    }
}

// ゲーム終了
function endGame(room) {
    console.log(`ゲーム終了 - ルーム${room.id}`);
    
    room.gameState = 'finished';
    
    if (room.questionTimer) {
        clearTimeout(room.questionTimer);
    }
    
    const finalScores = Object.entries(room.scores)
        .map(([playerId, score]) => ({
            playerId,
            playerName: players.get(playerId)?.name || 'Unknown',
            score
        }))
        .sort((a, b) => b.score - a.score);
    
    console.log('最終スコア:', finalScores);
    
    broadcastToRoom(room.id, {
        type: 'gameEnd',
        finalScores: finalScores
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
    
    console.log(`プレイヤー切断: ${disconnectedPlayer.name}`);
    
    for (const [roomId, room] of rooms.entries()) {
        const playerIndex = room.players.findIndex(p => p.id === disconnectedPlayer.id);
        if (playerIndex !== -1) {
            room.players.splice(playerIndex, 1);
            delete room.scores[disconnectedPlayer.id];
            
            if (room.players.length === 0) {
                if (room.questionTimer) {
                    clearTimeout(room.questionTimer);
                }
                if (room.countdownTimer) {
                    clearInterval(room.countdownTimer);
                }
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
                        ready: p.ready,
                        isHost: p.id === room.host
                    }))
                });
                
                // ホストが切断した場合は新しいホストを選出
                if (room.host === disconnectedPlayer.id && room.players.length > 0) {
                    room.host = room.players[0].id;
                    room.players[0].isHost = true;
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
    
    console.log(`プレイヤー退出: ${player.name}`);
    
    for (const [roomId, room] of rooms.entries()) {
        const playerIndex = room.players.findIndex(p => p.id === data.playerId);
        if (playerIndex !== -1) {
            room.players.splice(playerIndex, 1);
            delete room.scores[data.playerId];
            
            if (room.players.length === 0) {
                if (room.questionTimer) {
                    clearTimeout(room.questionTimer);
                }
                if (room.countdownTimer) {
                    clearInterval(room.countdownTimer);
                }
                rooms.delete(roomId);
                console.log(`ルーム削除: ${roomId}`);
            } else {
                broadcastToRoom(roomId, {
                    type: 'playerLeft',
                    playerId: data.playerId,
                    playerName: player.name,
                    players: room.players.map(p => ({
                        id: p.id,
                        name: p.name,
                        ready: p.ready,
                        isHost: p.id === room.host
                    }))
                });
                
                // ホストが退出した場合は新しいホストを選出
                if (room.host === data.playerId && room.players.length > 0) {
                    room.host = room.players[0].id;
                    room.players[0].isHost = true;
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

// グレースフルシャットダウン
process.on('SIGINT', () => {
    console.log('サーバーを終了しています...');
    
    // 全てのタイマーをクリア
    rooms.forEach(room => {
        if (room.questionTimer) {
            clearTimeout(room.questionTimer);
        }
    });
    
    // 全ての接続を閉じる
    wss.clients.forEach(ws => {
        ws.close();
    });
    
    server.close(() => {
        console.log('サーバーが正常に終了しました');
        process.exit(0);
    });
});
