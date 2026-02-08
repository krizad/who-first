import { useState, useEffect, useCallback, useRef } from 'react';
import { socket } from './socket';

const STATUS = { READY: 'ready', WON: 'won', LOST: 'lost' } as const;
type StatusType = (typeof STATUS)[keyof typeof STATUS];

interface Press {
  playerName: string;
  playerId: string;
  pressTimeMs: number;
  rank: number;
}

interface RoomState {
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

export default function App() {
  const [name, setName] = useState<string>('');
  const [tempName, setTempName] = useState<string>(''); // For editing name
  const [editingName, setEditingName] = useState<boolean>(false);
  const [roomCode, setRoomCode] = useState<string>('');
  const [screen, setScreen] = useState<'lobby' | 'buzzer'>('lobby');
  const [isHost, setIsHost] = useState<boolean>(false);
  const [code, setCode] = useState<string>('');
  const [players, setPlayers] = useState<string[]>([]);
  const [status, setStatus] = useState<StatusType>(STATUS.READY);
  const [winner, setWinner] = useState<string | null>(null);
  const [winners, setWinners] = useState<string[]>([]);
  const [error, setError] = useState<string>('');
  const [countdownSeconds, setCountdownSeconds] = useState<number>(3);
  const [readyPlayers, setReadyPlayers] = useState<string[]>([]);
  const [requireReady, setRequireReady] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [tempCountdown, setTempCountdown] = useState<number>(3);
  const [copied, setCopied] = useState<boolean>(false);
  const [countdownDisplay, setCountdownDisplay] = useState<number | null>(null);
  const [isCountingDown, setIsCountingDown] = useState<boolean>(false);
  const [presses, setPresses] = useState<Press[]>([]);
  const [roundActive, setRoundActive] = useState<boolean>(false);
  const [hasPressed, setHasPressed] = useState<boolean>(false);
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [showNameChangePrompt, setShowNameChangePrompt] = useState<boolean>(false);
  const hasAutoJoined = useRef<boolean>(false);

  // ── Initialize from URL params and auto-join ──
  useEffect(() => {
    // Prevent double joining in React Strict Mode
    if (hasAutoJoined.current) return;

    const params = new URLSearchParams(globalThis.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      hasAutoJoined.current = true;
      const upperCode = roomParam.toUpperCase();
      setTimeout(() => {
        setRoomCode(upperCode);
        socket.emit('join_room', { code: upperCode });
      }, 0);
    }
  }, []);

  // ── Socket listeners ──
  useEffect(() => {
    const handleRoomCreated = ({ code: c, name: n }: { code: string; name: string }) => {
      setCode(c);
      setName(n);
      setIsHost(true);
      setScreen('buzzer');
      setShowNameChangePrompt(true);
    };

    const handleJoinedRoom = ({ name: n }: { name: string }) => {
      setName(n);
      setScreen('buzzer');
      setIsJoining(false);
      setShowNameChangePrompt(true);
    };

    const handleNameChanged = ({ name: n }: { name: string }) => {
      setName(n);
      setEditingName(false);
    };

    const handleState = (roomState: RoomState) => {
      const {
        code: c,
        hostId,
        hasWinner,
        currentWinner,
        winners: w,
        players: p,
        countdownSeconds: cs,
        isCountingDown: icd,
        readyPlayers: rp,
        requireReady: rr,
      } = roomState;
      if (c) setCode(c);
      setPlayers(p);
      setWinners(w);
      setCountdownSeconds(cs || 3);
      setTempCountdown(cs || 3);
      setIsHost(socket.id === hostId);
      setIsCountingDown(icd || false);
      setReadyPlayers(rp || []);
      setRequireReady(Boolean(rr));
      if (screen === 'lobby' && c) setScreen('buzzer');
      if (hasWinner) {
        setWinner(currentWinner);
        setStatus(currentWinner === name ? STATUS.WON : STATUS.LOST);
      } else {
        setStatus(STATUS.READY);
        setWinner(null);
      }
    };

    const handleCountdownStart = ({
      countdownSeconds: cs,
      serverTime,
    }: {
      countdownSeconds: number;
      serverTime: number;
    }) => {
      setIsCountingDown(true);
      setCountdownDisplay(cs);

      const countdownStartTime = serverTime;
      const countdownInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - countdownStartTime) / 1000);
        const remaining = Math.max(0, cs - elapsed);
        setCountdownDisplay(remaining);

        if (remaining === 0) {
          clearInterval(countdownInterval);
        }
      }, 100);
    };

    const handleCountdownEnd = () => {
      setIsCountingDown(false);
      setCountdownDisplay(null);
      setPresses([]);
      setStatus(STATUS.READY);
      setWinner(null);
      setRoundActive(true);
      setHasPressed(false);
    };

    const handlePressRecorded = ({ presses: pressList }: { presses: Press[] }) => {
      setPresses(pressList);
      // Check if current player has pressed in this round
      const currentPlayerPressed = pressList.some(p => p.playerName === name);
      setHasPressed(currentPlayerPressed);
    };

    const handleRoundEnded = ({
      winner: w,
      winners: wList,
      presses: pressList,
    }: {
      winner: string;
      winners: string[];
      presses: Press[];
    }) => {
      setWinner(w);
      setWinners(wList);
      setPresses(pressList || []);
      setStatus(w === name ? STATUS.WON : STATUS.LOST);
      setRoundActive(false);
      setHasPressed(false);
    };

    const handleErrorMsg = ({ message }: { message: string }) => {
      setError(message);
      setIsJoining(false);
      setTimeout(() => setError(''), 3000);
    };

    socket.on('room_created', handleRoomCreated);
    socket.on('joined_room', handleJoinedRoom);
    socket.on('name_changed', handleNameChanged);
    socket.on('state', handleState);
    socket.on('countdown_start', handleCountdownStart);
    socket.on('countdown_end', handleCountdownEnd);
    socket.on('press_recorded', handlePressRecorded);
    socket.on('round_ended', handleRoundEnded);
    socket.on('error_msg', handleErrorMsg);

    return () => {
      socket.off('room_created', handleRoomCreated);
      socket.off('joined_room', handleJoinedRoom);
      socket.off('name_changed', handleNameChanged);
      socket.off('state', handleState);
      socket.off('countdown_start', handleCountdownStart);
      socket.off('countdown_end', handleCountdownEnd);
      socket.off('press_recorded', handlePressRecorded);
      socket.off('round_ended', handleRoundEnded);
      socket.off('error_msg', handleErrorMsg);
    };
  }, [name, screen]);

  const createRoom = useCallback(() => {
    socket.emit('create_room');
  }, []);

  const joinRoom = useCallback(() => {
    if (!roomCode.trim()) return;
    setIsJoining(true);
    socket.emit('join_room', { code: roomCode.trim() });
  }, [roomCode]);

  const leaveRoom = useCallback(() => {
    socket.emit('leave_room');
    setScreen('lobby');
    setCode('');
    setName('');
    setPlayers([]);
    setWinners([]);
    setStatus(STATUS.READY);
    setWinner(null);
    setPresses([]);
    setRoundActive(false);
    setIsCountingDown(false);
    setRoomCode('');
  }, []);

  const changeName = useCallback(() => {
    if (!tempName.trim()) {
      setError('Name cannot be empty');
      setTimeout(() => setError(''), 3000);
      return;
    }
    socket.emit('change_name', { newName: tempName.trim() });
  }, [tempName]);

  const press = useCallback(() => {
    if (isCountingDown) return; // Can't press during countdown

    // Allow pressing to mark as ready (even when round is not active)
    if (!roundActive && requireReady && !readyPlayers.includes(name)) {
      socket.emit('press'); // Tell server we're ready
      return;
    }

    if (!roundActive) return; // Round not active and not in ready mode
    if (hasPressed) return; // Already pressed in this round
    socket.emit('press');
  }, [isCountingDown, roundActive, hasPressed, requireReady, readyPlayers, name]);

  const reset = useCallback(() => socket.emit('reset'), []);

  const updateCountdown = useCallback(() => {
    socket.emit('update_countdown', { seconds: tempCountdown });
    setShowSettings(false);
  }, [tempCountdown]);

  const copyRoomLink = useCallback(() => {
    const link = `${globalThis.location.origin}?room=${code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  // ── Lobby screen ──
  if (screen === 'lobby') {
    // Show joining state when auto-joining from URL
    if (isJoining) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
          <div className="w-full max-w-sm space-y-6 text-center">
            <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-red-500 to-orange-400 bg-clip-text text-transparent">
              WhoFirst
            </h1>
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-400 text-sm">Joining room {roomCode}...</p>
            </div>
            {error && (
              <div className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-2 text-sm text-red-300">
                {error}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-red-500 to-orange-400 bg-clip-text text-transparent">
            WhoFirst
          </h1>
          <p className="text-gray-400 text-sm">Create or join a room instantly</p>

          {error && (
            <div className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            onClick={createRoom}
            className="w-full rounded-xl bg-red-600 hover:bg-red-500 py-3 text-lg font-semibold transition-colors"
          >
            Create Room
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-800" />
            <span className="text-xs text-gray-600 uppercase tracking-widest">or</span>
            <div className="h-px flex-1 bg-gray-800" />
          </div>

          <div className="flex gap-2">
            <input
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && joinRoom()}
              placeholder="Room code"
              maxLength={6}
              className="flex-1 rounded-xl bg-gray-800 border border-gray-700 px-4 py-3 text-center text-lg font-mono tracking-widest text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <button
              disabled={!roomCode.trim() || isJoining}
              onClick={joinRoom}
              className="rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed px-6 py-3 text-lg font-semibold transition-colors"
            >
              {isJoining ? 'Joining...' : 'Join'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            💡 You&apos;ll get a default name (Host, Player1, Player2...) and can change it anytime!
          </p>
        </div>
      </div>
    );
  }

  // ── Buzzer screen ──
  let btnColor: string;
  let btnLabel: string;
  let btnDisabled: boolean;

  if (isCountingDown) {
    // During countdown
    btnColor = 'from-gray-700 to-gray-600 shadow-gray-700/40';
    btnLabel = `${countdownDisplay}`;
    btnDisabled = true;
  } else if (roundActive) {
    // During active round
    if (hasPressed) {
      // Already pressed in this round
      btnColor = 'from-emerald-600 to-emerald-500 shadow-emerald-600/40';
      btnLabel = 'You pressed';
      btnDisabled = true;
    } else {
      // Can still press
      btnColor = 'from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 shadow-red-600/40';
      btnLabel = 'BUZZ!';
      btnDisabled = false;
    }
  } else if (status === STATUS.WON) {
    // Won the round
    btnColor = 'from-emerald-600 to-emerald-500 shadow-emerald-600/40';
    btnLabel = '🎉 YOU WON!';
    btnDisabled = true;
  } else if (status === STATUS.LOST) {
    // Lost the round
    btnColor = 'from-gray-700 to-gray-600 shadow-gray-700/40';
    btnLabel = `${winner} was first`;
    btnDisabled = true;
  } else {
    // Ready state / before countdown
    if (requireReady) {
      if (readyPlayers.includes(name)) {
        // Already ready - show as confirmed (green)
        btnColor = 'from-emerald-600 to-emerald-500 shadow-emerald-600/40';
        btnLabel = 'READY';
        btnDisabled = true;
      } else {
        // Not ready yet - clickable button (gray)
        btnColor =
          'from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 shadow-gray-700/40';
        btnLabel = "I'M READY";
        btnDisabled = false;
      }
    } else {
      // No ready requirement - just waiting
      btnColor = 'from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 shadow-red-600/40';
      btnLabel = 'Waiting…';
      btnDisabled = true;
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-gray-950 px-4 py-8">
      {/* Header */}
      <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-red-500 to-orange-400 bg-clip-text text-transparent mb-1">
        WhoFirst
      </h1>

      {/* Room info bar */}
      <div className="flex items-center gap-3 mb-2">
        <span className="rounded-md bg-gray-800 px-3 py-1 font-mono text-sm tracking-widest text-orange-400">
          {code}
        </span>
        <button
          onClick={copyRoomLink}
          className="rounded-md bg-gray-800 hover:bg-gray-700 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
          title="Copy room link"
        >
          {copied ? '✓ Copied' : '📋 Copy Link'}
        </button>
        {isHost && (
          <button
            onClick={() => {
              setTempCountdown(countdownSeconds);
              setShowSettings(true);
            }}
            className="rounded-md bg-gray-800 hover:bg-gray-700 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
            title="Host settings"
          >
            ⚙️ Settings
          </button>
        )}
        <button
          onClick={leaveRoom}
          className="rounded-md bg-gray-800 hover:bg-red-700 px-2 py-1 text-xs text-gray-400 hover:text-red-300 transition-colors"
          title="Leave room"
        >
          🚪 Leave
        </button>
        {isHost && (
          <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-400">
            Host
          </span>
        )}
      </div>

      {/* Player Name - Editable */}
      <div className="mb-1">
        {editingName ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={tempName}
              onChange={e => setTempName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') changeName();
                if (e.key === 'Escape') setEditingName(false);
              }}
              placeholder="New name"
              className="rounded-md bg-gray-800 border border-gray-700 px-3 py-1 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <button
              onClick={changeName}
              className="rounded-md bg-emerald-600 hover:bg-emerald-500 px-2 py-1 text-xs text-white transition-colors"
            >
              ✓ Save
            </button>
            <button
              onClick={() => setEditingName(false)}
              className="rounded-md bg-gray-700 hover:bg-gray-600 px-2 py-1 text-xs text-gray-300 transition-colors"
            >
              × Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-gray-500 text-sm">
              Playing as <span className="text-white font-medium">{name}</span>
            </p>
            <button
              onClick={() => {
                setTempName(name);
                setEditingName(true);
              }}
              className="rounded-md bg-orange-600 hover:bg-orange-500 px-3 py-1 text-xs text-white font-medium transition-colors"
            >
              ✏️ Rename
            </button>
          </div>
        )}
      </div>

      {/* Players online */}
      <div className="flex flex-wrap justify-center gap-1.5 mb-2">
        {players.map(p => {
          const isReady = readyPlayers.includes(p);
          return (
            <span
              key={p}
              className={`rounded-full px-2.5 py-0.5 text-xs ${
                p === name ? 'bg-red-600/30 text-red-300' : 'bg-gray-800 text-gray-400'
              }`}
            >
              {p}
              {requireReady && (
                <span className={`ml-1 ${isReady ? 'text-emerald-300' : 'text-gray-500'}`}>
                  {isReady ? '✓' : '•'}
                </span>
              )}
            </span>
          );
        })}
      </div>
      {requireReady && (
        <p className="text-xs text-gray-500 mb-6">
          Ready: {readyPlayers.length}/{players.length}
        </p>
      )}

      {isHost && requireReady && (
        <button
          onClick={reset}
          disabled={readyPlayers.length < 2}
          className={`mb-6 rounded-lg px-6 py-2 text-sm font-semibold text-white transition-colors ${
            readyPlayers.length >= 2
              ? 'bg-emerald-600 hover:bg-emerald-500'
              : 'bg-gray-700 cursor-not-allowed opacity-60'
          }`}
        >
          {readyPlayers.length >= 2 ? 'Start Round' : 'Need at least 2 ready players'}
        </button>
      )}

      {/* Big Button */}
      <button
        onClick={press}
        disabled={btnDisabled}
        className={`w-56 h-56 rounded-full bg-gradient-to-b ${btnColor} shadow-lg text-white text-2xl font-bold transition-all duration-200 active:scale-95 disabled:cursor-default select-none flex items-center justify-center`}
      >
        {isCountingDown && typeof countdownDisplay === 'number' ? (
          <span className="text-6xl font-black">{countdownDisplay}</span>
        ) : (
          btnLabel
        )}
      </button>

      {/* Press Times Leaderboard - Only show when round has ended */}
      {presses.length > 0 && !roundActive && (
        <div className="mt-8 w-full max-w-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
            Press Times
          </h2>
          <div className="space-y-2">
            {presses.map((p, idx) => {
              const diffMs = p.pressTimeMs - presses[0].pressTimeMs;
              const diffSecs = (diffMs / 1000).toFixed(2);
              const pressTimeSecs = (p.pressTimeMs / 1000).toFixed(2);

              return (
                <div
                  key={`${p.playerId}-${p.pressTimeMs}`}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 ${
                    idx === 0 ? 'bg-yellow-500/20 border border-yellow-600' : 'bg-gray-900'
                  }`}
                >
                  <span
                    className={`text-lg font-black w-8 text-center ${
                      idx === 0 ? 'text-yellow-400' : 'text-gray-500'
                    }`}
                  >
                    #{idx + 1}
                  </span>
                  <span className="flex-1 text-white font-medium">{p.playerName}</span>
                  <div className="text-right">
                    <span className="text-sm font-mono text-gray-400">{pressTimeSecs}s</span>
                    {idx > 0 && <span className="block text-xs text-gray-500">+{diffSecs}s</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Host-only start/end round */}
      {isHost && !isCountingDown && (
        <>
          {roundActive ? (
            <button
              onClick={reset}
              className="mt-8 rounded-lg bg-red-600 hover:bg-red-500 px-6 py-2 text-sm font-semibold text-white transition-colors"
            >
              ⏹️ End Round
            </button>
          ) : status === STATUS.READY ? null : (
            <button
              onClick={reset}
              disabled={requireReady && readyPlayers.length < 2}
              className="mt-8 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed px-6 py-2 text-sm font-semibold text-white transition-colors"
            >
              {requireReady && readyPlayers.length < 2
                ? 'Need at least 2 ready players'
                : `🎯 Start Round (${countdownSeconds}s)`}
            </button>
          )}
        </>
      )}

      {/* Non-host waiting message */}
      {!isHost && status !== STATUS.READY && (
        <p className="mt-8 text-xs text-gray-600">
          {requireReady && readyPlayers.length < 2
            ? 'Press READY to start…'
            : 'Waiting for host to start next round…'}
        </p>
      )}

      {/* Winner history */}
      {winners.length > 0 && (
        <div className="mt-12 w-full max-w-xs">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
            Round Winners
          </h2>
          <ol className="space-y-1">
            {[...winners].reverse().map((w, i) => (
              <li
                key={`${winners.length - i}-${w}`}
                className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm"
              >
                <span className="text-gray-500 font-mono text-xs">#{winners.length - i}</span>
                <span className="text-white">{w}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold text-white">Host Settings</h2>

            <div>
              <label htmlFor="countdown-slider" className="block text-sm text-gray-400 mb-2">
                Countdown Duration (seconds)
              </label>
              <input
                id="countdown-slider"
                type="range"
                min="1"
                max="10"
                step="1"
                value={tempCountdown}
                onChange={e => setTempCountdown(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-500">1s</span>
                <span className="text-lg font-bold text-orange-400">{tempCountdown}s</span>
                <span className="text-xs text-gray-500">10s</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">Countdown before each round starts</p>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={updateCountdown}
                className="flex-1 rounded-lg bg-orange-600 hover:bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Name Change Prompt Modal */}
      {showNameChangePrompt && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center px-4 z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-sm w-full space-y-4">
            <h2 className="text-xl font-bold text-white">Change Your Name?</h2>
            <p className="text-gray-300 text-sm">
              You were assigned the name <span className="font-semibold text-orange-400">{name}</span>. Would you like to change it?
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowNameChangePrompt(false)}
                className="flex-1 rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
              >
                Keep Name
              </button>
              <button
                onClick={() => {
                  setTempName(name);
                  setEditingName(true);
                  setShowNameChangePrompt(false);
                }}
                className="flex-1 rounded-lg bg-orange-600 hover:bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors"
              >
                Change Name
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
