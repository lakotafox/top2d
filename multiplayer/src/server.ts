import type * as Party from "partykit/server";

interface PlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  direction: string;
  currentMap: string;
  animation: string;
  gameType: 'game2d' | 'tavern3d';
  inTavern?: boolean;
}

interface ServerMessage {
  type: 'join' | 'update' | 'leave' | 'sync' | 'error' | 'welcome';
  player?: PlayerState;
  players?: PlayerState[];
  playerId?: string;
  message?: string;
}

// ============================================
// FARKLE GAME STATE (Server-Authoritative)
// ============================================

type FarklePhase = 'lobby' | 'waiting_for_roll' | 'rolling' | 'selecting' | 'farkled' | 'turn_end';

interface FarklePlayer {
  id: string;
  name: string;
  score: number;      // Banked total
  seat: number;       // 0-3
  connected: boolean;
}

interface FarkleGameState {
  tableId: string;
  phase: FarklePhase;
  players: FarklePlayer[];
  currentPlayerIndex: number;
  dice: number[];           // 6 values (1-6)
  held: boolean[];          // 6 booleans
  turnScore: number;        // Points accumulated this turn
  version: number;          // Increments on each state change
  hostId: string | null;    // First player to join
}

// Farkle scoring rules (pure functions)
function calculateScore(dice: number[]): number {
  const counts = [0, 0, 0, 0, 0, 0, 0]; // counts[1] = count of 1s, etc.
  for (const d of dice) counts[d]++;

  let score = 0;

  // Three of a kind (must check before singles)
  for (let v = 1; v <= 6; v++) {
    if (counts[v] >= 3) {
      if (v === 1) {
        score += 1000; // Three 1s = 1000
      } else {
        score += v * 100; // Three Xs = X*100
      }
      counts[v] -= 3;
    }
  }

  // Singles (1s and 5s only)
  score += counts[1] * 100;
  score += counts[5] * 50;

  return score;
}

function isValidSelection(dice: number[], held: boolean[], newHeld: boolean[]): boolean {
  // Get the newly selected dice (were false, now true)
  const newlySelected: number[] = [];
  for (let i = 0; i < 6; i++) {
    if (!held[i] && newHeld[i]) {
      newlySelected.push(dice[i]);
    }
  }

  if (newlySelected.length === 0) return false;

  // Check if selected dice form valid scoring combinations
  // For MVP: each die must be a 1, 5, or part of a triple
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const d of newlySelected) counts[d]++;

  // Check for triples first
  for (let v = 1; v <= 6; v++) {
    while (counts[v] >= 3) {
      counts[v] -= 3; // Valid triple
    }
  }

  // Remaining dice must be 1s or 5s
  for (let v = 1; v <= 6; v++) {
    if (counts[v] > 0 && v !== 1 && v !== 5) {
      return false; // Invalid: non-scoring die selected
    }
  }

  return true;
}

function isFarkle(dice: number[], held: boolean[]): boolean {
  // Check if any unheld dice can score
  const unheld: number[] = [];
  for (let i = 0; i < 6; i++) {
    if (!held[i]) unheld.push(dice[i]);
  }
  return calculateScore(unheld) === 0;
}

function rollDice(count: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    result.push(Math.floor(Math.random() * 6) + 1);
  }
  return result;
}

const MAX_PLAYERS = 4;

export default class Server implements Party.Server {
  players: Map<string, PlayerState> = new Map();

  // Farkle games keyed by tableId
  farkleGames: Map<string, FarkleGameState> = new Map();

  constructor(readonly room: Party.Room) {}

  // ============================================
  // FARKLE MESSAGE HANDLERS
  // ============================================

  handleFarkleMessage(data: any, sender: Party.Connection): void {
    const tableId = data.tableId;
    if (!tableId) {
      sender.send(JSON.stringify({ type: 'farkle_error', error: 'Missing tableId' }));
      return;
    }

    const playerInfo = this.players.get(sender.id);
    const playerName = playerInfo?.name || `Player${sender.id.slice(0, 4)}`;

    switch (data.farkleAction) {
      case 'join': {
        let game = this.farkleGames.get(tableId);

        if (!game) {
          // Create new game
          game = {
            tableId,
            phase: 'lobby',
            players: [],
            currentPlayerIndex: 0,
            dice: [1, 1, 1, 1, 1, 1],
            held: [false, false, false, false, false, false],
            turnScore: 0,
            version: 0,
            hostId: sender.id
          };
          this.farkleGames.set(tableId, game);
        }

        // Check if already in game
        if (game.players.find(p => p.id === sender.id)) {
          this.broadcastFarkleState(game);
          return;
        }

        // Add player
        if (game.players.length < 4) {
          game.players.push({
            id: sender.id,
            name: playerName,
            score: 0,
            seat: game.players.length,
            connected: true
          });
          game.version++;
          console.log(`[FARKLE] ${playerName} joined table ${tableId}`);
          this.broadcastFarkleState(game);
        }
        break;
      }

      case 'start': {
        const game = this.farkleGames.get(tableId);
        if (!game) return;

        // Only host can start
        if (sender.id !== game.hostId) {
          sender.send(JSON.stringify({ type: 'farkle_error', error: 'Only host can start' }));
          return;
        }

        if (game.players.length < 2) {
          sender.send(JSON.stringify({ type: 'farkle_error', error: 'Need at least 2 players' }));
          return;
        }

        game.phase = 'waiting_for_roll';
        game.currentPlayerIndex = 0;
        game.version++;
        console.log(`[FARKLE] Game started on table ${tableId}`);
        this.broadcastFarkleState(game);
        break;
      }

      case 'roll': {
        const game = this.farkleGames.get(tableId);
        if (!game) return;

        // Validate it's this player's turn
        const currentPlayer = game.players[game.currentPlayerIndex];
        if (!currentPlayer || currentPlayer.id !== sender.id) {
          sender.send(JSON.stringify({ type: 'farkle_error', error: 'Not your turn' }));
          return;
        }

        // Validate phase
        if (game.phase !== 'waiting_for_roll' && game.phase !== 'selecting') {
          sender.send(JSON.stringify({ type: 'farkle_error', error: 'Cannot roll now' }));
          return;
        }

        // Roll unheld dice (or all if first roll)
        const isFirstRoll = game.phase === 'waiting_for_roll';
        if (isFirstRoll) {
          game.dice = rollDice(6);
          game.held = [false, false, false, false, false, false];
        } else {
          // Roll only unheld dice
          for (let i = 0; i < 6; i++) {
            if (!game.held[i]) {
              game.dice[i] = Math.floor(Math.random() * 6) + 1;
            }
          }
        }

        // Check for Farkle
        if (isFarkle(game.dice, game.held)) {
          game.phase = 'farkled';
          game.turnScore = 0;
          game.version++;
          console.log(`[FARKLE] ${currentPlayer.name} farkled!`);
          this.broadcastFarkleState(game);

          // Auto-advance after delay
          setTimeout(() => this.advanceTurn(game), 2000);
        } else {
          game.phase = 'selecting';
          game.version++;
          this.broadcastFarkleState(game);
        }
        break;
      }

      case 'hold': {
        const game = this.farkleGames.get(tableId);
        if (!game) return;

        const currentPlayer = game.players[game.currentPlayerIndex];
        if (!currentPlayer || currentPlayer.id !== sender.id) {
          sender.send(JSON.stringify({ type: 'farkle_error', error: 'Not your turn' }));
          return;
        }

        if (game.phase !== 'selecting') {
          sender.send(JSON.stringify({ type: 'farkle_error', error: 'Cannot hold now' }));
          return;
        }

        const newHeld = data.held as boolean[];
        if (!newHeld || newHeld.length !== 6) {
          sender.send(JSON.stringify({ type: 'farkle_error', error: 'Invalid held array' }));
          return;
        }

        // Validate selection
        if (!isValidSelection(game.dice, game.held, newHeld)) {
          sender.send(JSON.stringify({ type: 'farkle_error', error: 'Invalid selection' }));
          return;
        }

        // Calculate score for newly held dice
        const newlyHeldValues: number[] = [];
        for (let i = 0; i < 6; i++) {
          if (!game.held[i] && newHeld[i]) {
            newlyHeldValues.push(game.dice[i]);
          }
        }
        const addedScore = calculateScore(newlyHeldValues);
        game.turnScore += addedScore;
        game.held = newHeld;
        game.version++;

        // Check for hot dice (all 6 held)
        const allHeld = game.held.every(h => h);
        if (allHeld) {
          // Hot dice - can roll all 6 again
          game.held = [false, false, false, false, false, false];
          console.log(`[FARKLE] ${currentPlayer.name} got hot dice! Turn score: ${game.turnScore}`);
        }

        this.broadcastFarkleState(game);
        break;
      }

      case 'bank': {
        const game = this.farkleGames.get(tableId);
        if (!game) return;

        const currentPlayer = game.players[game.currentPlayerIndex];
        if (!currentPlayer || currentPlayer.id !== sender.id) {
          sender.send(JSON.stringify({ type: 'farkle_error', error: 'Not your turn' }));
          return;
        }

        if (game.phase !== 'selecting') {
          sender.send(JSON.stringify({ type: 'farkle_error', error: 'Cannot bank now' }));
          return;
        }

        // Must have some held dice to bank
        if (!game.held.some(h => h)) {
          sender.send(JSON.stringify({ type: 'farkle_error', error: 'Must hold dice before banking' }));
          return;
        }

        // Bank points
        currentPlayer.score += game.turnScore;
        console.log(`[FARKLE] ${currentPlayer.name} banked ${game.turnScore}. Total: ${currentPlayer.score}`);

        game.version++;
        this.broadcastFarkleState(game);

        // Advance turn
        setTimeout(() => this.advanceTurn(game), 1000);
        break;
      }

      case 'leave': {
        const game = this.farkleGames.get(tableId);
        if (!game) return;

        const playerIndex = game.players.findIndex(p => p.id === sender.id);
        if (playerIndex !== -1) {
          const leavingPlayer = game.players[playerIndex];
          console.log(`[FARKLE] ${leavingPlayer.name} left table ${tableId}`);

          // If host leaves, end the game
          if (sender.id === game.hostId) {
            this.farkleGames.delete(tableId);
            this.room.broadcast(JSON.stringify({
              type: 'farkle_state',
              tableId,
              ended: true,
              reason: 'Host left'
            }));
            return;
          }

          game.players.splice(playerIndex, 1);

          // Adjust currentPlayerIndex if needed
          if (game.currentPlayerIndex >= game.players.length) {
            game.currentPlayerIndex = 0;
          }

          game.version++;
          this.broadcastFarkleState(game);
        }
        break;
      }
    }
  }

  advanceTurn(game: FarkleGameState): void {
    game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
    game.phase = 'waiting_for_roll';
    game.turnScore = 0;
    game.held = [false, false, false, false, false, false];
    game.dice = [1, 1, 1, 1, 1, 1]; // Reset dice display
    game.version++;

    const nextPlayer = game.players[game.currentPlayerIndex];
    console.log(`[FARKLE] Turn advanced to ${nextPlayer?.name}`);
    this.broadcastFarkleState(game);
  }

  broadcastFarkleState(game: FarkleGameState): void {
    const stateMessage = {
      type: 'farkle_state',
      tableId: game.tableId,
      phase: game.phase,
      players: game.players,
      currentPlayerIndex: game.currentPlayerIndex,
      dice: game.dice,
      held: game.held,
      turnScore: game.turnScore,
      version: game.version,
      hostId: game.hostId
    };
    this.room.broadcast(JSON.stringify(stateMessage));
  }

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    console.log(`Player connecting: ${conn.id} to room: ${this.room.id}`);

    // Check player limit
    if (this.players.size >= MAX_PLAYERS) {
      conn.send(JSON.stringify({
        type: 'error',
        message: 'Room is full (max 4 players)'
      } as ServerMessage));
      conn.close();
      return;
    }

    // Send welcome with current players AND the player's own ID
    conn.send(JSON.stringify({
      type: 'welcome',
      playerId: conn.id,
      players: Array.from(this.players.values()),
      message: `Welcome! You are player ${this.players.size + 1}/${MAX_PLAYERS}`
    } as ServerMessage));
  }

  onMessage(message: string, sender: Party.Connection) {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'join': {
          // Player joining with initial state
          const player: PlayerState = {
            id: sender.id,
            name: data.name || `Player${sender.id.slice(0, 4)}`,
            x: data.x || 0,
            y: data.y || 0,
            direction: data.direction || 'down',
            currentMap: data.currentMap || 'main',
            animation: data.animation || 'idle',
            gameType: data.gameType || 'game2d'
          };

          this.players.set(sender.id, player);

          // Broadcast join to all other players
          this.room.broadcast(JSON.stringify({
            type: 'join',
            player
          } as ServerMessage), [sender.id]);

          console.log(`Player joined: ${player.name} (${this.players.size}/${MAX_PLAYERS})`);
          break;
        }

        case 'update': {
          // Player position/state update
          const existing = this.players.get(sender.id);
          if (existing) {
            const updated: PlayerState = {
              ...existing,
              x: data.x ?? existing.x,
              y: data.y ?? existing.y,
              direction: data.direction ?? existing.direction,
              currentMap: data.currentMap ?? existing.currentMap,
              animation: data.animation ?? existing.animation,
              gameType: data.gameType ?? existing.gameType,
              inTavern: data.inTavern ?? existing.inTavern ?? false
            };
            this.players.set(sender.id, updated);

            // Broadcast to all other players
            this.room.broadcast(JSON.stringify({
              type: 'update',
              player: updated
            } as ServerMessage), [sender.id]);
          }
          break;
        }

        case 'sync': {
          // Request full sync of all players
          sender.send(JSON.stringify({
            type: 'sync',
            players: Array.from(this.players.values())
          } as ServerMessage));
          break;
        }

        case 'farkle': {
          // Route to Farkle handler (server-authoritative)
          this.handleFarkleMessage(data, sender);
          break;
        }

        default: {
          // Forward unknown message types to all other players
          const player = this.players.get(sender.id);
          this.room.broadcast(JSON.stringify({
            ...data,
            playerId: sender.id,
            playerName: player?.name || 'Unknown'
          }), [sender.id]);
          break;
        }
      }
    } catch (e) {
      console.error('Error parsing message:', e);
    }
  }

  onClose(conn: Party.Connection) {
    const player = this.players.get(conn.id);
    if (player) {
      this.players.delete(conn.id);

      // Broadcast leave to all remaining players
      this.room.broadcast(JSON.stringify({
        type: 'leave',
        playerId: conn.id
      } as ServerMessage));

      console.log(`Player left: ${player.name} (${this.players.size}/${MAX_PLAYERS})`);
    }
  }
}

Server satisfies Party.Worker;
