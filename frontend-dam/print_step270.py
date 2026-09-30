import json

transcript_path = r'C:\Users\nikhil sai\.gemini\antigravity-ide\brain\1738f0ea-5353-4582-9354-9833537f3512\.system_generated\logs\transcript.jsonl'
with open(transcript_path, 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if i in [268, 269, 270, 271, 272, 273, 274, 275]:
            obj = json.loads(line)
            print(f"=== STEP {i} ({obj.get('type')}) ===")
            c = str(obj.get('content', ''))
            print(c[:400])
            if 'tool_calls' in obj:
                print("Tool calls:", obj['tool_calls'])
