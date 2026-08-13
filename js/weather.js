(function (global) {
  "use strict";

  const WEATHER_CODE_TEXT = {
    0: "晴",
    1: "少云",
    2: "多云",
    3: "阴",
    45: "雾",
    48: "雾凇",
    51: "毛毛雨",
    53: "毛毛雨",
    55: "毛毛雨",
    56: "冻毛毛雨",
    57: "冻毛毛雨",
    61: "小雨",
    63: "中雨",
    65: "大雨",
    66: "冻雨",
    67: "冻雨",
    71: "小雪",
    73: "中雪",
    75: "大雪",
    77: "雪粒",
    80: "阵雨",
    81: "阵雨",
    82: "强阵雨",
    85: "阵雪",
    86: "强阵雪",
    95: "雷暴",
    96: "雷暴冰雹",
    99: "雷暴冰雹",
  };

  function describeWeatherCode(code) {
    return WEATHER_CODE_TEXT[Number(code)] || "未知";
  }

  function roundNumber(value) {
    if (value === undefined || value === null || value === "") return "";
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    return String(Math.round(number));
  }

  function normalizeWeatherPayload(payload, provider) {
    if (!payload || typeof payload !== "object") {
      throw new Error("天气数据为空");
    }

    if (provider === "qweather") {
      const now = payload.now || {};
      return {
        temperature: roundNumber(now.temp),
        apparent: roundNumber(now.feelsLike),
        humidity: String(now.humidity || ""),
        wind: String(now.windSpeed || ""),
        description: now.text || "未知",
      };
    }

    if (provider === "amap") {
      const live = Array.isArray(payload.lives) ? payload.lives[0] || {} : {};
      return {
        temperature: roundNumber(live.temperature),
        apparent: "",
        humidity: String(live.humidity || ""),
        wind: String(live.windpower || ""),
        description: live.weather || "未知",
      };
    }

    const current = payload.current || payload.current_weather || {};
    return {
      temperature: roundNumber(current.temperature_2m ?? current.temperature),
      apparent: roundNumber(current.apparent_temperature),
      humidity: String(current.relative_humidity_2m || ""),
      wind: String(current.wind_speed_10m ?? current.windspeed ?? ""),
      description: describeWeatherCode(current.weather_code ?? current.weathercode),
    };
  }

  function isRainyWeather(description) {
    return /雨|雷暴|阵雨|毛毛雨|冻雨/.test(String(description || ""));
  }

  function createRain3D(root) {
    if (!global.THREE) return null;

    const canvas = root.querySelector("[data-weather-rain3d]");
    const host = root.querySelector(".weather-card-hero");
    if (!canvas || !host) return null;

    const THREE = global.THREE;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 100);
    camera.position.z = 24;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      canvas,
      powerPreference: "low-power",
    });
    renderer.setClearColor(0x000000, 0);

    const dropCount = 72;
    const positions = new Float32Array(dropCount * 2 * 3);
    const speeds = new Float32Array(dropCount);
    const depths = new Float32Array(dropCount);

    function resetDrop(index, randomY) {
      const base = index * 6;
      const z = -Math.random() * 34;
      const depthScale = 1 + Math.abs(z) / 34;
      const x = (Math.random() - 0.5) * 32 * depthScale;
      const y = randomY ? (Math.random() - 0.2) * 28 : 16 + Math.random() * 12;
      const length = 2.6 + Math.random() * 3.8;
      const lean = 0.8 + Math.random() * 1.2;

      positions[base] = x;
      positions[base + 1] = y;
      positions[base + 2] = z;
      positions[base + 3] = x - lean;
      positions[base + 4] = y - length;
      positions[base + 5] = z;
      speeds[index] = 0.22 + Math.random() * 0.28;
      depths[index] = z;
    }

    for (let i = 0; i < dropCount; i += 1) resetDrop(i, true);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color: 0xdff7ff,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const rain = new THREE.LineSegments(geometry, material);
    scene.add(rain);

    let animationFrame = 0;
    let running = false;

    function resize() {
      const rect = host.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      const pixelRatio = Math.min(global.devicePixelRatio || 1, 1.75);
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    function tick() {
      if (!running) return;
      resize();

      for (let i = 0; i < dropCount; i += 1) {
        const base = i * 6;
        const fall = speeds[i] * (1 + Math.abs(depths[i]) / 48);
        positions[base] -= fall * 0.24;
        positions[base + 1] -= fall;
        positions[base + 3] -= fall * 0.24;
        positions[base + 4] -= fall;

        if (positions[base + 1] < -16) resetDrop(i, false);
      }

      geometry.attributes.position.needsUpdate = true;
      rain.rotation.z = Math.sin(Date.now() / 1800) * 0.015;
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(tick);
    }

    return {
      start() {
        if (running) return;
        running = true;
        root.classList.add("has-rain3d");
        tick();
      },
      stop() {
        running = false;
        root.classList.remove("has-rain3d");
        if (animationFrame) cancelAnimationFrame(animationFrame);
      },
    };
  }

  function syncRain3D(root, rainy) {
    if (!root._weatherRain3D) root._weatherRain3D = createRain3D(root);
    if (!root._weatherRain3D) return;
    if (rainy) root._weatherRain3D.start();
    else root._weatherRain3D.stop();
  }

  function replacePlaceholders(value, config) {
    return String(value || "")
      .replaceAll("{latitude}", encodeURIComponent(config.latitude || ""))
      .replaceAll("{longitude}", encodeURIComponent(config.longitude || ""))
      .replaceAll("{city}", encodeURIComponent(config.city || ""))
      .replaceAll("{adcode}", encodeURIComponent(config.adcode || ""))
      .replaceAll("{key}", encodeURIComponent(config.apiKey || ""));
  }

  function buildWeatherUrl(config) {
    const provider = config.provider || "open_meteo";
    const apiUrl = replacePlaceholders(config.apiUrl, config);

    if (provider === "open_meteo") {
      if (!config.latitude || !config.longitude) {
        throw new Error("请先配置天气坐标");
      }
      const url = new URL(apiUrl || "https://api.open-meteo.com/v1/forecast");
      url.searchParams.set("latitude", config.latitude);
      url.searchParams.set("longitude", config.longitude);
      url.searchParams.set(
        "current",
        "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m"
      );
      url.searchParams.set("timezone", "auto");
      return url.toString();
    }

    if (!apiUrl) throw new Error("请先配置天气 API 地址");
    return apiUrl;
  }

  function setText(root, selector, value, fallback) {
    const element = root.querySelector(selector);
    if (element) element.textContent = value || fallback;
  }

  function renderWeather(root, data) {
    setText(root, "[data-weather-temp]", data.temperature, "--");
    setText(root, "[data-weather-desc]", data.description, "未知");
    setText(root, "[data-weather-apparent]", data.apparent ? `${data.apparent}°C` : "--", "--");
    setText(root, "[data-weather-humidity]", data.humidity ? `${data.humidity}%` : "--", "--");
    setText(root, "[data-weather-wind]", data.wind ? `${data.wind} km/h` : "--", "--");
    const rainy = isRainyWeather(data.description);
    root.classList.toggle("is-rainy", rainy);
    syncRain3D(root, rainy);
  }

  function renderError(root, message) {
    setText(root, "[data-weather-desc]", message || "天气暂不可用", "天气暂不可用");
  }

  function readCache(cacheKey, cacheMinutes) {
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
      if (!cached || Date.now() - cached.time > cacheMinutes * 60 * 1000) return null;
      return cached.data;
    } catch (_error) {
      return null;
    }
  }

  function writeCache(cacheKey, data) {
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ time: Date.now(), data }));
    } catch (_error) {
      // Ignore storage quota and private-mode failures.
    }
  }

  async function fetchWeather(config) {
    const timeout = Number(config.timeout || 8000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(buildWeatherUrl(config), {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`天气接口异常：${response.status}`);
      return normalizeWeatherPayload(await response.json(), config.provider || "open_meteo");
    } finally {
      clearTimeout(timer);
    }
  }

  async function initWeather() {
    const config = global.weatherConfig || {};
    const root = document.querySelector("[data-weather-card]");
    if (!root || config.enable === false) return;

    setText(root, "[data-weather-city]", config.city, "未配置城市");

    const cacheKey = `anzhiyu-weather:${config.provider || "open_meteo"}:${config.city || ""}`;
    const cacheMinutes = Number(config.cacheMinutes || 20);
    const cached = readCache(cacheKey, cacheMinutes);
    if (cached) renderWeather(root, cached);

    try {
      const data = await fetchWeather(config);
      renderWeather(root, data);
      writeCache(cacheKey, data);
    } catch (error) {
      if (!cached) renderError(root, error.message);
    }
  }

  const api = {
    buildWeatherUrl,
    describeWeatherCode,
    initWeather,
    isRainyWeather,
    normalizeWeatherPayload,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    global.anzhiyuWeather = api;
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initWeather);
    } else {
      initWeather();
    }
    document.addEventListener("pjax:complete", initWeather);
  }
})(typeof window !== "undefined" ? window : globalThis);
