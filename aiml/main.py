from fastapi import FastAPI, File, UploadFile, Response
import uvicorn
import io
from PIL import Image
from rembg import remove
import asyncio
import grpc_server
import os
import json
from pydantic import BaseModel
from groq import Groq
from stitch_mcp_bridge import generate_ui_via_stitch_mcp
import asyncio
from dotenv import load_dotenv
import requests
import base64
import urllib.parse
import time

load_dotenv()

app = FastAPI(title="Shop.me AIML Service")

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "aiml"}

# Initialize Groq Client
client = Groq(api_key=os.environ.get("GROQ_API_KEY", "your-default-key"))

class ThemeRequest(BaseModel):
    prompt: str

class InventoryInsightRequest(BaseModel):
    product_title: str
    variant_title: str
    current_stock: int
    sales_velocity: float # average units sold per day recently

@app.post("/inventory-insight")
def generate_inventory_insight(req: InventoryInsightRequest):
    try:
        prompt = f"""You are an expert ecommerce inventory manager.
A product '{req.product_title}' (Variant: '{req.variant_title}') has just dropped to {req.current_stock} units in stock.
Based on recent data, it is selling at a velocity of {req.sales_velocity} units per day.
Write a very brief (2-3 sentences max) actionable insight for the merchant. Tell them approximately when they will run out of stock and how many units they should reorder to cover the next 30 days. Be direct and professional."""

        chat_completion = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.1-70b-versatile",
            temperature=0.7,
            max_tokens=150,
        )
        
        insight = chat_completion.choices[0].message.content.strip()
        
        severity = "info"
        if req.current_stock == 0:
            severity = "critical"
        elif req.current_stock <= req.sales_velocity * 3:
            severity = "warning"
            
        return {"insight": insight, "severity": severity}
    except Exception as e:
        print(f"Error generating insight: {e}")
        return {"insight": "Stock is low. Consider restocking soon.", "severity": "warning"}

@app.post("/generate-theme")
def generate_theme(req: ThemeRequest):
    try:
        # STEP 1: Generate Multi-Page JSON & Image Prompt with Groq (LLaMA 3)
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": """You are an expert web designer and JSON generator. 
You will receive a user prompt describing a vibe or style for an ecommerce store. 
You must return ONLY a JSON object that strictly matches this schema (no markdown formatting, just raw JSON):
{
  "global": {
    "colors": {
      "primary": "#HEX",
      "background": "#HEX",
      "text": "#HEX"
    },
    "typography": {
      "fontFamily": "FontName, fallback"
    }
  },
  "image_prompt": "A highly detailed, cinematic photograph of [subject based on user prompt], 8k resolution, photorealistic, professional lighting",
  "pages": {
    "home": [
      {
        "id": "hero_1",
        "type": "hero",
        "settings": {
          "title": "...",
          "subtitle": "...",
          "buttonText": "...",
          "buttonLink": "#products",
          "imageUrl": "" 
        }
      },
      {
        "id": "featured_products_1",
        "type": "featured_products",
        "settings": {
          "title": "...",
          "subtitle": "..."
        }
      }
    ],
    "products": [
      {
        "id": "category_grid_1",
        "type": "category_grid",
        "settings": {
          "title": "..."
        }
      }
    ],
    "about": [
      {
        "id": "about_1",
        "type": "text_image_block",
        "settings": {
          "title": "Our Story",
          "content": "...",
          "imageUrl": "https://images.unsplash.com/photo-1516245834210-c4c142787335?auto=format&fit=crop&q=80&w=1000"
        }
      }
    ],
    "checkout": [
      {
        "id": "checkout_header_1",
        "type": "text_block",
        "settings": {
          "title": "Secure Checkout"
        }
      }
    ]
  }
}
Choose beautiful, cohesive hex colors based on the prompt. Choose an appropriate google font (like 'Inter', 'Cinzel', 'Space Mono').
Invent a catchy title and subtitle. Do NOT wrap the JSON in markdown blocks like ```json."""
                },
                {
                    "role": "user",
                    "content": req.prompt,
                }
            ],
            model="llama-3.1-8b-instant",
            temperature=0.7,
            max_tokens=2048,
            response_format={"type": "json_object"}
        )

        response_text = chat_completion.choices[0].message.content
        theme_config = json.loads(response_text)
        
        # STEP 2: Generate Hero Image with Gemini Imagen 3
        image_prompt = theme_config.get("image_prompt", req.prompt)
        hero_image_url = ""
        
        try:
            or_key = os.environ.get("OPENROUTER_API_KEY")
            if or_key:
                headers = {
                    "Authorization": f"Bearer {or_key}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": "black-forest-labs/flux.2-flex",
                    "prompt": image_prompt
                }
                res = requests.post("https://openrouter.ai/api/v1/images", headers=headers, json=payload, timeout=20)
                if res.status_code == 200:
                    data = res.json()
                    hero_image_url = data.get("data", [{}])[0].get("url", "")
                else:
                    print(f"OpenRouter Image API failed: {res.status_code} - {res.text}")
            
            if not hero_image_url:
                encoded_prompt = urllib.parse.quote(image_prompt)
                pollinations_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1920&height=1080&nologo=true&seed={int(time.time())}"
                try:
                    img_res = requests.get(pollinations_url, timeout=30)
                    if img_res.status_code == 200:
                        b64_str = base64.b64encode(img_res.content).decode('utf-8')
                        hero_image_url = f"data:image/jpeg;base64,{b64_str}"
                    else:
                        hero_image_url = pollinations_url
                except Exception:
                    hero_image_url = pollinations_url
            
        except Exception as img_e:
            print("Failed to generate image via OpenRouter:", img_e)
            encoded_prompt = urllib.parse.quote(image_prompt)
            pollinations_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1920&height=1080&nologo=true&seed={int(time.time())}"
            try:
                img_res = requests.get(pollinations_url, timeout=30)
                if img_res.status_code == 200:
                    b64_str = base64.b64encode(img_res.content).decode('utf-8')
                    hero_image_url = f"data:image/jpeg;base64,{b64_str}"
                else:
                    hero_image_url = pollinations_url
            except Exception:
                hero_image_url = pollinations_url
        
        # Inject the generated image URL into the home page hero section
        if "pages" in theme_config and "home" in theme_config["pages"]:
            for section in theme_config["pages"]["home"]:
                if section.get("type") == "hero":
                    section["settings"]["imageUrl"] = hero_image_url
                    break
        
        # Remove the image_prompt from final config
        if "image_prompt" in theme_config:
            del theme_config["image_prompt"]
            
        return theme_config
    
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))

class DescriptionRequest(BaseModel):
    title: str
    keywords: str

@app.post("/generate-description")
def generate_description(req: DescriptionRequest):
    try:
        # STEP 1: Use Groq to structure the product data, specs, and marketing copy
        print(f"Structuring data via Groq for: {req.title}")
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are a product data extractor. Extract and generate structured JSON containing: 'marketing_copy' (engaging description), 'features' (list of key selling points), and 'specs' (key-value pairs of technical specifications)."
                },
                {
                    "role": "user",
                    "content": f"Title: {req.title}\\nKeywords: {req.keywords}",
                }
            ],
            model="openai/gpt-oss-120b",
            temperature=0.3,
            max_tokens=1024,
            response_format={"type": "json_object"}
        )
        
        structured_data = chat_completion.choices[0].message.content
        
        # STEP 2: Use the genuine Google Stitch MCP Bridge
        print("Delegating UI generation to Google Stitch MCP Bridge...")
        
        # Execute the async MCP bridge in the sync FastAPI endpoint
        ui_html = asyncio.run(generate_ui_via_stitch_mcp(structured_data))
        
        if not ui_html or "<!-- Stitch returned empty response -->" in ui_html:
            print("Stitch MCP failed or returned empty. Falling back to Groq HTML generation...")
            # Fallback to Groq if Stitch MCP fails
            fallback_completion = client.chat.completions.create(
                messages=[
                    {
                        "role": "system",
                        "content": "Generate a beautiful, raw HTML product description snippet with Tailwind CSS using this data: " + structured_data + ". IMPORTANT: Return ONLY the HTML snippet (e.g. wrapped in a <div>). Do NOT output full <html>, <head>, or <body> tags, and do NOT use markdown code blocks."
                    }
                ],
                model="openai/gpt-oss-120b"
            )
            ui_html = fallback_completion.choices[0].message.content

        return {"description": ui_html}
    
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))



import embedder

class EmbeddingRequest(BaseModel):
    text: str

@app.post("/generate-embedding")
def generate_embedding(req: EmbeddingRequest):
    try:
        vec = embedder.encode_query(req.text)
        return {"embedding": vec.tolist()}
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))

class LoadEmbeddingsRequest(BaseModel):
    shop_id: str
    products: list # list of dicts {"id": int, "embedding": list of floats}

@app.post("/load-embeddings")
def load_embeddings(req: LoadEmbeddingsRequest):
    try:
        from index import load_precalculated_embeddings
        import numpy as np
        
        product_ids = []
        embeddings = []
        for p in req.products:
            product_ids.append(p["id"])
            embeddings.append(p["embedding"])
            
        if len(product_ids) > 0:
            emb_array = np.array(embeddings, dtype=np.float32)
            load_precalculated_embeddings(req.shop_id, product_ids, emb_array)
        else:
            load_precalculated_embeddings(req.shop_id, [], np.empty((0, 1024)))
            
        return {"success": True, "loaded_count": len(product_ids)}
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))

class UpdateEmbeddingRequest(BaseModel):
    shop_id: str
    product_id: int
    embedding: list # list of floats

@app.post("/update-embedding")
def update_embedding(req: UpdateEmbeddingRequest):
    try:
        from index import update_single_embedding
        import numpy as np
        
        emb_array = np.array(req.embedding, dtype=np.float32)
        update_single_embedding(req.shop_id, req.product_id, emb_array)
        
        return {"success": True}
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/remove-background")
async def remove_background(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        input_image = Image.open(io.BytesIO(contents))
        
        # Remove background
        output_image = remove(input_image)
        
        # Save to bytes
        img_byte_arr = io.BytesIO()
        output_image.save(img_byte_arr, format='PNG')
        img_byte_arr.seek(0)
        
        return Response(content=img_byte_arr.getvalue(), media_type="image/png")
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    # Start the gRPC server in the background
    # Since grpc_server.serve() is blocking, we need to run it in a thread or separate process.
    import threading
    grpc_thread = threading.Thread(target=grpc_server.serve, daemon=True)
    grpc_thread.start()
    
    # Start the FastAPI server on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
