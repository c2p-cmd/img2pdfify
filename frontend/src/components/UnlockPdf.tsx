import * as pdfjs from 'pdfjs-dist';
import jsPDF from 'jspdf';
import { PDFDocument } from 'pdf-lib';
import { useRef, useState } from 'react';
import DropZone from './DropZone';

// pdfjs worker setup (matches SplitPdf pattern)
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
	'pdfjs-dist/build/pdf.worker.min.mjs',
	import.meta.url
).href;

type Mode = 'lock' | 'unlock';

type SavePickerWindow = Window & {
	showSaveFilePicker?: (options: {
		suggestedName: string;
		types: Array<{
			description: string;
			accept: Record<string, string[]>;
		}>;
	}) => Promise<{
		createWritable: () => Promise<{
			write: (data: Blob) => Promise<void>;
			close: () => Promise<void>;
		}>;
	}>;
};

async function downloadBlob(blob: Blob, filename: string) {
	const pickerWindow = window as SavePickerWindow;

	if (pickerWindow.showSaveFilePicker) {
		const handle = await pickerWindow.showSaveFilePicker({
			suggestedName: filename,
			types: [
				{
					description: 'PDF Document',
					accept: { 'application/pdf': ['.pdf'] },
				},
			],
		});
		const writable = await handle.createWritable();
		await writable.write(blob);
		await writable.close();
		return;
	}

	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}

function formatSize(size: number) {
	if (size >= 1024 * 1024) {
		return `${(size / 1024 / 1024).toFixed(1)} MB`;
	}
	return `${(size / 1024).toFixed(1)} KB`;
}

// ─── UNLOCK HELPERS ─────────────────────────────────────────────

/** Try to load a PDF with pdf-lib without any password. */
async function tryLoadUnencrypted(buffer: ArrayBuffer): Promise<ArrayBuffer | null> {
	try {
		const pdf = await PDFDocument.load(buffer);
		return await pdf.save();
	} catch {
		return null;
	}
}


/**
 * Use pdfjs-dist to decrypt a password-protected PDF page by page,
 * render each page to a canvas, then rebuild a new unencrypted PDF with pdf-lib.
 */
async function decryptWithPdfjs(
	buffer: ArrayBuffer,
	password: string,
	onPage?: (page: number, total: number) => void,
): Promise<{ bytes: ArrayBuffer; pageCount: number }> {
	const loadingTask = pdfjs.getDocument({
		data: new Uint8Array(buffer),
		password,
		useWorkerFetch: true,
	});

	let doc;
	try {
		doc = await loadingTask.promise;
	} catch (error: unknown) {
		const err = error as { code?: string };
		if (err.code === 'IncorrectPassword') {
			throw new Error('The password you entered is incorrect. Please try again.');
		}
		throw error;
	}

	const newPdf = await PDFDocument.create();
	const totalPages = doc.numPages;

	for (let i = 1; i <= totalPages; i++) {
		const page = await doc.getPage(i);
		const viewport = page.getViewport({ scale: 2.0 });

		const canvas = document.createElement('canvas');
		canvas.height = viewport.height;
		canvas.width = viewport.width;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Could not get canvas context');

		await page.render({ canvas, canvasContext: ctx, viewport }).promise;

		const imgDataUrl = canvas.toDataURL('image/png');
		const imgBytes = await fetch(imgDataUrl).then((r) => r.arrayBuffer());
		const img = await newPdf.embedPng(imgBytes);

		const { width, height } = viewport;
		newPdf.addPage([width, height]);
		const lastPage = newPdf.getPage(newPdf.getPageCount() - 1);
		lastPage.drawImage(img, { x: 0, y: 0, width, height });

		onPage?.(i, totalPages);
		await new Promise((resolve) => setTimeout(resolve, 0));
	}

	return { bytes: await newPdf.save(), pageCount: totalPages };
}

// ─── LOCK HELPER ────────────────────────────────────────────────

/**
 * Load a PDF with pdfjs-dist, render each page to canvas,
 * then create a new password-protected PDF using jsPDF with encryption.
 */
async function encryptWithJsPdf(
	buffer: ArrayBuffer,
	password: string,
	onPage?: (page: number, total: number) => void,
): Promise<{ blob: Blob; pageCount: number }> {
	const loadingTask = pdfjs.getDocument({
		data: new Uint8Array(buffer),
		useWorkerFetch: true,
	});

	const doc = await loadingTask.promise;
	const totalPages = doc.numPages;

	// Collect page info (dimensions + rendered images)
	type PageInfo = { widthPt: number; heightPt: number; dataUrl: string };
	const pages: PageInfo[] = [];

	for (let i = 1; i <= totalPages; i++) {
		const page = await doc.getPage(i);

		// Page dimensions in points (72 pts = 1 inch)
		const unscaledViewport = page.getViewport({ scale: 1.0 });
		const widthPt = unscaledViewport.width;
		const heightPt = unscaledViewport.height;

		// Render at 2x for good quality
		const viewport = page.getViewport({ scale: 2.0 });
		const canvas = document.createElement('canvas');
		canvas.height = viewport.height;
		canvas.width = viewport.width;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Could not get canvas context');

		await page.render({ canvas, canvasContext: ctx, viewport }).promise;

		pages.push({ widthPt, heightPt, dataUrl: canvas.toDataURL('image/jpeg', 0.92) });
		onPage?.(i, totalPages);
		await new Promise((resolve) => setTimeout(resolve, 0));
	}

	// Build encrypted PDF with jsPDF
	const pdf = new jsPDF({
		unit: 'pt',
		format: [pages[0].widthPt, pages[0].heightPt],
		encryption: {
			userPassword: password,
			ownerPassword: password,
			userPermissions: ['print', 'copy', 'annot-forms'],
		},
		putOnlyUsedFonts: true,
		floatPrecision: 'smart',
	});

	for (let i = 1; i < pages.length; i++) {
		pdf.addPage([pages[i].widthPt, pages[i].heightPt]);
	}

	for (let i = 0; i < pages.length; i++) {
		pdf.setPage(i + 1);
		pdf.addImage(
			pages[i].dataUrl,
			'JPEG',
			0,
			0,
			pages[i].widthPt,
			pages[i].heightPt,
		);
	}

	return { blob: pdf.output('blob'), pageCount: totalPages };
}

// ─── COMPONENT ──────────────────────────────────────────────────

export default function LockUnlockPdf() {
	const [mode, setMode] = useState<Mode>('unlock');
	const [pdfFile, setPdfFile] = useState<File | null>(null);
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [isHovering, setIsHovering] = useState(false);
	const [progress, setProgress] = useState<number | null>(null);
	const [message, setMessage] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const pdfInputRef = useRef<HTMLInputElement>(null);

	const handlePdfFiles = (fileList: FileList | File[]) => {
		const files = Array.from(fileList);
		const pdfs = files.filter(
			(file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
		);

		if (pdfs.length === 0) {
			setMessage('No PDF files found in the selection.');
			return;
		}

		setPdfFile(pdfs[0]);
		setPassword('');
		setConfirmPassword('');
		setMessage('');
		setProgress(null);
	};

	const clearAll = () => {
		setPdfFile(null);
		setPassword('');
		setConfirmPassword('');
		setMessage('');
		setProgress(null);
		setShowPassword(false);
	};

	const switchMode = (next: Mode) => {
		setMode(next);
		setPdfFile(null);
		setPassword('');
		setConfirmPassword('');
		setMessage('');
		setProgress(null);
		setShowPassword(false);
	};

	// ── Unlock ──────────────────────────────────────────────
	const unlockPdf = async () => {
		if (!pdfFile) {
			setMessage('Please upload a PDF file to unlock.');
			return;
		}

		setProgress(10);
		setMessage('Analyzing PDF security...');

		try {
			const arrayBuffer = await pdfFile.arrayBuffer();

			// Attempt 1: Try loading without password
			setProgress(25);
			setMessage('Checking encryption...');

			let unlockedBytes = await tryLoadUnencrypted(arrayBuffer);
			if (unlockedBytes) {
				setProgress(60);
				setMessage('Saving unlocked PDF...');
				const blob = new Blob([unlockedBytes], { type: 'application/pdf' });
				await downloadBlob(blob, 'unlocked.pdf');
				setProgress(100);
				setMessage('PDF saved successfully!');
				return;
			}

			// The PDF requires a user password
			if (!password) {
				setMessage(
					'This PDF requires a password. Enter the password and click Unlock PDF again.'
				);
				setProgress(null);
				return;
			}

			// Attempt 3: Use pdfjs-dist to decrypt with the provided password
			setProgress(40);
			setMessage('Decrypting with password...');

			const { bytes: decryptedBytes, pageCount } = await decryptWithPdfjs(
				arrayBuffer,
				password,
				(page, total) => {
					setProgress(Math.round((page / total) * 50) + 40);
					setMessage(`Processing page ${page} of ${total}...`);
				}
			);

			setProgress(90);
			setMessage('Saving unlocked PDF...');

			const blob = new Blob([decryptedBytes], { type: 'application/pdf' });
			await downloadBlob(blob, 'unlocked.pdf');

			setProgress(100);
			setMessage(`PDF unlocked successfully! (${pageCount} page${pageCount > 1 ? 's' : ''})`);
		} catch (error) {
			if (error instanceof Error) {
				setMessage(error.message);
			} else {
				setMessage(
					'Could not unlock the PDF. It may use encryption this tool cannot handle.'
				);
			}
		} finally {
			setTimeout(() => setProgress(null), 1200);
		}
	};

	// ── Lock ────────────────────────────────────────────────
	const lockPdf = async () => {
		if (!pdfFile) {
			setMessage('Please upload a PDF file to lock.');
			return;
		}

		if (!password) {
			setMessage('Please enter a password to protect the PDF.');
			return;
		}

		if (password !== confirmPassword) {
			setMessage('Passwords do not match. Please try again.');
			return;
		}

		setProgress(10);
		setMessage('Reading PDF...');

		try {
			const arrayBuffer = await pdfFile.arrayBuffer();

			setProgress(20);
			setMessage('Rendering pages...');

			const { blob, pageCount } = await encryptWithJsPdf(
				arrayBuffer,
				password,
				(page, total) => {
					setProgress(Math.round((page / total) * 60) + 20);
					setMessage(`Processing page ${page} of ${total}...`);
				}
			);

			setProgress(85);
			setMessage('Encrypting PDF...');

			await downloadBlob(blob, 'locked.pdf');

			setProgress(100);
			setMessage(`PDF locked successfully! (${pageCount} page${pageCount > 1 ? 's' : ''})`);
		} catch (error) {
			if (error instanceof Error) {
				setMessage(error.message);
			} else {
				setMessage('Could not lock the PDF. Please try again.');
			}
		} finally {
			setTimeout(() => setProgress(null), 1200);
		}
	};

	const handleAction = mode === 'lock' ? lockPdf : unlockPdf;

	// Always show the password field. In unlock mode it's optional (if empty, no-password
	// attempts run first and the user is prompted if a password is actually needed).
	const needsPassword = true;

	return (
		<div className="tool-panel">
			{/* Mode Toggle */}
			<div className="lock-unlock-toggle">
				<button
					className={`mode-btn ${mode === 'unlock' ? 'active' : ''}`}
					onClick={() => switchMode('unlock')}
				>
					<span className="mode-icon">🔓</span>
					Unlock
				</button>
				<button
					className={`mode-btn ${mode === 'lock' ? 'active' : ''}`}
					onClick={() => switchMode('lock')}
				>
					<span className="mode-icon">🔒</span>
					Lock
				</button>
			</div>

			<DropZone
				eyebrow={mode === 'lock' ? 'lock pdf' : 'unlock pdf'}
				icon={mode === 'lock' ? '🔒' : '🔓'}
				text={
					mode === 'lock'
						? 'Click or drag & drop a PDF to protect'
						: 'Click or drag & drop a password-protected PDF'
				}
				subtext={
					mode === 'lock'
						? 'Upload a single PDF to add password protection'
						: 'Upload a single PDF to remove password protection'
				}
				inputRef={pdfInputRef}
				accept="application/pdf,.pdf"
				onFilesDropped={handlePdfFiles}
				onFilesSelected={handlePdfFiles}
				isHovering={isHovering}
				onDragStateChange={setIsHovering}
			/>

			{pdfFile && (
				<div className="status-row">
					<span>{pdfFile.name}</span>
					<span>{formatSize(pdfFile.size)}</span>
				</div>
			)}

			{pdfFile && (
				<div className="lock-unlock-controls">
					{needsPassword && (
						<>
							<label className="password-field" htmlFor={`${mode}-password`}>
								<span>{mode === 'unlock' ? 'Password (optional)' : 'Password'}</span>
								<div className="password-input-wrapper">
									<input
										id={`${mode}-password`}
										type={showPassword ? 'text' : 'password'}
										placeholder={
											mode === 'unlock'
												? 'Leave empty if not password-protected'
												: 'Enter PDF password'
										}
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === 'Enter' && progress === null) {
												handleAction();
											}
										}}
										autoFocus
									/>
									<button
										type="button"
										className="toggle-password"
										onClick={() => setShowPassword((v) => !v)}
										aria-label={showPassword ? 'Hide password' : 'Show password'}
									>
										{showPassword ? '👁' : '👁‍🗨'}
									</button>
								</div>
							</label>

							{mode === 'lock' && (
								<label className="password-field" htmlFor={`${mode}-confirm-password`}>
									<span>Confirm password</span>
									<div className="password-input-wrapper">
										<input
											id={`${mode}-confirm-password`}
											type={showPassword ? 'text' : 'password'}
											placeholder="Re-enter password"
											value={confirmPassword}
											onChange={(e) => setConfirmPassword(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === 'Enter' && progress === null) {
													handleAction();
												}
											}}
										/>
									</div>
								</label>
							)}
						</>
					)}

					<div className="controls">
						<button className="secondary-action" onClick={clearAll}>
							Clear
						</button>
						<button
							className="primary-action"
							disabled={progress !== null}
							onClick={handleAction}
						>
							{mode === 'lock' ? 'Lock PDF' : 'Unlock PDF'}
						</button>
					</div>

					{progress !== null && (
						<div className="progress-container" aria-label={`${mode} progress`}>
							<div className="progress-label">{progress}%</div>
							<div className="progress-bar">
								<div className="progress-fill" style={{ width: `${progress}%` }} />
							</div>
						</div>
					)}
				</div>
			)}

			{message && <p className="helper-message">{message}</p>}
		</div>
	);
}
