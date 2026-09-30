import json

transcript_path = r'C:\Users\nikhil sai\.gemini\antigravity-ide\brain\1738f0ea-5353-4582-9354-9833537f3512\.system_generated\logs\transcript.jsonl'
with open(transcript_path, 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if i in [270, 341, 377, 379, 385, 480, 482, 500]:
            obj = json.loads(line)
            print(f"=== STEP {i} ===")
            print(obj.get('content'))
