package main

import (
	"encoding/json"
	"log"
	"sync"
	"net/http"
	"github.com/gin-gonic/gin"
)

// EventType represents the kind of event being broadcasted
type EventType string

const (
	EventNewOrder        EventType = "new_order"
	EventCartAbandoned   EventType = "cart_abandoned"
	EventCustomerSynced  EventType = "customer_synced"
)

// SSEEvent represents a single event payload
type SSEEvent struct {
	Type EventType   `json:"type"`
	Data interface{} `json:"data"`
}

// SSEBroker manages connected clients per shop
type SSEBroker struct {
	// Map of shopID to a map of client channels
	clients map[string]map[chan SSEEvent]bool
	mu      sync.RWMutex
}

var GlobalBroker *SSEBroker

func InitSSEBroker() {
	GlobalBroker = &SSEBroker{
		clients: make(map[string]map[chan SSEEvent]bool),
	}
}

// AddClient adds a new client connection for a specific shop
func (b *SSEBroker) AddClient(shopID string, clientChan chan SSEEvent) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if b.clients[shopID] == nil {
		b.clients[shopID] = make(map[chan SSEEvent]bool)
	}
	b.clients[shopID][clientChan] = true
	log.Printf("[SSE] Client connected to shop %s. Total clients: %d", shopID, len(b.clients[shopID]))
}

// RemoveClient removes a client connection
func (b *SSEBroker) RemoveClient(shopID string, clientChan chan SSEEvent) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if b.clients[shopID] != nil {
		delete(b.clients[shopID], clientChan)
		close(clientChan)
		log.Printf("[SSE] Client disconnected from shop %s. Total clients: %d", shopID, len(b.clients[shopID]))
	}
}

// BroadcastEvent pushes an event to all connected clients for a shop
func (b *SSEBroker) BroadcastEvent(shopID string, eventType EventType, data interface{}) {
	b.mu.RLock()
	defer b.mu.RUnlock()

	if b.clients[shopID] == nil {
		return
	}

	event := SSEEvent{
		Type: eventType,
		Data: data,
	}

	for clientChan := range b.clients[shopID] {
		// Non-blocking send
		select {
		case clientChan <- event:
		default:
			// Client's channel is blocked/full, skip to avoid blocking the broker
			log.Printf("[SSE] Warning: Dropping event for a blocked client in shop %s", shopID)
		}
	}
}

// handleShopEvents is the gin handler for the SSE endpoint
func handleShopEvents(c *gin.Context) {
	shopInterface, exists := c.Get("shop")
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Shop context missing"})
		return
	}
	shop := shopInterface.(Shop)
	shopID := shop.ID
	_ = shopID

	// Initialize the channel for this client
	clientChan := make(chan SSEEvent, 10)
	GlobalBroker.AddClient(shopID, clientChan)

	// Ensure the client is removed when the request context closes
	defer GlobalBroker.RemoveClient(shopID, clientChan)

	// Set headers for SSE
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	// Allow chunked encoding (handled automatically by gin/http)

	notify := c.Request.Context().Done()

	for {
		select {
		case <-notify:
			// Connection closed by the client
			return
		case event := <-clientChan:
			// Serialize data
			payload, err := json.Marshal(event.Data)
			if err != nil {
				continue
			}
			// Write the SSE format: event, data
			c.SSEvent(string(event.Type), string(payload))
			c.Writer.Flush()
		}
	}
}
