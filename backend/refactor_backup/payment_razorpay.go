package main

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"strings"
)

type RazorpayProvider struct {
	KeyID         string
	KeySecret     string
	WebhookSecret string
}

func (p *RazorpayProvider) CreateSession(ctx context.Context, payload PaymentSessionRequest) (PaymentSessionResponse, error) {
	reqBody := fmt.Sprintf(`{"amount": %d, "currency": "INR", "receipt": "receipt_%d", "notes": {"order_id": "%d"}}`, int(math.Round(payload.Amount*100)), payload.OrderID, payload.OrderID)

	req, _ := http.NewRequestWithContext(ctx, "POST", "https://api.razorpay.com/v1/orders", strings.NewReader(reqBody))
	req.SetBasicAuth(p.KeyID, p.KeySecret)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return PaymentSessionResponse{}, err
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	fmt.Printf("[Razorpay Debug] Status: %d, Response: %s\n", resp.StatusCode, string(bodyBytes))

	if resp.StatusCode >= 400 {
		return PaymentSessionResponse{}, fmt.Errorf("razorpay api error: status %d - body: %s", resp.StatusCode, string(bodyBytes))
	}

	var result map[string]interface{}
	json.Unmarshal(bodyBytes, &result)

	orderID, _ := result["id"].(string)

	return PaymentSessionResponse{
		TransactionID: orderID,
	}, nil
}

func (p *RazorpayProvider) VerifyWebhook(payload []byte, signature string) (WebhookEvent, error) {
	mac := hmac.New(sha256.New, []byte(p.WebhookSecret))
	mac.Write(payload)
	expectedSignature := hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(signature), []byte(expectedSignature)) {
		return WebhookEvent{}, fmt.Errorf("invalid razorpay signature")
	}

	var event struct {
		Event   string `json:"event"`
		Payload struct {
			Payment struct {
				Entity struct {
					ID    string `json:"id"`
					Notes struct {
						OrderID string `json:"order_id"`
					} `json:"notes"`
				} `json:"entity"`
			} `json:"payment"`
		} `json:"payload"`
	}

	if err := json.Unmarshal(payload, &event); err != nil {
		return WebhookEvent{}, err
	}

	if event.Event == "payment.captured" || event.Event == "payment.authorized" || event.Event == "order.paid" {
		orderIDStr := event.Payload.Payment.Entity.Notes.OrderID
		var orderID int
		fmt.Sscanf(orderIDStr, "%d", &orderID)

		if orderID > 0 {
			return WebhookEvent{
				OrderID:       uint(orderID),
				Status:        "Paid",
				TransactionID: event.Payload.Payment.Entity.ID,
			}, nil
		}
	}

	return WebhookEvent{Status: "Ignored"}, nil
}
