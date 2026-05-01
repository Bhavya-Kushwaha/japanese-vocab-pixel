from flask import Flask, render_template, request, jsonify
import requests

# Optimization for Vercel: Correctly locating templates from the /api folder
app = Flask(__name__, template_folder='../templates')

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/fetch', methods=['POST'])
def fetch_vocab():
    # Use .get() to avoid KeyErrors if 'word' is missing
    word = request.form.get('word')
    if not word:
        return jsonify({"success": False, "error": "No word provided"})

    try:
        # Standard timeout added to prevent the app from hanging
        response = requests.get(
            f"https://jisho.org/api/v1/search/words?keyword={word}", 
            timeout=5
        )
        response.raise_for_status()
        data = response.json()

        if data.get('data'):
            # Grabbing the most relevant entry
            entry = data['data'][0]
            
            # Robust JLPT extraction: filters for the first tag containing 'jlpt-'
            jlpt_raw = entry.get('jlpt', [])
            level = "???"
            for tag in jlpt_raw:
                if 'jlpt-' in tag:
                    level = tag.split('-')[1].upper()
                    break
            
            # Extracting Japanese info with fallbacks
            japanese_info = entry.get('japanese', [{}])[0]
            kanji = japanese_info.get('word', word)
            reading = japanese_info.get('reading', '')

            # Extracting the first English definition
            senses = entry.get('senses', [{}])[0]
            definitions = senses.get('english_definitions', ["No meaning found"])
            meaning = definitions[0]

            return jsonify({
                "success": True,
                "kanji": kanji,
                "reading": reading,
                "meaning": meaning,
                "level": level
            })

    except Exception as e:
        print(f"Error fetching data: {e}")
        return jsonify({"success": False, "error": "API request failed"})

    return jsonify({"success": False})

# Mandatory for Vercel serverless functions
app.index = app

if __name__ == "__main__":
    app.run()
