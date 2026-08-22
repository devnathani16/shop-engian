package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"time"
)

var aimlHTTPClient = &http.Client{
	Timeout: 30 * time.Second,
}

func CallAIMLService(endpoint string, payload interface{}, target interface{}) error {
	url := "http://127.0.0.1:8000" + endpoint
	
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	
	// Inject LLM Firewall Auth Header
	secret := os.Getenv("AIML_INTERNAL_SECRET")
	if secret == "" {
		secret = "super-secret-default"
	}
	req.Header.Set("X-Internal-Secret", secret)

	resp, err := aimlHTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := ioutil.ReadAll(resp.Body)
		return fmt.Errorf("AIML service returned status %d: %s", resp.StatusCode, string(body))
	}

	if target != nil {
		if err := json.NewDecoder(resp.Body).Decode(target); err != nil {
			return err
		}
	}
	return nil
}
