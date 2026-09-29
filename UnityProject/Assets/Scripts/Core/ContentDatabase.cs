/* ==========================================================================
   ContentDatabase.cs — the archive, loaded from the same JSON the web build
   reads (Assets/Resources/Content/*.json). This is the single source of truth
   for both targets: a content editor adds a record or a question by editing
   that JSON, never by touching gameplay code (brief: "no hard-coded content").

   The class mirrors the browser implementation in web/src/core/content.js
   exactly — same fields, same ranking (presence weighting, inverse document
   frequency, a title bonus and damped synonyms), same answer policy: the
   Archive Guide answers only from retrieved passages and always reports which
   records it used.
   ========================================================================== */

using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using UnityEngine;

namespace Heritage.Core
{
    // ----------------------------------------------------------------- models
    [Serializable] public class MediaItem
    {
        public string kind;              // image | audio | video | document | model
        public string path;
        public string label;
        public bool isReconstruction;
        public string note;
    }

    [Serializable] public class ArchiveRecord
    {
        public string id;
        public string title;
        public string category;
        public string zone;
        public string period;
        public string date;
        public string location;
        public string author;
        public string description;
        public string significance;
        public string[] keywords;
        public string source;
        public string sourceUrl;
        public MediaItem[] media;
        public string[] relatedIds;
    }

    [Serializable] public class ArchiveFile { public string schema; public int version; public string note; public ArchiveRecord[] records; }

    [Serializable] public class TimelineEvent { public string id; public int year; public string date; public string title; public string zone; public string archiveId; public string precision; }
    [Serializable] public class TimelineFile { public string schema; public int version; public string note; public TimelineEvent[] events; }

    [Serializable] public class ZoneDef
    {
        public string id; public string name; public string subtitle; public string description;
        public string sceneName; public string accentColor; public string icon; public int doorIndex;
        public string doorLabel; public UnlockRule unlockRule; public string[] exhibitIds; public string[] objectiveIds;
    }
    [Serializable] public class UnlockRule { public string type; public string missionId; public string lockedMessage; }
    [Serializable] public class ZonesFile { public string schema; public int version; public string note; public ZoneDef[] zones; }

    [Serializable] public class MuseumDoor { public string doorId; public int index; public string zone; public string label; public float[] position; public float[] size; public string accentColor; public string icon; public string lockedMessage; }
    [Serializable] public class SpotGroup { public string id; public float[] position; public int count; public float spacing; public float intensity; public string color; }
    [Serializable] public class SetDressing { public string id; public string kind; public float[] position; public float[] rotation; public float[] scale; public string material; }
    [Serializable] public class HallSpec { public float width; public float depth; public float height; public float[] spawn; public float ceilingHeight; }
    [Serializable] public class MuseumFile
    {
        public string schema; public int version; public string note;
        public HallSpec hall; public MuseumDoor[] doors; public SpotGroup[] spotGroups;
        public SetDressing[] setDressing; public float[] ambient; public float ambientIntensity;
        public float minimapScale; public Dictionary<string, object> lighting;
    }

    [Serializable] public class Option { public string id; public string text; }
    [Serializable] public class PairItem { public string id; public string left; public string right; }
    [Serializable] public class OrderItem { public string id; public string text; }

    [Serializable] public class Question
    {
        public string id; public string type; public string zone; public string prompt;
        public Option[] options; public string answerId; public bool answerBool;
        public PairItem[] pairs; public OrderItem[] items; public string[] correctOrder;
        public string explanation; public string source; public string[] archiveRefs;
        public string[] conceptRefs; public int points; public string image; public string difficulty;
    }
    [Serializable] public class QuestionsFile { public string schema; public int version; public string note; public int defaultPoints; public Question[] questions; }

    [Serializable] public class Objective
    {
        public string id; public string type; public string label; public string target;
        public float radius; public int count; public int stage;
    }
    [Serializable] public class Mission
    {
        public string id; public int index; public string title; public string hudTitle; public string description;
        public string zone; public string doorId; public int rewardPoints; public Objective[] objectives;
    }
    [Serializable] public class Completion { public string id; public string title; public string description; public string[] requires; public float minQuizAccuracy; }
    [Serializable] public class QuestsFile { public string schema; public int version; public string note; public Dictionary<string, string> objectiveTypes; public Mission[] missions; public Completion completion; }

    [Serializable] public class Trigger { public string type; public string target; public int count; }
    [Serializable] public class Achievement { public string id; public string title; public string description; public int points; public string icon; public Trigger trigger; }
    [Serializable] public class DashboardField { public string id; public string label; }
    [Serializable] public class ProgressDashboard { public string title; public DashboardField[] fields; }
    [Serializable] public class AchievementsFile { public string schema; public int version; public string note; public Achievement[] achievements; public ProgressDashboard progressDashboard; }

    [Serializable] public class TourStop { public string id; public string label; public string text; public float[] position; public float[] look; public float dwell; public string narration; }
    [Serializable] public class MemorialSite
    {
        public string id; public string name; public string city; public string state; public string country;
        public float[] coordinates; public string sceneStyle; public Dictionary<string, float> sceneParams;
        public string palette; public string archiveId; public string[] timelineIds; public string narration;
        public string[] tags; public TourStop[] tour; public string reconstructionLabel;
    }
    [Serializable] public class MemorialsFile { public string schema; public int version; public string note; public string reconstructionLabel; public MemorialSite[] sites; }

    [Serializable] public class Concept
    {
        public string id; public string term; public string zone; public string shortDef; public string longDef;
        public string[] keywords; public string source; public string[] archiveIds;
    }
    [Serializable] public class GlossaryFile { public string schema; public int version; public string note; public Concept[] concepts; }

    [Serializable] public class GuideMessage { public string greeting; public string offlineLabel; public string offlineNotice; public string noResults; public string sourcesHeading; public string reconstructionWarning; public string lowConfidence; public string offlineOnly; }

    [Serializable] public class GuideAnswerPolicy
    {
        public bool useOnlyRetrievedPassages; public bool alwaysCiteSources; public bool refuseWhenUnsure;
        public bool labelOfflineMode; public int maxSentences;
    }

    [Serializable] public class RetrievalConfig
    {
        public string[] indexFields; public float title; public float keywords; public float description;
        public float significance; public float term; public float shortDef; public float longDef; public float tags;
        public int topK; public float minScore; public float lowConfidenceAt;
    }

    [Serializable] public class GuideFile
    {
        public string schema; public int version; public string note;
        public Dictionary<string, object> architecture;
        public GuideMessage messages; public string[] suggestedQuestions; public ZonePointer[] guidedPointers;
    }
    [Serializable] public class ZonePointer { public string zone; public string topic; public string route; }

    [Serializable] public class LocaleEntry { public string code; public string name; public string status; public string translator; }
    [Serializable] public class LocalizationFile
    {
        public string schema; public int version; public string note;
        public string defaultLocale; public LocaleEntry[] locales;
        public Dictionary<string, Dictionary<string, string>> strings;
    }

    [Serializable] public class RoomSpec { public float[] size; public string style; public string[] palette; public float ceilingHeight; }
    [Serializable] public class ExhibitDef
    {
        public string id; public string zone; public string kind; public string label; public string interaction;
        public float[] position; public float[] rotation; public string panel; public string[] archiveIds;
        public string[] quizIds; public string[] conceptRefs; public string memorialId; public string[] timelineIds;
        public string prompt; public bool walkable; public Dictionary<string, float> params;
    }
    [Serializable] public class ExhibitsFile
    {
        public string schema; public int version; public string note;
        public Dictionary<string, RoomSpec> rooms; public ExhibitDef[] exhibits; public string[] interactionKinds;
    }

    [Serializable] public class ClipDef { public string name; public string kind; public float duration; public string[] bones; public string note; }
    [Serializable] public class CharacterSpec
    {
        public string schema; public string id; public string displayName; public string role; public string disclaimer;
        public float heightTotal; public Dictionary<string, float> proportions;
        public Dictionary<string, object> facialFeatures; public Dictionary<string, object> clothing;
        public Dictionary<string, object> materials; public string[] clipList;
    }

    /// <summary>One retrievable passage: an archive record, a concept, a memorial or an event.</summary>
    public class SearchDoc
    {
        public string kind;
        public string id;
        public string title;
        public string citation;
        public Dictionary<string, float> tokens = new Dictionary<string, float>();
        public HashSet<string> titleTokens = new HashSet<string>();
        public float score;

        public ArchiveRecord record;
        public Concept concept;
        public MemorialSite site;
        public TimelineEvent timelineEvent;
        public ZoneDef zone;
    }

    public class GuideAnswer
    {
        public string text;
        public List<SearchDoc> sources = new List<SearchDoc>();
        public bool noResults;
        public bool lowConfidence;
        public bool offline;
    }

    /// <summary>Loads content/**/*.json and implements search plus the Guide's answer policy.</summary>
    public class ContentDatabase
    {
        public ArchiveFile archive;
        public TimelineFile timeline;
        public ZonesFile zones;
        public MuseumFile museum;
        public QuestionsFile questions;
        public QuestsFile quests;
        public AchievementsFile achievements;
        public MemorialsFile memorials;
        public GlossaryFile glossary;
        public GuideFile guide;
        public LocalizationFile localization;
        public ExhibitsFile exhibits;
        public CharacterSpec character;

        public readonly Dictionary<string, ArchiveRecord> RecordsById = new Dictionary<string, ArchiveRecord>();
        public readonly Dictionary<string, Question> QuestionsById = new Dictionary<string, Question>();
        public readonly Dictionary<string, Mission> MissionsById = new Dictionary<string, Mission>();
        public readonly Dictionary<string, Achievement> AchievementsById = new Dictionary<string, Achievement>();
        public readonly Dictionary<string, MemorialSite> MemorialsById = new Dictionary<string, MemorialSite>();
        public readonly Dictionary<string, ZoneDef> ZonesById = new Dictionary<string, ZoneDef>();
        public readonly Dictionary<string, Concept> ConceptsById = new Dictionary<string, Concept>();
        public readonly Dictionary<string, ExhibitDef> ExhibitsById = new Dictionary<string, ExhibitDef>();
        public readonly Dictionary<string, TimelineEvent> EventsById = new Dictionary<string, TimelineEvent>();

        /// <summary>Raw parsed content for the fields JsonUtility cannot represent (dictionaries).</summary>
        public readonly Dictionary<string, Dictionary<string, object>> Raw = new Dictionary<string, Dictionary<string, object>>();

        readonly List<SearchDoc> _docs = new List<SearchDoc>();
        readonly Dictionary<string, int> _documentFrequency = new Dictionary<string, int>();
        readonly Dictionary<string, string[]> synonymTable = new Dictionary<string, string[]>();
        string _locale = "en";

        static readonly HashSet<string> StopWords = new HashSet<string>((
            "a an the and or of in on to for with from by is are was were be been being it its this that these those " +
            "as at into about than then them they he she his her their our your you we what which who whom how why " +
            "when where can could should would will shall may might must not no yes do does did done have has had " +
            "there here also more most other such only own same so too very s t just don now").Split(' '));

        // ------------------------------------------------------------------ load
        public static ContentDatabase Load()
        {
            var db = new ContentDatabase
            {
                archive = Read<ArchiveFile>("archive"),
                timeline = Read<TimelineFile>("timeline"),
                zones = Read<ZonesFile>("zones"),
                museum = Read<MuseumFile>("museum"),
                questions = Read<QuestionsFile>("questions"),
                quests = Read<QuestsFile>("quests"),
                achievements = Read<AchievementsFile>("achievements"),
                memorials = Read<MemorialsFile>("memorials"),
                glossary = Read<GlossaryFile>("glossary"),
                guide = Read<GuideFile>("guide"),
                localization = Read<LocalizationFile>("localization"),
                exhibits = Read<ExhibitsFile>("exhibits"),
                character = Read<CharacterSpec>("character_spec")
            };
            foreach (var name in new[] { "archive", "timeline", "zones", "museum", "questions", "quests",
                "achievements", "memorials", "glossary", "guide", "localization", "exhibits", "character_spec" })
            {
                var asset = Resources.Load<TextAsset>("Content/" + name);
                if (asset != null) db.Raw[name] = MiniJson.ParseObject(asset.text);
            }
            db.ReadDictionaryFields();
            db.Index();
            return db;
        }

        /// <summary>
        /// The content files keep their extensible fields in dictionaries, which
        /// JsonUtility silently drops. They are filled here so a content edit is
        /// never quietly ignored by the Unity build.
        /// </summary>
        void ReadDictionaryFields()
        {
            if (Raw.TryGetValue("guide", out var guideRoot))
            {
                GuideArchitecture = MiniJson.GetObject(guideRoot, "architecture") ?? new Dictionary<string, object>();
                AnswerPolicy = MiniJson.GetObject(GuideArchitecture, "answerPolicy") ?? new Dictionary<string, object>();
                Retrieval = MiniJson.GetObject(GuideArchitecture, "retrieval") ?? new Dictionary<string, object>();
                var syn = MiniJson.GetObject(GuideArchitecture, "synonyms");
                if (syn != null)
                    foreach (var kv in syn)
                        if (kv.Value is List<object> list)
                            synonymTable[kv.Key] = list.ConvertAll(o => o.ToString()).ToArray();
            }
            if (Raw.TryGetValue("character_spec", out var characterRoot) && character != null)
            {
                ProportionValues = MiniJson.GetFloatMap(characterRoot, "proportions");
                FacialFeatures = MiniJson.GetObject(characterRoot, "facialFeatures") ?? new Dictionary<string, object>();
                Clothing = MiniJson.GetObject(characterRoot, "clothing") ?? new Dictionary<string, object>();
                Materials = MiniJson.GetObject(characterRoot, "materials") ?? new Dictionary<string, object>();
            }
        }

        public Dictionary<string, object> GuideArchitecture = new Dictionary<string, object>();
        public Dictionary<string, object> AnswerPolicy = new Dictionary<string, object>();
        public Dictionary<string, object> Retrieval = new Dictionary<string, object>();
        public Dictionary<string, float> ProportionValues = new Dictionary<string, float>();
        public Dictionary<string, object> FacialFeatures = new Dictionary<string, object>();
        public Dictionary<string, object> Clothing = new Dictionary<string, object>();
        public Dictionary<string, object> Materials = new Dictionary<string, object>();

        /// <summary>Character proportions, by spec key ("hipHeight", "shoulderWidth", ...).</summary>
        public float Proportion(string key, float fallback = 0f)
            => ProportionValues.TryGetValue(key, out var value) ? value : fallback;

        static T Read<T>(string name) where T : class
        {
            var asset = Resources.Load<TextAsset>("Content/" + name);
            if (asset == null)
            {
                Debug.LogError($"[content] Content/{name}.json is missing from Assets/Resources. " +
                               "Run Tools/validate_content.py: the archive must ship with the build.");
                return null;
            }
            return JsonUtility.FromJson<T>(asset.text);
        }

        void Index()
        {
            if (archive != null)
                foreach (var r in archive.records) RecordsById[r.id] = r;
            if (questions != null)
                foreach (var q in questions.questions) QuestionsById[q.id] = q;
            if (quests != null)
                foreach (var m in quests.missions) MissionsById[m.id] = m;
            if (achievements != null)
                foreach (var a in achievements.achievements) AchievementsById[a.id] = a;
            if (memorials != null)
                foreach (var s in memorials.sites) MemorialsById[s.id] = s;
            if (zones != null)
                foreach (var z in zones.zones) ZonesById[z.id] = z;
            if (glossary != null)
                foreach (var c in glossary.concepts) ConceptsById[c.id] = c;
            if (exhibits != null)
                foreach (var e in exhibits.exhibits) ExhibitsById[e.id] = e;
            if (timeline != null)
                foreach (var e in timeline.events) EventsById[e.id] = e;

            foreach (var r in RecordsById.Values)
                Add("archive", r.id, r.title, Clean(r.source), new Dictionary<string, string>
                {
                    ["title"] = r.title, ["keywords"] = Join(r.keywords), ["description"] = r.description,
                    ["significance"] = r.significance, ["zone"] = r.zone, ["category"] = r.category
                }, record: r);
            foreach (var c in ConceptsById.Values)
                Add("concept", c.id, c.term, Clean(c.source), new Dictionary<string, string>
                {
                    ["term"] = c.term, ["shortDef"] = c.shortDef, ["longDef"] = c.longDef,
                    ["keywords"] = Join(c.keywords), ["zone"] = c.zone
                }, concept: c);
            foreach (var s in MemorialsById.Values)
            {
                var rec = RecordsById.TryGetValue(s.archiveId, out var r) ? r : null;
                Add("memorial", s.id, s.name, rec != null ? Clean(rec.source) : "Memorials register",
                    new Dictionary<string, string>
                    {
                        ["title"] = s.name, ["description"] = s.narration, ["tags"] = Join(s.tags), ["zone"] = "memorials"
                    }, site: s);
            }
            foreach (var e in EventsById.Values)
            {
                var rec = RecordsById.TryGetValue(e.archiveId, out var r) ? r : null;
                Add("event", e.id, e.title, rec != null ? Clean(rec.source) : "Timeline of events",
                    new Dictionary<string, string> { ["title"] = e.title, ["zone"] = e.zone }, timelineEvent: e);
            }
        }

        static string Clean(string s) => string.IsNullOrEmpty(s) ? "Archive record" : s;
        static string Join(string[] a) => a == null ? string.Empty : string.Join(" ", a);

        void Add(string kind, string id, string title, string citation,
                 Dictionary<string, string> fields, ArchiveRecord record = null, Concept concept = null,
                 MemorialSite site = null, TimelineEvent timelineEvent = null, ZoneDef zone = null)
        {
            var doc = new SearchDoc
            {
                kind = kind, id = id, title = title, citation = citation,
                record = record, concept = concept, site = site, timelineEvent = timelineEvent, zone = zone
            };
            foreach (var field in fields)
            {
                float weight = FieldWeight(field.Key);
                foreach (var token in Tokenize(field.Value))
                    doc.tokens[token] = Mathf.Max(doc.tokens.TryGetValue(token, out var w) ? w : 0f, weight);
            }
            foreach (var token in Tokenize(title)) doc.titleTokens.Add(token);
            _docs.Add(doc);
        }

        float FieldWeight(string field)
        {
            switch (field)
            {
                case "title": return 3.0f;
                case "term": return 3.2f;
                case "keywords": return 2.4f;
                case "shortDef": return 1.8f;
                case "tags": return 1.4f;
                case "longDef": return 1.2f;
                default: return 1.0f;
            }
        }

        public static List<string> Tokenize(string text)
        {
            var result = new List<string>();
            if (string.IsNullOrEmpty(text)) return result;
            var sb = new StringBuilder(text.Length);
            foreach (var ch in text.ToLowerInvariant())
                sb.Append(char.IsLetterOrDigit(ch) ? ch : ' ');
            foreach (var raw in sb.ToString().Split(' '))
            {
                if (raw.Length < 2 || StopWords.Contains(raw)) continue;
                if (raw.EndsWith("ies") && raw.Length > 4) result.Add(raw.Substring(0, raw.Length - 3) + "y");
                else if (raw.EndsWith("s") && raw.Length > 4) result.Add(raw.Substring(0, raw.Length - 1));
                else result.Add(raw);
            }
            return result;
        }

        float Idf(string token)
        {
            if (_documentFrequency.Count == 0)
            {
                foreach (var doc in _docs)
                    foreach (var token in doc.tokens.Keys)
                        _documentFrequency[token] = _documentFrequency.TryGetValue(token, out var n) ? n + 1 : 1;
            }
            if (!_documentFrequency.TryGetValue(token, out var df) || df == 0) return 1f;
            return 1f + Mathf.Log(1f + _docs.Count / (float)df) / 4f;
        }

        float TermScore(SearchDoc doc, string term)
        {
            float score = 0f;
            foreach (var kv in doc.tokens)
            {
                float weight = kv.Value * Idf(kv.Key);
                if (kv.Key == term) score += weight;
                else if (term.Length > 3 && kv.Key.StartsWith(term)) score += weight * 0.5f;
                else if (kv.Key.Length > 3 && term.StartsWith(kv.Key)) score += weight * 0.35f;
            }
            if (score > 0f && doc.titleTokens.Contains(term)) score *= 1.4f;
            else if (score > 0f && term.Length > 3)
                foreach (var token in doc.titleTokens)
                    if (token.StartsWith(term)) { score *= 1.4f; break; }
            return score;
        }

        public List<SearchDoc> Search(string query, int limit = 40, string zoneFilter = null, string kindFilter = null)
        {
            var baseTerms = Tokenize(query);
            var synonymTerms = new List<string>();
            foreach (var term in baseTerms)
                foreach (var kv in synonymTable)
                    if (kv.Key == term || kv.Value.Contains(term))
                    {
                        if (!baseTerms.Contains(kv.Key)) synonymTerms.Add(kv.Key);
                        foreach (var s in kv.Value)
                            if (!baseTerms.Contains(s) && !synonymTerms.Contains(s)) synonymTerms.Add(s);
                    }
            synonymTerms = synonymTerms
                .Where(t => !baseTerms.Any(b => b.Length > 3 && (t.StartsWith(b) || b.StartsWith(t))))
                .Distinct().ToList();

            var results = new List<SearchDoc>();
            foreach (var doc in _docs)
            {
                if (zoneFilter != null && zoneFilter != "all" && doc.zone != null && doc.zone.id != zoneFilter) continue;
                if (kindFilter != null && doc.kind != kindFilter) continue;
                float score = 0f;
                int matched = 0;
                foreach (var term in baseTerms)
                {
                    float s = TermScore(doc, term);
                    if (s > 0f) matched++;
                    score += s;
                }
                if (matched > 1 && baseTerms.Count > 1) score *= 1f + 0.5f * (matched / (float)baseTerms.Count);
                float synonym = synonymTerms.Sum(term => TermScore(doc, term));
                score += 0.22f * synonym;
                if (score <= 0f) continue;
                float tokenCount = doc.tokens.Count;
                score /= 1f + Mathf.Log(1f + tokenCount / 50f) / 4f;
                results.Add(new SearchDoc
                {
                    kind = doc.kind, id = doc.id, title = doc.title, citation = doc.citation, score = score,
                    record = doc.record, concept = doc.concept, site = doc.site, timelineEvent = doc.timelineEvent
                });
            }
            results.Sort((a, b) => b.score.CompareTo(a.score));
            return results.Take(limit).ToList();
        }

        // ------------------------------------------------------------ the Guide
        public List<SearchDoc> Retrieve(string question, int topK = 0)
        {
            int k = topK > 0 ? topK : TopK();
            float min = RetrievalMinScore();
            var hits = Search(question, k * 2)
                .Where(h => h.score >= min && h.kind != "zone")
                .Take(k).ToList();
            return hits;
        }

        /// <summary>
        /// The coverage floor comes from guide.json, not from code: a content
        /// editor can retune how readily the Guide speaks without a rebuild of
        /// the logic.
        /// </summary>
        float RetrievalMinScore() => MiniJson.GetFloat(Retrieval, "minScore", 3.0f);
        float LowConfidenceAt() => MiniJson.GetFloat(Retrieval, "lowConfidenceAt", 7.0f);
        int TopK() => MiniJson.GetInt(Retrieval, "topK", 4);
        int MaxSentences() => MiniJson.GetInt(AnswerPolicy, "maxSentences", 5);

        /// <summary>
        /// Composes an answer from retrieved passages only. It never invents text,
        /// and every answer carries the records it used — the brief's rule that a
        /// player must be able to check any claim the Guide makes.
        /// </summary>
        public GuideAnswer Answer(string question, bool offline = true)
        {
            var hits = Retrieve(question);
            if (hits.Count == 0)
            {
                var topics = zones == null ? "the six galleries" : string.Join(", ",
                    zones.zones.Where(z => z.id != "hub").Select(z => z.name).Take(6));
                return new GuideAnswer
                {
                    text = (guide?.messages?.noResults ?? "The archive does not cover that.").Replace("{topics}", topics),
                    noResults = true, offline = offline
                };
            }

            var sentences = new List<string>();
            var lead = hits[0];
            string body = lead.kind == "concept" ? lead.concept?.shortDef
                : lead.kind == "memorial" ? lead.site?.narration
                : lead.record?.description;
            foreach (var s in Split(body)) { if (sentences.Count < 3) sentences.Add(s); }
            if (lead.kind == "concept" && !string.IsNullOrEmpty(lead.concept?.longDef))
                foreach (var s in Split(lead.concept.longDef)) { if (sentences.Count < 4) sentences.Add(s); }
            if (lead.record != null && !string.IsNullOrEmpty(lead.record.significance))
                foreach (var s in Split(lead.record.significance)) { if (sentences.Count < 4) sentences.Add(s); }

            int max = MaxSentences();
            foreach (var hit in hits.Skip(1))
            {
                if (sentences.Count >= max) break;
                string text = hit.kind == "concept" ? hit.concept?.shortDef
                    : hit.kind == "memorial" ? hit.site?.narration : hit.record?.description;
                var first = Split(text).FirstOrDefault();
                if (!string.IsNullOrEmpty(first) && !sentences.Contains(first)) sentences.Add(first);
            }

            var answer = new GuideAnswer { offline = offline, sources = hits };
            answer.lowConfidence = hits[0].score < LowConfidenceAt();
            string text2 = string.Join(" ", sentences);
            if (answer.lowConfidence && !string.IsNullOrEmpty(guide?.messages?.lowConfidence))
                text2 = guide.messages.lowConfidence + " " + text2;
            if (hits.Any(h => h.record != null && h.record.media != null && h.record.media.Any(m => m.isReconstruction))
                && !string.IsNullOrEmpty(guide?.messages?.reconstructionWarning))
                text2 += " " + guide.messages.reconstructionWarning;
            answer.text = text2.Trim();
            return answer;
        }

        static IEnumerable<string> Split(string text)
        {
            if (string.IsNullOrEmpty(text)) yield break;
            foreach (var part in text.Split(new[] { ". ", "! ", "? " }, StringSplitOptions.RemoveEmptyEntries))
            {
                var s = part.Trim();
                if (s.Length == 0) continue;
                yield return s.EndsWith(".") || s.EndsWith("!") || s.EndsWith("?") ? s : s + ".";
            }
        }

        // ------------------------------------------------------- localization
        public string Locale => _locale;
        public void SetLocale(string code) => _locale = code;

        public string T(string key)
        {
            if (localization?.strings == null) return key;
            if (localization.strings.TryGetValue(_locale, out var table) && table != null
                && table.TryGetValue(key, out var value) && !string.IsNullOrEmpty(value) && !key.StartsWith("_"))
                return value;
            if (localization.strings.TryGetValue(localization.defaultLocale ?? "en", out var fallback)
                && fallback != null && fallback.TryGetValue(key, out var fallbackValue))
                return fallbackValue;
            return key;
        }

        public string T(string key, params object[] args)
        {
            var text = T(key);
            try { return string.Format(CultureInfo.InvariantCulture, text, args); }
            catch (FormatException) { return text; }
        }
    }
}
