const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const folderDropZone = document.getElementById("folderDropZone");
const folderInput = document.getElementById("folderInput");
const gallery = document.getElementById("gallery");
const generateBtn = document.getElementById("generateBtn");
const progressContainer = document.getElementById("progressContainer");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
let files = [];

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
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "new_images.pdf";
  link.click();
  
  // Hide progress after a short delay
  setTimeout(() => {
    progressContainer.classList.add("hidden");
  }, 1500);
}

// Event bindings
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
