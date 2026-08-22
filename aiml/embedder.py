import os
import requests
import numpy as np
from dotenv import load_dotenv

def encode(texts):
    load_dotenv()
    OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
    """
    Encode a list of strings into a numpy array of embeddings using OpenRouter API.
    """
    if not texts:
        return np.array([])
        
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }
    
    data = {
        "model": "nvidia/llama-nemotron-embed-vl-1b-v2:free",
        "input": texts
    }
    
    try:
        response = requests.post("https://openrouter.ai/api/v1/embeddings", headers=headers, json=data)
        if response.status_code == 200:
            res_json = response.json()
            embeddings = [item["embedding"] for item in res_json["data"]]
            return np.array(embeddings)
        else:
            print(f"Error from OpenRouter: {response.text}")
            return np.zeros((len(texts), 1024)) # Dummy fallback
    except Exception as e:
        print(f"Exception calling OpenRouter: {e}")
        return np.zeros((len(texts), 1024))

def encode_query(query: str):
    """
    Encode a single query string into a 1D numpy array.
    """
    return encode([query])[0]
