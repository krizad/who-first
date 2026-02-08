import { Room, RoomState, Press } from './types.js';
import { generateCode, generatePlayerName, getRoomState } from './utils.js';

export class RoomManager {
  private rooms: Map<string, Room>;

  constructor() {
    this.rooms = new Map<string, Room>();
  }

  createRoom(hostId: string): Room {
    const code = generateCode();
    const name = 'Host';
    const room: Room = {
      code,
      hostId,
      hasWinner: false,
      currentWinner: null,
      winners: [],
      players: [{ id: hostId, name }],
      readyPlayers: new Set<string>(),
      requireReady: true,
      countdownSeconds: 3,
      isCountingDown: false,
      countdownEndTime: null,
      countdownTimer: null,
      roundStartTime: null,
      presses: [],
    };
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  joinRoom(code: string, playerId: string): { room: Room | null; error?: string; playerJoined?: { name: string } } {
    const upper = code.toUpperCase();
    const room = this.rooms.get(upper);
    if (!room) return { room: null, error: 'Room not found' };

    const existingPlayer = room.players.find((p) => p.id === playerId);
    if (existingPlayer) {
      return { room, playerJoined: { name: existingPlayer.name } };
    }

    const name = generatePlayerName(room, false);
    room.players.push({ id: playerId, name });
    return { room, playerJoined: { name } };
  }

  leaveRoom(code: string, playerId: string): { room: Room | null; isHostLeft: boolean; oldHostId?: string; newHostId?: string } {
    const room = this.rooms.get(code);
    if (!room) return { room: null, isHostLeft: false };

    room.players = room.players.filter((p) => p.id !== playerId);
    room.readyPlayers.delete(playerId);
    let isHostLeft = false;

    if (room.hostId === playerId) {
      isHostLeft = true;
      if (room.countdownTimer) clearTimeout(room.countdownTimer);
      if (room.players.length > 0) {
        room.hostId = room.players[0].id;
        return { room, isHostLeft, oldHostId: playerId, newHostId: room.hostId };
      } else {
        this.rooms.delete(code);
        return { room: null, isHostLeft, oldHostId: playerId };
      }
    }

    return { room, isHostLeft };
  }

  changeName(code: string, playerId: string, newName: string): { room: Room | null; error?: string; success?: boolean } {
    const room = this.rooms.get(code);
    if (!room) return { room: null };

    const trimmedName = newName.trim();
    if (!trimmedName) return { room, error: 'Name cannot be empty' };

    const nameTaken = room.players.some((p) => p.id !== playerId && p.name === trimmedName);
    if (nameTaken) return { room, error: 'Name already taken' };

    const player = room.players.find((p) => p.id === playerId);
    if (!player) return { room };

    const oldName = player.name;
    player.name = trimmedName;

    if (room.currentWinner === oldName) {
      room.currentWinner = trimmedName;
    }
    room.winners = room.winners.map((w) => (w === oldName ? trimmedName : w));
    room.presses = room.presses.map((p) => (p.playerId === playerId ? { ...p, playerName: trimmedName } : p));

    return { room, success: true };
  }

  recordPress(code: string, playerId: string): { room: Room | null; pressRecorded: boolean; isFirstPress: boolean } {
    const room = this.rooms.get(code);
    if (!room) return { room: null, pressRecorded: false, isFirstPress: false };

    // Handle ready check
    if (room.requireReady && !room.roundStartTime && !room.isCountingDown && !room.hasWinner) {
      if (!room.readyPlayers.has(playerId)) {
        room.readyPlayers.add(playerId);
        return { room, pressRecorded: false, isFirstPress: false };
      }
      return { room, pressRecorded: false, isFirstPress: false };
    }

    if (!room.roundStartTime) return { room, pressRecorded: false, isFirstPress: false };

    const alreadyPressed = room.presses.some((p) => p.playerId === playerId);
    if (alreadyPressed) return { room, pressRecorded: false, isFirstPress: false };

    const player = room.players.find((p) => p.id === playerId);
    if (!player) return { room, pressRecorded: false, isFirstPress: false };

    const pressTimeMs = Date.now() - room.roundStartTime;
    const newPress: Press = {
      playerName: player.name,
      playerId,
      pressTimeMs,
      rank: room.presses.length + 1,
    };
    room.presses.push(newPress);

    const isFirstPress = room.presses.length === 1;
    if (isFirstPress) {
      room.currentWinner = player.name;
    }

    return { room, pressRecorded: true, isFirstPress };
  }

  resetRound(code: string, hostId: string): { room: Room | null; action: 'ended' | 'reset' | 'none'; countdownSeconds?: number } {
    const room = this.rooms.get(code);
    if (!room || room.hostId !== hostId) return { room: null, action: 'none' };

    if (room.roundStartTime && !room.isCountingDown && !room.hasWinner) {
      room.hasWinner = true;
      room.roundStartTime = null;
      if (room.currentWinner) {
        room.winners.push(room.currentWinner);
      }
      return { room, action: 'ended' };
    }

    if (room.requireReady) {
      const readyCount = room.readyPlayers.size;
      if (readyCount < 2) return { room, action: 'none' };
      room.requireReady = false;
    }

    room.hasWinner = false;
    room.currentWinner = null;
    room.presses = [];
    room.isCountingDown = true;
    room.countdownSeconds = room.countdownSeconds || 3;
    room.countdownEndTime = Date.now() + room.countdownSeconds * 1000;

    return { room, action: 'reset', countdownSeconds: room.countdownSeconds };
  }

  updateCountdown(code: string, hostId: string, seconds: number): { room: Room | null; success: boolean } {
    const room = this.rooms.get(code);
    if (!room || room.hostId !== hostId) return { room: null, success: false };

    const validSeconds = Math.max(1, Math.min(10, Number.parseInt(String(seconds)) || 3));
    room.countdownSeconds = validSeconds;
    return { room, success: true };
  }

  getRoomState(code: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    return getRoomState(room);
  }
}
