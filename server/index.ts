import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { RoomManager } from './RoomManager.js';
import { getRoomState } from './utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

const roomManager = new RoomManager();

io.on('connection', (socket: Socket) => {
  console.log(`⚡ connected: ${socket.id}`);
  let myRoom: string | null = null;
  let myName: string | null = null;

  // ── Create a new room (become host) ──
  socket.on('create_room', () => {
    const room = roomManager.createRoom(socket.id);
    const code = room.code;
    const name = room.players[0].name;

    myRoom = code;
    myName = name;
    socket.join(code);
    socket.emit('room_created', { code, name });
    io.to(code).emit('state', getRoomState(room));
    console.log(`🏠 room ${code} created by ${name}`);
  });

  // ── Join an existing room ──
  socket.on('join_room', ({ code }: { code: string }) => {
    const result = roomManager.joinRoom(code, socket.id);
    if (result.error || !result.room) {
      return socket.emit('error_msg', { message: result.error || 'Room not found' });
    }

    const { room, playerJoined } = result;
    const name = playerJoined!.name; // ! is safe because if no error, playerJoined is present

    myRoom = room.code; // Use normalized code from room object
    myName = name;
    socket.join(myRoom);

    // If player was already in, just send joined_room (client handles this)
    
    socket.emit('joined_room', { name });
    io.to(myRoom).emit('state', getRoomState(room));
    console.log(`👤 ${name} joined room ${myRoom}`);
  });

  // ── Leave room ──
  socket.on('leave_room', () => {
    if (!myRoom) return;
    
    const { room, isHostLeft, newHostId } = roomManager.leaveRoom(myRoom, socket.id);
    
    socket.leave(myRoom);

    if (room && isHostLeft && newHostId) {
       io.to(myRoom).emit('state', getRoomState(room));
       // Find new host name for logging?
       const newHost = room.players.find(p => p.id === newHostId);
       console.log(`👑 new host in ${myRoom}: ${newHost?.name}`);
    } else if (room) {
       io.to(myRoom).emit('state', getRoomState(room));
    } else {
       console.log(`🗑️ room ${myRoom} deleted (empty)`);
    }

    console.log(`🚪 ${myName} left room ${myRoom}`);
    myRoom = null;
    myName = null;
  });

  // ── Change name ──
  socket.on('change_name', ({ newName }: { newName: string }) => {
    if (!myRoom || !myName) return;

    // We need to implement changeName in RoomManager to handle checking uniqueness etc.
    // Use the one we added to RoomManager
    // Note: The previous implementation had logic inside the handler.
    // We should implement specific method in RoomManager for this.

    // BUT wait, I see I missed adding changeName to RoomManager in the plan?
    // Checking RoomManager.ts content again... 
    // Yes, added changeName in previous step, good.

    const result = roomManager.changeName(myRoom, socket.id, newName);
    
    if (result.error) {
        return socket.emit('error_msg', { message: result.error });
    }
    
    if (!result.room) return;

    const oldName = myName;
    myName = newName.trim(); 
    
    socket.emit('name_changed', { name: myName });
    io.to(myRoom).emit('state', getRoomState(result.room));
    console.log(`✏️ ${oldName} changed name to ${myName} in room ${myRoom}`);
  });

  // ── Player presses the buzzer ──
  socket.on('press', () => {
    if (!myRoom || !myName) return;
    
    // We need logic to handle "ready" status vs actual press
    // The previous code handled both in one handler.
    // RoomManager.recordPress should handle both or we need separate method?
    // In RoomManager.ts I implemented recordPress to handle ready check separately?
    // Let's check RoomManager.ts content from previous step...
    // "Handle ready check... if room.requireReady... room.readyPlayers.add..."
    // So recordPress handles it.

    const { room, pressRecorded } = roomManager.recordPress(myRoom, socket.id);
    
    if (!room) return;

    // If it was just a ready check update, we need to emit state
    if (room.requireReady && !room.roundStartTime && !room.isCountingDown && !room.hasWinner) {
         io.to(myRoom).emit('state', getRoomState(room));
         return;
    }

    if (pressRecorded) {
        io.to(myRoom).emit('press_recorded', {
            presses: room.presses,
        });
        
        // Auto-end round if all players have pressed
        if (room.presses.length === room.players.length) {
            room.hasWinner = true;
            room.roundStartTime = null;
            if (room.currentWinner) {
                room.winners.push(room.currentWinner);
            }
            
            io.to(myRoom).emit('round_ended', {
                winner: room.currentWinner,
                winners: room.winners,
                presses: room.presses,
            });
            io.to(myRoom).emit('state', getRoomState(room));
            console.log(`🏁 round auto-ended in ${myRoom} - all players pressed - winner: ${room.currentWinner}`);
        }
    }
  });

  // ── Host resets the round (starts countdown) or ends an active round ──
  socket.on('reset', () => {
    if (!myRoom) return;
    
    // Reset/End round logic
    const { room, action, countdownSeconds } = roomManager.resetRound(myRoom, socket.id);
    
    if (!room) return;

    if (action === 'ended') {
        io.to(myRoom).emit('round_ended', {
            winner: room.currentWinner,
            winners: room.winners,
            presses: room.presses,
        });
        io.to(myRoom).emit('state', getRoomState(room));
        console.log(`🏁 round ended in ${myRoom} - winner: ${room.currentWinner}`);
    } else if (action === 'reset') {
        io.to(myRoom).emit('state', getRoomState(room));
        io.to(myRoom).emit('countdown_start', {
            countdownSeconds: countdownSeconds!,
            serverTime: Date.now(),
        });
        
        // Timer logic needs to be here or inside RoomManager?
        // RoomManager has state but timer is side effect.
        // In previous implementation:
        // isCountingDown = true ... setTimeout ...
        // RoomManager.resetRound sets isCountingDown=true and countdownEndTime.
        // But the ACTUAL timer needs to run.
        // Since RoomManager is just state, we should probably run the timer here using a callback or similar?
        // Or RoomManager could have a method "startCountdown" that takes a callback?
        // For now let's keep the timer logic here but update RoomManager state inside timer.

        // Wait, RoomManager.ts I created has no timer logic?
        // Let's check RoomManager.ts again.
        // It has `countdownTimer: NodeJS.Timeout | null;` in Room interface.
        // But `resetRound` just sets state.
        
        // We need to manage the timer here in index.ts to have access to io.
        
        if (room.countdownTimer) clearTimeout(room.countdownTimer);
        
        // We need to update the room object in map (RoomManager does references so it should be fine)
        room.countdownTimer = setTimeout(() => {
            // We need to update state again when timer ends
            room.isCountingDown = false;
            room.countdownEndTime = null;
            room.roundStartTime = Date.now();
            io.to(myRoom!).emit('countdown_end', { roundStartTime: room.roundStartTime });
            io.to(myRoom!).emit('state', getRoomState(room));
        }, (countdownSeconds! * 1000) + 100);

        console.log(`🔄 round reset in ${myRoom} with ${countdownSeconds}s countdown`);
    }
  });

  // ── Host updates countdown duration ──
  socket.on('update_countdown', ({ seconds }: { seconds: number }) => {
    if (!myRoom) return;
    const { room, success } = roomManager.updateCountdown(myRoom, socket.id, seconds);
    if (!room || !success) return;
    
    io.to(myRoom).emit('state', getRoomState(room));
    console.log(`⏱️ room ${myRoom} countdown set to ${room.countdownSeconds}s`);
  });

  // ── Disconnect cleanup ──
  socket.on('disconnect', () => {
    console.log(`🔌 disconnected: ${socket.id}`);
    if (!myRoom) return;

    const { room, isHostLeft, newHostId } = roomManager.leaveRoom(myRoom, socket.id);
    
    if (room && isHostLeft && newHostId) {
        io.to(myRoom).emit('state', getRoomState(room));
        const newHost = room.players.find(p => p.id === newHostId);
        console.log(`👑 new host in ${myRoom}: ${newHost?.name}`);
    } else if (room) {
        io.to(myRoom).emit('state', getRoomState(room));
    } else {
        console.log(`🗑️ room ${myRoom} deleted (empty)`);
    }
  });
});

// Serve built client in production
app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (_req: express.Request, res: express.Response) =>
  res.sendFile(path.join(__dirname, '../client/dist/index.html'))
);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));

