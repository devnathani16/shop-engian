package main

import (
	"context"
	"encoding/json"
)

type PaymentSessionRequest struct {
	OrderID       uint
	Amount        float64
	Currency      string
	CustomerEmail string
	CustomerName  string
	SuccessURL    string
	CancelURL     string
}

type PaymentSessionResponse struct {
	TransactionID string
	CheckoutURL   string
	ClientSecret  string // For Stripe Elements or Razorpay script if needed
}

type WebhookEvent struct {
	OrderID       uint
	Status        string // "Paid", "Failed"
	TransactionID string
	RawError      string
}

type PaymentProvider interface {
	CreateSession(ctx context.Context, payload PaymentSessionRequest) (PaymentSessionResponse, error)
	VerifyWebhook(payload []byte, signature string) (WebhookEvent, error)
}

func GetPaymentProvider(providerName string, authConfigJSON string) PaymentProvider {
	var auth map[string]interface{}
	
	// Attempt decryption
	if decrypted, err := DecryptAES([]byte(AppConfig.EncryptionMasterKey), authConfigJSON); err == nil {
		json.Unmarshal([]byte(decrypted), &auth)
	} else {
		json.Unmarshal([]byte(authConfigJSON), &auth)
	}

	switch providerName {
	case "stripe":
		return &StripeProvider{
			SecretKey:     getString(auth, "secret_key"),
			WebhookSecret: getString(auth, "webhook_secret"),
		}
	case "razorpay":
		return &RazorpayProvider{
			KeyID:         getString(auth, "key_id"),
			KeySecret:     getString(auth, "key_secret"),
			WebhookSecret: getString(auth, "webhook_secret"),
		}
	case "payu":
		return &PayUProvider{
			MerchantKey:  getString(auth, "merchant_key"),
			MerchantSalt: getString(auth, "merchant_salt"),
		}
	case "cashfree":
		return &CashfreeProvider{
			AppID:       getString(auth, "app_id"),
			SecretKey:   getString(auth, "secret_key"),
			Environment: getString(auth, "environment"),
		}
	case "paypal":
		return &PayPalProvider{
			ClientID:     getString(auth, "client_id"),
			ClientSecret: getString(auth, "client_secret"),
			Environment:  getString(auth, "environment"),
			WebhookID:    getString(auth, "webhook_id"),
		}
	default:
		return nil
	}
}

func getString(m map[string]interface{}, key string) string {
	if val, ok := m[key].(string); ok {
		return val
	}
	return ""
}
