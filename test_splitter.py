from llama_index.core.node_parser import SentenceSplitter

splitter = SentenceSplitter(chunk_size=200, chunk_overlap=20)
chunks = splitter.split_text("This is a test. " * 50)
print(f"Number of chunks: {len(chunks)}")
print("First chunk:", chunks[0])
