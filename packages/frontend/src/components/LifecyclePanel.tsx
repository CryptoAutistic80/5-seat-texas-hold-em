import { useEffect, useMemo, useState } from "react";
import { Clock3, Eye, KeyRound, Loader2, Play, Shield } from "lucide-react";
import { GAME_PHASES, PHASE_NAMES } from "../config/contracts";
import { useContractActions } from "../hooks/useContract";
import type { GameState, SeatInfo, TableState } from "../types";
import "./LifecyclePanel.css";

interface LifecyclePanelProps {
    tableAddress: string;
    gameState: GameState;
    seats: (SeatInfo | null)[];
    playerSeat: number | null;
    tableState: TableState | null;
    onRefresh: () => void | Promise<void>;
}

function formatDeadline(deadline?: number | null) {
    if (!deadline || deadline <= 0) return null;
    try {
        const date = new Date(deadline * 1000);
        return `${date.toLocaleString()} (${date.toLocaleTimeString()})`;
    } catch {
        return null;
    }
}

async function hashSecret(secret: string): Promise<string | null> {
    if (!secret || typeof window === "undefined" || !window.crypto?.subtle) return null;

    const encoder = new TextEncoder();
    const data = encoder.encode(secret);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function LifecyclePanel({
    tableAddress,
    gameState,
    seats,
    playerSeat,
    tableState,
    onRefresh,
}: LifecyclePanelProps) {
    const { startHand, submitCommit, revealSecret } = useContractActions();
    const [secret, setSecret] = useState("");
    const [secretHash, setSecretHash] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [activeAction, setActiveAction] = useState<"start" | "commit" | "reveal" | null>(null);

    const playerAddress = playerSeat !== null ? seats[playerSeat]?.player : null;

    const isActionOnPlayer = useMemo(() => {
        if (playerSeat === null || !playerAddress || !gameState.actionOn) return false;
        return (
            gameState.actionOn.seatIndex === playerSeat &&
            gameState.actionOn.playerAddress?.toLowerCase() === playerAddress.toLowerCase()
        );
    }, [gameState.actionOn, playerAddress, playerSeat]);

    const deadlineText = useMemo(() => formatDeadline(gameState.actionOn?.deadline), [gameState.actionOn?.deadline]);

    useEffect(() => {
        let isMounted = true;
        if (!secret) {
            setSecretHash(null);
            return undefined;
        }

        hashSecret(secret).then((value) => {
            if (isMounted) setSecretHash(value);
        });

        return () => {
            isMounted = false;
        };
    }, [secret]);

    const handleGenerateSecret = () => {
        const randomBytes = window.crypto?.getRandomValues(new Uint8Array(16));
        const generated = randomBytes
            ? Array.from(randomBytes)
                  .map((b) => b.toString(16).padStart(2, "0"))
                  .join("")
            : Math.random().toString(36).slice(2);
        setSecret(generated);
        setStatus("Generated a new secret. Keep it safe for reveal phase.");
    };

    const runLifecycleAction = async (action: () => Promise<unknown>, actionName: "start" | "commit" | "reveal") => {
        try {
            setActiveAction(actionName);
            setStatus(null);
            await action();
            setStatus("Action submitted. Refreshing table...");
            await onRefresh();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Action failed.";
            setStatus(message);
        } finally {
            setActiveAction(null);
        }
    };

    const startDisabled = gameState.phase !== GAME_PHASES.WAITING || !isActionOnPlayer || activeAction !== null;
    const commitDisabled =
        gameState.phase !== GAME_PHASES.COMMIT || !isActionOnPlayer || !secret || !secretHash || activeAction !== null;
    const revealDisabled =
        gameState.phase !== GAME_PHASES.REVEAL || !isActionOnPlayer || !secret || activeAction !== null;

    const phaseMessage = () => {
        switch (gameState.phase) {
            case GAME_PHASES.WAITING:
                return "Waiting for the next hand to start.";
            case GAME_PHASES.COMMIT:
                return "Submit a hash of your secret to commit to your hidden card draw.";
            case GAME_PHASES.REVEAL:
                return "Reveal the secret you committed to finalize randomness.";
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
                    <h3>Hand Lifecycle</h3>
                    <p>Control hand start, commit, and reveal steps.</p>
                </div>
                <span className="phase-pill">{PHASE_NAMES[gameState.phase] ?? "Unknown"}</span>
            </div>

            <div className="phase-status">
                <p className="phase-message">{phaseMessage()}</p>
                {gameState.actionOn && (
                    <p className="acting-player">
                        Acting seat: {gameState.actionOn.seatIndex + 1} ({gameState.actionOn.playerAddress.slice(0, 6)}...
                        {gameState.actionOn.playerAddress.slice(-4)})
                    </p>
                )}
                {deadlineText && (
                    <div className="deadline">
                        <Clock3 size={16} />
                        <span>Deadline: {deadlineText}</span>
                    </div>
                )}
            </div>

            {gameState.phase === GAME_PHASES.WAITING && (
                <div className="lifecycle-card">
                    <div className="card-header">
                        <Play size={18} />
                        <div>
                            <h4>Start Hand</h4>
                            <small>
                                Seat {tableState ? tableState.dealerSeat + 1 : "-"} dealer starts the next hand.
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
                    {!isActionOnPlayer && <small className="hint">Waiting for the acting player to start.</small>}
                </div>
            )}

            {gameState.phase === GAME_PHASES.COMMIT && (
                <div className="lifecycle-card">
                    <div className="card-header">
                        <KeyRound size={18} />
                        <div>
                            <h4>Commit Secret</h4>
                            <small>Generate or enter a secret to hash and commit.</small>
                        </div>
                    </div>

                    <div className="secret-controls">
                        <div className="secret-input">
                            <label htmlFor="commit-secret">Secret</label>
                            <input
                                id="commit-secret"
                                type="text"
                                value={secret}
                                onChange={(e) => setSecret(e.target.value)}
                                placeholder="Enter a secret phrase"
                            />
                        </div>
                        <button type="button" className="btn secondary" onClick={handleGenerateSecret}>
                            Generate
                        </button>
                    </div>

                    {secretHash && (
                        <div className="hash-preview">
                            <span>Commit hash</span>
                            <code>{`0x${secretHash}`}</code>
                        </div>
                    )}

                    <button
                        className="btn action"
                        onClick={() =>
                            runLifecycleAction(async () => {
                                if (!secretHash) throw new Error("Unable to hash secret.");
                                await submitCommit(tableAddress, `0x${secretHash}`);
                            }, "commit")
                        }
                        disabled={commitDisabled}
                    >
                        {activeAction === "commit" ? <Loader2 className="spin" size={16} /> : <Shield size={16} />} Submit Commit
                    </button>
                    {!isActionOnPlayer && <small className="hint">Waiting for your turn to commit.</small>}
                </div>
            )}

            {gameState.phase === GAME_PHASES.REVEAL && (
                <div className="lifecycle-card">
                    <div className="card-header">
                        <Eye size={18} />
                        <div>
                            <h4>Reveal Secret</h4>
                            <small>Use the exact secret you committed earlier.</small>
                        </div>
                    </div>

                    <div className="secret-controls">
                        <div className="secret-input">
                            <label htmlFor="reveal-secret">Secret</label>
                            <input
                                id="reveal-secret"
                                type="text"
                                value={secret}
                                onChange={(e) => setSecret(e.target.value)}
                                placeholder="Enter your committed secret"
                            />
                        </div>
                        <button type="button" className="btn secondary" onClick={handleGenerateSecret}>
                            Generate
                        </button>
                    </div>

                    <button
                        className="btn action"
                        onClick={() => runLifecycleAction(() => revealSecret(tableAddress, secret), "reveal")}
                        disabled={revealDisabled}
                    >
                        {activeAction === "reveal" ? <Loader2 className="spin" size={16} /> : <Eye size={16} />} Reveal Secret
                    </button>
                    {!isActionOnPlayer && <small className="hint">Waiting for your turn to reveal.</small>}
                </div>
            )}

            {status && <div className="lifecycle-status">{status}</div>}
        </section>
    );
}
