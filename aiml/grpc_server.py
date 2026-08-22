import sys
import os
import grpc
from concurrent import futures
import logging

# Add generated directory to path so imports work
sys.path.append(os.path.join(os.path.dirname(__file__), "generated"))

import search_pb2
import search_pb2_grpc
from embedder import encode, encode_query
from index import index_products, search

class SemanticSearchServicer(search_pb2_grpc.SemanticSearchServiceServicer):
    def IndexProducts(self, request, context):
        shop_id = request.shop_id
        products = request.products
        
        if not products:
            return search_pb2.IndexResponse(success=True, indexed_count=0)
            
        logging.info(f"Indexing {len(products)} products for shop {shop_id}")
        
        # Combine title and description for embedding
        texts_to_encode = []
        product_ids = []
        
        for p in products:
            text = f"{p.title} {p.description}"
            texts_to_encode.append(text)
            product_ids.append(p.id)
            
        embeddings = encode(texts_to_encode)
        
        index_products(shop_id, product_ids, embeddings)
        
        return search_pb2.IndexResponse(success=True, indexed_count=len(product_ids))

    def Search(self, request, context):
        shop_id = request.shop_id
        query = request.query
        top_k = request.top_k
        
        logging.info(f"Search query '{query}' for shop {shop_id}")
        
        query_embedding = encode_query(query)
        results = search(shop_id, query_embedding, top_k)
        
        response = search_pb2.SearchResponse()
        for res in results:
            response.results.append(search_pb2.SearchResult(
                product_id=res["product_id"],
                score=res["score"]
            ))
            
        return response

def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    search_pb2_grpc.add_SemanticSearchServiceServicer_to_server(
        SemanticSearchServicer(), server)
    server.add_insecure_port('[::]:50051')
    logging.basicConfig(level=logging.INFO)
    logging.info("Starting gRPC server on port 50051...")
    server.start()
    server.wait_for_termination()

if __name__ == '__main__':
    serve()
