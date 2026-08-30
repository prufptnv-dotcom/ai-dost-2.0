import re

with open('main.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the block from @app.post("/ai/rag/query", response_model=RagResult)
# down to just before @app.post("/ai/research/scrape", response_model=ScrapeResult)
content = re.sub(
    r'(?s)@app\.post\("/ai/rag/query", response_model=RagResult\).*?(?=@app\.post\("/ai/research/scrape", response_model=ScrapeResult\))',
    '\n\n',
    content
)

with open('main.py', 'w', encoding='utf-8') as f:
    f.write(content)
