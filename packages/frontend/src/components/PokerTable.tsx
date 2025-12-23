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

function Card({ value, size = "normal", faceDown = false }: { value: number; size?: "normal" | "small"; faceDown?: boolean }) {
    // Render card back
    if (faceDown) {
        return (
            <div className={`poker-card poker-card-back ${size === "small" ? "poker-card-small" : ""}`}>
                <div className="poker-card-back-pattern" />
            </div>
        );
    }

    const card = decodeCard(value);
    const isRed = card.suit === "♥" || card.suit === "♦";
    const suitColor = isRed ? "red" : "black";

    // Get pip count for number cards
    const getPipCount = (rank: string): number => {
        const num = parseInt(rank, 10);
        if (!isNaN(num)) return num;
        if (rank === "A") return 1;
        return 0; // Face cards
    };

    const isFaceCard = ["K", "Q", "J"].includes(card.rank);
    const isAce = card.rank === "A";
    const pipCount = getPipCount(card.rank);

    // Render pip pattern for number cards
    const renderPips = () => {
        if (isFaceCard || isAce) return null;

        // Pip positions for each count (relative positions 0-100%)
        const pipLayouts: Record<number, { x: number; y: number }[]> = {
            2: [
                { x: 50, y: 20 },
                { x: 50, y: 80 },
            ],
            3: [
                { x: 50, y: 20 },
                { x: 50, y: 50 },
                { x: 50, y: 80 },
            ],
            4: [
                { x: 30, y: 20 },
                { x: 70, y: 20 },
                { x: 30, y: 80 },
                { x: 70, y: 80 },
            ],
            5: [
                { x: 30, y: 20 },
                { x: 70, y: 20 },
                { x: 50, y: 50 },
                { x: 30, y: 80 },
                { x: 70, y: 80 },
            ],
            6: [
                { x: 30, y: 20 },
                { x: 70, y: 20 },
                { x: 30, y: 50 },
                { x: 70, y: 50 },
                { x: 30, y: 80 },
                { x: 70, y: 80 },
            ],
            7: [
                { x: 30, y: 20 },
                { x: 70, y: 20 },
                { x: 50, y: 35 },
                { x: 30, y: 50 },
                { x: 70, y: 50 },
                { x: 30, y: 80 },
                { x: 70, y: 80 },
            ],
            8: [
                { x: 30, y: 20 },
                { x: 70, y: 20 },
                { x: 50, y: 35 },
                { x: 30, y: 50 },
                { x: 70, y: 50 },
                { x: 50, y: 65 },
                { x: 30, y: 80 },
                { x: 70, y: 80 },
            ],
            9: [
                { x: 30, y: 16 },
                { x: 70, y: 16 },
                { x: 30, y: 38 },
                { x: 70, y: 38 },
                { x: 50, y: 50 },
                { x: 30, y: 62 },
                { x: 70, y: 62 },
                { x: 30, y: 84 },
                { x: 70, y: 84 },
            ],
            10: [
                { x: 30, y: 16 },
                { x: 70, y: 16 },
                { x: 50, y: 28 },
                { x: 30, y: 40 },
                { x: 70, y: 40 },
                { x: 30, y: 60 },
                { x: 70, y: 60 },
                { x: 50, y: 72 },
                { x: 30, y: 84 },
                { x: 70, y: 84 },
            ],
        };

        const positions = pipLayouts[pipCount] || [];
        return positions.map((pos, i) => (
            <span
                key={i}
                className="poker-card-pip"
                style={{
                    position: "absolute",
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    transform: `translate(-50%, -50%)${pos.y > 50 ? " rotate(180deg)" : ""}`,
                }}
            >
                {card.suit}
            </span>
        ));
    };

    return (
        <div className={`poker-card ${suitColor} ${size === "small" ? "poker-card-small" : ""}`}>
            {/* Top-left corner */}
            <div className="poker-card-corner poker-card-corner-tl">
                <span className="poker-card-corner-rank">{card.rank}</span>
                <span className="poker-card-corner-suit">{card.suit}</span>
            </div>

            {/* Center content */}
            <div className="poker-card-center">
                {isAce && <span className="poker-card-ace-suit">{card.suit}</span>}
                {isFaceCard && (
                    <div className="poker-card-face">
                        <span className="poker-card-face-letter">{card.rank}</span>
                        <span className="poker-card-face-suit">{card.suit}</span>
                    </div>
                )}
                {!isFaceCard && !isAce && renderPips()}
            </div>

            {/* Bottom-right corner (inverted) */}
            <div className="poker-card-corner poker-card-corner-br">
                <span className="poker-card-corner-rank">{card.rank}</span>
                <span className="poker-card-corner-suit">{card.suit}</span>
            </div>
        </div>
    );
}


