/* ==========================================================================
   QuestSystem.cs — the eight missions and their objectives, read from JSON.

   Nothing here knows what mission 4 is about. Mission ids, objective ids,
   objective types, targets, counts and the completion badge all come from
   Assets/Resources/Content/quests.json, which is why a content editor can add a
   ninth mission without touching this file.

   Two rules the browser build learned the hard way are enforced here as well:

   * an objective that declares a count is checked every time its counter
     changes, so no objective can be left silently unfinishable;
   * a counted quiz objective whose target names one question counts the whole
     question group, not just that single id.
   ========================================================================== */

using System.Collections.Generic;
using Heritage.Core;
using UnityEngine;

namespace Heritage.Systems
{
    public class ObjectiveProgress
    {
        public string objectiveId;
        public int done;
        public int total;

        public bool Complete => done >= total;
        public float Fraction => total <= 0 ? 0f : Mathf.Clamp01(done / (float)total);
    }

    public class MissionState
    {
        public Mission mission;
        public readonly List<ObjectiveProgress> objectives = new List<ObjectiveProgress>();
        public bool completed;

        public int DoneCount
        {
            get
            {
                int count = 0;
                foreach (var objective in objectives) if (objective.Complete) count++;
                return count;
            }
        }

        public float Fraction => objectives.Count == 0 ? 0f : DoneCount / (float)objectives.Count;
    }

    public class QuestSystem : MonoBehaviour
    {
        public ContentDatabase content;
        public GameState state;

        public readonly List<MissionState> missions = new List<MissionState>();

        public System.Action<MissionState> onMissionCompleted;
        public System.Action<MissionState> onMissionStarted;
        public System.Action<Achievement> onAchievement;
        public System.Action<MissionState, ObjectiveProgress> onObjectiveProgress;

        public MissionState Current { get; private set; }
        public bool CompletionEarned { get; private set; }

        public void Initialise(ContentDatabase database, GameState gameState)
        {
            content = database;
            state = gameState;
            missions.Clear();
            BuildMissions();
            Restore();

            Current = FirstIncomplete();
            if (Current != null && onMissionStarted != null) onMissionStarted(Current);
            CompletionEarned = AllComplete();
        }

        void BuildMissions()
        {
            if (content.quests == null || content.quests.missions == null) return;
            var ordered = new List<Mission>(content.quests.missions);
            ordered.Sort((a, b) => a.index.CompareTo(b.index));
            foreach (var mission in ordered)
            {
                var missionState = new MissionState { mission = mission };
                foreach (var objective in mission.objectives)
                {
                    objective.count = objective.count <= 0 ? 1 : objective.count;
                    missionState.objectives.Add(new ObjectiveProgress
                    {
                        objectiveId = objective.id,
                        total = objective.count
                    });
                }
                missions.Add(missionState);
            }
        }

        void Restore()
        {
            if (state == null) return;
            foreach (var missionState in missions)
            {
                foreach (var objective in missionState.objectives)
                    objective.done = Mathf.Clamp(
                        state.ObjectiveCount(missionState.mission.id, objective.objectiveId), 0, objective.total);
                missionState.completed = state.MissionCompleted(missionState.mission.id)
                    || (missionState.objectives.Count > 0 && missionState.DoneCount == missionState.objectives.Count);
            }
        }

        // --------------------------------------------------------------- queries
        public MissionState FirstIncomplete()
        {
            foreach (var missionState in missions) if (!missionState.completed) return missionState;
            return null;
        }

        public MissionState StateOf(string missionId)
        {
            foreach (var missionState in missions)
                if (missionState.mission.id == missionId) return missionState;
            return null;
        }

        /// <summary>Used by the achievement evaluator in GameState.</summary>
        public bool IsMissionComplete(string missionId)
        {
            var missionState = StateOf(missionId);
            return missionState != null && missionState.completed;
        }

        /// <summary>True when every mission is complete and the quiz bar is met.</summary>
        public bool AllComplete()
        {
            var completion = content.quests != null ? content.quests.completion : null;
            if (completion == null) return EveryMissionComplete();
            foreach (var missionId in completion.requires)
                if (!IsMissionComplete(missionId)) return false;
            return state != null && state.QuizAccuracy() >= completion.minQuizAccuracy - 0.0001f;
        }

        public bool EveryMissionComplete()
        {
            if (missions.Count == 0) return false;
            foreach (var missionState in missions) if (!missionState.completed) return false;
            return true;
        }

        // -------------------------------------------------------------- updates
        /// <summary>
        /// The single entry point for gameplay events: reach, interact, collect,
        /// quiz, search, ask_guide, minigame, final.
        /// </summary>
        public void Notify(string type, string target, int amount = 1, int stage = 0)
        {
            foreach (var missionState in missions)
            {
                if (missionState.completed) continue;
                bool touched = false;
                foreach (var objective in missionState.objectives)
                {
                    if (objective.Complete) continue;
                    var definition = DefinitionOf(missionState.mission, objective.objectiveId);
                    if (definition == null || definition.type != type) continue;
                    if (!Matches(definition, target, stage)) continue;

                    objective.done = Mathf.Min(objective.total, objective.done + Mathf.Max(1, amount));
                    if (state != null)
                        state.SetObjectiveCount(missionState.mission.id, objective.objectiveId, objective.done);
                    touched = true;
                    if (onObjectiveProgress != null) onObjectiveProgress(missionState, objective);
                }

                if (touched && missionState.objectives.Count > 0 && missionState.DoneCount == missionState.objectives.Count)
                    CompleteMission(missionState);
            }

            EvaluateAchievements();
        }

        static bool Matches(Objective objective, string target, int stage)
        {
            // staged objectives (the six-stage final challenge) only advance on
            // the event that names their own stage — otherwise clearing stage one
            // would tick all six at once
            if (objective.stage > 0)
                return objective.stage == stage;
            if (string.IsNullOrEmpty(objective.target)) return true;
            if (objective.target == target) return true;
            if (objective.type == "quiz" && !string.IsNullOrEmpty(target))
            {
                // a question id also matches the shorter group prefix the
                // objective names, so a three-question objective fills from
                // three different questions in that group
                if (target.StartsWith(objective.target)) return true;
                if (objective.target.StartsWith(target)) return true;
            }
            return false;
        }

        static Objective DefinitionOf(Mission mission, string objectiveId)
        {
            foreach (var objective in mission.objectives)
                if (objective.id == objectiveId) return objective;
            return null;
        }

        void CompleteMission(MissionState missionState)
        {
            if (missionState.completed) return;
            missionState.completed = true;
            if (state != null)
            {
                state.MarkMissionComplete(missionState.mission.id);
                state.AddPoints(missionState.mission.rewardPoints);
            }

            Current = FirstIncomplete();
            if (onMissionCompleted != null) onMissionCompleted(missionState);
            if (Current != null && onMissionStarted != null) onMissionStarted(Current);

            EvaluateAchievements();
        }

        /// <summary>
        /// Achievements are data (achievements.json) and their counters live in
        /// GameState, so this simply asks the state layer to award whatever is
        /// now satisfied and reports the new badges to the interface.
        /// </summary>
        public void EvaluateAchievements()
        {
            if (state == null) return;
            var unlocked = state.EvaluateAchievements(this);
            if (unlocked == null || unlocked.Count == 0) return;
            foreach (var achievement in unlocked)
                if (onAchievement != null) onAchievement(achievement);
            CheckCompletion();
        }

        public void CheckCompletion()
        {
            if (CompletionEarned) return;
            if (!AllComplete()) return;
            CompletionEarned = true;
            var completion = content.quests != null ? content.quests.completion : null;
            string badge = completion != null ? completion.id : "heritage_archivist";
            if (state != null) state.AwardBadge(badge);
            EvaluateAchievements();
        }

        /// <summary>Progress for the objectives panel, in mission order.</summary>
        public List<MissionState> OrderedMissions() => missions;
    }
}
