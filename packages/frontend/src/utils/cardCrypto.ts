/**
 * Card encryption/decryption utilities
 * 
 * Cards are XOR-encrypted using per-player keys derived from their commit secrets.
 * The contract uses: key = SHA3-256("holdem_cards" || secret || seat_idx)
 */

import { sha3_256 } from "@noble/hashes/sha3";

/**
 * Derive a card decryption key from the player's secret and seat index.
 * Matches the contract's derive_card_key function exactly.
 * 
 * Contract implementation:
 * ```move
 * fun derive_card_key(secret: &vector<u8>, seat_idx: u64): vector<u8> {
 *     let seed = b"holdem_cards";
 *     vector::append(&mut seed, *secret);
 *     vector::push_back(&mut seed, (seat_idx as u8));
 *     hash::sha3_256(seed)
 * }
 * ```
 * 
 * @param secret - The player's reveal secret (hex string or Uint8Array)
 * @param seatIdx - The player's seat index (0-4)
 * @returns 32-byte key as Uint8Array
 */
export function deriveCardKey(secret: string | Uint8Array, seatIdx: number): Uint8Array {
    // Convert secret to Uint8Array if it's a hex string
    let secretBytes: Uint8Array;
    if (typeof secret === 'string') {
        // Remove 0x prefix if present
        const hex = secret.startsWith('0x') ? secret.slice(2) : secret;
        secretBytes = new Uint8Array(hex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
    } else {
        secretBytes = secret;
    }

    // Create the input: "holdem_cards" || secret || seat_idx (as u8)
    const domainSeparator = new TextEncoder().encode("holdem_cards");
    const seatByte = new Uint8Array([seatIdx]);

    // Combine all parts
    const combined = new Uint8Array(domainSeparator.length + secretBytes.length + 1);
    combined.set(domainSeparator, 0);
    combined.set(secretBytes, domainSeparator.length);
    combined.set(seatByte, domainSeparator.length + secretBytes.length);

    // Hash with SHA3-256 (same as contract's cedra_std::hash::sha3_256)
    return sha3_256(combined);
}

/**
 * XOR decrypt cards using the derived key.
 * Each card is XORed with the corresponding byte of the key.
 * 
 * Contract implementation:
 * ```move
 * fun xor_encrypt_cards(cards: &vector<u8>, key: &vector<u8>): vector<u8> {
 *     let result = vector::empty<u8>();
 *     let i = 0;
 *     while (i < vector::length(cards)) {
 *         let card = *vector::borrow(cards, i);
 *         let key_byte = *vector::borrow(key, i % vector::length(key));
 *         vector::push_back(&mut result, card ^ key_byte);
 *         i = i + 1;
 *     };
 *     result
 * }
 * ```
 * 
 * @param encryptedCards - Array of encrypted card bytes (2 cards)
 * @param key - 32-byte decryption key
 * @returns Decrypted card values
 */
export function xorDecryptCards(encryptedCards: number[], key: Uint8Array): number[] {
    return encryptedCards.map((card, i) => card ^ key[i % key.length]);
}

/**
 * Attempt to decrypt hole cards for the current player.
 * 
 * @param encryptedCards - The encrypted hole cards from the contract
 * @param secret - The player's reveal secret (from sessionStorage)
 * @param seatIdx - The player's seat index
 * @returns Decrypted card values, or original if decryption fails
 */
export function decryptHoleCards(
    encryptedCards: number[],
    secret: string | null,
    seatIdx: number
): number[] {
    if (!secret || encryptedCards.length !== 2) {
        return encryptedCards;
    }

    try {
        const key = deriveCardKey(secret, seatIdx);
        return xorDecryptCards(encryptedCards, key);
    } catch (error) {
        console.warn('Failed to decrypt hole cards:', error);
        return encryptedCards;
    }
}

/**
 * Get the stored secret for a given table/player/hand combination.
 * This retrieves from sessionStorage where secrets are stored.
 */
export function getStoredSecret(
    tableAddress: string,
    playerAddress: string,
    handNumber: number
): string | null {
    if (!tableAddress || !playerAddress || handNumber <= 0) return null;

    const key = `holdem_secret_${tableAddress}_${playerAddress}_${handNumber}`.toLowerCase();
    try {
        return sessionStorage.getItem(key);
    } catch {
        return null;
    }
}

/**
 * Validate that decrypted cards are in valid range (0-51).
 * If cards are outside this range, decryption likely failed.
 */
export function isValidCard(cardValue: number): boolean {
    return cardValue >= 0 && cardValue <= 51;
}

/**
 * Check if decrypted cards are valid.
 */
export function areCardsValid(cards: number[]): boolean {
    return cards.length === 2 && cards.every(isValidCard);
}
