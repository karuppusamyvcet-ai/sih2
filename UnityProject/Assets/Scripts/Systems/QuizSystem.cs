/* ==========================================================================
   QuizSystem.cs — the five question types, graded with reasons.

   The brief is explicit that feedback must teach: "Wrong. The correct answer is
   …" is not acceptable. Every result therefore carries the explanation and the
   citation from questions.json, whichever way the player answered.

   Supported types: multiple_choice, true_false, ordering, matching,
   image_identification. Ordering and matching are graded by proportion, so a
   nearly-right timeline still scores and still explains itself.
   ========================================================================== */

using System.Collections.Generic;
using Heritage.Core;
using UnityEngine;

namespace Heritage.Systems
{
    public class QuizAnswer
    {
        public bool correct;
        public float score;              // 0..1
        public string explanation;
        public string source;
        public int points;
        public string chosenId;
        public List<string> chosenOrder = new List<string>();
        public Dictionary<string, string> chosenPairs = new Dictionary<string, string>();
    }

    public class QuizSession
    {
        public readonly List<Question> questions = new List<Question>();
        public int index;
        public int correct;
        public int answered;
        public float scoreSum;
        public int points;
        public bool finished;
        public string kind;              // "quiz" | "minigame_match_event" | "minigame_sort_timeline" | "final_challenge"

        public Question Current => index >= 0 && index < questions.Count ? questions[index] : null;
        public bool HasNext => index + 1 < questions.Count;
        public float Accuracy => answered == 0 ? 0f : correct / (float)answered;
    }

    public class QuizSystem : MonoBehaviour
    {
        public ContentDatabase content;
        public GameState state;

        public QuizSession Session { get; private set; }

        public System.Action<Question, QuizAnswer> onAnswered;
        public System.Action<QuizSession> onFinished;

        public void Initialise(ContentDatabase database, GameState gameState)
        {
            content = database;
            state = gameState;
        }

        public QuizSession Start(IEnumerable<string> questionIds, string kind = "quiz")
        {
            Session = new QuizSession { kind = kind };
            if (questionIds != null)
            {
                foreach (var id in questionIds)
                {
                    Question question;
                    if (content.QuestionsById.TryGetValue(id, out question) && !Session.questions.Contains(question))
                        Session.questions.Add(question);
                }
            }
            if (Session.questions.Count == 0)
                Debug.LogWarning($"[quiz] started '{kind}' with no questions — the content ids "
                                 + "passed in do not exist in questions.json");
            return Session;
        }

        /// <summary>Questions for a zone, used by the gallery stands and the final challenge.</summary>
        public List<Question> QuestionsIn(string zone, int max = 5)
        {
            var list = new List<Question>();
            if (content.questions == null || content.questions.questions == null) return list;
            foreach (var question in content.questions.questions)
            {
                if (question.zone != zone) continue;
                list.Add(question);
                if (list.Count >= max) break;
            }
            return list;
        }

        // ------------------------------------------------------------- grading
        public QuizAnswer Submit(object answer)
        {
            var question = Session != null ? Session.Current : null;
            var result = new QuizAnswer();
            if (question == null) return result;

            result.explanation = question.explanation;
            result.source = question.source;
            result.points = question.points > 0 ? question.points : 10;
            result.chosenId = answer as string;

            switch (question.type)
            {
                case "ordering":
                    result.chosenOrder = answer as List<string> ?? new List<string>();
                    result.score = GradeOrdering(question, result.chosenOrder);
                    break;
                case "matching":
                    result.chosenPairs = answer as Dictionary<string, string> ?? new Dictionary<string, string>();
                    result.score = GradeMatching(question, result.chosenPairs);
                    break;
                default:
                    result.score = GradeChoice(question, result.chosenId) ? 1f : 0f;
                    break;
            }

            result.correct = result.score >= 0.999f;
            if (state != null)
            {
                state.RecordQuiz(question.id, result.correct);
                if (result.score >= 0.999f) state.AddPoints(result.points);
            }

            Session.answered++;
            Session.scoreSum += result.score;
            if (result.correct) Session.correct++;
            Session.points += Mathf.RoundToInt(result.points * result.score);

            if (onAnswered != null) onAnswered(question, result);
            return result;
        }

        static bool GradeChoice(Question question, string chosenId)
        {
            if (string.IsNullOrEmpty(chosenId)) return false;
            if (!string.IsNullOrEmpty(question.answerId) && chosenId == question.answerId) return true;
            if (question.type == "true_false")
            {
                string wanted = question.answerBool ? "true" : "false";
                if (!string.IsNullOrEmpty(question.answerId)) wanted = question.answerId;
                return chosenId == wanted;
            }
            return false;
        }

        static float GradeOrdering(Question question, List<string> chosen)
        {
            var correct = new List<string>();
            if (question.correctOrder != null && question.correctOrder.Length > 0)
                correct.AddRange(question.correctOrder);
            else if (question.items != null)
                foreach (var item in question.items) correct.Add(item.id);
            if (correct.Count == 0) return 0f;

            int longest = 0, run = 0;
            for (int i = 0; i < chosen.Count && i < correct.Count; i++)
            {
                if (chosen[i] == correct[i]) { run++; longest = Mathf.Max(longest, run); }
                else run = 0;
            }
            return longest / (float)correct.Count;
        }

        static float GradeMatching(Question question, Dictionary<string, string> chosen)
        {
            if (question.pairs == null || question.pairs.Length == 0) return 0f;
            int right = 0;
            foreach (var pair in question.pairs)
            {
                string value;
                if (chosen.TryGetValue(pair.left, out value) && value == pair.right) right++;
            }
            return right / (float)question.pairs.Length;
        }

        // ------------------------------------------------------------ progress
        public void Next()
        {
            if (Session == null) return;
            Session.index++;
            if (Session.index >= Session.questions.Count)
            {
                Session.finished = true;
                if (Session.answered > 0 && Session.correct == Session.questions.Count && state != null)
                {
                    state.Progress.quizStats.perfectSessions++;
                    state.Progress.perfectQuiz = true;
                    state.Save();
                }
                if (onFinished != null) onFinished(Session);
            }
        }

        public string SummaryText(QuizSession session)
        {
            if (session == null) return string.Empty;
            return $"{session.correct}/{session.questions.Count} correct · "
                 + $"{session.points} knowledge points · {Mathf.RoundToInt(session.Accuracy * 100f)}%";
        }
    }
}
