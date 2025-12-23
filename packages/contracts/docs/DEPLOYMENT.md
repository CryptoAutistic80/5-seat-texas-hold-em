# Deployment Guide - 5-Seat Texas Hold'em

## Latest Deployment

**Version:** 4.0.0 (Hole Cards Display)  
**Date:** 2025-12-23  
**Network:** Cedra Testnet

### Contract Address
```
0xfab3ac3aafdae5636d13a04605890867e2c30d8be8c8e9618cb7b9096c761fd3
```

### Transaction
- **Hash:** `0xaf34259b38baec3036534b8d24bfac469f6a516bcc1bfd4f1a06510eaf136572`
- **Explorer:** [View on Cedrascan](https://cedrascan.com/txn/0xaf34259b38baec3036534b8d24bfac469f6a516bcc1bfd4f1a06510eaf136572?network=testnet)
- **Status:** ✅ Executed successfully
- **Gas Used:** 26,249 units

### Deployed Modules
- `chips` - Chip token system (FA-based)
- `hand_eval` - Hand evaluation logic
- `pot_manager` - Pot & side pot management
- `poker_events` - 25 event types
- `texas_holdem` - Core game logic with admin controls

### Profile
- **Name:** `holdem_deployer_v2`
- **Network:** Testnet

### Changes in v4.0.0
- Added `get_hole_cards` view function to expose player cards
- Frontend now displays hole cards (2 per player) next to seats
- Community cards (flop/turn/river) display in center of table
- Small card styling for hole cards

---

## Quick Start

```bash
# Set contract address
export ADDR=0xfab3ac3aafdae5636d13a04605890867e2c30d8be8c8e9618cb7b9096c761fd3

# Buy chips (0.1 CEDRA = 100 chips)
cedra move run --function-id $ADDR::chips::buy_chips \
  --args u64:100000000 --profile holdem_deployer_v2

# Create table (5/10 blinds, 100-10000 buy-in, no ante, straddle enabled)
cedra move run --function-id $ADDR::texas_holdem::create_table \
  --args u64:5 u64:10 u64:100 u64:10000 address:$ADDR u64:0 bool:true \
  --profile holdem_deployer_v2

# Join table at seat 0 with 500 chips
cedra move run --function-id $ADDR::texas_holdem::join_table \
  --args address:<TABLE_ADDR> u64:0 u64:500 --profile holdem_deployer_v2

# Start hand
cedra move run --function-id $ADDR::texas_holdem::start_hand \
  --args address:<TABLE_ADDR> --profile holdem_deployer_v2
```

---

## Previous Deployments

| Version | Date | Address | Profile | Notes |
|---------|------|---------|---------|-------|
| 1.0.0 | 2025-12-21 | `0x736ddb...557b` | holdem_testnet | Initial edge-case fixes |
| 2.0.0 | 2025-12-21 | `0x88d4e4...665f` | holdem_v2 | Frontend integration |
| 3.0.0 | 2025-12-22 | `0xb45d81...574b` | holdem_deployer_V1 | Bug fixes + Admin controls |
| 4.0.0 | 2025-12-23 | `0xfab3ac...1fd3` | holdem_deployer_v2 | Hole cards display |

---

## Redeployment

```bash
# Create new profile
cedra init --profile <name> --network testnet

# Deploy
cedra move publish --profile <name> \
  --named-addresses holdemgame=<profile_address> --assume-yes
```

---

## Frontend Configuration

Update `packages/frontend/src/config/contracts.ts` with the new contract address:
```typescript
export const CONTRACT_ADDRESS = "0xfab3ac3aafdae5636d13a04605890867e2c30d8be8c8e9618cb7b9096c761fd3";
```

Or set via environment variable in `packages/frontend/.env`:
```
VITE_CONTRACT_ADDRESS=0xfab3ac3aafdae5636d13a04605890867e2c30d8be8c8e9618cb7b9096c761fd3
```

