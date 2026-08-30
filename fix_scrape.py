with open("ai-engine/main.py", "r", encoding="utf-8") as f:
    text = f.read()
    
scrape_classes = """class ScrapeRequest(BaseModel):
    url: str

class ScrapeResult(BaseModel):
    text: str
    url: str

@app.post("/ai/research/scrape", response_model=ScrapeResult)"""

text = text.replace('@app.post("/ai/research/scrape", response_model=ScrapeResult)', scrape_classes)

with open("ai-engine/main.py", "w", encoding="utf-8") as f:
    f.write(text)
