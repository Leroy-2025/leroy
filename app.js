const fileInput = document.querySelector("#fileInput");
const dropZone = document.querySelector("#dropZone");
const stage = document.querySelector("#stage");
const emptyState = document.querySelector("#emptyState");
const originalCanvas = document.querySelector("#originalCanvas");
const outputCanvas = document.querySelector("#outputCanvas");
const maskCanvas = document.querySelector("#maskCanvas");
const brushPreview = document.querySelector("#brushPreview");
const statusText = document.querySelector("#status");
const compareSlider = document.querySelector("#compareSlider");
const autoBtn = document.querySelector("#autoBtn");
const softBtn = document.querySelector("#softBtn");
const resetBtn = document.querySelector("#resetBtn");
const downloadBtn = document.querySelector("#downloadBtn");
const repairModeBtn = document.querySelector("#repairModeBtn");
const applyRepairBtn = document.querySelector("#applyRepairBtn");
const clearMaskBtn = document.querySelector("#clearMaskBtn");
const brushSize = document.querySelector("#brushSize");

const sliders = {
  sharpness: document.querySelector("#sharpness"),
  denoise: document.querySelector("#denoise"),
  contrast: document.querySelector("#contrast"),
  brightness: document.querySelector("#brightness"),
  saturation: document.querySelector("#saturation"),
};

const ctxOriginal = originalCanvas.getContext("2d", { willReadFrequently: true });
const ctxOutput = outputCanvas.getContext("2d", { willReadFrequently: true });
const ctxMask = maskCanvas.getContext("2d", { willReadFrequently: true });

let originalImageData = null;
let workingImageData = null;
let imageName = "image";
let isDrawing = false;
let isRepairMode = false;

function setEnabled(enabled) {
  [
    autoBtn,
    softBtn,
    resetBtn,
    downloadBtn,
    repairModeBtn,
    applyRepairBtn,
    clearMaskBtn,
    compareSlider,
    ...Object.values(sliders),
  ].forEach((control) => {
    control.disabled = !enabled;
  });
}

setEnabled(false);

function fitCanvasDisplay() {
  const maxWidth = stage.clientWidth - 40;
  const maxHeight = stage.clientHeight - 40;
  const scale = Math.min(maxWidth / outputCanvas.width, maxHeight / outputCanvas.height, 1);
  const width = Math.max(1, Math.round(outputCanvas.width * scale));
  const height = Math.max(1, Math.round(outputCanvas.height * scale));

  [originalCanvas, outputCanvas, maskCanvas].forEach((canvas) => {
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.style.display = "block";
  });
}

function loadFile(file) {
  if (!file || !file.type.startsWith("image/")) return;

  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      const maxSide = 2600;
      const scale = Math.min(maxSide / image.width, maxSide / image.height, 1);
      const width = Math.round(image.width * scale);
      const height = Math.round(image.height * scale);

      [originalCanvas, outputCanvas, maskCanvas].forEach((canvas) => {
        canvas.width = width;
        canvas.height = height;
      });

      ctxOriginal.clearRect(0, 0, width, height);
      ctxOriginal.drawImage(image, 0, 0, width, height);
      originalImageData = ctxOriginal.getImageData(0, 0, width, height);
      workingImageData = new ImageData(new Uint8ClampedArray(originalImageData.data), width, height);
      ctxOutput.putImageData(workingImageData, 0, 0);
      clearMask();

      imageName = file.name.replace(/\.[^.]+$/, "") || "image";
      emptyState.style.display = "none";
      statusText.textContent = `${width} x ${height}`;
      setEnabled(true);
      fitCanvasDisplay();
      renderCompare();
    };
    image.src = String(reader.result);
  };
  reader.readAsDataURL(file);
}

function clamp(value) {
  return Math.max(0, Math.min(255, value));
}

function applyTone(data, brightness, contrast, saturation) {
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const satFactor = 1 + saturation / 100;

  for (let i = 0; i < data.length; i += 4) {
    let r = contrastFactor * (data[i] - 128) + 128 + brightness;
    let g = contrastFactor * (data[i + 1] - 128) + 128 + brightness;
    let b = contrastFactor * (data[i + 2] - 128) + 128 + brightness;
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;

    data[i] = clamp(gray + (r - gray) * satFactor);
    data[i + 1] = clamp(gray + (g - gray) * satFactor);
    data[i + 2] = clamp(gray + (b - gray) * satFactor);
  }
}

function boxBlur(source, width, height, radius) {
  if (radius <= 0) return new Uint8ClampedArray(source);
  const output = new Uint8ClampedArray(source.length);
  const side = radius * 2 + 1;
  const area = side * side;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let ky = -radius; ky <= radius; ky += 1) {
        const py = Math.max(0, Math.min(height - 1, y + ky));
        for (let kx = -radius; kx <= radius; kx += 1) {
          const px = Math.max(0, Math.min(width - 1, x + kx));
          const idx = (py * width + px) * 4;
          r += source[idx];
          g += source[idx + 1];
          b += source[idx + 2];
          a += source[idx + 3];
        }
      }

      const idx = (y * width + x) * 4;
      output[idx] = r / area;
      output[idx + 1] = g / area;
      output[idx + 2] = b / area;
      output[idx + 3] = a / area;
    }
  }

  return output;
}

function enhanceFromSliders() {
  if (!originalImageData) return;

  statusText.textContent = "处理中...";
  requestAnimationFrame(() => {
    const { width, height } = originalImageData;
    const data = new Uint8ClampedArray(originalImageData.data);
    const denoiseAmount = Number(sliders.denoise.value);
    const sharpnessAmount = Number(sliders.sharpness.value) / 100;
    const blurRadius = denoiseAmount > 58 ? 2 : denoiseAmount > 0 ? 1 : 0;
    const blurred = boxBlur(data, width, height, blurRadius);

    for (let i = 0; i < data.length; i += 4) {
      const mix = denoiseAmount / 180;
      data[i] = data[i] * (1 - mix) + blurred[i] * mix;
      data[i + 1] = data[i + 1] * (1 - mix) + blurred[i + 1] * mix;
      data[i + 2] = data[i + 2] * (1 - mix) + blurred[i + 2] * mix;
    }

    const detail = boxBlur(data, width, height, 1);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = clamp(data[i] + (data[i] - detail[i]) * sharpnessAmount * 1.8);
      data[i + 1] = clamp(data[i + 1] + (data[i + 1] - detail[i + 1]) * sharpnessAmount * 1.8);
      data[i + 2] = clamp(data[i + 2] + (data[i + 2] - detail[i + 2]) * sharpnessAmount * 1.8);
    }

    applyTone(
      data,
      Number(sliders.brightness.value),
      Number(sliders.contrast.value),
      Number(sliders.saturation.value),
    );

    workingImageData = new ImageData(data, width, height);
    ctxOutput.putImageData(workingImageData, 0, 0);
    statusText.textContent = `${width} x ${height}`;
    renderCompare();
  });
}

function renderCompare() {
  const value = Number(compareSlider.value);
  outputCanvas.style.clipPath = `inset(0 ${100 - value}% 0 0)`;
}

function setPreset(values) {
  Object.entries(values).forEach(([key, value]) => {
    sliders[key].value = value;
  });
  enhanceFromSliders();
}

function clearMask() {
  ctxMask.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
}

function canvasPoint(event) {
  const rect = maskCanvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * maskCanvas.width,
    y: ((event.clientY - rect.top) / rect.height) * maskCanvas.height,
    screenX: event.clientX - stage.getBoundingClientRect().left,
    screenY: event.clientY - stage.getBoundingClientRect().top,
  };
}

function drawMask(event) {
  if (!isDrawing) return;
  const point = canvasPoint(event);
  const radius = Number(brushSize.value);
  ctxMask.globalCompositeOperation = "source-over";
  ctxMask.fillStyle = "rgba(180, 84, 59, 0.42)";
  ctxMask.beginPath();
  ctxMask.arc(point.x, point.y, radius / 2, 0, Math.PI * 2);
  ctxMask.fill();
}

function updateBrushPreview(event) {
  if (!isRepairMode) return;
  const point = canvasPoint(event);
  brushPreview.style.display = "block";
  brushPreview.style.width = `${brushSize.value}px`;
  brushPreview.style.height = `${brushSize.value}px`;
  brushPreview.style.left = `${point.screenX}px`;
  brushPreview.style.top = `${point.screenY}px`;
}

function applyRepair() {
  if (!workingImageData) return;

  const { width, height } = workingImageData;
  const mask = ctxMask.getImageData(0, 0, width, height).data;
  const data = new Uint8ClampedArray(workingImageData.data);
  const source = new Uint8ClampedArray(data);
  let changed = false;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      if (mask[idx + 3] < 10) continue;

      changed = true;
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;
      const radius = 18;

      for (let ky = -radius; ky <= radius; ky += 3) {
        const py = Math.max(0, Math.min(height - 1, y + ky));
        for (let kx = -radius; kx <= radius; kx += 3) {
          const px = Math.max(0, Math.min(width - 1, x + kx));
          const nIdx = (py * width + px) * 4;
          if (mask[nIdx + 3] > 10) continue;
          r += source[nIdx];
          g += source[nIdx + 1];
          b += source[nIdx + 2];
          count += 1;
        }
      }

      if (count > 0) {
        data[idx] = r / count;
        data[idx + 1] = g / count;
        data[idx + 2] = b / count;
      }
    }
  }

  if (changed) {
    const softened = boxBlur(data, width, height, 1);
    for (let i = 0; i < data.length; i += 4) {
      if (mask[i + 3] > 10) {
        data[i] = softened[i];
        data[i + 1] = softened[i + 1];
        data[i + 2] = softened[i + 2];
      }
    }

    workingImageData = new ImageData(data, width, height);
    ctxOutput.putImageData(workingImageData, 0, 0);
    clearMask();
  }
}

function downloadImage() {
  if (!workingImageData) return;
  const link = document.createElement("a");
  link.download = `${imageName}-enhanced.png`;
  link.href = outputCanvas.toDataURL("image/png");
  link.click();
}

fileInput.addEventListener("change", (event) => loadFile(event.target.files[0]));

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("dragging");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragging");
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("dragging");
  loadFile(event.dataTransfer.files[0]);
});

stage.addEventListener("dragover", (event) => event.preventDefault());
stage.addEventListener("drop", (event) => {
  event.preventDefault();
  loadFile(event.dataTransfer.files[0]);
});

Object.values(sliders).forEach((slider) => {
  slider.addEventListener("input", enhanceFromSliders);
});

compareSlider.addEventListener("input", renderCompare);
autoBtn.addEventListener("click", () =>
  setPreset({ sharpness: 58, denoise: 18, contrast: 18, brightness: 3, saturation: 10 }),
);
softBtn.addEventListener("click", () =>
  setPreset({ sharpness: 32, denoise: 46, contrast: 8, brightness: 4, saturation: 4 }),
);
resetBtn.addEventListener("click", () => {
  if (!originalImageData) return;
  workingImageData = new ImageData(
    new Uint8ClampedArray(originalImageData.data),
    originalImageData.width,
    originalImageData.height,
  );
  ctxOutput.putImageData(workingImageData, 0, 0);
  clearMask();
  renderCompare();
});
downloadBtn.addEventListener("click", downloadImage);
repairModeBtn.addEventListener("click", () => {
  isRepairMode = !isRepairMode;
  stage.classList.toggle("repairing", isRepairMode);
  repairModeBtn.setAttribute("aria-pressed", String(isRepairMode));
  repairModeBtn.classList.toggle("primary", isRepairMode);
  brushPreview.style.display = "none";
});
applyRepairBtn.addEventListener("click", applyRepair);
clearMaskBtn.addEventListener("click", clearMask);

maskCanvas.addEventListener("pointerdown", (event) => {
  if (!isRepairMode) return;
  isDrawing = true;
  maskCanvas.setPointerCapture(event.pointerId);
  drawMask(event);
});
maskCanvas.addEventListener("pointermove", (event) => {
  updateBrushPreview(event);
  drawMask(event);
});
maskCanvas.addEventListener("pointerup", () => {
  isDrawing = false;
});
maskCanvas.addEventListener("pointerleave", () => {
  isDrawing = false;
  brushPreview.style.display = "none";
});

window.addEventListener("resize", () => {
  if (workingImageData) fitCanvasDisplay();
});
