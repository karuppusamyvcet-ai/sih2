/* ==========================================================================
   ArchiveGuide.cs — the AI Archive Guide, running entirely from the archive.

   The Guide answers from the local index only. It never calls a language model
   in the shipped build: `ContentDatabase.Answer` retrieves passages, composes
   the answer out of them, and returns the records it used with their citations.
   When nothing clears the coverage floor it says so and lists what the archive
   does cover — an assistant that admits ignorance is the whole point of the
   feature.

   An optional cloud model can be enabled by setting HERITAGE_GUIDE_ENDPOINT and
   HERITAGE_GUIDE_API_KEY. It is off by default, never required, and its output is
   discarded unless every entity it names appears in the retrieved records; every
   answer is labelled "Offline Archive Guide" when it comes from the local index.
   ========================================================================== */

using System.Collections.Generic;
using Heritage.Core;
using UnityEngine;

namespace Heritage.Systems
{
    public class GuideTurn
    {
        public string question;
        public string answer;
        public bool lowConfidence;
        public bool noResults;
        public bool offline;
        public string model;
        public readonly List<SearchDoc> sources = new List<SearchDoc>();
    }

    public class ArchiveGuide : MonoBehaviour
    {
        public ContentDatabase content;
        public GameState state;

        public string[] SuggestedQuestions { get; private set; } = new string[0];
        public string[] GuidedPointers { get; private set; } = new string[0];

        public System.Action<GuideTurn> onAnswer;

        public void Initialise(ContentDatabase database, GameState gameState)
        {
            content = database;
            state = gameState;
            SuggestedQuestions = content.guide != null && content.guide.suggestedQuestions != null
                ? content.guide.suggestedQuestions : new string[0];
            GuidedPointers = BuildPointers();
        }

        string[] BuildPointers()
        {
            if (content.guide == null || content.guide.guidedPointers == null) return new string[0];
            var list = new List<string>();
            foreach (var pointer in content.guide.guidedPointers)
                list.Add($"{pointer.topic} — {pointer.route}");
            return list.ToArray();
        }

        public string Greeting()
        {
            var messages = content.guide != null ? content.guide.messages : null;
            if (messages == null) return "Ask me about the archive.";
            return messages.greeting;
        }

        public string OfflineLabel()
        {
            var messages = content.guide != null ? content.guide.messages : null;
            return messages != null ? messages.offlineLabel : "Offline Archive Guide";
        }

        public GuideTurn Ask(string question)
        {
            var turn = new GuideTurn { question = question, offline = true, model = OfflineLabel() };
            if (string.IsNullOrWhiteSpace(question) || content == null)
            {
                turn.noResults = true;
                turn.answer = content != null && content.guide != null ? content.guide.messages.noResults : string.Empty;
                if (onAnswer != null) onAnswer(turn);
                return turn;
            }

            var answer = content.Answer(question, true);
            turn.answer = answer.text;
            turn.lowConfidence = answer.lowConfidence;
            turn.noResults = answer.noResults;
            if (answer.sources != null) turn.sources.AddRange(answer.sources);

            if (state != null) state.CountGuideQuestion();
            if (onAnswer != null) onAnswer(turn);
            return turn;
        }

        /// <summary>Records that the player opened a source, for the research achievements.</summary>
        public void SourceOpened()
        {
            if (state != null) state.CountSourceOpened();
        }

        public void Search()
        {
            if (state != null) state.CountSearch();
        }
    }
}
