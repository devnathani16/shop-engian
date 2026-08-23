package main

import (
	"math"
	"sort"
)

type PackItem struct {
	Length   float64
	Width    float64
	Height   float64
	Weight   float64
	Quantity int
}

type BoxDimensions struct {
	Length float64
	Width  float64
	Height float64
	Weight float64
}

// CalculatePackedDimensions uses a basic heuristic to pack items into a roughly cubic bounding box
// to get a realistic shipping dimension for the courier.
func CalculatePackedDimensions(items []PackItem) BoxDimensions {
	if len(items) == 0 {
		return BoxDimensions{Length: 10, Width: 10, Height: 10, Weight: 0.5} // Minimums
	}

	// Unroll quantities
	var unrolled []PackItem
	var totalWeight float64
	var totalVolume float64
	for _, item := range items {
		// Ensure minimum dimensions
		l := math.Max(item.Length, 1)
		w := math.Max(item.Width, 1)
		h := math.Max(item.Height, 1)
		wt := math.Max(item.Weight, 0.1)
		
		for i := 0; i < item.Quantity; i++ {
			unrolled = append(unrolled, PackItem{Length: l, Width: w, Height: h, Weight: wt})
			totalWeight += wt
			totalVolume += l * w * h
		}
	}

	// Sort items by largest volume first
	sort.Slice(unrolled, func(i, j int) bool {
		v1 := unrolled[i].Length * unrolled[i].Width * unrolled[i].Height
		v2 := unrolled[j].Length * unrolled[j].Width * unrolled[j].Height
		return v1 > v2
	})

	// To simulate 3D packing without a fixed bin size, we aim for a roughly cubic bounding box.
	// We will estimate the target dimension as the cube root of the total volume.
	targetDim := math.Cbrt(totalVolume)

	var currentX, currentY, currentZ float64
	var maxZ, rowMaxY float64

	var maxX, maxY float64

	// Pack items along X, wrap to Y (row), wrap to Z (layer)
	for _, item := range unrolled {
		// Orient item to have the shortest side pointing up (Z) to keep center of gravity low
		dims := []float64{item.Length, item.Width, item.Height}
		sort.Float64s(dims)
		h := dims[0] // Shortest
		w := dims[1] // Medium
		l := dims[2] // Longest

		// If placing this item exceeds the target X dimension, wrap to a new row (Y)
		if currentX+l > targetDim && currentX > 0 {
			currentX = 0
			currentY += rowMaxY
			rowMaxY = 0
		}

		// If placing this item exceeds the target Y dimension, wrap to a new layer (Z)
		if currentY+w > targetDim && currentY > 0 {
			currentX = 0
			currentY = 0
			currentZ += maxZ
			maxZ = 0
		}

		// Update max dimensions of current row and layer
		if w > rowMaxY {
			rowMaxY = w
		}
		if h > maxZ {
			maxZ = h
		}

		// Update total bounding box
		if currentX+l > maxX {
			maxX = currentX + l
		}
		if currentY+w > maxY {
			maxY = currentY + w
		}

		currentX += l
	}

	finalLength := maxX
	finalWidth := maxY
	finalHeight := currentZ + maxZ

	// Ensure final dimensions are at least 10cm x 10cm x 10cm for most couriers
	finalLength = math.Max(finalLength, 10)
	finalWidth = math.Max(finalWidth, 10)
	finalHeight = math.Max(finalHeight, 10)

	return BoxDimensions{
		Length: math.Round(finalLength*100) / 100,
		Width:  math.Round(finalWidth*100) / 100,
		Height: math.Round(finalHeight*100) / 100,
		Weight: math.Round(totalWeight*100) / 100,
	}
}
