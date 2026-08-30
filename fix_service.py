with open("backend/services/indexSyncService.js", "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace("return response;", "return response.data;")

with open("backend/services/indexSyncService.js", "w", encoding="utf-8") as f:
    f.write(text)
