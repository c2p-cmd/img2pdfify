const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const folderDropZone = document.getElementById("folderDropZone");
const folderInput = document.getElementById("folderInput");
const gallery = document.getElementById("gallery");
const generateBtn = document.getElementById("generateBtn");
const progressContainer = document.getElementById("progressContainer");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const tabBtns = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");
const pdfDropZone = document.getElementById("pdfDropZone");
const pdfInput = document.getElementById("pdfInput");
const pdfList = document.getElementById("pdfList");
const mergePdfBtn = document.getElementById("mergePdfBtn");
const clearImagesBtn = document.getElementById("clearBtn");
const clearPdfBtn = document.getElementById("clearPdfBtn");
let pdfFiles = [];
let files = [];

// Add tab switching logic
tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    // Remove active class from all tabs
    tabBtns.forEach((b) => b.classList.remove("active"));
    tabContents.forEach((c) => c.classList.remove("active"));

    // Add active class to current tab
    btn.classList.add("active");
    const tabId = btn.dataset.tab;
    document.getElementById(tabId).classList.add("active");
  });
});

// Add PDF handling functions
function handlePdfFiles(selectedFiles) {
  const pdfType = "application/pdf";
  const pdfsToProcess = Array.from(selectedFiles).filter(
    (file) => file.type === pdfType
  );

  if (pdfsToProcess.length === 0) {
    alert("No PDF files found in the selection.");
    return;
  }

  console.log(`Processing ${pdfsToProcess.length} PDFs...`);
  pdfsToProcess.forEach((file) => {
    if (!pdfFiles.some((f) => f.name === file.name && f.size === file.size)) {
      pdfFiles.push(file);
    }
  });

  refreshPdfList();
}

function refreshPdfList() {
  pdfList.innerHTML = "";
  pdfFiles.forEach((file, index) => {
    const div = document.createElement("div");
    div.className = "pdf-item";
    div.innerHTML = `
		<div class="pdf-icon">📄</div>
		<div class="pdf-name">${file.name}</div>
		<div class="pdf-size">${(file.size / 1024).toFixed(2)} KB</div>
		<button class="pdf-remove" data-index="${index}">&times;</button>
	  `;
    pdfList.appendChild(div);
  });

  // Update merge button state
  mergePdfBtn.disabled = pdfFiles.length < 2;
}

async function mergePDFs() {
  if (pdfFiles.length < 2) {
    alert("Please add at least 2 PDF files to merge.");
    return;
  }

  // Show progress container and reset progress
  progressContainer.classList.remove("hidden");
  progressBar.style.width = "0%";
  progressText.textContent = "0%";

  try {
    // Create a new PDF document
    const mergedPdf = await PDFLib.PDFDocument.create();

    // Process each PDF with progress updates
    for (let i = 0; i < pdfFiles.length; i++) {
      const file = pdfFiles[i];

      // Update progress
      const progress = Math.round((i / pdfFiles.length) * 100);
      progressBar.style.width = `${progress}%`;
      progressText.textContent = `${progress}%`;

      // Allow UI to update
      await new Promise((resolve) => setTimeout(resolve, 0));

      try {
        // Load the PDF file
        const bytes = await file.arrayBuffer();
        const pdf = await PDFLib.PDFDocument.load(bytes);

        // Copy all pages from the current PDF to the merged PDF
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach((page) => mergedPdf.addPage(page));
      } catch (error) {
        console.error(`Error processing PDF ${file.name}:`, error);
        alert(`Error processing ${file.name}: ${error.message}`);
      }
    }

    // Final progress update
    progressBar.style.width = "100%";
    progressText.textContent = "100%";

    // create blob
    const mergedBytes = await mergedPdf.save();
    const blob = new Blob([mergedBytes], { type: "application/pdf" });

    // Save and download the merged PDF
    if ("showSaveFilePicker" in window) {
      const handle = await window.showSaveFilePicker({
        suggestedName: "merged.pdf",
        types: [
          {
            description: "PDF Files",
            accept: {
              "application/pdf": [".pdf"],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
    } else {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "merged.pdf";
      link.click();
    }
  } catch (error) {
    console.error("Error merging PDFs:", error);
    alert(`Error merging PDFs: ${error.message}`);
  }

  // Hide progress after a short delay
  setTimeout(() => {
    progressContainer.classList.add("hidden");
  }, 1500);
}

function handleFiles(selectedFiles) {
  const imageTypes = ["image/jpeg", "image/png", "image/gif"];
  const filesToProcess = Array.from(selectedFiles).filter((file) =>
    imageTypes.includes(file.type)
  );

  if (filesToProcess.length === 0) {
    alert("No supported image files found in the selection.");
    return;
  }

  console.log(`Processing ${filesToProcess.length} images...`);
  filesToProcess.forEach((file) => {
    if (!files.some((f) => f.name === file.name && f.size === file.size)) {
      files.push(file);
    }
  });

  refreshGallery();
}

function refreshGallery() {
  gallery.innerHTML = "";
  files.forEach((file, index) => {
    const url = URL.createObjectURL(file);
    const div = document.createElement("div");
    div.className = "thumb";
    div.classList.add("text-mode");
    div.innerHTML = `
        <input type="checkbox" data-index="${index}" checked>
        <button class="remove-btn" data-index="${index}">&times;</button>
        <span class="file-name">${file.name}</span>
        <span class="file-size">${(file.size / 1024).toFixed(2)} KB</span>
        <img src="${url}" class="thumbnail" />
    `;

    // check uncheck the checkbox when clicking on the div
    div.addEventListener("click", (e) => {
      if (e.target.tagName !== "BUTTON") {
        const checkbox = div.querySelector("input[type='checkbox']");
        checkbox.checked = !checkbox.checked;
        updateGenerateBtn();
      }
    });
    gallery.appendChild(div);
  });
  updateGenerateBtn();
}

function updateGenerateBtn() {
  // remove error div if exists
  const errorDiv = gallery.querySelector(".error");
  if (errorDiv) {
    errorDiv.remove();
  }
  const checked = gallery.querySelectorAll("input:checked").length;
  generateBtn.disabled = files.length === 0 || checked === 0;
}

async function generatePDF() {
  const selected = Array.from(gallery.querySelectorAll("input:checked")).map(
    (checkbox) => files[checkbox.dataset.index]
  );

  // Show progress container and reset progress
  progressContainer.classList.remove("hidden");
  progressBar.style.width = "0%";
  progressText.textContent = "0%";

  const pdfDoc = await PDFLib.PDFDocument.create();
  // Process each image with progress updates
  for (let i = 0; i < selected.length; i++) {
    const file = selected[i];

    // Update progress
    const progress = Math.round((i / selected.length) * 100);
    progressBar.style.width = `${progress}%`;
    progressText.textContent = `${progress}%`;

    // Allow UI to update by yielding execution
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Process the image
    const bytes = await file.arrayBuffer();
    let image;

    try {
      if (file.type === "image/jpeg") {
        image = await pdfDoc.embedJpg(bytes);
      } else if (file.type === "image/png") {
        image = await pdfDoc.embedPng(bytes);
      } else if (file.type === "image/gif") {
        // Note: PDF-Lib doesn't directly support GIF, using first frame as PNG
        image = await pdfDoc.embedPng(bytes);
      }

      const page = pdfDoc.addPage([image.width, image.height]);
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height,
      });
    } catch (error) {
      console.error(`Error processing image ${file.name}:`, error);
      // Handle error gracefully
      const errorDiv = document.createElement("div");
      errorDiv.className = "error";
      errorDiv.textContent = `Error processing ${file.name}: ${error.message}`;
      gallery.appendChild(errorDiv);
    }
  }

  // Final progress update
  progressBar.style.width = "100%";
  progressText.textContent = "100%";

  // Save and download the PDF
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  if ("showSaveFilePicker" in window) {
    const handle = await window.showSaveFilePicker({
      suggestedName: "images.pdf",
      types: [
        {
          description: "PDF Document",
          accept: { "application/pdf": [".pdf"] },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  } else {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "new_images.pdf";
    link.click();
  }

  // Hide progress after a short delay
  setTimeout(() => {
    progressContainer.classList.add("hidden");
  }, 1500);
}

function resetState() {
  files.splice(0, files.length);
  pdfFiles.splice(0, pdfFiles.length);
  refreshGallery();
  refreshPdfList();
}

// Event bindings
clearImagesBtn.addEventListener("click", () => resetState());
clearPdfBtn.addEventListener("click", () => resetState());
dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("hover");
});
dropZone.addEventListener("dragleave", () =>
  dropZone.classList.remove("hover")
);
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("hover");
  handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener("change", () => {
  handleFiles(fileInput.files);
  fileInput.value = "";
});
folderDropZone.addEventListener("click", () => folderInput.click());
folderDropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  folderDropZone.classList.add("hover");
});
folderDropZone.addEventListener("dragleave", () =>
  folderDropZone.classList.remove("hover")
);
folderDropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  folderDropZone.classList.remove("hover");
  // Note: Folder drag and drop is more complex
  // This handles files, but browser security may limit full folder drag/drop
  handleFiles(e.dataTransfer.files);
});
folderInput.addEventListener("change", () => {
  handleFiles(folderInput.files);
  folderInput.value = "";
});
gallery.addEventListener("click", (e) => {
  const idx = parseInt(e.target.dataset.index);
  if (e.target.classList.contains("remove-btn")) {
    // Get the checked state of all items before removing
    const checkedStates = Array.from(
      gallery.querySelectorAll("input[type='checkbox']")
    ).map((checkbox) => checkbox.checked);

    // Remove the checked state of the deleted item
    checkedStates.splice(idx, 1);

    // Remove the file
    files.splice(idx, 1);

    // Refresh gallery
    refreshGallery();

    // Restore checked states
    const checkboxes = gallery.querySelectorAll("input[type='checkbox']");
    checkboxes.forEach((checkbox, i) => {
      if (i < checkedStates.length) {
        checkbox.checked = checkedStates[i];
      }
    });

    // Update button state
    updateGenerateBtn();
  } else if (e.target.type === "checkbox") {
    updateGenerateBtn();
  }
});
generateBtn.addEventListener("click", generatePDF);

// Add PDF drop zone event listeners
pdfDropZone.addEventListener("click", () => pdfInput.click());
pdfDropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  pdfDropZone.classList.add("hover");
});
pdfDropZone.addEventListener("dragleave", () =>
  pdfDropZone.classList.remove("hover")
);
pdfDropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  pdfDropZone.classList.remove("hover");
  handlePdfFiles(e.dataTransfer.files);
});
pdfInput.addEventListener("change", () => {
  handlePdfFiles(pdfInput.files);
  pdfInput.value = "";
});

// Add PDF list click handler for remove buttons
pdfList.addEventListener("click", (e) => {
  if (e.target.classList.contains("pdf-remove")) {
    const idx = parseInt(e.target.dataset.index);
    pdfFiles.splice(idx, 1);
    refreshPdfList();
  }
});

// Add merge button event listener
mergePdfBtn.addEventListener("click", mergePDFs);
