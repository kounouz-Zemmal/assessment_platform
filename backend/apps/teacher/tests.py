from types import SimpleNamespace

from django.test import SimpleTestCase

from apps.teacher.views import QUESTION_TYPE_FROM_DB, QUESTION_TYPE_TO_DB, _serialize_question


class TeacherQuestionMappingTests(SimpleTestCase):
    def test_question_type_bidirectional_mapping(self):
        self.assertEqual(QUESTION_TYPE_TO_DB["MCQ"], "MCQ")
        self.assertEqual(QUESTION_TYPE_TO_DB["SCQ"], "SCQ")
        self.assertEqual(QUESTION_TYPE_TO_DB["True/False"], "TRUE_FALSE")
        self.assertEqual(QUESTION_TYPE_TO_DB["Descriptive"], "DESCRIPTIVE")
        self.assertEqual(QUESTION_TYPE_FROM_DB["TRUE_FALSE"], "True/False")
        self.assertEqual(QUESTION_TYPE_FROM_DB["DESCRIPTIVE"], "Descriptive")

    def test_serialize_true_false_question_shape(self):
        question = SimpleNamespace(
            id=1,
            module_id=4,
            module=SimpleNamespace(code="CS201", name="Algorithms"),
            topic_id=None,
            type="TRUE_FALSE",
            content="A graph is a tree if it has cycles.",
            default_points=1,
            explanation="No cycles in a tree.",
            created_by_id=9,
            created_at=None,
        )
        choices = {
            1: [
                SimpleNamespace(content="True", is_correct=False),
                SimpleNamespace(content="False", is_correct=True),
            ]
        }
        payload = _serialize_question(question, choices, {1: []}, {})
        self.assertEqual(payload["type"], "True/False")
        self.assertEqual(payload["correctAnswer"], "False")
        self.assertEqual(payload["options"], ["True", "False"])
