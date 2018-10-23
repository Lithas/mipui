let currentStep = -1;
let currentZoom = 1;
let sourceMat = null;
let sourceImage = null;
let lineInfo = null;
let assignments = null;
let gridCanvasCtx = null;
let assignmentCanvasCtx = null;

const steps = [{
  canStepForward: () => true,
  canStepBackward: () => false,
  onStepForwardIntoThis: () => {},
  reset: () => {},
}, {
  canStepForward: () => !!sourceImage,
  canStepBackward: () => true,
  onStepForwardIntoThis: () => {},
  reset: () => {
    document.getElementById('chooser-image-preview').innerHTML = '';
    sourceImage = null;
    sourceMat = null;
  },
}, {
  canStepForward: () => true,
  canStepBackward: () => true,
  onStepForwardIntoThis: () => { gridImage(); },
  reset: () => {
    document.getElementById('griddler-image-preview').innerHTML = '';
    lineInfo = null;
  },
}, {
  canStepForward: () => !!assignments,
  canStepBackward: () => true,
  onStepForwardIntoThis: () => { assignCells(); },
  reset: () => {
    document.getElementById('assigner-map-preview').innerHTML = '';
    assignments = null;
  },
}, {
  canStepForward: () => false,
  canStepBackward: () => true,
  onStepForwardIntoThis: () => {},
  reset: () => {},
}];

function stepForward() {
  const nextButton = document.getElementById('next-button');
  nextButton.disabled = true;
  nextButton.textContent = 'Processing';
  currentStep++;
  setTimeout(() => {
    steps[currentStep].onStepForwardIntoThis();
    nextButton.textContent = 'Next Step';
    updateStepHeaders();
  }, 0);
}

function stepBackward() {
  const prevButton = document.getElementById('prev-button');
  prevButton.disabled = true;
  currentStep--;
  updateStepHeaders();
}

function updateStepHeaders() {
  const step = steps[currentStep];
  const stepHeaders = document.getElementsByClassName('step-header');
  const stepBodies = document.getElementsByClassName('step');
  for (let i = 0; i < stepHeaders.length; i++) {
    const stepHeader = stepHeaders[i];
    stepHeader.classList.remove('active-step-header');
    stepHeader.classList.remove('inactive-step-header');
    stepHeader.classList.remove('completed-step-header');
    if (i < currentStep) {
      stepHeader.classList.add('completed-step-header');
    } else if (i == currentStep) {
      stepHeader.classList.add('active-step-header');
    } else {
      stepHeader.classList.add('inactive-step-header');
      steps[i].reset();
    }
    const step = stepBodies[i];
    if (i == currentStep) {
      step.classList.add('active-step');
      step.classList.remove('inactive-step');
    } else {
      step.classList.remove('active-step');
      step.classList.add('inactive-step');
    }
  }
  document.getElementById('next-button').disabled = !step.canStepForward();
  document.getElementById('prev-button').disabled = !step.canStepBackward();
}

function image2mat(image) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    resolve(cv.imread(canvas));
  });
}

function uploadImage(file) {
  const image = document.createElement('img');
  image.src = window.URL.createObjectURL(file);
  const preview = document.getElementById('chooser-image-preview');
  document.getElementById('griddler-image-preview').innerHTML = '';
  previewElements(preview, image);
  image.onload = () => {
    sourceImage = image;
    updateStepHeaders();
  };
}

function gridImage() {
  const image2matPromise = image2mat(sourceImage);
  image2matPromise.then(mat => {
    sourceMat = mat;
    lineInfo = new Griddler({
      mat: sourceMat,
      appendMatCanvas: () => {},
    }).calculateLineInfo();
    const primarySizeInput =
        document.getElementById('griddler-primary-size-input');
    const dividerSizeInput =
        document.getElementById('griddler-divider-size-input');
    const offsetLeftInput =
        document.getElementById('griddler-offset-left-input');
    const offsetTopInput = document.getElementById('griddler-offset-top-input');
    primarySizeInput.value = +lineInfo.cellSize.toFixed(3);
    dividerSizeInput.value = +lineInfo.dividerSize.toFixed(3);
    offsetLeftInput.value = +lineInfo.offsetLeft.toFixed(3);
    offsetTopInput.value = +lineInfo.offsetTop.toFixed(3);
    previewGridLines();
    [
      primarySizeInput,
      dividerSizeInput,
      offsetLeftInput,
      offsetTopInput,
    ].forEach(element => {
      element.oninput = () => {
        updateLineInfo();
        previewGridLines();
      };
    });
  });
}

function updateLineInfo() {
  const primarySizeInput =
        document.getElementById('griddler-primary-size-input');
  const dividerSizeInput =
      document.getElementById('griddler-divider-size-input');
  const offsetLeftInput =
      document.getElementById('griddler-offset-left-input');
  const offsetTopInput = document.getElementById('griddler-offset-top-input');
  const oldDividerSize = lineInfo.dividerSize;
  const newDividerSize = Number(dividerSizeInput.value);
  if (oldDividerSize != newDividerSize) {
    const mod = Number(primarySizeInput.value) + newDividerSize;
    const offsetBy = (inputElement, half) => {
      inputElement.value = +((mod + Number(inputElement.value) -
          (newDividerSize - oldDividerSize) / (half ? 2 : 1)) % mod).toFixed(3);
    };
    offsetBy(primarySizeInput);
    offsetBy(offsetLeftInput, true);
    offsetBy(offsetTopInput, true);
  }
  lineInfo.cellSize = Number(primarySizeInput.value);
  lineInfo.dividerSize = newDividerSize;
  lineInfo.offsetLeft = Number(offsetLeftInput.value);
  lineInfo.offsetTop = Number(offsetTopInput.value);
}

function createGridCanvas(previewCanvas, scale) {
  const gridCanvas = document.createElement('canvas');
  gridCanvas.id = 'griddler-grid-canvas';
  gridCanvas.className = 'previewed';
  gridCanvas.style.transform = `scale(${currentZoom})`;
  gridCanvas.width = scale * previewCanvas.width;
  gridCanvas.height = scale * previewCanvas.height;
  const primarySizeInput =
      document.getElementById('griddler-primary-size-input');
  const dividerSizeInput =
      document.getElementById('griddler-divider-size-input');
  const offsetLeftInput = document.getElementById('griddler-offset-left-input');
  const offsetTopInput = document.getElementById('griddler-offset-top-input');
  gridCanvas.onmousedown = mouseDownEvent => {
    const mod = Number(primarySizeInput.value) + Number(dividerSizeInput.value);
    const startX = mouseDownEvent.clientX;
    const startY = mouseDownEvent.clientY;
    const initialOffsetLeftInput = Number(offsetLeftInput.value);
    const initialOffsetTopInput = Number(offsetTopInput.value);
    gridCanvas.onmouseup = mouseUpEvent => {
      gridCanvas.onmousemove = null;
      gridCanvas.onmouseup = null;
      mouseUpEvent.stopPropagation();
      return true;
    };
    gridCanvas.onmousemove = mouseMoveEvent => {
      const xDistance =
          round((startX - mouseMoveEvent.clientX) / currentZoom, currentZoom);
      const yDistance =
          round((startY - mouseMoveEvent.clientY) / currentZoom, currentZoom);
      offsetLeftInput.value =
          (mod + ((initialOffsetLeftInput - xDistance) % mod) % mod).toFixed(3);
      offsetTopInput.value =
          (mod + ((initialOffsetTopInput - yDistance) % mod) % mod).toFixed(3);
      updateLineInfo();
      previewGridLines();
      mouseMoveEvent.stopPropagation();
      return true;
    };
    mouseDownEvent.stopPropagation();
    return true;
  };
  return gridCanvas;
}

function round(n, m) {
  return Number(n.toFixed(Math.ceil(Math.log2(m))));
}

function previewGridLines() {
  const previewPanel = document.getElementById('griddler-image-preview');
  let previewCanvas = document.getElementById('griddler-preview-canvas');
  if (!previewCanvas) {
    previewCanvas = document.createElement('canvas');
    previewCanvas.id = 'griddler-preview-canvas';
    previewCanvas.className = 'previewed';
    previewCanvas.style.transform = `scale(${currentZoom})`;
    previewCanvas.width = sourceMat.cols;
    previewCanvas.height = sourceMat.rows;
    previewPanel.innerHTML = '';
    previewPanel.appendChild(previewCanvas);
    cv.imshow(previewCanvas, sourceMat);
  }

  const scale = Math.round(
      100 *
        Math.max(1, 2000 / Math.max(previewCanvas.width, previewCanvas.height)))
        / 100;

  let gridCanvas = document.getElementById('griddler-grid-canvas');
  if (!gridCanvas) {
    gridCanvas = createGridCanvas(previewCanvas, scale);
    previewPanel.appendChild(gridCanvas);
    gridCanvasCtx = gridCanvas.getContext('2d');
    gridCanvasCtx.translate(-0.5, -0.5);
  }
  if (lineInfo.primarySize <= 6) return;
  gridCanvasCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
  gridCanvasCtx.beginPath();
  gridCanvasCtx.strokeStyle = 'red';
  gridCanvasCtx.lineWidth = 1;
  let x = Math.round(lineInfo.offsetLeft);
  while (x < previewCanvas.width) {
    gridCanvasCtx.moveTo(x * scale, 0);
    gridCanvasCtx.lineTo(x * scale, gridCanvas.height);
    gridCanvasCtx.stroke();
    x += lineInfo.dividerSize;
    gridCanvasCtx.moveTo(x * scale, 0);
    gridCanvasCtx.lineTo(x * scale, gridCanvas.height);
    gridCanvasCtx.stroke();
    x += lineInfo.cellSize;
  }
  let y = Math.round(lineInfo.offsetTop);
  while (y < previewCanvas.height) {
    gridCanvasCtx.moveTo(0, y * scale);
    gridCanvasCtx.lineTo(gridCanvas.width, y * scale);
    gridCanvasCtx.stroke();
    y += lineInfo.dividerSize;
    gridCanvasCtx.moveTo(0, y * scale);
    gridCanvasCtx.lineTo(gridCanvas.width, y * scale);
    gridCanvasCtx.stroke();
    y += lineInfo.cellSize;
  }
}

function assignCells() {
  const image = {
    mat: sourceMat,
    appendMatCanvas: () => {},
  };
  const cellInfo = new CellInfo(image, lineInfo);
  cellInfo.initialize();
  assignments = new Clusterer(image, cellInfo).assign();
  previewAssignments();
  console.log(assignments);
}

function previewAssignments() {
  const previewPanel = document.getElementById('assigner-map-preview');
  let previewCanvas = document.getElementById('assigner-preview-canvas');
  if (!previewCanvas) {
    previewCanvas = document.createElement('canvas');
    previewCanvas.id = 'assigner-preview-canvas';
    previewCanvas.className = 'previewed';
    previewCanvas.style.transform = `scale(${currentZoom})`;
    previewCanvas.width = sourceMat.cols;
    previewCanvas.height = sourceMat.rows;
    previewPanel.innerHTML = '';
    previewPanel.appendChild(previewCanvas);
    cv.imshow(previewCanvas, sourceMat);
  }

  let assignmentCanvas = document.getElementById('assigner-assignment-canvas');
  if (!assignmentCanvas) {
    assignmentCanvas = createAssignmentCanvas(previewCanvas);
    previewPanel.appendChild(assignmentCanvas);
    assignmentCanvasCtx = assignmentCanvas.getContext('2d');
    assignmentCanvasCtx.translate(-0.5, -0.5);
  }
  assignmentCanvasCtx
      .clearRect(0, 0, assignmentCanvas.width, assignmentCanvas.height);
  const tree = document.getElementById('assigner-tree');
  tree.innerHTML = '';
  assignments.forEach(assignment => {
    addAssignment(assignment, tree, assignmentCanvasCtx);
  });
}

function addAssignment(assignment, tree, ctx) {
  const item = document.createElement('li');
  const prefix = document.createElement('span');
  prefix.textContent = assignment.cluster.size;
  prefix.className = 'item-affix-label';
  item.appendChild(prefix);
  const combo = document.createElement('select');
  item.appendChild(combo);
  const wallOption = document.createElement('option');
  wallOption.value = 'wall';
  wallOption.textContent = 'Wall';
  combo.appendChild(wallOption);
  const floorOption = document.createElement('option');
  floorOption.value = 'floor';
  floorOption.textContent = 'Floor';
  combo.appendChild(floorOption);
  const doorOption = document.createElement('option');
  doorOption.value = 'door';
  doorOption.textContent = 'Door';
  combo.appendChild(doorOption);
  combo.setAttribute('list', 'assignment-options');
  combo.value = assignment.final || 'floor';
  const suffix = document.createElement('span');
  suffix.textContent = 'cells';
  suffix.className = 'item-affix-label';
  item.appendChild(suffix);
  tree.appendChild(item);
  let color;
  let hovering = false;
  combo.onchange = () => {
    assignment.final = combo.value;
    hovering = false;
    previewAssignments();
  };
  switch (assignment.final) {
    case 'door': color = 'white'; break;
    case 'wall': color = 'rgb(222, 184, 135)'; break;
    case 'floor': color = 'rgb(245, 245, 220)'; break;
    default: color = 'black'; break;
  }
  drawAssignment(assignment, ctx, color);
  const startTime = performance.now();
  const drawAnimationFrame = timestamp => {
    const colorIntensity = (Math.sin((timestamp - startTime) / 100) + 1) * 50;
    const frameColor = [
      105 + colorIntensity,
      100 - colorIntensity / 2,
      100 - colorIntensity / 2,
    ];
    drawAssignment(assignment, ctx,
        `rgb(${frameColor[0]}, ${frameColor[1]}, ${frameColor[2]})`);
    if (hovering) {
      requestAnimationFrame(drawAnimationFrame);
    } else {
      drawAssignment(assignment, ctx, color);
    }
  };
  item.onmouseover = () => {
    hovering = true;
    requestAnimationFrame(drawAnimationFrame);
  };
  item.onmouseout = () => {
    hovering = false;
  };
}

function drawAssignment(assignment, ctx, color) {
  for (const cell of assignment.cluster.cells) {
    ctx.fillStyle = color;
    ctx.lineWidth = 0;
    ctx.fillRect(cell.x - 0, cell.y - 0, cell.width + 1, cell.height + 1);
  }
}

function createAssignmentCanvas(previewCanvas) {
  const assignmentCanvas = document.createElement('canvas');
  assignmentCanvas.id = 'assigner-assignment-canvas';

  assignmentCanvas.style.opacity =
      document.getElementById('assigner-overlay-opacity').value;
  assignmentCanvas.className = 'previewed';
  assignmentCanvas.style.transform = `scale(${currentZoom})`;
  assignmentCanvas.width = previewCanvas.width;
  assignmentCanvas.height = previewCanvas.height;
  assignmentCanvas.onclick = e => {
    alert('assignment canvas clicked');
    e.stopPropagation();
    return true;
  };
  return assignmentCanvas;
}

function previewElements(previewPanel, ...elements) {
  previewPanel.innerHTML = '';
  for (const element of elements) {
    element.classList.add('previewed');
    element.style.transform = `scale(${currentZoom})`;
    previewPanel.appendChild(element);
  }
}

function wireInputs() {
  document.getElementById('next-button').onclick = () => { stepForward(); };
  document.getElementById('prev-button').onclick = () => { stepBackward(); };
  document.getElementById('chooser-upload-button').onchange = () => {
    uploadImage(document.getElementById('chooser-upload-button').files[0]);
  };
  document.getElementById('assigner-overlay-opacity').oninput = () => {
    const overlay = document.getElementById('assigner-assignment-canvas');
    if (overlay) {
      overlay.style.opacity =
          document.getElementById('assigner-overlay-opacity').value;
    }
  };
}

function createZoomControls() {
  const instrumentPanels = document.getElementsByClassName('instrument-panel');
  const sliders = [];
  for (let i = 0; i < instrumentPanels.length; i++) {
    const instrumentPanel = instrumentPanels[i];
    const container = document.createElement('div');
    container.classList.add('zoom-slider-container');
    instrumentPanel.appendChild(container);
    const label = document.createElement('div');
    label.classList.add('zoom-slider-label');
    label.textContent = 'Zoom';
    container.appendChild(label);
    const markContainer = document.createElement('div');
    markContainer.classList.add('zoom-slider-marks');
    container.appendChild(markContainer);
    ['100%', '1000%'].forEach(markTitle => {
      const mark = document.createElement('div');
      mark.classList.add('zoom-slider-mark');
      mark.textContent = markTitle;
      markContainer.appendChild(mark);
    });
    const slider = document.createElement('input');
    sliders.push(slider);
    slider.classList.add('zoom-slider-input');
    slider.type = 'range';
    slider.value = 100;
    slider.min = 100;
    slider.max = 1000;
    container.appendChild(slider);
    slider.oninput = () => {
      // Sychronize all zoom sliders.
      for (const otherSlider of sliders) {
        if (slider == otherSlider) continue;
        otherSlider.value = slider.value;
      }
      // Zoom.
      zoom(slider.value);
    };
  }
}

function zoom(value) {
  currentZoom = Number(value) / 100;
  const previews = document.getElementsByClassName('previewed');
  for (let i = 0; i < previews.length; i++) {
    previews[i].style.transform = `scale(${currentZoom})`;
  }
}

window.onload = () => {
  wireInputs();
  createZoomControls();
  stepForward();
};
