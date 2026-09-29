/* ==========================================================================
   MiniGameSystem.cs — the knowledge games, built from the question bank.

   Every mini-game is a way of asking the questions that already exist in
   questions.json; none of them invents content. The mission file names a
   mini-game (for example the event-matching game in the Social Reform gallery),
   and this system chooses the questions that fit its shape, so adding a
   question to questions.json can grow the game without a code change.

   The final challenge is the one composed game: six stages, each a different
   question type, in the order the brief describes.
   ========================================================================== */

using System.Collections.Generic;
using Heritage.Core;
using UnityEngine;

namespace Heritage.Systems
{
    public class MiniGameDefinition
    {
        public string title;
        public string instruction;
        public string zone;
        public string[] types;
        public int questionCount = 1;
    }

    public class MiniGameSystem : MonoBehaviour
    {
        public ContentDatabase content;
        public QuizSystem quiz;
        public QuestSystem quests;

        /// <summary>Stage number for each stage of the final challenge.</summary>
        public const int FinalStageCount = 6;

        readonly Dictionary<string, MiniGameDefinition> _definitions = new Dictionary<string, MiniGameDefinition>();

        public void Initialise(ContentDatabase database, QuizSystem quizSystem, QuestSystem questSystem)
        {
            content = database;
            quiz = quizSystem;
            quests = questSystem;
            BuildDefinitions();
        }

        void BuildDefinitions()
        {
            // The names come from quests.json; the meaning comes from here.
            _definitions["match_event"] = new MiniGameDefinition
            {
                title = "Match the Event to Its Meaning",
                instruction = "Pair each movement or event with what it achieved.",
                zone = "social_reform",
                types = new[] { "matching" }
            };
            _definitions["sort_timeline"] = new MiniGameDefinition
            {
                title = "Sort the Timeline",
                instruction = "Put the events in the order they happened.",
                zone = "social_reform",
                types = new[] { "ordering" }
            };

        }

        public MiniGameDefinition DefinitionFor(string minigameId)
        {
            MiniGameDefinition definition;
            if (_definitions.TryGetValue(minigameId, out definition)) return definition;
            return GuessDefinition(minigameId);
        }

        /// <summary>
        /// A mini-game named in quests.json that has no entry above still runs:
        /// the name decides the shape, and the question bank supplies the content.
        /// </summary>
        static MiniGameDefinition GuessDefinition(string minigameId)
        {
            string id = (minigameId ?? string.Empty).ToLowerInvariant();
            var definition = new MiniGameDefinition
            {
                title = id.StartsWith("minigame_") ? id.Substring("minigame_".Length).Replace('_', ' ') : id.Replace('_', ' '),
                instruction = "Answer the questions to continue."
            };
            if (id.Contains("match")) { definition.types = new[] { "matching" }; definition.zone = null; }
            else if (id.Contains("sort") || id.Contains("timeline")) { definition.types = new[] { "ordering" }; definition.zone = null; }
            else if (id.Contains("article") || id.Contains("draft")) { definition.types = new[] { "ordering", "multiple_choice" }; definition.zone = "law_constitution"; }
            else if (id.Contains("document") || id.Contains("manuscript")) { definition.types = new[] { "matching" }; definition.zone = "manuscripts"; }
            else if (id.Contains("memorial") || id.Contains("map")) { definition.types = new[] { "image_identification" }; definition.zone = "memorials"; }
            else { definition.types = new[] { "multiple_choice" }; definition.zone = null; }
            Debug.Log($"[minigames] '{minigameId}' has no authored definition; "
                      + $"running it as a {definition.types[0]} game over the question bank");
            return definition;
        }

        /// <summary>Starts the game named by an exhibit, and reports it to the missions.</summary>
        public QuizSession Start(string minigameName, string missionZone)
        {
            var definition = DefinitionFor(minigameName);
            string minigameId = minigameName != null && minigameName.StartsWith("minigame_")
                ? minigameName : "minigame_" + minigameName;
            var questions = Pick(definition.types, definition.zone ?? missionZone, definition.questionCount);
            var session = quiz.Start(Ids(questions), minigameId);
            if (quests != null) quests.Notify("minigame", minigameId);
            return session;
        }

        // -------------------------------------------------------- final challenge
        public string[] StageInstruction(int stage)
        {
            switch (stage)
            {
                case 1: return new[] { "Stage 1 — Identify the historical topic", "multiple_choice", "legacy" };
                case 2: return new[] { "Stage 2 — Match archive entries with their descriptions", "matching", "manuscripts" };
                case 3: return new[] { "Stage 3 — Arrange the timeline", "ordering", "social_reform" };
                case 4: return new[] { "Stage 4 — Constitutional questions", "multiple_choice", "law_constitution" };
                case 5: return new[] { "Stage 5 — Identify the documents", "image_identification", "manuscripts" };
                default: return new[] { "Stage 6 — Final knowledge questions", "true_false", "legacy" };
            }
        }

        public QuizSession StartFinalStage(int stage)
        {
            string[] instruction = StageInstruction(stage);
            var questions = Pick(new[] { instruction[1] }, instruction[2], 1);
            if (questions.Count == 0) questions = Pick(new[] { "multiple_choice" }, null, 1);
            var session = quiz.Start(Ids(questions), "final_challenge");
            session.index = 0;
            return session;
        }

        /// <summary>Called when a final stage has been cleared, so the mission advances.</summary>
        public void CompleteFinalStage(int stage)
        {
            if (quests == null) return;
            quests.Notify("final", null, 1, stage);
            if (stage >= FinalStageCount) quests.Notify("final", "certificate_screen");
        }

        // -------------------------------------------------------------- helpers
        List<Question> Pick(string[] types, string zone, int count)
        {
            var chosen = new List<Question>();
            var all = content.questions != null ? content.questions.questions : null;
            if (all == null) return chosen;

            // first pass honours the zone, so the game happens in the gallery the
            // mission is about; second pass widens rather than failing
            for (int pass = 0; pass < 2 && chosen.Count < count; pass++)
            {
                foreach (var question in all)
                {
                    if (chosen.Count >= count) break;
                    if (chosen.Contains(question)) continue;
                    if (pass == 0 && !string.IsNullOrEmpty(zone) && question.zone != zone) continue;
                    bool typeMatches = false;
                    foreach (var type in types) if (question.type == type) typeMatches = true;
                    if (!typeMatches) continue;
                    chosen.Add(question);
                }
            }
            return chosen;
        }

        static List<string> Ids(List<Question> questions)
        {
            var ids = new List<string>();
            foreach (var question in questions) ids.Add(question.id);
            return ids;
        }
    }
}
