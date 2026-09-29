/* ==========================================================================
   MiniJson.cs — a small, allocation-conscious JSON reader.

   Unity's JsonUtility cannot deserialize dictionaries, and the content files
   use them for the things a content editor should be able to extend freely
   (guide architecture, character proportions, memorial scene parameters,
   exhibit parameters). Everything else goes through JsonUtility; this class
   covers the rest, so no content field is silently dropped.
   ========================================================================== */

using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace Heritage.Core
{
    public static class MiniJson
    {
        public static Dictionary<string, object> ParseObject(string json)
        {
            var value = Parse(json);
            return value as Dictionary<string, object> ?? new Dictionary<string, object>();
        }

        public static object Parse(string json)
        {
            if (string.IsNullOrEmpty(json)) return null;
            int index = 0;
            try { return ParseValue(json, ref index); }
            catch (Exception err)
            {
                UnityEngine.Debug.LogError("[json] could not parse content: " + err.Message);
                return null;
            }
        }

        static object ParseValue(string s, ref int i)
        {
            SkipWhitespace(s, ref i);
            if (i >= s.Length) return null;
            switch (s[i])
            {
                case '{': return ParseObjectBody(s, ref i);
                case '[': return ParseArrayBody(s, ref i);
                case '"': return ParseString(s, ref i);
                case 't': i += 4; return true;
                case 'f': i += 5; return false;
                case 'n': i += 4; return null;
                default: return ParseNumber(s, ref i);
            }
        }

        static Dictionary<string, object> ParseObjectBody(string s, ref int i)
        {
            var result = new Dictionary<string, object>();
            i++; // {
            while (true)
            {
                SkipWhitespace(s, ref i);
                if (i >= s.Length) break;
                if (s[i] == '}') { i++; break; }
                if (s[i] == ',') { i++; continue; }
                string key = s[i] == '"' ? ParseString(s, ref i) : ParseBareKey(s, ref i);
                SkipWhitespace(s, ref i);
                if (i < s.Length && s[i] == ':') i++;
                result[key] = ParseValue(s, ref i);
            }
            return result;
        }

        static List<object> ParseArrayBody(string s, ref int i)
        {
            var result = new List<object>();
            i++; // [
            while (true)
            {
                SkipWhitespace(s, ref i);
                if (i >= s.Length) break;
                if (s[i] == ']') { i++; break; }
                if (s[i] == ',') { i++; continue; }
                result.Add(ParseValue(s, ref i));
            }
            return result;
        }

        static string ParseBareKey(string s, ref int i)
        {
            int start = i;
            while (i < s.Length && s[i] != ':' && s[i] != ',' && s[i] != '}') i++;
            return s.Substring(start, i - start).Trim();
        }

        static string ParseString(string s, ref int i)
        {
            var sb = new StringBuilder();
            i++; // opening quote
            while (i < s.Length)
            {
                char c = s[i++];
                if (c == '"') break;
                if (c != '\\') { sb.Append(c); continue; }
                if (i >= s.Length) break;
                char esc = s[i++];
                switch (esc)
                {
                    case 'n': sb.Append('\n'); break;
                    case 't': sb.Append('\t'); break;
                    case 'r': sb.Append('\r'); break;
                    case 'b': sb.Append('\b'); break;
                    case 'f': sb.Append('\f'); break;
                    case 'u':
                        if (i + 4 <= s.Length)
                        {
                            sb.Append((char)Convert.ToInt32(s.Substring(i, 4), 16));
                            i += 4;
                        }
                        break;
                    default: sb.Append(esc); break;
                }
            }
            return sb.ToString();
        }

        static object ParseNumber(string s, ref int i)
        {
            int start = i;
            while (i < s.Length && (char.IsDigit(s[i]) || s[i] == '-' || s[i] == '+' || s[i] == '.' || s[i] == 'e' || s[i] == 'E')) i++;
            string raw = s.Substring(start, i - start);
            if (float.TryParse(raw, NumberStyles.Float, CultureInfo.InvariantCulture, out var f))
                return f;
            return raw;
        }

        static void SkipWhitespace(string s, ref int i)
        {
            while (i < s.Length && char.IsWhiteSpace(s[i])) i++;
        }

        // ------------------------------------------------------------ helpers
        public static Dictionary<string, object> GetObject(object parent, string key)
        {
            if (parent is Dictionary<string, object> map && map.TryGetValue(key, out var value))
                return value as Dictionary<string, object>;
            return null;
        }

        public static List<object> GetArray(object parent, string key)
        {
            if (parent is Dictionary<string, object> map && map.TryGetValue(key, out var value))
                return value as List<object>;
            return null;
        }

        public static string GetString(object parent, string key, string fallback = null)
        {
            if (parent is Dictionary<string, object> map && map.TryGetValue(key, out var value) && value != null)
                return value as string ?? value.ToString();
            return fallback;
        }

        public static float GetFloat(object parent, string key, float fallback = 0f)
        {
            if (parent is Dictionary<string, object> map && map.TryGetValue(key, out var value))
            {
                if (value is float f) return f;
                if (value is double d) return (float)d;
                if (value is string s && float.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed))
                    return parsed;
            }
            return fallback;
        }

        public static int GetInt(object parent, string key, int fallback = 0)
        {
            float f = GetFloat(parent, key, fallback);
            return (int)f;
        }

        public static bool GetBool(object parent, string key, bool fallback = false)
        {
            if (parent is Dictionary<string, object> map && map.TryGetValue(key, out var value))
            {
                if (value is bool b) return b;
                if (value is string s) return s == "true";
                if (value is float f) return f != 0f;
            }
            return fallback;
        }

        public static Dictionary<string, float> GetFloatMap(object parent, string key)
        {
            var result = new Dictionary<string, float>();
            var map = GetObject(parent, key);
            if (map == null) return result;
            foreach (var kv in map)
                if (kv.Value is float f) result[kv.Key] = f;
                else if (kv.Value is double d) result[kv.Key] = (float)d;
            return result;
        }

        public static Dictionary<string, string> GetStringMap(object parent, string key)
        {
            var result = new Dictionary<string, string>();
            var map = GetObject(parent, key);
            if (map == null) return result;
            foreach (var kv in map) result[kv.Key] = kv.Value?.ToString() ?? string.Empty;
            return result;
        }
    }
}
