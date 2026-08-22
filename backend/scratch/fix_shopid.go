package main

import (
	"fmt"
	"io/ioutil"
	"path/filepath"
	"strings"
)

func main() {
	files, err := filepath.Glob("*.go")
	if err != nil {
		panic(err)
	}
	for _, file := range files {
		content, err := ioutil.ReadFile(file)
		if err != nil {
			panic(err)
		}
		str := string(content)
		if strings.Contains(str, "_ = shop.ID") {
			str = strings.ReplaceAll(str, "_ = shop.ID", "shopID := shop.ID")
			ioutil.WriteFile(file, []byte(str), 0644)
			fmt.Printf("Fixed %s\n", file)
		}
	}
}
