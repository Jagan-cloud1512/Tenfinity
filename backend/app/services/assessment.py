import json
import logging
import re

from app.services.llm import get_provider_router

logger = logging.getLogger(__name__)

QUESTION_GEN_PROMPT = """You are a DSA (Data Structures and Algorithms) assessment question generator.
Generate exactly 2 questions for the given topic to test a student's understanding.

Question 1: A conceptual MCQ testing theoretical knowledge (medium-to-hard difficulty).
Question 2: A code output prediction question showing a short code snippet and asking what the output will be (medium-to-hard difficulty). The code must be correct, runnable Python code that produces a definite output.

Rules:
- Each question MUST have exactly 4 options
- correct_index is 0-based (0, 1, 2, or 3)
- Options should be plausible — no obviously wrong answers
- Code snippets must be short (under 15 lines), clear, and have ONE definite output
- Explanations should be concise (1-2 sentences)
- Do NOT include option labels like "A)" or "1)" in the option text

Respond with ONLY valid JSON, no markdown fences, no extra text:
{
  "questions": [
    {
      "type": "mcq",
      "question": "Your conceptual question here?",
      "options": ["option1", "option2", "option3", "option4"],
      "correct_index": 0,
      "explanation": "Brief explanation why this is correct.",
      "difficulty": "medium"
    },
    {
      "type": "code_output",
      "question": "What will be the output of the following code?",
      "code": "x = [1, 2, 3]\\nprint(x[-1])",
      "language": "python",
      "options": ["1", "3", "2", "[1, 2, 3]"],
      "correct_index": 1,
      "explanation": "x[-1] accesses the last element of the list.",
      "difficulty": "hard"
    }
  ]
}"""


def _extract_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
        text = text.strip()
    return json.loads(text)


def _validate_questions(data: dict, topic_name: str) -> list[dict]:
    if "questions" not in data or not isinstance(data["questions"], list):
        raise ValueError("Missing 'questions' array")

    questions = data["questions"]
    if len(questions) < 2:
        raise ValueError(f"Expected 2 questions, got {len(questions)}")

    validated = []
    for i, q in enumerate(questions[:2]):
        if not isinstance(q.get("options"), list) or len(q["options"]) != 4:
            raise ValueError(f"Question {i+1} must have exactly 4 options")

        ci = q.get("correct_index")
        if not isinstance(ci, int) or ci < 0 or ci > 3:
            raise ValueError(f"Question {i+1} has invalid correct_index: {ci}")

        qtype = q.get("type", "mcq")
        if qtype not in ("mcq", "code_output"):
            qtype = "code_output" if q.get("code") else "mcq"

        validated.append({
            "question_type": qtype,
            "question_text": q.get("question", ""),
            "code_snippet": q.get("code"),
            "code_language": q.get("language", "python"),
            "options": q["options"],
            "correct_index": ci,
            "explanation": q.get("explanation", ""),
            "difficulty": q.get("difficulty", "medium"),
        })

    return validated


async def generate_questions_for_topic(
    topic_name: str,
    topic_description: str,
) -> list[dict]:
    router = get_provider_router()

    messages = [
        {"role": "system", "content": QUESTION_GEN_PROMPT},
        {"role": "user", "content": f"Topic: {topic_name} — {topic_description}"},
    ]

    for attempt in range(2):
        try:
            response = await router.chat(
                messages=messages,
                tools=None,
                temperature=0.2,
                mode="fast",
            )
            data = _extract_json(response.content)
            questions = _validate_questions(data, topic_name)
            logger.info(
                "Generated %d questions for '%s' via %s",
                len(questions), topic_name, response.provider,
            )
            return questions
        except (json.JSONDecodeError, ValueError, KeyError) as e:
            logger.warning(
                "Question generation attempt %d failed for '%s': %s",
                attempt + 1, topic_name, e,
            )
            if attempt == 0:
                messages.append({"role": "assistant", "content": response.content})
                messages.append({
                    "role": "user",
                    "content": "Your response was not valid JSON. Please try again with ONLY valid JSON, no markdown fences or extra text.",
                })

    logger.error("Failed to generate questions for '%s' after retries", topic_name)
    return _fallback_questions(topic_name)


def _fallback_questions(topic_name: str) -> list[dict]:
    return [
        {
            "question_type": "mcq",
            "question_text": f"Which of the following best describes the primary use case of {topic_name}?",
            "code_snippet": None,
            "code_language": "python",
            "options": [
                f"Efficient data storage and retrieval using {topic_name}",
                "Random number generation",
                "Operating system scheduling",
                "Network packet routing",
            ],
            "correct_index": 0,
            "explanation": f"This is a fallback question. {topic_name} is primarily used for efficient data operations.",
            "difficulty": "medium",
        },
        {
            "question_type": "code_output",
            "question_text": "What will be the output of the following code?",
            "code_snippet": "print(type([1, 2, 3]).__name__)",
            "code_language": "python",
            "options": ["list", "array", "tuple", "set"],
            "correct_index": 0,
            "explanation": "type([1, 2, 3]) returns <class 'list'>, and __name__ gives 'list'.",
            "difficulty": "easy",
        },
    ]
