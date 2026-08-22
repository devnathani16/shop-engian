import numpy as np

# In-memory store: shop_id -> {"embeddings": np.ndarray, "product_ids": [uint32]}
stores = {}

def index_products(shop_id: str, product_ids: list, embeddings: np.ndarray):
    """
    Store embeddings for a shop. Replaces the existing index entirely.
    embeddings should be a numpy array of shape (N, 384)
    product_ids should be a list of ints of length N
    """
    if len(product_ids) != embeddings.shape[0]:
        raise ValueError("Length of product_ids and embeddings must match")
    
    # Normalize embeddings for cosine similarity (dot product becomes cosine similarity)
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    norms[norms == 0] = 1 # prevent division by zero
    normalized_embeddings = embeddings / norms
    
    stores[shop_id] = {
        "product_ids": product_ids,
        "embeddings": normalized_embeddings
    }

def load_precalculated_embeddings(shop_id: str, product_ids: list, embeddings: np.ndarray):
    """
    Load pre-calculated embeddings directly into memory, skipping OpenRouter.
    embeddings should be a numpy array of shape (N, 1024)
    """
    if len(product_ids) != embeddings.shape[0]:
        raise ValueError("Length of product_ids and embeddings must match")
    
    # Check if empty
    if len(product_ids) == 0:
        stores[shop_id] = {"product_ids": [], "embeddings": np.empty((0, 1024))}
        return

    # Normalize embeddings for cosine similarity
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    norms[norms == 0] = 1 # prevent division by zero
    normalized_embeddings = embeddings / norms
    
    stores[shop_id] = {
        "product_ids": product_ids,
        "embeddings": normalized_embeddings
    }

def update_single_embedding(shop_id: str, product_id: int, embedding: np.ndarray):
    """
    Update or add a single product's embedding.
    """
    if shop_id not in stores:
        stores[shop_id] = {"product_ids": [], "embeddings": np.empty((0, 1024))}
        
    # Normalize
    norm = np.linalg.norm(embedding)
    if norm > 0:
        embedding = embedding / norm
    embedding = embedding.reshape(1, -1)
    
    store = stores[shop_id]
    product_ids = store["product_ids"]
    embeddings = store["embeddings"]
    
    try:
        idx = product_ids.index(product_id)
        # Update existing
        embeddings[idx] = embedding[0]
    except ValueError:
        # Add new
        store["product_ids"].append(product_id)
        if embeddings.shape[0] == 0:
            store["embeddings"] = embedding
        else:
            store["embeddings"] = np.vstack([embeddings, embedding])

def search(shop_id: str, query_embedding: np.ndarray, top_k: int = 10):
    """
    Find top_k products in a shop matching the query.
    """
    if shop_id not in stores:
        return []
        
    store = stores[shop_id]
    product_ids = store["product_ids"]
    embeddings = store["embeddings"]
    
    if len(product_ids) == 0:
        return []
        
    # Normalize query
    query_norm = np.linalg.norm(query_embedding)
    if query_norm > 0:
        query_embedding = query_embedding / query_norm
        
    # Cosine similarity via dot product (since both are normalized)
    scores = np.dot(embeddings, query_embedding)
    
    # Get top_k indices
    k = min(top_k, len(product_ids))
    # argpartition is faster than sort for top k
    if k < len(scores):
        top_indices = np.argpartition(scores, -k)[-k:]
        # Sort the top k indices by score descending
        top_indices = top_indices[np.argsort(-scores[top_indices])]
    else:
        top_indices = np.argsort(-scores)
        
    results = []
    for idx in top_indices:
        score = float(scores[idx])
        if score > 0.15:  # Lower similarity threshold for OpenRouter models
            results.append({
                "product_id": product_ids[idx],
                "score": score
            })
        
    return results
