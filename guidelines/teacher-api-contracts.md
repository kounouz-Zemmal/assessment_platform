# Teacher Module API Contracts

This document describes the API contracts used by teacher pages:
- `Dashboard`
- `My Modules`
- `Question Bank`
- `Create/Edit Question`

All endpoints are under `/api/` and require authenticated teacher session.

## 1) Dashboard

### GET `teacher/dashboard`

Response:

```json
{
  "stats": {
    "questionsCreated": 10,
    "assessmentsCreated": 3,
    "assessmentsAssigned": 2,
    "totalAssessments": 5,
    "pendingGrading": 4,
    "totalSubmissions": 30
  },
  "activeAssessments": [
    {
      "id": "12",
      "title": "OOP Midterm",
      "status": "Active",
      "duration": 90,
      "startTime": "2026-04-10T09:00:00+00:00",
      "moduleCode": "CS201"
    }
  ]
}
```

## 2) My Modules and Topics

### GET `teacher/modules`

Response:

```json
{
  "modules": [
    {
      "id": "5",
      "code": "CS201",
      "name": "Algorithms",
      "description": "Core algorithms",
      "teachingRole": "Lecturer",
      "topics": [
        { "id": "18", "name": "Greedy", "moduleId": "5" }
      ]
    }
  ]
}
```

## 3) Question Bank

### GET `teacher/questions`

Query params:
- `search` (optional)
- `module_id` (optional)
- `topic_id` (optional)
- `type` one of: `MCQ`, `SCQ`, `True/False`, `Descriptive`
- `sort` one of: `newest`, `year_desc`, `year_asc`, `alphabetical_asc`, `alphabetical_desc`
- `page` (default 1)
- `page_size` (default 20, max 100)

Response:

```json
{
  "questions": [
    {
      "id": "77",
      "moduleId": "5",
      "moduleCode": "CS201",
      "moduleName": "Algorithms",
      "topicId": "18",
      "topicName": "Greedy",
      "type": "MCQ",
      "text": "What is ...?",
      "points": 2,
      "options": ["A", "B", "C", "D"],
      "correctAnswer": ["B"],
      "referenceAnswer": "",
      "keywords": [],
      "createdBy": "9",
      "createdAt": "2026-04-10T10:00:00+00:00"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 12,
    "total": 41,
    "totalPages": 4
  }
}
```

### DELETE `teacher/questions/{question_id}`

Behavior:
- Hard delete.
- Only creator teacher can delete.

Response:

```json
{ "deleted": true }
```

## 4) Create / Edit Question

### POST `teacher/questions`
### PATCH `teacher/questions/{question_id}`
### GET `teacher/questions/{question_id}`

Payload for create/update:

```json
{
  "moduleId": "5",
  "topicId": "18",
  "type": "Descriptive",
  "text": "Explain ...",
  "points": 5,
  "options": [],
  "correctAnswer": "",
  "referenceAnswer": "Expected answer...",
  "keywords": [
    { "text": "encapsulation", "weight": 2, "synonyms": ["data hiding"] }
  ]
}
```

Validation behavior:
- Module and text required.
- Points must be numeric and > 0.
- Type must be one of the supported types.
- For `MCQ`/`SCQ`: at least 2 options and valid correct answer.
- For `True/False`: correct answer must be `True` or `False`.
- For `Descriptive`: reference answer and at least one keyword required.

Error shape:

```json
{
  "detail": "Validation failed",
  "errors": {
    "points": "Points must be greater than 0."
  }
}
```

## Manual Test Scenarios

1. Login as teacher and open `Dashboard`:
   - Confirm stats and active assessments load from backend.
2. Open `My Modules`:
   - Confirm only assigned modules are shown with topics.
3. Open `Question Bank`:
   - Validate filtering by module/topic/type.
   - Validate sorting variants.
   - Validate pagination.
4. Delete a creator-owned question:
   - Ensure row is removed and DB row is deleted.
5. Create each question type:
   - `MCQ`, `SCQ`, `True/False`, `Descriptive`.
   - Validate server-side errors for invalid payloads.
6. Edit a question:
   - Save updates and confirm values are reflected in Question Bank.
7. Confirm existing teacher analytics/result-visibility pages still work.
