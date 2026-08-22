package main

import (
	"context"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"net/url"
	"time"
)

type PayUProvider struct {
	MerchantKey  string
	MerchantSalt string
}

func (p *PayUProvider) CreateSession(ctx context.Context, payload PaymentSessionRequest) (PaymentSessionResponse, error) {
	// Generate a unique transaction ID (PayU requires txnid to be unique)
	txnid := fmt.Sprintf("txn_%d_%d", payload.OrderID, time.Now().Unix())
	
	// Format amount to 2 decimal places
	amountStr := fmt.Sprintf("%.2f", math.Round(payload.Amount*100)/100)
	
	productInfo := "Order_" + fmt.Sprintf("%d", payload.OrderID)
	firstName := payload.CustomerName
	if firstName == "" {
		firstName = "Customer"
	}
	email := payload.CustomerEmail
	if email == "" {
		email = "customer@example.com"
	}

	// PayU Hash formula: sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT)
	// We leave UDFs empty
	hashString := fmt.Sprintf("%s|%s|%s|%s|%s|%s|||||||||||%s",
		p.MerchantKey, txnid, amountStr, productInfo, firstName, email, p.MerchantSalt)
	
	hasher := sha512.New()
	hasher.Write([]byte(hashString))
	hash := hex.EncodeToString(hasher.Sum(nil))

	// We bundle everything the frontend needs into the ClientSecret as JSON
	formFields := map[string]string{
		"key":         p.MerchantKey,
		"txnid":       txnid,
		"amount":      amountStr,
		"productinfo": productInfo,
		"firstname":   firstName,
		"email":       email,
		"phone":       "9999999999", // PayU requires phone, passing dummy if missing
		"surl":        payload.SuccessURL,
		"furl":        payload.CancelURL,
		"hash":        hash,
	}
	
	formFieldsJSON, _ := json.Marshal(formFields)

	return PaymentSessionResponse{
		TransactionID: txnid,
		CheckoutURL:   "https://test.payu.in/_payment", // Defaults to test. Can be made dynamic via settings later.
		ClientSecret:  string(formFieldsJSON),
	}, nil
}

func (p *PayUProvider) VerifyWebhook(payload []byte, signature string) (WebhookEvent, error) {
	// PayU Webhooks / Success Callbacks post form data back.
	// We need to parse the form data. However, the PaymentProvider interface gives us raw payload bytes.
	// Since PayU posts form-urlencoded data to the success URL, and our webhook endpoint might receive it differently,
	// let's assume payload is a JSON mapped from the form data (or we parse it here if it's urlencoded).
	
	// Since PayU posts form-urlencoded data to the success URL, we parse it as a query string
	data, err := url.ParseQuery(string(payload))
	if err != nil {
		return WebhookEvent{}, fmt.Errorf("failed to parse payu payload")
	}

	status := data.Get("status")
	txnid := data.Get("txnid")
	amount := data.Get("amount")
	productinfo := data.Get("productinfo")
	firstname := data.Get("firstname")
	email := data.Get("email")
	receivedHash := data.Get("hash")
	
	// Reverse Hash formula for PayU response:
	// sha512(SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
	hashString := fmt.Sprintf("%s|%s|||||||||||%s|%s|%s|%s|%s|%s",
		p.MerchantSalt, status, email, firstname, productinfo, amount, txnid, p.MerchantKey)
		
	hasher := sha512.New()
	hasher.Write([]byte(hashString))
	expectedHash := hex.EncodeToString(hasher.Sum(nil))

	if receivedHash != expectedHash {
		return WebhookEvent{}, fmt.Errorf("invalid payu signature")
	}

	// Extract OrderID from productInfo or txnid
	var orderID int
	fmt.Sscanf(productinfo, "Order_%d", &orderID)

	eventStatus := "Failed"
	if status == "success" {
		eventStatus = "Paid"
	}

	return WebhookEvent{
		OrderID:       uint(orderID),
		Status:        eventStatus,
		TransactionID: txnid,
	}, nil
}
