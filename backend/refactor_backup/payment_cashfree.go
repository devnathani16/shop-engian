package main

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"strconv"
	"strings"
)

type CashfreeProvider struct {
	AppID       string
	SecretKey   string
	Environment string
}

func (p *CashfreeProvider) getBaseURL() string {
	if p.Environment == "production" {
		return "https://api.cashfree.com/pg"
	}
	return "https://sandbox.cashfree.com/pg"
}

func (p *CashfreeProvider) CreateSession(ctx context.Context, req PaymentSessionRequest) (PaymentSessionResponse, error) {
	url := fmt.Sprintf("%s/orders", p.getBaseURL())

	payload := map[string]interface{}{
		"order_id":       fmt.Sprintf("order_%d", req.OrderID),
		"order_amount":   req.Amount,
		"order_currency": req.Currency,
		"customer_details": map[string]string{
			"customer_id":    fmt.Sprintf("cust_%d", req.OrderID),
			"customer_email": req.CustomerEmail,
			"customer_phone": "9999999999",
		},
		"order_meta": map[string]string{
			"return_url": req.SuccessURL + "&cf_order_id={order_id}",
		},
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return PaymentSessionResponse{}, err
	}

	httpReq, err := http.NewRequest("POST", url, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return PaymentSessionResponse{}, err
	}

	httpReq.Header.Set("x-client-id", strings.TrimSpace(p.AppID))
	httpReq.Header.Set("x-client-secret", strings.TrimSpace(p.SecretKey))
	httpReq.Header.Set("x-api-version", "2023-08-01")
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")

	log.Printf("[Cashfree Debug] AppID Length: %d, Secret Length: %d", len(p.AppID), len(p.SecretKey))
	if len(p.AppID) > 4 && len(p.SecretKey) > 4 {
		log.Printf("[Cashfree Debug] AppID: %s...%s, Secret: %s...%s", p.AppID[:4], p.AppID[len(p.AppID)-4:], p.SecretKey[:4], p.SecretKey[len(p.SecretKey)-4:])
	}
	log.Printf("[Cashfree Debug] Environment: %s, Using Base URL: %s", p.Environment, url)

	client := &http.Client{}
	resp, err := client.Do(httpReq)
	if err != nil {
		return PaymentSessionResponse{}, err
	}
	defer resp.Body.Close()

	respBody, _ := ioutil.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return PaymentSessionResponse{}, fmt.Errorf("cashfree error: %s", string(respBody))
	}

	var result struct {
		OrderToken       string `json:"order_token"`
		PaymentSessionID string `json:"payment_session_id"`
		OrderID          string `json:"order_id"`
	}

	if err := json.Unmarshal(respBody, &result); err != nil {
		return PaymentSessionResponse{}, err
	}

	return PaymentSessionResponse{
		TransactionID: result.OrderID,
		ClientSecret:  result.PaymentSessionID,
		CheckoutURL:   "",
	}, nil
}

// VerifyOrder checks the payment status of a Cashfree order via their API
func (p *CashfreeProvider) VerifyOrder(orderID string) (string, error) {
	url := fmt.Sprintf("%s/orders/%s", p.getBaseURL(), orderID)

	httpReq, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", err
	}

	httpReq.Header.Set("x-client-id", strings.TrimSpace(p.AppID))
	httpReq.Header.Set("x-client-secret", strings.TrimSpace(p.SecretKey))
	httpReq.Header.Set("x-api-version", "2023-08-01")

	client := &http.Client{}
	resp, err := client.Do(httpReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, _ := ioutil.ReadAll(resp.Body)

	var result struct {
		OrderStatus string `json:"order_status"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", err
	}

	log.Printf("[Cashfree Verify] Order %s status: %s", orderID, result.OrderStatus)
	return result.OrderStatus, nil
}

func (p *CashfreeProvider) VerifyWebhook(payload []byte, signature string) (WebhookEvent, error) {
	// signature contains "timestamp|hash" from webhooks.go
	parts := strings.Split(signature, "|")
	if len(parts) != 2 {
		return WebhookEvent{}, fmt.Errorf("invalid cashfree signature format")
	}
	timestampStr := parts[0]
	sigHeader := parts[1]

	// Cashfree verification: HMAC-SHA256 of (timestamp + rawBody) with secretKey
	message := timestampStr + string(payload)
	mac := hmac.New(sha256.New, []byte(p.SecretKey))
	mac.Write([]byte(message))
	expectedMac := base64.StdEncoding.EncodeToString(mac.Sum(nil))

	if expectedMac != sigHeader {
		return WebhookEvent{}, fmt.Errorf("invalid cashfree webhook signature")
	}

	var data struct {
		Data struct {
			Order struct {
				OrderID string `json:"order_id"`
			} `json:"order"`
			Payment struct {
				PaymentStatus string `json:"payment_status"`
			} `json:"payment"`
		} `json:"data"`
		Type string `json:"type"` // e.g. PAYMENT_SUCCESS_WEBHOOK
	}

	if err := json.Unmarshal(payload, &data); err != nil {
		return WebhookEvent{}, err
	}

	// Assuming our OrderID is what Cashfree returns in data.order.order_id
	// Cashfree generates their own if we don't supply one, but we didn't supply order_id in CreateSession.
	// Wait, in CreateSession I should supply order_id = fmt.Sprintf("order_%d", req.OrderID) so we can map it back.
	// Let's assume order_id contains the ID.
	orderIDStr := strings.TrimPrefix(data.Data.Order.OrderID, "order_")
	orderID, _ := strconv.ParseUint(orderIDStr, 10, 32)

	status := "Failed"
	if data.Type == "PAYMENT_SUCCESS_WEBHOOK" || data.Data.Payment.PaymentStatus == "SUCCESS" {
		status = "Paid"
	}

	return WebhookEvent{
		OrderID:       uint(orderID),
		Status:        status,
		TransactionID: data.Data.Order.OrderID,
		RawError:      "",
	}, nil
}
