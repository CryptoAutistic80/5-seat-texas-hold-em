import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { sha3_256 } from "@noble/hashes/sha3";
import { Clock3, Loader2, Play, Shield, LogOut, Power, PowerOff, Sparkles, Check, Users } from "lucide-react";
import { GAME_PHASES, PHASE_NAMES } from "../config/contracts";
import { useContractActions, useTableView } from "../hooks/useContract";
import type { GameState, SeatInfo, TableState } from "../types";
import "./LifecyclePanel.css";

interface LifecyclePanelProps {
    tableAddress: string;
    gameState: GameState;
    seats: (SeatInfo | null)[];
    playerSeat: number | null;
    tableState: TableState | null;
    pendingLeave?: boolean;
    isAdmin?: boolean;
    isAdminOnlyStart?: boolean;
    isPaused?: boolean;
    onRefresh: () => void | Promise<void>;
}

function formatDeadline(deadline?: number | null) {
    if (!deadline || deadline <= 0) return null;
    try {
        const now = Math.floor(Date.now() / 1000);
        const remaining = deadline - now;
        if (remaining <= 0) return "Expired";
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    } catch {
        return null;
    }
}

// Returns the SHA3-256 hash as bytes for contract submission
function hashSecretToBytes(secret: string): Uint8Array | null {
    if (!secret) return null;
    const encoder = new TextEncoder();
    const data = encoder.encode(secret);
    return sha3_256(data);
}

function getSecretStorageKey(tableAddress: string, playerAddress: string | null | undefined, handNumber: number): string | null {
    if (!tableAddress || !playerAddress) return null;
    return `holdem_secret_${tableAddress}_${playerAddress}_${handNumber}`.toLowerCase();
}

function loadStoredSecret(tableAddress: string, playerAddress: string | null | undefined, handNumber: number): string {
    const key = getSecretStorageKey(tableAddress, playerAddress, handNumber);
    if (!key || typeof window === "undefined") return "";
    try {
        return localStorage.getItem(key) || "";
    } catch {
        return "";
    }
}

function saveSecret(tableAddress: string, playerAddress: string | null | undefined, handNumber: number, secret: string): void {
    const key = getSecretStorageKey(tableAddress, playerAddress, handNumber);
    if (!key || typeof window === "undefined") return;
    try {
        if (secret) {
            localStorage.setItem(key, secret);
        } else {
            localStorage.removeItem(key);
        }
    } catch {
        // localStorage may be unavailable
    }
}

// Generate a cryptographically secure random secret
function generateSecret(): string {
    const randomBytes = window.crypto?.getRandomValues(new Uint8Array(32));
    return randomBytes
        ? Array.from(randomBytes)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")
        : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export function LifecyclePanel({
    tableAddress,
    gameState,
    seats,
    playerSeat,
    tableState,
    pendingLeave = false,
    isAdmin = false,
    isAdminOnlyStart = false,
    isPaused = false,
    onRefresh,
}: LifecyclePanelProps) {
    const { startHand, submitCommit, revealSecret, leaveTable, leaveAfterHand, cancelLeaveAfterHand, sitOut, sitIn } = useContractActions();
    const { getCommitStatus, getRevealStatus, getPlayersInHand } = useTableView();

    const playerAddress = playerSeat !== null ? seats[playerSeat]?.player : null;
    const handNumber = tableState?.handNumber ?? 0;

    // State
    const [status, setStatus] = useState<string | null>(null);
    const [activeAction, setActiveAction] = useState<"start" | "commit" | "reveal" | "leave" | "sitout" | null>(null);
    const [commitStatus, setCommitStatus] = useState<boolean[]>([]);
    const [revealStatus, setRevealStatus] = useState<boolean[]>([]);
    const [playersInHand, setPlayersInHand] = useState<number[]>([]);

    // Track whether we've already triggered auto-reveal for this hand
    const autoRevealTriggeredRef = useRef<number>(0);

    // Load stored secret for this hand
    const storedSecret = useMemo(() =>
        loadStoredSecret(tableAddress, playerAddress, handNumber),
        [tableAddress, playerAddress, handNumber]
    );

    // Find player's position in the hand (hand_idx)
    const playerHandIdx = useMemo(() => {
        if (playerSeat === null) return -1;
        return playersInHand.indexOf(playerSeat);
    }, [playerSeat, playersInHand]);

    // Check if player has already committed/revealed
    const hasCommitted = playerHandIdx >= 0 && commitStatus[playerHandIdx] === true;
    const hasRevealed = playerHandIdx >= 0 && revealStatus[playerHandIdx] === true;

    // Fetch commit/reveal status periodically during those phases
    useEffect(() => {
        if (gameState.phase !== GAME_PHASES.COMMIT && gameState.phase !== GAME_PHASES.REVEAL) {
            return;
        }

        const fetchStatus = async () => {
            try {
                const [commits, reveals, players] = await Promise.all([
                    getCommitStatus(tableAddress),
                    getRevealStatus(tableAddress),
                    getPlayersInHand(tableAddress),
                ]);
                setCommitStatus(commits);
                setRevealStatus(reveals);
                setPlayersInHand(players);
            } catch (err) {
                console.warn("Failed to fetch commit/reveal status:", err);
            }
        };

        fetchStatus();
        const interval = setInterval(fetchStatus, 3000);
        return () => clearInterval(interval);
    }, [gameState.phase, tableAddress, getCommitStatus, getRevealStatus, getPlayersInHand]);

    // Auto-reveal when phase changes to REVEAL and we have a stored secret
    useEffect(() => {
        if (
            gameState.phase === GAME_PHASES.REVEAL &&
            storedSecret &&
            playerHandIdx >= 0 &&
            !hasRevealed &&
            activeAction === null &&
            autoRevealTriggeredRef.current !== handNumber
        ) {
            // Mark that we're triggering auto-reveal for this hand
            autoRevealTriggeredRef.current = handNumber;

            // Small delay to let UI update, then auto-trigger reveal
            const timeout = setTimeout(() => {
                setStatus("🎴 Accepting your cards...");
                const secretBytes = new TextEncoder().encode(storedSecret);
                runLifecycleAction(() => revealSecret(tableAddress, secretBytes), "reveal");
            }, 500);

            return () => clearTimeout(timeout);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameState.phase, storedSecret, playerHandIdx, hasRevealed, handNumber]);

    const isActionOnPlayer = useMemo(() => {
        if (playerSeat === null || !playerAddress || !gameState.actionOn) return false;
        return (
            gameState.actionOn.seatIndex === playerSeat &&
            gameState.actionOn.playerAddress?.toLowerCase() === playerAddress.toLowerCase()
        );
    }, [gameState.actionOn, playerAddress, playerSeat]);

    const deadlineText = useMemo(() => formatDeadline(gameState.actionOn?.deadline), [gameState.actionOn?.deadline]);

    const runLifecycleAction = useCallback(async (action: () => Promise<unknown>, actionName: "start" | "commit" | "reveal" | "leave" | "sitout") => {
        try {
            setActiveAction(actionName);
            setStatus(null);
            await action();
            setStatus("✓ Success! Refreshing...");
            await onRefresh();
        } catch (err) {
            console.error(`Lifecycle action "${actionName}" failed:`, err);
            const message = err instanceof Error ? err.message : "Action failed.";
            setStatus(`⚠️ ${message}`);
        } finally {
            setActiveAction(null);
        }
    }, [onRefresh]);

    // Handle "Request Cards" - generates secret and submits commit in one click
    const handleRequestCards = useCallback(async () => {
        // Generate a fresh secret for this hand
        const newSecret = generateSecret();
        saveSecret(tableAddress, playerAddress, handNumber, newSecret);

        const hashBytes = hashSecretToBytes(newSecret);
        if (!hashBytes) throw new Error("Failed to generate secret hash");

        console.log("REQUEST CARDS:", { handNumber, secretLength: newSecret.length });
        await submitCommit(tableAddress, hashBytes);
    }, [tableAddress, playerAddress, handNumber, submitCommit]);

    // Count active (non-sitting-out) seats
    const activeSeats = useMemo(() => seats.filter(s => s && !s.sittingOut).length, [seats]);
    const isSeatedPlayer = playerSeat !== null && !!seats[playerSeat];
    const isActivePlayer = isSeatedPlayer && !seats[playerSeat!]?.sittingOut;

    // Admin can start when admin_only_start is on, otherwise anyone who is action-on player or admin
    const canStartHand = isAdminOnlyStart ? isAdmin : (isActionOnPlayer || isAdmin);

    const startDisabled =
        gameState.phase !== GAME_PHASES.WAITING ||
        isPaused ||
        activeSeats < 2 ||
        !canStartHand ||
        activeAction !== null;

    const startHint = useMemo(() => {
        if (gameState.phase !== GAME_PHASES.WAITING) return null;
        if (isPaused) return "Table is paused.";
        if (activeSeats < 2) return "Need at least 2 active players.";
        if (isAdminOnlyStart && !isAdmin) return "Only admin can start hands.";
        if (!isActionOnPlayer && !isAdmin) return "Waiting for the acting player to start.";
        return null;
    }, [gameState.phase, isPaused, activeSeats, isAdminOnlyStart, isAdmin, isActionOnPlayer]);

    // Request cards disabled if already committed, not active, or action in progress
    const requestCardsDisabled =
        gameState.phase !== GAME_PHASES.COMMIT ||
        !isActivePlayer ||
        hasCommitted ||
        activeAction !== null;

    // Progress counts
    const committedCount = commitStatus.filter(Boolean).length;
    const revealedCount = revealStatus.filter(Boolean).length;
    const totalPlayers = playersInHand.length || committedCount || 1;

    const phaseMessage = () => {
        switch (gameState.phase) {
            case GAME_PHASES.WAITING:
                return "Waiting for the next hand to start.";
            case GAME_PHASES.COMMIT:
                return "Click 'Request Cards' to join this hand.";
            case GAME_PHASES.REVEAL:
                return "Confirming card distribution...";
            case GAME_PHASES.PREFLOP:
            case GAME_PHASES.FLOP:
            case GAME_PHASES.TURN:
            case GAME_PHASES.RIVER:
                return "Betting round in progress.";
            case GAME_PHASES.SHOWDOWN:
                return "Hand resolving at showdown.";
            default:
                return "Game status updating.";
        }
    };

    return (
        <section className="lifecycle-panel">
            <div className="lifecycle-header">
                <Shield size={18} />
                <div>
                    <h3>Hand #{handNumber || "—"}</h3>
                    <p>{phaseMessage()}</p>
                </div>
                <span className="phase-pill">{PHASE_NAMES[gameState.phase] ?? "Unknown"}</span>
            </div>

            {/* Progress indicator for commit/reveal phases */}
            {(gameState.phase === GAME_PHASES.COMMIT || gameState.phase === GAME_PHASES.REVEAL) && (
                <div className="progress-status">
                    <Users size={16} />
                    <span>
                        {gameState.phase === GAME_PHASES.COMMIT
                            ? `${committedCount}/${totalPlayers} players ready`
                            : `${revealedCount}/${totalPlayers} confirmed`
                        }
                    </span>
                    <div className="progress-bar">
                        <div
                            className="progress-fill"
                            style={{
                                width: `${(gameState.phase === GAME_PHASES.COMMIT ? committedCount : revealedCount) / totalPlayers * 100}%`
                            }}
                        />
                    </div>
                </div>
            )}

            {deadlineText && (
                <div className="deadline">
                    <Clock3 size={16} />
                    <span>Time remaining: {deadlineText}</span>
                </div>
            )}

            {gameState.phase === GAME_PHASES.WAITING && (
                <div className="lifecycle-card">
                    <div className="card-header">
                        <Play size={18} />
                        <div>
                            <h4>Start Hand</h4>
                            <small>
                                Seat {tableState ? tableState.dealerSeat + 1 : "-"} is dealer
                            </small>
                        </div>
                    </div>
                    <button
                        className="btn action"
                        onClick={() => runLifecycleAction(() => startHand(tableAddress), "start")}
                        disabled={startDisabled}
                    >
                        {activeAction === "start" ? <Loader2 className="spin" size={16} /> : <Play size={16} />} Start Hand
                    </button>
                    {startHint && <small className="hint">{startHint}</small>}
                </div>
            )}

            {gameState.phase === GAME_PHASES.COMMIT && (
                <div className="lifecycle-card request-cards-card">
                    <div className="card-header">
                        <Sparkles size={18} />
                        <div>
                            <h4>Request Cards</h4>
                            <small>Click to receive your hole cards for this hand</small>
                        </div>
                    </div>

                    {hasCommitted ? (
                        <div className="success-message">
                            <Check size={18} />
                            <span>Cards requested! Waiting for other players...</span>
                        </div>
                    ) : (
                        <button
                            className="btn action request-cards-btn"
                            onClick={() => runLifecycleAction(handleRequestCards, "commit")}
                            disabled={requestCardsDisabled}
                        >
                            {activeAction === "commit" ? (
                                <Loader2 className="spin" size={16} />
                            ) : (
                                <Sparkles size={16} />
                            )}
                            Request Cards
                        </button>
                    )}

                    {!isActivePlayer && isSeatedPlayer && (
                        <small className="hint">Sit in to request cards.</small>
                    )}
                </div>
            )}

            {gameState.phase === GAME_PHASES.REVEAL && (
                <div className="lifecycle-card accept-cards-card">
                    <div className="card-header">
                        <Shield size={18} />
                        <div>
                            <h4>Accept Cards</h4>
                            <small>Confirming fair card distribution</small>
                        </div>
                    </div>

                    {hasRevealed ? (
                        <div className="success-message">
                            <Check size={18} />
                            <span>Confirmed! Waiting for other players...</span>
                        </div>
                    ) : activeAction === "reveal" ? (
                        <div className="loading-message">
                            <Loader2 className="spin" size={18} />
                            <span>Accepting cards... Please sign the transaction</span>
                        </div>
                    ) : storedSecret ? (
                        <div className="loading-message">
                            <Loader2 className="spin" size={18} />
                            <span>Preparing to accept cards...</span>
                        </div>
                    ) : (
                        <div className="error-message">
                            <span>⚠️ Secret not found. You may need to refresh and wait for next hand.</span>
                        </div>
                    )}
                </div>
            )}

            {/* Player Controls - shown when player is seated */}
            {playerSeat !== null && seats[playerSeat] && (
                <div className="lifecycle-card player-controls">
                    <div className="card-header">
                        <Power size={18} />
                        <div>
                            <h4>Player Controls</h4>
                            <small>Manage your session at this table</small>
                        </div>
                    </div>
                    <div className="controls-grid">
                        {/* Sit Out / Sit In Toggle */}
                        <button
                            className={`btn ${seats[playerSeat]?.sittingOut ? "success" : "secondary"}`}
                            onClick={() =>
                                runLifecycleAction(
                                    () => seats[playerSeat]?.sittingOut ? sitIn(tableAddress) : sitOut(tableAddress),
                                    "sitout"
                                )
                            }
                            disabled={activeAction !== null}
                        >
                            {activeAction === "sitout" ? (
                                <Loader2 className="spin" size={16} />
                            ) : seats[playerSeat]?.sittingOut ? (
                                <Power size={16} />
                            ) : (
                                <PowerOff size={16} />
                            )}
                            {seats[playerSeat]?.sittingOut ? "Sit In" : "Sit Out"}
                        </button>

                        {/* Leave Table Now - only shown when no hand is in progress */}
                        {gameState.phase === GAME_PHASES.WAITING && (
                            <button
                                className="btn danger"
                                onClick={() =>
                                    runLifecycleAction(
                                        () => leaveTable(tableAddress),
                                        "leave"
                                    )
                                }
                                disabled={activeAction !== null}
                            >
                                {activeAction === "leave" ? (
                                    <Loader2 className="spin" size={16} />
                                ) : (
                                    <LogOut size={16} />
                                )}
                                Leave Table
                            </button>
                        )}

                        {/* Leave After Hand - only shown during active hand */}
                        {gameState.phase !== GAME_PHASES.WAITING && (
                            <button
                                className={`btn ${pendingLeave ? "warning" : "danger-outline"}`}
                                onClick={() =>
                                    runLifecycleAction(
                                        () => pendingLeave ? cancelLeaveAfterHand(tableAddress) : leaveAfterHand(tableAddress),
                                        "leave"
                                    )
                                }
                                disabled={activeAction !== null}
                            >
                                {activeAction === "leave" ? (
                                    <Loader2 className="spin" size={16} />
                                ) : (
                                    <LogOut size={16} />
                                )}
                                {pendingLeave ? "Cancel Leave" : "Leave After Hand"}
                            </button>
                        )}
                    </div>
                    {pendingLeave && gameState.phase !== GAME_PHASES.WAITING && (
                        <small className="pending-notice">
                            You will leave the table after the current hand ends.
                        </small>
                    )}
                </div>
            )}

            {status && <div className="lifecycle-status">{status}</div>}
        </section>
    );
}
