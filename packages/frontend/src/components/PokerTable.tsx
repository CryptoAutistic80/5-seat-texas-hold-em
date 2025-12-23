import { decodeCard, PHASE_NAMES, STATUS_NAMES, GAME_PHASES } from "../config/contracts";
import type { SeatInfo, GameState } from "../types";
import "./PokerTable.css";

interface PokerTableProps {
    seats: (SeatInfo | null)[];
    gameState: GameState | null;
    dealerSeat: number;
    playerSeat: number | null;
    onSeatSelect?: (seatIndex: number) => void;
    selectedSeat?: number | null;
    holeCards?: number[][];
    playersInHand?: number[];
}

export function PokerTable({
    seats,
    gameState,
    dealerSeat,
    playerSeat,
    onSeatSelect,
    selectedSeat,
    holeCards = [],
    playersInHand = [],
}: PokerTableProps) {
    // Position seats around an oval table
    // Seat positions: 0=bottom, 1=bottom-left, 2=top-left, 3=top-right, 4=bottom-right
    const seatPositions = [
        { left: "50%", bottom: "4%", transform: "translateX(-50%)" },      // 0: bottom center
        { left: "6%", bottom: "28%", transform: "none" },                   // 1: bottom-left
        { left: "18%", top: "6%", transform: "none" },                      // 2: top-left
        { right: "18%", top: "6%", transform: "none" },                     // 3: top-right
        { right: "6%", bottom: "28%", transform: "none" },                  // 4: bottom-right
    ];

    const isActionOn = (seatIdx: number) =>
        gameState?.actionOn?.seatIndex === seatIdx;

    // Get hole cards for a specific seat index
    const getHoleCardsForSeat = (seatIdx: number): number[] => {
        // Cards are only dealt in PREFLOP phase or later (phase >= 3)
        if (!gameState || gameState.phase < GAME_PHASES.PREFLOP) return [];

        const handIdx = playersInHand.indexOf(seatIdx);
        if (handIdx === -1 || handIdx >= holeCards.length) return [];
        return holeCards[handIdx] || [];
    };

    return (
        <div className="poker-table-container">
            <div className="poker-table">
                {/* Felt surface */}
                <div className="felt">
                    {/* Pot display */}
                    {gameState && gameState.potSize > 0 && (
                        <div className="pot-display">
                            <span className="pot-label">POT</span>
                            <span className="pot-amount">{gameState.potSize.toLocaleString()}</span>
                        </div>
                    )}

                    {/* Community cards */}
                    <div className="community-cards">
                        {gameState?.communityCards.map((card, idx) => (
                            <Card key={idx} value={card} />
                        ))}
                        {/* Empty card slots */}
                        {Array.from({ length: 5 - (gameState?.communityCards.length || 0) }).map((_, idx) => (
                            <div key={`empty-${idx}`} className="card-slot" />
                        ))}
                    </div>

                    {/* Game phase */}
                    {gameState && (
                        <div className="phase-indicator">
                            {PHASE_NAMES[gameState.phase] || "Unknown"}
                        </div>
                    )}
                </div>

                {/* Seats */}
                {seats.map((seat, idx) => {
                    const playerHoleCards = getHoleCardsForSeat(idx);

                    return (
                        <div
                            key={idx}
                            className={`seat ${seat ? "occupied" : "empty"} ${isActionOn(idx) ? "action-on" : ""} ${idx === playerSeat ? "player-seat" : ""} ${selectedSeat === idx ? "selected" : ""}`}
                            style={seatPositions[idx]}
                            onClick={() => !seat && onSeatSelect?.(idx)}
                            onKeyDown={(event) => {
                                if (!seat && onSeatSelect && (event.key === "Enter" || event.key === " ")) {
                                    event.preventDefault();
                                    onSeatSelect(idx);
                                }
                            }}
                            role={!seat && onSeatSelect ? "button" : undefined}
                            tabIndex={!seat && onSeatSelect ? 0 : undefined}
                        >
                            {idx === dealerSeat && <div className="dealer-button">D</div>}

                            {seat ? (
                                <div className="seat-content">
                                    {/* Hole cards display */}
                                    {playerHoleCards.length === 2 && (
                                        <div className="hole-cards">
                                            <Card value={playerHoleCards[0]} size="small" />
                                            <Card value={playerHoleCards[1]} size="small" />
                                        </div>
                                    )}

                                    <div className="player-avatar">
                                        {(seat.player ?? "").slice(2, 4).toUpperCase()}
                                    </div>
                                    <div className="player-info">
                                        <span className="player-address">
                                            {(seat.player ?? "").slice(0, 6)}...{(seat.player ?? "").slice(-4)}
                                        </span>
                                        <span className="player-chips">{seat.chips.toLocaleString()}</span>
                                    </div>
                                    <div className="player-status">
                                        {seat.sittingOut ? "Sitting Out" : STATUS_NAMES[seat.status]}
                                    </div>
                                    {seat.currentBet > 0 && (
                                        <div className="player-bet">{seat.currentBet}</div>
                                    )}
                                </div>
                            ) : (
                                <div className="empty-seat">
                                    <span>Seat {idx + 1}</span>
                                    <span className="join-hint">Click to join</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function Card({ value, size = "normal" }: { value: number; size?: "normal" | "small" }) {
    const card = decodeCard(value);
    const isRed = card.suit === "♥" || card.suit === "♦";

    return (
        <div className={`card ${isRed ? "red" : "black"} ${size === "small" ? "card-small" : ""}`}>
            <span className="card-rank">{card.rank}</span>
            <span className="card-suit">{card.suit}</span>
        </div>
    );
}

