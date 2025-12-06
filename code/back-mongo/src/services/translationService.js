const { IDIOMAS_SUPORTADOS } = require("../../constants");

const LANGUAGE_MAP = {
  "pt-BR": "pt",
  "en-US": "en",
  "es-ES": "es",
  "fr-FR": "fr",
  "de-DE": "de",
  "it-IT": "it",
  "ja-JP": "ja",
  "ko-KR": "ko",
  "zh-CN": "zh",
  "ru-RU": "ru",
  "ar-SA": "ar",
  "hi-IN": "hi",
};

class TranslationService {
  constructor() {
    this.baseUrl = process.env.LIBRETRANSLATE_URL || "http://localhost:5000";
    this.useTranslation = process.env.USE_TRANSLATION === "true";
    this.timeout = 10000;
  }

  isSupported(lang) {
    return IDIOMAS_SUPORTADOS.includes(lang);
  }

  mapToLibreLanguage(lang) {
    return LANGUAGE_MAP[lang] || lang.split("-")[0];
  }

  async safeTranslate(text, { sourceLang, targetLang }) {
    const safeText = typeof text === "string" ? text : "";

    if (!safeText || !targetLang) {
      return {
        translatedText: safeText,
        detectedSourceLang: sourceLang || null,
        provider: "none",
        translated: false,
      };
    }

    try {
      if (!this.isSupported(targetLang)) {
        console.warn(
          `Translation skipped: target language ${targetLang} not listed in IDIOMAS_SUPORTADOS`
        );
        return {
          translatedText: safeText,
          detectedSourceLang: sourceLang || null,
          provider: "unsupported",
          translated: false,
          error: `target language ${targetLang} not supported by config`,
        };
      }
    } catch (e) {}

    const useTranslation = process.env.USE_TRANSLATION === "true";
    if (!useTranslation) {
      console.log("Translation disabled, using original text");
      return {
        translatedText: safeText,
        detectedSourceLang: sourceLang,
        provider: "disabled",
        translated: false,
      };
    }

    const sameLang =
      sourceLang &&
      targetLang &&
      this.mapToLibreLanguage(sourceLang) ===
        this.mapToLibreLanguage(targetLang);

    if (sameLang) {
      return {
        translatedText: safeText,
        detectedSourceLang: sourceLang,
        provider: "same_language",
        translated: false,
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const baseUrl = process.env.LIBRETRANSLATE_URL || this.baseUrl;
      const response = await fetch(`${baseUrl}/translate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: safeText,
          source: sourceLang ? this.mapToLibreLanguage(sourceLang) : "auto",
          target: this.mapToLibreLanguage(targetLang),
          format: "text",
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.translatedText) {
        throw new Error("No translation received");
      }

      console.log(
        `Translation successful: "${safeText}" → "${data.translatedText}"`
      );

      return {
        translatedText: data.translatedText,
        detectedSourceLang:
          sourceLang || data.detectedLanguage?.language || null,
        provider: "libretranslate",
        translated: true,
      };
    } catch (error) {
      console.error("Translation error, using original text:", error.message);

      return {
        translatedText: safeText,
        detectedSourceLang: sourceLang || null,
        provider: "fallback",
        translated: false,
        error: error.message,
      };
    }
  }

  async translate(text, { sourceLang, targetLang }) {
    return await this.safeTranslate(text, { sourceLang, targetLang });
  }

  async getSupportedLanguages() {
    try {
      const baseUrl = process.env.LIBRETRANSLATE_URL || this.baseUrl;
      const response = await fetch(`${baseUrl}/languages`);
      const data = await response.json();

      return data.map((lang) => ({
        code: lang.code,
        name: lang.name,
      }));
    } catch (error) {
      console.error("Error fetching supported languages:", error);

      return Object.entries(LANGUAGE_MAP).map(([code]) => ({
        code: code,
        name: this.getLanguageName(code),
      }));
    }
  }

  getLanguageName(code) {
    const names = {
      "pt-BR": "Portuguese (Brazil)",
      "en-US": "English (US)",
      "es-ES": "Spanish",
      "fr-FR": "French",
      "de-DE": "German",
      "it-IT": "Italian",
      "ja-JP": "Japanese",
      "ko-KR": "Korean",
      "zh-CN": "Chinese (Simplified)",
      "ru-RU": "Russian",
      "ar-SA": "Arabic",
      "hi-IN": "Hindi",
    };
    return names[code] || code;
  }
}

module.exports = new TranslationService();
