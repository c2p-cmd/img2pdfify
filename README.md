# Image/PDF Tools
A simple, browser-based tool for working with images and PDFs. No server uploads required - everything runs in your browser.

## Features
- Convert Images to PDF
    - Drag and drop or select individual image files
    - Select entire folders of images
    - Choose which images to include in the final PDF
    - Generate a PDF with your selected images
- Merge PDF Files
    - Combine multiple PDF files into a single document
    - Arrange PDFs in your preferred order
    - Save the merged PDF to your device

## How to Use
### Images to PDF
1. Select the "Images to PDF" tab
2. Add images by either:
    - Dropping image files onto the left dropzone
    - Clicking the left dropzone to select individual files
    - Dropping a folder onto the right dropzone
    - Clicking the right dropzone to select a folder
3. Select or deselect images by clicking on them
4. Click "Generate PDF" to create your PDF
5. Save the PDF to your device

### Merge PDFs
1. Select the "Merge PDFs" tab
2. Add PDF files by either:
    - Dropping PDF files onto the dropzone
    - Clicking the dropzone to select PDF files
3. Rearrange PDFs if needed
4. Click "Merge PDFs" to combine your documents
5. Save the merged PDF to your device

## Technologies Used
- HTML5, CSS3, and JavaScript
- PDF-Lib.js for PDF generation and manipulation
- File System Access API for modern file handling (falls back to downloads)

## Browser Compatibility
Works in all modern browsers. Some features like folder selection may have limited compatibility.