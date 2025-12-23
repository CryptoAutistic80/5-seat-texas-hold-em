import { decodeCard, PHASE_NAMES } from "../config/contracts";
import "./ShowdownModal.css";

interface ShowdownSnapshot {
    communityCards: number[];
    holeCards: number[][];
    playersInHand: number[];
    potSize: number;
    phase: number;
    seats: ({ player: string; chips: number } | null)[];
}

interface ShowdownModalProps {
    snapshot: ShowdownSnapshot;
    onDismiss: () => void;
}

export function ShowdownModal({ snapshot, onDismiss }: ShowdownModalProps) {
    const { communityCards, holeCards, playersInHand, potSize, phase, seats } = snapshot;

    return (
        <div className="showdown-overlay" onClick={onDismiss}>
            <div
                className="showdown-modal"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-label="Hand Results"
            >
                <div className="showdown-header">
                    <h2>Hand Complete</h2>
                    <span className="showdown-phase">Ended at {PHASE_NAMES[phase] || "Unknown"}</span>
                </div>

                <div className="showdown-content">
                    {/* Pot */}
                    <div className="showdown-pot">
                        <span className="pot-label">Final Pot</span>
                        <span className="pot-value">{potSize.toLocaleString()}</span>
                    </div>

                    {/* Community Cards */}
                    <div className="showdown-board">
                        <h3>Board</h3>
                        <div className="showdown-cards community">
                            {communityCards.length > 0 ? (
                                communityCards.map((cardValue, idx) => (
                                    <CardDisplay key={idx} value={cardValue} />
                                ))
                            ) : (
                                <span className="no-cards">No community cards dealt</span>
                            )}
                            {/* Fill empty slots */}
                            {Array.from({ length: Math.max(0, 5 - communityCards.length) }).map((_, idx) => (
                                <div key={`empty-${idx}`} className="showdown-card-slot" />
                            ))}
                        </div>
                    </div>

                    {/* Player Hands */}
                    <div className="showdown-hands">
                        <h3>Hands</h3>
                        <div className="showdown-players">
                            {playersInHand.length > 0 ? (
                                playersInHand.map((seatIdx, handIdx) => {
                                    const playerCards = holeCards[handIdx] || [];
                                    const seat = seats[seatIdx];
                                    const playerAddr = seat?.player || `Seat ${seatIdx + 1}`;
                                    const displayAddr = playerAddr.length > 10
                                        ? `${playerAddr.slice(0, 6)}...${playerAddr.slice(-4)}`
                                        : playerAddr;

                                    return (
                                        <div key={seatIdx} className="showdown-player">
                                            <div className="player-label">
                                                <span className="seat-num">Seat {seatIdx + 1}</span>
                                                <span className="player-addr">{displayAddr}</span>
                                            </div>
                                            <div className="showdown-cards hole">
                                                {playerCards.length === 2 ? (
                                                    <>
                                                        <CardDisplay value={playerCards[0]} />
                                                        <CardDisplay value={playerCards[1]} />
                                                    </>
                                                ) : (
                                                    <span className="no-cards">Cards not available</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <span className="no-cards">No players remaining</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="showdown-footer">
                    <button className="btn btn-primary showdown-dismiss" onClick={onDismiss}>
                        Continue
                    </button>
                </div>
            </div>
        </div>
    );
}

// Simple card display for the modal
function CardDisplay({ value }: { value: number }) {
    const card = decodeCard(value);
    const isRed = card.suit === "♥" || card.suit === "♦";

    return (
        <div className={`showdown-card ${isRed ? "red" : "black"}`}>
            <span className="showdown-card-rank">{card.rank}</span>
            <span className="showdown-card-suit">{card.suit}</span>
        </div>
    );
}
