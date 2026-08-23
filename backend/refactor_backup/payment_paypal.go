package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"
	"time"
)

type PayPalProvider struct {
	ClientID     string
	ClientSecret string
	Environment  string
	WebhookID    string
}

func (p *PayPalProvider) getBaseURL() string {
	if p.Environment == "production" {
		return "https://api-m.paypal.com"
	}
	return "https://api-m.sandbox.paypal.com"
}

func (p *PayPalProvider) getAccessToken() (string, error) {
	url := fmt.Sprintf("%s/v1/oauth2/token", p.getBaseURL())
	
	req, err := http.NewRequest("POST", url, strings.NewReader("grant_type=client_credentials"))
	if err != nil {
		return "", err
	}
	
	auth := base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("%s:%s", p.ClientID, p.ClientSecret)))
	req.Header.Add("Authorization", "Basic "+auth)
	req.Header.Add("Content-Type", "application/x-www-form-urlencoded")
	
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("failed to get access token, status: %d", resp.StatusCode)
	}
	
	var result struct {
		AccessToken string `json:"access_token"`
	}
	
	body, _ := ioutil.ReadAll(resp.Body)
	json.Unmarshal(body, &result)
	
	return result.AccessToken, nil
}

// getLiveExchangeRate fetches real-time currency conversion rates.
// It falls back to a hardcoded rate if the API fails to prevent checkout blocking.
func getLiveExchangeRate(base string, target string) float64 {
	rate := 83.5 // Fallback for USD to INR
	
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get(fmt.Sprintf("https://open.er-api.com/v6/latest/%s", base))
	if err == nil {
		defer resp.Body.Close()
		var result struct {
			Rates map[string]float64 `json:"rates"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&result); err == nil {
			if r, ok := result.Rates[target]; ok {
				rate = r
			}
		}
	}
	return rate
}

func (p *PayPalProvider) CreateSession(ctx context.Context, payload PaymentSessionRequest) (PaymentSessionResponse, error) {
	token, err := p.getAccessToken()
	if err != nil {
		return PaymentSessionResponse{}, err
	}
	
	url := fmt.Sprintf("%s/v2/checkout/orders", p.getBaseURL())
	
	currency := payload.Currency
	amount := payload.Amount

	// PayPal does not support INR natively for direct processing in many sandbox accounts.
	// Automatically convert to USD for testing purposes using live exchange rates.
	if currency == "INR" {
		currency = "USD"
		liveRate := getLiveExchangeRate("USD", "INR")
		amount = amount / liveRate
	}

	orderPayload := map[string]interface{}{
		"intent": "CAPTURE",
		"purchase_units": []map[string]interface{}{
			{
				"reference_id": fmt.Sprintf("ORDER_%d", payload.OrderID),
				"custom_id":    fmt.Sprintf("%d", payload.OrderID),
				"amount": map[string]interface{}{
					"currency_code": currency,
					"value":         fmt.Sprintf("%.2f", amount),
				},
			},
		},
		"application_context": map[string]interface{}{
			"return_url":          payload.SuccessURL,
			"cancel_url":          payload.CancelURL,
			"shipping_preference": "NO_SHIPPING",
			"user_action":         "PAY_NOW",
		},
	}
	
	jsonPayload, _ := json.Marshal(orderPayload)
	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(jsonPayload))
	req.Header.Add("Authorization", "Bearer "+token)
	req.Header.Add("Content-Type", "application/json")
	
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return PaymentSessionResponse{}, err
	}
	defer resp.Body.Close()
	
	body, _ := ioutil.ReadAll(resp.Body)
	
	if resp.StatusCode >= 300 {
		return PaymentSessionResponse{}, fmt.Errorf("paypal API error: %s", string(body))
	}
	
	var result struct {
		ID    string `json:"id"`
		Links []struct {
			Rel  string `json:"rel"`
			Href string `json:"href"`
		} `json:"links"`
	}
	json.Unmarshal(body, &result)
	
	var approveURL string
	for _, link := range result.Links {
		if link.Rel == "approve" {
			approveURL = link.Href
			break
		}
	}
	
	if approveURL == "" {
		return PaymentSessionResponse{}, fmt.Errorf("no approve link returned from PayPal")
	}
	
	return PaymentSessionResponse{
		TransactionID: result.ID,
		CheckoutURL:   approveURL,
		ClientSecret:  "", // Not needed for PayPal hosted checkout
	}, nil
}

func (p *PayPalProvider) VerifyWebhook(payload []byte, signature string) (WebhookEvent, error) {
	var event struct {
		EventType string `json:"event_type"`
		Resource  struct {
			ID            string `json:"id"`
			Status        string `json:"status"` // COMPLETED for captures
			SupplementaryData struct {
				RelatedIds struct {
					OrderID string `json:"order_id"`
				} `json:"related_ids"`
			} `json:"supplementary_data"`
			CustomID string `json:"custom_id"` 
		} `json:"resource"`
	}
	
	if err := json.Unmarshal(payload, &event); err != nil {
		return WebhookEvent{}, err
	}
	
	parts := strings.Split(signature, "|")
	if len(parts) != 5 {
		return WebhookEvent{}, fmt.Errorf("invalid paypal signature parts")
	}

	token, err := p.getAccessToken()
	if err != nil {
		return WebhookEvent{}, err
	}

	verifyBody := map[string]interface{}{
		"auth_algo":         parts[0],
		"cert_url":          parts[1],
		"transmission_id":   parts[2],
		"transmission_sig":  parts[3],
		"transmission_time": parts[4],
		"webhook_id":        p.WebhookID,
		"webhook_event":     json.RawMessage(payload),
	}
	verifyJSON, _ := json.Marshal(verifyBody)

	url := fmt.Sprintf("%s/v1/notifications/verify-webhook-signature", p.getBaseURL())
	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(verifyJSON))
	req.Header.Add("Authorization", "Bearer "+token)
	req.Header.Add("Content-Type", "application/json")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return WebhookEvent{}, err
	}
	defer resp.Body.Close()

	var verifyResp struct {
		VerificationStatus string `json:"verification_status"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&verifyResp); err != nil {
		return WebhookEvent{}, err
	}

	if verifyResp.VerificationStatus != "SUCCESS" {
		return WebhookEvent{}, fmt.Errorf("paypal signature verification failed: %s", verifyResp.VerificationStatus)
	}

	status := "Failed"
	if event.EventType == "PAYMENT.CAPTURE.COMPLETED" {
		status = "Paid"
	}

	var orderID uint
	fmt.Sscanf(event.Resource.CustomID, "%d", &orderID)

	return WebhookEvent{
		OrderID:       orderID,
		Status:        status,
		TransactionID: event.Resource.ID,
		RawError:      "",
	}, nil
}
