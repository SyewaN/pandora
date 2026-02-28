from flask import Flask, jsonify, request
from flask_cors import CORS
import random

app = Flask(__name__)
CORS(app)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'service': 'obruk-ai',
        'mode': 'demo'
    })

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()
        prediction = {
            'predictions': [
                {
                    'tds': data.get('tds', 0) * (1 + random.uniform(-0.1, 0.1)),
                    'temperature': data.get('temperature', 25) * (1 + random.uniform(-0.05, 0.05)),
                    'moisture': data.get('moisture', 350) * (1 + random.uniform(-0.1, 0.1))
                } for _ in range(3)
            ],
            'anomaly_score': random.uniform(0, 1),
            'confidence': random.uniform(0.7, 0.95)
        }
        return jsonify({'success': True, 'data': prediction})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
