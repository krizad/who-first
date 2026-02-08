export interface Player {
  id: string;
  name: string;
}

export interface Press {
  playerName: string;
  playerId: string;
  pressTimeMs: number;
  rank: number;
}

export interface Room {
  code: string;
  hostId: string;
  hasWinner: boolean;
  currentWinner: string | null;
  winners: string[];
  players: Player[];
  readyPlayers: Set<string>;
  requireReady: boolean;
  countdownSeconds: number;
  isCountingDown: boolean;
  countdownEndTime: number | null;
  countdownTimer: NodeJS.Timeout | null;
  roundStartTime: number | null;
  presses: Press[];
}

export interface RoomState {
  code: string;
  hostId: string;
  hasWinner: boolean;
  currentWinner: string | null;
  winners: string[];
  players: string[];
  readyPlayers: string[];
  allReady: boolean;
  requireReady: boolean;
  countdownSeconds: number;
  isCountingDown: boolean;
  countdownEndTime: number | null;
}
