# Coinsbuy API リクエスト・レスポンス仕様

## Payment（Deposit）作成時のAPIリクエストとレスポンス

### 1. 認証リクエスト（先に実行される）

#### リクエスト

**エンドポイント:**
```
POST https://v3.api-sandbox.coinsbuy.com/token/
```

**ヘッダー:**
```http
Content-Type: application/vnd.api+json
Accept: application/vnd.api+json
```

**リクエストボディ:**
```json
{
  "data": {
    "type": "auth-token",
    "attributes": {
      "client_id": "YOUR_API_KEY",
      "client_secret": "YOUR_API_SECRET"
    }
  }
}
```

#### レスポンス

**成功時 (200 OK):**
```json
{
  "data": {
    "attributes": {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expires_in": 3600,
      "token_type": "Bearer"
    }
  }
}
```

または

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

---

### 2. Deposit作成リクエスト

#### リクエスト

**エンドポイント:**
```
POST https://v3.api-sandbox.coinsbuy.com/deposit/
```

**ヘッダー:**
```http
Content-Type: application/vnd.api+json
Accept: application/vnd.api+json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**リクエストボディ:**
```json
{
  "data": {
    "type": "deposit",
    "attributes": {
      "wallet": "12345",
      "currency": "USDT",
      "target_amount_requested": "100.00",
      "callback_url": "https://api.twox.gg/api/payments/coinsbuy/webhook",
      "label": "Deposit for user123",
      "tracking_id": "coinsbuy_user123_1234567890_abc123def"
    }
  }
}
```

**リクエストパラメータ説明:**

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `wallet` | string | ✅ | ウォレットID（COINSBUY_WALLET_ID環境変数またはリクエストで指定） |
| `currency` | string | ✅ | 暗号通貨コード（例: BTC, ETH, USDT） |
| `target_amount_requested` | string | ❌ | リクエストされた入金額（ウォレット通貨単位） |
| `callback_url` | string | ❌ | 支払い通知を受け取るURL |
| `label` | string | ❌ | デポジットのラベル（最大32文字） |
| `tracking_id` | string | ❌ | 外部システムでの追跡用ID（最大128文字） |

#### レスポンス

**成功時 (201 Created):**
```json
{
  "data": {
    "id": "123456",
    "type": "deposit",
    "attributes": {
      "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "currency": "USDT",
      "amount": "100.00",
      "status": 2,
      "is_active": true,
      "address_type": "",
      "label": "Deposit for user123",
      "tracking_id": "coinsbuy_user123_1234567890_abc123def",
      "confirmations_needed": null,
      "time_limit": null,
      "callback": "https://api.twox.gg/api/payments/coinsbuy/webhook",
      "inaccuracy": null,
      "target_amount_requested": "100.00",
      "rate_requested": "1.0",
      "rate_expired_at": "2024-01-01T12:00:00Z",
      "invoice_updated_at": null,
      "payment_page": "https://v3.api-sandbox.coinsbuy.com/payment/123456",
      "target_paid": "0.00",
      "source_amount_requested": "100.00",
      "target_paid_pending": "0.00",
      "assets": {},
      "destination": {
        "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        "currency": "USDT"
      },
      "created_at": "2024-01-01T10:00:00Z",
      "expires_at": "2024-01-01T10:30:00Z"
    }
  }
}
```

**レスポンスフィールド説明:**

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `id` | string | デポジットの一意のID |
| `type` | string | リソースタイプ（"deposit"） |
| `attributes.address` | string | 入金先の暗号通貨アドレス |
| `attributes.currency` | string | 暗号通貨コード |
| `attributes.amount` | string | リクエストされた金額 |
| `attributes.status` | number | ステータス（2=Created, 3=Paid, 4=Canceled, 5=Unresolved） |
| `attributes.is_active` | boolean | アドレスがアクティブかどうか（Algorand用） |
| `attributes.created_at` | string | 作成日時（ISO 8601形式） |
| `attributes.expires_at` | string | 有効期限（ISO 8601形式、nullの場合は無期限） |
| `attributes.payment_page` | string | 支払いページのURL |
| `attributes.target_paid` | string | 既に支払われた金額 |
| `attributes.callback` | string | コールバックURL |

**エラー時 (400 Bad Request):**
```json
{
  "errors": [
    {
      "status": "400",
      "title": "Bad Request",
      "detail": "Wallet field is required"
    }
  ]
}
```

**エラー時 (401 Unauthorized):**
```json
{
  "errors": [
    {
      "status": "401",
      "title": "Unauthorized",
      "detail": "Invalid access token"
    }
  ]
}
```

**エラー時 (404 Not Found):**
```json
{
  "errors": [
    {
      "status": "404",
      "title": "Not Found",
      "detail": "Endpoint not found"
    }
  ]
}
```

**エラー時 (429 Too Many Requests):**
```json
{
  "errors": [
    {
      "status": "429",
      "title": "Too Many Requests",
      "detail": "Rate limit exceeded"
    }
  ]
}
```

---

### 3. バックエンドからフロントエンドへのレスポンス

バックエンドは、Coinsbuyからのレスポンスを受け取った後、以下の形式でフロントエンドに返します：

**成功時 (201 Created):**
```json
{
  "success": true,
  "data": {
    "payment_id": "123456",
    "pay_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "pay_currency": "USDT",
    "price_amount": "100.00",
    "price_currency": "EUR",
    "order_id": "coinsbuy_user123_1234567890_abc123def",
    "created_at": "2024-01-01T10:00:00Z",
    "valid_until": "2024-01-01T10:30:00Z",
    "transaction_id": "507f1f77bcf86cd799439011"
  }
}
```

**エラー時 (500 Internal Server Error):**
```json
{
  "success": false,
  "error": "Failed to create deposit with payment provider"
}
```

---

## 実装例

### バックエンドでのリクエスト送信コード

```typescript
// backend/src/services/payment/Coinsbuy.service.ts

async createDeposit(request: CreateDepositRequest): Promise<CreateDepositResponse> {
  const requestBody = {
    data: {
      type: 'deposit',
      attributes: {
        wallet: request.wallet || this.config.walletId,
        currency: request.currency,
        callback_url: request.callback_url,
        target_amount_requested: request.amount?.toString(),
        label: request.metadata?.label,
        tracking_id: request.metadata?.tracking_id || request.metadata?.order_id,
      },
    },
  };

  const response = await this.axiosInstance.post<{ data: CreateDepositResponse }>(
    '/deposit/',
    requestBody
  );

  return response.data.data;
}
```

### コントローラーでの使用例

```typescript
// backend/src/controllers/PaymentControllers/Coinsbuy.controller.ts

const depositData = await CoinsbuyService.createDeposit({
  currency: 'USDT',
  amount: 100.00,
  callback_url: 'https://api.twox.gg/api/payments/coinsbuy/webhook',
  metadata: {
    user_id: userId,
    order_id: orderId,
    order_description: 'Deposit for user123',
    fiat_currency: 'EUR',
    fiat_amount: 100.00,
    network: 'ERC20',
  },
});
```

---

## 注意事項

1. **認証トークン**: すべてのAPIリクエストには有効なBearerトークンが必要です
2. **JSON API形式**: Coinsbuy API v3はJSON API仕様に準拠しています
3. **ウォレットID**: `wallet`フィールドは必須です。環境変数`COINSBUY_WALLET_ID`で設定できます
4. **レート制限**: 429エラーが発生した場合は、30秒間のクールダウン期間があります
5. **エンドポイント**: `/deposit/`（単数形、末尾スラッシュ付き）が公式エンドポイントです

