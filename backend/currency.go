package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type ExchangeRateResponse struct {
	BaseCode string             `json:"base_code"`
	Rates    map[string]float64 `json:"rates"`
}

type CachedRates struct {
	Rates     map[string]float64
	FetchedAt time.Time
}

var (
	ratesCache = make(map[string]CachedRates)
	cacheMutex sync.RWMutex
	cacheTTL   = 1 * time.Hour
)

func handleGetExchangeRates(c *gin.Context) {
	baseCurrency := c.Query("base")
	if baseCurrency == "" {
		baseCurrency = "USD"
	}

	// 1. Check Cache
	cacheMutex.RLock()
	cached, exists := ratesCache[baseCurrency]
	cacheMutex.RUnlock()

	if exists && time.Since(cached.FetchedAt) < cacheTTL {
		c.JSON(http.StatusOK, gin.H{
			"base":  baseCurrency,
			"rates": cached.Rates,
		})
		return
	}

	// 2. Fetch from External API
	apiURL := fmt.Sprintf("https://open.er-api.com/v6/latest/%s", baseCurrency)
	resp, err := http.Get(apiURL)
	if err != nil {
		// Fallback to cache even if expired
		if exists {
			c.JSON(http.StatusOK, gin.H{"base": baseCurrency, "rates": cached.Rates, "warning": "using stale rates"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch exchange rates"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch exchange rates"})
		return
	}

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read exchange rates response"})
		return
	}

	var rateData ExchangeRateResponse
	if err := json.Unmarshal(body, &rateData); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse exchange rates"})
		return
	}

	// 3. Update Cache
	cacheMutex.Lock()
	ratesCache[baseCurrency] = CachedRates{
		Rates:     rateData.Rates,
		FetchedAt: time.Now(),
	}
	cacheMutex.Unlock()

	c.JSON(http.StatusOK, gin.H{
		"base":  baseCurrency,
		"rates": rateData.Rates,
	})
}
