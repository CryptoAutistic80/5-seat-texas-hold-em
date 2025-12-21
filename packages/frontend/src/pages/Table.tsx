import { useParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useWallet } from "../components/wallet-provider";
import { useChipsView, useContractActions, useTableView } from "../hooks/useContract";
import { PokerTable } from "../components/PokerTable";
import { ActionPanel } from "../components/ActionPanel";
import { TableInfo } from "../components/TableInfo";
import { LifecyclePanel } from "../components/LifecyclePanel";
import type { TableConfig, TableState, SeatInfo, GameState } from "../types";
import "./Table.css";

export function Table() {
    const { address } = useParams<{ address: string }>();
    const { connected, account } = useWallet();
    const { getTableConfig, getTableState, getAllSeats, getFullGameState } = useTableView();
    const { joinTable } = useContractActions();
    const { getBalance } = useChipsView();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [config, setConfig] = useState<TableConfig | null>(null);
    const [tableState, setTableState] = useState<TableState | null>(null);
    const [seats, setSeats] = useState<(SeatInfo | null)[]>([]);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [playerSeat, setPlayerSeat] = useState<number | null>(null);
    const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
    const [buyIn, setBuyIn] = useState<number>(0);
    const [balance, setBalance] = useState<number>(0);
    const [joinError, setJoinError] = useState<string | null>(null);
    const [joinSuccess, setJoinSuccess] = useState<string | null>(null);
    const [joining, setJoining] = useState(false);

    const loadTableData = async () => {
        if (!address) return;

        try {
            setLoading(true);
            setError(null);

            const [configData, stateData, seatsData, gameData] = await Promise.all([
                getTableConfig(address),
                getTableState(address),
                getAllSeats(address),
                getFullGameState(address),
            ]);

            setConfig(configData);
            setTableState(stateData);
            setSeats(seatsData);
            setGameState(gameData);

            // Default to first available seat if none selected
            const firstEmptySeat = seatsData.findIndex((s) => !s);
            setSelectedSeat((prev) => (prev === null && firstEmptySeat >= 0 ? firstEmptySeat : prev));

            // Find player's seat
            if (account?.address) {
                const accountAddr = account.address.toString().toLowerCase();
                const seatIdx = seatsData.findIndex(
                    (s) => s?.player?.toLowerCase() === accountAddr
                );
                setPlayerSeat(seatIdx >= 0 ? seatIdx : null);
            }
        } catch (err) {
            console.error("Failed to load table:", err);
            setError("Failed to load table data. Please check the address.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTableData();

        // Poll for updates every 3 seconds
        const interval = setInterval(loadTableData, 3000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [address, account?.address]);

    useEffect(() => {
        if (config?.minBuyIn) {
            setBuyIn((prev) => (prev > 0 ? prev : config.minBuyIn));
        }
    }, [config?.minBuyIn]);

    const refreshBalance = useCallback(async () => {
        if (connected) {
            const value = await getBalance();
            setBalance(value);
        } else {
            setBalance(0);
        }
    }, [connected, getBalance]);

    useEffect(() => {
        refreshBalance();
    }, [refreshBalance, account?.address]);

    const handleSeatSelect = (seatIndex: number) => {
        setSelectedSeat(seatIndex);
        setJoinError(null);
        setJoinSuccess(null);
    };

    const handleJoin = async (event: FormEvent) => {
        event.preventDefault();
        setJoinError(null);
        setJoinSuccess(null);

        if (!connected || !account) {
            setJoinError("Connect your wallet to join the table.");
            return;
        }

        if (!address) {
            setJoinError("Table address is missing.");
            return;
        }

        if (selectedSeat === null) {
            setJoinError("Select an empty seat to join.");
            return;
        }

        if (!config) {
            setJoinError("Table configuration unavailable.");
            return;
        }

        if (seats[selectedSeat]) {
            setJoinError("That seat is already occupied.");
            return;
        }

        if (buyIn < config.minBuyIn || buyIn > config.maxBuyIn) {
            setJoinError(`Buy-in must be between ${config.minBuyIn} and ${config.maxBuyIn}.`);
            return;
        }

        if (buyIn > balance) {
            setJoinError("Insufficient chip balance for this buy-in.");
            return;
        }

        try {
            setJoining(true);
            await joinTable(address, selectedSeat, buyIn);
            setJoinSuccess("Joined table successfully!");
            await Promise.all([loadTableData(), refreshBalance()]);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to join the table.";
            setJoinError(message);
        } finally {
            setJoining(false);
        }
    };

    const emptySeats = useMemo(() => seats.map((seat, idx) => (!seat ? idx : null)).filter((idx) => idx !== null) as number[], [seats]);

    const joinDisabled =
        !connected ||
        selectedSeat === null ||
        joining ||
        !config ||
        !!seats[selectedSeat ?? -1] ||
        buyIn < (config?.minBuyIn ?? 0) ||
        buyIn > (config?.maxBuyIn ?? Infinity) ||
        buyIn > balance;

    if (loading && !config) {
        return (
            <div className="table-page loading">
                <div className="spinner" />
                <p>Loading table...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="table-page error">
                <p>{error}</p>
                <button className="btn btn-primary" onClick={loadTableData}>
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="table-page">
            <div className="table-layout">
                <aside className="table-sidebar">
                    {config && tableState && (
                        <TableInfo config={config} state={tableState} address={address!} />
                    )}

                    <section className="join-panel">
                        <div className="panel-header">
                            <h3>Join this table</h3>
                            <p>Choose an empty seat and set your buy-in.</p>
                        </div>

                        <form className="join-form" onSubmit={handleJoin}>
                            <label className="form-field">
                                <span>Seat</span>
                                <select
                                    value={selectedSeat ?? ""}
                                    onChange={(e) => handleSeatSelect(Number(e.target.value))}
                                    disabled={!connected || emptySeats.length === 0}
                                >
                                    <option value="" disabled>
                                        {emptySeats.length === 0 ? "No empty seats" : "Select a seat"}
                                    </option>
                                    {emptySeats.map((idx) => (
                                        <option key={idx} value={idx}>
                                            Seat {idx + 1}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="form-field">
                                <span>Buy-in</span>
                                <div className="input-hint">
                                    <input
                                        type="number"
                                        min={config?.minBuyIn}
                                        max={config?.maxBuyIn}
                                        value={buyIn}
                                        onChange={(e) => setBuyIn(Number(e.target.value))}
                                        disabled={!connected}
                                    />
                                    {config && (
                                        <small>
                                            Min {config.minBuyIn.toLocaleString()} / Max {config.maxBuyIn.toLocaleString()}
                                        </small>
                                    )}
                                </div>
                            </label>

                            <div className="form-meta">
                                <span>Your chips: {balance.toLocaleString()}</span>
                                {!connected && <span className="warning">Connect your wallet to join.</span>}
                            </div>

                            {joinError && <div className="alert error">{joinError}</div>}
                            {joinSuccess && <div className="alert success">{joinSuccess}</div>}

                            <button type="submit" className="btn btn-primary" disabled={joinDisabled}>
                                {joining ? "Joining..." : "Join table"}
                            </button>
                        </form>
                    </section>
                </aside>

                <main className="table-main">
                    <PokerTable
                        seats={seats}
                        gameState={gameState}
                        dealerSeat={tableState?.dealerSeat ?? 0}
                        playerSeat={playerSeat}
                        onSeatSelect={handleSeatSelect}
                        selectedSeat={selectedSeat}
                    />

                    {gameState && (
                        <LifecyclePanel
                            tableAddress={address!}
                            gameState={gameState}
                            seats={seats}
                            playerSeat={playerSeat}
                            tableState={tableState}
                            onRefresh={loadTableData}
                        />
                    )}

                    {connected && playerSeat !== null && gameState && (
                        <ActionPanel
                            tableAddress={address!}
                            seatIndex={playerSeat}
                            gameState={gameState}
                            seatInfo={seats[playerSeat]!}
                            onAction={loadTableData}
                        />
                    )}
                </main>
            </div>
        </div>
    );
}
