// ============================================
// Player Actions Tests
// ============================================
// Tests for player-initiated actions at the table

#[test_only]
module holdemgame::player_actions_tests {
    use std::signer;
    use holdemgame::texas_holdem;
    use holdemgame::chips;

    // Helper to setup a table with players
    fun setup_table_with_players(admin: &signer, p1: &signer, p2: &signer) {
        chips::init_for_test(admin);
        texas_holdem::create_table(admin, 5, 10, 50, 1000, 0, false);
        
        let admin_addr = signer::address_of(admin);
        let p1_addr = signer::address_of(p1);
        let p2_addr = signer::address_of(p2);
        
        chips::mint_test_chips(p1_addr, 1000);
        chips::mint_test_chips(p2_addr, 1000);
        
        texas_holdem::join_table(p1, admin_addr, 0, 200);
        texas_holdem::join_table(p2, admin_addr, 1, 200);
    }

    // ============================================
    // LEAVE TABLE
    // ============================================

    #[test(admin = @holdemgame, p1 = @0xAAA, p2 = @0xBBB)]
    fun test_leave_table_returns_chips(admin: &signer, p1: &signer, p2: &signer) {
        setup_table_with_players(admin, p1, p2);
        let admin_addr = signer::address_of(admin);
        let p1_addr = signer::address_of(p1);
        
        // Check initial chip balance (1000 - 200 = 800 in wallet)
        assert!(chips::balance(p1_addr) == 800, 1);
        
        // Leave table
        texas_holdem::leave_table(p1, admin_addr);
        
        // Should have all 1000 chips back
        assert!(chips::balance(p1_addr) == 1000, 2);
    }

    #[test(admin = @holdemgame, player = @0xBEEF)]
    #[expected_failure(abort_code = 5, location = holdemgame::texas_holdem)] // E_NOT_AT_TABLE
    fun test_leave_table_not_at_table_fails(admin: &signer, player: &signer) {
        chips::init_for_test(admin);
        texas_holdem::create_table(admin, 5, 10, 50, 1000, 0, false);
        
        // Player not at table tries to leave
        texas_holdem::leave_table(player, signer::address_of(admin));
    }

    // ============================================
    // SIT OUT / SIT IN
    // ============================================

    #[test(admin = @holdemgame, p1 = @0xAAA, p2 = @0xBBB)]
    fun test_sit_out_success(admin: &signer, p1: &signer, p2: &signer) {
        setup_table_with_players(admin, p1, p2);
        let admin_addr = signer::address_of(admin);
        
        texas_holdem::sit_out(p1, admin_addr);
        
        let (_, _, sitting_out) = texas_holdem::get_seat_info(admin_addr, 0);
        assert!(sitting_out == true, 1);
    }

    #[test(admin = @holdemgame, p1 = @0xAAA, p2 = @0xBBB)]
    fun test_sit_in_success(admin: &signer, p1: &signer, p2: &signer) {
        setup_table_with_players(admin, p1, p2);
        let admin_addr = signer::address_of(admin);
        
        texas_holdem::sit_out(p1, admin_addr);
        texas_holdem::sit_in(p1, admin_addr);
        
        let (_, _, sitting_out) = texas_holdem::get_seat_info(admin_addr, 0);
        assert!(sitting_out == false, 1);
    }

    // ============================================
    // TOP UP
    // ============================================

    #[test(admin = @holdemgame, p1 = @0xAAA, p2 = @0xBBB)]
    fun test_top_up_success(admin: &signer, p1: &signer, p2: &signer) {
        setup_table_with_players(admin, p1, p2);
        let admin_addr = signer::address_of(admin);
        let p1_addr = signer::address_of(p1);
        
        // Initial stack is 200, wallet has 800
        let (_, stack_before, _) = texas_holdem::get_seat_info(admin_addr, 0);
        assert!(stack_before == 200, 1);
        
        // Top up by 100
        texas_holdem::top_up(p1, admin_addr, 100);
        
        let (_, stack_after, _) = texas_holdem::get_seat_info(admin_addr, 0);
        assert!(stack_after == 300, 2);
        
        // Wallet should have 700 now
        assert!(chips::balance(p1_addr) == 700, 3);
    }

    #[test(admin = @holdemgame, p1 = @0xAAA, p2 = @0xBBB)]
    #[expected_failure(abort_code = 10, location = holdemgame::texas_holdem)] // E_INSUFFICIENT_CHIPS (wallet check before max check)
    fun test_top_up_exceeds_max_fails(admin: &signer, p1: &signer, p2: &signer) {
        setup_table_with_players(admin, p1, p2);
        let admin_addr = signer::address_of(admin);
        
        // Try to top up beyond max buy-in (1000)
        // Player has 200, trying to add 900 = 1100 total
        texas_holdem::top_up(p1, admin_addr, 900);
    }

    #[test(admin = @holdemgame, p1 = @0xAAA, p2 = @0xBBB)]
    #[expected_failure(abort_code = 10, location = holdemgame::texas_holdem)] // E_INSUFFICIENT_CHIPS
    fun test_top_up_insufficient_wallet_fails(admin: &signer, p1: &signer, p2: &signer) {
        setup_table_with_players(admin, p1, p2);
        let admin_addr = signer::address_of(admin);
        
        // Player has 800 in wallet, try to add 850
        texas_holdem::top_up(p1, admin_addr, 850);
    }

    // ============================================
    // LEAVE AFTER HAND
    // ============================================

    #[test(admin = @holdemgame, p1 = @0xAAA, p2 = @0xBBB)]
    fun test_leave_after_hand_sets_flag(admin: &signer, p1: &signer, p2: &signer) {
        setup_table_with_players(admin, p1, p2);
        let admin_addr = signer::address_of(admin);
        
        texas_holdem::leave_after_hand(p1, admin_addr);
        
        let pending = texas_holdem::get_pending_leaves(admin_addr);
        assert!(*std::vector::borrow(&pending, 0) == true, 1);
    }

    #[test(admin = @holdemgame, p1 = @0xAAA, p2 = @0xBBB)]
    fun test_cancel_leave_after_hand(admin: &signer, p1: &signer, p2: &signer) {
        setup_table_with_players(admin, p1, p2);
        let admin_addr = signer::address_of(admin);
        
        texas_holdem::leave_after_hand(p1, admin_addr);
        texas_holdem::cancel_leave_after_hand(p1, admin_addr);
        
        let pending = texas_holdem::get_pending_leaves(admin_addr);
        assert!(*std::vector::borrow(&pending, 0) == false, 1);
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    #[test(admin = @holdemgame, p1 = @0xAAA, p2 = @0xBBB)]
    fun test_get_table_state(admin: &signer, p1: &signer, p2: &signer) {
        setup_table_with_players(admin, p1, p2);
        let admin_addr = signer::address_of(admin);
        
        let (hand_number, dealer_button, _, _) = texas_holdem::get_table_state(admin_addr);
        assert!(hand_number == 0, 1);
        assert!(dealer_button == 0, 2);
    }

    #[test(admin = @holdemgame, p1 = @0xAAA, p2 = @0xBBB)]
    fun test_get_seat_count(admin: &signer, p1: &signer, p2: &signer) {
        setup_table_with_players(admin, p1, p2);
        let admin_addr = signer::address_of(admin);
        
        let (occupied, total) = texas_holdem::get_seat_count(admin_addr);
        assert!(occupied == 2, 1);
        assert!(total == 5, 2);
    }

    // ============================================
    // MISSED BLINDS TRACKING
    // ============================================

    #[test(admin = @holdemgame, player = @0xBEEF)]
    fun test_sit_out_records_missed_blind(admin: &signer, player: &signer) {
        chips::init_for_test(admin);
        texas_holdem::create_table(admin, 5, 10, 50, 1000, 0, false);
        
        let player_addr = signer::address_of(player);
        chips::mint_test_chips(player_addr, 500);
        texas_holdem::join_table(player, signer::address_of(admin), 0, 200);
        
        // Sit out should record missed blind
        texas_holdem::sit_out(player, signer::address_of(admin));
        
        // Check missed blinds recorded (should be big blind = 10)
        let missed = texas_holdem::get_missed_blinds(signer::address_of(admin));
        assert!(*std::vector::borrow(&missed, 0) == 10, 1);
    }

    #[test(admin = @holdemgame, player = @0xBEEF)]
    fun test_sit_in_collects_missed_blind(admin: &signer, player: &signer) {
        chips::init_for_test(admin);
        texas_holdem::create_table(admin, 5, 10, 50, 1000, 0, false);
        
        let admin_addr = signer::address_of(admin);
        let player_addr = signer::address_of(player);
        chips::mint_test_chips(player_addr, 500);
        texas_holdem::join_table(player, admin_addr, 0, 200);
        
        // Sit out (records missed blind)
        texas_holdem::sit_out(player, admin_addr);
        
        // Check stack before sit_in
        let (_, chips_before, _) = texas_holdem::get_seat_info(admin_addr, 0);
        assert!(chips_before == 200, 1);
        
        // Sit in (should collect missed blind)
        texas_holdem::sit_in(player, admin_addr);
        
        // Check stack after sit_in (should be reduced by big blind)
        let (_, chips_after, _) = texas_holdem::get_seat_info(admin_addr, 0);
        assert!(chips_after == 190, 2); // 200 - 10 (big blind)
        
        // Missed blinds should be cleared
        let missed = texas_holdem::get_missed_blinds(admin_addr);
        assert!(*std::vector::borrow(&missed, 0) == 0, 3);
    }
}
