import { RoomManager } from './RoomManager.js';

describe('RoomManager', () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    roomManager = new RoomManager();
  });

  test('should create a room', () => {
    const room = roomManager.createRoom('host-id');
    expect(room).toBeDefined();
    expect(room.hostId).toBe('host-id');
    expect(room.code).toHaveLength(6);
    expect(room.players).toHaveLength(1);
    expect(room.players[0].name).toBe('Host');
  });

  test('should allow a player to join', () => {
    const room = roomManager.createRoom('host-id');
    const { room: joinedRoom, playerJoined } = roomManager.joinRoom(room.code, 'player-id');
    
    expect(joinedRoom).toBeDefined();
    expect(joinedRoom?.players).toHaveLength(2);
    expect(playerJoined?.name).toBe('Player1');
  });

  test('should not allow joining a non-existent room', () => {
    const { room, error } = roomManager.joinRoom('invalid-code', 'player-id');
    expect(room).toBeNull();
    expect(error).toBe('Room not found');
  });

  test('should handle existing player joining again', () => {
    const room = roomManager.createRoom('host-id');
    roomManager.joinRoom(room.code, 'player-id');
    const { room: joinedRoom, playerJoined } = roomManager.joinRoom(room.code, 'player-id');

    expect(joinedRoom?.players).toHaveLength(2); // Still 2
    expect(playerJoined?.name).toBe('Player1');
  });

  test('should change player name', () => {
    const room = roomManager.createRoom('host-id');
    roomManager.joinRoom(room.code, 'player-id');
    
    const { success, room: updatedRoom } = roomManager.changeName(room.code, 'player-id', 'NewName');
    
    expect(success).toBe(true);
    expect(updatedRoom?.players.find((p) => p.id === 'player-id')?.name).toBe('NewName');
  });

  test('should preventing changing name to existing name', () => {
    const room = roomManager.createRoom('host-id');
    roomManager.joinRoom(room.code, 'player-id');
    
    const { error } = roomManager.changeName(room.code, 'player-id', 'Host');
    expect(error).toBe('Name already taken');
  });

  test('should record press when round is active', () => {
    const room = roomManager.createRoom('host-id');
    roomManager.joinRoom(room.code, 'player-id');
    
    // Start round manually for test (or use resetRound logic if exposed)
    const r = roomManager.getRoom(room.code)!;
    r.roundStartTime = Date.now() - 1000;
    r.requireReady = false; 

    const { pressRecorded, isFirstPress } = roomManager.recordPress(room.code, 'player-id');
    
    expect(pressRecorded).toBe(true);
    expect(isFirstPress).toBe(true);
    expect(roomManager.getRoom(room.code)?.currentWinner).toBe('Player1');
  });

  test('should not record press if round not started', () => {
    const room = roomManager.createRoom('host-id');
    roomManager.joinRoom(room.code, 'player-id');
    
    const { pressRecorded } = roomManager.recordPress(room.code, 'player-id');
    expect(pressRecorded).toBe(false);
  });

  test('should reset round correctly', () => {
    const room = roomManager.createRoom('host-id');
    const { action } = roomManager.resetRound(room.code, 'host-id'); // Removed unused countdownSeconds
    
    // Need 2 players for ready check if requireReady is true (default)
    expect(action).toBe('none'); // Expect 'none' because readyPlayers < 2

    roomManager.joinRoom(room.code, 'player-id');
    
    // Let's optimize test: force requireReady false? Or satisfy it.
    const r = roomManager.getRoom(room.code)!;
    r.readyPlayers.add('host-id');
    r.readyPlayers.add('player-id');
    
    const result = roomManager.resetRound(room.code, 'host-id');
    expect(result.action).toBe('reset');
    expect(result.countdownSeconds).toBe(3);
    
    const updatedRoom = roomManager.getRoom(room.code);
    expect(updatedRoom?.isCountingDown).toBe(true);
    expect(updatedRoom?.requireReady).toBe(false);
  });
});
