from flask import Flask, render_template, request, jsonify
import requests

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/fetch', methods=['POST'])
def fetch_vocab():
    word = request.form.get('word')
    # Fetch data from Jisho API
    response = requests.get(f"https://jisho.org/api/v1/search/words?keyword={word}")
    data = response.json()

    if data['data']:
        entry = data['data'][0]
        jlpt_raw = entry.get('jlpt', [])
        # Extract "N5", "N4" etc.
        level = jlpt_raw[0].split('-')[1].upper() if jlpt_raw else "???"
        
        return jsonify({
            "success": True,
            "kanji": entry['japanese'][0].get('word', word),
            "reading": entry['japanese'][0].get('reading'),
            "meaning": entry['senses'][0]['english_definitions'][0],
            "level": level
        })
    return jsonify({"success": False})

# Necessary for Vercel
app.index = app
if __name__ == "__main__":
    app.run()
