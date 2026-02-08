import crypto from 'crypto';
import { Room, RoomState } from './types.js';

export function generateCode(): string {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

export function generatePlayerName(room: Room, isHost: boolean): string {
  if (isHost) return 'Host';

  let playerNum = 1;
  const existingNames = room.players.map((p) => p.name);

  while (existingNames.includes(`Player${playerNum}`)) {
    playerNum++;
  }

  return `Player${playerNum}`;
}

export function getRoomState(room: Room): RoomState {
  const readyIds = room.readyPlayers;
  const readyNames = room.players.filter((p) => readyIds.has(p.id)).map((p) => p.name);
  const allReady = room.players.length > 0 && readyIds.size === room.players.length;
  return {
    code: room.code,
    hostId: room.hostId,
    hasWinner: room.hasWinner,
    currentWinner: room.currentWinner,
    winners: room.winners,
    players: room.players.map((p) => p.name),
    readyPlayers: readyNames,
    allReady,
    requireReady: room.requireReady,
    countdownSeconds: room.countdownSeconds || 3,
    isCountingDown: room.isCountingDown || false,
    countdownEndTime: room.countdownEndTime || null,
  };
}
