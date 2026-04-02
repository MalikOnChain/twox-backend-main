# BlueOcean Wallet Integration Documentation

## Overview

This document describes the implementation of BlueOcean Gaming's Seamless Wallet Integration for real money transactions.

## Architecture

```
BlueOcean Game Server → Your Wallet Endpoints → Your Database
                    ↓
            [BALANCE, DEBIT, CREDIT, ROLLBACK]
```

## Wallet Endpoints

Your backend now provides the following HTTPS GET endpoints that BlueOcean will call:

### 1. Balance Check
```
GET /api/slots-casino/blueocean/wallet/balance
Parameters:
- action=balance
- remote_id={user_id}
- session_id={session_id}
- key={sha1_signature}

Response:
{"status":"200","balance":"250"}
```

### 2. Debit (Place Bet)
```
GET /api/slots-casino/blueocean/wallet/debit
Parameters:
- action=debit
- remote_id={user_id}
- session_id={session_id}
- amount={bet_amount}
- transactionid={unique_transaction_id}
- key={sha1_signature}

Response:
{"status":"200","balance":"245"}
```

### 3. Credit (Pay Winnings)
```
GET /api/slots-casino/blueocean/wallet/credit
Parameters:
- action=credit
- remote_id={user_id}
- session_id={session_id}
- amount={win_amount}
- transactionid={unique_transaction_id}
- key={sha1_signature}

Response:
{"status":"200","balance":"255"}
```

### 4. Rollback (Cancel Transaction)
```
GET /api/slots-casino/blueocean/wallet/rollback
Parameters:
- action=rollback
- remote_id={user_id}
- session_id={session_id}
- transactionid={transaction_to_rollback}
- key={sha1_signature}

Response:
{"status":"200","balance":"250"}
```

## Security Implementation

### Signature Validation
All requests are validated using SHA1 signature:

```typescript
const queryString = "action=balance&remote_id=123&session_id=123-abc";
const expectedKey = sha1(SALT_KEY + queryString);
// Validate that the provided key matches expectedKey
```

### Environment Variables Required
```bash
BLUEOCEAN_SALT_KEY=your_salt_key_from_blueocean
BLUEOCEAN_API_URL=https://stage.game-program.com/api/seamless/provider
BLUEOCEAN_API_USERNAME=your_username
BLUEOCEAN_API_PASSWORD=your_password
```

## Game Flow Integration

### Updated Gameplay Flow
1. **Player clicks game** → Frontend calls `/slots-casino/blueocean/game/gameplay`
2. **Backend processes**:
   - `playerExists()` → `createPlayer()` (if needed) → `getGame()`
   - Returns game URL + `remote_id` + `session_id`
3. **Game loads** → BlueOcean calls your `/wallet/balance` endpoint
4. **Player spins** → BlueOcean calls `/wallet/debit` (place bet)
5. **Game resolves** → BlueOcean calls `/wallet/credit` (pay winnings)
6. **Cycle continues** until player closes game
7. **On error** → BlueOcean calls `/wallet/rollback` to cancel transactions

### Database Schema

#### BlueOcean Wallet Transactions
```typescript
{
  remote_id: string,           // User identifier
  session_id: string,          // Game session identifier
  transaction_id: string,      // Unique transaction ID
  action: 'debit' | 'credit' | 'rollback',
  amount: number,              // Transaction amount
  balance_before: number,      // User balance before transaction
  balance_after: number,       // User balance after transaction
  status: 'pending' | 'completed' | 'rolled_back',
  user_id: ObjectId,           // Reference to your User model
  game_id?: string,            // Game identifier
  created_at: Date,
  updated_at: Date
}
```

## Testing

### Local Testing
Run the test script to verify your endpoints:

```bash
cd /home/cat/twox/backend
node src/scripts/test-blueocean-wallet.js
```

### Manual Testing
Use the provided test form or curl commands:

```bash
# Test balance
curl "http://localhost:5000/api/slots-casino/blueocean/wallet/balance?action=balance&remote_id=test_user&session_id=test_session&key=generated_signature"

# Test debit
curl "http://localhost:5000/api/slots-casino/blueocean/wallet/debit?action=debit&remote_id=test_user&session_id=test_session&amount=100&transactionid=txn_123&key=generated_signature"
```

## Production Setup

### 1. Contact BlueOcean Support
Provide them with:
- Your wallet endpoint URLs (replace localhost with your domain)
- Your IP addresses for whitelisting
- Your staging/production environment details

### 2. Receive BlueOcean Credentials
You'll get:
- Production API endpoint URL
- API username/password
- Salt key for signature validation

### 3. Update Environment Variables
```bash
# Production
BLUEOCEAN_API_URL=https://production.game-program.com/api/seamless/provider
BLUEOCEAN_API_USERNAME=your_production_username
BLUEOCEAN_API_PASSWORD=your_production_password
BLUEOCEAN_SALT_KEY=your_production_salt_key
```

### 4. Test with Real BlueOcean API
- Sync games from production API
- Test game launch with real credentials
- Verify wallet transactions work correctly

## Error Handling

### Wallet Endpoint Errors
All wallet endpoints return standardized responses:

```json
{
  "status": "200",  // 200 = success, 400/500 = error
  "balance": "250", // Current user balance
  "error": "Optional error message"
}
```

### Transaction Rollback
If any wallet operation fails:
1. BlueOcean will send a `rollback` request
2. Your system will:
   - Find the original transaction
   - Reverse the balance change
   - Mark transaction as rolled back
   - Create rollback transaction record

## Monitoring and Logging

### Key Log Points
- Wallet endpoint calls (balance, debit, credit, rollback)
- Signature validation results
- Transaction processing status
- Error conditions and rollbacks

### Database Monitoring
Monitor the `BlueOceanWalletTransaction` collection for:
- Transaction volume and patterns
- Failed transactions
- Rollback frequency
- Balance discrepancies

## Security Considerations

1. **Signature Validation**: All requests must pass SHA1 signature validation
2. **IP Whitelisting**: BlueOcean will whitelist your IP addresses
3. **HTTPS Only**: All wallet endpoints must use HTTPS in production
4. **Transaction Idempotency**: Handle duplicate transaction IDs gracefully
5. **Balance Consistency**: Ensure atomic transactions to prevent balance corruption

## Troubleshooting

### Common Issues

1. **Invalid Signature**
   - Check `BLUEOCEAN_SALT_KEY` environment variable
   - Verify query parameter ordering matches BlueOcean's format

2. **User Not Found**
   - Ensure `remote_id` maps correctly to your user system
   - Check user exists and has sufficient balance

3. **Transaction Failures**
   - Monitor database connection and transaction isolation
   - Check for duplicate transaction IDs

4. **Balance Inconsistencies**
   - Verify all wallet operations are atomic
   - Check rollback logic handles all edge cases

### Debug Mode
Enable debug logging by setting:
```bash
DEBUG=blueocean:wallet
```

This will log all wallet operations with detailed information for troubleshooting.

