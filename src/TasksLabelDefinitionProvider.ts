import * as vscode from 'vscode';
import * as fs from 'fs';
import * as Path from 'path';
import * as JSONC from 'jsonc-parser';

interface Task {
	label: string;
	line: number;
	location?: vscode.Location;
	references?: vscode.Location[];
}

export class TasksLabelDefinitionProvider implements
	vscode.DefinitionProvider,
	vscode.CodeLensProvider,
	vscode.ReferenceProvider
{
	regDisposables: vscode.Disposable[] = [];
	diagnostics: vscode.DiagnosticCollection;
	references: Task[] = [];

	constructor () {
		this.diagnostics =
			vscode.languages.createDiagnosticCollection("tasksLabel");

		this.regDisposables.push(vscode.languages.registerDefinitionProvider(
			{ scheme: 'file', language: 'jsonc' },
			this
		));

		this.regDisposables.push(vscode.languages.registerDefinitionProvider(
			{ scheme: 'file', language: 'json' },
			this
		));

		this._parseTasks();
		this._runDiagnosticsForAllOpenedFiles();

		// run diagnostic for when user open a new jsonc file
		this.regDisposables.push(
			vscode.workspace.onDidOpenTextDocument(document => {
				if (
					document.languageId === 'jsonc' &&
					this._isIncludeFile(document.fileName)
				) {
					this._parseTasks();
					// diagnostic
					this._checkIfDependsOnAreDefined(document);
				}
			})
		);

		// run diagnostic for any user change, after save
		this.regDisposables.push(
			vscode.workspace.onDidSaveTextDocument(ev => {
				const document = ev;
				if (
					document.languageId === 'jsonc' &&
					this._isIncludeFile(document.fileName)
				) {
					this._parseTasks();
					// diagnostic
					this._checkIfDependsOnAreDefined(document);
				}
			})
		);

		// also rerun if the settings change
		this.regDisposables.push(
			vscode.workspace.onDidChangeConfiguration(ev => {
				if (ev.affectsConfiguration("tasksLabel.diagnostics")) {
					this._parseTasks();
					this._runDiagnosticsForAllOpenedFiles();
				}
			})
		);

		// put the codelens on top of the labels
		this.regDisposables.push(
			vscode.languages.registerCodeLensProvider(
				{ scheme: 'file', language: 'json' },
				this
			)
		);

		this.regDisposables.push(
			vscode.languages.registerCodeLensProvider(
				{ scheme: 'file', language: 'jsonc' },
				this
			)
		);

		this.regDisposables.push(
			vscode.languages.registerReferenceProvider(
				{ scheme: 'file', language: 'jsonc' },
				this
			)
		);
	}

	provideReferences(
		document: vscode.TextDocument,
		position: vscode.Position,
		context: vscode.ReferenceContext,
		token: vscode.CancellationToken
	): vscode.ProviderResult<vscode.Location[]> {
		let _references: vscode.Location[] = [];

		if (
			document.fileName.endsWith('tasks.json') ||
            document.fileName.endsWith('launch.json') ||
            this._isIncludeFile(document.fileName)
		) {
			// get the label
			let wordRange = document.getWordRangeAtPosition(position);
			let label = document.getText(wordRange);

			while(!(label.startsWith('"') && label.endsWith('"'))) {
				wordRange = new vscode.Range(
					(
						label.startsWith('"') ?
						wordRange!.start : wordRange!.start.translate(0, -1)
					),
					(
						label.endsWith('"') ?
						wordRange!.end : wordRange!.end.translate(0, 1)
					)
				);
				label = document.getText(wordRange);
			}

			label = label.replace(/"/g, '');

			// filter the object ref to get only those with the same label
			_references =
			this.references.find(obj => obj.label === label)?.references!;
		}

		return _references;
	}

	private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
	onDidChangeCodeLenses: vscode.Event<void> =
		this._onDidChangeCodeLenses.event;

	provideCodeLenses(
		document: vscode.TextDocument,
		token: vscode.CancellationToken
	): vscode.ProviderResult<vscode.CodeLens[]> {
		const lens: vscode.CodeLens[] = [];

		if (
			document.fileName.endsWith('tasks.json') ||
            document.fileName.endsWith('launch.json') ||
            this._isIncludeFile(document.fileName)
		) {
			for (const ref of this.references) {
				if (ref.location?.uri.fsPath === document.uri.fsPath) {
					const rang = new vscode.Range(
						document.positionAt(ref.line + 1),
						document.positionAt(
							ref.line + 1 + ref.label.length
						)
					);

					lens.push(
						{
							isResolved: true,
							range: new vscode.Range(
								document.positionAt(ref.line),
								document.positionAt(ref.line)
							),
							command: {
								// eslint-disable-next-line max-len
								title: `${ref.references?.length ?? 0} references`,
								command: "editor.action.findReferences",
								arguments: [
									document.uri,
									document.positionAt(ref.line + 1)
								]
							}
						}
					);
				}
			}
		}

		return lens;
	}

	private _runDiagnosticsForAllOpenedFiles (): void {
		for(const document of vscode.workspace.textDocuments) {
			if (
				document.languageId === 'jsonc' &&
				this._isIncludeFile(document.fileName)
			) {
				// diagnostic
				this._checkIfDependsOnAreDefined(document);
			}
		}
	}

	private _isIncludeFile(fileName: string): boolean {
		for (const folder of vscode.workspace.workspaceFolders!) {
			const rootPath = folder.uri.fsPath;
			const config = vscode.workspace.getConfiguration(
				"tasksLabel", folder.uri
			);
			const includeFiles = config.get("includeFiles") as string[] ?? [];

			let fileList = [
				".vscode/tasks.json",
				".vscode/launch.json",
				...includeFiles
			].map(relativePath => Path.join(rootPath, relativePath));
			// launch.json may not exist in multiroot workspace
			fileList = fileList.filter(fs.existsSync);

			for (let index = 0; index < fileList.length; index++) {
				const includeFile = fileList[index];
				if (fileName.endsWith(includeFile)) {
					return true;
				}
			}
		}
		return false;
	}

	public getDefinedTasks (): Task[] {
		const labels = Array<Task>();
		for (const folder of vscode.workspace.workspaceFolders!) {
			const rootPath = folder.uri.fsPath;
			const config = vscode.workspace.getConfiguration(
				"tasksLabel", folder.uri
			);
			const includeFiles = config.get("includeFiles") as string[] ?? [];

			let fileList = [
				".vscode/tasks.json",
				".vscode/launch.json",
				...includeFiles
			].map(relativePath => Path.join(rootPath, relativePath));
			// launch.json may not exist in multiroot workspace
			fileList = fileList.filter(fs.existsSync);

			for (const file of fileList) {
				try {
					const text = fs.readFileSync(file, 'utf8');
					const lines = text.split(/\r?\n/g);

					let lineNum = 0;
					// for each file get the label name and store it
					for (const line of lines) {
						const match = line.match(/"label":\s*"(.*)"/);
						if (match) {
							labels.push({
								label: match[1],
								line: lineNum
							});
						}

						lineNum++;
					}
				} catch (ex: unknown) {
					console.log(ex);
				}
			}
		}

		return labels;
	}

	private async _parseTasks (): Promise<void> {
		const labels = Array<Task>();

		for (const folder of vscode.workspace.workspaceFolders!) {
			const rootPath = folder.uri.fsPath;
			const config = vscode.workspace.getConfiguration(
				"tasksLabel", folder.uri
			);
			const includeFiles = config.get("includeFiles") as string[] ?? [];

			let fileList = [
				".vscode/tasks.json",
				".vscode/launch.json",
				...includeFiles
			].map(relativePath => Path.join(rootPath, relativePath));
			// launch.json may not exist in multiroot workspace
			fileList = fileList.filter(fs.existsSync);

			for (const file of fileList) {
				const fileUri = vscode.Uri.file(file);
				const document = await vscode.workspace.openTextDocument(
					fileUri
				);
				const scanner = JSONC.createScanner(document.getText());

				let tokenCode = 0;
				while (tokenCode !== JSONC.SyntaxKind.EOF) {
					tokenCode = scanner.scan();

					// is this a label?
					if (
						tokenCode === JSONC.SyntaxKind.StringLiteral &&
						scanner.getTokenValue() === "label"
					) {
						// get the label name
						tokenCode = scanner.scan();

						while (tokenCode !== JSONC.SyntaxKind.EOF) {
							if (tokenCode === JSONC.SyntaxKind.StringLiteral) {
								// get the label value
								const labelValue = scanner.getTokenValue();

								// update or create?
								const labelRef = labels.findIndex(
									obj => obj.label === labelValue
								);

								if (labelRef === -1) {
									// create
									labels.push({
										label: labelValue,
										line: scanner.getTokenOffset(),
										location: new vscode.Location(
											fileUri,
											new vscode.Range(
												document.positionAt(
													scanner.getTokenOffset()
												),
												document.positionAt(
													scanner.getTokenOffset()
													+
													scanner.getTokenLength()
												)
											)
										)
									});
								} else {
									// update
									labels[labelRef].location =
									new vscode.Location(
										fileUri,
										new vscode.Range(
											document.positionAt(
												scanner.getTokenOffset()
											),
											document.positionAt(
												scanner.getTokenOffset()
												+
												scanner.getTokenLength()
											)
										)
									);
									labels[labelRef].line =
										scanner.getTokenOffset();
								}

								break;
							}

							tokenCode = scanner.scan();
						}
					} else if (
						tokenCode === JSONC.SyntaxKind.StringLiteral &&
						scanner.getTokenValue() === "dependsOn"
					) {
						// get the dependsOn value
						do {
							tokenCode = scanner.scan();

							if (tokenCode === JSONC.SyntaxKind.StringLiteral) {
								// get the dependsOn value
								const dependsOnValue = scanner.getTokenValue();

								// find the label reference
								let labelRef = labels.findIndex(
									obj => obj.label === dependsOnValue
								);

								// if definitions were not located
								if (labelRef === -1) {
									labelRef = labels.push(
										{
											label: dependsOnValue,
											line: scanner.getTokenOffset()
										}
									) -1;
								}

								if (labelRef > 0) {
									if (
										labels[
											labelRef
										].references === undefined
									) {
										labels[labelRef].references = [];
									}

									labels[labelRef].references!.push(
										{
											range: new vscode.Range(
												document.positionAt(
													scanner.getTokenOffset()
												),
												document.positionAt(
													scanner.getTokenOffset()
														+
													scanner.getTokenLength()
												)
											),
											uri: fileUri
										}
									);
								}
							}
						} while (
							tokenCode !== JSONC.SyntaxKind.CloseBracketToken &&
								tokenCode !== JSONC.SyntaxKind.EOF
						);
					}
				}
			}
		}
		this.references = labels;
		this._onDidChangeCodeLenses.fire();
	}

	private _checkIfDependsOnAreDefined (document: vscode.TextDocument): void {
		for (const folder of vscode.workspace.workspaceFolders!) {
			const config = vscode.workspace.getConfiguration(
				"tasksLabel", folder.uri
			);
			const diagnosticEnabled = config.get(
				"diagnostics"
			) as boolean ?? false;

			if (diagnosticEnabled) {
				const jsonObj = JSONC.parse(document.getText());
				const _diagnostics: vscode.Diagnostic[] = [];

				// for each task that has dependsOn check the list of labels
				const tasks = jsonObj.tasks ?? [];

				for (const task of tasks) {
					if (
						task.dependsOn !== undefined
						&& task.dependsOn.length > 0
					) {
						for (const label of task.dependsOn) {
							const labels = this.getDefinedTasks().map(
								obj => obj.label
							);

							if (label) {
								// so now we have work to do
								// find out the line where this label is
								const scanner =
									JSONC.createScanner(document.getText());

								// scann the document for all the dependsOn
								let tokenCode = 0;
								while (tokenCode !== JSONC.SyntaxKind.EOF) {
									tokenCode = scanner.scan();

									if (
										tokenCode ===
											JSONC.SyntaxKind.StringLiteral &&
										scanner.getTokenValue() === label
									) {
										if (!labels.includes(label)) {
											// add it to the diagnostics
											_diagnostics.push({
												code: '',
												// eslint-disable-next-line max-len
												message: `Task "${label}" is not defined`,
												range: new vscode.Range(
													document.positionAt(
														scanner.getTokenOffset()
													),
													document.positionAt(
														scanner.getTokenOffset() +
														scanner.getTokenLength()
													)
												),
												severity:
													vscode.DiagnosticSeverity.Error,
												source: 'tasksLabel'
											});
										}
									}
								}
							}
						}
					}
				}

				// done, set it
				this.diagnostics.set(document.uri, _diagnostics);
			} else {
				this.diagnostics.clear();
			}
		}
	}

	provideDefinition(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken
	): vscode.ProviderResult<vscode.LocationLink[] | vscode.Definition>
	{
		if (
			document.fileName.endsWith('tasks.json') ||
            document.fileName.endsWith('launch.json') ||
            this._isIncludeFile(document.fileName)
		) {
			// read the file
			let text = document.getText();
			let path = document.uri.fsPath;

			// we have to get the string inside the quotes
			let range = document.getWordRangeAtPosition(position);
			let word = document.getText(range);

			while(!(word.startsWith('"') && word.endsWith('"'))) {
				range = new vscode.Range(
					(
						word.startsWith('"') ?
                            range!.start : range!.start.translate(0, -1)
					),
					(
						word.endsWith('"') ?
                            range!.end : range!.end.translate(0, 1)
					)
				);
				word = document.getText(range);
			}

			word = word.replace(/"/g, '');

			// pass trough the files
			const files: { path: string, content: string }[] = [];
			const baseIncludeFiles = vscode.workspace.getConfiguration(
				"tasksLabel").get("includeFiles"
			) as string[] ?? [];
			const includeFiles = [".vscode/tasks.json", ...baseIncludeFiles];

			for (const folder of vscode.workspace.workspaceFolders ?? []) {
				const rootPath = folder.uri.fsPath;
				const config = vscode.workspace.getConfiguration(
					"tasksLabel", folder.uri
				);
				const folderIncludeFiles = config.get(
					"includeFiles"
				) as string[] ?? includeFiles;

				const resolvedFiles = [
					".vscode/tasks.json",
					...folderIncludeFiles
				]
					.map(rel => Path.join(rootPath, rel));

				for (const file of resolvedFiles) {
					try {
						const content = fs.readFileSync(file, 'utf8');
						files.push({ path: file, content });
					} catch (ex: unknown) {
						console.log(`Error reading ${file}`, ex);
					}
				}
			}

			// for each file content
			for (const fileContent of files) {
				const lines = fileContent.content.split(/\r?\n/g);
				const lPath = fileContent.path;

				for (let index = 0; index < lines.length; index++) {
					const line = lines[index];
					const match = line.match(/"label":\s*"(.*)"/);
					if (match) {
						const task: Task = {
							label: match[1],
							line: index
						};

						if (task.label === word) {
							return [{
								targetUri: vscode.Uri.file(lPath),
								targetRange: new vscode.Range(
									task.line, 0,
									task.line, 0
								),
								originSelectionRange: range
							}];
						}
					}
				}
			}
		}

		return undefined;
	}
}
