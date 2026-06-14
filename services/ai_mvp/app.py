from flask import Flask, jsonify, request

from services.ai_service import AiServiceError, evaluate_answer_with_keywords, generate_ai_content

app = Flask(__name__)


@app.after_request
def _cors(resp):
    """Allow local Vite dev server to call this API."""
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return resp


@app.route("/api/ai/generate", methods=["POST", "OPTIONS"])
def ai_generate():
    if request.method == "OPTIONS":
        return "", 204

    try:
        data = request.get_json(silent=True) or {}
        question = str(data.get("question", "")).strip()
        options = data.get("options", {})

        if not question:
            return jsonify({"error": "Field 'question' is required"}), 400

        if not isinstance(options, dict):
            return jsonify({"error": "Field 'options' must be an object"}), 400

        answer_flag = bool(options.get("answer", False))
        keywords_flag = bool(options.get("keywords", False))
        improve_flag = bool(options.get("improve", False))

        result = generate_ai_content(
            question=question,
            answer=answer_flag,
            keywords=keywords_flag,
            improve=improve_flag,
        )
        return jsonify(result), 200
    except AiServiceError as err:
        return (
            jsonify(
                {
                    "error": err.message,
                    "improved_question": "",
                    "answer": "",
                    "keywords": [],
                }
            ),
            err.status_code,
        )
    except Exception:
        return (
            jsonify(
                {
                    "error": "Internal server error",
                    "improved_question": "",
                    "answer": "",
                    "keywords": [],
                }
            ),
            500,
        )


@app.route("/api/ai/evaluate", methods=["POST", "OPTIONS"])
def ai_evaluate():
    if request.method == "OPTIONS":
        return "", 204

    try:
        data = request.get_json(silent=True) or {}
        answer_text = str(data.get("answer_text", "")).strip()
        keywords = data.get("keywords", [])
        max_points_raw = data.get("max_points", 1.0)

        if not answer_text:
            return jsonify({"error": "Field 'answer_text' is required"}), 400
        if not isinstance(keywords, list):
            return jsonify({"error": "Field 'keywords' must be an array"}), 400
        try:
            max_points = float(max_points_raw)
        except (TypeError, ValueError):
            return jsonify({"error": "Field 'max_points' must be numeric"}), 400

        result = evaluate_answer_with_keywords(
            answer_text=answer_text,
            keywords=keywords,
            max_points=max_points,
        )
        return jsonify(result), 200
    except AiServiceError as err:
        return (
            jsonify(
                {
                    "error": err.message,
                    "score": 0,
                    "detected_keywords": [],
                    "missing_keywords": [],
                }
            ),
            err.status_code,
        )
    except Exception:
        return (
            jsonify(
                {
                    "error": "Internal server error",
                    "score": 0,
                    "detected_keywords": [],
                    "missing_keywords": [],
                }
            ),
            500,
        )


if __name__ == "__main__":
    app.run(debug=True, port=5000)
