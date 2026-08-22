package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/stripe/stripe-go/v74/webhook"
)

type StripeProvider struct {
	SecretKey     string
	WebhookSecret string
}

func (p *StripeProvider) CreateSession(ctx context.Context, payload PaymentSessionRequest) (PaymentSessionResponse, error) {
	form := url.Values{}
	form.Add("success_url", payload.SuccessURL)
	form.Add("cancel_url", payload.CancelURL)
	form.Add("mode", "payment")
	form.Add("line_items[0][price_data][currency]", strings.ToLower(payload.Currency))
	form.Add("line_items[0][price_data][product_data][name]", fmt.Sprintf("Order #%d", payload.OrderID))
	form.Add("line_items[0][price_data][unit_amount]", fmt.Sprintf("%d", int(payload.Amount*100)))
	form.Add("line_items[0][quantity]", "1")
	form.Add("client_reference_id", fmt.Sprintf("%d", payload.OrderID))
	form.Add("billing_address_collection", "required")
	if payload.CustomerEmail != "" {
		form.Add("customer_email", payload.CustomerEmail)
	}

	req, _ := http.NewRequestWithContext(ctx, "POST", "https://api.stripe.com/v1/checkout/sessions", strings.NewReader(form.Encode()))
	req.SetBasicAuth(p.SecretKey, "")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return PaymentSessionResponse{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return PaymentSessionResponse{}, fmt.Errorf("stripe api error: status %d, body: %s", resp.StatusCode, string(bodyBytes))
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	checkoutURL, _ := result["url"].(string)
	sessionID, _ := result["id"].(string)

	return PaymentSessionResponse{
		TransactionID: sessionID,
		CheckoutURL:   checkoutURL,
	}, nil
}

func (p *StripeProvider) VerifyWebhook(payload []byte, signature string) (WebhookEvent, error) {
	event, err := webhook.ConstructEvent(payload, signature, p.WebhookSecret)
	if err != nil {
		return WebhookEvent{}, err
	}

	if event.Type == "checkout.session.completed" {
		var sessionData map[string]interface{}
		if err := json.Unmarshal(event.Data.Raw, &sessionData); err != nil {
			return WebhookEvent{}, err
		}

		clientRef, _ := sessionData["client_reference_id"].(string)
		orderID, _ := strconv.Atoi(clientRef)
		sessID, _ := sessionData["id"].(string)

		return WebhookEvent{
			OrderID:       uint(orderID),
			Status:        "Paid",
			TransactionID: sessID,
		}, nil
	}

	return WebhookEvent{Status: "Ignored"}, nil
}
