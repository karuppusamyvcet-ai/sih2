/* ==========================================================================
   GameState.cs — settings, progression and the save file.

   Saves live in Application.persistentDataPath/save_v1.json. A corrupt or
   unreadable file is never deleted silently: it is copied to save_v1.corrupt.json
   and a fresh journey starts, which is exactly what the player is told.

   Achievements are evaluated from the trigger objects in achievements.json, so
   a content editor can add one without touching this file (see TriggerMet).
   ========================================================================== */

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;

namespace Heritage.Core
{
    [Serializable] public class Settings
    {
        public float master = 0.85f, music = 0.5f, voice = 0.9f, sfx = 0.7f;
        public bool subtitles = true, narration = true;
        public float textScale = 1f;
        public bool contrast, reduceEffects, simplifiedControls, invertY, vsync = true, showMinimap = true;
        public string language = "en";
        public string quality = "auto";              // auto | low | medium | high
        public float sensitivityMouse = 1f, sensitivityTouch = 1f;
        public int targetFrameRate = 60;
        public bool fullscreenMode;                  // false = windowed, true = exclusive fullscreen
    }

    [Serializable] public class QuizStat { public int attempted, correct, perfectSessions; }

    [Serializable] public class PlayerPose { public float x, y, z, yaw; public string zone = "hub"; }

    [Serializable] public class Progress
    {
        public int version = 1;
        public int missionIndex;
        public List<string> objectives = new List<string>();
        public List<string> collected = new List<string>();
        public List<string> exhibitionsVisited = new List<string>();
        public List<string> achievements = new List<string>();
        public List<string> zonesEntered = new List<string>();
        public List<string> zonesCompleted = new List<string>();
        public List<string> memorialsVisited = new List<string>();
        public List<string> quizCorrect = new List<string>();
        public List<string> missionsCompleted = new List<string>();
        public List<string> objectiveCounts = new List<string>();   // "missionId/objectiveId=count"

        public QuizStat quizStats = new QuizStat();
        public int knowledgePoints, searchesRun, guideQuestions, sourcesOpened;
        public float playSeconds;
        public PlayerPose player = new PlayerPose();
        public bool introSeen, demoMode, presentationMode, finished, archiveOpened, perfectQuiz;

        [NonSerialized] public Dictionary<string, bool> flags = new Dictionary<string, bool>();
    }

    [Serializable] class SaveFile { public Settings settings; public Progress progress; public string savedAt; }

    public class GameState
    {
        public Settings Settings = new Settings();
        public Progress Progress = new Progress();

        public event Action<string> Changed;
        public event Action<Achievement> AchievementUnlocked;
        public event Action<int> PointsChanged;

        ContentDatabase _content;
        string _badge;
        string SavePath => Path.Combine(Application.persistentDataPath, "save_v1.json");
        string BackupPath => Path.Combine(Application.persistentDataPath, "save_v1.corrupt.json");

        public void Bind(ContentDatabase content) => _content = content;

        // ------------------------------------------------------------- settings
        public string SettingsPath => Path.Combine(Application.persistentDataPath, "settings_v1.json");

        public void LoadSettings()
        {
            try
            {
                if (File.Exists(SettingsPath))
                    JsonUtility.FromJsonOverwrite(File.ReadAllText(SettingsPath), Settings);
            }
            catch (Exception err)
            {
                Debug.LogWarning("[settings] could not be read, using defaults: " + err.Message);
                Settings = new Settings();
            }
            ClampSettings();
        }

        public void SaveSettings()
        {
            try { File.WriteAllText(SettingsPath, JsonUtility.ToJson(Settings, true)); }
            catch (Exception err) { Debug.LogWarning("[settings] could not be saved: " + err.Message); }
        }

        public void SetSetting(string key, object value)
        {
            switch (key)
            {
                case "master": Settings.master = Convert.ToSingle(value); break;
                case "music": Settings.music = Convert.ToSingle(value); break;
                case "voice": Settings.voice = Convert.ToSingle(value); break;
                case "sfx": Settings.sfx = Convert.ToSingle(value); break;
                case "subtitles": Settings.subtitles = Convert.ToBoolean(value); break;
                case "narration": Settings.narration = Convert.ToBoolean(value); break;
                case "textScale": Settings.textScale = Convert.ToSingle(value); break;
                case "contrast": Settings.contrast = Convert.ToBoolean(value); break;
                case "reduceEffects": Settings.reduceEffects = Convert.ToBoolean(value); break;
                case "simplifiedControls": Settings.simplifiedControls = Convert.ToBoolean(value); break;
                case "invertY": Settings.invertY = Convert.ToBoolean(value); break;
                case "vsync": Settings.vsync = Convert.ToBoolean(value); break;
                case "showMinimap": Settings.showMinimap = Convert.ToBoolean(value); break;
                case "language": Settings.language = Convert.ToString(value); break;
                case "quality": Settings.quality = Convert.ToString(value); break;
                case "sensitivityMouse": Settings.sensitivityMouse = Convert.ToSingle(value); break;
                case "sensitivityTouch": Settings.sensitivityTouch = Convert.ToSingle(value); break;
                case "fullscreenMode": Settings.fullscreenMode = Convert.ToBoolean(value); break;
                case "targetFrameRate": Settings.targetFrameRate = Convert.ToInt32(value); break;
                default:
                    Debug.LogWarning($"[settings] unknown key '{key}' — settings.json and the panel disagree");
                    break;
            }
            ClampSettings();
            SaveSettings();
            Changed?.Invoke("settings");
        }

        void ClampSettings()
        {
            Settings.master = Mathf.Clamp01(Settings.master);
            Settings.music = Mathf.Clamp01(Settings.music);
            Settings.voice = Mathf.Clamp01(Settings.voice);
            Settings.sfx = Mathf.Clamp01(Settings.sfx);
            Settings.textScale = Mathf.Clamp(Settings.textScale, 0.8f, 1.8f);
            Settings.sensitivityMouse = Mathf.Clamp(Settings.sensitivityMouse, 0.2f, 3f);
            Settings.sensitivityTouch = Mathf.Clamp(Settings.sensitivityTouch, 0.2f, 3f);
            Settings.targetFrameRate = Mathf.Clamp(Settings.targetFrameRate, 24, 144);
            if (Settings.quality != "auto" && Settings.quality != "low"
                && Settings.quality != "medium" && Settings.quality != "high")
            {
                Debug.LogWarning($"[settings] quality '{Settings.quality}' is not a preset; using auto");
                Settings.quality = "auto";
            }
        }

        // ----------------------------------------------------------- progress
        public bool HasSave() => File.Exists(SavePath);

        public void Save()
        {
            try
            {
                var payload = new SaveFile { settings = Settings, progress = Progress, savedAt = DateTime.UtcNow.ToString("o") };
                File.WriteAllText(SavePath, JsonUtility.ToJson(payload, true));
            }
            catch (Exception err)
            {
                Debug.LogWarning("[save] could not write the save file: " + err.Message);
            }
        }

        /// <summary>Returns "ok", "empty" or "recovered".</summary>
        public string Load()
        {
            if (!File.Exists(SavePath)) return "empty";
            string raw = null;
            try
            {
                raw = File.ReadAllText(SavePath);
                var payload = JsonUtility.FromJson<SaveFile>(raw);
                if (payload == null || payload.progress == null)
                    throw new InvalidDataException("save shape not recognised");
                Progress = payload.progress ?? new Progress();
                if (payload.settings != null) Settings = payload.settings;
                // collections may have been truncated by an old version
                Progress.objectives ??= new List<string>();
                Progress.collected ??= new List<string>();
                Progress.achievements ??= new List<string>();
                Progress.zonesEntered ??= new List<string>();
                Progress.zonesCompleted ??= new List<string>();
                Progress.memorialsVisited ??= new List<string>();
                Progress.quizCorrect ??= new List<string>();
                Progress.exhibitionsVisited ??= new List<string>();
                Progress.quizStats ??= new QuizStat();
                Progress.player ??= new PlayerPose();
                ClampSettings();
                return "ok";
            }
            catch (Exception err)
            {
                try { if (raw != null) File.WriteAllText(BackupPath, raw); File.Delete(SavePath); }
                catch (Exception copyErr) { Debug.LogWarning("[save] could not quarantine the damaged file: " + copyErr.Message); }
                Debug.LogWarning("[save] the save file was damaged and has been reset: " + err.Message);
                Progress = new Progress();
                return "recovered";
            }
        }

        public void Reset()
        {
            Progress = new Progress();
            try { if (File.Exists(SavePath)) File.Delete(SavePath); }
            catch (Exception err) { Debug.LogWarning("[save] could not delete the save file: " + err.Message); }
            Changed?.Invoke("reset");
        }

        public string ExportJson()
        {
            var payload = new SaveFile { settings = Settings, progress = Progress, savedAt = DateTime.UtcNow.ToString("o") };
            return JsonUtility.ToJson(payload, true);
        }

        public bool ImportJson(string text)
        {
            try
            {
                var payload = JsonUtility.FromJson<SaveFile>(text);
                if (payload?.progress == null) return false;
                Progress = payload.progress;
                if (payload.settings != null) { Settings = payload.settings; ClampSettings(); SaveSettings(); }
                Save();
                Changed?.Invoke("import");
                return true;
            }
            catch (Exception err)
            {
                Debug.LogWarning("[save] the imported save is not valid: " + err.Message);
                return false;
            }
        }

        // ------------------------------------------------------------- records
        public bool RecordExhibit(string exhibitId)
        {
            if (string.IsNullOrEmpty(exhibitId) || Progress.exhibitionsVisited.Contains(exhibitId)) return false;
            Progress.exhibitionsVisited.Add(exhibitId);
            if (exhibitId == "exhibit_hub_guide_terminal") Progress.archiveOpened = true;
            AddPoints(5);
            Save();
            return true;
        }

        public bool Collect(string archiveId)
        {
            if (string.IsNullOrEmpty(archiveId) || Progress.collected.Contains(archiveId)) return false;
            Progress.collected.Add(archiveId);
            AddPoints(10);
            Save();
            return true;
        }

        public void EnterZone(string zoneId)
        {
            if (string.IsNullOrEmpty(zoneId) || Progress.zonesEntered.Contains(zoneId)) return;
            Progress.zonesEntered.Add(zoneId);
            Save();
        }

        public void CompleteZone(string zoneId)
        {
            if (Progress.zonesCompleted.Contains(zoneId)) return;
            Progress.zonesCompleted.Add(zoneId);
            Save();
            Changed?.Invoke("zone");
        }

        public bool VisitMemorial(string memorialId)
        {
            if (string.IsNullOrEmpty(memorialId) || Progress.memorialsVisited.Contains(memorialId)) return false;
            Progress.memorialsVisited.Add(memorialId);
            AddPoints(15);
            Save();
            return true;
        }

        public bool RecordQuiz(string questionId, bool correct)
        {
            var wasCorrect = Progress.quizCorrect.Contains(questionId);
            Progress.quizStats.attempted++;
            if (correct)
            {
                Progress.quizStats.correct++;
                if (!wasCorrect) { Progress.quizCorrect.Add(questionId); AddPoints(10); }
            }
            Save();
            return correct && !wasCorrect;
        }

        public void CountSearch() { Progress.searchesRun++; Save(); }
        public void CountGuideQuestion() { Progress.guideQuestions++; Save(); }
        public void CountSourceOpened() { Progress.sourcesOpened++; Save(); }

        public void AddPoints(int n)
        {
            Progress.knowledgePoints += n;
            PointsChanged?.Invoke(Progress.knowledgePoints);
            Changed?.Invoke("progress");
        }

        // ------------------------------------------------- mission progress
        // QuestSystem owns the mission logic; these four accessors own the save
        // format, so the encoding lives in exactly one place.
        public bool MissionCompleted(string missionId)
        {
            return !string.IsNullOrEmpty(missionId) && Progress.missionsCompleted.Contains(missionId);
        }

        public void MarkMissionComplete(string missionId)
        {
            if (string.IsNullOrEmpty(missionId) || Progress.missionsCompleted.Contains(missionId)) return;
            Progress.missionsCompleted.Add(missionId);
            Progress.missionIndex = Progress.missionsCompleted.Count;
            Save();
            Changed?.Invoke("mission");
        }

        public int ObjectiveCount(string missionId, string objectiveId)
        {
            string key = missionId + "/" + objectiveId;
            foreach (var entry in Progress.objectiveCounts)
            {
                int split = entry.LastIndexOf('=');
                if (split <= 0) continue;
                if (entry.Substring(0, split) != key) continue;
                int value;
                if (int.TryParse(entry.Substring(split + 1), out value)) return value;
            }
            return 0;
        }

        public void SetObjectiveCount(string missionId, string objectiveId, int count)
        {
            string key = missionId + "/" + objectiveId;
            for (int i = 0; i < Progress.objectiveCounts.Count; i++)
            {
                int split = Progress.objectiveCounts[i].LastIndexOf('=');
                if (split <= 0 || Progress.objectiveCounts[i].Substring(0, split) != key) continue;
                Progress.objectiveCounts[i] = key + "=" + count;
                Save();
                return;
            }
            Progress.objectiveCounts.Add(key + "=" + count);
            Save();
        }

        public bool HasAchievement(string achievementId)
        {
            return !string.IsNullOrEmpty(achievementId) && Progress.achievements.Contains(achievementId);
        }

        public void AwardBadge(string badgeId)
        {
            if (string.IsNullOrEmpty(badgeId)) return;
            _badge = badgeId;
            Progress.finished = true;
            Save();
            Changed?.Invoke("completion");
        }

        public string Badge => _badge;

        public float QuizAccuracy()
        {
            int total = Mathf.Max(Progress.quizStats.attempted, _content?.questions?.questions?.Length ?? 0);
            return total == 0 ? 0f : Progress.quizStats.correct / (float)total;
        }

        // -------------------------------------------------------- achievements
        /// <summary>
        /// Awards every achievement whose trigger is satisfied. Triggers are data
        /// (achievements.json): mission_complete, completion, collect, interact,
        /// ask_guide, search, source_opened, quiz_perfect, memorial, zone_entered.
        /// </summary>
        public List<Achievement> EvaluateAchievements(QuestSystem quests)
        {
            var unlocked = new List<Achievement>();
            if (_content?.achievements?.achievements == null) return unlocked;
            foreach (var achievement in _content.achievements.achievements)
            {
                if (Progress.achievements.Contains(achievement.id)) continue;
                if (!TriggerMet(achievement.trigger, quests)) continue;
                Progress.achievements.Add(achievement.id);
                AddPoints(achievement.points);
                unlocked.Add(achievement);
                AchievementUnlocked?.Invoke(achievement);
            }
            if (unlocked.Count > 0) Save();
            return unlocked;
        }

        public bool TriggerMet(Trigger trigger, QuestSystem quests)
        {
            if (trigger == null) return false;
            int need = Mathf.Max(1, trigger.count);
            switch (trigger.type)
            {
                case "mission_complete": return quests != null && quests.IsMissionComplete(trigger.target);
                case "completion": return quests != null && quests.AllComplete();
                case "collect": return Progress.collected.Count >= need;
                case "interact":
                    return Progress.exhibitionsVisited.Contains(trigger.target)
                        || Progress.memorialsVisited.Contains(trigger.target)
                        || (trigger.target == "ui_archive" && Progress.archiveOpened);
                case "ask_guide": return Progress.guideQuestions >= need;
                case "search": return Progress.searchesRun >= need;
                case "source_opened": return Progress.sourcesOpened >= need;
                case "quiz_perfect": return Progress.quizStats.perfectSessions >= need || Progress.perfectQuiz;
                case "memorial": return Progress.memorialsVisited.Count >= need;
                case "zone_entered": return Progress.zonesEntered.Contains(trigger.target);
                default:
                    Debug.LogWarning($"[achievements] trigger type '{trigger.type}' is not supported — "
                                     + "achievements.json and GameState.TriggerMet disagree");
                    return false;
            }
        }

        /// <summary>The eight statistics shown on the completion certificate.</summary>
        public List<KeyValuePair<string, string>> Dashboard()
        {
            var rows = new List<KeyValuePair<string, string>>();
            if (_content?.achievements?.progressDashboard?.fields == null) return rows;
            foreach (var field in _content.achievements.progressDashboard.fields)
            {
                string value;
                switch (field.id)
                {
                    case "exhibits_discovered": value = Progress.exhibitionsVisited.Count.ToString(); break;
                    case "archive_items": value = Progress.collected.Count.ToString(); break;
                    case "quiz_score":
                        value = Progress.quizStats.correct + "/" + Mathf.Max(Progress.quizStats.attempted,
                            _content.questions?.questions?.Length ?? 0); break;
                    case "knowledge_points": value = Progress.knowledgePoints.ToString(); break;
                    case "galleries_completed":
                        value = Progress.zonesCompleted.Count + "/" + (_content.zones?.zones?.Length ?? 6); break;
                    case "memorials_visited":
                        value = Progress.memorialsVisited.Count + "/" + (_content.memorials?.sites?.Length ?? 8); break;
                    case "searches_run": value = Progress.searchesRun.ToString(); break;
                    case "guide_questions": value = Progress.guideQuestions.ToString(); break;
                    default: value = "—"; break;
                }
                rows.Add(new KeyValuePair<string, string>(field.label, value));
            }
            return rows;
        }
    }
}
