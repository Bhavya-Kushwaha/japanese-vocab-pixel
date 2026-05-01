from flask import Flask, render_template, request, jsonify
import requests
import os

# Explicitly tell Flask where the templates are relative to this script
app = Flask(__name__, template_folder='../templates')

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/fetch', methods=['POST'])
def fetch_vocab():
    word = request.form.get('word')
    if not word:
        return jsonify({"success": False})

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

# Essential for Vercel deployment
app.index = app

if __name__ == "__main__":
    app.run()
